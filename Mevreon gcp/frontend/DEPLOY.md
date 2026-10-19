# Deploy to AWS App Runner

Required GitHub repository secrets:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION (e.g. us-east-1)
- AWS_ACCOUNT_ID
- ECR_REPOSITORY (e.g. mevreon-frontend)
- APPRUNNER_SERVICE_NAME (e.g. mevreon-front)

Workflow:
1. Push to main → GitHub Action builds Docker image, pushes to ECR, then creates/updates App Runner service.

Local deploy (for testing):
1. Build & push to ECR manually.
2. Run:
   IMAGE_TAG=your_tag AWS_REGION=... AWS_ACCOUNT_ID=... ECR_REPOSITORY=... APPRUNNER_SERVICE_NAME=... ./deploy/apprunner-deploy.sh
