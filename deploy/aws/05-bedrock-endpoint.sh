#!/usr/bin/env bash
#
# A VPC endpoint for Bedrock.
#
# This exists because of a consequence that is easy to miss. Routing the
# service's egress through a VPC connector is what lets the database stay
# private, but it also means the service no longer has the default route to
# the internet that App Runner would otherwise give it. Its network
# interfaces have no public address, so an internet gateway does not help
# them, and a call to Bedrock's public endpoint simply hangs until the
# request times out. The API stays up and every AI feature shows its
# fallback message, which is correct behaviour and also why the cause is
# invisible from the outside.
#
# The two ways to fix it are a NAT gateway or a private endpoint. The
# endpoint is chosen here: it costs less, and it keeps the traffic on the
# AWS network rather than sending it out and back.
. "$(dirname "$0")/00-config.sh"
load

: "${VPC_ID:?run 01-database.sh first}"
: "${CONNECTOR_SG:?run 01-database.sh first}"

SERVICE_NAME_EP="com.amazonaws.$AWS_REGION.bedrock-runtime"
ENDPOINT_SG_NAME="$PROJECT-bedrock-endpoint-sg"

say "Endpoint security group"
EP_SG=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" \
  Name=group-name,Values="$ENDPOINT_SG_NAME" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)

if [ "$EP_SG" = "None" ] || [ -z "$EP_SG" ]; then
  EP_SG=$(aws ec2 create-security-group --group-name "$ENDPOINT_SG_NAME" \
    --description "Bedrock endpoint for $PROJECT" --vpc-id "$VPC_ID" \
    --query GroupId --output text)
  note "created ($EP_SG)"
else
  note "exists ($EP_SG)"
fi

aws ec2 authorize-security-group-ingress --group-id "$EP_SG" --protocol tcp \
  --port 443 --source-group "$CONNECTOR_SG" >/dev/null 2>&1 \
  && note "allowed 443 from the App Runner connector" \
  || note "443 from the connector was already allowed"

say "Endpoint"
EXISTING=$(aws ec2 describe-vpc-endpoints \
  --filters Name=vpc-id,Values="$VPC_ID" Name=service-name,Values="$SERVICE_NAME_EP" \
  --query 'VpcEndpoints[0].VpcEndpointId' --output text 2>/dev/null)

if [ "$EXISTING" = "None" ] || [ -z "$EXISTING" ]; then
  # One subnet is enough for a single-instance service, and each subnet
  # carries its own hourly charge. Add the others if the service scales
  # across availability zones.
  FIRST_SUBNET=$(echo $SUBNETS | awk '{print $1}')
  EXISTING=$(aws ec2 create-vpc-endpoint --vpc-id "$VPC_ID" \
    --vpc-endpoint-type Interface --service-name "$SERVICE_NAME_EP" \
    --subnet-ids "$FIRST_SUBNET" --security-group-ids "$EP_SG" \
    --private-dns-enabled \
    --query 'VpcEndpoint.VpcEndpointId' --output text)
  note "created $EXISTING in $FIRST_SUBNET"
else
  note "exists ($EXISTING)"
fi
save BEDROCK_ENDPOINT "$EXISTING"

say "Waiting for the endpoint to become available"
until [ "$(aws ec2 describe-vpc-endpoints --vpc-endpoint-ids "$EXISTING" \
           --query 'VpcEndpoints[0].State' --output text)" = "available" ]; do
  sleep 10
done
note "available"

say "Bedrock reachable"
