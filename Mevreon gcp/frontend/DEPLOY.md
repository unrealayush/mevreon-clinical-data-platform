# Deploy Frontend to Google Cloud Run

To build and deploy the frontend container to Google Cloud Run:

```bash
cd "Mevreon gcp"

# Build and deploy frontend to Cloud Run
./deploy/gcp.sh build-frontend
./deploy/gcp.sh deploy-frontend
```

This will automatically:
1. Detect the active Cloud Run backend URL.
2. Inject `VITE_API_BASE` into `.env.production`.
3. Submit the build to Google Cloud Build.
4. Deploy to Cloud Run service `mevreon-gcp-frontend` in `us-central1`.
