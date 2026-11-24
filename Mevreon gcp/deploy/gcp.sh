#!/usr/bin/env bash
# GCP deploy for the Mevreon clinical pipeline (Ingestion -> Cleaning -> Validation
# -> Feature -> Narrative Judge). Backend (FastAPI gateway + monolith) and
# frontend (React) both deploy to Cloud Run; the pipeline runs as a Cloud Run Job.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # Mevreon gcp/
BC="$ROOT/backend"; FE="$ROOT/frontend"

PROJECT="$(gcloud config get-value project)"
REGION="${REGION:-us-central1}"
BACKEND_IMG="$REGION-docker.pkg.dev/$PROJECT/mevreon/mevreon-gcp-backend"
FRONTEND_IMG="$REGION-docker.pkg.dev/$PROJECT/mevreon/mevreon-gcp-frontend"
BUCKETS="mevreon-raw-gcp mevreon-staging-gcp mevreon-processed-gcp mevreon-curated-gcp mevreon-memory-gcp mevreon-quarantine-gcp"
VERTEX_MODEL="${VERTEX_MODEL:-gemini-2.5-pro}"
JWT_SECRET="${JWT_SECRET:-dev-secret-change-me-$(date +%s)}"
export PROJECT REGION BACKEND_IMG FRONTEND_IMG VERTEX_MODEL JWT_SECRET

usage() { echo "Usage: $0 [apis|buckets|iam|build-backend|deploy-backend|job|build-frontend|deploy-frontend|all]"; }

do_apis()  { gcloud services enable run.googleapis.com artifactregistry.googleapis.com storage.googleapis.com storage-component.googleapis.com aiplatform.googleapis.com iam.googleapis.com cloudbuild.googleapis.com iamcredentials.googleapis.com; echo "[OK] APIs enabled"; }

do_buckets() { for b in $BUCKETS; do gsutil mb -p "$PROJECT" -l "$REGION" -c STANDARD "gs://$b" >/dev/null 2>&1 || true; gsutil versioning set on "gs://$b" >/dev/null 2>&1 || true; done; echo "[OK] buckets ready"; }

do_iam() { local n s; n="$(gcloud projects describe "$PROJECT" --format=value(projectNumber))"; s="$n-compute@developer.gserviceaccount.com"; for r in roles/storage.objectAdmin roles/aiplatform.user roles/run.invoker roles/iam.serviceAccounts.actAs roles/run.jobsInvoker; do gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$s" --role="$r" >/dev/null 2>&1 || true; done; echo "[OK] IAM ready for $s"; }

do_build_backend() { (cd "$BC" && gcloud builds submit . --tag "$BACKEND_IMG" --timeout=1800); echo "[OK] backend image built -> $BACKEND_IMG"; }

do_deploy_backend() { gcloud run deploy mevreon-gcp-backend \
  --image "$BACKEND_IMG" --region "$REGION" --platform managed \
  --port 8080 --memory 2Gi --cpu 1 --timeout 1800 --max-instances 4 \
  --set-env-vars="FRONTEND_ORIGIN=*,JWT_SECRET=$JWT_SECRET,GOOGLE_CLOUD_PROJECT=$PROJECT,GCP_REGION=$REGION,VERTEX_MODEL=$VERTEX_MODEL,API_ACCESS_KEY=${API_ACCESS_KEY:-MEVREON-GCP-ACCESS-2026},API_SECRET_KEY=${API_SECRET_KEY:-Yk7pQ2mVn9Rt4wXz8eB6cH3jF5sA1d0q}" \
  --update-annotations=run.googleapis.com/invoker-iam-disabled=true \
  --quiet; echo "[OK] backend deployed"; }

do_job() { env="GOOGLE_CLOUD_PROJECT=$PROJECT,GCP_REGION=$REGION,BUCKET_RAW=mevreon-raw-gcp,BUCKET_STAGING=mevreon-staging-gcp,BUCKET_PROCESSED=mevreon-processed-gcp,BUCKET_CURATED=mevreon-curated-gcp,BUCKET_MEMORY=mevreon-memory-gcp,BUCKET_QUARANTINE=mevreon-quarantine-gcp,VERTEX_MODEL=$VERTEX_MODEL"; gcloud run jobs create mevreon-pipeline --image "$BACKEND_IMG" --region "$REGION" --platform managed --command "python" --args=-m,pipeline.run --set-env-vars="$env" --task-timeout 1800 --max-retries 0 --memory 4Gi --cpu 2 --quiet 2>/dev/null || gcloud run jobs update mevreon-pipeline --image "$BACKEND_IMG" --region "$REGION" --command "python" --args=-m,pipeline.run --set-env-vars="$env" --task-timeout 1800 --max-retries 0 --memory 4Gi --cpu 2 --quiet; echo "[OK] pipeline job ready"; }

do_build_frontend() { printf 'VITE_API_BASE=%s\n' "$(gcloud run services describe mevreon-gcp-backend --region "$REGION" --format='value(status.url)' 2>/dev/null || echo '')" > "$FE/.env.production"; (cd "$FE" && gcloud builds submit . --tag "$FRONTEND_IMG" --timeout=900); echo "[OK] frontend image built -> $FRONTEND_IMG"; }

do_deploy_frontend() { gcloud run deploy mevreon-gcp-frontend \
  --image "$FRONTEND_IMG" --region "$REGION" --platform managed \
  --port 80 --memory 512Mi --cpu 1 \
  --update-annotations=run.googleapis.com/invoker-iam-disabled=true \
  --quiet; echo "[OK] frontend deployed"; echo "FRONTEND_URL=$(gcloud run services describe mevreon-gcp-frontend --region "$REGION" --format='value(status.url)')"; }

case "${1:-all}" in
  apis)        do_apis ;;
  buckets)     do_buckets ;;
  iam)         do_iam ;;
  build-backend)  do_build_backend ;;
  deploy-backend) do_deploy_backend ;;
  job)         do_job ;;
  build-frontend) do_build_frontend ;;
  deploy-frontend) do_deploy_frontend ;;
  all) do_apis; do_buckets; do_iam; do_build_backend; do_deploy_backend; do_job; do_build_frontend; do_deploy_frontend ;;
  *) usage; exit 1 ;;
esac
