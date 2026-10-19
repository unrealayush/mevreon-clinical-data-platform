#!/usr/bin/env bash
set -euo pipefail

# Required env:
# AWS_REGION, AWS_ACCOUNT_ID, ECR_REPOSITORY, APPRUNNER_SERVICE_NAME, IMAGE_TAG (optional)
region="${AWS_REGION:?}"
account="${AWS_ACCOUNT_ID:?}"
repo="${ECR_REPOSITORY:?}"
service="${APPRUNNER_SERVICE_NAME:?}"
tag="${IMAGE_TAG:-latest}"
image="${account}.dkr.ecr.${region}.amazonaws.com/${repo}:${tag}"

echo "Using image: $image"

# Find existing service ARN (if any)
service_arn=$(aws apprunner list-services --region "$region" --query "ServiceSummaryList[?ServiceName=='${service}'].ServiceArn | [0]" --output text)

if [ -z "$service_arn" ] || [ "$service_arn" = "None" ]; then
  echo "Creating App Runner service '${service}'..."
  aws apprunner create-service \
    --region "$region" \
    --service-name "$service" \
    --source-configuration "ImageRepository={ImageIdentifier=${image},ImageRepositoryType=ECR,ImageConfiguration={Port=80}}" \
    --instance-configuration "Cpu=1024,Memory=2048"
  echo "Create request submitted."
else
  echo "Updating App Runner service '${service}'..."
  aws apprunner update-service \
    --region "$region" \
    --service-arn "$service_arn" \
    --source-configuration "ImageRepository={ImageIdentifier=${image},ImageRepositoryType=ECR,ImageConfiguration={Port=80}}"
  echo "Update request submitted."
fi
