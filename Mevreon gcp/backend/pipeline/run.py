"""Cloud Run Job entrypoint - apply GCP adapters then run the monolith.

Env (injected per-execution by the gateway's :run call with overrides):
  RUN_ID, TARGET_BUCKET, TARGET_KEY, STAGE  (plus BUCKET_* / VERTEX_* / GCP_REGION)
"""
import os
import sys
import io
import json
import contextlib

os.environ.setdefault("GOOGLE_CLOUD_PROJECT", os.environ.get("PROJECT", "mevreon"))
os.environ.setdefault("GCP_REGION", os.environ.get("REGION", "us-central1"))
sys.path.insert(0, "/app")

from pipeline import gcp_adapters  # noqa: F401  (patches monolith.AWS/Cfg as a side effect)
import pipeline.monolith as M


def _final_result_from_log(out):
    """Parse the FULL_PIPELINE result dict printed as the monolith's last JSON line."""
    for line in reversed(out.strip().splitlines()):
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if isinstance(obj, dict) and ("s3_path" in obj or "stages" in obj):
            return obj
    return None


class Tee(io.StringIO):
    def __init__(self, target):
        super().__init__()
        self.target = target
    def write(self, s):
        self.target.write(s)
        self.target.flush()
        return super().write(s)
    def flush(self):
        self.target.flush()
        return super().flush()

def main():
    run_id = os.environ.get("RUN_ID", "no-run-id")
    stage = os.environ.get("STAGE", "FULL_PIPELINE")
    # monolith.main() runs its own argparse and requires --stage; feed it argv.
    sys.argv = [sys.argv[0], "--stage", stage, "--run_id", run_id]
    buf = Tee(sys.stdout)
    try:
        with contextlib.redirect_stdout(buf):
            M.main()
        out = buf.getvalue()
        result = _final_result_from_log(out)
        if result:
            gcp_adapters.emit_run_status(
                run_id, result.get("status", "SUCCESS"), result.get("stages", {}))
        else:
            gcp_adapters.emit_run_status(run_id, "SUCCESS", {})
    except SystemExit as e:
        gcp_adapters.emit_run_status(run_id, "FAILED", {})
        if e.code:
            raise
    except Exception as e:
        gcp_adapters.emit_run_status(run_id, "FAILED", {}, error=e)
        raise


if __name__ == "__main__":
    main()
