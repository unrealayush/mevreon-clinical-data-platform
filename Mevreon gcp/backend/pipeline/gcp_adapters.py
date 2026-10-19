"""GCP adapters for the Mevreon monolith.

pipeline/monolith.py is a verbatim copy of the AWS version (6000 lines of
clinical logic never change). This module installs GCP implementations for the
only AWS-dependent pieces by patching monolith.AWS and monolith.Cfg:

  Cfg.MODEL/COMPARE_MODEL/EVAL_* -> Vertex AI Gemini ids
  Cfg.EVAL_ROLE_ARN = ""         -> async Bedrock eval never fires
  AWS.read/write/list_keys       -> Google Cloud Storage
  AWS._call_converse             -> Gemini  (ask/ask_long untouched)
  AWS.llm_image                  -> Gemini vision
  AWS.launch_llm_judge_job/...   -> no-op stubs (GCP-incompatible)

The async Bedrock LLM-as-judge eval is guarded by `if Cfg.EVAL_ROLE_ARN:`
(False on GCP). The inline judge computed via AWS.ask (now Gemini) still writes
JUDGE_REPORT.json, so the 5th agent still works.
"""
import os
import time
import json
from typing import Any

import pipeline.monolith as M
from app.config import PROJECT, REGION, VERTEX_MODEL, VERTEX_JUDGE_MODEL, BUCKETS

from google import genai
from google.genai import types as _gt
from google.cloud import storage as _storage_mod


def _retry_generate(call, attempts=4, base=5.0):
    """Retry transient Gemini / 5xx errors (no extra deps)."""
    last = None
    for i in range(attempts):
        try:
            return call()
        except Exception as e:
            last = e
            print(f"[GCP] Gemini call failed (attempt {i+1}/{attempts}): {e}", flush=True)
            time.sleep(base * (2 ** i))
    raise last


# Vertex AI (Gemini) + GCS clients. ADC: Cloud Run SA / `gcloud auth adc login`.
_genai = genai.Client(vertexai=True, project=PROJECT, location=REGION)
_gcs_client = _storage_mod.Client(project=PROJECT) if PROJECT else _storage_mod.Client()


# Patch Cfg defaults to GCP bucket names + Gemini model ids.
for _a, _n in BUCKETS.items():
    os.environ.setdefault(f"BUCKET_{_a}", _n)
M.Cfg.BUCKETS = {k: os.environ.get(f"BUCKET_{k}", v) for k, v in BUCKETS.items()}
M.Cfg.REGION = REGION
M.Cfg.MODEL = os.getenv("VERTEX_MODEL", VERTEX_MODEL)
M.Cfg.COMPARE_MODEL = os.getenv("VERTEX_COMPARE_MODEL", VERTEX_MODEL)  # single-model path
M.Cfg.EVAL_JUDGE_MODEL = os.getenv("VERTEX_JUDGE_MODEL", VERTEX_JUDGE_MODEL)
M.Cfg.EVAL_GEN_MODEL = os.getenv("VERTEX_MODEL", VERTEX_MODEL)
M.Cfg.EVAL_ROLE_ARN = ""  # GCP has no Bedrock eval role -> async judge skipped


def _bucket_name(bucket):
    return M.Cfg.BUCKETS.get(bucket, bucket)


def _blob(bucket, key):
    return _gcs_client.bucket(_bucket_name(bucket)).blob(key)


def _gcs_read(bucket, key, as_bytes=False):
    data = _blob(bucket, key).download_as_bytes()
    return data if as_bytes else data.decode("utf-8", errors="ignore")


def _gcs_write(bucket, key, data, ct="application/json"):
    if isinstance(data, dict):
        body = json.dumps(data, indent=2, default=str)
        ct = "application/json"
    elif isinstance(data, bytes):
        body = data
    else:
        body = str(data)
    _blob(bucket, key).upload_from_string(body, content_type=ct)


def _gcs_list(bucket, prefix):
    return [x.name for x in _gcs_client.bucket(_bucket_name(bucket)).list_blobs(prefix=prefix)]


def _account():
    return PROJECT or "local"


def _finish_to_stop(reason_name):
    return "max_tokens" if (reason_name or "") == "MAX_TOKENS" else "end_turn"


def _usage(resp):
    try:
        um = resp.usage_metadata
        return {"totalTokens": um.total_token_count,
                "inputTokens": um.prompt_token_count,
                "outputTokens": um.candidates_token_count}
    except Exception:
        return {}
# __END_PART_1__


def _gemini_generate(model_id, messages, system, inf):
    cfg = _gt.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=inf.get("maxTokens", M.Cfg.MAX_TOK),
        temperature=inf.get("temperature", M.Cfg.TEMP),
        top_p=inf.get("topP", 0.9),
    )
    contents = []
    for m in messages:
        role = "model" if m.get("role") == "assistant" else "user"
        parts = m.get("content") or []
        txt = parts[0].get("text", "") if parts else ""
        contents.append(_gt.Content(role=role, parts=[_gt.Part.from_text(text=txt)]))
    model = model_id or M.Cfg.MODEL
    resp = _retry_generate(lambda: _genai.models.generate_content(
        model=model, contents=contents, config=cfg))
    txt = resp.text or ""
    fr = ""
    try:
        fr = resp.candidates[0].finish_reason.name if resp.candidates else ""
    except Exception:
        try:
            fr = str(resp.candidates[0].finish_reason).split(".")[-1] if resp.candidates else ""
        except Exception:
            fr = ""
    return {"output": {"message": {"content": [{"text": txt}]}},
            "stopReason": _finish_to_stop(fr), "usage": _usage(resp)}


def _gemini_image(system, text, images):
    parts = [_gt.Part.from_bytes(data=i["bytes"],
                                 mime_type=f"image/{i.get('format', 'jpeg')}") for i in images]
    if text:
        parts.append(_gt.Part.from_text(text=text))
    if not parts:
        parts = [_gt.Part.from_text(text="Analyze the provided content.")]
    cfg = _gt.GenerateContentConfig(
        max_output_tokens=min(M.Cfg.MAX_TOK, 8192),
        temperature=M.Cfg.TEMP,
        top_p=0.9,
    )
    resp = _retry_generate(lambda: _genai.models.generate_content(
        model=M.Cfg.MODEL, contents=parts, config=cfg))
    txt = resp.text or ""
    fr = ""
    try:
        fr = resp.candidates[0].finish_reason.name if resp.candidates else ""
    except Exception:
        try:
            fr = str(resp.candidates[0].finish_reason).split(".")[-1] if resp.candidates else ""
        except Exception:
            fr = ""
    return {"output": {"message": {"content": [{"text": txt}]}},
            "stopReason": _finish_to_stop(fr), "usage": _usage(resp)}


def _gemini_ask_vision(system, text, images):
    """Route monolith.AWS.ask_vision -> Gemini vision (inline image bytes).

    CRITICAL: ask_vision drives ALL image / scanned-PDF / DICOM-pixel
    extraction (handwritten notes, prescription photos, scan pages). On AWS
    it hit Bedrock Converse; without this patch it tried boto3 and failed with
    "Unable to locate credentials", silently dropping every image-based file.
    """
    r = _gemini_image(system, text, images)
    return r["output"]["message"]["content"][0]["text"]


# Install patches onto monolith.AWS.
M.AWS.account = staticmethod(_account)
M.AWS.read = staticmethod(_gcs_read)
M.AWS.write = staticmethod(_gcs_write)
M.AWS.list_keys = staticmethod(_gcs_list)
M.AWS._call_converse = staticmethod(_gemini_generate)
M.AWS.llm_image = staticmethod(_gemini_image)
M.AWS.ask_vision = staticmethod(_gemini_ask_vision)


def _stub_launch_llm_judge_job(*a, **k):
    print("[GCP] Bedrock async LLM-as-judge not available on GCP - skipped", flush=True)
    return f"arn:aws:bedrock:{M.Cfg.REGION}:local:evaluation/skipped"


def _stub_get_llm_judge_status(job_arn):
    return {"status": "Completed", "arn": job_arn, "name": "skipped", "created": ""}


M.AWS.launch_llm_judge_job = staticmethod(_stub_launch_llm_judge_job)
M.AWS.get_llm_judge_status = staticmethod(_stub_get_llm_judge_status)


def emit_run_status(run_id, status, stages=None, error=None):
    """Write a per-run status doc the gateway reads for GET /api/runs/{id}/status."""
    doc = {"runId": run_id, "status": status,
           "stages": stages or {},
           "completedAt": M.datetime.datetime.now(M.datetime.timezone.utc).isoformat()}
    if error:
        doc["error"] = str(error)[:500]
    try:
        M.AWS.write(M.Cfg.BUCKETS["MEMORY"], f"runs/{run_id}/__status.json", doc)
    except Exception as e:
        print(f"[GCP] status write failed: {e}", flush=True)
