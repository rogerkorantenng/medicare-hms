#!/usr/bin/env bash
#
# The API on App Runner: a VPC connector so it can reach RDS privately,
# then the service itself.
#
# Configuration arrives as environment variables. The two that are secret
# — the database URL and the JWT signing key — are read from Secrets
# Manager by App Runner at start-up rather than written into the service
# configuration, so neither appears in the console, in a describe call, or
# in this repository. There is no third secret: Bedrock is reached through
# the instance role.
. "$(dirname "$0")/00-config.sh"
load

: "${INSTANCE_ROLE_ARN:?run 02-roles.sh first}"
: "${IMAGE:?run 02-image.sh first}"
: "${DB_ENDPOINT:?run 01-database.sh first}"

say "VPC connector"
CONNECTOR_ARN=$(aws apprunner list-vpc-connectors \
  --query "VpcConnectors[?VpcConnectorName=='$VPC_CONNECTOR_NAME' && Status=='ACTIVE'] | [0].VpcConnectorArn" \
  --output text 2>/dev/null)

if [ "$CONNECTOR_ARN" = "None" ] || [ -z "$CONNECTOR_ARN" ]; then
  CONNECTOR_ARN=$(aws apprunner create-vpc-connector \
    --vpc-connector-name "$VPC_CONNECTOR_NAME" \
    --subnets $SUBNETS --security-groups "$CONNECTOR_SG" \
    --query 'VpcConnector.VpcConnectorArn' --output text)
  note "created"
else
  note "exists"
fi
save CONNECTOR_ARN "$CONNECTOR_ARN"

say "Service"
SERVICE_ARN=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'] | [0].ServiceArn" \
  --output text 2>/dev/null)

# CORS lists the Vercel origin once it is known; until then the API is
# only called server-to-server, which CORS does not govern anyway.
CORS="${VERCEL_URL:-http://localhost:3000}"

SOURCE=$(cat <<JSON
{
  "ImageRepository": {
    "ImageIdentifier": "$IMAGE",
    "ImageRepositoryType": "ECR",
    "ImageConfiguration": {
      "Port": "8000",
      "RuntimeEnvironmentVariables": {
        "AI_PROVIDER": "bedrock",
        "AWS_REGION": "$AWS_REGION",
        "BEDROCK_MODEL_ID": "$BEDROCK_MODEL_ID",
        "CORS_ORIGINS": "$CORS",
        "ENVIRONMENT": "production"
      },
      "RuntimeEnvironmentSecrets": {
        "DATABASE_URL": "arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT:secret:$SECRET_DB",
        "JWT_SECRET": "arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT:secret:$SECRET_JWT"
      }
    }
  },
  "AutoDeploymentsEnabled": false,
  "AuthenticationConfiguration": { "AccessRoleArn": "$ACCESS_ROLE_ARN" }
}
JSON
)

NETWORK=$(cat <<JSON
{"EgressConfiguration":{"EgressType":"VPC","VpcConnectorArn":"$CONNECTOR_ARN"},
 "IngressConfiguration":{"IsPubliclyAccessible":true}}
JSON
)

HEALTH='{"Protocol":"HTTP","Path":"/health","Interval":10,"Timeout":5,"HealthyThreshold":1,"UnhealthyThreshold":5}'

if [ "$SERVICE_ARN" = "None" ] || [ -z "$SERVICE_ARN" ]; then
  SERVICE_ARN=$(aws apprunner create-service \
    --service-name "$SERVICE_NAME" \
    --source-configuration "$SOURCE" \
    --instance-configuration "{\"Cpu\":\"$APPRUNNER_CPU\",\"Memory\":\"$APPRUNNER_MEMORY\",\"InstanceRoleArn\":\"$INSTANCE_ROLE_ARN\"}" \
    --network-configuration "$NETWORK" \
    --health-check-configuration "$HEALTH" \
    --query 'Service.ServiceArn' --output text)
  note "creating"
else
  aws apprunner update-service --service-arn "$SERVICE_ARN" \
    --source-configuration "$SOURCE" \
    --instance-configuration "{\"Cpu\":\"$APPRUNNER_CPU\",\"Memory\":\"$APPRUNNER_MEMORY\",\"InstanceRoleArn\":\"$INSTANCE_ROLE_ARN\"}" \
    --network-configuration "$NETWORK" \
    --health-check-configuration "$HEALTH" >/dev/null
  note "updating"
fi
save SERVICE_ARN "$SERVICE_ARN"

say "Waiting for the service to run"
for _ in $(seq 1 80); do
  STATUS=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" \
            --query 'Service.Status' --output text)
  case "$STATUS" in
    RUNNING) break ;;
    CREATE_FAILED|DELETE_FAILED)
      printf '\n\033[31mThe service is %s. The deployment log says why:\033[0m\n' "$STATUS" >&2
      printf '  aws apprunner list-operations --service-arn %s\n' "$SERVICE_ARN" >&2
      exit 1 ;;
  esac
  note "$STATUS"
  sleep 20
done

URL=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" \
       --query 'Service.ServiceUrl' --output text)
save API_URL "https://$URL"

say "Checking it answers"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$URL/health")
if [ "$code" = "200" ]; then
  note "https://$URL/health → 200"
else
  printf '\n\033[31m/health returned %s\033[0m\n' "$code" >&2
  exit 1
fi

say "API live at https://$URL"
