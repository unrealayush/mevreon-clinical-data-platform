#!/usr/bin/env bash
# Cloud Run Job entrypoint for the 5-agent clinical pipeline.
# Launched by the FastAPI gateway via the Cloud Run Jobs API; env vars injected
# per-run from POST /api/runs.
set -euo pipefail
cd /app
exec python -m pipeline.monolith --stage "${STAGE:-FULL_PIPELINE}" --run_id "${RUN_ID:-no-run-id}"
