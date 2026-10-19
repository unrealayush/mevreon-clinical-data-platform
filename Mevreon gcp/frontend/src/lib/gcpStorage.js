/*
 * gcpStorage.js — drop-in replacement for @aws-sdk/client-s3.
 *
 * The 10k-line App.jsx was written against the AWS SDK (S3Client + command
 * objects sent via `.send()`). Rather than rewrite every S3 call site, this
 * module re-exports the SAME class / command names and translates them into
 * calls against the GCP FastAPI gateway:
 *
 *   ListObjectsV2Command -> GET  /api/storage/list?...
 *   GetObjectCommand     -> GET  /api/storage/get?...
 *   PutObjectCommand     -> POST /api/storage/put?...   (a key ending in
 *                      __PROCESS__ is auto-translated to POST /api/runs,
 *                      mirroring S3-upload->EventBridge->StepFunctions)
 *
 * The response shapes match the AWS SDK exactly, so App.jsx works unchanged.
 */
const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE.replace(/\/+$/, "")
  : "";

function token() {
  try {
    const c = JSON.parse(localStorage.getItem("mevreon_v7_auth") || "{}");
    return c && c.accessToken ? c.accessToken : null;
  } catch { return null; }
}

function headers(extra = {}) {
  const h = { ...extra };
  const t = token();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

/* Ensure the API call succeeded. On 401 the JWT has expired — clear the stored
 * session and reload so the user lands on the login screen instead of staring
 * at a silently empty case list (the old behavior). Other errors throw so the
 * caller's catch block surfaces them instead of treating them as "no data". */
async function ensureOk(r) {
  if (r.ok) return;
  if (r.status === 401) {
    try { localStorage.removeItem("mevreon_v7_auth"); } catch {}
    if (typeof window !== "undefined") window.location.reload();
    throw new Error("Session expired — reloading…");
  }
  let detail = "";
  try { const j = await r.json(); detail = j && j.detail ? String(j.detail) : ""; } catch {}
  throw new Error(detail || `API error ${r.status}`);
}

function url(path) {
  const base = API_BASE || (typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "");
  return `${base}${path}`;
}

class S3Client {
  constructor(opts = {}) { this.region = opts && opts.region; this.credentials = opts && opts.credentials; }
  async send(cmd) { return cmd.execute(this); }
}

class PutObjectCommand {
  constructor(input) { this.input = input || {}; }
  async execute() {
    const i = this.input;
    const params = new URLSearchParams();
    params.set("bucket", String(i.Bucket || ""));
    params.set("key", String(i.Key || ""));
    params.set("content_type", i.ContentType || "application/octet-stream");

    // __PROCESS__ marker -> trigger the pipeline (mirrors the AWS trigger).
    if (String(i.Key || "").endsWith("__PROCESS__")) {
      const caseId = (i.Key || "").replace(/\/__PROCESS__$/, "");
      const r = await fetch(url("/api/runs"), {
        method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, stage: "FULL_PIPELINE" }),
      });
      const data = await r.json().catch(() => ({}));
      return data;
    }

    let body;
    if (i.Body instanceof Uint8Array) body = i.Body;
    else if (typeof i.Body === "string") body = i.Body;
    else if (i.Body && typeof i.Body === "object" && !(i.Body instanceof ArrayBuffer)) body = JSON.stringify(i.Body);
    else if (i.Body instanceof ArrayBuffer) body = new Uint8Array(i.Body);
    else body = i.Body;

    const r = await fetch(`${url("/api/storage/put")}?${params.toString()}`, {
      method: "POST", headers: headers(), body,
    });
    await ensureOk(r);
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { body: text }; }
  }
}

class GetObjectCommand {
  constructor(input) { this.input = input || {}; }
  async execute() {
    const params = new URLSearchParams();
    params.set("bucket", String(this.input.Bucket || ""));
    params.set("key", String(this.input.Key || ""));
    const r = await fetch(`${url("/api/storage/get")}?${params.toString()}`, {
      headers: headers(),
    });
    if (!r.ok && r.status === 404) return { Body: { transformToString: async () => "", transformToByteArray: async () => new Uint8Array(0) } };
    await ensureOk(r);
    const buf = await r.arrayBuffer();
    const arr = new Uint8Array(buf);
    const textDecoder = new TextDecoder("utf-8");
    return {
      Body: {
        transformToByteArray: async () => arr,
        transformToString: async () => textDecoder.decode(arr),
      },
      ContentLength: arr.length,
      ContentType: r.headers.get("content-type") || "application/octet-stream",
    };
  }
}

class ListObjectsV2Command {
  constructor(input) { this.input = input || {}; }
  async execute() {
    const i = this.input;
    const params = new URLSearchParams();
    params.set("bucket", String(i.Bucket || ""));
    params.set("prefix", i.Prefix || "");
    if (i.Delimiter) params.set("delimiter", String(i.Delimiter));
    if (i.ContinuationToken) params.set("continuation_token", String(i.ContinuationToken));
    if (i.MaxKeys) params.set("max_keys", String(i.MaxKeys));
    const r = await fetch(`${url("/api/storage/list")}?${params.toString()}`, { headers: headers() });
    await ensureOk(r);
    return r.json();   // already S3-shaped (Contents/CommonPrefixes/IsTruncated/...)
  }
}

// Unused by App.jsx but imported — provide a no-op so the import resolves.
class DeleteObjectCommand {
  constructor(input) { this.input = input || {}; }
  async execute() { return {}; }
}

export { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, API_BASE };
