#!/usr/bin/env bash
#
# The two roles App Runner needs.
#
# The access role lets App Runner pull the image from ECR. The instance
# role is what the running container is — and it carries exactly one
# permission beyond the defaults: invoking the one Bedrock model this
# system uses.
#
# That single permission is the reason there is no ANTHROPIC_API_KEY
# anywhere in the deployment. There is no long-lived AI credential to
# store, to rotate, or to leak.
. "$(dirname "$0")/00-config.sh"
load

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

trust() { cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"$1"},"Action":"sts:AssumeRole"}]}
JSON
}

ensure_role() { # name trust-service
  if aws iam get-role --role-name "$1" >/dev/null 2>&1; then
    note "$1 exists"
  else
    aws iam create-role --role-name "$1" \
      --assume-role-policy-document "$(trust "$2")" >/dev/null
    note "created $1"
  fi
}

say "Access role — pulling the image"
ensure_role "$ACCESS_ROLE" build.apprunner.amazonaws.com
aws iam attach-role-policy --role-name "$ACCESS_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess >/dev/null
note "AWSAppRunnerServicePolicyForECRAccess attached"

say "Instance role — what the container is"
ensure_role "$INSTANCE_ROLE" tasks.apprunner.amazonaws.com

# Scoped to the one inference profile and the models it can route to.
# Bedrock resolves an EU profile onto regional model copies, so both the
# profile and the foundation models have to be nameable.
aws iam put-role-policy --role-name "$INSTANCE_ROLE" \
  --policy-name bedrock-invoke --policy-document "$(cat <<JSON
{"Version":"2012-10-17","Statement":[{
  "Effect":"Allow",
  "Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream"],
  "Resource":[
    "arn:aws:bedrock:$AWS_REGION:$ACCOUNT:inference-profile/$BEDROCK_MODEL_ID",
    "arn:aws:bedrock:*::foundation-model/anthropic.*"
  ]}]}
JSON
)" >/dev/null
note "bedrock:InvokeModel on $BEDROCK_MODEL_ID"

# App Runner reads the two secret environment variables as the instance
# role, not as a separate service principal, so the permission belongs
# here. Without it the service pulls its image, starts, and then fails
# the health check with an error that names neither the secret nor the
# role unless the deployment log is read in full.
#
# The trailing wildcard has no hyphen before it deliberately. Secrets
# Manager appends a six-character suffix to a secret ARN, but App Runner
# requests the secret by the unsuffixed name, so a "-*" pattern matches
# the stored ARN and not the one actually being authorised.
aws iam put-role-policy --role-name "$INSTANCE_ROLE" \
  --policy-name read-own-secrets --policy-document "$(cat <<JSON
{"Version":"2012-10-17","Statement":[{
  "Effect":"Allow",
  "Action":"secretsmanager:GetSecretValue",
  "Resource":[
    "arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT:secret:$SECRET_DB*",
    "arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT:secret:$SECRET_JWT*"
  ]}]}
JSON
)" >/dev/null
note "secretsmanager:GetSecretValue on the two secrets, and no others"

save ACCESS_ROLE_ARN  "arn:aws:iam::$ACCOUNT:role/$ACCESS_ROLE"
save INSTANCE_ROLE_ARN "arn:aws:iam::$ACCOUNT:role/$INSTANCE_ROLE"
save ACCOUNT "$ACCOUNT"
say "Roles ready"
