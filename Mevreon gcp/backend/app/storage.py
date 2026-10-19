"""GCS-backed storage that emulates the S3 list/get/put shape the frontend shim expects.

The browser frontend (App.jsx) was written for @aws-sdk/client-s3. The GCP
version swaps S3Client for a tiny REST shim (gcpStorage.js) that calls these
endpoints; this module does the real GCS I/O and returns S3-shaped JSON so the
10k-line UI keeps working with a single import change.
"""
import os
import json
from google.auth import default as _default_creds
from google.cloud import storage as _gcs
from functools import lru_cache
from .config import BUCKETS


@lru_cache(maxsize=1)
def client():
    creds, project_id = _default_creds(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    # Credentials from ADC on Cloud Run do NOT always expose .project_id —
    # the project id comes back as the second tuple element from default().
    project = getattr(creds, "project_id", None) or project_id or os.getenv("GOOGLE_CLOUD_PROJECT", "mevreon")
    return _gcs.Client(credentials=creds, project=project)


def _resolve_bucket(name_or_alias: str) -> str:
    """Accept an alias ('RAW') or a real bucket name."""
    if name_or_alias in BUCKETS:
        return BUCKETS[name_or_alias]
    return name_or_alias


def list_objects(bucket, prefix="", delimiter=None, max_keys=None, continuation_token=None) -> dict:
    b = client().bucket(_resolve_bucket(bucket))
    it = b.list_blobs(
        prefix=prefix or None,
        delimiter=delimiter or None,
        max_results=max_keys,
        page_token=continuation_token or None,
    )
    blobs = list(it)
    contents = [{
        "Key": x.name,
        "Size": x.size,
        "LastModified": x.updated.isoformat() if x.updated else ""
    } for x in blobs]

    common = [{"Prefix": p} for p in sorted(it.prefixes or [])]
    next_token = getattr(it, "next_page_token", None)

    return {
        "Contents": contents,
        "CommonPrefixes": common,
        "IsTruncated": bool(next_token),
        "NextContinuationToken": next_token,
        "KeyCount": len(contents),
    }


def get_object(bucket, key, as_text=False):
    b = client().bucket(_resolve_bucket(bucket))
    blob = b.blob(key)
    if not blob.exists():
        raise FileNotFoundError(f"gs://{bucket}/{key}")
    data = blob.download_as_bytes()
    return data.decode("utf-8", errors="ignore") if as_text else data


def put_object(bucket, key, data, content_type="application/octet-stream"):
    b = client().bucket(_resolve_bucket(bucket))
    if isinstance(data, dict):
        body = json.dumps(data, indent=2, default=str)
        ct = "application/json"
    elif isinstance(data, bytes):
        body = data
        ct = content_type
    else:
        body = str(data)
        ct = content_type
    blob = b.blob(key)
    blob.upload_from_string(body, content_type=ct)
    return {"bucket": _resolve_bucket(bucket), "key": key, "size": blob.size}
