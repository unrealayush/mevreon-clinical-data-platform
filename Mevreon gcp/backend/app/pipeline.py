"""Cloud Run Job orchestration + per-run status tracking.

POST /api/runs / the storage 'put' of a __PROCESS__ marker → launch a Cloud Run
Job execution with env overrides. The job (monolith.py) writes stage artifacts to
GCS and a final status doc to gs://MEMORY/runs/<run_id>/__status.json.
"""
import os
import json
import uuid
import datetime
import requests
from google.auth import default as _default_creds
from .config import PROJECT, REGION, PIPELINE_JOB, BUCKETS, VERTEX_MODEL, VERTEX_JUDGE_MODEL
from . import storage


STATUS_PREFIX = "runs"


def _status_key(run_id: str) -> str:
    return f"{STATUS_PREFIX}/{run_id}/__status.json"


def _bearer() -> str:
    creds, _ = _default_creds(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    # On Cloud Run the fresh ADC creds start with token=None; refresh to populate it.
    if not getattr(creds, "token", None):
        from google.auth.transport.requests import Request as _AuthRequest
        creds.refresh(_AuthRequest())
    return "Bearer " + (creds.token or "")


def write_status(run_id: str, payload: dict) -> None:
    payload = dict(payload)
    payload.setdefault("runId", run_id)
    storage.put_object(BUCKETS["MEMORY"], _status_key(run_id), payload)


def read_status(run_id: str) -> dict:
    try:
        return json.loads(storage.get_object(BUCKETS["MEMORY"], _status_key(run_id), as_text=True))
    except Exception:
        return {"runId": run_id, "status": "UNKNOWN"}


def create_run(case_id: str, stage: str = "FULL_PIPELINE") -> dict:
    now = datetime.datetime.now(datetime.timezone.utc)
    run_id = f"run-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    case_folder = case_id.replace(" ", "+")  # match frontend S3 key encoding

    write_status(run_id, {
        "caseId": case_id,
        "folder": case_folder,
        "status": "SUBMITTED",
        "stage": stage,
        "startedAt": now.isoformat(),
        "stages": {},
    })

    env = [
        {"name": "RUN_ID",               "value": run_id},
        {"name": "TARGET_BUCKET",        "value": BUCKETS["RAW"]},
        {"name": "TARGET_KEY",           "value": f"{case_folder}/__PROCESS__"},
        {"name": "STAGE",                "value": stage},
        {"name": "GOOGLE_CLOUD_PROJECT", "value": PROJECT},
        {"name": "PROJECT",              "value": PROJECT},
        {"name": "GCP_REGION",           "value": REGION},
        {"name": "VERTEX_MODEL",         "value": VERTEX_MODEL},
        {"name": "VERTEX_JUDGE_MODEL",   "value": VERTEX_JUDGE_MODEL},
    ]
    # ensure the monolith gets all configured bucket names
    for alias, real in BUCKETS.items():
        env.append({"name": f"BUCKET_{alias}", "value": real})

    url = f"https://run.googleapis.com/v2/projects/{PROJECT}/locations/{REGION}/jobs/{PIPELINE_JOB}:run"
    # NOTE: the v2 Jobs API does NOT accept an "executionId" field in the body
    # (400 INVALID_ARGUMENT) — the execution name is auto-generated, so we omit it.
    body = {
        "overrides": {"containerOverrides": [{"env": env}]},
    }
    resp = requests.post(url, headers={
        "Authorization": _bearer(),
        "Content-Type": "application/json",
    }, json=body, timeout=30)
    if resp.status_code == 409:
        # execution id collision — extremely unlikely; retry with a fresh id
        raise RuntimeError("Execution ID collision")
    resp.raise_for_status()
    info = resp.json()
    write_status(run_id, {
        "status": "RUNNING",
        "execution": info.get("name"),
        "stages": {},
    })
    return {"run_id": run_id, "case_id": case_id, "execution": info.get("name")}
