#!/usr/bin/env bash
#
# The database: two security groups, a subnet group and an RDS instance.
#
# The instance is publicly addressable but not publicly reachable — the
# security group opens 5432 to exactly two things: the App Runner VPC
# connector, and whichever address is running this script, so the schema
# can be loaded. 03-seed.sh revokes the second one when it has finished.
#
# Idempotent: re-running finds what exists rather than failing.
. "$(dirname "$0")/00-config.sh"
load

say "Network"
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
          --query 'Vpcs[0].VpcId' --output text)
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
           Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text)
note "VPC $VPC_ID"
note "subnets $SUBNETS"

group_id() { # name
  aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" \
    Name=group-name,Values="$1" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null
}

ensure_group() { # name description
  local id; id=$(group_id "$1")
  if [ "$id" = "None" ] || [ -z "$id" ]; then
    id=$(aws ec2 create-security-group --group-name "$1" --description "$2" \
          --vpc-id "$VPC_ID" --query GroupId --output text)
    note "created $1 ($id)"
  else
    note "$1 exists ($id)"
  fi
  echo "$id"
}

CONNECTOR_SG=$(ensure_group "$CONNECTOR_SG_NAME" "App Runner egress for $PROJECT")
DB_SG=$(ensure_group "$DB_SG_NAME" "Postgres for $PROJECT")

say "Who may reach port 5432"
# From the App Runner connector, privately, inside the VPC.
aws ec2 authorize-security-group-ingress --group-id "$DB_SG" --protocol tcp \
  --port 5432 --source-group "$CONNECTOR_SG" >/dev/null 2>&1 \
  && note "allowed the App Runner connector" || note "the App Runner connector was already allowed"

# And from here, so the schema can be loaded. Revoked by 03-seed.sh.
MY_IP=$(curl -s --max-time 15 https://checkip.amazonaws.com | tr -d '[:space:]')
aws ec2 authorize-security-group-ingress --group-id "$DB_SG" --protocol tcp \
  --port 5432 --cidr "$MY_IP/32" >/dev/null 2>&1 \
  && note "allowed $MY_IP temporarily, for loading the schema" \
  || note "$MY_IP was already allowed"

say "Subnet group"
aws rds create-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP_NAME" \
  --db-subnet-group-description "$PROJECT" --subnet-ids $SUBNETS >/dev/null 2>&1 \
  && note "created" || note "exists"

say "Instance"
if aws rds describe-db-instances --db-instance-identifier "$DB_ID" >/dev/null 2>&1; then
  note "$DB_ID exists — leaving it alone"
  [ -n "${DB_PASSWORD:-}" ] || {
    echo "  The instance exists but deploy/aws/.state has no password." >&2
    echo "  Recover it from Secrets Manager: aws secretsmanager get-secret-value --secret-id $SECRET_DB" >&2
    exit 1
  }
else
  DB_PASSWORD=$(python3 -c "import secrets,string; a=string.ascii_letters+string.digits; print(''.join(secrets.choice(a) for _ in range(32)))")
  save DB_PASSWORD "$DB_PASSWORD"
  aws rds create-db-instance \
    --db-instance-identifier "$DB_ID" \
    --db-instance-class "$DB_CLASS" \
    --engine postgres --engine-version "$DB_ENGINE_VERSION" \
    --allocated-storage "$DB_STORAGE" --storage-type gp3 --storage-encrypted \
    --master-username "$DB_USER" --master-user-password "$DB_PASSWORD" \
    --db-name "$DB_NAME" \
    --db-subnet-group-name "$SUBNET_GROUP_NAME" \
    --vpc-security-group-ids "$DB_SG" \
    --publicly-accessible \
    --backup-retention-period 7 \
    --no-multi-az \
    --no-auto-minor-version-upgrade \
    --deletion-protection >/dev/null
  note "creating $DB_ID — this takes about ten minutes"
fi

save VPC_ID "$VPC_ID"
save DB_SG "$DB_SG"
save CONNECTOR_SG "$CONNECTOR_SG"
save SUBNETS "\"$SUBNETS\""
save MY_IP "$MY_IP"

say "Waiting for the instance to become available"
aws rds wait db-instance-available --db-instance-identifier "$DB_ID"

ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier "$DB_ID" \
            --query 'DBInstances[0].Endpoint.Address' --output text)
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME"
save DB_ENDPOINT "$ENDPOINT"
save DATABASE_URL "$DATABASE_URL"
note "$ENDPOINT"

say "Secrets"
put_secret() { # name value
  aws secretsmanager create-secret --name "$1" --secret-string "$2" >/dev/null 2>&1 \
    || aws secretsmanager put-secret-value --secret-id "$1" --secret-string "$2" >/dev/null
  note "$1"
}
JWT_SECRET="${JWT_SECRET:-$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')}"
save JWT_SECRET "$JWT_SECRET"
put_secret "$SECRET_DB"  "$DATABASE_URL"
put_secret "$SECRET_JWT" "$JWT_SECRET"

say "Database ready"
