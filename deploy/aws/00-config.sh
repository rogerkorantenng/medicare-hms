#!/usr/bin/env bash
#
# Names and sizes, in one place. Sourced by every other script here.
#
# Region is eu-west-1 rather than the account default because the Bedrock
# model this system uses is reached through an EU inference profile
# (eu.anthropic.*). A bare model id is rejected with "on-demand throughput
# isn't supported", and the EU profile is not offered outside the EU, so
# the region follows the model rather than the other way round.
set -euo pipefail

export AWS_DEFAULT_REGION="${AWS_REGION:-eu-west-1}"
export AWS_REGION="$AWS_DEFAULT_REGION"

PROJECT=medicare
DB_ID="$PROJECT-db"
DB_NAME=medicare
DB_USER=medicare
DB_CLASS=db.t4g.micro          # smallest current-generation instance
DB_STORAGE=20                  # GiB, gp3
# Postgres 16, matching postgres:16-alpine in docker-compose. RDS retires
# minor versions, so this is the newest 16.x rather than a pinned patch:
#   aws rds describe-db-engine-versions --engine postgres \
#     --query 'DBEngineVersions[?starts_with(EngineVersion,`16.`)].EngineVersion'
DB_ENGINE_VERSION=16.14

ECR_REPO="$PROJECT-api"
SERVICE_NAME="$PROJECT-api"
APPRUNNER_CPU="0.25 vCPU"
APPRUNNER_MEMORY="0.5 GB"

DB_SG_NAME="$PROJECT-db-sg"
CONNECTOR_SG_NAME="$PROJECT-apprunner-sg"
VPC_CONNECTOR_NAME="$PROJECT-vpc-connector"
SUBNET_GROUP_NAME="$PROJECT-subnets"

INSTANCE_ROLE="$PROJECT-apprunner-instance-role"
ACCESS_ROLE="$PROJECT-apprunner-ecr-access-role"

SECRET_DB="$PROJECT/database-url"
SECRET_JWT="$PROJECT/jwt-secret"

BEDROCK_MODEL_ID=eu.anthropic.claude-opus-4-6-v1

# Written by 01-database.sh and read by the scripts after it. Gitignored:
# it holds the database password.
STATE_FILE="$(dirname "${BASH_SOURCE[0]}")/.state"

save() { # key value
  touch "$STATE_FILE"
  grep -v "^$1=" "$STATE_FILE" > "$STATE_FILE.tmp" 2>/dev/null || true
  mv "$STATE_FILE.tmp" "$STATE_FILE" 2>/dev/null || true
  echo "$1=$2" >> "$STATE_FILE"
  chmod 600 "$STATE_FILE"
}

# The `return 0` matters: without it a missing state file makes `load` the
# last command of a failing && chain, and `set -e` kills the script before
# it prints anything at all.
load() { [ -f "$STATE_FILE" ] && . "$STATE_FILE"; return 0; }

# Say which line failed rather than exiting silently.
trap 'printf "\n\033[31mFailed at %s line %s\033[0m\n" "${BASH_SOURCE[0]}" "$LINENO" >&2' ERR

# Progress goes to stderr, not stdout. Helper functions here return values
# by echoing them, so a note on stdout would be captured into the value —
# which is exactly how a security-group id once arrived at the AWS CLI with
# a log line and a newline inside it ("Input can't contain control
# characters", from a call whose arguments all looked correct).
say()  { printf '\n\033[1m%s\033[0m\n' "$*" >&2; }
note() { printf '  %s\n' "$*" >&2; }
