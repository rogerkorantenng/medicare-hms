#!/usr/bin/env bash
#
# Loads the schema, the functions, the nine accounts and the seed data
# into RDS, then closes the door behind itself.
#
# It runs the same scripts/seed.py the local stack uses, pointed at the
# RDS endpoint — there is no separate "production migration" to drift out
# of step with what was tested.
. "$(dirname "$0")/00-config.sh"
load

: "${DATABASE_URL:?run 01-database.sh first}"

say "Loading the schema and the seed data into RDS"
(
  cd "$(dirname "$0")/../../backend"
  DATABASE_URL="$DATABASE_URL" \
  DEMO_PASSWORD="${DEMO_PASSWORD:-MediCare2026!Demo}" \
    uv run python scripts/seed.py "${1:---reset}"
)

say "Closing the door"
# The database was reachable from this machine only so that the schema
# could be loaded. From here it is reachable from the App Runner
# connector and nothing else.
if aws ec2 revoke-security-group-ingress --group-id "$DB_SG" --protocol tcp \
     --port 5432 --cidr "$MY_IP/32" >/dev/null 2>&1; then
  note "revoked $MY_IP"
else
  note "$MY_IP was not in the group"
fi

remaining=$(aws ec2 describe-security-groups --group-ids "$DB_SG" \
             --query 'SecurityGroups[0].IpPermissions[].IpRanges[].CidrIp' --output text)
if [ -n "$remaining" ]; then
  printf '\n\033[31mThe database is still open to: %s\033[0m\n' "$remaining" >&2
  exit 1
fi
note "no address range can reach the database — only the connector"

say "Database seeded"
