#!/usr/bin/env bash
#
# Builds the API image and pushes it to ECR.
#
# --platform linux/amd64 is not optional: App Runner runs x86, and an
# image built on an arm64 laptop starts and then exits immediately with
# "exec format error", which App Runner reports only as a failed health
# check.
. "$(dirname "$0")/00-config.sh"
load

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE="$REGISTRY/$ECR_REPO:latest"

say "Repository"
aws ecr create-repository --repository-name "$ECR_REPO" \
  --image-scanning-configuration scanOnPush=true >/dev/null 2>&1 \
  && note "created $ECR_REPO" || note "$ECR_REPO exists"

say "Signing in to ECR"
aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
note "$REGISTRY"

say "Build and push"
docker build --platform linux/amd64 -t "$IMAGE" "$(dirname "$0")/../../backend"
docker push "$IMAGE"

save IMAGE "$IMAGE"
save ACCOUNT "$ACCOUNT"
say "Pushed $IMAGE"
