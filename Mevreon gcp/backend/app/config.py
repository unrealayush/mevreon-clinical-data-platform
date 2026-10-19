"""Centralized GCP configuration (env-driven, 12-factor)."""
import os

PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "mevreon")
REGION = os.getenv("GCP_REGION", "us-central1")

# Same logical names the frontend CONFIG.buckets uses; values = real GCS buckets.
BUCKETS = {
    "RAW":        os.getenv("BUCKET_RAW",        "mevreon-raw-gcp"),
    "STAGING":    os.getenv("BUCKET_STAGING",    "mevreon-staging-gcp"),
    "PROCESSED":  os.getenv("BUCKET_PROCESSED",  "mevreon-processed-gcp"),
    "CURATED":    os.getenv("BUCKET_CURATED",    "mevreon-curated-gcp"),
    "MEMORY":     os.getenv("BUCKET_MEMORY",     "mevreon-memory-gcp"),
    "QUARANTINE": os.getenv("BUCKET_QUARANTINE", "mevreon-quarantine-gcp"),
}

PIPELINE_JOB = os.getenv("PIPELINE_JOB", "mevreon-pipeline")

# Vertex AI Gemini (replaces AWS Bedrock — Mistral Ministral 14B / Llama4 Maverick / Gemma-3)
VERTEX_MODEL = os.getenv("VERTEX_MODEL", "gemini-2.5-pro")
VERTEX_JUDGE_MODEL = os.getenv("VERTEX_JUDGE_MODEL", "gemini-2.5-flash")

# Auth (JWT). Replace with Cognito/Firebase for production.
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE-ME-in-production-0xDEADBEEF")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "1440"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@mevreon.ai")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Mevreon123!")

# API keys (mirrors the AWS IAM access-key login flow of the original app).
# The frontend "Secure Clinical Login" screen posts these to /api/auth/key,
# which mints the same JWT used for all subsequent Bearer-authenticated calls.
API_ACCESS_KEY = os.getenv("API_ACCESS_KEY", "MEVREON-GCP-ACCESS-2026")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "Yk7pQ2mVn9Rt4wXz8eB6cH3jF5sA1d0q")

# Frontend origin for CORS (set to the deployed Cloud Run URL in prod).
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")
