"""Mevreon GCP backend — FastAPI gateway.

Endpoints (all under /api):
  POST /api/auth/register       {email,password}
  POST /api/auth/login          {email,password}  -> {accessToken}
  GET  /api/auth/me
  POST /api/auth/key            {accessKeyId,secretAccessKey} -> {accessToken}
  GET  /api/storage/list        bucket=..&prefix=...&delimiter=...
  GET  /api/storage/get         bucket=..&key=...
  POST /api/storage/put         bucket=..&key=...   (raw body; __PROCESS__ marker auto-triggers)
  POST /api/runs                {caseId, stage?}    (explicit trigger)
  GET  /api/runs/{run_id}/status
"""
import json
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from .config import FRONTEND_ORIGIN
from . import auth, storage, pipeline as pln
from .models import LoginRequest, RegisterRequest, KeyLoginRequest, TriggerRequest


def _user_dep(request: Request):
    """JWT dependency. Public endpoints: /auth/*. Everything else requires it."""
    path = request.url.path
    if path.startswith("/api/auth"):
        return None
    token = request.headers.get("authorization", "")
    if token.startswith("Bearer "):
        token = token[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return auth.decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


app = FastAPI(title="Mevreon GCP Backend", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN] if FRONTEND_ORIGIN != "*" else ["*"],
    allow_methods=["*"], allow_headers=["*"],
)


# ── Auth ──────────────────────────────────────────────────────────────────
@app.post("/api/auth/register")
def register(body: RegisterRequest):
    try:
        res = auth.register(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return res


@app.post("/api/auth/login")
def login(body: LoginRequest):
    res = auth.authenticate(body.email, body.password)
    if not res:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return res


@app.post("/api/auth/key")
def key_login(body: KeyLoginRequest):
    """AWS IAM-style access-key login: validates the key pair and mints a JWT."""
    res = auth.authenticate_key(body.accessKeyId, body.secretAccessKey)
    if not res:
        raise HTTPException(status_code=401, detail="Invalid access keys")
    return res


@app.get("/api/auth/me")
def me(u=Depends(_user_dep)):
    return {"email": u["sub"]}


# ── Storage (S3-shaped) ───────────────────────────────────────────────────
@app.get("/api/storage/list")
def api_list(bucket: str, prefix: str = "", delimiter: str = None, max_keys: int = None,
             continuation_token: str = None, u=Depends(_user_dep)):
    try:
        return storage.list_objects(bucket, prefix, delimiter, max_keys, continuation_token=continuation_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/storage/get")
def api_get(bucket: str, key: str, as_text: bool = False, u=Depends(_user_dep)):
    try:
        data = storage.get_object(bucket, key, as_text=as_text)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    media = "application/json" if key.endswith(".json") else "application/octet-stream"
    if isinstance(data, bytes):
        return Response(content=data, media_type=media)
    return PlainTextResponse(content=data, media_type=media)


@app.post("/api/storage/put")
async def api_put(bucket: str, key: str, content_type: str = "application/octet-stream",
                  request: Request = None, u=Depends(_user_dep)):
    raw = await request.body()
    # __PROCESS__ marker → trigger the pipeline (mirrors S3→EventBridge→StepFunctions)
    if key.endswith("__PROCESS__"):
        case_id = (key.rsplit("/", 1)[0] or key).rstrip("/")
        try:
            res = pln.create_run(case_id)
            return {"status": "TRIGGERED", "runId": res["run_id"], "caseId": case_id}
        except Exception as e:
            # Trigger failure must NOT fail the upload (matches AWS non-fatal trigger semantics)
            return {"status": "TRIGGER_FAILED", "error": str(e)[:300]}
    storage.put_object(bucket, key, raw, content_type=content_type)
    return {"status": "OK", "bucket": bucket, "key": key, "size": len(raw)}


# ── Runs / trigger ────────────────────────────────────────────────────────
@app.post("/api/runs")
def trigger(body: TriggerRequest, u=Depends(_user_dep)):
    res = pln.create_run(body.caseId, stage=body.stage)
    return {"status": "TRIGGERED", **res}


@app.get("/api/runs/{run_id}/status")
def run_status(run_id: str, u=Depends(_user_dep)):
    return pln.read_status(run_id)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "mevreon-gcp-backend"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(__import__("os").getenv("PORT", "8080")))
