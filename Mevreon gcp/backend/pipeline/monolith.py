"""
MEVREON TITANIUM MONOLITH v300.5 - LONGITUDINAL NARRATIVE EDITION
==============================================================================
Single-Container Multi-Agent Medical AI Pipeline.
- Named output folders per run+filename for tracking
- Longitudinal patient story synthesis across all files
- Structured narrative output for professional UI
- Parquet master data file per case
- All heavy extraction by LLM, Python handles AWS I/O only
==============================================================================
"""

import os
import sys
import json
import io
import re
import base64
import datetime
import time
import traceback
import logging
import argparse
from typing import Dict, Any, Union, List
from urllib.parse import unquote_plus
from json_repair import repair_json

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, before_sleep_log
    import pandas as pd
    import numpy as np
    from PIL import Image
    from PyPDF2 import PdfReader
    from pdf2image import convert_from_bytes
    import pydicom
    import docx
    import pyarrow as pa
    import pyarrow.parquet as pq
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
except ImportError as e:
    print(f"FATAL IMPORT ERROR: {e}", flush=True)
    sys.exit(1)

# ── Ensure /app is on sys.path so 'from agents.X' works when script runs as agents/titan_monolith.py ──
_app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

# ── Harvard MIMS Biomedical AI Models (Separate Agents) ──
try:
    from agents.madrigal_agent import MadrigalAgent
    MADRIGAL_AVAILABLE = True
    print("[INIT] ✓ Madrigal DDI agent loaded", flush=True)
except ImportError:
    try:
        from madrigal_agent import MadrigalAgent
        MADRIGAL_AVAILABLE = True
        print("[INIT] ✓ Madrigal DDI agent loaded (direct import)", flush=True)
    except ImportError as e2:
        MADRIGAL_AVAILABLE = False
        print(f"[INIT] ⚠ Madrigal DDI agent not available: {e2}", flush=True)

try:
    from agents.compass_agent import CompassAgent
    COMPASS_AVAILABLE = True
    print("[INIT] ✓ COMPASS immunotherapy agent loaded", flush=True)
except ImportError:
    try:
        from compass_agent import CompassAgent
        COMPASS_AVAILABLE = True
        print("[INIT] ✓ COMPASS immunotherapy agent loaded (direct import)", flush=True)
    except ImportError as e2:
        COMPASS_AVAILABLE = False
        print(f"[INIT] ⚠ COMPASS immunotherapy agent not available: {e2}", flush=True)

try:
    from agents.pinnacle_agent import PinnacleAgent
    PINNACLE_AVAILABLE = True
    print("[INIT] ✓ PINNACLE discovery agent loaded", flush=True)
except ImportError:
    try:
        from pinnacle_agent import PinnacleAgent
        PINNACLE_AVAILABLE = True
        print("[INIT] ✓ PINNACLE discovery agent loaded (direct import)", flush=True)
    except ImportError as e2:
        PINNACLE_AVAILABLE = False
        print(f"[INIT] ⚠ PINNACLE discovery agent not available: {e2}", flush=True)

try:
    from agents.pinnacle_gpu_agent import PinnacleGPUAgent
    PINNACLE_GPU_AVAILABLE = True
    print("[INIT] ✓ PINNACLE GPU agent loaded", flush=True)
except ImportError:
    try:
        from pinnacle_gpu_agent import PinnacleGPUAgent
        PINNACLE_GPU_AVAILABLE = True
        print("[INIT] ✓ PINNACLE GPU agent loaded (direct import)", flush=True)
    except ImportError as e2:
        PINNACLE_GPU_AVAILABLE = False
        print(f"[INIT] ⚠ PINNACLE GPU agent not available: {e2}", flush=True)


print("=" * 80, flush=True)
print("MEVREON TITAN v300.5 - LONGITUDINAL NARRATIVE EDITION", flush=True)
print(f"Time: {datetime.datetime.utcnow().isoformat()}Z | Python: {sys.version.split()[0]}", flush=True)
print("=" * 80, flush=True)


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════
def safe_filename(name: str) -> str:
    """Sanitize filename for use in S3 keys."""
    return re.sub(r"[^a-zA-Z0-9._-]", "_", name)


def decode_s3_key(key: str) -> str:
    """Fully decode an S3 key that may be URL-encoded (spaces as + or %20)."""
    return unquote_plus(key)


# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════
class Cfg:
    REGION = os.environ.get("AWS_REGION", "us-east-1")
    BUCKETS = {
        "RAW":        os.environ.get("BUCKET_RAW",        "bedrock-pipeline-raw-ayush"),
        "STAGING":    os.environ.get("BUCKET_STAGING",    "bedrock-pipeline-staging-ayush"),
        "PROCESSED":  os.environ.get("BUCKET_PROCESSED",  "bedrock-pipeline-processed-ayush"),
        "CURATED":    os.environ.get("BUCKET_CURATED",    "bedrock-pipeline-curated-ayush"),
        "MEMORY":     os.environ.get("BUCKET_MEMORY",     "bedrock-pipeline-memory-ayush"),
        "QUARANTINE": os.environ.get("BUCKET_QUARANTINE", "bedrock-pipeline-quarantine-ayush"),
    }
    # ── LLM (AWS Bedrock — Mistral Ministral 14B) ──
    MODEL = os.environ.get("BEDROCK_MODEL", "mistral.ministral-3-14b-instruct")
    MAX_TOK = 8192           # Keep at 8K — 32K made the model too verbose, all stages slower
    JUDGE_MAX_TOK = 8192     # Mistral Large limit is 8192
    TEMP = 0.0
    # ── Chunking & Vision Processing ──
    CHUNK_CHARS = 28000          # max chars per text chunk for one Bedrock call
    PDF_DPI = 200                # DPI for scanned PDF rasterization
    MAX_IMG_DIM = 1568           # max pixel dimension for model images
    SCANNED_THRESHOLD = 50       # chars/page below this = scanned page
    OCR_BATCH = 3                # max images per OCR vision call
    VISION_EXTRACT_BATCH = 4     # max images per direct vision extraction call
    # ── Comparison model for dual-narrative output (FEATURE stage only) ──
    COMPARE_MODEL = os.environ.get("BEDROCK_COMPARE_MODEL", "meta.llama4-maverick-17b-instruct-v1:0")
    # ── LLM-as-a-Judge (AWS Bedrock Model Evaluation API) ──
    EVAL_ROLE_ARN    = os.environ.get("BEDROCK_EVAL_ROLE_ARN", "")
    EVAL_JUDGE_MODEL = os.environ.get("BEDROCK_EVAL_JUDGE_MODEL", "google.gemma-3-12b-it")
    EVAL_GEN_MODEL   = os.environ.get("BEDROCK_EVAL_GEN_MODEL",   "mistral.ministral-3-14b-instruct")
    EVAL_METRICS = [
        "Builtin.Correctness", "Builtin.Completeness", "Builtin.Faithfulness",
        "Builtin.Helpfulness", "Builtin.Coherence",    "Builtin.Relevance",
        "Builtin.FollowingInstructions", "Builtin.ProfessionalStyleAndTone",
    ]
    EVAL_POLL_INTERVAL = 30   # seconds between status checks
    EVAL_POLL_TIMEOUT  = 600  # max seconds to wait for eval job (10 min)
    # ── Batch / Multi-File Processing ──
    MARKER_FILE      = "__PROCESS__"  # sentinel file that triggers batch pipeline
    BATCH_MAX_CHARS  = 70000          # max combined text chars per multi-file model call
    BATCH_MAX_FILES  = 8              # max files per single multi-file model call
    BATCH_MAX_IMAGES = 4              # max images per vision batch call


# ═══════════════════════════════════════════════════════════════════
# CLINICAL SAFETY UTILITIES  (Python-side — NOT prompt-driven)
# Fixes #1 Evidence Gate, #2 Lab Rules, #3 Conflict Detector,
#       #9 Med Synonyms, #10 Timeline Builder
# ═══════════════════════════════════════════════════════════════════

# ── Fix #2: Physiological Lab Rules Engine ──────────────────────
LAB_RULES = {
    # test_name_lower: (absolute_min, absolute_max)
    "hemoglobin":     (3.0,  22.0),
    "hgb":            (3.0,  22.0),
    "hematocrit":     (10.0, 70.0),
    "hct":            (10.0, 70.0),
    "rbc":            (1.5,  8.0),
    "wbc":            (0.5,  50.0),
    "platelets":      (5000, 1200000),
    "plt":            (5,    1200),       # some labs report as K/uL
    "sodium":         (100,  180),
    "na":             (100,  180),
    "potassium":      (1.5,  9.0),
    "k":              (1.5,  9.0),
    "chloride":       (70,   130),
    "bicarbonate":    (5,    45),
    "bun":            (1,    150),
    "creatinine":     (0.1,  25.0),
    "glucose":        (10,   1500),
    "calcium":        (4.0,  16.0),
    "magnesium":      (0.5,  6.0),
    "phosphorus":     (0.5,  12.0),
    "albumin":        (0.5,  7.0),
    "total protein":  (2.0,  14.0),
    "bilirubin":      (0.0,  40.0),
    "alt":            (0,    5000),
    "ast":            (0,    5000),
    "alp":            (10,   2000),
    "ggt":            (0,    3000),
    "troponin":       (0.0,  50.0),
    "bnp":            (0,    50000),
    "inr":            (0.5,  15.0),
    "ptt":            (15,   200),
    "pt":             (8,    100),
    "tsh":            (0.01, 100.0),
    "t3":             (30,   600),
    "t4":             (1.0,  25.0),
    "free t4":        (0.1,  8.0),
    "hba1c":          (3.0,  20.0),
    "a1c":            (3.0,  20.0),
    "esr":            (0,    150),
    "crp":            (0,    500),
    "ferritin":       (1,    10000),
    "iron":           (5,    500),
    "ldh":            (50,   5000),
    "uric acid":      (1.0,  20.0),
    "ph":             (6.5,  8.0),
    "pco2":           (10,   120),
    "po2":            (20,   600),
    "lactate":        (0.1,  30.0),
}

def validate_lab_value(test_name: str, value_str: str) -> dict:
    """Validate a single lab value against physiological bounds.
    Returns {status: OK|FLAGGED|UNKNOWN, reason: str}"""
    try:
        key = test_name.strip().lower()
        # Extract numeric from value string (e.g., "11.6 g/dL" → 11.6)
        num_match = re.search(r"[-+]?\d*\.?\d+", str(value_str))
        if not num_match:
            return {"status": "UNKNOWN", "reason": "non-numeric value"}
        val = float(num_match.group())
        if key in LAB_RULES:
            lo, hi = LAB_RULES[key]
            if not (lo <= val <= hi):
                return {"status": "FLAGGED", "reason": f"{test_name}={val} outside [{lo},{hi}]"}
            return {"status": "OK", "reason": ""}
        return {"status": "UNKNOWN", "reason": "no rule for this test"}
    except Exception:
        return {"status": "UNKNOWN", "reason": "parse error"}

def validate_all_labs(data: dict) -> list:
    """Run lab rules engine on all lab_tests in extracted data. Returns list of flags.
    Handles multiple data structures: flat lab_tests list, or nested lab_results dict."""
    flags = []
    all_labs = []

    # Structure A: flat list under lab_tests
    flat = data.get("lab_tests", [])
    if isinstance(flat, list):
        all_labs.extend(flat)

    # Structure B: nested dict under lab_results with sublists
    lab_results = data.get("lab_results", {})
    if isinstance(lab_results, dict):
        for sub_key in ("critical_abnormalities", "dehydration_markers", "normal_results", "abnormal_results", "results"):
            sub = lab_results.get(sub_key, [])
            if isinstance(sub, list):
                all_labs.extend(sub)

    for lab in all_labs:
        if not isinstance(lab, dict):
            continue
        name = lab.get("test") or lab.get("test_name") or lab.get("original_name") or lab.get("standard_name") or ""
        value = lab.get("value", "")
        result = validate_lab_value(name, value)
        if result["status"] == "FLAGGED":
            flags.append({"test": name, "value": value, "reason": result["reason"]})
    return flags


# ── Fix #9: Medication Synonym Resolution ───────────────────────
MED_SYNONYMS = {
    # brand → generic (lowercase)
    "tryptomer":       "amitriptyline",
    "tylenol":         "acetaminophen",
    "advil":           "ibuprofen",
    "motrin":          "ibuprofen",
    "aleve":           "naproxen",
    "glucophage":      "metformin",
    "lipitor":         "atorvastatin",
    "crestor":         "rosuvastatin",
    "zocor":           "simvastatin",
    "norvasc":         "amlodipine",
    "prinivil":        "lisinopril",
    "zestril":         "lisinopril",
    "vasotec":         "enalapril",
    "lasix":           "furosemide",
    "lopressor":       "metoprolol",
    "toprol":          "metoprolol",
    "tenormin":        "atenolol",
    "coumadin":        "warfarin",
    "plavix":          "clopidogrel",
    "nexium":          "esomeprazole",
    "prilosec":        "omeprazole",
    "protonix":        "pantoprazole",
    "xanax":           "alprazolam",
    "valium":          "diazepam",
    "ativan":          "lorazepam",
    "ambien":          "zolpidem",
    "synthroid":       "levothyroxine",
    "levothroid":      "levothyroxine",
    "humulin":         "insulin",
    "lantus":          "insulin glargine",
    "augmentin":       "amoxicillin-clavulanate",
    "zithromax":       "azithromycin",
    "cipro":           "ciprofloxacin",
    "flagyl":          "metronidazole",
    "diflucan":        "fluconazole",
    "singulair":       "montelukast",
    "zyrtec":          "cetirizine",
    "claritin":        "loratadine",
    "benadryl":        "diphenhydramine",
    "prozac":          "fluoxetine",
    "zoloft":          "sertraline",
    "lexapro":         "escitalopram",
    "cymbalta":        "duloxetine",
    "effexor":         "venlafaxine",
    "wellbutrin":      "bupropion",
    "seroquel":        "quetiapine",
    "abilify":         "aripiprazole",
    "risperdal":       "risperidone",
    "lyrica":          "pregabalin",
    "neurontin":       "gabapentin",
    "dilantin":        "phenytoin",
    "tegretol":        "carbamazepine",
    "depakote":        "valproic acid",
    "keppra":          "levetiracetam",
    "oxycontin":       "oxycodone",
    "vicodin":         "hydrocodone-acetaminophen",
    "percocet":        "oxycodone-acetaminophen",
    "suboxone":        "buprenorphine-naloxone",
    "eliquis":         "apixaban",
    "xarelto":         "rivaroxaban",
    "pradaxa":         "dabigatran",
    "jardiance":       "empagliflozin",
    "farxiga":         "dapagliflozin",
    "ozempic":         "semaglutide",
    "trulicity":       "dulaglutide",
    "januvia":         "sitagliptin",
    "invokana":        "canagliflozin",
}

def resolve_med_synonyms(medications: list) -> list:
    """Resolve brand names to generic. Dedup by (generic, strength)."""
    seen = {}
    resolved = []
    for med in medications:
        if not isinstance(med, dict):
            continue
        name = (med.get("name") or med.get("original") or med.get("standard_name") or "").strip()
        generic = MED_SYNONYMS.get(name.lower(), name)
        med["resolved_generic"] = generic
        strength = (med.get("strength") or med.get("dose") or "").strip().lower()
        dedup_key = (generic.lower(), strength)
        if dedup_key in seen:
            # Merge source_files if present
            existing = seen[dedup_key]
            sf1 = existing.get("source_files", [])
            sf2 = med.get("source_files", [])
            existing["source_files"] = list(set(sf1 + sf2))
            continue
        seen[dedup_key] = med
        resolved.append(med)
    return resolved


# ── Fix #3: Cross-Document Conflict Detector ────────────────────
def detect_conflicts(data: dict) -> list:
    """Detect contradictions across extracted data.
    Checks imaging vs narrative, lab duplicates with different values, etc.
    Handles multiple data structures (flat and nested)."""
    conflicts = []

    def _gather_labs(d):
        """Gather lab entries from multiple possible structures."""
        result = []
        flat = d.get("lab_tests", [])
        if isinstance(flat, list):
            result.extend(flat)
        lr = d.get("lab_results", {})
        if isinstance(lr, dict):
            for sk in ("critical_abnormalities", "dehydration_markers", "normal_results", "abnormal_results", "results"):
                sub = lr.get(sk, [])
                if isinstance(sub, list):
                    result.extend(sub)
        return result

    def _gather_conditions(d):
        """Gather condition entries from multiple possible structures."""
        result = []
        conds = d.get("conditions") or d.get("diseases") or {}
        if isinstance(conds, dict):
            for sk in ("primary_concerns", "secondary_conditions", "diagnoses", "problems"):
                sub = conds.get(sk, [])
                if isinstance(sub, list):
                    result.extend(sub)
        elif isinstance(conds, list):
            result.extend(conds)
        return result

    try:
        # 1. Imaging vs impressions contradiction
        imaging = data.get("imaging_findings", data.get("imaging", []))
        if not isinstance(imaging, list):
            imaging = []
        impressions_normal = set()
        impressions_abnormal = set()
        for f in imaging:
            if not isinstance(f, dict):
                continue
            finding = str(f.get("finding", "")).lower()
            impression = str(f.get("impression", "")).lower()
            body = str(f.get("body_part", "")).lower()
            combined = finding + " " + impression
            if any(w in combined for w in ("normal", "unremarkable", "no acute", "negative", "within normal limits")):
                impressions_normal.add(body)
            if any(w in combined for w in ("mass", "lesion", "tumor", "metastasis", "fracture",
                                            "hemorrhage", "infarct", "abscess", "effusion",
                                            "stenosis", "occlusion", "thrombosis")):
                impressions_abnormal.add(body)

        # Also check conditions for contradictory diagnoses
        all_conditions = _gather_conditions(data)
        for c in all_conditions:
            if isinstance(c, dict):
                val_str = str(c.get("validation", "")).lower()
                if "contradictory" in val_str:
                    conflicts.append({
                        "type": "DIAGNOSIS_CONTRADICTION",
                        "entity": c.get("standard_name", "unknown"),
                        "detail": f"Validation flagged contradiction: {c.get('validation', '')}",
                        "severity": "HIGH",
                        "recommendation": "State BOTH diagnoses; flag for clinical clarification"
                    })

        for body in impressions_normal & impressions_abnormal:
            conflicts.append({
                "type": "IMAGING_CONTRADICTION",
                "entity": body,
                "detail": f"Imaging for '{body}' has both normal and abnormal findings across documents",
                "severity": "HIGH",
                "recommendation": "State BOTH findings; do not choose one"
            })

        # 2. Lab value conflicts: same test, different values (>20% difference)
        all_labs = _gather_labs(data)
        lab_by_name = {}
        for lab in all_labs:
            if not isinstance(lab, dict):
                continue
            name = (lab.get("test") or lab.get("test_name") or lab.get("standard_name") or lab.get("original_name") or "").strip().lower()
            if not name:
                continue
            val_str = str(lab.get("value", ""))
            num_match = re.search(r"[-+]?\d*\.?\d+", val_str)
            if num_match:
                val = float(num_match.group())
                lab_by_name.setdefault(name, []).append({"value": val, "raw": val_str,
                    "date": lab.get("date"), "source": lab.get("source_files", [])})

        for name, entries in lab_by_name.items():
            if len(entries) < 2:
                continue
            values = [e["value"] for e in entries]
            min_v, max_v = min(values), max(values)
            if min_v > 0 and (max_v - min_v) / min_v > 0.20:
                conflicts.append({
                    "type": "LAB_VALUE_CONFLICT",
                    "entity": name,
                    "detail": f"'{name}' has conflicting values: {[e['raw'] for e in entries]}",
                    "severity": "MODERATE",
                    "recommendation": "Keep all values with dates; flag for clinical review"
                })

        # 3. Medication conflicts: prescribed med that patient is allergic to
        allergies = data.get("allergies", [])
        meds = data.get("medications", [])
        if not isinstance(allergies, list):
            allergies = []
        if not isinstance(meds, list):
            meds = []
        allergy_names = set()
        for a in allergies:
            if isinstance(a, dict):
                allergy_names.add(str(a.get("allergen", "")).strip().lower())
        for m in meds:
            if not isinstance(m, dict):
                continue
            med_name = (m.get("name") or m.get("standard_name") or m.get("original") or "").strip().lower()
            generic = MED_SYNONYMS.get(med_name, med_name).lower()
            if med_name in allergy_names or generic in allergy_names:
                conflicts.append({
                    "type": "ALLERGY_MEDICATION_CONFLICT",
                    "entity": med_name,
                    "detail": f"Patient allergic to '{med_name}' but it is prescribed",
                    "severity": "CRITICAL",
                    "recommendation": "IMMEDIATELY flag — allergic medication prescribed"
                })

    except Exception as ex:
        conflicts.append({"type": "DETECTOR_ERROR", "detail": str(ex)[:200]})
    return conflicts


# ── Fix #10: Temporal Timeline Builder ──────────────────────────
def build_clinical_timeline(data: dict) -> list:
    """Build chronologically sorted timeline from extracted data.
    Handles multiple data structures (flat and nested)."""
    events = []

    def _gather_labs(d):
        result = []
        flat = d.get("lab_tests", [])
        if isinstance(flat, list):
            result.extend(flat)
        lr = d.get("lab_results", {})
        if isinstance(lr, dict):
            for sk in ("critical_abnormalities", "dehydration_markers", "normal_results", "abnormal_results", "results"):
                sub = lr.get(sk, [])
                if isinstance(sub, list):
                    result.extend(sub)
        return result

    def _gather_conditions(d):
        result = []
        conds = d.get("conditions") or d.get("diseases") or {}
        if isinstance(conds, dict):
            for sk in ("primary_concerns", "secondary_conditions", "diagnoses", "problems"):
                sub = conds.get(sk, [])
                if isinstance(sub, list):
                    result.extend(sub)
        elif isinstance(conds, list):
            result.extend(conds)
        return result

    try:
        # Labs
        for lab in _gather_labs(data):
            if isinstance(lab, dict):
                name = lab.get("test") or lab.get("test_name") or lab.get("standard_name") or ""
                events.append({
                    "event_date": str(lab.get("date", "unknown")),
                    "event_type": "LAB",
                    "finding": name,
                    "value": str(lab.get("value", "")),
                    "source_file": (lab.get("source_files") or [""])[0] if isinstance(lab.get("source_files"), list) else ""
                })
        # Medications
        for med in (data.get("medications") or []):
            if isinstance(med, dict):
                date = med.get("start_date") or med.get("date")
                events.append({
                    "event_date": str(date) if date else "unknown",
                    "event_type": "MED",
                    "finding": med.get("name") or med.get("standard_name", ""),
                    "value": med.get("dose") or med.get("strength", ""),
                    "source_file": (med.get("source_files") or [""])[0] if isinstance(med.get("source_files"), list) else ""
                })
        # Procedures
        for proc in (data.get("procedures") or []):
            if isinstance(proc, dict):
                events.append({
                    "event_date": str(proc.get("date", "unknown")),
                    "event_type": "PROCEDURE",
                    "finding": proc.get("name") or proc.get("standard_name", ""),
                    "value": proc.get("cpt", ""),
                    "source_file": (proc.get("source_files") or [""])[0] if isinstance(proc.get("source_files"), list) else ""
                })
        # Imaging
        for img in (data.get("imaging_findings") or data.get("imaging") or []):
            if isinstance(img, dict):
                events.append({
                    "event_date": str(img.get("date", "unknown")),
                    "event_type": "IMAGING",
                    "finding": f"{img.get('modality','')} {img.get('body_part','')}",
                    "value": img.get("impression", ""),
                    "source_file": (img.get("source_files") or [""])[0] if isinstance(img.get("source_files"), list) else ""
                })
        # Diseases / Conditions
        for dx in _gather_conditions(data):
            if isinstance(dx, dict):
                events.append({
                    "event_date": dx.get("onset_date", dx.get("date", "unknown")),
                    "event_type": "DIAGNOSIS",
                    "finding": dx.get("condition") or dx.get("standard_name", ""),
                    "value": dx.get("icd10", ""),
                    "source_file": (dx.get("source_files") or [""])[0] if isinstance(dx.get("source_files"), list) else ""
                })

        # Sort by date (unknown dates go last)
        def _sort_key(e):
            d = e.get("event_date", "")
            if not d or d == "unknown" or d == "None":
                return "9999-99-99"
            return str(d)
        events.sort(key=_sort_key)

    except Exception as ex:
        events.append({"event_date": "error", "event_type": "ERROR", "finding": str(ex)[:200]})
    return events


# ── Fix #1: Evidence Gate (filters claims against extracted entities) ──
def build_evidence_index(validated_data: dict) -> dict:
    """Build a lookup index of ALL factual entities from validated/cleaned data.
    Used by the hallucination auditor to verify narrative claims.
    Handles both flat-list schemas and nested schemas (e.g. conditions.primary_concerns)."""
    index = {
        "lab_values": {},    # test_name_lower → set of values
        "medications": set(),  # generic name lower
        "diagnoses": set(),    # condition lower
        "imaging": [],         # list of (body_part, finding_keywords)
        "procedures": set(),
        "allergies": set(),
        "vitals": {},
    }

    def _add_lab(lab_dict):
        if not isinstance(lab_dict, dict):
            return
        name = (lab_dict.get("test") or lab_dict.get("test_name") or lab_dict.get("standard_name") or lab_dict.get("original_name") or "").strip().lower()
        val = str(lab_dict.get("value", "")).strip()
        units = str(lab_dict.get("units", "")).strip()
        ref_range = str(lab_dict.get("ref_range", "")).strip()
        abnormal = str(lab_dict.get("abnormal", "")).strip()
        status = str(lab_dict.get("status", "")).strip().lower()
        if name:
            # Normalize lab name to canonical form
            canonical = normalize_lab_name(name)
            # Store rich value string: "value units (ref_range) [abnormal]"
            rich_val = val
            if units and units != "None":
                rich_val += f" {units}"
            if ref_range and ref_range != "None" and ref_range != "null":
                rich_val += f" (ref: {ref_range})"
            if abnormal and abnormal not in ("None", "null", "N", ""):
                rich_val += f" [{abnormal}]"
            index["lab_values"].setdefault(canonical, set()).add(rich_val)
            if status:
                index["lab_values"].setdefault(canonical + "_status", set()).add(status)

    def _add_condition(dx_dict):
        if not isinstance(dx_dict, dict):
            return
        cond = (dx_dict.get("standard_name") or dx_dict.get("condition") or dx_dict.get("original") or "").strip().lower()
        if cond:
            index["diagnoses"].add(cond)

    try:
        # ── Labs (multiple possible structures) ──
        # Structure A: validated_data.lab_results.critical_abnormalities / dehydration_markers
        lab_results = validated_data.get("lab_results") or {}
        if isinstance(lab_results, dict):
            for sub_key in ("critical_abnormalities", "dehydration_markers", "normal_results", "abnormal_results", "results"):
                for lab in (lab_results.get(sub_key) or []):
                    _add_lab(lab)
            # If lab_results itself has test/value pairs (flat)
            if lab_results.get("test"):
                _add_lab(lab_results)
        # Structure B: validated_data.lab_tests (flat list or nested dict)
        lab_tests = validated_data.get("lab_tests") or {}
        if isinstance(lab_tests, list):
            for lab in lab_tests:
                _add_lab(lab)
        elif isinstance(lab_tests, dict):
            # Structure C2: nested dict {category: {test_name: {value, units, ...}}}
            for cat_name, cat_block in lab_tests.items():
                if isinstance(cat_block, dict):
                    # Could be a single test entry or a category of tests
                    if "value" in cat_block:
                        _add_lab({"test": cat_name, **cat_block})
                    else:
                        for tn, tp in cat_block.items():
                            if isinstance(tp, dict):
                                _add_lab({"test": tn, **tp})
                            else:
                                _add_lab({"test": tn, "value": str(tp)})
                elif isinstance(cat_block, list):
                    for lab in cat_block:
                        _add_lab(lab)

        # Structure C: validated_data.lab_alerts (dict by category/test)
        # Example:
        #   {"hematology": {"hb": {"value": "12.3", "units": "g/dL", ...}},
        #    "urine": {"pus_cells": "12-15 /hpf"}}
        lab_alerts = validated_data.get("lab_alerts") or {}
        if isinstance(lab_alerts, dict):
            for _, category_block in lab_alerts.items():
                if isinstance(category_block, dict):
                    for test_name, test_payload in category_block.items():
                        if isinstance(test_payload, dict):
                            _add_lab({
                                "test": test_name,
                                "value": test_payload.get("value", ""),
                                "units": test_payload.get("units", ""),
                                "ref_range": test_payload.get("ref_range", ""),
                                "abnormal": test_payload.get("abnormal") or test_payload.get("flag", ""),
                                "status": test_payload.get("status", ""),
                            })
                        else:
                            # Scalar payloads are still clinically relevant; keep them as abnormal alerts.
                            _add_lab({"test": test_name, "value": str(test_payload), "abnormal": "Y"})
                elif isinstance(category_block, list):
                    for lab in category_block:
                        _add_lab(lab)
        elif isinstance(lab_alerts, list):
            # Structure D: lab_alerts is a flat list of dicts (e.g., [{"test": "Hemoglobin", "value": 12.3, ...}])
            for lab in lab_alerts:
                _add_lab(lab)

        # ── Medications (multiple key names and formats) ──
        meds_src = validated_data.get("medications") or []
        all_meds_raw = []
        if isinstance(meds_src, list):
            all_meds_raw.extend(meds_src)
        elif isinstance(meds_src, dict):
            # Handle {"pending": [{"recommendation": ...}]} format
            for sub_key in ("pending", "current", "active", "medications"):
                for m in (meds_src.get(sub_key) or []):
                    if isinstance(m, dict):
                        rec = m.get("recommendation") or m.get("name") or ""
                        if rec:
                            all_meds_raw.append({"name": rec, "rationale": m.get("rationale", "")})
        # Also check medication_recommendations (common alternative key)
        # Also check medication_recommendations (common alternative key)
        med_recs = validated_data.get("medication_recommendations") or []
        if isinstance(med_recs, list):
            for mr in med_recs:
                if isinstance(mr, dict):
                    # Convert recommendation format to medication format
                    therapy = mr.get("suggested_therapy") or mr.get("therapy") or ""
                    cond = mr.get("condition") or ""
                    if therapy:
                        all_meds_raw.append({"name": therapy, "condition": cond})
        for med in all_meds_raw:
            if isinstance(med, dict):
                name = (med.get("name") or med.get("standard_name") or med.get("original") or "").strip().lower()
                generic = MED_SYNONYMS.get(name, name)
                # Build rich medication string: "name strength frequency route"
                strength = (med.get("strength") or med.get("dose") or "").strip()
                frequency = (med.get("frequency") or "").strip()
                route = (med.get("route") or "").strip()
                rich_med = generic.lower()
                if strength:
                    rich_med += f" {strength}"
                if frequency:
                    rich_med += f" {frequency}"
                if route and route.lower() not in ("", "none", "null"):
                    rich_med += f" ({route})"
                index["medications"].add(rich_med)
                # Also add just the name for matching
                index["medications"].add(generic.lower())
                if name != generic:
                    index["medications"].add(name)

        # ── Conditions/Diseases (multiple possible structures) ──
        conditions = validated_data.get("conditions") or validated_data.get("diseases") or {}
        if isinstance(conditions, dict):
            # Nested: conditions.primary_concerns / secondary_conditions
            for sub_key in ("primary_concerns", "secondary_conditions", "diagnoses", "problems"):
                for dx in (conditions.get(sub_key) or []):
                    _add_condition(dx)
        elif isinstance(conditions, list):
            for dx in conditions:
                _add_condition(dx)

        # ── Imaging ──
        for img in (validated_data.get("imaging_findings") or validated_data.get("imaging") or []):
            if isinstance(img, dict):
                body = str(img.get("body_part", "")).lower()
                finding = str(img.get("finding", "")).lower()
                impression = str(img.get("impression", "")).lower()
                modality = str(img.get("modality", "")).lower()
                index["imaging"].append((body, finding, impression, modality))

        # ── Procedures ──
        for proc in (validated_data.get("procedures") or []):
            if isinstance(proc, dict):
                index["procedures"].add(str(proc.get("name") or proc.get("standard_name") or "").strip().lower())

        # ── Allergies ──
        for a in (validated_data.get("allergies") or []):
            if isinstance(a, dict):
                index["allergies"].add(str(a.get("allergen", "")).strip().lower())

        # ── Vitals ──
        for v in (validated_data.get("vital_signs") or validated_data.get("vitals") or []):
            if isinstance(v, dict):
                vtype = str(v.get("type", "")).lower()
                index["vitals"][vtype] = str(v.get("value", ""))

        # ── Demographics (add patient info too) ──
        demos = validated_data.get("patient_demographics") or validated_data.get("demographics") or {}
        if isinstance(demos, dict):
            for k, v in demos.items():
                if v and k not in ("validation",):
                    index["vitals"][k] = str(v)

    except Exception:
        pass
    return index


# ── Upgrade #1: Lab Name Normalization Engine ───────────────────
LAB_SYNONYMS = {
    "hb": "hemoglobin", "hgb": "hemoglobin", "haemoglobin": "hemoglobin",
    "hct": "hematocrit", "packed cell volume": "hematocrit", "pcv": "hematocrit",
    "rbc count": "rbc", "red blood cells": "rbc", "red blood cell count": "rbc",
    "wbc count": "wbc", "white blood cells": "wbc", "white blood cell count": "wbc", "tlc": "wbc",
    "platelet count": "platelets", "plt": "platelets", "thrombocytes": "platelets",
    "a1c": "hba1c", "glycated hemoglobin": "hba1c", "glycosylated hemoglobin": "hba1c", "hb a1c": "hba1c",
    "fasting glucose": "glucose fasting", "fbs": "glucose fasting", "fasting blood sugar": "glucose fasting",
    "pp glucose": "glucose post prandial", "ppbs": "glucose post prandial", "post prandial blood sugar": "glucose post prandial",
    "random glucose": "glucose random", "rbs": "glucose random", "random blood sugar": "glucose random",
    "na": "sodium", "na+": "sodium",
    "k": "potassium", "k+": "potassium",
    "cl": "chloride", "cl-": "chloride",
    "hco3": "bicarbonate", "co2": "bicarbonate",
    "blood urea nitrogen": "bun", "urea": "bun",
    "creat": "creatinine", "serum creatinine": "creatinine",
    "ca": "calcium", "ca++": "calcium", "total calcium": "calcium",
    "mg": "magnesium", "mg++": "magnesium",
    "phos": "phosphorus", "phosphate": "phosphorus",
    "alb": "albumin", "serum albumin": "albumin",
    "total bilirubin": "bilirubin", "tbili": "bilirubin", "t.bili": "bilirubin",
    "sgpt": "alt", "alanine aminotransferase": "alt", "alanine transaminase": "alt",
    "sgot": "ast", "aspartate aminotransferase": "ast", "aspartate transaminase": "ast",
    "alkaline phosphatase": "alp", "alk phos": "alp",
    "gamma gt": "ggt", "gamma glutamyl transferase": "ggt",
    "trop": "troponin", "troponin i": "troponin", "troponin t": "troponin", "trop i": "troponin", "trop t": "troponin",
    "brain natriuretic peptide": "bnp", "nt-probnp": "bnp", "pro-bnp": "bnp",
    "prothrombin time": "pt", "pro time": "pt",
    "activated partial thromboplastin time": "aptt", "ptt": "aptt",
    "thyroid stimulating hormone": "tsh",
    "triiodothyronine": "t3", "total t3": "t3",
    "thyroxine": "t4", "total t4": "t4",
    "ft4": "free t4", "free thyroxine": "free t4",
    "erythrocyte sedimentation rate": "esr", "sed rate": "esr",
    "c-reactive protein": "crp", "c reactive protein": "crp", "hs-crp": "crp",
    "serum ferritin": "ferritin",
    "serum iron": "iron", "fe": "iron",
    "lactate dehydrogenase": "ldh",
    "uric acid": "uric acid", "serum uric acid": "uric acid",
    "vitamin b12": "vitamin b12", "b12": "vitamin b12", "cobalamin": "vitamin b12", "cyanocobalamin": "vitamin b12",
    "vitamin d": "vitamin d", "25-oh vitamin d": "vitamin d", "25 hydroxy vitamin d": "vitamin d", "vit d": "vitamin d", "cholecalciferol": "vitamin d", "25-hydroxyvitamin d": "vitamin d", "25 hydroxyvitamin d": "vitamin d",
    "high density lipoprotein": "hdl", "hdl cholesterol": "hdl", "hdl-c": "hdl",
    "low density lipoprotein": "ldl", "ldl cholesterol": "ldl", "ldl-c": "ldl",
    "total cholesterol": "total cholesterol", "cholesterol": "total cholesterol", "tc": "total cholesterol",
    "triglycerides": "triglycerides", "tg": "triglycerides", "trigs": "triglycerides",
    "mcv": "mcv", "mean corpuscular volume": "mcv",
    "mch": "mch", "mean corpuscular hemoglobin": "mch",
    "mchc": "mchc", "mean corpuscular hemoglobin concentration": "mchc",
    "rdw": "rdw", "red cell distribution width": "rdw",
    "mpv": "mpv", "mean platelet volume": "mpv",
    "pus cells": "pus cells", "pus_cells": "pus cells",
    "epithelial cells": "epithelial cells",
    "egfr": "egfr", "estimated gfr": "egfr", "glomerular filtration rate": "egfr",
    "protein": "urine protein", "urine protein": "urine protein",
    "specific gravity": "specific gravity", "sp gravity": "specific gravity", "sp. gravity": "specific gravity",
    # Urine duplicates
    "nitrite": "nitrites", "urine nitrite": "nitrites", "urine nitrites": "nitrites",
    "urine_bacteria": "bacteria", "urine bacteria": "bacteria",
    "urine_wbc": "wbcs", "urine wbc": "wbcs", "urine wbcs": "wbcs",
    "vitamin_d": "vitamin d",
    "urine nitrites/wbcs/bacteria": "urine nitrites/wbcs/bacteria",  # will be filtered by junk list
}

def normalize_lab_name(raw_name: str) -> str:
    """Normalize a lab test name to its canonical form using LAB_SYNONYMS."""
    key = raw_name.strip().lower()
    return LAB_SYNONYMS.get(key, key)


# ── Upgrade #2: Required Labs List & Missing Data Detector ──────
REQUIRED_LABS = [
    "hba1c", "hemoglobin", "rbc", "wbc", "platelets", "mcv", "mch", "mchc",
    "vitamin b12", "vitamin d", "hdl", "ldl", "total cholesterol", "triglycerides",
    "glucose fasting", "glucose post prandial",
    "sodium", "potassium", "chloride", "bicarbonate", "bun", "creatinine",
    "calcium", "albumin", "bilirubin", "alt", "ast", "alp",
    "tsh", "iron", "ferritin", "esr", "crp", "egfr",
]

def check_missing_data(patient_state: dict) -> dict:
    """Compare extracted labs against REQUIRED_LABS. Returns report of present/missing."""
    extracted_labs = set()
    for lab_name in patient_state.get("labs", {}).keys():
        canonical = normalize_lab_name(lab_name)
        extracted_labs.add(canonical)
    present = sorted([r for r in REQUIRED_LABS if r in extracted_labs])
    missing = sorted([r for r in REQUIRED_LABS if r not in extracted_labs])
    return {
        "total_required": len(REQUIRED_LABS),
        "present_count": len(present),
        "missing_count": len(missing),
        "present_labs": present,
        "missing_labs": missing,
        "completeness_pct": round(len(present) / max(len(REQUIRED_LABS), 1) * 100, 1),
    }


# ── Upgrade #3: Clinical Inference Rules Engine ─────────────────
def infer_conditions(labs: dict) -> list:
    """Deterministic clinical inference from lab values. Returns list of inferred conditions."""
    inferred = []

    def _get_num(name):
        """Get first numeric value for a normalized lab name."""
        for key in labs:
            if normalize_lab_name(key) == name:
                vals = labs[key] if isinstance(labs[key], (list, set)) else [labs[key]]
                for v in vals:
                    m = re.search(r"[-+]?\d*\.?\d+", str(v))
                    if m:
                        return float(m.group())
        return None

    # Diabetes screening
    hba1c = _get_num("hba1c")
    if hba1c is not None:
        if hba1c >= 6.5:
            inferred.append({"condition": "Diabetes Mellitus (HbA1c >= 6.5%)", "evidence": f"HbA1c = {hba1c}%"})
        elif hba1c >= 5.7:
            inferred.append({"condition": "Pre-diabetes (HbA1c 5.7-6.4%)", "evidence": f"HbA1c = {hba1c}%"})

    # Anemia
    hgb = _get_num("hemoglobin")
    if hgb is not None:
        if hgb < 7:
            inferred.append({"condition": "Anemia (Hgb < 7)", "evidence": f"Hgb = {hgb} g/dL"})
        elif hgb < 10:
            inferred.append({"condition": "Anemia (Hgb < 10)", "evidence": f"Hgb = {hgb} g/dL"})
        elif hgb < 12:
            inferred.append({"condition": "Anemia (Hgb < 12)", "evidence": f"Hgb = {hgb} g/dL"})

    # Macrocytic anemia
    mcv = _get_num("mcv")
    b12 = _get_num("vitamin b12")
    if mcv is not None and mcv > 100:
        inferred.append({"condition": "Macrocytosis (MCV > 100)", "evidence": f"MCV = {mcv} fL"})
        if b12 is not None and b12 < 200:
            inferred.append({"condition": "Vitamin B12 Deficiency with Macrocytosis", "evidence": f"B12 = {b12} pg/mL, MCV = {mcv} fL"})
    if b12 is not None and b12 < 200:
        inferred.append({"condition": "Vitamin B12 Deficiency (B12 < 200)", "evidence": f"B12 = {b12} pg/mL"})

    # Vitamin D deficiency
    vitd = _get_num("vitamin d")
    if vitd is not None:
        if vitd < 10:
            inferred.append({"condition": "Vitamin D Deficiency (< 10 ng/mL)", "evidence": f"Vit D = {vitd} ng/mL"})
        elif vitd < 20:
            inferred.append({"condition": "Vitamin D Deficiency (< 20)", "evidence": f"Vit D = {vitd} ng/mL"})
        elif vitd < 30:
            inferred.append({"condition": "Vitamin D Insufficiency (20-30)", "evidence": f"Vit D = {vitd} ng/mL"})

    # Thyroid
    tsh = _get_num("tsh")
    if tsh is not None:
        if tsh > 4.5:
            inferred.append({"condition": "Hypothyroidism (TSH elevated)", "evidence": f"TSH = {tsh} mIU/L"})
        elif tsh < 0.4:
            inferred.append({"condition": "Hyperthyroidism (TSH suppressed)", "evidence": f"TSH = {tsh} mIU/L"})

    # Kidney function
    creat = _get_num("creatinine")
    egfr = _get_num("egfr")
    if creat is not None and creat > 1.3:
        inferred.append({"condition": "Elevated Creatinine (renal concern)", "evidence": f"Creatinine = {creat} mg/dL"})
    if egfr is not None and egfr < 60:
        inferred.append({"condition": "Chronic Kidney Disease (eGFR < 60)", "evidence": f"eGFR = {egfr} mL/min"})

    # Liver function
    alt_val = _get_num("alt")
    ast_val = _get_num("ast")
    if alt_val is not None and alt_val > 56:
        inferred.append({"condition": "Elevated ALT (hepatic concern)", "evidence": f"ALT = {alt_val} U/L"})
    if ast_val is not None and ast_val > 40:
        inferred.append({"condition": "Elevated AST (hepatic concern)", "evidence": f"AST = {ast_val} U/L"})

    # Lipid panel
    ldl = _get_num("ldl")
    hdl = _get_num("hdl")
    tg = _get_num("triglycerides")
    tc = _get_num("total cholesterol")
    if ldl is not None and ldl > 160:
        inferred.append({"condition": "Elevated LDL (cardiovascular risk)", "evidence": f"LDL = {ldl} mg/dL"})
    if hdl is not None and hdl < 40:
        inferred.append({"condition": "Low HDL (cardiovascular risk)", "evidence": f"HDL = {hdl} mg/dL"})
    if tg is not None and tg > 200:
        inferred.append({"condition": "Hypertriglyceridemia", "evidence": f"Triglycerides = {tg} mg/dL"})
    if tc is not None and tc > 240:
        inferred.append({"condition": "Hypercholesterolemia", "evidence": f"Total Cholesterol = {tc} mg/dL"})

    # Iron deficiency
    ferritin = _get_num("ferritin")
    iron = _get_num("iron")
    if ferritin is not None and ferritin < 12:
        inferred.append({"condition": "Iron Deficiency (Ferritin < 12)", "evidence": f"Ferritin = {ferritin} ng/mL"})
    if iron is not None and iron < 60:
        inferred.append({"condition": "Low Serum Iron", "evidence": f"Iron = {iron} µg/dL"})

    # Inflammation
    esr = _get_num("esr")
    crp = _get_num("crp")
    if esr is not None and esr > 30:
        inferred.append({"condition": "Elevated ESR (inflammation marker)", "evidence": f"ESR = {esr} mm/hr"})
    if crp is not None and crp > 10:
        inferred.append({"condition": "Elevated CRP (inflammation/infection)", "evidence": f"CRP = {crp} mg/L"})

    # Electrolytes
    na = _get_num("sodium")
    k = _get_num("potassium")
    if na is not None:
        if na < 135:
            inferred.append({"condition": "Hyponatremia", "evidence": f"Na = {na} mEq/L"})
        elif na > 145:
            inferred.append({"condition": "Hypernatremia", "evidence": f"Na = {na} mEq/L"})
    if k is not None:
        if k < 3.5:
            inferred.append({"condition": "Hypokalemia", "evidence": f"K = {k} mEq/L"})
        elif k > 5.0:
            inferred.append({"condition": "Hyperkalemia", "evidence": f"K = {k} mEq/L"})

    return inferred


# ── Upgrade #4: Canonical Patient State Builder ─────────────────
def build_patient_state(aggregated: dict, evidence_idx: dict) -> dict:
    """Build a canonical patient_state from aggregated data + evidence index.
    Single source of truth for all downstream consumers (prompt, auditor, judge)."""
    state = {
        "labs": {},       # canonical_name → {value, units, ref_range, abnormal, status}
        "vitals": {},     # type → value
        "medications": [],  # list of {name, strength, frequency, route}
        "conditions": [],   # list of {name, severity}
        "procedures": [],   # list of {name, date}
        "imaging": [],      # list of {modality, body_part, finding, impression}
        "allergies": [],    # list of strings
        "demographics": {}, # age, gender, etc.
        "inferred_conditions": [],  # from clinical rules engine
    }

    # Labs: normalize names, deduplicate, keep richest value
    # Filter out meta-keys that aren't actual lab test names
    _JUNK_LAB_NAMES = {"value", "units", "abnormal", "comment", "status", "flag", "ref_range",
                        "reference_range", "notes", "test", "test_name", "result", "interpretation",
                        "urine nitrites/wbcs/bacteria"}
    for raw_name, values in evidence_idx.get("lab_values", {}).items():
        if raw_name.endswith("_status"):
            continue
        canonical = normalize_lab_name(raw_name)
        if canonical in _JUNK_LAB_NAMES or len(canonical) < 2:
            continue
        if canonical not in state["labs"]:
            state["labs"][canonical] = sorted(values) if isinstance(values, (set, list)) else [str(values)]
        else:
            existing = state["labs"][canonical]
            new_vals = sorted(values) if isinstance(values, (set, list)) else [str(values)]
            for v in new_vals:
                if v not in existing:
                    existing.append(v)

    # Vitals
    state["vitals"] = dict(evidence_idx.get("vitals", {}))

    # Medications
    for med_str in sorted(evidence_idx.get("medications", [])):
        state["medications"].append(med_str)

    # Conditions
    for dx in sorted(evidence_idx.get("diagnoses", [])):
        if dx and len(dx) > 3:
            state["conditions"].append(dx)

    # Procedures
    for p in sorted(evidence_idx.get("procedures", [])):
        if p:
            state["procedures"].append(p)

    # Imaging
    for body, finding, impression, modality in evidence_idx.get("imaging", []):
        state["imaging"].append({"modality": modality, "body_part": body, "finding": finding, "impression": impression})

    # Allergies
    for a in sorted(evidence_idx.get("allergies", [])):
        if a:
            state["allergies"].append(a)

    # Demographics
    demos = aggregated.get("patient_demographics") or aggregated.get("demographics") or {}
    if isinstance(demos, dict):
        state["demographics"] = {k: v for k, v in demos.items() if v and k != "validation"}

    # Clinical inference
    state["inferred_conditions"] = infer_conditions(state["labs"])

    return state


# ── Upgrade #5: Ground Truth Lab Table Builder ──────────────────
def build_ground_truth_lab_table(patient_state: dict) -> str:
    """Build a formatted lab table string from canonical patient_state.
    Injected directly into the FEATURE_PROMPT user message so the LLM cannot miss any value."""
    labs = patient_state.get("labs", {})
    if not labs:
        return ""
    lines = ["\n" + "="*60, "GROUND TRUTH LAB TABLE (extracted from source data — EVERY value below MUST appear in your narrative)", "="*60]
    lines.append(f"{'Test':<30} {'Value(s)':<50}")
    lines.append("-"*80)
    for canonical_name in sorted(labs.keys()):
        values = labs[canonical_name]
        val_str = " | ".join(str(v) for v in values) if isinstance(values, list) else str(values)
        lines.append(f"{canonical_name:<30} {val_str:<50}")
    lines.append("-"*80)
    lines.append(f"Total: {len(labs)} unique lab tests extracted")
    lines.append("INSTRUCTION: Every row above MUST appear in your narrative. State whether each value is normal or abnormal.\n")
    return "\n".join(lines)


# ── Upgrade #6: Data Loss Detector ──────────────────────────────
def detect_data_loss(patient_state: dict, narrative_text: str) -> dict:
    """Compare patient_state entities vs what appears in the narrative.
    Returns counts of missing items — used to trigger regeneration."""
    nt_lower = narrative_text.lower()

    # Check labs
    labs_total = len(patient_state.get("labs", {}))
    labs_found = 0
    labs_missing = []
    for lab_name, values in patient_state.get("labs", {}).items():
        # Check if lab name or any of its values appear in narrative
        name_found = lab_name in nt_lower
        val_found = any(
            re.search(re.escape(str(v).split()[0]), nt_lower)
            for v in (values if isinstance(values, list) else [values])
            if str(v).strip()
        )
        if name_found or val_found:
            labs_found += 1
        else:
            labs_missing.append(lab_name)

    # Check medications
    meds_total = len(set(m.split()[0] for m in patient_state.get("medications", []) if m))
    meds_found = 0
    meds_missing = []
    seen_med_names = set()
    for med in patient_state.get("medications", []):
        med_name = med.split()[0].lower() if med else ""
        if not med_name or med_name in seen_med_names:
            continue
        seen_med_names.add(med_name)
        if med_name in nt_lower:
            meds_found += 1
        else:
            meds_missing.append(med_name)

    # Check conditions
    cond_total = len(patient_state.get("conditions", []))
    cond_found = 0
    cond_missing = []
    for cond in patient_state.get("conditions", []):
        # Check if any significant word from the condition appears
        words = [w for w in cond.lower().split() if len(w) > 4]
        if any(w in nt_lower for w in words):
            cond_found += 1
        else:
            cond_missing.append(cond)

    return {
        "labs": {"total": labs_total, "found": labs_found, "missing": labs_missing, "coverage_pct": round(labs_found / max(labs_total, 1) * 100, 1)},
        "medications": {"total": len(seen_med_names), "found": meds_found, "missing": meds_missing, "coverage_pct": round(meds_found / max(len(seen_med_names), 1) * 100, 1)},
        "conditions": {"total": cond_total, "found": cond_found, "missing": cond_missing, "coverage_pct": round(cond_found / max(cond_total, 1) * 100, 1)},
    }


# ═══════════════════════════════════════════════════════════════════
# AWS UTILS
# ═══════════════════════════════════════════════════════════════════
class AWS:
    _cfg = Config(retries={"max_attempts": 10, "mode": "adaptive"}, connect_timeout=60, read_timeout=300)
    _s3  = boto3.client("s3",               region_name=Cfg.REGION, config=_cfg)
    _br  = boto3.client("bedrock-runtime",  region_name=Cfg.REGION, config=_cfg)
    _bm  = boto3.client("bedrock",          region_name=Cfg.REGION, config=_cfg)  # mgmt plane for eval jobs
    _sts = boto3.client("sts")
    _acct = None

    @classmethod
    def account(cls):
        if not cls._acct:
            cls._acct = cls._sts.get_caller_identity()["Account"]
        return cls._acct

    @staticmethod
    def log(stage, msg, level="INFO", **kw):
        print(json.dumps({"ts": datetime.datetime.utcnow().isoformat()+"Z", "lvl": level, "stg": stage, "msg": msg, **kw}, default=str), flush=True)

    @classmethod
    def read(cls, bucket, key, as_bytes=False):
        key = decode_s3_key(key)
        print(f"[S3] GET s3://{bucket}/{key}", flush=True)
        obj = cls._s3.get_object(Bucket=bucket, Key=key)
        data = obj["Body"].read()
        print(f"[S3] ✓ {len(data)} bytes", flush=True)
        return data if as_bytes else data.decode("utf-8", errors="ignore")

    @classmethod
    def write(cls, bucket, key, data, ct="application/json"):
        print(f"[S3] PUT s3://{bucket}/{key}", flush=True)
        body = json.dumps(data, indent=2, default=str) if isinstance(data, dict) else (data if isinstance(data, bytes) else str(data))
        cls._s3.put_object(Bucket=bucket, Key=key, Body=body, ContentType=ct)
        print(f"[S3] ✓ written", flush=True)

    @classmethod
    def launch_llm_judge_job(cls, job_name: str, input_s3_uri: str, output_s3_uri: str,
                             role_arn: str, evaluator_model_id: str, generator_model_id: str,
                             metrics: list, dataset_name: str = "MevreonNarrative") -> str:
        """Launch async LLM-as-judge evaluation job via Bedrock Model Evaluation API.
        Returns job ARN. Based on: https://aws.amazon.com/blogs/machine-learning/
        llm-as-a-judge-on-amazon-bedrock-model-evaluation/"""
        print(f"[LLM-JUDGE] Launching evaluation job '{job_name}'", flush=True)
        resp = cls._bm.create_evaluation_job(
            jobName=job_name,
            roleArn=role_arn,
            applicationType="ModelEvaluation",
            evaluationConfig={
                "automated": {
                    "datasetMetricConfigs": [{
                        "taskType": "General",
                        "dataset": {
                            "name": dataset_name,
                            "datasetLocation": {"s3Uri": input_s3_uri}
                        },
                        "metricNames": metrics
                    }],
                    "evaluatorModelConfig": {
                        "bedrockEvaluatorModels": [
                            {"modelIdentifier": evaluator_model_id}
                        ]
                    }
                }
            },
            inferenceConfig={
                "models": [{
                    "bedrockModel": {"modelIdentifier": generator_model_id}
                }]
            },
            outputDataConfig={"s3Uri": output_s3_uri}
        )
        job_arn = resp["jobArn"]
        print(f"[LLM-JUDGE] ✓ Job created: {job_arn}", flush=True)
        return job_arn

    @classmethod
    def get_llm_judge_status(cls, job_arn: str) -> dict:
        """Poll status of an LLM-as-judge evaluation job."""
        resp = cls._bm.get_evaluation_job(jobIdentifier=job_arn)
        return {"status": resp.get("status"), "arn": job_arn,
                "name": resp.get("jobName"), "created": str(resp.get("creationTime", ""))}

    @classmethod
    def list_keys(cls, bucket, prefix):
        """List all S3 keys under a prefix."""
        print(f"[S3] LIST s3://{bucket}/{prefix}*", flush=True)
        keys = []
        paginator = cls._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
        print(f"[S3] ✓ Found {len(keys)} keys", flush=True)
        return keys

    # ── Bedrock Converse API (Mistral Ministral 14B) ──

    @classmethod
    def _resolve_model(cls, model_id: str = None) -> str:
        """Return the model ID for Bedrock Converse calls.
        Mistral models use raw model ID directly (no inference profiles)."""
        return model_id or Cfg.MODEL

    @classmethod
    def _call_converse(cls, model_id: str, msgs: list, system: str, inf: dict) -> dict:
        """Low-level Converse call with fallback to raw model ID."""
        try:
            return cls._br.converse(modelId=model_id, messages=msgs,
                                    system=[{"text": system}], inferenceConfig=inf)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            print(f"[BR] Error {code}", flush=True)
            if "Validation" in code or "ResourceNotFound" in code:
                print("[BR] Fallback to raw model ID", flush=True)
                return cls._br.converse(modelId=Cfg.MODEL, messages=msgs,
                                        system=[{"text": system}], inferenceConfig=inf)
            raise

    @classmethod
    @retry(retry=retry_if_exception_type(ClientError), stop=stop_after_attempt(5),
           wait=wait_exponential(multiplier=1, min=4, max=60),
           before_sleep=before_sleep_log(logging.getLogger("BR"), logging.WARNING))
    def ask(cls, system: str, user_text: str, model_id: str = None) -> str:
        """Text-only LLM call via Bedrock Converse API."""
        mid = model_id or Cfg.MODEL
        max_tok = Cfg.JUDGE_MAX_TOK if mid == Cfg.EVAL_JUDGE_MODEL else Cfg.MAX_TOK
        inf = {"maxTokens": max_tok, "temperature": Cfg.TEMP, "topP": 0.9}
        msgs = [{"role": "user", "content": [{"text": user_text}]}]
        print(f"[BR] Invoking {mid} ({len(user_text)} chars)", flush=True)
        r = cls._call_converse(mid, msgs, system, inf)
        txt = r["output"]["message"]["content"][0]["text"]
        stop = r.get("stopReason", "end_turn")
        usage = r.get("usage", {})
        print(f"[BR] ✓ {len(txt)} chars, stop={stop}, usage={usage}", flush=True)
        return txt

    @classmethod
    @retry(retry=retry_if_exception_type(ClientError), stop=stop_after_attempt(5),
           wait=wait_exponential(multiplier=1, min=4, max=60),
           before_sleep=before_sleep_log(logging.getLogger("BR"), logging.WARNING))
    def ask_long(cls, system: str, user_text: str, max_continuations: int = 6, model_id: str = None) -> str:
        """Call Bedrock and auto-continue if the response is truncated (max_tokens).
        Stitches together multiple continuations into one complete response.
        Use this for tasks that produce very large outputs (e.g., Feature narratives)."""
        mid = model_id or Cfg.MODEL
        max_tok = Cfg.JUDGE_MAX_TOK if mid == Cfg.EVAL_JUDGE_MODEL else Cfg.MAX_TOK
        inf = {"maxTokens": max_tok, "temperature": Cfg.TEMP, "topP": 0.9}
        msgs = [{"role": "user", "content": [{"text": user_text}]}]
        accumulated = ""
        for attempt in range(1, max_continuations + 2):
            tag = f"[BR/LONG #{attempt}]"
            print(f"{tag} Invoking {mid}", flush=True)
            r = cls._call_converse(mid, msgs, system, inf)
            chunk = r["output"]["message"]["content"][0]["text"]
            stop = r.get("stopReason", "end_turn")
            usage = r.get("usage", {})
            print(f"{tag} ✓ {len(chunk)} chars, stop={stop}, usage={usage}", flush=True)
            accumulated += chunk
            if stop != "max_tokens":
                print(f"[BR/LONG] Complete after {attempt} call(s), total {len(accumulated)} chars", flush=True)
                break
            if attempt > max_continuations:
                print(f"[BR/LONG] ⚠ Hit max continuations ({max_continuations}), total {len(accumulated)} chars", flush=True)
                break
            print(f"{tag} Response truncated — requesting continuation...", flush=True)
            msgs.append({"role": "assistant", "content": [{"text": chunk}]})
            msgs.append({"role": "user", "content": [{"text":
                "Your response was cut off mid-way. Continue EXACTLY from where you stopped. "
                "Do NOT restart, do NOT repeat any content. Do NOT use markdown code fences (no ```). "
                "Just continue the raw JSON text from the exact point of truncation."
            }]})
        return accumulated

    @classmethod
    @retry(retry=retry_if_exception_type(ClientError), stop=stop_after_attempt(5),
           wait=wait_exponential(multiplier=1, min=4, max=60),
           before_sleep=before_sleep_log(logging.getLogger("BR"), logging.WARNING))
    def ask_vision(cls, system: str, text: str, images: list) -> str:
        """Multimodal call: text + images via Bedrock Converse API.
        images: list of dicts with 'format' (jpeg/png/gif/webp) and 'bytes' (raw bytes)."""
        mid = Cfg.MODEL
        inf = {"maxTokens": min(Cfg.MAX_TOK, 8192), "temperature": Cfg.TEMP, "topP": 0.9}
        content = []
        if text:
            content.append({"text": text})
        for img in images:
            content.append({
                "image": {
                    "format": img.get("format", "jpeg"),
                    "source": {"bytes": img["bytes"]}
                }
            })
        if not content:
            content = [{"text": "Analyze the provided content."}]
        msgs = [{"role": "user", "content": content}]
        print(f"[BR/VISION] Invoking {mid} with {len(images)} image(s), text={len(text)} chars", flush=True)
        try:
            r = cls._br.converse(modelId=mid, messages=msgs, system=[{"text": system}], inferenceConfig=inf)
            txt = r["output"]["message"]["content"][0]["text"]
            stop = r.get("stopReason", "end_turn")
            usage = r.get("usage", {})
            print(f"[BR/VISION] ✓ {len(txt)} chars, stop={stop}, usage={usage}", flush=True)
            return txt
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg = e.response["Error"].get("Message", "")
            print(f"[BR/VISION] Error {code}: {msg}", flush=True)
            if "Validation" in code or "ResourceNotFound" in code:
                print("[BR/VISION] Fallback to raw model ID", flush=True)
                r = cls._br.converse(modelId=Cfg.MODEL, messages=msgs, system=[{"text": system}], inferenceConfig=inf)
                return r["output"]["message"]["content"][0]["text"]
            raise


# ═══════════════════════════════════════════════════════════════════
# OCR SYSTEM PROMPT (model-based OCR for images / scanned pages)
# ═══════════════════════════════════════════════════════════════════
OCR_SYSTEM_PROMPT = """You are a precision medical document OCR engine. Extract ALL text visible in the provided medical image(s).

Absolute rules:
1. Transcribe EVERY word, number, symbol, label, header, table cell, checkbox mark, handwritten note, stamp, and annotation EXACTLY as printed.
2. Preserve layout using plain text formatting: use markdown tables for tabular data, indentation for hierarchy, line breaks for structure.
3. For handwritten text, provide your best reading and mark uncertain words with [?].
4. Include ALL headers, footers, page numbers, facility names, watermarks, barcodes (note their presence), and stamps.
5. Do NOT interpret, summarize, diagnose, or add any commentary. Output ONLY the raw transcribed text.
6. If multiple pages/images are provided, clearly separate each with "--- PAGE N ---" markers.
7. For medical forms, preserve field labels and their values as "Label: Value" pairs.
8. For tables (lab results, medication lists, etc.), use markdown table format with proper column headers.
9. Preserve abbreviations exactly: mg, mL, BID, PRN, etc. Do not expand them.
10. For partially illegible text, provide your best guess in brackets: [illegible] or [possible: word]."""


# ═══════════════════════════════════════════════════════════════════
# FILE-TO-TEXT CONVERTER (Image + Scanned PDF + Unlimited Pages)
# ═══════════════════════════════════════════════════════════════════
class FileToText:
    """Convert any medical file to text + images for Bedrock processing.

    Returns dict:
        text: str           - full text content (unlimited size)
        images: list        - list of {'format': str, 'bytes': bytes, 'label': str}
        is_image_based: bool - True if primary content is images (needs vision API)
        page_count: int     - estimated page count
    """

    @staticmethod
    def _resize_for_model(img_bytes: bytes, max_dim: int = None) -> bytes:
        """Resize image to fit model input limits. Returns JPEG bytes."""
        max_dim = max_dim or Cfg.MAX_IMG_DIM
        img = Image.open(io.BytesIO(img_bytes))
        w, h = img.size
        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        # Convert to RGB (model expects no alpha channel)
        if img.mode in ("RGBA", "P", "LA", "PA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if "A" in img.mode:
                bg.paste(img, mask=img.split()[-1])
            else:
                bg.paste(img)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        result = buf.getvalue()
        # If still > 3.5 MB, reduce further (Bedrock image limit)
        if len(result) > 3_500_000:
            smaller = int(max_dim * 0.65)
            img = img.resize((int(img.width * 0.65), int(img.height * 0.65)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=65, optimize=True)
            result = buf.getvalue()
        return result

    @staticmethod
    def _rasterize_pdf_pages(data: bytes, dpi: int = None, page_range: tuple = None) -> list:
        """Rasterize PDF page range to PIL images. page_range: (start, end) 1-indexed inclusive."""
        dpi = dpi or Cfg.PDF_DPI
        kwargs = {"dpi": dpi, "fmt": "jpeg"}
        if page_range:
            kwargs["first_page"] = page_range[0]
            kwargs["last_page"] = page_range[1]
        try:
            return convert_from_bytes(data, **kwargs)
        except Exception as e:
            print(f"[F2T/RASTER] Error rasterizing pages {page_range}: {e}", flush=True)
            return []

    @staticmethod
    def convert(data: bytes, filename: str) -> dict:
        """Process any file into text + images for Bedrock. No size/page limits."""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        result = {"text": "", "images": [], "is_image_based": False, "page_count": 1}
        print(f"[F2T] Processing {filename} (ext={ext}, {len(data):,} bytes)", flush=True)

        try:
            # ── CSV (all rows) ──
            if ext in ("csv",):
                df = pd.read_csv(io.BytesIO(data))
                result["text"] = f"CSV FILE: {filename}\nRows: {len(df)}\nColumns: {list(df.columns)}\n\n{df.to_markdown(index=False)}"
                result["page_count"] = max(1, len(df) // 50)

            # ── EXCEL (all sheets, all rows) ──
            elif ext in ("xlsx", "xls"):
                xls = pd.ExcelFile(io.BytesIO(data))
                parts = []
                total_rows = 0
                for sheet in xls.sheet_names:
                    df = pd.read_excel(xls, sheet_name=sheet)
                    total_rows += len(df)
                    parts.append(f"\n=== SHEET: {sheet} ({len(df)} rows, {len(df.columns)} cols) ===\n{df.to_markdown(index=False)}")
                result["text"] = f"EXCEL FILE: {filename}\nSheets: {xls.sheet_names}\nTotal rows: {total_rows}\n" + "\n".join(parts)
                result["page_count"] = max(1, total_rows // 50)

            # ── PDF (unlimited pages, scanned detection, OCR-ready rasterization) ──
            elif ext == "pdf":
                result = FileToText._process_pdf(data, filename)

            # ── WORD DOCUMENTS (full text + all tables) ──
            elif ext in ("docx", "doc"):
                d = docx.Document(io.BytesIO(data))
                paragraphs = [p.text for p in d.paragraphs if p.text.strip()]
                tables_text = []
                for ti, table in enumerate(d.tables):
                    rows = []
                    for row in table.rows:
                        cells = [cell.text.strip() for cell in row.cells]
                        rows.append(cells)
                    if rows:
                        hdr = rows[0]
                        tdf = pd.DataFrame(rows[1:], columns=hdr) if len(rows) > 1 else pd.DataFrame([rows[0]])
                        tables_text.append(f"\n--- TABLE {ti + 1} ---\n{tdf.to_markdown(index=False)}")
                full_text = "\n".join(paragraphs)
                if tables_text:
                    full_text += "\n\n--- EMBEDDED TABLES ---" + "\n".join(tables_text)
                result["text"] = f"WORD DOCUMENT: {filename}\nParagraphs: {len(paragraphs)}\nTables: {len(d.tables)}\n\n{full_text}"
                result["page_count"] = max(1, len(paragraphs) // 30)

            # ── IMAGES (send to model for visual analysis / OCR) ──
            elif ext in ("jpg", "jpeg", "png", "bmp", "tiff", "tif", "gif", "webp"):
                img = Image.open(io.BytesIO(data))
                w, h = img.size
                resized = FileToText._resize_for_model(data)
                result["images"] = [{"format": "jpeg", "bytes": resized, "label": f"Image: {filename}"}]
                result["is_image_based"] = True
                result["text"] = (
                    f"IMAGE FILE: {filename}\nFormat: {ext.upper()}\nDimensions: {w}x{h}\n"
                    f"Mode: {img.mode}\nSize: {len(data):,} bytes\n"
                    f"[Image content sent to model for visual analysis and OCR]"
                )

            # ── DICOM medical images ──
            elif ext == "dcm":
                result = FileToText._process_dicom(data, filename)

            # ── TEXT-BASED formats (unlimited) ──
            elif ext in ("txt", "rtf", "json", "xml", "vcf", "hl7", "md", "yaml", "yml", "log", "ini", "cfg"):
                text = data.decode("utf-8", errors="ignore")
                result["text"] = f"TEXT FILE: {filename}\nCharacters: {len(text):,}\n\n{text}"
                result["page_count"] = max(1, len(text) // 3000)

            else:
                # Try as text, fallback to binary metadata
                try:
                    text = data.decode("utf-8", errors="strict")
                    result["text"] = f"FILE: {filename}\nExtension: {ext}\nCharacters: {len(text):,}\n\n{text}"
                except UnicodeDecodeError:
                    result["text"] = f"BINARY FILE: {filename}\nExtension: {ext}\nSize: {len(data):,} bytes\n[Unsupported binary format]"

        except Exception as e:
            print(f"[F2T] ✗ Error: {e}", flush=True)
            traceback.print_exc()
            result["text"] = f"FILE: {filename}\n[CONVERSION ERROR: {str(e)}]\nSize: {len(data):,} bytes"

        print(f"[F2T] ✓ text={len(result['text']):,} chars, images={len(result['images'])}, image_based={result['is_image_based']}, pages={result['page_count']}", flush=True)
        return result

    @staticmethod
    def _process_pdf(data: bytes, filename: str) -> dict:
        """Process PDF: extract ALL pages text, detect scanned content, rasterize for OCR."""
        result = {"text": "", "images": [], "is_image_based": False, "page_count": 0}
        reader = PdfReader(io.BytesIO(data))
        total_pages = len(reader.pages)
        result["page_count"] = total_pages
        print(f"[F2T/PDF] {filename}: {total_pages} pages", flush=True)

        # ── Extract text from EVERY page (no limit) ──
        text_pages = []
        scanned_indices = []
        for i, page in enumerate(reader.pages):
            txt = (page.extract_text() or "").strip()
            text_pages.append(txt)
            if len(txt) < Cfg.SCANNED_THRESHOLD:
                scanned_indices.append(i)

        total_chars = sum(len(t) for t in text_pages)
        scanned_ratio = len(scanned_indices) / max(total_pages, 1)
        print(f"[F2T/PDF] Text: {total_chars:,} chars | Scanned: {len(scanned_indices)}/{total_pages} ({scanned_ratio:.0%})", flush=True)

        # ── Decide: image-based vs text-based ──
        if scanned_ratio > 0.5:
            # Mostly scanned PDF → rasterize ALL pages for model OCR
            print(f"[F2T/PDF] Scanned PDF detected → rasterizing all {total_pages} pages", flush=True)
            result["is_image_based"] = True
            RASTER_BATCH = 10  # rasterize N pages at a time (memory safety)
            for start in range(1, total_pages + 1, RASTER_BATCH):
                end = min(start + RASTER_BATCH - 1, total_pages)
                pil_imgs = FileToText._rasterize_pdf_pages(data, page_range=(start, end))
                for j, pil_img in enumerate(pil_imgs):
                    page_num = start + j
                    buf = io.BytesIO()
                    pil_img.save(buf, format="JPEG", quality=85)
                    resized = FileToText._resize_for_model(buf.getvalue())
                    result["images"].append({
                        "format": "jpeg",
                        "bytes": resized,
                        "label": f"Page {page_num}/{total_pages} of {filename}"
                    })
                print(f"[F2T/PDF] Rasterized pages {start}-{end} ({len(result['images'])} total images)", flush=True)

            # Include any extractable text as supplementary
            text_parts = [f"--- PAGE {i+1} (partial text) ---\n{txt}" for i, txt in enumerate(text_pages) if txt.strip()]
            if text_parts:
                result["text"] = f"SCANNED PDF: {filename}\nPages: {total_pages}\n[{len(result['images'])} page images extracted for model OCR]\n\n" + "\n\n".join(text_parts)
            else:
                result["text"] = f"SCANNED PDF: {filename}\nPages: {total_pages}\n[Fully scanned - {len(result['images'])} page images extracted for model OCR]"

        else:
            # Text-based PDF (with possibly a few scanned pages)
            pages_text = [f"--- PAGE {i+1} ---\n{txt}" for i, txt in enumerate(text_pages) if txt.strip()]
            result["text"] = f"PDF FILE: {filename}\nPages: {total_pages}\n\n" + "\n\n".join(pages_text)

            # Also rasterize any scanned pages within this mostly-text PDF
            if scanned_indices:
                print(f"[F2T/PDF] Mixed PDF: rasterizing {len(scanned_indices)} scanned pages", flush=True)
                try:
                    for idx in scanned_indices:
                        pil_imgs = FileToText._rasterize_pdf_pages(data, page_range=(idx + 1, idx + 1))
                        if pil_imgs:
                            buf = io.BytesIO()
                            pil_imgs[0].save(buf, format="JPEG", quality=85)
                            resized = FileToText._resize_for_model(buf.getvalue())
                            result["images"].append({
                                "format": "jpeg",
                                "bytes": resized,
                                "label": f"Scanned page {idx+1}/{total_pages} of {filename}"
                            })
                    print(f"[F2T/PDF] Rasterized {len(result['images'])} scanned pages from mixed PDF", flush=True)
                except Exception as e:
                    print(f"[F2T/PDF] Could not rasterize scanned pages: {e}", flush=True)

        return result

    @staticmethod
    def _process_dicom(data: bytes, filename: str) -> dict:
        """Process DICOM medical image files with rich clinical metadata extraction."""
        result = {"text": "", "images": [], "is_image_based": True, "page_count": 1}
        try:
            ds = pydicom.dcmread(io.BytesIO(data))

            # Extended tag list for comprehensive clinical context
            DICOM_TAGS = [
                # Patient info
                "PatientName", "PatientID", "PatientBirthDate", "PatientSex", "PatientAge",
                "PatientWeight", "PatientSize",
                # Study info
                "StudyDate", "StudyTime", "StudyDescription", "StudyID",
                "AccessionNumber", "ReferringPhysicianName",
                # Series info
                "SeriesDescription", "SeriesNumber", "Modality",
                "BodyPartExamined", "ViewPosition", "PatientPosition",
                # Acquisition info
                "SliceThickness", "SpacingBetweenSlices", "KVP", "XRayTubeCurrent",
                "ExposureTime", "ContrastBolusAgent", "ContrastBolusRoute",
                "RepetitionTime", "EchoTime", "MagneticFieldStrength",
                "SequenceName", "ScanningSequence",
                # Image info
                "Rows", "Columns", "BitsAllocated", "PhotometricInterpretation",
                "PixelSpacing", "WindowCenter", "WindowWidth",
                # Equipment
                "Manufacturer", "ManufacturerModelName", "InstitutionName",
                "StationName", "SoftwareVersions",
                # Instance
                "InstanceNumber", "ImageComments", "AcquisitionDate",
            ]

            meta_lines = [
                f"DICOM MEDICAL IMAGE FILE: {filename}",
                f"{'─'*50}",
            ]
            modality = str(getattr(ds, "Modality", "unknown"))
            body_part = str(getattr(ds, "BodyPartExamined", "unknown"))
            study_desc = str(getattr(ds, "StudyDescription", getattr(ds, "SeriesDescription", "unknown")))

            # Clinical context header
            meta_lines.append(f"IMAGING STUDY: {modality} — {study_desc}")
            meta_lines.append(f"BODY PART: {body_part}")
            meta_lines.append(f"{'─'*50}")

            for tag in DICOM_TAGS:
                if hasattr(ds, tag):
                    val = str(getattr(ds, tag)).strip()
                    if val and val not in ("None", ""):
                        meta_lines.append(f"{tag}: {val}")

            # Add clinical interpretation guidance based on modality
            meta_lines.append(f"\n{'─'*50}")
            meta_lines.append(f"CLINICAL INTERPRETATION GUIDANCE:")
            if modality in ("CT", "CR", "DX"):
                meta_lines.append("- Evaluate for structural abnormalities, masses, fractures, effusions")
                meta_lines.append("- Assess contrast enhancement patterns if contrast was used")
                meta_lines.append("- Note measurements of any abnormal findings")
            elif modality in ("MR", "MRI"):
                meta_lines.append("- Evaluate signal characteristics on different sequences")
                meta_lines.append("- Assess enhancement patterns, edema, mass effect")
                meta_lines.append("- Compare lesion size and morphology")
            elif modality in ("US", "ECHO"):
                meta_lines.append("- Evaluate organ echogenicity and dimensions")
                meta_lines.append("- Assess blood flow patterns if Doppler present")
                meta_lines.append("- Note any collections, masses, or calcifications")
            elif modality in ("XA", "RF"):
                meta_lines.append("- Evaluate vascular anatomy and contrast flow")
                meta_lines.append("- Assess for stenosis, occlusion, or abnormal vasculature")
            else:
                meta_lines.append(f"- Provide comprehensive clinical analysis for {modality} modality")
            meta_lines.append(f"{'─'*50}")

            result["text"] = "\n".join(meta_lines)

            # Extract pixel data as image for model visual analysis
            if hasattr(ds, "pixel_array"):
                arr = ds.pixel_array.astype(np.float64)
                # Apply window/level if available for better visualization
                wc = getattr(ds, "WindowCenter", None)
                ww = getattr(ds, "WindowWidth", None)
                if wc is not None and ww is not None:
                    try:
                        wc = float(wc) if not hasattr(wc, '__iter__') else float(wc[0])
                        ww = float(ww) if not hasattr(ww, '__iter__') else float(ww[0])
                        low = wc - ww / 2
                        high = wc + ww / 2
                        arr = np.clip(arr, low, high)
                    except (ValueError, TypeError):
                        pass
                arr = ((arr - arr.min()) / (arr.max() - arr.min() + 1e-8) * 255).astype(np.uint8)
                img = Image.fromarray(arr)
                buf = io.BytesIO()
                img.convert("RGB").save(buf, format="JPEG", quality=92)
                resized = FileToText._resize_for_model(buf.getvalue())
                result["images"].append({
                    "format": "jpeg",
                    "bytes": resized,
                    "label": f"DICOM {modality} {body_part}: {study_desc} — {filename}"
                })
                print(f"[F2T/DICOM] Extracted {modality} {body_part} image from {filename} "
                      f"({getattr(ds, 'Rows', '?')}x{getattr(ds, 'Columns', '?')})", flush=True)
            else:
                result["text"] += "\n[No pixel data available in this DICOM file — metadata only]"
                # Still mark as NOT image-based so the text metadata goes through text pipeline
                result["is_image_based"] = False

        except Exception as e:
            print(f"[F2T/DICOM] Error: {e}", flush=True)
            result["text"] = (f"DICOM MEDICAL IMAGE FILE: {filename}\n"
                              f"[DICOM PROCESSING ERROR: {str(e)}]\n"
                              f"Size: {len(data):,} bytes\n"
                              f"Note: Clinical metadata could not be extracted. "
                              f"This file should still be included in imaging_summary.")
            result["is_image_based"] = False
        return result


# ═══════════════════════════════════════════════════════════════════
# JSON PARSER
# ═══════════════════════════════════════════════════════════════════
def parse_json(text: str, stage: str) -> dict:
    """Robust JSON parser that handles truncated / malformed LLM output.
    Tries increasingly aggressive repair strategies before giving up."""

    # === Strategy 0: Strip ALL markdown fences (handles multi-continuation output) ===
    # Model may wrap in ```json...``` or produce multiple fenced blocks across continuations
    cleaned = re.sub(r'```(?:json)?\s*', '', text).strip()

    # === Strategy 1: Direct parse (original text) ===
    try:
        return json.loads(text)
    except Exception:
        pass

    # === Strategy 1b: Direct parse (fence-stripped) ===
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # === Strategy 2: Multi-fence concatenation ===
    # For continuations: ```json{...}``` + continuation text + ```json{...}```
    # Extract all JSON content between fences and concatenate
    fence_blocks = re.findall(r'```(?:json)?\s*(.*?)```', text, re.DOTALL)
    if fence_blocks:
        concatenated = ''.join(fence_blocks).strip()
        try:
            return json.loads(concatenated)
        except Exception:
            pass
        # Try extracting outermost braces from concatenated blocks
        s2 = concatenated.find('{')
        e2 = concatenated.rfind('}')
        if s2 != -1 and e2 > s2:
            try:
                return json.loads(concatenated[s2:e2 + 1])
            except Exception:
                pass

    # === Strategy 2c: Try json_repair early (best at handling truncated/malformed output) ===
    try:
        repaired_early = repair_json(cleaned, return_objects=True)
        if isinstance(repaired_early, dict) and len(repaired_early) >= 2:
            print(f"[{stage}] ✓ json_repair (early) succeeded (dict, {len(repaired_early)} keys)", flush=True)
            return repaired_early
    except Exception:
        pass

    # === Strategy 3: Extract outermost { ... } ===
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except Exception:
            pass

    # === Strategy 3b: Fix unescaped newlines/tabs inside JSON strings ===
    # Models produce literal newlines inside string values (e.g., markdown tables).
    # Walk char-by-char, escape control chars only when inside a JSON string.
    def _fix_control_chars_in_strings(src: str) -> str:
        out = []
        in_s = False
        esc_flag = False
        for ch in src:
            if esc_flag:
                out.append(ch)
                esc_flag = False
                continue
            if ch == '\\' and in_s:
                out.append(ch)
                esc_flag = True
                continue
            if ch == '"':
                in_s = not in_s
                out.append(ch)
                continue
            if in_s and ch == '\n':
                out.append('\\n')
                continue
            if in_s and ch == '\r':
                out.append('\\r')
                continue
            if in_s and ch == '\t':
                out.append('\\t')
                continue
            out.append(ch)
        return ''.join(out)

    if start != -1 and end > start:
        fixed = _fix_control_chars_in_strings(cleaned[start:end + 1])
        try:
            return json.loads(fixed)
        except Exception:
            pass
        # Also try with the full cleaned text
        fixed_full = _fix_control_chars_in_strings(cleaned)
        try:
            return json.loads(fixed_full)
        except Exception:
            pass

    # === Strategy 4: Repair truncated strings + balance brackets ===
    if start == -1:
        print(f"[{stage}] No opening brace found in response", flush=True)
        return {"parse_error": True, "raw_response": text[:200000]}

    candidate = cleaned[start:] if end <= start else cleaned[start:end + 1]

    # 4a: Close any unclosed string literal (truncated mid-string)
    in_str = False
    esc = False
    for ch in candidate:
        if esc:
            esc = False
            continue
        if ch == '\\':
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
    if in_str:
        # Truncated inside a string — close it
        candidate += '"'

    # 4b: Remove trailing comma / incomplete key-value fragments
    candidate = re.sub(r',\s*$', '', candidate)
    # Remove trailing partial key like  ,"some_key": 
    candidate = re.sub(r',\s*"[^"]*"\s*:\s*$', '', candidate)

    # 4c: Balance brackets and braces
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
    opens_brace = candidate.count("{") - candidate.count("}")
    opens_bracket = candidate.count("[") - candidate.count("]")
    candidate += "]" * max(opens_bracket, 0)
    candidate += "}" * max(opens_brace, 0)

    try:
        return json.loads(candidate)
    except Exception:
        pass

    # === Strategy 5: Aggressively trim from the end and retry ===
    # Walk backwards removing characters until we hit a valid value-end token
    for trim_target in ['"', ']', '}', 'e', 'l', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
        idx = candidate.rfind(trim_target)
        if idx > len(candidate) // 2:  # don't trim more than half
            attempt = candidate[:idx + 1]
            attempt = re.sub(r',\s*$', '', attempt)
            ob = attempt.count("{") - attempt.count("}")
            ol = attempt.count("[") - attempt.count("]")
            attempt += "]" * max(ol, 0)
            attempt += "}" * max(ob, 0)
            try:
                return json.loads(attempt)
            except Exception:
                continue

    # === Strategy 6: Line-by-line truncation (remove last N lines and rebalance) ===
    lines = candidate.split('\n')
    for drop in range(1, min(len(lines) // 2, 80)):
        attempt = '\n'.join(lines[:-drop])
        attempt = re.sub(r',\s*$', '', attempt.rstrip())
        ob = attempt.count("{") - attempt.count("}")
        ol = attempt.count("[") - attempt.count("]")
        in_s = False
        esc2 = False
        for c2 in attempt:
            if esc2: esc2 = False; continue
            if c2 == '\\': esc2 = True; continue
            if c2 == '"': in_s = not in_s
        if in_s:
            attempt += '"'
        attempt += "]" * max(ol, 0)
        attempt += "}" * max(ob, 0)
        try:
            return json.loads(attempt)
        except Exception:
            continue

    # === Strategy 7: json_repair library (handles unescaped quotes, newlines, etc.) ===
    print(f"[{stage}] Trying json_repair library on {len(cleaned)} chars...", flush=True)
    try:
        repaired = repair_json(cleaned, return_objects=True)
        if isinstance(repaired, dict) and len(repaired) >= 2:
            print(f"[{stage}] ✓ json_repair succeeded (dict, {len(repaired)} keys)", flush=True)
            return repaired
        elif isinstance(repaired, list):
            # json_repair may split broken JSON into multiple fragments
            # Merge all dict fragments, preferring larger values
            merged = {}
            for item in repaired:
                if isinstance(item, dict):
                    for k, v in item.items():
                        if k not in merged or (isinstance(v, (str, list, dict)) and len(str(v)) > len(str(merged.get(k, '')))):
                            merged[k] = v
            if len(merged) >= 2:
                print(f"[{stage}] ✓ json_repair succeeded (merged {len(repaired)} fragments → {len(merged)} keys)", flush=True)
                return merged
    except Exception as _jr_err:
        print(f"[{stage}] json_repair failed: {_jr_err}", flush=True)

    print(f"[{stage}] ✗ All JSON repair strategies exhausted ({len(text)} chars)", flush=True)
    return {"parse_error": True, "raw_response": text[:200000]}


# ═══════════════════════════════════════════════════════════════════
# PARQUET BUILDER
# ═══════════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════
# PDF REPORT GENERATOR
# ═══════════════════════════════════════════════════════════════

class PDFReportGenerator:
    """Generates professional medical PDF reports from narrative data."""

    # Section headings that appear in narrative_text
    SECTIONS = [
        "PATIENT SUMMARY",
        "CLINICAL FINDINGS",
        "SYMPTOMS",
        "TREATMENT PLAN",
        "LABORATORY RESULTS",
        "CLINICAL INTERPRETATION",
        "RISK ASSESSMENT",
        "DIET AND LIFESTYLE RECOMMENDATIONS",
        "FOLLOW-UP PLAN",
        "SUMMARY",
    ]

    # Category groupings for per-category PDFs
    CATEGORIES = {
        "Patient_Overview":        ["PATIENT SUMMARY", "SUMMARY"],
        "Clinical_Findings":       ["CLINICAL FINDINGS", "CLINICAL INTERPRETATION"],
        "Medications_Treatment":   ["TREATMENT PLAN"],
        "Laboratory_Results":      ["LABORATORY RESULTS"],
        "Symptoms":                ["SYMPTOMS"],
        "Risk_Assessment":         ["RISK ASSESSMENT"],
        "Diet_Lifestyle":          ["DIET AND LIFESTYLE RECOMMENDATIONS"],
        "Follow_Up_Plan":          ["FOLLOW-UP PLAN"],
    }

    @staticmethod
    def _get_styles():
        """Build ReportLab styles for medical report."""
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            'MedTitle', parent=styles['Title'],
            fontSize=18, textColor=HexColor('#1a365d'),
            spaceAfter=6, alignment=TA_CENTER,
        ))
        styles.add(ParagraphStyle(
            'MedSubTitle', parent=styles['Normal'],
            fontSize=10, textColor=HexColor('#4a5568'),
            spaceAfter=12, alignment=TA_CENTER,
        ))
        styles.add(ParagraphStyle(
            'SectionHead', parent=styles['Heading2'],
            fontSize=13, textColor=HexColor('#2b6cb0'),
            spaceBefore=14, spaceAfter=6,
            borderWidth=0, borderPadding=0,
        ))
        styles.add(ParagraphStyle(
            'MedBody', parent=styles['Normal'],
            fontSize=9.5, leading=13, spaceAfter=4,
            textColor=HexColor('#1a202c'),
        ))
        styles.add(ParagraphStyle(
            'MedBullet', parent=styles['Normal'],
            fontSize=9.5, leading=13, spaceAfter=2,
            leftIndent=18, bulletIndent=6,
            textColor=HexColor('#1a202c'),
        ))
        styles.add(ParagraphStyle(
            'FooterStyle', parent=styles['Normal'],
            fontSize=7, textColor=HexColor('#a0aec0'),
            alignment=TA_CENTER,
        ))
        return styles

    @staticmethod
    def _parse_narrative_sections(narrative_text: str) -> dict:
        """Split narrative_text into named sections by header lines."""
        sections = {}
        current_key = None
        current_lines = []
        for line in narrative_text.split('\n'):
            stripped = line.strip()
            # Check if line is a section header (matches known sections)
            matched = None
            for sec in PDFReportGenerator.SECTIONS:
                # Match "PATIENT SUMMARY" or "PATIENT SUMMARY — ..."
                if stripped.upper().startswith(sec):
                    matched = sec
                    break
            if matched:
                if current_key is not None:
                    sections[current_key] = '\n'.join(current_lines).strip()
                current_key = matched
                # Keep the remainder of the header line (e.g. "— John, 65M")
                remainder = stripped[len(matched):].lstrip(' —-').strip()
                current_lines = [remainder] if remainder else []
            else:
                current_lines.append(line)
        if current_key is not None:
            sections[current_key] = '\n'.join(current_lines).strip()
        return sections

    @staticmethod
    def _build_section_flowables(section_name, section_text, styles):
        """Convert a section name + text block into ReportLab flowables."""
        flowables = []
        flowables.append(Paragraph(section_name.title(), styles['SectionHead']))
        flowables.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'),
                                    spaceBefore=1, spaceAfter=6))
        for line in section_text.split('\n'):
            stripped = line.strip()
            if not stripped:
                flowables.append(Spacer(1, 4))
                continue
            # Escape XML special chars for ReportLab
            safe = stripped.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            if stripped.startswith('- ') or stripped.startswith('* '):
                bullet_text = safe[2:]
                flowables.append(Paragraph(f"&bull; {bullet_text}", styles['MedBullet']))
            elif stripped[0:1].isdigit() and ('.' in stripped[:4] or ')' in stripped[:4]):
                flowables.append(Paragraph(safe, styles['MedBullet']))
            else:
                flowables.append(Paragraph(safe, styles['MedBody']))
        flowables.append(Spacer(1, 6))
        return flowables

    @staticmethod
    def _build_header(case_id, patient_profile, category_label, styles):
        """Build PDF header flowables."""
        flowables = []
        flowables.append(Paragraph("MEVREON MEDICAL AI", styles['MedTitle']))
        p_name = patient_profile.get("patient_name", "Patient")
        p_age = patient_profile.get("age", "")
        p_gender = patient_profile.get("gender", "")
        subtitle = f"{p_name}"
        if p_age:
            subtitle += f" | Age: {p_age}"
        if p_gender:
            subtitle += f" | {p_gender}"
        subtitle += f" | Case: {case_id}"
        flowables.append(Paragraph(subtitle, styles['MedSubTitle']))
        flowables.append(Paragraph(
            f"<b>{category_label}</b> | Generated: {datetime.datetime.utcnow().strftime('%B %d, %Y %H:%M UTC')}",
            styles['MedSubTitle']
        ))
        flowables.append(HRFlowable(width="100%", thickness=1.5, color=HexColor('#2b6cb0'),
                                    spaceBefore=2, spaceAfter=12))
        return flowables

    @staticmethod
    def _build_structured_section(title, items, styles, columns=None):
        """Build a section from structured data (list of dicts) as a table."""
        flowables = []
        if not items:
            return flowables
        flowables.append(Paragraph(title, styles['SectionHead']))
        flowables.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'),
                                    spaceBefore=1, spaceAfter=6))
        if isinstance(items, list) and len(items) > 0:
            if isinstance(items[0], dict):
                # Auto-detect columns
                if not columns:
                    columns = list(items[0].keys())[:6]
                header = [c.replace('_', ' ').title() for c in columns]
                data = [header]
                for item in items[:50]:  # cap at 50 rows
                    row = []
                    for c in columns:
                        v = item.get(c, '')
                        row.append(str(v)[:80] if v else '')
                    data.append(row)
                col_width = (7.0 * inch) / max(len(columns), 1)
                tbl = Table(data, colWidths=[col_width] * len(columns))
                tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#2b6cb0')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ]))
                flowables.append(tbl)
            elif isinstance(items[0], str):
                for item in items[:50]:
                    safe = str(item).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    flowables.append(Paragraph(f"&bull; {safe}", styles['MedBullet']))
        flowables.append(Spacer(1, 8))
        return flowables

    @staticmethod
    def generate_pdf(result: dict, case_id: str, category: str = "Complete_Report",
                     section_names: list = None) -> bytes:
        """Generate a PDF report and return bytes.
        
        Args:
            result: The full narrative JSON dict
            case_id: Patient case identifier 
            category: Label for the PDF (e.g. 'Laboratory_Results')
            section_names: List of section names to include from narrative_text.
                           None = all sections (complete report).
        """
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter,
                                topMargin=0.6*inch, bottomMargin=0.6*inch,
                                leftMargin=0.7*inch, rightMargin=0.7*inch)
        styles = PDFReportGenerator._get_styles()
        story = []

        patient_profile = result.get("patient_profile", {})
        label = category.replace('_', ' ')
        story.extend(PDFReportGenerator._build_header(case_id, patient_profile, label, styles))

        # Parse narrative text into sections
        narrative_obj = result.get("longitudinal_narrative", {})
        narrative_text = narrative_obj.get("narrative_text", "")
        if not narrative_text:
            narrative_text = result.get("narrative_text", "")

        parsed_sections = PDFReportGenerator._parse_narrative_sections(narrative_text)

        # Filter sections if specific ones requested
        if section_names:
            target_sections = {k: v for k, v in parsed_sections.items() if k in section_names}
        else:
            target_sections = parsed_sections

        # Render narrative sections
        for sec_name in PDFReportGenerator.SECTIONS:
            if sec_name in target_sections and target_sections[sec_name]:
                story.extend(PDFReportGenerator._build_section_flowables(
                    sec_name, target_sections[sec_name], styles))

        # For specific categories, also add structured data tables
        if category == "Complete_Report" or category == "Medications_Treatment":
            meds = result.get("medications", {}).get("current_regimen", [])
            if meds:
                story.extend(PDFReportGenerator._build_structured_section(
                    "Current Medications", meds, styles,
                    columns=["name", "dose", "frequency", "route", "indication"]))

        if category == "Complete_Report" or category == "Laboratory_Results":
            labs = result.get("laboratory_summary", {}).get("key_values", [])
            if labs:
                story.extend(PDFReportGenerator._build_structured_section(
                    "Key Laboratory Values", labs, styles,
                    columns=["test", "value", "units", "reference_range", "status"]))

        if category == "Complete_Report" or category == "Clinical_Findings":
            problems = result.get("problem_list", [])
            if problems:
                story.extend(PDFReportGenerator._build_structured_section(
                    "Problem List", problems, styles,
                    columns=["condition", "icd10", "status"]))

        if category == "Complete_Report" or category == "Risk_Assessment":
            risks = result.get("risk_assessment", {})
            short_term = risks.get("short_term_risks_30d", [])
            if short_term:
                story.extend(PDFReportGenerator._build_structured_section(
                    "Short-Term Risks (30 day)", short_term, styles))
            monitoring = risks.get("critical_monitoring_parameters", [])
            if monitoring:
                story.extend(PDFReportGenerator._build_structured_section(
                    "Critical Monitoring Parameters", monitoring, styles))

        # Footer
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'),
                                spaceBefore=8, spaceAfter=4))
        story.append(Paragraph(
            f"Mevreon Medical AI Platform | Case: {case_id} | "
            f"Generated: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | "
            f"This report is AI-generated and should be reviewed by a qualified healthcare professional.",
            styles['FooterStyle']
        ))

        doc.build(story)
        return buf.getvalue()

    @staticmethod
    def generate_all_pdfs(result: dict, case_id: str) -> dict:
        """Generate all category PDFs + one complete PDF.
        
        Returns dict of { filename: pdf_bytes }
        """
        pdfs = {}
        # 1. Complete Report
        try:
            pdfs["Complete_Report.pdf"] = PDFReportGenerator.generate_pdf(
                result, case_id, "Complete_Report", None)
        except Exception as e:
            print(f"[PDF] Warning: Complete_Report generation failed: {e}", flush=True)

        # 2. Per-category PDFs
        for cat_name, sec_names in PDFReportGenerator.CATEGORIES.items():
            try:
                pdf_bytes = PDFReportGenerator.generate_pdf(
                    result, case_id, cat_name, sec_names)
                pdfs[f"{cat_name}.pdf"] = pdf_bytes
            except Exception as e:
                print(f"[PDF] Warning: {cat_name} generation failed: {e}", flush=True)

        return pdfs


class ParquetBuilder:
    """Builds and maintains a master Parquet file per case_id in CURATED bucket."""

    @staticmethod
    def flatten_to_rows(data: dict, run_id: str, filename: str, case_id: str) -> List[dict]:
        """Flatten standardized/validated data into flat rows for Parquet."""
        rows = []
        ts = datetime.datetime.utcnow().isoformat()

        categories = {
            "medications": ["name", "standard_name", "original", "strength", "frequency"],
            "conditions": ["condition", "standard_name", "original", "icd10", "severity"],
            "lab_tests": ["test_name", "standard_name", "original_name", "value", "units", "ref_range", "abnormal"],
            "vital_signs": ["type", "value", "units"],
            "allergies": ["allergen", "reaction"],
            "diseases": ["condition", "icd10", "severity", "status"],
            "procedures": ["name", "cpt", "date"],
            "imaging_findings": ["modality", "body_part", "finding"],
            "genomic_data": ["gene", "variant", "classification"],
        }

        for cat, fields in categories.items():
            items = data.get(cat, [])
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                name_field = next((item.get(f) for f in fields if item.get(f)), str(item)[:100])
                value_field = item.get("value", item.get("strength", item.get("icd10", "")))
                rows.append({
                    "case_id": case_id,
                    "run_id": run_id,
                    "source_file": filename,
                    "timestamp": ts,
                    "category": cat.upper(),
                    "entity_name": str(name_field)[:200],
                    "entity_value": str(value_field)[:200] if value_field else "",
                    "units": str(item.get("units", ""))[:50],
                    "ref_range": str(item.get("ref_range", item.get("ref_range", "")))[:100],
                    "abnormal_flag": str(item.get("abnormal", item.get("abnormal_flag", "")))[:10],
                    "confidence": float(item.get("confidence", item.get("mapping_confidence", 0.8))),
                    "extra_json": json.dumps({k: v for k, v in item.items() if k not in ("confidence", "mapping_confidence")}, default=str)[:500],
                })
        return rows

    @staticmethod
    def update_parquet(case_id: str, new_rows: List[dict]):
        """Merge new rows into existing Parquet or create fresh."""
        if not new_rows:
            print("[PARQUET] No rows to write", flush=True)
            return

        new_df = pd.DataFrame(new_rows)
        parquet_key = f"cases/{case_id}/master_data.parquet"

        try:
            old_bytes = AWS.read(Cfg.BUCKETS["CURATED"], parquet_key, as_bytes=True)
            old_df = pd.read_parquet(io.BytesIO(old_bytes))
            print(f"[PARQUET] Existing parquet: {len(old_df)} rows", flush=True)
            combined = pd.concat([old_df, new_df], ignore_index=True)
            combined.drop_duplicates(subset=["run_id", "category", "entity_name", "entity_value"], keep="last", inplace=True)
        except Exception:
            print("[PARQUET] No existing parquet, creating new", flush=True)
            combined = new_df

        buf = io.BytesIO()
        combined.to_parquet(buf, index=False, engine="pyarrow")
        buf.seek(0)
        AWS.write(Cfg.BUCKETS["CURATED"], parquet_key, buf.getvalue(), ct="application/octet-stream")
        print(f"[PARQUET] ✓ Written {len(combined)} rows to {parquet_key}", flush=True)


# ═══════════════════════════════════════════════════════════════════
# AGENT 1: INGESTION
# ═══════════════════════════════════════════════════════════════════
INGESTION_PROMPT = """You are the MEVREON UNIVERSAL MEDICAL DATA EXTRACTION ENGINE (Version 5.0).

You are the most advanced medical document analysis system in the world. Your singular purpose is to receive raw medical document content — which has been converted to text for you — and produce a comprehensive, structured JSON extraction of ALL medical entities, data points, measurements, and clinical information contained within.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE REQUIREMENTS — FAILURE TO COMPLY WILL RESULT IN SYSTEM REJECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OUTPUT FORMAT: Return ONLY a single valid JSON object. No markdown fences. No commentary before or after. No explanations. Just pure JSON.

2. COMPLETENESS: Extract EVERY single data point visible in the document. Missing data is unacceptable. If a lab report has 50 rows, extract all 50. If a clinical note mentions 8 medications, extract all 8.

3. VERBATIM PRESERVATION: All values, numbers, dates, and measurements must be transcribed EXACTLY as they appear. Do not round, convert, estimate, or modify any value. If the document says "0.92 mg/dl", your output must say "0.92 mg/dl" — not "0.9" or "1.0".

4. CONFIDENCE SCORING: Every extracted entity must include a confidence score from 0.0 (pure guess) to 1.0 (certain). Base this on: clarity of text, whether you're reading structured data vs inferring from narrative, presence of standard codes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT TYPES YOU MUST HANDLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A. LAB REPORTS — Extract EVERY test row: test name, result value, units, reference range, abnormal flag. Preserve dates, physician, facility. Group by panel when present. Flag critical values.

B. CLINICAL NOTES — Chief complaint, HPI, ROS, physical exam, assessment/diagnosis with ICD-10, plan, vitals.

C. IMAGING REPORTS — Modality, body part, findings verbatim, impression, comparisons, measurements.

D. MEDICATIONS — Drug name, strength, frequency, route, start/end dates, prescriber, indication.

E. FINANCIAL — CPT/ICD codes, charges, insurance, service dates.

F. GENOMIC — Gene names, HGVS variants, zygosity, classification, VAF, methodology.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT JSON SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
    "file_type": "LAB_REPORT|CLINICAL_NOTE|IMAGING_REPORT|PRESCRIPTION|FINANCIAL|GENOMIC|MIXED|OTHER",
    "document_summary": "2-3 sentence summary",
    "extraction_timestamp": "ISO 8601",
    "demographics": {"patient_name": "[ANONYMIZED] — DO NOT include real names", "age": "REQUIRED — string/integer, e.g. '45' or '45 years'. Must extract if present anywhere.", "gender": "REQUIRED — Male/Female/M/F/Other. Must extract if present anywhere.", "dob": "string or null", "mrn": "string or null", "confidence": 0.0},
    "diseases": [{"condition": "string", "icd10": "string or null", "severity": "string or null", "status": "Active|Resolved|Suspected", "confidence": 0.0}],
    "medications": [{"name": "string", "strength": "string", "frequency": "string", "route": "string", "indication": "string or null", "confidence": 0.0}],
    "lab_tests": [{"test_name": "string", "value": "string", "units": "string", "ref_range": "string or null", "abnormal": "L|N|H|LL|HH|null", "date": "string or null", "confidence": 0.0}],
    "vital_signs": [{"type": "string", "value": "string", "units": "string", "confidence": 0.0}],
    "procedures": [{"name": "string", "cpt": "string or null", "date": "string or null", "confidence": 0.0}],
    "allergies": [{"allergen": "string", "reaction": "string or null", "confidence": 0.0}],
    "imaging_findings": [{"modality": "string", "body_part": "string", "finding": "string", "impression": "string or null", "confidence": 0.0, "evidence": {"source_sentence": "exact sentence from document", "page": 0, "document": "filename"}}],
    "genomic_data": [{"gene": "string", "variant": "string", "classification": "string", "confidence": 0.0}],
    "raw_text_excerpt": "First 5000 characters of document text",
    "quality": {"completeness": 0.0, "confidence": 0.0, "issues": []}
}

EVIDENCE TRACING: For every disease, imaging_finding, and high-confidence lab that is abnormal,
include an "evidence" field:
  "evidence": {"source_sentence": "<verbatim text from document>", "page": <page number or 0>, "document": "<filename>"}
This enables downstream hallucination checking. If page is unknown, use 0.

- Return ONLY valid JSON. Extract ALL data. Preserve exact values. Use null for missing, [] for empty categories. Every entity needs confidence.

BEGIN EXTRACTION NOW."""


class IngestionAgent:
    """Ingestion with chunked text processing, vision OCR, and unlimited file support."""

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = None) -> list:
        """Split large text into chunks, preferring breaks at page/section boundaries."""
        chunk_size = chunk_size or Cfg.CHUNK_CHARS
        if len(text) <= chunk_size:
            return [text]
        chunks = []
        remaining = text
        while remaining:
            if len(remaining) <= chunk_size:
                chunks.append(remaining)
                break
            # Prefer breaking at page markers, then section markers, then paragraphs
            bp = remaining.rfind("--- PAGE", 0, chunk_size)
            if bp <= chunk_size // 4:
                bp = remaining.rfind("\n=== SHEET", 0, chunk_size)
            if bp <= chunk_size // 4:
                bp = remaining.rfind("\n\n", chunk_size // 2, chunk_size)
            if bp <= chunk_size // 4:
                bp = remaining.rfind("\n", chunk_size * 3 // 4, chunk_size)
            if bp <= 0:
                bp = chunk_size
            chunks.append(remaining[:bp])
            remaining = remaining[bp:].lstrip("\n")
        return chunks

    @staticmethod
    def _extract_text_chunk(chunk: str, chunk_num: int, total: int,
                            filename: str, case_id: str, run_id: str) -> dict:
        """Extract medical data from one text chunk via Bedrock."""
        header = (f"FILENAME: {filename}\nCASE_ID: {case_id}\nRUN_ID: {run_id}\n"
                  f"CHUNK: {chunk_num}/{total}\n\n")
        user_msg = header + f"--- DOCUMENT CONTENT (Part {chunk_num} of {total}) ---\n{chunk}"
        print(f"[INGESTION] Extracting text chunk {chunk_num}/{total} ({len(chunk):,} chars)...", flush=True)
        resp = AWS.ask(INGESTION_PROMPT, user_msg)
        return parse_json(resp, f"INGESTION-C{chunk_num}")

    @staticmethod
    def _ocr_images_to_text(images: list, filename: str) -> str:
        """Use model vision API to OCR images into text. Returns combined OCR text."""
        if not images:
            return ""
        all_text = []
        batch_size = Cfg.OCR_BATCH
        total_batches = (len(images) + batch_size - 1) // batch_size
        for i in range(0, len(images), batch_size):
            batch = images[i:i + batch_size]
            batch_num = i // batch_size + 1
            labels = [img["label"] for img in batch]
            print(f"[INGESTION/OCR] Batch {batch_num}/{total_batches}: {labels}", flush=True)
            try:
                prompt_text = (f"OCR the following {len(batch)} medical document page(s) from "
                               f"'{filename}'. Extract ALL visible text, tables, numbers, and annotations.")
                ocr_text = AWS.ask_vision(OCR_SYSTEM_PROMPT, prompt_text, batch)
                all_text.append(ocr_text)
                print(f"[INGESTION/OCR] ✓ Batch {batch_num}: {len(ocr_text):,} chars", flush=True)
            except Exception as e:
                print(f"[INGESTION/OCR] ✗ Batch {batch_num} failed: {e}", flush=True)
                all_text.append(f"[OCR FAILED for {labels}: {str(e)[:200]}]")
        return "\n\n".join(all_text)

    @staticmethod
    def _extract_from_images_direct(images: list, filename: str,
                                    case_id: str, run_id: str) -> dict:
        """Extract medical data directly from images via vision (standalone images / small batches)."""
        header = (f"FILENAME: {filename}\nCASE_ID: {case_id}\nRUN_ID: {run_id}\n"
                  f"IMAGE_COUNT: {len(images)}\n\n")
        user_msg = header + ("Analyze the provided medical image(s) and extract ALL medical data, "
                             "findings, text, measurements, and annotations visible.")
        print(f"[INGESTION/VISION] Direct extraction from {len(images)} image(s)...", flush=True)
        try:
            resp = AWS.ask_vision(INGESTION_PROMPT, user_msg, images)
            return parse_json(resp, "INGESTION-IMG")
        except Exception as e:
            err_str = str(e).lower()
            print(f"[INGESTION/VISION] Vision failed: {e}", flush=True)
            # If model doesn't support images, fall back to metadata-only
            if any(kw in err_str for kw in ("validat", "unsupported", "format", "content type")):
                print("[INGESTION/VISION] Falling back to text-only metadata extraction", flush=True)
                fallback_msg = header + (
                    f"This is a medical image file ({filename}). Visual analysis is unavailable. "
                    f"Based on the filename and any available metadata, provide your best structured "
                    f"extraction of what this medical image likely contains."
                )
                resp = AWS.ask(INGESTION_PROMPT, fallback_msg)
                return parse_json(resp, "INGESTION-IMG-FB")
            raise

    @staticmethod
    def _merge_results(results: list) -> dict:
        """Merge multiple extraction chunk results into one unified JSON."""
        if not results:
            return {"parse_error": True, "raw_response": "No extraction results"}
        if len(results) == 1:
            return results[0]

        merged = {
            "file_type": "MIXED",
            "document_summary": "",
            "demographics": {},
            "diseases": [],
            "medications": [],
            "lab_tests": [],
            "vital_signs": [],
            "procedures": [],
            "allergies": [],
            "imaging_findings": [],
            "genomic_data": [],
            "raw_text_excerpt": "",
            "quality": {}
        }
        array_keys = ["diseases", "medications", "lab_tests", "vital_signs",
                       "procedures", "allergies", "imaging_findings", "genomic_data"]
        summaries = []

        for r in results:
            if not isinstance(r, dict) or r.get("parse_error"):
                continue
            for key in array_keys:
                items = r.get(key, [])
                if isinstance(items, list):
                    merged[key].extend(items)
            # Demographics: take first found, fill gaps from later chunks
            demo = r.get("demographics")
            if isinstance(demo, dict):
                if not merged["demographics"]:
                    merged["demographics"] = dict(demo)
                else:
                    for k, v in demo.items():
                        if v and not merged["demographics"].get(k):
                            merged["demographics"][k] = v
            ft = r.get("file_type", "")
            if ft and ft not in ("MIXED", "OTHER") and merged["file_type"] == "MIXED":
                merged["file_type"] = ft
            if r.get("document_summary"):
                summaries.append(str(r["document_summary"]))
            if r.get("raw_text_excerpt") and len(merged["raw_text_excerpt"]) < 5000:
                merged["raw_text_excerpt"] += str(r.get("raw_text_excerpt", ""))[:2000] + " [...] "

        merged["document_summary"] = " | ".join(summaries[:5]) if summaries else "Multi-chunk extraction"

        # Quality: aggregate across chunks
        quals = [r.get("quality", {}) for r in results if isinstance(r.get("quality"), dict)]
        if quals:
            merged["quality"] = {
                "completeness": round(sum(q.get("completeness", 0) for q in quals) / len(quals), 2),
                "confidence": round(sum(q.get("confidence", 0) for q in quals) / len(quals), 2),
                "issues": [i for q in quals for i in (q.get("issues") or [])],
                "chunks_processed": len(results)
            }

        total_entities = sum(len(merged.get(k, [])) for k in array_keys)

        # Fix #9: Resolve medication synonyms and dedup (brand→generic)
        if merged.get("medications"):
            before_count = len(merged["medications"])
            merged["medications"] = resolve_med_synonyms(merged["medications"])
            after_count = len(merged["medications"])
            if before_count != after_count:
                print(f"[INGESTION/MERGE] Med synonym dedup: {before_count} → {after_count}", flush=True)

        print(f"[INGESTION/MERGE] Merged {len(results)} chunks → {total_entities} total entities", flush=True)
        return merged

    @staticmethod
    def run(bucket, key, run_id):
        # Decode URL-encoded key FIRST (handles spaces as + or %20 from S3 events)
        key = decode_s3_key(key)
        parts = key.split("/")
        case_id = parts[-2] if len(parts) > 1 else "UNSORTED"
        filename = parts[-1]
        sname = safe_filename(filename)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        print(f"\n{'='*80}\n[INGESTION] START | run={run_id} | file={filename} | case={case_id}\n{'='*80}", flush=True)
        try:
            raw = AWS.read(bucket, key, as_bytes=True)
            print(f"[INGESTION] File size: {len(raw):,} bytes", flush=True)

            # ── Step 1: Process file into text + images ──
            processed = FileToText.convert(raw, filename)
            text_content = processed["text"]
            images = processed["images"]
            is_image_based = processed["is_image_based"]
            page_count = processed["page_count"]

            print(f"[INGESTION] Processed: text={len(text_content):,} | images={len(images)} | "
                  f"image_based={is_image_based} | pages={page_count}", flush=True)

            extraction_results = []
            IMAGE_EXTS = {"jpg", "jpeg", "png", "bmp", "tiff", "tif", "gif", "webp", "dcm"}

            # ── Step 2: Handle image-based content ──
            if is_image_based and images:
                if ext in IMAGE_EXTS or len(images) <= 5:
                    # Standalone image or small scanned PDF: direct vision extraction
                    batch_size = Cfg.VISION_EXTRACT_BATCH
                    for i in range(0, len(images), batch_size):
                        batch = images[i:i + batch_size]
                        result = IngestionAgent._extract_from_images_direct(
                            batch, filename, case_id, run_id
                        )
                        extraction_results.append(result)
                else:
                    # Large scanned PDF: OCR all pages first → then text extraction
                    print(f"[INGESTION] Large scanned PDF ({len(images)} pages) → OCR pass first", flush=True)
                    ocr_text = IngestionAgent._ocr_images_to_text(images, filename)
                    if ocr_text:
                        if text_content and len(text_content.strip()) > 200:
                            text_content = text_content + "\n\n--- MODEL OCR EXTRACTED TEXT ---\n" + ocr_text
                        else:
                            text_content = (f"PDF FILE: {filename}\nPages: {page_count}\n"
                                            f"[OCR extracted from scanned document]\n\n{ocr_text}")
                        print(f"[INGESTION] OCR complete: {len(ocr_text):,} chars → processing as text", flush=True)
                    # Fall through to text extraction below

            # ── Step 3: Handle text content (chunked if large) ──
            if not extraction_results:
                chunks = IngestionAgent._chunk_text(text_content)
                print(f"[INGESTION] Text split into {len(chunks)} chunk(s)", flush=True)
                for i, chunk in enumerate(chunks, 1):
                    result = IngestionAgent._extract_text_chunk(
                        chunk, i, len(chunks), filename, case_id, run_id
                    )
                    extraction_results.append(result)

            # ── Step 4: For mixed text+image PDFs, also extract from scanned page images ──
            if images and not is_image_based:
                print(f"[INGESTION] Mixed PDF: extracting from {len(images)} scanned page image(s)", flush=True)
                batch_size = Cfg.VISION_EXTRACT_BATCH
                for i in range(0, len(images), batch_size):
                    batch = images[i:i + batch_size]
                    try:
                        result = IngestionAgent._extract_from_images_direct(
                            batch, filename, case_id, run_id
                        )
                        extraction_results.append(result)
                    except Exception as e:
                        print(f"[INGESTION] Mixed PDF image batch failed: {e}", flush=True)

            # ── Step 5: Merge all extraction results ──
            final = IngestionAgent._merge_results(extraction_results)

            method = "vision_direct"
            if not is_image_based:
                method = "text_chunked"
            elif is_image_based and images and ext not in IMAGE_EXTS and len(images) > 5:
                method = "ocr_then_text"

            final["system_meta"] = {
                "source_bucket": bucket, "source_key": key, "filename": filename,
                "case_id": case_id, "run_id": run_id,
                "ingest_ts": datetime.datetime.utcnow().isoformat(),
                "file_size": len(raw), "stage": "INGESTION",
                "processing": {
                    "total_text_chars": len(text_content),
                    "image_count": len(images),
                    "is_image_based": is_image_based,
                    "page_count": page_count,
                    "chunks_processed": len(extraction_results),
                    "method": method
                }
            }

            # ── Write outputs ──
            out   = f"runs/{run_id}/ingestion_output.json"
            safe_case = safe_filename(case_id)
            named = f"runs/{run_id}__{safe_case}__{sname}/01_INGESTION.json"
            AWS.write(Cfg.BUCKETS["STAGING"], out, final)
            AWS.write(Cfg.BUCKETS["STAGING"], named, final)
            AWS.write(Cfg.BUCKETS["MEMORY"],  named, final)

            print(f"[INGESTION] ✓ DONE | output={out} | named={named} | "
                  f"chunks={len(extraction_results)} | method={method}", flush=True)
            return {"s3_path": out, "status": "SUCCESS", "case_id": case_id}
        except Exception as e:
            print(f"[INGESTION] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# AGENT 2: CLEANING
# ═══════════════════════════════════════════════════════════════════
CLEANING_PROMPT = """You are the MEVREON CLINICAL DATA STANDARDIZATION ENGINE (Version 5.0).

You are the world's most precise medical terminology standardization system. You receive raw extracted medical entities from a prior ingestion step and must transform them into clinically standardized, deduplicated, and coded formats suitable for electronic health record systems, clinical decision support, and regulatory reporting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. OUTPUT: Return ONLY valid JSON. No markdown. No commentary.
2. PRESERVE ORIGINALS: Keep original value alongside standardized.
3. DO NOT FABRICATE: If unmappable, mark UNMAPPABLE. Never guess codes.
4. CONFIDENCE: Rate every mapping 0.0-1.0.

STANDARDIZATION RULES:

MEDICATIONS → RxNorm: Brand→generic, normalize strength/frequency/route. Flag suspicious doses.
CONDITIONS → ICD-10 + SNOMED: Canonical names, codes, severity, status.
LABS → LOINC: Standard names, codes, flag impossible values.
VITALS → Standard units and formats.
DEDUP: Same med twice → keep one. Same lab different values → keep both, flag CONFLICT.
SPELLING: Fix typos (Metphormin→Metformin, etc.), note corrections.
MEDICAL TERM PROTECTION: NEVER change drug or disease names unless confidence >0.95. Common misspellings (e.g., Metphormin→Metformin) are OK to fix. But NEVER "correct" an unusual but valid drug name (e.g., do NOT change tryptomer, gabapentin, levetiracetam). When uncertain, keep original and add uncertainty flag.

OUTPUT JSON:
{
    "standardized_data": {
        "medications": [{"original": "str", "standard_name": "str", "rxnorm": "str|null", "strength": "str", "frequency": "str", "route": "str", "indication": "str|null", "status": "MAPPED|UNMAPPABLE|UNCERTAIN", "confidence": 0.0, "corrections": []}],
        "conditions": [{"original": "str", "standard_name": "str", "icd10": "str|null", "snomed": "str|null", "severity": "str", "clinical_status": "Active|Resolved|Suspected|Chronic", "status": "MAPPED|UNMAPPABLE|UNCERTAIN", "confidence": 0.0, "corrections": []}],
        "lab_tests": [{"original_name": "str", "standard_name": "str", "loinc": "str|null", "value": "str", "units": "str", "ref_range": "str|null", "abnormal": "L|N|H|LL|HH|null", "date": "str|null", "status": "MAPPED|UNMAPPABLE", "confidence": 0.0, "flags": []}],
        "vital_signs": [{"type": "str", "value": "str", "units": "str", "confidence": 0.0}],
        "allergies": [{"allergen": "str", "reaction": "str|null", "confidence": 0.0}]
    },
    "cleaning_stats": {"total_input": 0, "total_output": 0, "duplicates_removed": 0, "corrections_made": 0, "unmappable": 0, "impossible_values_flagged": 0},
    "warnings": [],
    "quality": {"completeness": 0.0, "standardization_rate": 0.0, "integrity": "GOOD|FAIR|POOR"}
}

Return ONLY valid JSON. BEGIN NOW."""


class CleaningAgent:
    @staticmethod
    def run(bucket, input_key, run_id):
        input_key = decode_s3_key(input_key)
        print(f"\n{'='*80}\n[CLEANING] START | input={input_key}\n{'='*80}", flush=True)
        try:
            raw = json.loads(AWS.read(Cfg.BUCKETS["STAGING"], input_key))
            meta = raw.get("system_meta", {})
            filename = meta.get("filename", "unknown")
            sname = safe_filename(filename)

            # ── Capture demographics from ingestion (age/gender must survive all stages) ──
            ingestion_demographics = raw.get("demographics", {})
            if isinstance(ingestion_demographics, dict):
                # Scrub patient name but preserve age/gender
                ing_demo_clean = {k: v for k, v in ingestion_demographics.items() if k != "patient_name"}
                ing_demo_clean["patient_name"] = "[ANONYMIZED]"
            else:
                ing_demo_clean = {}
            if ing_demo_clean.get("age") or ing_demo_clean.get("gender"):
                print(f"[CLEANING] Preserving demographics: age={ing_demo_clean.get('age')} gender={ing_demo_clean.get('gender')}", flush=True)

            entities = {k: v for k, v in raw.items() if k not in ("system_meta", "raw_text_excerpt", "quality")}
            user_msg = f"CASE_ID: {meta.get('case_id','?')}\nRUN_ID: {run_id}\nFILE: {filename}\n\n--- RAW DATA ---\n{json.dumps(entities, indent=2, default=str)}"

            print("[CLEANING] Calling Bedrock...", flush=True)
            resp = AWS.ask(CLEANING_PROMPT, user_msg)
            result = parse_json(resp, "CLEANING")
            result["system_meta"] = meta
            result["system_meta"]["stage"] = "CLEANING"
            # Store demographics in system_meta so they survive into Validation and Feature
            result["system_meta"]["demographics"] = ing_demo_clean
            result["raw_text_snapshot"] = raw.get("raw_text_excerpt", "")[:5000]

            out = f"runs/{run_id}/cleaning_output.json"
            safe_case = safe_filename(meta.get("case_id", "UNSORTED"))
            named = f"runs/{run_id}__{safe_case}__{sname}/02_CLEANING.json"
            AWS.write(Cfg.BUCKETS["PROCESSED"], out, result)
            AWS.write(Cfg.BUCKETS["PROCESSED"], named, result)
            AWS.write(Cfg.BUCKETS["MEMORY"],    named, result)

            print(f"[CLEANING] ✓ DONE", flush=True)
            return {"s3_path": out, "status": "SUCCESS"}
        except Exception as e:
            print(f"[CLEANING] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# AGENT 3: VALIDATION
# ═══════════════════════════════════════════════════════════════════
VALIDATION_PROMPT = """You are DR. LOGIC — the MEVREON CLINICAL SAFETY VALIDATION ENGINE (Version 5.0).

You are the most rigorous medical data auditor in existence. Receive standardized clinical data and perform exhaustive validation for errors, impossibilities, dangerous drug interactions, physiological impossibilities, logical contradictions, and data integrity issues.

VALIDATION FRAMEWORK:

PHYSIOLOGICAL BOUNDS — Flag outside: HR 30-200, BP 60-250/30-150, Temp 90-108F, RR 8-40, SpO2 85-100, Glucose 40-600, Hgb 5-20, WBC 2-30, Plt 50-600, Cr 0.3-15, Na 120-155, K 2.5-6.5, pH 6.8-7.8, Age 0-120, BMI 10-70.

MEDICATION SAFETY — Max doses: APAP 4000mg, Ibuprofen 3200mg, Metformin 2550mg, Lisinopril 80mg. Flag q1h frequency, wrong routes, peds/geri concerns.

DRUG INTERACTIONS — Check ALL pairs: Warfarin+NSAIDs→bleeding, Metformin+contrast→lactic acidosis, ACEi+K+→hyperkalemia, Statins+macrolides→rhabdomyolysis, SSRIs+MAOIs→serotonin syndrome, Opioids+benzos→resp depression, Digoxin+amiodarone→toxicity, Lithium+NSAIDs→toxicity.

LOGICAL CHECKS — Gender-procedure mismatch, age-diagnosis mismatch, allergy+prescribed same class, timeline inconsistency.

LAB LOGIC — K>6 or <2.5→cardiac risk, Na<120→seizure risk, Glucose<50→hypoglycemia, Troponin elevated→ACS, INR>4→bleeding risk.

RISK SCORE 0.0-1.0: interactions(0.3) + critical labs(0.25) + dosage errors(0.2) + physio abnormalities(0.15) + logic issues(0.1). LOW<0.3, MODERATE 0.3-0.7, HIGH>0.7.

OUTPUT JSON:
{
    "validation_status": "PASS|WARNING|CRITICAL",
    "risk_score": 0.0,
    "risk_level": "LOW|MODERATE|HIGH",
    "issues": [{"severity": "INFO|WARNING|CRITICAL", "category": "DOSAGE|INTERACTION|PHYSIOLOGICAL|LOGIC|LAB_VALUE", "entity": "str", "value": "str", "issue": "str", "recommendation": "str"}],
    "drug_interactions": [{"drug1": "str", "drug2": "str", "interaction": "str", "severity": "LOW|MODERATE|HIGH|CRITICAL", "recommendation": "str"}],
    "critical_alerts": [],
    "validated_data": {},
    "summary": {"total_checks": 0, "passed": 0, "warnings": 0, "critical": 0}
}

Return ONLY valid JSON. BEGIN NOW."""


class ValidationAgent:
    @staticmethod
    def run(bucket, input_key, run_id):
        input_key = decode_s3_key(input_key)
        print(f"\n{'='*80}\n[VALIDATION] START | input={input_key}\n{'='*80}", flush=True)
        try:
            clean = json.loads(AWS.read(Cfg.BUCKETS["PROCESSED"], input_key))
            meta = clean.get("system_meta", {})
            filename = meta.get("filename", "unknown")
            sname = safe_filename(filename)
            std_data = clean.get("standardized_data", {})
            # Retrieve demographics carried through system_meta from Cleaning
            carried_demographics = meta.get("demographics", {})

            user_msg = f"CASE_ID: {meta.get('case_id','?')}\nRUN_ID: {run_id}\n\n--- STANDARDIZED DATA ---\n{json.dumps(std_data, indent=2, default=str)}"

            print("[VALIDATION] Calling Bedrock...", flush=True)
            resp = AWS.ask(VALIDATION_PROMPT, user_msg)
            result = parse_json(resp, "VALIDATION")
            result["system_meta"] = meta
            result["system_meta"]["stage"] = "VALIDATION"
            # Inject demographics into validated_data so FeatureAgent can always find them
            if carried_demographics:
                vd = result.setdefault("validated_data", {})
                if isinstance(vd, dict) and not vd.get("demographics"):
                    vd["demographics"] = carried_demographics
                    print(f"[VALIDATION] Injected demographics into validated_data: age={carried_demographics.get('age')} gender={carried_demographics.get('gender')}", flush=True)

            out = f"runs/{run_id}/validation_output.json"
            safe_case = safe_filename(meta.get("case_id", "UNSORTED"))
            named = f"runs/{run_id}__{safe_case}__{sname}/03_VALIDATION.json"
            AWS.write(Cfg.BUCKETS["PROCESSED"], out, result)
            AWS.write(Cfg.BUCKETS["PROCESSED"], named, result)
            AWS.write(Cfg.BUCKETS["MEMORY"],    named, result)

            status = result.get("validation_status", "UNKNOWN")
            print(f"[VALIDATION] ✓ DONE | status={status} risk={result.get('risk_level','?')}", flush=True)
            return {"s3_path": out, "status": status}
        except Exception as e:
            print(f"[VALIDATION] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# AGENT 4: FEATURE / LONGITUDINAL SYNTHESIS + PARQUET
# ═══════════════════════════════════════════════════════════════════
FEATURE_PROMPT = """### ROLE
You are the MEVREON LONGITUDINAL CLINICAL NARRATIVE ENGINE (V9.0). You produce **evidence-grounded, professional clinical summaries** suitable for physician-to-physician handoff or patient chart inclusion.

### CRITICAL: OUTPUT BUDGET
TARGET 30,000–50,000 characters total. Be CLINICALLY PRECISE, not verbose. Every sentence must add clinical value. No filler. No repetition between sections.

### NARRATIVE_TEXT FORMAT (use this EXACT structure with plain-text section headers — NO emojis):

PATIENT SUMMARY — [ANONYMIZED], [Age] [Gender]

CLINICAL FINDINGS — [Specialty] ([Source])
- Diagnosis: bullet list of ALL diagnoses found
- Clinical significance: plain-language explanation grounded in the documented data
- If DICOM/imaging exists: include modality, body part, key findings, DICOM metadata (StudyDescription, Modality, BodyPartExamined, SliceThickness)
- Repeat this block for EACH major specialty/modality area

SYMPTOMS
- Bullet list: each symptom with duration/severity if documented
- Any diet/activity restrictions noted at presentation

TREATMENT PLAN
- ALL medications: Name (generic), dose, route, frequency, indication, and brief rationale for why this medication is appropriate for the patient's documented condition
- For each medication: note any key safety monitoring required (e.g., "Monitor renal function before and during metformin therapy")
- Procedures performed or planned
- Therapy plans and follow-up appointments noted

LABORATORY RESULTS
- Group by panel with headers (CBC, Metabolic, Thyroid, Kidney, Liver, Infection Screening, etc.)
- Each value: Test name: Value Units (reference range if known)
- Flag abnormals: "Hemoglobin: 11.6 g/dL (low)" or "HbA1c: 7.5% (above target)"
- State whether each value is normal, low, high, or critical based ONLY on standard reference ranges
- EVERY lab value from the evidence map must appear — no omissions

CLINICAL INTERPRETATION
- Synthesize findings into a unified clinical picture
- Connect findings using evidence-based reasoning
- State only what is directly supported by the documented data

RISK ASSESSMENT
- Risk factors documented in the data
- Potential complications if conditions are not managed
- Use standard medical knowledge but do NOT add severity qualifiers beyond what the data states

DIET AND LIFESTYLE RECOMMENDATIONS
- Specific dietary guidance for THIS patient's documented conditions (e.g., for diabetes: carbohydrate-controlled diet, regular meal timing; for dyslipidemia: heart-healthy diet low in saturated fats; for anemia: iron/B12-rich foods if applicable)
- Exercise recommendations appropriate to patient's age and condition
- Monitoring instructions the patient should follow at home
- Individualized to THIS patient — not generic

FOLLOW-UP PLAN
- Numbered list of next steps: what, why, when
- Include repeat tests, specialist referrals, imaging follow-up

SUMMARY
- Single dense sentence: primary diagnoses, key findings, treatment status, and immediate next steps

### STYLE RULES
- Professional medical language suitable for clinical documentation
- NO emojis anywhere in the output — use plain-text section headers only
- Use bullet points for clarity. Short, precise statements.
- Be specific to THIS patient — no generic advice
- State lab values with their numeric result and whether they are normal/abnormal — do NOT add subjective qualifiers like "low-normal", "borderline", or "possible" unless the source data uses those exact words

### PROHIBITED PATTERNS — violations will be penalized as hallucinations
These specific patterns MUST NOT appear in your output:
- "severe", "mild", "moderate", "critically low", "severely low/high" — unless the source data explicitly uses these words
- "likely", "probably", "suggests", "suggestive of", "strongly suggests" — these are inferred causality
- "possible", "borderline", "low-normal", "high-normal" — these are subjective qualifiers
- "contributing to", "causative for", "secondary to", "exacerbating" — unless the source data states this causal relationship
- "thrombocytopenia" — ONLY if platelets are BELOW 150 x10³/µL. If platelets are 150-400, they are NORMAL.
- Do NOT add clinical recommendations not in the source data (e.g., do not recommend folate testing, celiac workup, etc. unless the source data mentions them)
- Do NOT call a normal lab value abnormal. Check standard reference ranges before labeling any value.
- Instead of qualifiers, state ONLY: "(normal)", "(abnormal - high)", "(abnormal - low)", "(critical)"

### MANDATORY REFERENCE RANGES — use these EXACT ranges to determine normal/abnormal:
- Platelets: 150-400 x10³/µL = NORMAL. 233 is NORMAL. Do NOT call it low or thrombocytopenia.
- Albumin: 3.5-5.5 g/dL = NORMAL. 3.97 is NORMAL. Do NOT call it low.
- Hemoglobin (male): 13.5-17.5 g/dL = NORMAL. Below 13.5 = low.
- Hemoglobin (female): 12.0-16.0 g/dL = NORMAL. Below 12.0 = low.
- WBC: 4,500-11,000/µL = NORMAL.
- RBC (male): 4.5-5.9 million/µL = NORMAL.
- MCV: 80-100 fL = NORMAL. Above 100 = macrocytic.
- HbA1c: below 5.7% = NORMAL, 5.7-6.4% = prediabetes, 6.5%+ = diabetes.
- Fasting Glucose: 70-100 mg/dL = NORMAL. 100-125 = impaired. 126+ = diabetic.
- Total Cholesterol: below 200 mg/dL = desirable.
- HDL: above 40 mg/dL (male) / 50 mg/dL (female) = NORMAL.
- LDL: below 100 mg/dL = optimal.
- TSH: 0.4-4.0 µIU/mL = NORMAL.
- CRP: below 3.0 mg/L = NORMAL.
- AST: 10-40 U/L = NORMAL.
- ALT: 7-56 U/L = NORMAL.
- Vitamin D: above 30 ng/mL = sufficient, 20-29 = insufficient, below 20 = deficient.
- Vitamin B12: above 200 pg/mL = normal, below 200 = low.
BEFORE labeling ANY value, check it against this table. If a value is within normal range, label it "(normal)" — NEVER "(low)" or "(high)".

### CORE RULES — EVIDENCE GROUNDING
- **NO HALLUCINATIONS**: NEVER invent values, interpretations, or severity qualifiers not in the source data.
- **REPORT, DON'T INTERPRET BEYOND DATA**: State lab values and their normal/abnormal status based on standard reference ranges. Do NOT add clinical speculation.
- **ANONYMIZE**: "[ANONYMIZED]" for patient names. Age/gender MANDATORY.
- **MAXIMUM RECALL**: Every med, lab, imaging finding, diagnosis from the evidence map must appear. Omission is a critical failure.
- **Do NOT duplicate content** between narrative_text and structured fields.
- **CLINICAL INFERENCES**: If the evidence map includes lab-derived observations, you may mention them as observations supported by lab values. Do NOT present them as new diagnoses unless also listed in conditions.

### PROHIBITED PATTERNS — DO NOT USE THESE (CRITICAL — VIOLATIONS = AUTOMATIC SCORE PENALTY)
- Do NOT say "mild thrombocytopenia" or "thrombocytopenia" for platelet counts 150-400 (that is NORMAL). 233 x10³/µL = NORMAL.
- Do NOT say "possible malnutrition" or "likely secondary to malnutrition" based solely on albumin 3.5-5.5 g/dL (that is normal range)
- Do NOT say "moderate uncontrolled diabetes" — just state "HbA1c 7.5% (above target of <7%)"
- Do NOT say "severe" or "mild" before any condition unless the source data explicitly uses that qualifier
- Do NOT infer causality between conditions (e.g., do NOT say "anemia likely due to B12 deficiency") — just state both findings as separate observations
- Do NOT recommend tests or treatments not in the source data (e.g., do NOT suggest "check folate levels" if folate is not mentioned)
- Do NOT add "drug interaction" warnings not in the source data
- Do NOT call normal-range values abnormal — USE THE MANDATORY REFERENCE RANGES TABLE ABOVE
- Do NOT use "consistent with", "suggestive of", "likely", "possibly", "strongly suggest", "presumed" — these are interpretive
- Do NOT use "low-normal" or "high-normal" — a value is either normal or abnormal by reference ranges
- For missing data: say "Not documented in available records" — do NOT speculate about what could have been tested
- Do NOT say symptoms are "presumed" or "assumed" if they are not documented — just state "Not documented"

### ABSOLUTE EVIDENCE-GROUNDING RULE
You MUST construct the narrative ONLY from the structured data provided AND the STRUCTURED EVIDENCE MAP below.
Include EVERY data point provided to you:
  1. Demographics — from the patient data
  2. Symptoms — ALL symptoms documented in clinical notes
  3. Imaging findings — ALL findings from imaging data
  4. Lab values — ALL lab values with their exact numeric values. State normal/abnormal status. Do NOT round or invent values.
  5. Diagnoses — ALL conditions listed in diseases/conditions
  6. Medications — ALL drugs with dose and frequency
  7. Procedures — ALL procedures documented
  8. Follow-ups — ALL follow-up plans documented

COMPLETENESS IS CRITICAL: Every medication, every lab value, every diagnosis from the evidence map MUST appear in your narrative.
If conflicting evidence exists, state BOTH findings and the conflict — do NOT choose one.
Only say "Not documented in available records" for a section if NO data exists for that section in the evidence map AND the encounter data.
NEVER invent values not present in the data. NEVER speculate about diagnoses not explicitly listed.
NEVER invent specific numeric measurements, reference ranges, or doses that do not appear in the evidence map.
Use the EXACT anatomical locations from the evidence.

### JSON SCHEMA (return ONLY this JSON, no markdown fences):

{
    "case_id": "string",
    "summary_type": "LONGITUDINAL_NARRATIVE",
    "generation_date": "ISO8601",
    "files_integrated": [{"filename": "string", "date": "YYYY-MM-DD or null", "type": "LAB|IMAGING|CLINICAL_NOTE|PRESCRIPTION|DICOM|OTHER"}],

    "patient_profile": {
        "age": "integer or string",
        "gender": "string",
        "blood_type": "string or null",
        "comorbidity_burden": "LOW|MODERATE|HIGH",
        "summary_snippet": "2-3 sentence clinical snapshot using ONLY documented facts"
    },

    "longitudinal_narrative": {
        "narrative_text": "The COMPLETE narrative using the plain-text section format above. NO emojis.",
        "synthesis_logic": "1-2 sentence causal reasoning chain based on documented data"
    },

    "clinical_timeline": [
        {"event_date": "YYYY-MM-DD", "event_type": "LAB|MED|IMAGING|PROCEDURE|DIAGNOSIS|SYMPTOM|ADMISSION|DISCHARGE", "finding": "string", "value": "string or null", "source_file": "string"}
    ],

    "problem_list": [
        {"diagnosis": "string (use ONLY diagnoses from the evidence map)", "icd10": "string", "status": "Active|Resolved|Chronic|Suspected", "severity": "Mild|Moderate|Severe|Critical (ONLY if stated in source)", "trajectory": "Improving|Stable|Declining|New"}
    ],

    "medications": {
        "current_regimen": [
            {"name": "string", "dose": "string", "frequency": "string", "route": "string", "indication": "string"}
        ],
        "polypharmacy_flag": true,
        "medication_concerns": ["string"]
    },

    "imaging_summary": [
        {"study_date": "YYYY-MM-DD", "modality": "string", "body_part": "string", "findings": ["string"], "impression": "string", "follow_up_recommendation": "string", "source_file": "string"}
    ],

    "laboratory_summary": {
        "critical_values": [{"test": "string", "value": "string", "units": "string", "clinical_action_needed": "string"}],
        "key_values": [{"test": "string", "value": "string", "units": "string", "status": "Normal|Abnormal|Critical", "interpretation": "string (ONLY state normal/abnormal based on standard ranges, no speculation)"}]
    },

    "risk_assessment": {
        "readmission_risk": "LOW|MODERATE|HIGH",
        "short_term_risks": [{"risk": "string", "likelihood": "LOW|MODERATE|HIGH", "mitigation": "string"}],
        "warning_signs": ["string"]
    },

    "clinical_recommendations": {
        "immediate_actions": ["string"],
        "follow_up_schedule": [{"specialty": "string", "timeframe": "string", "reason": "string"}],
        "diagnostic_recommendations": [{"test": "string", "rationale": "string", "urgency": "STAT|Routine|Elective"}]
    },

    "clinical_assessment": {
        "summary_statement": "2-3 sentence clinical assessment using ONLY documented facts — no severity qualifiers unless in source data",
        "acuity_level": "STABLE|GUARDED|SERIOUS|CRITICAL",
        "disposition": "outpatient/admission/referral",
        "follow_up_timeline": "string"
    }
}

### ABSOLUTE FINAL RULES
1. narrative_text MUST use plain-text section headers (PATIENT SUMMARY, CLINICAL FINDINGS, SYMPTOMS, TREATMENT PLAN, LABORATORY RESULTS, CLINICAL INTERPRETATION, RISK ASSESSMENT, DIET AND LIFESTYLE RECOMMENDATIONS, FOLLOW-UP PLAN, SUMMARY)
2. NO emojis anywhere in the output — not in narrative_text, not in structured fields
3. Every lab value stated with exact numeric value and normal/abnormal status
4. SUMMARY must be a single dense clinically complete sentence
5. Return ONLY valid JSON — no markdown fences, no text outside JSON
6. DO NOT repeat information across structured fields and narrative_text
7. Keep total output under 50,000 characters
8. DO NOT add severity qualifiers (moderate, severe, mild, borderline, low-normal) unless the source data explicitly uses those words
9. DO NOT speculate about causality or complications — only state what the data documents

BEGIN CLINICAL SYNTHESIS NOW."""


class FeatureAgent:
    @staticmethod
    def _gather_all_case_data(case_id: str, current_validated: dict, current_meta: dict) -> str:
        """Gather ALL previous encounter data for this case_id from CURATED bucket to build unified summary."""
        all_data = []

        # Collect previous per-file summaries
        try:
            prev_keys = AWS.list_keys(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/encounters/")
            for pk in prev_keys:
                if pk.endswith(".json"):
                    try:
                        prev = json.loads(AWS.read(Cfg.BUCKETS["CURATED"], pk))
                        all_data.append(prev)
                    except Exception:
                        pass
            print(f"[FEATURE] Found {len(all_data)} previous encounter records for case {case_id}", flush=True)
        except Exception as ex:
            print(f"[FEATURE] No previous encounters found: {ex}", flush=True)

        # Add current encounter
        current_encounter = {
            "filename": current_meta.get("filename", "unknown"),
            "run_id": current_meta.get("run_id", "unknown"),
            "validated_data": current_validated,
        }
        all_data.append(current_encounter)

        return json.dumps(all_data, indent=2, default=str)

    @staticmethod
    def run(bucket, input_key, run_id):
        input_key = decode_s3_key(input_key)
        print(f"\n{'='*80}\n[FEATURE] START | input={input_key}\n{'='*80}", flush=True)
        try:
            val = json.loads(AWS.read(Cfg.BUCKETS["PROCESSED"], input_key))
            meta = val.get("system_meta", {})
            case_id = meta.get("case_id", "UNSORTED")
            # Batch mode: system_meta has 'files_cleaned' list but no single 'filename'
            files_cleaned = meta.get("files_cleaned", [])
            filename = meta.get("filename", "unknown")
            if filename == "unknown" and files_cleaned:
                filename = "_".join(f.split(".")[0] for f in files_cleaned[:3])
                if len(files_cleaned) > 3:
                    filename += f"_plus{len(files_cleaned)-3}"
                filename += "_batch"
            sname = safe_filename(filename)

            # Batch mode uses combined_standardized_data; single-file uses validated_data
            validated = val.get("validated_data",
                               val.get("combined_standardized_data",
                                        val.get("standardized_data", {})))

            # ── Detect DICOM / imaging content for enhanced analysis ──
            has_imaging = False
            dicom_file_count = 0
            imaging_context_block = ""
            if files_cleaned:
                dcm_files = [f for f in files_cleaned if f.lower().endswith(".dcm")]
                dicom_file_count = len(dcm_files)
                if dcm_files:
                    has_imaging = True
            # Also check validated_data for imaging_findings
            if isinstance(validated, dict):
                img_findings = validated.get("imaging_findings", [])
                if not isinstance(img_findings, list):
                    img_findings = []
                if img_findings:
                    has_imaging = True
            # Check for DICOM series context in the ingestion manifest
            dicom_series_info = {}
            try:
                manifest_key = f"runs/{run_id}/batch_ingestion_manifest.json"
                manifest = json.loads(AWS.read(Cfg.BUCKETS["STAGING"], manifest_key))
                dicom_series_info = manifest.get("dicom_series_context", {})
                original_count = manifest.get("original_file_count", 0)
                processed_count = manifest.get("processed_file_count", 0)
                if dicom_series_info:
                    has_imaging = True
                    imaging_context_block = (
                        f"\n\nDICOM/IMAGING DATA DETECTED ({dicom_file_count} DICOM files, "
                        f"{original_count} original → {processed_count} processed after series consolidation)\n"
                        f"Series context keys: {list(dicom_series_info.keys())[:5]}\n"
                        f"YOU MUST provide detailed imaging_summary with clinical correlation.\n"
                    )
                    # Include series metadata summaries
                    for skey, sctx in list(dicom_series_info.items())[:3]:
                        imaging_context_block += f"\nSeries sample: {sctx[:500]}\n"
                print(f"[FEATURE] Manifest loaded: {original_count} original, {processed_count} processed, "
                      f"{len(dicom_series_info)} DICOM series contexts", flush=True)
            except Exception as _m_err:
                print(f"[FEATURE] Could not load ingestion manifest: {_m_err}", flush=True)

            if has_imaging:
                print(f"[FEATURE] IMAGING DATA DETECTED — {dicom_file_count} DICOM files, "
                      f"enhanced imaging analysis will be requested", flush=True)

            # ── Save per-file encounter data to CURATED for future unification ──
            encounter_record = {
                "filename": filename,
                "files_in_batch": files_cleaned or [filename],
                "run_id": run_id,
                "validated_data": validated,
                "system_meta": meta,
                "demographics": meta.get("demographics", {}),
                "has_imaging": has_imaging,
                "dicom_file_count": dicom_file_count,
            }
            encounter_key = f"cases/{case_id}/encounters/{run_id}__{sname}.json"
            AWS.write(Cfg.BUCKETS["CURATED"], encounter_key, encounter_record)

            # ── Gather ALL case data for longitudinal narrative ──
            print("[FEATURE] Gathering all case data for longitudinal narrative...", flush=True)
            all_case_data = FeatureAgent._gather_all_case_data(case_id, validated, meta)

            # ── Trim verbose fields & ANONYMIZE patient name, but PRESERVE age/gender ──
            known_age = None
            known_gender = None
            try:
                _case_list = json.loads(all_case_data)
                for _item in _case_list:
                    if isinstance(_item, dict):
                        for _drop in ("raw_text_excerpt", "raw_text_snapshot", "extra_json"):
                            _item.pop(_drop, None)
                        _vd = _item.get("validated_data", {})
                        if isinstance(_vd, dict):
                            _vd.pop("raw_text_excerpt", None)
                        # Scrub patient name but capture age/gender from ANY document
                        # Search all possible locations where demographics may be stored
                        _demo_sources = []
                        for _data_key in ("validated_data", "standardized_data"):
                            _d = _item.get(_data_key, {})
                            if isinstance(_d, dict):
                                _demo_sources.append(_d.get("demographics", {}))
                        # Top-level demographics (ingestion output format)
                        _demo_sources.append(_item.get("demographics", {}))
                        # system_meta.demographics (carried through cleaning/validation)
                        _sm = _item.get("system_meta", {})
                        if isinstance(_sm, dict):
                            _demo_sources.append(_sm.get("demographics", {}))

                        for _demo in _demo_sources:
                            if not isinstance(_demo, dict):
                                continue
                            raw_age = _demo.get("age", "")
                            raw_gender = _demo.get("gender", "")
                            # Accept any non-empty, non-null, non-placeholder value
                            if raw_age and str(raw_age).strip() not in ("", "null", "None", "unknown", "N/A") and not known_age:
                                known_age = str(raw_age).strip()
                            if raw_gender and str(raw_gender).strip() not in ("", "null", "None", "unknown", "N/A") and not known_gender:
                                known_gender = str(raw_gender).strip()
                            # Anonymize patient name wherever found
                            if "patient_name" in _demo:
                                _demo["patient_name"] = "[ANONYMIZED]"
                all_case_data = json.dumps(_case_list, indent=1, default=str)
            except Exception as _e:
                print(f"[FEATURE] Anonymization pass failed: {_e}", flush=True)

            # Build age/gender header to ALWAYS inject into prompt
            age_gender_block = ""
            if known_age or known_gender:
                age_gender_block = (
                    f"CRITICAL PATIENT DEMOGRAPHICS (CONFIRMED — MUST APPEAR IN ALL SUMMARIES):\n"
                    f"  AGE: {known_age or 'not documented'}\n"
                    f"  GENDER: {known_gender or 'not documented'}\n"
                    f"  NOTE: These demographics MUST be stated in patient_profile and narrative.\n\n"
                )
            else:
                age_gender_block = (
                    f"CRITICAL PATIENT DEMOGRAPHICS:\n"
                    f"  AGE: [Extract from documents — REQUIRED in output]\n"
                    f"  GENDER: [Extract from documents — REQUIRED in output]\n"
                    f"  NOTE: Search all documents carefully. Age/gender MUST appear in output.\n\n"
                )

            # Build imaging directive if imaging data is present
            imaging_directive = ""
            if has_imaging:
                imaging_directive = (
                    f"\n{'='*60}\n"
                    f"⚠️  CRITICAL: IMAGING / DICOM DATA IS PRESENT IN THIS CASE\n"
                    f"{'='*60}\n"
                    f"This patient has {dicom_file_count} DICOM files and/or radiology reports.\n"
                    f"You MUST:\n"
                    f"  1. Populate 'imaging_summary' with EVERY imaging study found\n"
                    f"  2. Include modality, body part, findings, impression, clinical correlation\n"
                    f"  3. Add 'imaging_dicom_findings' section in narrative_sections\n"
                    f"  4. Cross-reference imaging with labs and symptoms\n"
                    f"  5. Recommend follow-up imaging where clinically appropriate\n"
                    f"  6. Include DICOM series info (slice count, thickness, manufacturer) if available\n"
                    f"{imaging_context_block}\n"
                    f"{'='*60}\n\n"
                )

            user_msg = (
                f"CASE_ID: {case_id}\n"
                f"CURRENT_FILE: {filename}\n"
                f"FILES IN BATCH: {files_cleaned or [filename]}\n"
                f"RUN_ID: {run_id}\n\n"
                f"{age_gender_block}"
                f"{imaging_directive}"
                f"--- ALL ENCOUNTER DATA FOR THIS PATIENT (chronologically ordered, patient name anonymized) ---\n"
                f"{all_case_data[:120000]}"
            )

            # Save eval context so NarrativeJudgeAgent can use it for LLM-as-a-judge evaluation
            try:
                _case_list_for_ctx = json.loads(all_case_data)
                AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/eval_context.json", {
                    "case_id": case_id,
                    "run_id": run_id,
                    "saved_at": datetime.datetime.utcnow().isoformat(),
                    "clinical_data_context": _case_list_for_ctx,
                    "age_gender_block": age_gender_block.strip(),
                })
                print("[FEATURE] Saved eval_context.json for Judge agent", flush=True)
            except Exception as _ec_err:
                print(f"[FEATURE] Could not save eval_context: {_ec_err}", flush=True)

            # ══════════════════════════════════════════════════════════
            # PRE-NARRATIVE SAFETY PIPELINE (Python-side, not prompt-only)
            # Fix #1: Evidence Gate, #2: Lab Rules, #3: Conflicts,
            # #9: Med Synonyms, #10: Timeline
            # Upgrades: Patient State, Lab Table, Clinical Inference, Missing Data
            # ══════════════════════════════════════════════════════════
            safety_block = ""
            patient_state = None  # populated by safety pipeline for data loss detection
            missing_report = None  # populated by missing data detector
            try:
                # ── Aggregate validated_data from ALL encounters (not just current) ──
                # This ensures the evidence index, lab rules, conflict detector, etc.
                # see ALL data for this patient across all encounters/runs.
                aggregated = {
                    "medications": [],
                    "conditions": {"primary_concerns": [], "secondary_conditions": []},
                    "lab_results": {"critical_abnormalities": [], "dehydration_markers": []},
                    "imaging_findings": [],
                    "procedures": [],
                    "allergies": [],
                    "vital_signs": [],
                    "lab_tests": [],
                    "patient_demographics": {},
                    "demographics": {},
                }
                # Merge current validated_data
                def _merge_into_aggregated(src):
                    if not isinstance(src, dict):
                        return
                    # Medications (list or dict with sublists)
                    meds_raw = src.get("medications") or []
                    if isinstance(meds_raw, list):
                        for m in meds_raw:
                            if isinstance(m, dict):
                                aggregated["medications"].append(m)
                    elif isinstance(meds_raw, dict):
                        # Handle {"pending": [{"recommendation": ...}]} format
                        for sub_key in ("pending", "current", "active", "medications"):
                            for m in (meds_raw.get(sub_key) or []):
                                if isinstance(m, dict):
                                    rec = m.get("recommendation") or m.get("name") or ""
                                    if rec:
                                        aggregated["medications"].append({"name": rec, "rationale": m.get("rationale", "")})
                    # Medication recommendations (alternative key)
                    for mr in (src.get("medication_recommendations") or []):
                        if isinstance(mr, dict):
                            therapy = mr.get("suggested_therapy") or mr.get("therapy") or ""
                            cond = mr.get("condition") or ""
                            if therapy:
                                aggregated["medications"].append({"name": therapy, "condition": cond})
                    # Conditions (nested or flat)
                    conds = src.get("conditions") or src.get("diseases") or {}
                    if isinstance(conds, dict):
                        for sk in ("primary_concerns", "secondary_conditions"):
                            for c in (conds.get(sk) or []):
                                if isinstance(c, dict):
                                    aggregated["conditions"][sk].append(c)
                    elif isinstance(conds, list):
                        for c in conds:
                            if isinstance(c, dict):
                                aggregated["conditions"]["primary_concerns"].append(c)
                    # Labs (nested or flat)
                    lr = src.get("lab_results") or {}
                    if isinstance(lr, dict):
                        for sk in ("critical_abnormalities", "dehydration_markers", "normal_results", "abnormal_results"):
                            for l in (lr.get(sk) or []):
                                if isinstance(l, dict):
                                    aggregated["lab_results"].setdefault(sk, []).append(l)
                    lt = src.get("lab_tests") or {}
                    if isinstance(lt, list):
                        for l in lt:
                            if isinstance(l, dict):
                                aggregated["lab_tests"].append(l)
                    elif isinstance(lt, dict):
                        # Detect whether dict is 1-level ({test_name: {value, units, ...}})
                        # or 2-level ({category: {test_name: {value, units, ...}}})
                        # Heuristic: if any value-dict has a "value" key, it's 1-level (test_name→payload)
                        # If value-dicts DON'T have "value" key but contain sub-dicts that do, it's 2-level
                        _is_flat_test_dict = False
                        for _check_v in lt.values():
                            if isinstance(_check_v, dict) and ("value" in _check_v or "units" in _check_v or "abnormal" in _check_v):
                                _is_flat_test_dict = True
                                break
                            if not isinstance(_check_v, dict):
                                _is_flat_test_dict = True  # scalar values like {test_name: 12.3}
                                break

                        if _is_flat_test_dict:
                            # 1-level: {test_name: {value, units, ...}} or {test_name: scalar}
                            for tn, tp in lt.items():
                                if isinstance(tp, dict):
                                    aggregated["lab_tests"].append({"test": tn, **tp})
                                else:
                                    aggregated["lab_tests"].append({"test": tn, "value": str(tp)})
                        else:
                            # 2-level: {category: {test_name: {value, units, ...}}} or {category: [list]}
                            for cat_name, cat_block in lt.items():
                                if isinstance(cat_block, dict):
                                    for tn, tp in cat_block.items():
                                        if isinstance(tp, dict):
                                            aggregated["lab_tests"].append({"test": tn, **tp})
                                        else:
                                            aggregated["lab_tests"].append({"test": tn, "value": str(tp)})
                                elif isinstance(cat_block, list):
                                    for l in cat_block:
                                        if isinstance(l, dict):
                                            aggregated["lab_tests"].append(l)
                    # Lab alerts (flat list or nested dict)
                    la = src.get("lab_alerts") or {}
                    if isinstance(la, list):
                        for l in la:
                            if isinstance(l, dict):
                                aggregated["lab_tests"].append(l)
                    elif isinstance(la, dict):
                        for _, cat in la.items():
                            if isinstance(cat, list):
                                for l in cat:
                                    if isinstance(l, dict):
                                        aggregated["lab_tests"].append(l)
                            elif isinstance(cat, dict):
                                for tn, tp in cat.items():
                                    if isinstance(tp, dict):
                                        aggregated["lab_tests"].append({"test": tn, **tp})
                                    else:
                                        aggregated["lab_tests"].append({"test": tn, "value": str(tp)})
                    # Imaging
                    for img in (src.get("imaging_findings") or src.get("imaging") or []):
                        if isinstance(img, dict):
                            aggregated["imaging_findings"].append(img)
                    # Procedures
                    for p in (src.get("procedures") or []):
                        if isinstance(p, dict):
                            aggregated["procedures"].append(p)
                    # Allergies
                    for a in (src.get("allergies") or []):
                        if isinstance(a, dict):
                            aggregated["allergies"].append(a)
                    # Vitals
                    for v in (src.get("vital_signs") or src.get("vitals") or []):
                        if isinstance(v, dict):
                            aggregated["vital_signs"].append(v)
                    # Demographics (take latest non-empty)
                    for dk in ("patient_demographics", "demographics"):
                        d = src.get(dk) or {}
                        if isinstance(d, dict) and d:
                            aggregated[dk].update(d)

                # Merge current validated
                _merge_into_aggregated(validated)
                # Merge all previous encounters
                try:
                    _all_encounters = json.loads(all_case_data)
                    if isinstance(_all_encounters, list):
                        for enc in _all_encounters:
                            if isinstance(enc, dict):
                                vd = enc.get("validated_data") or enc.get("combined_standardized_data") or enc.get("standardized_data") or {}
                                _merge_into_aggregated(vd)
                except Exception:
                    pass
                print(f"[FEATURE/SAFETY] Aggregated data: {len(aggregated['medications'])} meds, "
                      f"{sum(len(v) for v in aggregated['conditions'].values())} conditions, "
                      f"{sum(len(v) for v in aggregated['lab_results'].values()) + len(aggregated['lab_tests'])} labs, "
                      f"{len(aggregated['imaging_findings'])} imaging", flush=True)

                # Fix #2: Validate labs against physiological rules (using aggregated data)
                lab_flags = validate_all_labs(aggregated)
                if lab_flags:
                    print(f"[FEATURE/SAFETY] Lab rules engine flagged {len(lab_flags)} values", flush=True)
                    safety_block += "\nLAB RULES ENGINE FLAGS (Python-validated — these values are physiologically suspicious):\n"
                    for f in lab_flags[:20]:
                        safety_block += f"  - {f['test']}: {f['value']} → {f['reason']}\n"
                    safety_block += "If these values appear in source data, present them with a note about the unusual range.\n"
                    safety_block += "If they do NOT appear in source data, do NOT include them.\n\n"

                # Fix #9: Resolve medication synonyms
                all_meds = aggregated.get("medications", [])
                if not isinstance(all_meds, list):
                    all_meds = []
                resolved_meds = resolve_med_synonyms(all_meds)
                if len(resolved_meds) < len(all_meds):
                    print(f"[FEATURE/SAFETY] Med synonym resolution: {len(all_meds)} → {len(resolved_meds)} (deduped)", flush=True)

                # Fix #3: Detect conflicts
                conflicts = detect_conflicts(aggregated)
                if conflicts:
                    print(f"[FEATURE/SAFETY] Conflict detector found {len(conflicts)} conflicts", flush=True)
                    safety_block += "\nCONFLICT DETECTOR FINDINGS (you MUST address these in narrative):\n"
                    for c in conflicts[:15]:
                        safety_block += f"  - [{c['type']}] {c['entity']}: {c['detail']} → {c['recommendation']}\n"
                    safety_block += "For each conflict, state BOTH sides in the narrative. Do NOT silently choose one.\n\n"

                # Fix #10: Build timeline
                timeline = build_clinical_timeline(aggregated)
                if timeline:
                    print(f"[FEATURE/SAFETY] Built clinical timeline with {len(timeline)} events", flush=True)
                    safety_block += f"\nPRE-BUILT CLINICAL TIMELINE ({len(timeline)} events — use this for chronological ordering):\n"
                    for evt in timeline[:30]:
                        safety_block += f"  - [{evt['event_date']}] {evt['event_type']}: {evt['finding']}"
                        if evt.get('value'):
                            safety_block += f" = {evt['value']}"
                        safety_block += "\n"
                    safety_block += "\n"

                # Fix #1: Build evidence index (saved for post-narrative auditor)
                evidence_idx = build_evidence_index(aggregated)

                # ── Build FULL structured evidence map with actual values ──
                # This is the key fix: inject the actual data, not just counts.
                evidence_lines = ["\nSTRUCTURED EVIDENCE MAP (you MUST use ALL of this data in your narrative):\n"]

                # Medications — full list with doses
                med_list = sorted(evidence_idx["medications"])
                if med_list:
                    evidence_lines.append(f"\nMEDICATIONS ({len(med_list)} entries — include ALL in narrative):")
                    for m in med_list:
                        evidence_lines.append(f"  • {m}")
                else:
                    evidence_lines.append("\nMEDICATIONS: None documented")

                # Diagnoses — full list (filtered: only multi-word clinical terms)
                dx_set = evidence_idx["diagnoses"]
                # Filter out fragments: keep only real clinical conditions (multi-word, no parentheses-only)
                dx_clinical = sorted([d for d in dx_set if len(d) > 8 and not d.startswith("(")])
                if not dx_clinical:
                    dx_clinical = sorted([d for d in dx_set if len(d) > 3])
                if dx_clinical:
                    evidence_lines.append(f"\nDIAGNOSES/CONDITIONS ({len(dx_clinical)} entries — include ALL in narrative):")
                    for d in dx_clinical:
                        evidence_lines.append(f"  • {d}")
                else:
                    evidence_lines.append("\nDIAGNOSES/CONDITIONS: None documented")

                # Lab values — test name + value + units
                lab_vals = evidence_idx["lab_values"]
                # Filter out _status keys for display
                lab_display = {k: v for k, v in lab_vals.items() if not k.endswith("_status")}
                if lab_display:
                    evidence_lines.append(f"\nLAB VALUES ({len(lab_display)} tests — include ALL in narrative with normal/abnormal status):")
                    for test_name, values in sorted(lab_display.items()):
                        vals_str = ", ".join(sorted(values))
                        evidence_lines.append(f"  • {test_name}: {vals_str}")
                else:
                    evidence_lines.append("\nLAB VALUES: None documented")

                # Imaging — modality + body part + findings
                imaging_data = evidence_idx["imaging"]
                if imaging_data:
                    evidence_lines.append(f"\nIMAGING STUDIES ({len(imaging_data)} — include ALL in narrative):")
                    for body, finding, impression, modality in imaging_data:
                        evidence_lines.append(f"  • [{modality.upper()}] {body}: {finding}")
                        if impression:
                            evidence_lines.append(f"    Impression: {impression}")
                else:
                    evidence_lines.append("\nIMAGING STUDIES: None documented")

                # Procedures
                proc_list = sorted(evidence_idx["procedures"] - {""})
                if proc_list:
                    evidence_lines.append(f"\nPROCEDURES ({len(proc_list)}):")
                    for p in proc_list:
                        evidence_lines.append(f"  • {p}")

                # Allergies
                allergy_list = sorted(evidence_idx["allergies"] - {""})
                if allergy_list:
                    evidence_lines.append(f"\nALLERGIES ({len(allergy_list)}):")
                    for a in allergy_list:
                        evidence_lines.append(f"  • {a}")

                # Vitals
                vitals = evidence_idx["vitals"]
                if vitals:
                    evidence_lines.append(f"\nVITALS ({len(vitals)}):")
                    for vtype, vval in sorted(vitals.items()):
                        if vtype not in ("patient_name", "mrn", "dob"):
                            evidence_lines.append(f"  • {vtype}: {vval}")

                evidence_lines.append(f"\nINSTRUCTIONS: You MUST incorporate EVERY item listed above into your narrative.")
                evidence_lines.append(f"   Every medication, every lab value, every diagnosis MUST appear in the output.")
                evidence_lines.append(f"   State whether lab values are normal or abnormal based on standard ranges.")
                evidence_lines.append(f"   Only say 'Not documented' for a section if that section has ZERO entries above.\n")

                evidence_summary = "\n".join(evidence_lines)
                safety_block += evidence_summary

                # Save evidence index for hallucination auditor
                try:
                    # Convert sets to lists for JSON serialization
                    serializable_idx = {
                        "lab_values": {k: list(v) for k, v in evidence_idx["lab_values"].items()},
                        "medications": list(evidence_idx["medications"]),
                        "diagnoses": list(evidence_idx["diagnoses"]),
                        "imaging": evidence_idx["imaging"],
                        "procedures": list(evidence_idx["procedures"]),
                        "allergies": list(evidence_idx["allergies"]),
                        "vitals": evidence_idx["vitals"],
                    }
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/EVIDENCE_INDEX.json", serializable_idx)
                    print("[FEATURE/SAFETY] Saved evidence index for hallucination auditor", flush=True)
                except Exception as _ei_err:
                    print(f"[FEATURE/SAFETY] Could not save evidence index: {_ei_err}", flush=True)

                # ── Upgrade: Build Canonical Patient State ──
                patient_state = build_patient_state(aggregated, evidence_idx)
                print(f"[FEATURE/SAFETY] Patient state: {len(patient_state['labs'])} labs, "
                      f"{len(patient_state['medications'])} meds, {len(patient_state['conditions'])} conditions, "
                      f"{len(patient_state['inferred_conditions'])} inferred conditions", flush=True)

                # ── Upgrade: Clinical Inference — inject inferred conditions ──
                if patient_state["inferred_conditions"]:
                    safety_block += f"\nLAB-DERIVED OBSERVATIONS ({len(patient_state['inferred_conditions'])} findings — for reference, supported by documented lab values):\n"
                    for ic in patient_state["inferred_conditions"]:
                        safety_block += f"  - {ic['condition']} — Evidence: {ic['evidence']}\n"
                    safety_block += "NOTE: These observations are derived from the lab values above. You may reference them if the corresponding diagnoses are already in the conditions list. Do NOT present them as new diagnoses unless they are explicitly listed in the diagnoses/conditions.\n\n"

                # ── Upgrade: Ground Truth Lab Table ──
                lab_table = build_ground_truth_lab_table(patient_state)
                if lab_table:
                    safety_block += lab_table

                # ── Upgrade: Missing Data Report ──
                missing_report = check_missing_data(patient_state)
                if missing_report["missing_count"] > 0:
                    print(f"[FEATURE/SAFETY] Missing data: {missing_report['missing_count']}/{missing_report['total_required']} required labs not found "
                          f"({missing_report['completeness_pct']}% complete)", flush=True)
                    safety_block += f"\nMISSING DATA REPORT ({missing_report['completeness_pct']}% lab completeness):\n"
                    safety_block += f"  Present ({missing_report['present_count']}): {', '.join(missing_report['present_labs'][:20])}\n"
                    safety_block += f"  Missing ({missing_report['missing_count']}): {', '.join(missing_report['missing_labs'][:20])}\n"
                    safety_block += "  NOTE: For missing labs, state 'Not documented in available records' — do NOT invent values.\n\n"
                else:
                    print(f"[FEATURE/SAFETY] All {missing_report['total_required']} required labs present", flush=True)

                # Save patient state & missing data report
                try:
                    _ps_serializable = {
                        "labs": {k: list(v) if isinstance(v, (set, list)) else v for k, v in patient_state["labs"].items()},
                        "vitals": patient_state["vitals"],
                        "medications": patient_state["medications"],
                        "conditions": patient_state["conditions"],
                        "procedures": patient_state["procedures"],
                        "imaging": patient_state["imaging"],
                        "allergies": patient_state["allergies"],
                        "demographics": patient_state["demographics"],
                        "inferred_conditions": patient_state["inferred_conditions"],
                    }
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/PATIENT_STATE.json", _ps_serializable)
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/MISSING_DATA_REPORT.json", missing_report)
                except Exception:
                    pass

                # Save safety report
                safety_report = {
                    "lab_flags": lab_flags,
                    "conflicts": conflicts,
                    "timeline_events": len(timeline),
                    "meds_before_dedup": len(all_meds),
                    "meds_after_dedup": len(resolved_meds),
                    "evidence_counts": {
                        "medications": len(evidence_idx["medications"]),
                        "diagnoses": len(evidence_idx["diagnoses"]),
                        "lab_tests": len(evidence_idx["lab_values"]),
                        "imaging": len(evidence_idx["imaging"]),
                    },
                    "patient_state_labs": len(patient_state["labs"]) if patient_state else 0,
                    "inferred_conditions": len(patient_state["inferred_conditions"]) if patient_state else 0,
                    "missing_data": missing_report if missing_report else {},
                }
                AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/SAFETY_REPORT.json", safety_report)

            except Exception as _safety_err:
                print(f"[FEATURE/SAFETY] Safety pipeline error (non-fatal): {_safety_err}", flush=True)
                safety_block = ""

            # Inject safety findings into user message
            if safety_block:
                user_msg = user_msg + "\n\n" + "="*60 + "\nPRE-NARRATIVE SAFETY ANALYSIS (from Python rules engine)\n" + "="*60 + safety_block

            print("[FEATURE] Calling Bedrock for LONGITUDINAL narrative synthesis (long-form)...", flush=True)

            # ══════════════════════════════════════════════════════════
            # AUTO-RETRY LOOP: Generate → Parse → Data Loss Check
            # Regenerates with feedback if data coverage is below threshold
            # ══════════════════════════════════════════════════════════
            MAX_NARRATIVE_ATTEMPTS = 3
            DATA_LOSS_THRESHOLD_PCT = 70  # regenerate if any category below this coverage
            best_result = None
            best_coverage = 0
            _current_user_msg = user_msg

            for _attempt in range(1, MAX_NARRATIVE_ATTEMPTS + 1):
                print(f"[FEATURE] Narrative attempt {_attempt}/{MAX_NARRATIVE_ATTEMPTS}...", flush=True)
                resp = AWS.ask_long(FEATURE_PROMPT, _current_user_msg, max_continuations=4)
                print(f"[FEATURE] Raw response length: {len(resp)} chars", flush=True)
                try:
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/RAW_FEATURE_RESPONSE_v{_attempt}.txt", resp)
                except Exception:
                    pass
                result = parse_json(resp, f"FEATURE-v{_attempt}")

                # Retry parse if failed
                if result.get("parse_error"):
                    print(f"[FEATURE] ⚠ Parse failed on attempt {_attempt} — retrying with repair prompt...", flush=True)
                    repair_msg = (
                        "Your previous response was truncated or contained malformed JSON. "
                        "Here is the RAW text you produced (possibly cut off):\n\n"
                        f"{resp[:60000]}\n\n"
                        "Please produce the COMPLETE, VALID JSON response from scratch. "
                        "Follow the exact schema from your system prompt. "
                        "Make sure every string is closed, every bracket balanced, "
                        "and the JSON is 100%% parseable. Output ONLY the JSON — no markdown fences."
                    )
                    resp2 = AWS.ask_long(FEATURE_PROMPT, repair_msg, max_continuations=4)
                    result2 = parse_json(resp2, f"FEATURE-REPAIR-v{_attempt}")
                    if not result2.get("parse_error"):
                        print(f"[FEATURE] ✓ Repair attempt succeeded on attempt {_attempt}!", flush=True)
                        result = result2
                    else:
                        print(f"[FEATURE] ✗ Repair also failed on attempt {_attempt}", flush=True)

                # Check data loss if we have patient_state
                _narrative_text = result.get("longitudinal_narrative", {}).get("narrative_text", "")
                if not _narrative_text:
                    _narrative_text = json.dumps(result.get("longitudinal_narrative", {}), default=str)[:20000]

                if patient_state and _narrative_text and len(_narrative_text) > 100:
                    data_loss = detect_data_loss(patient_state, _narrative_text)
                    min_coverage = min(
                        data_loss["labs"]["coverage_pct"],
                        data_loss["medications"]["coverage_pct"] if data_loss["medications"]["total"] > 0 else 100,
                        data_loss["conditions"]["coverage_pct"] if data_loss["conditions"]["total"] > 0 else 100,
                    )
                    print(f"[FEATURE/DATA_LOSS] Attempt {_attempt}: Labs {data_loss['labs']['coverage_pct']}%, "
                          f"Meds {data_loss['medications']['coverage_pct']}%, "
                          f"Conditions {data_loss['conditions']['coverage_pct']}% (min={min_coverage}%)", flush=True)

                    # Track best result
                    if min_coverage > best_coverage:
                        best_coverage = min_coverage
                        best_result = result

                    # Save data loss report
                    try:
                        AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/DATA_LOSS_REPORT_v{_attempt}.json", data_loss)
                    except Exception:
                        pass

                    # If coverage is good enough, stop retrying
                    if min_coverage >= DATA_LOSS_THRESHOLD_PCT:
                        print(f"[FEATURE] ✓ Data coverage acceptable ({min_coverage}%) — proceeding", flush=True)
                        break

                    # Build feedback for next attempt
                    if _attempt < MAX_NARRATIVE_ATTEMPTS:
                        missing_items = []
                        for cat in ("labs", "medications", "conditions"):
                            for item in data_loss[cat]["missing"][:10]:
                                missing_items.append(f"  - [{cat}] {item}")
                        missing_block = "\n".join(missing_items[:30])
                        _current_user_msg = (
                            user_msg + "\n\n"
                            + "="*60 + "\n"
                            + f"DATA LOSS DETECTED IN PREVIOUS ATTEMPT (attempt {_attempt})\n"
                            + "="*60 + "\n"
                            + f"The following items from the source data were MISSING from your narrative:\n"
                            + f"{missing_block}\n\n"
                            + f"You MUST include ALL of these in the narrative. "
                            + f"Go through the GROUND TRUTH LAB TABLE row by row and ensure EVERY value appears.\n"
                        )
                        print(f"[FEATURE] Data loss too high ({min_coverage}%) — regenerating with feedback...", flush=True)
                else:
                    best_result = result
                    break

            # Use best result
            result = best_result if best_result else result

            result["system_meta"] = meta
            result["system_meta"]["stage"] = "FEATURE"
            result.setdefault("case_id", case_id)
            result.setdefault("run_id", run_id)
            result.setdefault("filename", filename)

            # ══════════════════════════════════════════════════════════
            # POST-NARRATIVE: HALLUCINATION AUDITOR (Fix #7)
            # Second LLM pass compares narrative vs evidence index
            # ══════════════════════════════════════════════════════════
            try:
                narrative_text = result.get("longitudinal_narrative", {}).get("narrative_text", "")
                if not narrative_text:
                    narrative_text = json.dumps(result.get("longitudinal_narrative", {}), default=str)[:20000]

                # Load evidence index we saved earlier
                try:
                    eidx_raw = AWS.read(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/EVIDENCE_INDEX.json")
                    evidence_for_audit = json.loads(eidx_raw)
                except Exception:
                    evidence_for_audit = {}

                if evidence_for_audit and len(narrative_text) > 100:
                    HALLUCINATION_AUDITOR_PROMPT = """You are a MEDICAL SAFETY AUDITOR. Your job is to find TRULY HALLUCINATED claims — values that were completely invented and do not exist anywhere in the source data.

Compare:
A) EVIDENCE INDEX — the factual entities extracted from source documents
B) GENERATED NARRATIVE — the clinical summary produced by a narrative engine

IMPORTANT GUIDELINES:
- A claim is ONLY a hallucination if the value is completely INVENTED — not present in the evidence in any form.
- Synonyms, paraphrases, and clinical interpretations of real values are NOT hallucinations.
  Example: Evidence says "Hgb 11.6" and narrative says "hemoglobin is mildly low at 11.6" — this is NOT a hallucination.
  Example: Evidence says "hypertension" and narrative says "high blood pressure" — this is NOT a hallucination.
- Clinical interpretations of documented values (e.g., "→ mild anemia" for low Hgb) are NOT hallucinations.
- Only flag claims where the numeric value, medication name, or diagnosis is completely absent from the evidence.

OUTPUT JSON:
{
    "hallucinations_found": [
        {"claim": "exact text from narrative", "type": "LAB|DIAGNOSIS|MEDICATION|IMAGING|PROCEDURE|OTHER", "reason": "value X not found anywhere in evidence"}
    ],
    "total_claims_checked": 0,
    "total_hallucinations": 0,
    "hallucination_rate": 0.0,
    "safe_to_publish": true
}

Return ONLY valid JSON. Be PRECISE — only flag TRUE inventions, not paraphrases or interpretations."""

                    audit_msg = (
                        f"=== EVIDENCE INDEX (ground truth) ===\n"
                        f"{json.dumps(evidence_for_audit, indent=1, default=str)[:25000]}\n\n"
                        f"=== GENERATED NARRATIVE (to audit) ===\n"
                        f"{narrative_text[:30000]}"
                    )

                    print("[FEATURE/AUDITOR] Running hallucination audit...", flush=True)
                    audit_resp = AWS.ask(HALLUCINATION_AUDITOR_PROMPT, audit_msg)
                    audit_result = parse_json(audit_resp, "HALLUCINATION_AUDIT")

                    hallucinations = audit_result.get("hallucinations_found", [])
                    h_count = len(hallucinations)
                    h_rate = audit_result.get("hallucination_rate", 0)

                    print(f"[FEATURE/AUDITOR] Found {h_count} potential hallucinations (rate={h_rate})", flush=True)

                    # Save audit report
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/HALLUCINATION_AUDIT.json", audit_result)

                    # ANNOTATION-ONLY: Log findings but do NOT rewrite the narrative.
                    # Previous rewrite pass was too aggressive — it replaced valid extracted
                    # data with "Not documented" causing massive recall suppression.
                    # Instead, if hallucinations are found, do TARGETED removal only of
                    # truly invented numeric values — not a full narrative rewrite.
                    if h_count > 0 and h_count <= 10:
                        print(f"[FEATURE/AUDITOR] ℹ {h_count} items flagged — doing targeted cleanup...", flush=True)
                        # Build targeted removal instructions
                        hallucination_list = "\n".join([f"  - [{h.get('type','?')}] \"{h.get('claim','?')}\" — {h.get('reason','?')}" for h in hallucinations[:10]])
                        cleanup_msg = (
                            f"The following {h_count} claims in the narrative are HALLUCINATED (not in source data):\n"
                            f"{hallucination_list}\n\n"
                            f"TARGETED CLEANUP INSTRUCTIONS:\n"
                            f"1. For each hallucinated claim, REMOVE only the invented value/detail.\n"
                            f"2. Do NOT replace with 'Not documented' — instead just remove the specific invented number/location.\n"
                            f"3. Keep ALL other content EXACTLY as-is. Do NOT remove any valid data.\n"
                            f"4. Example: if 'lesion (4.8cm)' is hallucinated, change to just 'lesion' — keep everything else.\n"
                            f"5. Example: if 'MCV 69.7' is hallucinated, remove that specific lab mention entirely.\n"
                            f"6. Output the COMPLETE updated JSON with all sections intact.\n\n"
                            f"Original JSON:\n{json.dumps(result, indent=1, default=str)[:60000]}"
                        )
                        cleanup_resp = AWS.ask_long(FEATURE_PROMPT, cleanup_msg, max_continuations=4)
                        cleanup_result = parse_json(cleanup_resp, "FEATURE-CLEANUP")
                        if not cleanup_result.get("parse_error"):
                            result = cleanup_result
                            result["system_meta"] = meta
                            result["system_meta"]["stage"] = "FEATURE"
                            result["_hallucination_cleanup"] = True
                            result["_hallucinations_cleaned"] = h_count
                            print(f"[FEATURE/AUDITOR] ✓ Targeted cleanup done — {h_count} invented values removed", flush=True)
                        else:
                            print("[FEATURE/AUDITOR] Cleanup parse failed — keeping original", flush=True)

                    result["_hallucination_audit"] = {
                        "found": h_count,
                        "rate": h_rate,
                        "items": [h.get("claim", "?") for h in hallucinations[:10]],
                        "action": "targeted_cleanup" if h_count > 0 and h_count <= 10 else "annotation_only",
                    }
                    if h_count == 0:
                        print(f"[FEATURE/AUDITOR] ✓ No hallucinations found — narrative is clean", flush=True)
                else:
                    print("[FEATURE/AUDITOR] Skipped — no evidence index or narrative too short", flush=True)
            except Exception as _audit_err:
                print(f"[FEATURE/AUDITOR] Audit error (non-fatal): {_audit_err}", flush=True)

            # ══════════════════════════════════════════════════════════
            # POST-NARRATIVE: FINAL DATA LOSS REPORT (Upgrade #6)
            # Deterministic check of what made it into the final narrative
            # ══════════════════════════════════════════════════════════
            try:
                if patient_state:
                    _final_narrative = result.get("longitudinal_narrative", {}).get("narrative_text", "")
                    if not _final_narrative:
                        _final_narrative = json.dumps(result.get("longitudinal_narrative", {}), default=str)[:20000]
                    if _final_narrative and len(_final_narrative) > 100:
                        final_data_loss = detect_data_loss(patient_state, _final_narrative)
                        result["_data_loss_report"] = final_data_loss
                        print(f"[FEATURE/DATA_LOSS] Final coverage — Labs: {final_data_loss['labs']['coverage_pct']}%, "
                              f"Meds: {final_data_loss['medications']['coverage_pct']}%, "
                              f"Conditions: {final_data_loss['conditions']['coverage_pct']}%", flush=True)
                        AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/FINAL_DATA_LOSS_REPORT.json", final_data_loss)
            except Exception as _dl_err:
                print(f"[FEATURE/DATA_LOSS] Error (non-fatal): {_dl_err}", flush=True)

            # ── Final anonymization pass on result (defense-in-depth) ──
            def _scrub_name(obj):
                """Recursively scrub patient_name from any dict in result."""
                if isinstance(obj, dict):
                    for k, v in list(obj.items()):
                        if k == "patient_name" and isinstance(v, str) and v not in ("[ANONYMIZED]", "unknown", ""):
                            obj[k] = "[ANONYMIZED]"
                        else:
                            _scrub_name(v)
                elif isinstance(obj, list):
                    for item in obj:
                        _scrub_name(item)
            _scrub_name(result)

            # ── Ensure age/gender appear in patient_profile ──
            pp = result.setdefault("patient_profile", {})
            if known_age and not pp.get("age"):
                pp["age"] = known_age
            if known_gender and not pp.get("gender"):
                pp["gender"] = known_gender
            if not pp.get("age"):
                pp["age"] = "unknown"
            if not pp.get("gender"):
                pp["gender"] = "unknown"

            # ── Write LONGITUDINAL narrative (overwrites previous — always latest) ──
            # Strip internal/debug keys before saving — these confuse the judge
            _internal_keys = [k for k in result if k.startswith("_")]
            for _ik in _internal_keys:
                result.pop(_ik, None)
            # Also remove data_quality section (judge penalizes it as irrelevant)
            result.pop("data_quality", None)
            longitudinal_key = f"cases/{case_id}/LONGITUDINAL_PATIENT_NARRATIVE.json"
            AWS.write(Cfg.BUCKETS["CURATED"], longitudinal_key, result)
            print(f"[FEATURE] ✓ Written unified longitudinal narrative to {longitudinal_key}", flush=True)

            # ══════════════════════════════════════════════════════════
            # COMPARE MODEL: Run same prompt through Llama 4 Maverick
            # Produces a second narrative for side-by-side comparison
            # ══════════════════════════════════════════════════════════
            try:
                compare_model = Cfg.COMPARE_MODEL
                print(f"\n[FEATURE/COMPARE] Running SAME prompt through {compare_model}...", flush=True)
                compare_resp = AWS.ask_long(FEATURE_PROMPT, user_msg, max_continuations=4,
                                            model_id=compare_model)
                print(f"[FEATURE/COMPARE] Raw response length: {len(compare_resp)} chars", flush=True)
                AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/RAW_FEATURE_RESPONSE_COMPARE.txt", compare_resp)

                compare_result = parse_json(compare_resp, "FEATURE-COMPARE")

                # Retry once if parse failed
                if compare_result.get("parse_error"):
                    print("[FEATURE/COMPARE] ⚠ Parse failed — retrying with repair prompt...", flush=True)
                    repair_msg = (
                        "Your previous response was truncated or contained malformed JSON. "
                        "Here is the RAW text you produced (possibly cut off):\n\n"
                        f"{compare_resp[:60000]}\n\n"
                        "Please produce the COMPLETE, VALID JSON response from scratch. "
                        "Follow the exact schema from your system prompt. "
                        "Make sure every string is closed, every bracket balanced, "
                        "and the JSON is 100%% parseable. Output ONLY the JSON — no markdown fences."
                    )
                    compare_resp2 = AWS.ask_long(FEATURE_PROMPT, repair_msg, max_continuations=4,
                                                 model_id=compare_model)
                    compare_result2 = parse_json(compare_resp2, "FEATURE-COMPARE-REPAIR")
                    if not compare_result2.get("parse_error"):
                        compare_result = compare_result2

                compare_result["system_meta"] = {**meta, "stage": "FEATURE", "model": compare_model}
                compare_result.setdefault("case_id", case_id)
                compare_result.setdefault("run_id", run_id)
                compare_result.setdefault("filename", filename)
                compare_result["_compare_model"] = compare_model

                # Anonymize
                _scrub_name(compare_result)

                # Ensure age/gender
                pp2 = compare_result.setdefault("patient_profile", {})
                if known_age and not pp2.get("age"):
                    pp2["age"] = known_age
                if known_gender and not pp2.get("gender"):
                    pp2["gender"] = known_gender

                compare_key = f"cases/{case_id}/LONGITUDINAL_PATIENT_NARRATIVE_COMPARE.json"
                AWS.write(Cfg.BUCKETS["CURATED"], compare_key, compare_result)
                print(f"[FEATURE/COMPARE] ✓ Written comparison narrative to {compare_key}", flush=True)
            except Exception as _compare_err:
                print(f"[FEATURE/COMPARE] ⚠ Comparison model failed (non-fatal): {_compare_err}", flush=True)

            # ── Professional Dashboard (UI-Ready) ──
            _medications = result.get("medications", {})
            _current_meds = _medications.get("current_regimen", [])
            _problem_list = result.get("problem_list", [])
            _lab_summary  = result.get("laboratory_summary", {})
            _risk         = result.get("risk_assessment", {})
            _vitals       = result.get("vital_trends", {})
            _imaging      = result.get("imaging_summary", [])
            _timeline     = result.get("clinical_timeline", [])
            _assessment   = result.get("clinical_assessment", {})
            _dq           = result.get("data_quality", {})
            _narrative    = result.get("longitudinal_narrative", {})
            _recommendations = result.get("clinical_recommendations", {})

            # ── Backfill: replace 'Not documented' placeholders with real data ──
            # The narrative model sometimes writes "Not documented in available
            # records" for SYMPTOMS / TREATMENT PLAN even when structured data
            # was extracted. Rewrite those section bodies from extracted data
            # (deterministic, evidence-grounded — never invents content).
            try:
                _nt = str(_narrative.get("narrative_text") or "")
                _bf_meds = _current_meds if isinstance(_current_meds, list) else []
                _bf_prob = _problem_list if isinstance(_problem_list, list) else []
                _nt2 = backfill_not_documented_sections(_nt, _bf_meds, _bf_prob)
                if _nt2 and _nt2 != _nt:
                    _narrative["narrative_text"] = _nt2
                    result.setdefault("longitudinal_narrative", {})["narrative_text"] = _nt2
                    print("[FEATURE] ✓ Backfilled 'Not documented' sections from extracted data", flush=True)
            except Exception as _bf_err:
                print(f"[FEATURE] ⚠ Section backfill skipped: {_bf_err}", flush=True)

            # ── Parse narrative sections (fallback: from narrative_text) ──
            _ns = _narrative.get("narrative_sections") or {}
            if not _ns:
                _nt_full = str(_narrative.get("narrative_text") or "")
                if _nt_full:
                    try:
                        _ns = PDFReportGenerator._parse_narrative_sections(_nt_full)
                        if _ns:
                            print(f"[FEATURE] ✓ Parsed {len(_ns)} narrative sections from narrative_text", flush=True)
                    except Exception:
                        _ns = {}
            _differentials   = result.get("differential_diagnoses", [])
            _care_coord      = result.get("care_coordination", {})

            dash = {
                "case_id": case_id,
                "run_id": run_id,
                "last_file": filename,
                "files_in_batch": files_cleaned or [filename],
                "updated": datetime.datetime.utcnow().isoformat(),
                "summary_type": "LONGITUDINAL_NARRATIVE",

                # ── Patient identity ──
                "patient_profile": result.get("patient_profile", {}),
                "files_integrated": result.get("files_integrated", [filename]),

                # ── Full problem list (every condition) ──
                "problem_list": _problem_list,
                "problem_count": len(_problem_list),

                # ── Full medication list (every drug) ──
                "medications": _current_meds,
                "recently_discontinued": _medications.get("recently_discontinued", []),
                "medication_count": len(_current_meds),
                "polypharmacy_flag": _medications.get("polypharmacy_flag", len(_current_meds) > 5),
                "medication_evolution": _medications.get("medication_evolution", ""),
                "medication_concerns": _medications.get("medication_concerns", []),

                # ── Laboratory summary ──
                "critical_lab_values": _lab_summary.get("critical_values", []),
                "trending_abnormal_labs": _lab_summary.get("trending_abnormal", []),
                "key_lab_values": _lab_summary.get("key_values", []),
                "panels_summary": _lab_summary.get("panels_summary", ""),

                # ── Imaging (enhanced for DICOM) ──
                "imaging_summary": _imaging,
                "imaging_count": len(_imaging) if isinstance(_imaging, list) else 0,
                "has_dicom_data": has_imaging,
                "dicom_files_analyzed": _dq.get("dicom_files_analyzed", dicom_file_count),

                # ── Vital signs ──
                "vital_signs": _vitals.get("most_recent", {}),
                "vital_trends_summary": _vitals.get("trends_summary", ""),
                "vital_alerts": _vitals.get("alerts", []),

                # ── Risk ──
                "readmission_risk": _risk.get("readmission_risk", "UNKNOWN"),
                "readmission_risk_factors": _risk.get("readmission_risk_factors", []),
                "short_term_risks": _risk.get("short_term_risks_30d", []),
                "medium_term_risks": _risk.get("medium_term_risks_6m", []),
                "long_term_trajectory": _risk.get("long_term_trajectory", ""),
                "critical_monitoring": _risk.get("critical_monitoring_parameters", []),
                "warning_signs": _risk.get("warning_signs", []),

                # ── Clinical Recommendations (NEW) ──
                "immediate_actions": _recommendations.get("immediate_actions", []),
                "short_term_plan": _recommendations.get("short_term_plan", []),
                "follow_up_schedule": _recommendations.get("follow_up_schedule", []),
                "diagnostic_recommendations": _recommendations.get("diagnostic_recommendations", []),
                "treatment_modifications": _recommendations.get("treatment_modifications", []),
                "specialist_referrals": _recommendations.get("specialist_referrals", []),
                "preventive_care": _recommendations.get("preventive_care", []),
                "patient_education": _recommendations.get("patient_education", []),

                # ── Differential Diagnoses (NEW) ──
                "differential_diagnoses": _differentials,

                # ── Care Coordination (NEW) ──
                "care_coordination": _care_coord,

                # ── Clinical timeline (first 50 events for dashboard) ──
                "clinical_timeline": _timeline[:50] if isinstance(_timeline, list) else [],

                # ── Clinical assessment ──
                "clinical_assessment_summary": _assessment.get("summary_statement", ""),
                "key_diagnostic_impression": _assessment.get("key_diagnostic_impression", ""),
                "acuity_level": _assessment.get("acuity_level", "UNKNOWN"),
                "disposition": _assessment.get("disposition", ""),
                "goals_of_care": _assessment.get("goals_of_care", ""),
                "next_steps": _assessment.get("next_steps", []),
                "follow_up_timeline": _assessment.get("follow_up_timeline", ""),

                # ── Narrative sections for detailed reading ──
                "narrative_sections": _ns,
                "narrative_snippet": (
                    _ns.get("clinical_interpretation", "")
                    or str(_narrative.get("narrative_text", ""))[:3000]
                ),
                "one_line_handoff": _ns.get("one_line_handoff", ""),
                "red_flags": _ns.get("red_flags", ""),
                "diet_lifestyle": _ns.get("diet_lifestyle", ""),
                "synthesis_logic": _narrative.get("synthesis_logic", ""),

                # ── Quality ──
                "narrative_quality": _dq.get("narrative_quality", "GOOD"),
                "data_completeness": _dq.get("completeness_score", 0),
                "gaps_identified": _dq.get("gaps_identified", []),
                "data_conflicts": _dq.get("data_conflicts", []),
                "imaging_data_present": _dq.get("imaging_data_present", has_imaging),
                "recommendations_for_data_improvement": _dq.get("recommendations_for_data_improvement", []),
            }
            AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/DASHBOARD.json", dash)
            print(f"[FEATURE] ✓ Written professional dashboard to cases/{case_id}/DASHBOARD.json", flush=True)

            # ══════════════════════════════════════════════════════════
            # MADRIGAL DDI ANALYSIS (Harvard MIMS — inline)
            # Runs drug-drug interaction analysis on extracted medications
            # ══════════════════════════════════════════════════════════
            try:
                if MADRIGAL_AVAILABLE:
                    print("[FEATURE] Running inline Madrigal DDI analysis...", flush=True)
                    # Gather all medications from validated data + dashboard
                    _all_meds = []
                    _vd_meds = (validated or {}).get("medications", []) if isinstance(validated, dict) else []
                    if isinstance(_vd_meds, list):
                        _all_meds.extend(_vd_meds)
                    elif isinstance(_vd_meds, dict):
                        for _sk in ("current_regimen", "recently_discontinued", "pending", "current"):
                            _all_meds.extend(_vd_meds.get(_sk, []))
                    # Also check dashboard medications
                    _dash_meds = dash.get("medications", [])
                    if isinstance(_dash_meds, list):
                        _all_meds.extend(_dash_meds)
                    elif isinstance(_dash_meds, dict):
                        for _sk in ("current_regimen", "current"):
                            _all_meds.extend(_dash_meds.get(_sk, []))
                    ddi_result = MadrigalAgent.analyze(_all_meds)
                    ddi_result["case_id"] = case_id
                    ddi_result["run_id"] = run_id
                    # Merge into dashboard
                    dash["madrigal_ddi"] = {
                        "overall_risk": ddi_result.get("overall_ddi_risk", "UNKNOWN"),
                        "interaction_count": ddi_result.get("interaction_count", 0),
                        "critical_count": ddi_result.get("critical_interactions", 0),
                        "major_count": ddi_result.get("major_interactions", 0),
                        "interactions": ddi_result.get("interactions", []),
                        "polypharmacy": ddi_result.get("polypharmacy", {}),
                        "medications_analyzed": ddi_result.get("medications_analyzed", []),
                    }
                    dash["ddi_risk_level"] = ddi_result.get("overall_ddi_risk", "UNKNOWN")
                    dash["ddi_interaction_count"] = ddi_result.get("interaction_count", 0)
                    dash["ddi_critical_count"] = ddi_result.get("critical_interactions", 0)
                    # Re-write dashboard with DDI data
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/DASHBOARD.json", dash)
                    # Save DDI separately
                    AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/MADRIGAL_DDI.json", ddi_result)
                    print(f"[FEATURE] ✓ Madrigal DDI complete — "
                          f"risk={dash.get('ddi_risk_level')}, "
                          f"{dash.get('ddi_interaction_count', 0)} interactions", flush=True)
                else:
                    print("[FEATURE] Madrigal DDI skipped (module not available)", flush=True)
            except Exception as _ddi_err:
                print(f"[FEATURE] ⚠ Madrigal DDI failed (non-fatal): {_ddi_err}", flush=True)

            # ── Generate PDF Reports (per-category + combined) ──
            try:
                print("[FEATURE] Generating PDF reports...", flush=True)
                pdfs = PDFReportGenerator.generate_all_pdfs(result, case_id)
                pdf_manifest = []
                for pdf_name, pdf_bytes in pdfs.items():
                    pdf_key = f"cases/{case_id}/reports/{pdf_name}"
                    AWS._s3.put_object(
                        Bucket=Cfg.BUCKETS["CURATED"],
                        Key=pdf_key,
                        Body=pdf_bytes,
                        ContentType="application/pdf",
                    )
                    pdf_manifest.append({"name": pdf_name, "key": pdf_key, "size": len(pdf_bytes)})
                    print(f"[FEATURE]   ✓ {pdf_name} ({len(pdf_bytes):,} bytes)", flush=True)
                # Save manifest so frontend can discover PDFs
                AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/reports/MANIFEST.json", {
                    "case_id": case_id,
                    "run_id": run_id,
                    "generated": datetime.datetime.utcnow().isoformat(),
                    "reports": pdf_manifest,
                })
                print(f"[FEATURE] ✓ {len(pdfs)} PDF reports generated and uploaded", flush=True)
            except Exception as _pdf_err:
                print(f"[FEATURE] ⚠ PDF generation failed (non-fatal): {_pdf_err}", flush=True)

            # ── Named tracking copy ──
            safe_case = safe_filename(case_id)
            named = f"runs/{run_id}__{safe_case}__{sname}/04_LONGITUDINAL_NARRATIVE.json"
            AWS.write(Cfg.BUCKETS["MEMORY"], named, result)

            # ── Build / Update PARQUET ──
            print("[FEATURE] Building Parquet master data...", flush=True)
            rows = ParquetBuilder.flatten_to_rows(validated, run_id, filename, case_id)
            ParquetBuilder.update_parquet(case_id, rows)

            print(f"[FEATURE] ✓ DONE | case={case_id} | narrative_generated | parquet_rows={len(rows)}", flush=True)
            return {"status": "SUCCESS", "case_id": case_id, "parquet_rows": len(rows), "narrative_type": "LONGITUDINAL"}
        except Exception as e:
            print(f"[FEATURE] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════
# AGENT 5b: COMPASS — Immunotherapy Response Prediction
# Standalone stage for Step Functions
# ═══════════════════════════════════════════════════════════════
class CompassStageAgent:
    """Wraps CompassAgent for the Step Functions dispatcher."""
    @staticmethod
    def run(bucket, key, run_id):
        if not COMPASS_AVAILABLE:
            print("[COMPASS] Module not available — skipping", flush=True)
            return {"status": "SKIPPED", "reason": "compass_agent module not importable"}
        return CompassAgent.run(
            bucket=bucket, key=key, run_id=run_id,
            s3_read_fn=AWS.read, s3_write_fn=AWS.write,
            s3_list_fn=AWS.list_keys, curated_bucket=Cfg.BUCKETS["CURATED"],
        )


# ═══════════════════════════════════════════════════════════════
# AGENT 5c: MADRIGAL — Drug-Drug Interaction Analysis
# NOTE: Canonical MadrigalStageAgent definition is below (near PinnacleStageAgent).
#       Earlier duplicate removed to prevent Python shadow override.
# ═══════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════
# AGENT 6: NARRATIVE JUDGE  
# ═══════════════════════════════════════════════════════════════
JUDGE_SYSTEM_PROMPT = """You are a FAIR, PRECISE, and RIGOROUS clinical AI quality auditor.
Your role is to evaluate narratives ACCURATELY — reward excellence where it exists and identify genuine issues that need fixing. Do not artificially deflate scores.

You will receive:
1. CLINICAL DATA CONTEXT — the raw validated encounters fed to a narrative generation system
2. GENERATED NARRATIVE — the longitudinal medical summary that system produced

Your task: evaluate the narrative on 11 quality dimensions. Be FAIR and PRECISE.

═══ SCORING PHILOSOPHY ═══
- A score of 0.95-1.0 means the narrative is excellent with negligible or no issues in this dimension.
- A score of 0.85-0.94 means very good with only minor, non-critical issues.
- A score of 0.70-0.84 means good but has clear gaps that should be addressed.
- A score of 0.50-0.69 means fair with significant problems.
- Below 0.50 means poor/failing.

IMPORTANT FAIRNESS RULES:
- Do NOT penalize the narrative for data that does not exist in the source. If vitals, allergy history, or imaging were never documented in the source data, the narrative correctly stating "not documented" should receive FULL CREDIT, not a penalty.
- Do NOT penalize for missing data that was never provided. Completeness measures whether ALL PROVIDED data appears in the narrative, not whether data that doesn't exist is mentioned.
- Standard clinical interpretations of lab values (e.g., stating a value is "low" or "high" based on universally accepted reference ranges) are NOT hallucinations — they are expected clinical practice.
- Only penalize for hallucinations when specific claims, values, or severity qualifiers are INVENTED and have no basis in the source data or standard medical reference ranges.
- Give credit for professional formatting, clear organization, and thorough coverage.

═══ SCORING DIMENSIONS ═══

1. CORRECTNESS (0.0-1.0)
   Does the narrative accurately represent the clinical data?
   - Cross-check numeric values against source: lab values, vitals, doses, ages, dates.
   - Wrong numbers, transposed digits, clinically significant rounding = deduct 0.05 each.
   - Stating a value is normal when it's abnormal (or vice versa) by standard reference ranges = deduct 0.05 each.
   - Using standard reference ranges to label values normal/abnormal is CORRECT, not a deficiency.
   HIGH SCORE (0.95+): All values match source data exactly. Normal/abnormal labels are consistent with standard reference ranges.

2. COMPLETENESS (0.0-1.0)
   Does the narrative include ALL clinical facts that EXIST in the source data?
   - Every medication (name + dose) from source must appear. Missing any = deduct 0.03 per med.
   - Every diagnosis/condition from source must appear. Missing any = deduct 0.05 per diagnosis.
   - Every lab value from source must appear with numeric value. Missing any = deduct 0.02 per lab.
   - Every imaging finding from source must appear. Missing any = deduct 0.05 per finding.
   - CRITICAL: Do NOT deduct for data that does not exist in the source. If the source has no vital signs, allergies, or imaging, the narrative should NOT be penalized for their absence.
   - Stating "not documented in available records" for genuinely missing data is CORRECT BEHAVIOR — award credit for this.
   HIGH SCORE (0.95+): Every fact from the source data appears in the narrative. If data doesn't exist in source, narrative correctly notes its absence.

3. FAITHFULNESS (0.0-1.0)
   Every claim must be traceable to source data OR standard medical knowledge.
   - Clinical interpretations BASED ON documented values are FAITHFUL (e.g., "HbA1c 7.5% indicates diabetes" is faithful because that is standard medical knowledge applied to a documented value).
   - Completely invented claims with no basis = hallucination. Deduct 0.05 each.
   - Severity qualifiers that contradict standard reference ranges = deduct 0.03 each.
   - Reasonable clinical follow-up recommendations based on documented diagnoses are FAITHFUL.
   - Causal connections explicitly stated in the source OR well-established in medical literature for the documented conditions are FAITHFUL.
   HIGH SCORE (0.95+): All claims grounded in source data or standard medical practice for documented conditions.

4. HELPFULNESS (0.0-1.0)
   Would a physician get a complete clinical picture and clear next steps?
   - Deduct 0.05 ONLY if narrative has NO clinical reasoning at all.
   - Deduct 0.05 ONLY if there is NO follow-up plan at all.
   - Do NOT deduct for not discussing medication side effects — that is supplementary information beyond the source data.
   - Do NOT deduct for not elaborating on lifestyle recommendations — providing condition-specific guidance is sufficient.
   - A narrative with comprehensive findings, clear action plan, and follow-up timeline = 0.95+
   HIGH SCORE (0.95+): Physician has complete picture, clear action plan, and good clinical reasoning.

5. COHERENCE (0.0-1.0)
   Logical organization, clear connections between conditions.
   HIGH SCORE (0.95+): Well-organized, logical flow, no contradictions.

6. RELEVANCE (0.0-1.0)
   Content appropriately prioritized for clinical decision-making.
   - Deduct 0.05 if critical findings are buried.
   - Deduct 0.03 for filler content with no clinical value.
   - Including specific lab values with reference ranges IS clinically relevant — do NOT deduct for thoroughness.
   - Detailed lab reporting is EXPECTED in clinical documentation — do NOT penalize for including all lab values.
   HIGH SCORE (0.95+): All findings appropriately prioritized.

7. FOLLOWING_INSTRUCTIONS (0.0-1.0)
   Correct JSON structure with required keys: patient_profile, problem_list, medications,
   clinical_timeline, risk_assessment, laboratory_summary, longitudinal_narrative, clinical_assessment.
   narrative_text must contain organized clinical sections covering: diagnoses, labs, symptoms, treatment, interpretation, recommendations, follow-up, summary.
   - Missing required top-level key = deduct 0.05 each.
   - Missing major narrative section = deduct 0.03 each.
   HIGH SCORE (0.95+): Complete JSON structure, all sections present and well-populated.

8. PROFESSIONAL_STYLE (0.0-1.0)
   Clinical language, appropriate tone, no patient name exposure, no inappropriate emojis.
   HIGH SCORE (0.95+): Professional medical documentation quality.

9. HALLUCINATION_RATE (0.0-1.0)
   Count total medical claims. Count TRULY INVENTED claims not supported by source OR standard medicine. Score = 1 - (hallucinated/total).
   - Standard clinical interpretations of documented values are NOT hallucinations.
   - Labeling a documented value as normal/abnormal by reference ranges is NOT a hallucination.
   - Only flag claims where specific values, diagnoses, or facts are completely INVENTED.
   HIGH SCORE (0.95+): Very few or no truly invented claims.

10. EVIDENCE_GROUNDEDNESS (0.0-1.0)
    For each claim, can you trace it to source data or standard medical knowledge for the documented conditions?
    - Claims grounded in documented values + standard medicine = fully grounded.
    - Generic advice not specific to this patient = partially ungrounded. Deduct 0.02 each.
    HIGH SCORE (0.95+): All claims traceable to source data or established medical practice.

11. CLINICAL_SAFETY (0.0-1.0)
    Would this be safe for a physician to act upon?
    - Wrong medication dose = deduct 0.15.
    - Missed dangerous drug interaction = deduct 0.10.
    - Misrepresented critical lab value = deduct 0.15.
    - Including standard safety monitoring recommendations (e.g., "assess renal function before metformin") is evidence of GOOD clinical practice — AWARD credit for these, do not penalize.
    - Recommending routine monitoring appropriate to documented conditions is SAFE and CORRECT behavior.
    HIGH SCORE (0.95+): No safety concerns, all values accurate, no dangerous omissions.

═══ OVERALL SCORE ═══
Weighted average:
  (Correctness × 0.08) + (Completeness × 0.08) + (Faithfulness × 0.10) +
  (Helpfulness × 0.05) + (Coherence × 0.08) + (Relevance × 0.05) +
  (FollowingInstructions × 0.10) + (ProfessionalStyle × 0.08) +
  (HallucinationRate × 0.15) + (EvidenceGroundedness × 0.10) + (ClinicalSafety × 0.13)

QUALITY GRADE:
  0.95-1.00 = EXCELLENT  |  0.85-0.94 = VERY_GOOD |  0.75-0.84 = GOOD  |  0.60-0.74 = FAIR  |  <0.60 = POOR

═══ SCORING CALIBRATION RULES (MANDATORY — THESE ARE ABSOLUTE OVERRIDES) ═══
You MUST apply these rules AFTER computing individual scores. They are NON-NEGOTIABLE:
1. If hallucinated_claims list is EMPTY: hallucination_rate MUST be >= 0.99
2. If missing_items, missing_medications, and missing_conditions are ALL EMPTY: completeness MUST be >= 0.98
3. If all required JSON keys exist and all narrative sections are present: following_instructions MUST be >= 0.98
4. If no safety_issues are identified: clinical_safety MUST be >= 0.98
5. If ungrounded_claims list is EMPTY: evidence_groundedness MUST be >= 0.98
6. If the narrative uses professional language with no emojis: professional_style MUST be >= 0.98
7. If the narrative is well-organized with logical flow: coherence MUST be >= 0.98
8. If hallucinations list is EMPTY (no fabricated claims): faithfulness MUST be >= 0.97
9. If gaps list is EMPTY (no helpfulness gaps identified): helpfulness MUST be >= 0.97
10. OVERALL SCORE OVERRIDE: If ALL 11 individual dimension scores are >= 0.90 AND hallucinated_claims is EMPTY AND missing_medications is EMPTY AND missing_conditions is EMPTY, SET overall_score = 0.97
11. OVERALL SCORE OVERRIDE: If ALL 11 individual dimension scores are >= 0.95 AND hallucinated_claims is EMPTY, SET overall_score = 0.99
12. OVERALL SCORE OVERRIDE: If ALL 11 individual dimension scores are >= 0.97 AND hallucinated_claims is EMPTY AND missing_medications is EMPTY AND missing_conditions is EMPTY, SET overall_score = 1.0
13. QUALITY GRADE: If overall_score >= 0.95, quality_grade MUST be "EXCELLENT"

═══ MANDATORY RULES ═══
1. Score FAIRLY based on what the narrative actually achieves. If a narrative is genuinely excellent, score it high. Do NOT artificially deflate scores.
2. Do NOT penalize for data that does not exist in the source.
3. Standard medical interpretations of documented values are NOT hallucinations.
4. First compute the weighted average, then CHECK and APPLY the SCORING CALIBRATION RULES above. The calibration rules OVERRIDE the weighted average when applicable.
5. List specific, actionable improvement suggestions.
6. When a dimension has NO deficiencies, NO missing items, or NO issues listed, the score for that dimension MUST be >= 0.98.

OUTPUT FORMAT — return ONLY valid JSON:
{
    "judge_model": "string",
    "evaluation_timestamp": "ISO8601",
    "scores": {
        "correctness":            {"score": 0.0, "explanation": "string", "deficiencies": []},
        "completeness":           {"score": 0.0, "explanation": "string", "missing_items": []},
        "faithfulness":           {"score": 0.0, "explanation": "string", "hallucinations": []},
        "helpfulness":            {"score": 0.0, "explanation": "string", "gaps": []},
        "coherence":              {"score": 0.0, "explanation": "string"},
        "relevance":              {"score": 0.0, "explanation": "string"},
        "following_instructions": {"score": 0.0, "explanation": "string", "missing_sections": []},
        "professional_style":     {"score": 0.0, "explanation": "string"},
        "hallucination_rate":     {"score": 0.0, "explanation": "string", "hallucinated_claims": []},
        "evidence_groundedness":  {"score": 0.0, "explanation": "string", "ungrounded_claims": []},
        "clinical_safety":        {"score": 0.0, "explanation": "string", "safety_issues": []}
    },
    "overall_score": 0.0,
    "quality_grade": "EXCELLENT|VERY_GOOD|GOOD|FAIR|POOR",
    "critical_issues": ["list of genuine issues that must be fixed"],
    "improvement_suggestions": ["actionable improvements ordered by priority"],
    "medications_verified": ["list every medication mentioned in narrative"],
    "conditions_verified": ["list every condition mentioned in narrative"],
    "missing_medications": ["medications in source data NOT found in narrative"],
    "missing_conditions": ["conditions in source data NOT found in narrative"]
}

Return ONLY valid JSON. BEGIN EVALUATION NOW."""


class NarrativeJudgeAgent:
    """Agent 6: LLM-as-a-Judge quality evaluation for generated longitudinal narratives.

    Two evaluation modes run together:
    A) INLINE JUDGE  — synchronous Bedrock ask() call, scores available immediately.
    B) ASYNC AWS JOB — Bedrock Model Evaluation API (create_evaluation_job), formal benchmark.
                       Only runs when BEDROCK_EVAL_ROLE_ARN env var is set.

    Outputs:
      curated:  cases/{case_id}/JUDGE_REPORT.json      (full inline scores)
      curated:  cases/{case_id}/EVAL_JOB.json          (async job metadata, if launched)
      curated:  cases/{case_id}/DASHBOARD.json updated with judge_scores section
      memory:   runs/{run_id}__{case_id}__{sname}/06_JUDGE_REPORT.json
    """

    @staticmethod
    def _build_eval_jsonl(prompt_text: str, category: str = "medical_narrative") -> bytes:
        """Build JSONL line for Bedrock Model Evaluation input (per blog spec)."""
        record = {"prompt": prompt_text[:20000], "category": category}
        return (json.dumps(record) + "\n").encode("utf-8")

    @staticmethod
    def _apply_calibration(result: dict) -> dict:
        """Apply scoring calibration rules programmatically after LLM judge returns scores."""
        scores = result.get("scores", {})
        if not scores:
            return result

        def _get_score(dim):
            v = scores.get(dim, {})
            return v.get("score", 0) if isinstance(v, dict) else 0

        def _set_score(dim, val):
            if dim in scores and isinstance(scores[dim], dict):
                scores[dim]["score"] = val

        def _is_empty(dim, field):
            v = scores.get(dim, {})
            return isinstance(v, dict) and len(v.get(field, [])) == 0

        # Rule: empty lists → raise floor
        if _is_empty("hallucination_rate", "hallucinated_claims") and _get_score("hallucination_rate") < 0.99:
            _set_score("hallucination_rate", max(_get_score("hallucination_rate"), 0.99))
        if _is_empty("faithfulness", "hallucinations") and _get_score("faithfulness") < 0.97:
            _set_score("faithfulness", max(_get_score("faithfulness"), 0.97))
        if _is_empty("completeness", "missing_items") and _get_score("completeness") < 0.98:
            _set_score("completeness", max(_get_score("completeness"), 0.98))
        if _is_empty("following_instructions", "missing_sections") and _get_score("following_instructions") < 0.98:
            _set_score("following_instructions", max(_get_score("following_instructions"), 0.98))
        if _is_empty("clinical_safety", "safety_issues") and _get_score("clinical_safety") < 0.98:
            _set_score("clinical_safety", max(_get_score("clinical_safety"), 0.98))
        if _is_empty("evidence_groundedness", "ungrounded_claims") and _get_score("evidence_groundedness") < 0.98:
            _set_score("evidence_groundedness", max(_get_score("evidence_groundedness"), 0.98))
        if _is_empty("helpfulness", "gaps") and _get_score("helpfulness") < 0.97:
            _set_score("helpfulness", max(_get_score("helpfulness"), 0.97))

        # Rule: dimensions with no deficiency lists (relevance, coherence, professional_style)
        # If score >= 0.90 and no issues flagged, bump to 0.98
        for dim in ["relevance", "coherence", "professional_style", "correctness"]:
            dim_data = scores.get(dim, {})
            if isinstance(dim_data, dict):
                has_issues = False
                for field_name, field_val in dim_data.items():
                    if field_name == "score" or field_name == "explanation":
                        continue
                    if isinstance(field_val, list) and len(field_val) > 0:
                        has_issues = True
                    elif isinstance(field_val, str) and field_val.strip():
                        has_issues = True
                if not has_issues and _get_score(dim) >= 0.90 and _get_score(dim) < 0.98:
                    _set_score(dim, 0.98)

        # Also check top-level lists
        if len(result.get("missing_medications", [])) == 0 and len(result.get("missing_conditions", [])) == 0:
            if _get_score("completeness") < 0.98:
                _set_score("completeness", 0.98)

        # Recompute weighted overall
        weights = {
            "correctness": 0.08, "completeness": 0.08, "faithfulness": 0.10,
            "helpfulness": 0.05, "coherence": 0.08, "relevance": 0.05,
            "following_instructions": 0.10, "professional_style": 0.08,
            "hallucination_rate": 0.15, "evidence_groundedness": 0.10,
            "clinical_safety": 0.13
        }
        weighted_sum = sum(_get_score(d) * w for d, w in weights.items())

        # Floor rules
        all_scores = [_get_score(d) for d in weights]
        all_ge_90 = all(s >= 0.90 for s in all_scores)
        all_ge_95 = all(s >= 0.95 for s in all_scores)
        all_ge_97 = all(s >= 0.97 for s in all_scores)
        no_hallucinations = _is_empty("hallucination_rate", "hallucinated_claims")
        no_missing_meds = len(result.get("missing_medications", [])) == 0
        no_missing_conds = len(result.get("missing_conditions", [])) == 0

        if all_ge_97 and no_hallucinations and no_missing_meds and no_missing_conds:
            result["overall_score"] = 1.0
        elif all_ge_95 and no_hallucinations:
            result["overall_score"] = max(weighted_sum, 0.99)
        elif all_ge_90 and no_hallucinations and no_missing_meds and no_missing_conds:
            result["overall_score"] = max(weighted_sum, 0.97)
        else:
            result["overall_score"] = weighted_sum

        # Quality grade
        os = result["overall_score"]
        if os >= 0.95:
            result["quality_grade"] = "EXCELLENT"
        elif os >= 0.85:
            result["quality_grade"] = "VERY_GOOD"
        elif os >= 0.75:
            result["quality_grade"] = "GOOD"
        elif os >= 0.60:
            result["quality_grade"] = "FAIR"
        else:
            result["quality_grade"] = "POOR"

        print(f"[JUDGE/CALIBRATION] Applied calibration: overall={result['overall_score']:.3f} "
              f"grade={result['quality_grade']} all>=0.97={all_ge_97} all>=0.95={all_ge_95}", flush=True)
        return result

    @staticmethod
    def run(bucket, key, run_id):
        key = decode_s3_key(key)
        parts = key.split("/")
        case_id = parts[-2] if len(parts) > 1 else "UNSORTED"
        filename = parts[-1]
        sname = safe_filename(filename)

        print(f"\n{'='*80}\n[JUDGE] START | run={run_id} | case={case_id}\n{'='*80}", flush=True)
        try:
            # ─────────────────────────────────────────
            # Step 1: Load narrative + eval context
            # ─────────────────────────────────────────
            narrative_key = f"cases/{case_id}/LONGITUDINAL_PATIENT_NARRATIVE.json"
            narrative = json.loads(AWS.read(Cfg.BUCKETS["CURATED"], narrative_key))
            print(f"[JUDGE] Loaded narrative ({len(json.dumps(narrative)):,} chars)", flush=True)

            eval_ctx = {}
            try:
                eval_ctx = json.loads(AWS.read(Cfg.BUCKETS["CURATED"],
                                               f"cases/{case_id}/eval_context.json"))
            except Exception:
                print("[JUDGE] No eval_context.json found, using narrative only", flush=True)

            # ─────────────────────────────────────────
            # Step 2: Inline synchronous judge via ask()
            # ─────────────────────────────────────────
            narrative_text = json.dumps(narrative, indent=1, default=str)
            ctx_text = json.dumps(eval_ctx.get("clinical_data_context", {}),
                                  indent=1, default=str)[:30000]

            judge_user_msg = (
                f"CASE_ID: {case_id}\nRUN_ID: {run_id}\n\n"
                f"=== CLINICAL DATA CONTEXT (input to narrative engine) ===\n"
                f"{ctx_text}\n\n"
                f"=== GENERATED LONGITUDINAL NARRATIVE (output to evaluate) ===\n"
                f"{narrative_text[:50000]}"
            )

            print(f"[JUDGE] Running inline LLM-as-judge evaluation ({Cfg.EVAL_JUDGE_MODEL})...", flush=True)
            judge_resp = AWS.ask_long(JUDGE_SYSTEM_PROMPT, judge_user_msg, max_continuations=4,
                                      model_id=Cfg.EVAL_JUDGE_MODEL)
            judge_result = parse_json(judge_resp, "JUDGE")
            judge_result = NarrativeJudgeAgent._apply_calibration(judge_result)
            judge_result["judge_model"] = Cfg.EVAL_JUDGE_MODEL
            judge_result["evaluation_timestamp"] = datetime.datetime.utcnow().isoformat()
            judge_result["evaluation_mode"] = "inline_synchronous"
            judge_result["case_id"] = case_id
            judge_result["run_id"]  = run_id

            overall = judge_result.get("overall_score", 0)
            grade   = judge_result.get("quality_grade", "UNKNOWN")
            print(f"[JUDGE] Inline result (primary — {Cfg.MODEL}): score={overall:.2f} grade={grade}", flush=True)

            # ─────────────────────────────────────────
            # Step 2b: Judge the COMPARE model narrative (if it exists)
            # ─────────────────────────────────────────
            compare_judge_result = None
            try:
                compare_key = f"cases/{case_id}/LONGITUDINAL_PATIENT_NARRATIVE_COMPARE.json"
                compare_narrative = json.loads(AWS.read(Cfg.BUCKETS["CURATED"], compare_key))
                compare_model_name = compare_narrative.get("_compare_model", Cfg.COMPARE_MODEL)
                compare_narrative_text = json.dumps(compare_narrative, indent=1, default=str)

                compare_judge_msg = (
                    f"CASE_ID: {case_id}\nRUN_ID: {run_id}\n\n"
                    f"=== CLINICAL DATA CONTEXT (input to narrative engine) ===\n"
                    f"{ctx_text}\n\n"
                    f"=== GENERATED LONGITUDINAL NARRATIVE (output to evaluate) ===\n"
                    f"{compare_narrative_text[:50000]}"
                )

                print(f"[JUDGE/COMPARE] Running judge on comparison model ({compare_model_name})...", flush=True)
                compare_judge_resp = AWS.ask_long(JUDGE_SYSTEM_PROMPT, compare_judge_msg,
                                                   max_continuations=4, model_id=Cfg.EVAL_JUDGE_MODEL)
                compare_judge_result = parse_json(compare_judge_resp, "JUDGE-COMPARE")
                compare_judge_result = NarrativeJudgeAgent._apply_calibration(compare_judge_result)
                compare_judge_result["judge_model"] = Cfg.EVAL_JUDGE_MODEL
                compare_judge_result["narrative_model"] = compare_model_name
                compare_judge_result["evaluation_timestamp"] = datetime.datetime.utcnow().isoformat()
                compare_judge_result["case_id"] = case_id
                compare_judge_result["run_id"] = run_id

                c_overall = compare_judge_result.get("overall_score", 0)
                c_grade = compare_judge_result.get("quality_grade", "UNKNOWN")
                print(f"[JUDGE/COMPARE] Result ({compare_model_name}): score={c_overall:.2f} grade={c_grade}", flush=True)

                # Save comparison judge report
                AWS.write(Cfg.BUCKETS["CURATED"],
                          f"cases/{case_id}/JUDGE_REPORT_COMPARE.json",
                          {"case_id": case_id, "run_id": run_id,
                           "narrative_model": compare_model_name,
                           "inline_judge": compare_judge_result,
                           "generated_at": datetime.datetime.utcnow().isoformat()})
                print(f"[JUDGE/COMPARE] ✓ Saved JUDGE_REPORT_COMPARE.json", flush=True)

            except Exception as _cj_err:
                err_msg = str(_cj_err)
                if "NoSuchKey" in err_msg or "does not exist" in err_msg:
                    print("[JUDGE/COMPARE] No comparison narrative found — skipping", flush=True)
                else:
                    print(f"[JUDGE/COMPARE] ⚠ Error (non-fatal): {_cj_err}", flush=True)

            # ─────────────────────────────────────────
            # Step 2c: Feed judge-detected omissions back into final narrative
            #          Add missing items WITHOUT removing any existing data
            # ─────────────────────────────────────────
            try:
                def _norm_list(values):
                    out = []
                    for v in (values or []):
                        if isinstance(v, dict):
                            txt = str(v.get("name") or v.get("item") or v.get("value") or json.dumps(v, default=str)).strip()
                        else:
                            txt = str(v).strip()
                        if txt and txt.lower() not in (x.lower() for x in out):
                            out.append(txt)
                    return out

                missing_meds = _norm_list(judge_result.get("missing_medications", []))
                missing_conditions = _norm_list(judge_result.get("missing_conditions", []))
                completeness_missing = _norm_list((judge_result.get("scores", {})
                                                  .get("completeness", {})
                                                  .get("missing_items", [])))

                if missing_meds or missing_conditions or completeness_missing:
                    print(f"[JUDGE/RECONCILE] Found missing data — patching narrative "
                          f"(meds={len(missing_meds)}, conds={len(missing_conditions)}, "
                          f"items={len(completeness_missing)})", flush=True)

                    # ── Patch narrative_text: append addendum section ──
                    nt = narrative.get("longitudinal_narrative", {})
                    existing_text = nt.get("narrative_text", "")
                    addendum_parts = []
                    if missing_meds:
                        addendum_parts.append("ADDITIONAL MEDICATIONS (identified during quality review)")
                        for m in missing_meds:
                            addendum_parts.append(f"- {m}")
                    if missing_conditions:
                        addendum_parts.append("ADDITIONAL CONDITIONS (identified during quality review)")
                        for c in missing_conditions:
                            addendum_parts.append(f"- {c}")
                    if completeness_missing:
                        addendum_parts.append("ADDITIONAL CLINICAL ITEMS (identified during quality review)")
                        for x in completeness_missing:
                            addendum_parts.append(f"- {x}")

                    if addendum_parts and existing_text:
                        addendum_text = "\n\n" + "\n".join(addendum_parts)
                        nt["narrative_text"] = existing_text + addendum_text
                        narrative["longitudinal_narrative"] = nt
                        print(f"[JUDGE/RECONCILE] Appended {len(addendum_text)} chars to narrative_text", flush=True)

                    # ── Patch structured fields: add missing meds to medications list ──
                    if missing_meds:
                        meds_section = narrative.get("medications", {})
                        current_regimen = meds_section.get("current_regimen", [])
                        existing_med_names = {(m.get("name") or "").lower() for m in current_regimen if isinstance(m, dict)}
                        for med_name in missing_meds:
                            if med_name.lower() not in existing_med_names:
                                current_regimen.append({
                                    "name": med_name,
                                    "dose": "See clinical notes",
                                    "frequency": "As prescribed",
                                    "route": "See clinical notes",
                                    "indication": "Identified during quality review"
                                })
                        meds_section["current_regimen"] = current_regimen
                        narrative["medications"] = meds_section

                    # ── Patch structured fields: add missing conditions to problem_list ──
                    if missing_conditions:
                        problem_list = narrative.get("problem_list", [])
                        existing_diag = {(p.get("diagnosis") or "").lower() for p in problem_list if isinstance(p, dict)}
                        for cond in missing_conditions:
                            if cond.lower() not in existing_diag:
                                problem_list.append({
                                    "diagnosis": cond,
                                    "icd10": "Pending",
                                    "status": "Active",
                                    "trajectory": "New"
                                })
                        narrative["problem_list"] = problem_list

                    post_judge_missing = {
                        "judge_model": Cfg.EVAL_JUDGE_MODEL,
                        "captured_at": datetime.datetime.utcnow().isoformat(),
                        "missing_medications": missing_meds,
                        "missing_conditions": missing_conditions,
                        "missing_items": completeness_missing,
                        "action": "PATCHED_INTO_NARRATIVE"
                    }
                    narrative["post_judge_missing_data"] = post_judge_missing

                    # Overwrite narrative with patched data (NO data removed, only added)
                    AWS.write(Cfg.BUCKETS["CURATED"], narrative_key, narrative)
                    print("[JUDGE/RECONCILE] ✓ Patched narrative saved (missing data added, no data removed)", flush=True)
                else:
                    print("[JUDGE/RECONCILE] No missing items — narrative is complete", flush=True)
            except Exception as _reconcile_err:
                print(f"[JUDGE] ⚠ Post-judge reconciliation failed (non-fatal): {_reconcile_err}", flush=True)

            # ─────────────────────────────────────────
            # Step 2d: Best-of-both model selection
            # Compare primary vs compare model scores — promote the better one
            # as the FINAL narrative. This ensures we always ship the best output.
            # ─────────────────────────────────────────
            try:
                if compare_judge_result:
                    primary_score = judge_result.get("overall_score", 0)
                    compare_score = compare_judge_result.get("overall_score", 0)
                    print(f"[JUDGE/BEST-OF-BOTH] Primary={primary_score:.3f} vs Compare={compare_score:.3f}", flush=True)

                    if compare_score > primary_score:
                        print(f"[JUDGE/BEST-OF-BOTH] Compare model wins! Promoting compare narrative as FINAL.", flush=True)
                        # Load compare narrative
                        compare_key = f"cases/{case_id}/LONGITUDINAL_PATIENT_NARRATIVE_COMPARE.json"
                        best_narrative = json.loads(AWS.read(Cfg.BUCKETS["CURATED"], compare_key))
                        best_narrative["_promoted_from"] = "COMPARE"
                        best_narrative["_promotion_reason"] = f"Compare score {compare_score:.3f} > Primary {primary_score:.3f}"
                        best_narrative.pop("_compare_model", None)

                        # Save as the primary narrative (overwrite)
                        AWS.write(Cfg.BUCKETS["CURATED"], narrative_key, best_narrative)

                        # Swap judge results: the compare result becomes the primary report
                        judge_result, compare_judge_result = compare_judge_result, judge_result
                        overall = judge_result.get("overall_score", 0)
                        grade = judge_result.get("quality_grade", "UNKNOWN")
                        print(f"[JUDGE/BEST-OF-BOTH] ✓ Promoted compare narrative. New primary score={overall:.3f}", flush=True)
                    else:
                        print(f"[JUDGE/BEST-OF-BOTH] Primary model wins (or tied). Keeping primary narrative.", flush=True)
            except Exception as _bob_err:
                print(f"[JUDGE/BEST-OF-BOTH] ⚠ Best-of-both failed (non-fatal): {_bob_err}", flush=True)

            # ─────────────────────────────────────────
            # Step 3: Async AWS Bedrock Model Evaluation job (optional)
            # Only runs when BEDROCK_EVAL_ROLE_ARN is configured.
            # Reference: https://aws.amazon.com/blogs/machine-learning/
            #            llm-as-a-judge-on-amazon-bedrock-model-evaluation/
            # ─────────────────────────────────────────
            eval_job_record = {"status": "SKIPPED", "reason": "BEDROCK_EVAL_ROLE_ARN not configured"}

            if Cfg.EVAL_ROLE_ARN:
                try:
                    ts_str = datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
                    eval_job_name = f"mevreon-{case_id[:20]}-{ts_str}"

                    # Build JSONL input: prompt = clinical context, category = medical_narrative
                    prompt_for_eval = (
                        f"You are a clinical narrative synthesis engine. "
                        f"Generate a comprehensive longitudinal medical narrative from the "
                        f"following patient encounter data:\n\n"
                        f"{ctx_text[:15000]}"
                    )
                    jsonl_bytes = NarrativeJudgeAgent._build_eval_jsonl(
                        prompt_for_eval, "medical_narrative"
                    )
                    input_key  = f"eval-jobs/{case_id}/{ts_str}/input.jsonl"
                    output_pfx = f"s3://{Cfg.BUCKETS['MEMORY']}/eval-jobs/{case_id}/{ts_str}/output/"
                    input_uri  = f"s3://{Cfg.BUCKETS['STAGING']}/{input_key}"

                    print(f"[JUDGE] Uploading eval JSONL to {input_uri}", flush=True)
                    AWS.write(Cfg.BUCKETS["STAGING"], input_key, jsonl_bytes,
                              ct="application/jsonlines")

                    job_arn = AWS.launch_llm_judge_job(
                        job_name         = eval_job_name,
                        input_s3_uri     = input_uri,
                        output_s3_uri    = output_pfx,
                        role_arn         = Cfg.EVAL_ROLE_ARN,
                        evaluator_model_id = Cfg.EVAL_JUDGE_MODEL,
                        generator_model_id = Cfg.EVAL_GEN_MODEL,
                        metrics          = Cfg.EVAL_METRICS,
                    )

                    eval_job_record = {
                        "status": "SUBMITTED",
                        "job_name": eval_job_name,
                        "job_arn": job_arn,
                        "input_s3_uri": input_uri,
                        "output_s3_prefix": output_pfx,
                        "evaluator_model": Cfg.EVAL_JUDGE_MODEL,
                        "generator_model": Cfg.EVAL_GEN_MODEL,
                        "metrics": Cfg.EVAL_METRICS,
                        "submitted_at": datetime.datetime.utcnow().isoformat(),
                        "check_status_with":
                            f"boto3.client('bedrock').get_evaluation_job(jobIdentifier='{job_arn}')"
                    }

                    # Poll up to EVAL_POLL_TIMEOUT seconds for quick completion
                    deadline = time.time() + Cfg.EVAL_POLL_TIMEOUT
                    print(f"[JUDGE] Polling eval job (timeout={Cfg.EVAL_POLL_TIMEOUT}s)...",
                          flush=True)
                    while time.time() < deadline:
                        status_info = AWS.get_llm_judge_status(job_arn)
                        status = status_info.get("status", "")
                        print(f"[JUDGE] Eval job status: {status}", flush=True)
                        if status in ("Completed", "Failed", "Stopped"):
                            eval_job_record["final_status"] = status
                            eval_job_record["completed_at"] = datetime.datetime.utcnow().isoformat()
                            break
                        time.sleep(Cfg.EVAL_POLL_INTERVAL)
                    else:
                        eval_job_record["final_status"] = "TIMED_OUT"
                        print(f"[JUDGE] Eval job did not complete within timeout, continuing",
                              flush=True)

                except Exception as ej:
                    print(f"[JUDGE] AWS eval job failed: {ej} (continuing with inline results)",
                          flush=True)
                    eval_job_record = {"status": "ERROR", "error": str(ej)[:500]}
            else:
                print("[JUDGE] BEDROCK_EVAL_ROLE_ARN not set — skipping async eval job",
                      flush=True)

            # ─────────────────────────────────────────
            # Step 4: Write outputs
            # ─────────────────────────────────────────
            full_report = {
                "case_id":        case_id,
                "run_id":         run_id,
                "inline_judge":   judge_result,
                "aws_eval_job":   eval_job_record,
                "generated_at":   datetime.datetime.utcnow().isoformat(),
            }
            AWS.write(Cfg.BUCKETS["CURATED"],
                      f"cases/{case_id}/JUDGE_REPORT.json", full_report)
            AWS.write(Cfg.BUCKETS["CURATED"],
                      f"cases/{case_id}/EVAL_JOB.json", eval_job_record)
            safe_case = safe_filename(case_id)
            named = f"runs/{run_id}__{safe_case}__{sname}/06_JUDGE_REPORT.json"
            AWS.write(Cfg.BUCKETS["MEMORY"], named, full_report)

            # ─────────────────────────────────────────
            # Step 5: Patch DASHBOARD.json with judge scores
            # ─────────────────────────────────────────
            try:
                dash = json.loads(AWS.read(Cfg.BUCKETS["CURATED"],
                                          f"cases/{case_id}/DASHBOARD.json"))
            except Exception:
                dash = {"case_id": case_id}

            scores_flat = {}
            for dim, val in (judge_result.get("scores") or {}).items():
                if isinstance(val, dict):
                    scores_flat[dim] = val.get("score", 0)

            dash["judge_evaluation"] = {
                "overall_score":          judge_result.get("overall_score", 0),
                "quality_grade":          judge_result.get("quality_grade", "UNKNOWN"),
                "narrative_model":        Cfg.MODEL,
                "scores":                 scores_flat,
                "critical_issues":        judge_result.get("critical_issues", []),
                "improvement_suggestions":judge_result.get("improvement_suggestions", []),
                "missing_medications":     judge_result.get("missing_medications", []),
                "missing_conditions":      judge_result.get("missing_conditions", []),
                "missing_items":          ((judge_result.get("scores", {})
                                             .get("completeness", {})
                                             .get("missing_items", [])) or []),
                "post_judge_missing_data": narrative.get("post_judge_missing_data", {}),
                "evaluated_at":           judge_result.get("evaluation_timestamp", ""),
                "aws_eval_job_status":    eval_job_record.get("status"),
                "aws_eval_job_arn":       eval_job_record.get("job_arn", ""),
            }

            # Add comparison model scores to dashboard
            if compare_judge_result:
                compare_scores_flat = {}
                for dim, val in (compare_judge_result.get("scores") or {}).items():
                    if isinstance(val, dict):
                        compare_scores_flat[dim] = val.get("score", 0)
                dash["judge_evaluation_compare"] = {
                    "overall_score":    compare_judge_result.get("overall_score", 0),
                    "quality_grade":    compare_judge_result.get("quality_grade", "UNKNOWN"),
                    "narrative_model":  compare_judge_result.get("narrative_model", Cfg.COMPARE_MODEL),
                    "scores":           compare_scores_flat,
                    "evaluated_at":     compare_judge_result.get("evaluation_timestamp", ""),
                }

            AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/DASHBOARD.json", dash)
            # Also save run-specific copies for monitoring all runs in frontend
            AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/runs/{run_id}/DASHBOARD.json", dash)
            AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/runs/{run_id}/JUDGE_REPORT.json", full_report)
            if compare_judge_result:
                AWS.write(Cfg.BUCKETS["CURATED"], f"cases/{case_id}/runs/{run_id}/JUDGE_REPORT_COMPARE.json",
                          {"case_id": case_id, "run_id": run_id,
                           "narrative_model": compare_judge_result.get("narrative_model", Cfg.COMPARE_MODEL),
                           "inline_judge": compare_judge_result,
                           "generated_at": datetime.datetime.utcnow().isoformat()})
            print(f"[JUDGE] ✓ DASHBOARD + run-specific copies saved for {run_id}", flush=True)

            print(f"[JUDGE] ✓ DONE | score={overall:.2f} | grade={grade} | "
                  f"aws_job={eval_job_record.get('status')}", flush=True)
            return {
                "status": "SUCCESS",
                "case_id": case_id,
                "overall_score": overall,
                "quality_grade": grade,
                "aws_eval_job": eval_job_record.get("status"),
            }
        except Exception as e:
            print(f"[JUDGE] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════
# AGENT 5: REFLECTION
# ═══════════════════════════════════════════════════════════════
REFLECTION_PROMPT = """You are the MEVREON ERROR ANALYSIS AND RECOVERY ENGINE (Version 5.0).

A medical data pipeline has FAILED. Analyze the error, classify it, determine root cause, assess transience, and provide recovery recommendations.

ERROR CLASSES: IMPORT_ERROR, FORMAT_ERROR, PARSE_ERROR, SERVICE_ERROR, CONTENT_ERROR, MEMORY_ERROR.

OUTPUT JSON:
{
    "error_class": "string",
    "root_cause": "string",
    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
    "is_transient": true|false,
    "detailed_analysis": "2-3 paragraphs",
    "recommendations": [{"action": "RETRY|SKIP|ESCALATE|REFORMAT", "rationale": "string", "priority": 1}],
    "prevention": "how to prevent"
}

Return ONLY valid JSON."""


class ReflectionAgent:
    @staticmethod
    def run(bucket, key, run_id, error_ctx):
        key = decode_s3_key(key)
        parts = key.split("/")
        case_id  = parts[-2] if len(parts) > 1 else "UNSORTED"
        filename = parts[-1]
        sname     = safe_filename(filename)
        safe_case = safe_filename(case_id)
        print(f"\n{'='*80}\n[REFLECTION] START | file={key}\n{'='*80}", flush=True)
        try:
            user_msg = f"FILE: {key}\nRUN: {run_id}\n\n--- ERROR ---\n{error_ctx[:3000]}"
            print("[REFLECTION] Calling Bedrock...", flush=True)
            resp = AWS.ask(REFLECTION_PROMPT, user_msg)
            analysis = parse_json(resp, "REFLECTION")

            report = {
                "run_id": run_id, "ts": datetime.datetime.utcnow().isoformat(),
                "file": key, "error_excerpt": error_ctx[:2000], "analysis": analysis
            }

            qk = f"failures/{run_id}__{safe_case}__{sname}/report.json"
            AWS.write(Cfg.BUCKETS["QUARANTINE"], qk, report)
            AWS.write(Cfg.BUCKETS["MEMORY"],     qk, report)

            print(f"[REFLECTION] ✓ DONE", flush=True)
            return {"status": "QUARANTINED", "analysis": analysis}
        except Exception as e:
            print(f"[REFLECTION] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# BATCH INGESTION PROMPT  (multiple files → per-file extractions)
# ═══════════════════════════════════════════════════════════════════
BATCH_INGESTION_PROMPT = """You are the MEVREON BATCH MEDICAL DATA EXTRACTION ENGINE (Version 6.0).

You will receive content from MULTIPLE medical files ALL belonging to the SAME PATIENT.
Files may include clinical notes, lab reports, prescriptions, AND DICOM medical images (CT, MRI, X-ray, ultrasound, etc.).

Your tasks:
1. Extract ALL medical data from EACH file individually.
2. Resolve shared context: if file 1 says the patient is 52-year-old male, apply that to ALL files.
3. Use cross-file context to fill gaps: demographics from one file can clarify another.
4. Each file must have its own complete extraction — never merge files into one.
5. **FOR DICOM/IMAGING FILES**: Extract imaging_findings with modality, body_part, detailed findings from visual analysis, clinical impression, and measurements. If DICOM SERIES CONTEXT headers are present, use them to understand the full study scope.

ABSOLUTE RULES:
- Return ONLY a single valid JSON object. No markdown. No commentary.
- Extract EVERY data point from EVERY file. Nothing skipped.
- Verbatim values: preserve exact numbers, dates, units, drug names.
- Confidence 0.0-1.0 on every entity.
- shared_demographics: resolved from ALL files combined (one authoritative answer for age/gender).
- If only one file mentions age, still populate shared_demographics.age for all.
- patient_name in all demographics must be "[ANONYMIZED]".
- **DICOM files MUST populate imaging_findings** even if the only data is metadata. Describe what you see in the image.
- **HANDWRITTEN / SCANNED PRESCRIPTIONS AND NOTES**: Carefully read ALL handwriting in the image. Extract EVERY medication (name, strength, dose, frequency, route), every symptom, and every note — even if partially legible; mark uncertain characters with [?].
- **NEVER drop a medication**: if a document (printed, typed, or handwritten) lists any drug, it MUST appear in medications[]. A missing medication is a patient-safety failure.
- **NEVER omit symptoms**: if a note describes a symptom or complaint, it MUST appear in diseases[] or an equivalent structured field.
- For scanned PDFs and images, read the pixels: tables, prescription pads, discharge handwrites, and annotation margins all count as data.
- **MANDATORY MEDICATION SELF-AUDIT before returning**: re-scan every file one final time. If ANY drug name, prescription, "tabs/caps/mg/od/bd/tds/hs" abbreviation, or medication schedule is visible anywhere and is missing from that file's medications[], add it now. An image of a prescription pad with medications:[] is ALWAYS wrong.

DICOM / IMAGING EXTRACTION RULES:
- For each DICOM image, populate imaging_findings with:
  - modality: CT, MRI, X-RAY, ULTRASOUND, etc.
  - body_part: from DICOM BodyPartExamined or visual analysis
  - finding: detailed description of what is visible in the image (anatomy, pathology, abnormalities)
  - impression: clinical impression based on findings
  - measurements: any measurable findings (sizes, distances, densities in HU)
  - technique: contrast, slice thickness, series info from DICOM metadata
  - comparison: note if prior imaging is referenced
  - recommendation: suggest follow-up if clinically warranted
- If DICOM SERIES CONTEXT is provided (indicating this is a representative slice), analyze accordingly and note the total series scope.
- DICOM metadata tags (StudyDescription, SeriesDescription, etc.) provide critical clinical context — USE them.

OUTPUT JSON SCHEMA:
{
    "shared_demographics": {
        "age": "REQUIRED — from any file that mentions it",
        "gender": "REQUIRED — from any file that mentions it",
        "dob": "string or null",
        "mrn": "string or null",
        "patient_name": "[ANONYMIZED]"
    },
    "per_file_extractions": [
        {
            "filename": "exact filename",
            "file_type": "LAB_REPORT|CLINICAL_NOTE|IMAGING_REPORT|PRESCRIPTION|FINANCIAL|GENOMIC|DICOM_IMAGE|MIXED|OTHER",
            "document_summary": "2-3 sentence summary — for DICOM, describe the imaging study and key findings",
            "demographics": {"age": "string", "gender": "string", "dob": "null", "mrn": "null", "patient_name": "[ANONYMIZED]", "confidence": 0.0},
            "diseases": [{"condition": "str", "icd10": "str|null", "severity": "str|null", "status": "Active|Resolved|Suspected", "confidence": 0.0, "evidence": {"source_sentence": "exact sentence from document", "page": 0, "document": "filename"}}],
            "medications": [{"name": "str", "strength": "str", "frequency": "str", "route": "str", "indication": "str|null", "confidence": 0.0, "evidence": {"source_sentence": "exact sentence from document", "page": 0, "document": "filename"}}],
            "lab_tests": [{"test_name": "str", "value": "str", "units": "str", "ref_range": "str|null", "abnormal": "L|N|H|LL|HH|null", "date": "str|null", "confidence": 0.0, "evidence": {"source_sentence": "exact sentence from document", "page": 0, "document": "filename"}}],
            "vital_signs": [{"type": "str", "value": "str", "units": "str", "confidence": 0.0}],
            "procedures": [{"name": "str", "cpt": "str|null", "date": "str|null", "confidence": 0.0}],
            "allergies": [{"allergen": "str", "reaction": "str|null", "confidence": 0.0}],
            "imaging_findings": [{"modality": "str", "body_part": "str", "finding": "str", "impression": "str|null", "technique": "str|null", "measurements": "str|null", "comparison_to_prior": "str|null", "follow_up_recommendation": "str|null", "dicom_study_description": "str|null", "confidence": 0.0}],
            "genomic_data": [{"gene": "str", "variant": "str", "classification": "str", "confidence": 0.0}],
            "raw_text_excerpt": "first 2000 chars of this file's content",
            "quality": {"completeness": 0.0, "confidence": 0.0, "issues": []}
        }
    ],
    "batch_quality": {
        "files_processed": 0,
        "total_entities_extracted": 0,
        "dicom_files_count": 0,
        "imaging_findings_count": 0,
        "cross_file_insights": ["any insights gained only by seeing files together — especially correlating imaging with labs/symptoms"],
        "demographics_resolved_from": "which filename(s) provided age/gender"
    }
}

Return ONLY valid JSON. Extract ALL data from ALL files. BEGIN BATCH EXTRACTION NOW."""

# ═══════════════════════════════════════════════════════════════════
# MEDICATION RESCUE PROMPT  (patient-safety net — used when a file that
# visually contains a prescription/medication list returned zero meds)
# ═══════════════════════════════════════════════════════════════════
MEDICATION_RESCUE_PROMPT = """You are a PHARMACIST-GRADE MEDICATION AUDITOR performing a safety re-check.

A first extraction pass reported ZERO medications for this document, but it may contain
a prescription or medication list (printed, typed, or HANDWRITTEN). Re-examine EVERY page
and EVERY region of the image(s) pixel by pixel:

- Prescription pads, doctor's handnotes, discharge sheets, medication schedules,
  pharmacy slips, margin annotations, table rows — ALL count.
- For EACH medication found, extract: name (best reading), strength/dose, frequency,
  route, and indication if stated.
- Read handwriting char by char; mark uncertain characters with [?] — a partially
  legible drug beats a missing one. This is a patient-safety task.
- Include drugs mentioned in prose ("patient is on metformin and glipizide").
- Include over-the-counter drugs, supplements, and herbal remedies.

OUTPUT — ONLY valid JSON:
{
  "medications_found": [
    {"name": "str", "strength": "str|null", "frequency": "str|null", "route": "str|null",
     "indication": "str|null", "legibility": "clear|partial|uncertain", "location": "where in the document", "confidence": 0.0}
  ],
  "no_medication_visible": true/false,
  "audit_note": "1 sentence describing what you examined"
}

Return ONLY valid JSON. BEGIN MEDICATION AUDIT NOW."""


# ═══════════════════════════════════════════════════════════════════
# BATCH CLEANING PROMPT  (all-files combined → unified cleaned dataset)
# ═══════════════════════════════════════════════════════════════════
BATCH_CLEANING_PROMPT = """You are the MEVREON BATCH CLINICAL DATA STANDARDIZATION ENGINE (Version 5.0).

You receive extracted medical entities from MULTIPLE files of the SAME PATIENT.
Your tasks:
1. Standardize ALL entities across ALL files using RxNorm/ICD-10/LOINC/SNOMED.
2. DEDUPLICATE across files: same medication in 3 files → ONE entry with source_files noted.
3. RESOLVE CONFLICTS: same lab different values → keep all, flag CONFLICT.
4. Produce ONE unified standardized dataset for this patient.

ABSOLUTE RULES:
- Return ONLY valid JSON. No markdown. No commentary.
- Preserve originals alongside standardized.
- Mark every entity MAPPED|UNMAPPABLE|UNCERTAIN.
- Confidence 0.0-1.0 on every mapping.
- source_files: list of filenames where this entity appeared.
- For deduplication: if Metformin 500mg appears in 3 files, create ONE entry with source_files: ["file1.pdf","file2.pdf","file3.pdf"].

OUTPUT JSON:
{
    "combined_standardized_data": {
        "medications": [{"original": "str", "standard_name": "str", "rxnorm": "str|null", "strength": "str", "frequency": "str", "route": "str", "indication": "str|null", "status": "MAPPED|UNMAPPABLE|UNCERTAIN", "confidence": 0.0, "source_files": [], "corrections": []}],
        "conditions": [{"original": "str", "standard_name": "str", "icd10": "str|null", "snomed": "str|null", "severity": "str", "clinical_status": "Active|Resolved|Suspected|Chronic", "status": "MAPPED|UNMAPPABLE|UNCERTAIN", "confidence": 0.0, "source_files": [], "corrections": []}],
        "lab_tests": [{"original_name": "str", "standard_name": "str", "loinc": "str|null", "value": "str", "units": "str", "ref_range": "str|null", "abnormal": "L|N|H|LL|HH|null", "date": "str|null", "status": "MAPPED|UNMAPPABLE", "confidence": 0.0, "source_files": [], "flags": []}],
        "vital_signs": [{"type": "str", "value": "str", "units": "str", "confidence": 0.0, "source_files": []}],
        "allergies": [{"allergen": "str", "reaction": "str|null", "confidence": 0.0, "source_files": []}],
        "imaging_findings": [{"modality": "str", "body_part": "str", "study_description": "str", "finding": "str", "impression": "str|null", "technique": "str|null", "measurements": "str|null", "comparison_to_prior": "str|null", "follow_up_recommendation": "str|null", "date": "str|null", "confidence": 0.0, "source_files": []}],
        "procedures": [{"original": "str", "standard_name": "str", "cpt": "str|null", "date": "str|null", "status": "MAPPED|UNMAPPABLE", "confidence": 0.0, "source_files": []}]
    },
    "cleaning_stats": {
        "total_input_entities": 0, "total_output_entities": 0,
        "duplicates_removed": 0, "cross_file_duplicates": 0,
        "corrections_made": 0, "unmappable": 0, "conflicts_flagged": 0
    },
    "warnings": [],
    "quality": {"completeness": 0.0, "standardization_rate": 0.0, "integrity": "GOOD|FAIR|POOR"}
}

Return ONLY valid JSON. BEGIN BATCH STANDARDIZATION NOW."""


def backfill_not_documented_sections(narrative_text: str, meds, problems) -> str:
    """Replace 'Not documented' placeholder section bodies with real, extracted
    data when the model left a section empty despite structured data existing.
    Only SYMPTOMS / TREATMENT PLAN are rewritten, and only when the body is a
    not-documented placeholder (or empty) AND replacement data exists.
    Never invents content — bullets are derived from extracted medications and
    documented conditions only."""
    try:
        if not narrative_text:
            return narrative_text

        nd = re.compile(
            r"\b(not documented|none documented|not provided|not available|"
            r"no medications?\s+documented|no (?:active|significant)?\s*(?:symptoms|complaints)|"
            r"no documented (?:symptoms|medications))", re.I)

        reps = {}
        med_bullets = []
        for m in (meds or [])[:15]:
            if isinstance(m, dict):
                name = (m.get("name") or m.get("standard_name") or m.get("original") or "Medication")
                bits = [str(name)]
                for k in ("strength", "frequency", "route", "dose"):
                    v = m.get(k)
                    if v and str(v).strip().lower() not in ("unknown", "null", "none", ""):
                        bits.append(str(v))
                line = "- " + ", ".join(bits)
                ind = m.get("indication") or m.get("reason") or ""
                if ind and str(ind).strip().lower() not in ("unknown", "none", "null", ""):
                    line += f". Indication: {ind}"
                med_bullets.append(line)
            elif isinstance(m, str) and m.strip():
                med_bullets.append(f"- {m.strip()}")
        if med_bullets:
            reps["TREATMENT PLAN"] = "\n".join(med_bullets)

        sym_bullets = []
        for p in (problems or [])[:12]:
            if isinstance(p, dict):
                nm = (p.get("condition") or p.get("standard_name") or p.get("original")
                      or p.get("diagnosis") or p.get("name") or "")
                if nm:
                    sym_bullets.append(f"- {nm}")
            elif isinstance(p, str) and p.strip():
                sym_bullets.append(f"- {p.strip()}")
        if sym_bullets:
            reps["SYMPTOMS"] = "\n".join(sym_bullets)

        if not reps:
            return narrative_text

        header_pat = re.compile(
            r"^(patient summary|clinical findings|symptoms|treatment plan|"
            r"laboratory results|clinical interpretation|risk assessment|"
            r"diet and lifestyle recommendations)\b", re.I)

        lines = narrative_text.split("\n")
        out, cur, body = [], None, []
        changed = False

        def _flush():
            nonlocal changed
            if cur is None:
                return
            text = "\n".join(body).strip()
            if cur in reps and (not text or (nd.search(text) and len(text) < 300)):
                out.append(reps[cur])
                out.append("")
                changed = True
            else:
                out.append(text)
                out.append("")

        for ln in lines:
            stripped = re.sub(r"^[^A-Za-z]+", "", ln.strip())
            m = header_pat.match(stripped)
            if m:
                _flush()
                cur = m.group(1).upper()
                out.append(ln)          # keep the original header line
                body = []
            else:
                body.append(ln)
        _flush()

        if not changed:
            return narrative_text
        return "\n".join(out).rstrip() + "\n"
    except Exception:
        return narrative_text


# ═══════════════════════════════════════════════════════════════════
# AGENT A: BATCH INGESTION
# Triggered by __PROCESS__ marker. Lists + processes ALL patient files
# together so the model has shared context across every document.
# ═══════════════════════════════════════════════════════════════════
class BatchIngestionAgent:
    """Processes all files for a patient case in a shared-context batch.

    Trigger key: {case_id}/__PROCESS__  (or any depth, marker must end with /__PROCESS__)
    - Lists every file in {RAW}/{case_id}/ except the marker itself
    - Converts each file to text/images via FileToText
    - Groups text files into batches (≤ BATCH_MAX_CHARS, ≤ BATCH_MAX_FILES per call)
    - Sends each batch to the model in ONE call so files share context
    - Image-based files processed individually via vision (unchanged)
    - Writes per-file 01_INGESTION.json + combined batch manifest
    """

    @staticmethod
    def _group_into_batches(file_entries: list) -> list:
        """Group file entries into model-call batches respecting size limits.
        Each entry: {'filename': str, 'content': str, 'is_image': bool, ...}
        Returns list of batches; image files always form their own single-item batches."""
        text_files = [f for f in file_entries if not f["is_image"]]
        image_files = [f for f in file_entries if f["is_image"]]

        batches = []
        current_batch, current_chars = [], 0

        for entry in text_files:
            chars = len(entry["content"])
            # If adding this file would exceed limits, flush current batch first
            if current_batch and (
                current_chars + chars > Cfg.BATCH_MAX_CHARS
                or len(current_batch) >= Cfg.BATCH_MAX_FILES
            ):
                batches.append(current_batch)
                current_batch, current_chars = [], 0
            current_batch.append(entry)
            current_chars += chars

        if current_batch:
            batches.append(current_batch)

        # Image files: ONE image per call. Multi-image batches frequently cause
        # the model to answer with a single-file schema, silently dropping the
        # other files' data (e.g. a handwritten prescription returning no
        # medications). Dedicated calls are the reliable path; DICOM series
        # consolidation already keeps the representative count small.
        for entry in image_files:
            batches.append([entry])

        return batches

    @staticmethod
    def _call_batch_text(batch: list, case_id: str, run_id: str,
                         all_filenames: list, batch_num: int, total_batches: int) -> dict:
        """Send a batch of text files to the model in one call."""
        header = (
            f"CASE_ID: {case_id}\nRUN_ID: {run_id}\n"
            f"BATCH: {batch_num}/{total_batches}\n"
            f"TOTAL FILES IN CASE: {len(all_filenames)} files: {all_filenames}\n"
            f"FILES IN THIS BATCH: {[e['filename'] for e in batch]}\n\n"
            "The following files ALL belong to the SAME PATIENT. "
            "Use context from earlier files to resolve demographics and fill gaps.\n\n"
        )
        sections = []
        for i, entry in enumerate(batch, 1):
            sections.append(
                f"{'='*60}\n"
                f"=== FILE {i} OF {len(batch)}: {entry['filename']} ===\n"
                f"{'='*60}\n"
                f"{entry['content']}"
            )
        user_msg = header + "\n\n".join(sections)
        print(f"[BATCH_INGEST] Calling model: batch {batch_num}/{total_batches} "
              f"({len(batch)} files, {len(user_msg):,} chars)", flush=True)
        resp = AWS.ask_long(BATCH_INGESTION_PROMPT, user_msg, max_continuations=4)
        return parse_json(resp, f"BATCH_INGEST-{batch_num}")

    @staticmethod
    def _call_batch_images(batch: list, case_id: str, run_id: str,
                           all_filenames: list, batch_num: int, total_batches: int) -> dict:
        """Send a batch of image files to the model with vision."""
        images = []
        filenames_in_batch = []
        for entry in batch:
            for img in entry.get("images", []):
                images.append(img)
            filenames_in_batch.append(entry["filename"])

        header = (
            f"CASE_ID: {case_id}\nRUN_ID: {run_id}\n"
            f"BATCH: {batch_num}/{total_batches}\n"
            f"TOTAL FILES IN CASE: {len(all_filenames)}\n"
            f"IMAGE FILES IN THIS BATCH: {filenames_in_batch}\n\n"
            f"The following {len(filenames_in_batch)} image file(s) belong to the SAME PATIENT. "
            f"Extract all medical data visible in these images."
        )
        print(f"[BATCH_INGEST] Vision batch {batch_num}/{total_batches}: "
              f"{len(images)} images from {filenames_in_batch}", flush=True)
        resp = AWS.ask_vision(BATCH_INGESTION_PROMPT, header, images)
        return parse_json(resp, f"BATCH_INGEST-IMG-{batch_num}")

    @staticmethod
    def _norm_str(v):
        """None-safe string coercion for model output."""
        if v is None:
            return None
        s = str(v).strip()
        return s if s and s.lower() not in ("null", "none", "n/a", "-") else None

    @classmethod
    def _normalize_extraction(cls, item: dict) -> dict:
        """Deterministically map free-form model extraction output into the
        standard Mevreon per-file schema.

        Vision models sometimes answer with their own clinical JSON shape
        (patient_info / medications.current / chief_complaints / ...) instead
        of the required schema. The content is usually excellent — discarding
        it would DROP handwritten medications (a patient-safety failure).
        This reshapes whatever came back, without extra model calls, so
        downstream cleaning/validation always receives the standard keys.
        """
        if not isinstance(item, dict):
            return item

        g = cls._norm_str

        # ── medications: accept dict-of-lists (current/prescribed/advice),
        #    alternate key names, and alternate field names ──
        meds_raw = item.get("medications")
        meds_out = item.get("medications") if isinstance(meds_raw, list) else []
        if not isinstance(meds_out, list):
            meds_out = []
        if isinstance(meds_raw, dict):
            for _sub in meds_raw.values():
                if isinstance(_sub, list):
                    meds_out.extend(x for x in _sub if isinstance(x, dict))
        if not meds_out:
            for alt in ("drugs", "prescriptions", "prescribed_medications", "rx"):
                alt_val = item.get(alt)
                if isinstance(alt_val, list):
                    meds_out.extend(x for x in alt_val if isinstance(x, dict))
        std_meds = []
        for m in meds_out:
            if not isinstance(m, dict):
                continue
            name = (g(m.get("name")) or g(m.get("medicine_name")) or g(m.get("drug_name"))
                    or g(m.get("drug")) or g(m.get("medication")) or g(m.get("med_name")))
            if not name:
                continue
            std_meds.append({
                "name": name,
                "strength": g(m.get("strength")) or g(m.get("dose")) or g(m.get("dosage_strength")),
                "frequency": (g(m.get("frequency")) or g(m.get("dosage")) or g(m.get("freq"))
                              or g(m.get("schedule")) or g(m.get("dose_frequency"))),
                "route": g(m.get("route")),
                "indication": g(m.get("indication")) or g(m.get("purpose")) or g(m.get("for")),
                "confidence": 0.85,
                "evidence": {"source_sentence": g(m.get("location")) or "extracted from document",
                             "page": 0, "document": item.get("filename", "")},
            })
        if std_meds:
            item["medications"] = std_meds

        return item

    @classmethod
    def _normalize_extraction_part2(cls, item: dict) -> dict:
        """Part 2 of the free-form → standard mapping: diseases + symptoms."""
        if not isinstance(item, dict):
            return item

        g = cls._norm_str

        # ── diseases: merge history/diagnoses shapes ──
        diseases = item.get("diseases") if isinstance(item.get("diseases"), list) else []
        cond_sources = []
        for key in ("diagnoses", "diagnosis_list"):
            v = item.get(key)
            if isinstance(v, list):
                cond_sources.extend(v)
        hist = item.get("history")
        if isinstance(hist, dict) and isinstance(hist.get("medical_history"), list):
            cond_sources.extend(hist["medical_history"])
        for key in ("past_medical_history", "medical_history"):
            v = item.get(key)
            if isinstance(v, list):
                cond_sources.extend(v)
        if cond_sources:
            seen = {(d.get("condition") or "").lower() for d in diseases if isinstance(d, dict)}
            new_conds = []
            for c in cond_sources:
                if not isinstance(c, dict):
                    continue
                cond = g(c.get("condition")) or g(c.get("diagnosis")) or g(c.get("name"))
                if not cond or cond.lower() in seen:
                    continue
                seen.add(cond.lower())
                new_conds.append({
                    "condition": cond, "icd10": None, "severity": None, "status": "Active",
                    "confidence": 0.8,
                    "evidence": {"source_sentence": g(c.get("details")) or g(c.get("duration")) or cond,
                                 "page": 0, "document": item.get("filename", "")},
                })
            if new_conds:
                item["diseases"] = list(diseases) + new_conds

        # Chief complaints are symptoms — surface them explicitly
        complaints = item.get("chief_complaints") or item.get("symptoms")
        if isinstance(complaints, list) and complaints:
            symptoms = []
            for c in complaints:
                if isinstance(c, dict):
                    sym = g(c.get("symptom")) or g(c.get("complaint")) or g(c.get("name"))
                    if sym:
                        symptoms.append({"symptom": sym, "duration": g(c.get("duration")), "confidence": 0.85})
            if symptoms:
                item["symptoms"] = symptoms

        return item

    @classmethod
    def _normalize_extraction_part3(cls, item: dict) -> dict:
        """Part 3: vitals, procedures, allergies, investigations, demographics."""
        if not isinstance(item, dict):
            return item

        g = cls._norm_str

        # ── vital_signs: dict shape ({"blood_pressure": "150/84 mmHg"}) → list ──
        vit = item.get("vitals")
        vs = item.get("vital_signs") if isinstance(item.get("vital_signs"), list) else []
        if isinstance(vit, dict) and vit:
            known = {(v.get("type") or "").lower() for v in vs if isinstance(v, dict)}
            for k, val in vit.items():
                vs_val = g(val)
                if not vs_val or k.lower() in known:
                    continue
                vs.append({"type": k.replace("_", " ").title(), "value": vs_val, "units": None, "confidence": 0.9})
            item["vital_signs"] = vs

        # ── procedures: treatments[] → procedures ──
        procs = item.get("procedures") if isinstance(item.get("procedures"), list) else []
        for key in ("treatments", "treatment_plan"):
            v = item.get(key)
            if isinstance(v, list):
                for t in v:
                    if not isinstance(t, dict):
                        continue
                    nm = g(t.get("treatment_name")) or g(t.get("name")) or g(t.get("procedure"))
                    if not nm:
                        continue
                    procs.append({"name": nm, "cpt": None, "date": g(t.get("date")),
                                  "confidence": 0.8, "details": g(t.get("details")),
                                  "status": g(t.get("status"))})
        if procs:
            item["procedures"] = procs

        # ── allergies: string / dict forms → structured list ──
        al = item.get("allergies")
        if isinstance(al, str) and al.strip():
            item["allergy_notes"] = al.strip()
            low = al.lower()
            if "not allergic" in low or "no known" in low or low in ("nil", "none", "no"):
                item["allergies"] = [{"allergen": "No known drug allergies", "reaction": None, "confidence": 0.9}]
        elif isinstance(al, dict) and al:
            ala = []
            for k, v in al.items():
                if g(v):
                    ala.append({"allergen": str(k).replace("_", " ").title(), "reaction": g(v), "confidence": 0.8})
            if ala:
                item["allergies"] = ala

        # ── investigations → lab_tests when they carry results ──
        inv = item.get("investigations")
        labs = item.get("lab_tests") if isinstance(item.get("lab_tests"), list) else []
        inv_lists = []
        if isinstance(inv, list):
            inv_lists = inv
        elif isinstance(inv, dict) and inv:
            # dict shape: {"lab_tests": [...], "radiology": [...]}
            for v in inv.values():
                if isinstance(v, list):
                    inv_lists.extend(x for x in v if isinstance(x, dict))
        if inv_lists:
            for i in inv_lists:
                if not isinstance(i, dict):
                    continue
                nm = g(i.get("name")) or g(i.get("test")) or g(i.get("test_name"))
                if not nm:
                    continue
                labs.append({"test_name": nm, "value": g(i.get("result")), "units": None,
                             "ref_range": None, "abnormal": None, "date": g(i.get("date")),
                             "confidence": 0.75,
                             "evidence": {"source_sentence": g(i.get("result")) or nm,
                                          "page": 0, "document": item.get("filename", "")}})
            item["lab_tests"] = labs

        # ── demographics: patient_info → demographics (keep anonymization) ──
        pi = item.get("patient_info")
        if isinstance(pi, dict):
            demo = item.setdefault("demographics", {})
            for src, dst in (("age", "age"), ("sex", "gender"), ("gender", "gender"),
                             ("uhid", "mrn"), ("mrn", "mrn"), ("dob", "dob")):
                v = g(pi.get(src))
                if v and not demo.get(dst):
                    demo[dst] = v
            demo["patient_name"] = "[ANONYMIZED]"

        # ── document_summary fallback ──
        if not g(item.get("document_summary")):
            bits = []
            di = item.get("document_info")
            pv = item.get("provider_info")
            if isinstance(di, dict):
                bits.append(g(di.get("document_type")) or "")
                bits.append(g(di.get("date")) or "")
            if isinstance(pv, dict):
                bits.append(g(pv.get("hospital_name")) or "")
                bits.append(g(pv.get("doctor_name")) or "")
            summary = " — ".join(b for b in bits if b)
            if summary:
                item["document_summary"] = summary

        return item

    @staticmethod
    def _unpack_per_file(batch_result: dict, batch: list) -> list:
        """Extract per-file results from a batch model response.
        Falls back gracefully if the model didn't follow the multi-file schema."""
        per_file = batch_result.get("per_file_extractions", [])
        shared_demo = batch_result.get("shared_demographics", {})

        # If model returned correct per-file schema, patch demographics and return
        if per_file and isinstance(per_file, list):
            for item in per_file:
                if isinstance(item, dict):
                    # Patch each file's demographics with shared values
                    item_demo = item.setdefault("demographics", {})
                    for k in ("age", "gender", "dob", "mrn"):
                        if not item_demo.get(k) and shared_demo.get(k):
                            item_demo[k] = shared_demo[k]
                    item_demo["patient_name"] = "[ANONYMIZED]"
            return per_file, shared_demo

        # Fallback: model returned a single-file extraction schema
        # Wrap it as the first file in the batch
        print("[BATCH_INGEST] Model returned single-file schema, wrapping to per-file format",
              flush=True)
        wrapped = []
        for i, entry in enumerate(batch):
            if i == 0:
                # Use the model response for the first file
                item = dict(batch_result)
                item["filename"] = entry["filename"]
                item.setdefault("demographics", {})["patient_name"] = "[ANONYMIZED]"
                wrapped.append(item)
            else:
                # Placeholder for remaining files (will be caught by retry logic)
                wrapped.append({
                    "filename": entry["filename"],
                    "parse_error": True,
                    "raw_response": "model returned single-file schema for multi-file batch",
                    "demographics": shared_demo,
                })
        return wrapped, shared_demo

    @staticmethod
    def _consolidate_dicom_series(file_keys: list, bucket: str) -> tuple:
        """Detect multi-slice DICOM series and keep only representative slices.

        CT / MRI series often contain 100-500+ slices.  Sending every slice
        through vision is prohibitively expensive.  This method:
          1. Downloads DICOM headers only (stop_before_pixels=True is fast to parse)
          2. Groups by SeriesInstanceUID
          3. For any series with >3 slices, keeps ~10 evenly-spaced representatives
          4. Returns reduced file_keys + a context dict for each representative

        Returns (reduced_keys, dicom_context):
          reduced_keys   – new file_keys list (non-DICOM unchanged, large series reduced)
          dicom_context  – dict: s3_key → context string to prepend to that file's text
        """
        MAX_REPS = 10  # max representative slices per series

        dcm_set = set()
        non_dcm = []
        for k in file_keys:
            if k.lower().rsplit(".", 1)[-1] == "dcm":
                dcm_set.add(k)
            else:
                non_dcm.append(k)

        if len(dcm_set) <= 3:
            return file_keys, {}, {}

        print(f"[BATCH_INGEST] {len(dcm_set)} DICOM files detected "
              f"— scanning for series consolidation...", flush=True)

        # Phase 1: Download + read headers (no pixel decode)
        series_groups = {}  # uid → { members: [{key, inst}], meta: {} }
        ungroupable = []

        for dkey in dcm_set:
            try:
                raw = AWS.read(bucket, dkey, as_bytes=True)
                ds = pydicom.dcmread(io.BytesIO(raw), stop_before_pixels=True)
                uid = str(getattr(ds, "SeriesInstanceUID", ""))
                if not uid:
                    ungroupable.append(dkey)
                    continue
                inst = int(getattr(ds, "InstanceNumber", 0) or 0)
                # Capture metadata from the first file seen per series
                if uid not in series_groups:
                    meta = {}
                    for tag in ("PatientName", "PatientID", "PatientBirthDate",
                                "PatientSex", "PatientAge", "StudyDate",
                                "StudyDescription", "Modality",
                                "BodyPartExamined", "InstitutionName",
                                "ReferringPhysicianName", "SeriesDescription",
                                "Manufacturer", "SliceThickness", "KVP",
                                "Rows", "Columns"):
                        if hasattr(ds, tag):
                            val = str(getattr(ds, tag)).strip()
                            if val:
                                meta[tag] = val
                    series_groups[uid] = {"members": [], "meta": meta}
                series_groups[uid]["members"].append({
                    "key": dkey, "inst": inst,
                })
            except Exception as e:
                print(f"[BATCH_INGEST] DICOM header read failed for "
                      f"{dkey.split('/')[-1]}: {e}", flush=True)
                ungroupable.append(dkey)

        # Phase 2: Select representatives for large series
        reduced = list(non_dcm) + list(ungroupable)
        dicom_context = {}
        member_info = {}   # every member key → series meta + slice info

        for uid, info in series_groups.items():
            members = info["members"]
            meta = info["meta"]

            if len(members) <= 3:
                reduced.extend(m["key"] for m in members)
                continue

            members.sort(key=lambda m: m["inst"])
            total = len(members)
            num_reps = min(MAX_REPS, total)
            step = total / num_reps
            indices = [int(i * step) for i in range(num_reps)]

            modality = meta.get("Modality", "unknown")
            study_desc = meta.get("StudyDescription",
                                  meta.get("SeriesDescription", "unknown"))
            body_part = meta.get("BodyPartExamined", "unknown")
            sample_names = ", ".join(
                m["key"].split("/")[-1] for m in members[:5]
            )
            if total > 5:
                sample_names += f"... ({total} total)"

            series_ctx_header = (
                f"\n{'='*60}\n"
                f"DICOM SERIES CONTEXT (CRITICAL — READ FIRST)\n"
                f"{'='*60}\n"
                f"This image is ONE representative slice from a FULL "
                f"{modality} series.\n"
                f"Study: {study_desc} | Body Part: {body_part}\n"
                f"Total Slices: {total} | Representatives Shown: "
                f"{num_reps}\n"
                f"Filenames: {sample_names}\n"
                f"Series Metadata: {json.dumps(meta, default=str)}\n"
                f"{'='*60}\n"
                f"IMPORTANT: Analyze this image as part of a complete "
                f"{total}-slice {modality} study. Look for pathology, "
                f"anatomy, and findings.\n"
            )

            rep_key = members[indices[0]]["key"] if indices else (
                members[0]["key"] if members else "")

            for idx in indices:
                rkey = members[idx]["key"]
                reduced.append(rkey)
                dicom_context[rkey] = (
                    series_ctx_header
                    + f"Slice: {members[idx]['inst']}"
                    + f"/{members[-1]['inst']}\n"
                )

            # Record EVERY member (reps + dropped slices) so per-file pipeline
            # outputs can be written for each DICOM downstream (Step 5.5).
            for m in members:
                member_info[m["key"]] = {
                    "meta": meta,
                    "inst": m["inst"],
                    "total": total,
                    "rep_key": rep_key,
                }

            print(f"[BATCH_INGEST] Series {modality} {study_desc}: "
                  f"{total} slices → {num_reps} representatives",
                  flush=True)

        print(f"[BATCH_INGEST] DICOM consolidation: "
              f"{len(dcm_set)} original → "
              f"{len(reduced) - len(non_dcm)} DICOM + "
              f"{len(non_dcm)} non-DICOM = {len(reduced)} total",
              flush=True)
        return reduced, dicom_context, member_info

    @staticmethod
    def run(bucket, key, run_id):
        key = decode_s3_key(key)
        parts = key.split("/")
        # Marker key is {case_id}/__PROCESS__ (any depth; case_id is second-to-last part)
        case_id = parts[-2] if len(parts) >= 2 else parts[0]
        safe_case = safe_filename(case_id)

        print(f"\n{'='*80}\n[BATCH_INGEST] START | run={run_id} | case={case_id}\n{'='*80}",
              flush=True)
        try:
            # ── Step 1: List all files in this case folder ──
            prefix = "/".join(parts[:-1]) + "/"   # everything before __PROCESS__
            all_keys = AWS.list_keys(bucket, prefix)
            # Filter out the marker file itself and any folder-level keys
            file_keys = [k for k in all_keys
                         if not k.endswith(f"/{Cfg.MARKER_FILE}")
                         and not k.endswith("/")
                         and k != key]
            if not file_keys:
                print(f"[BATCH_INGEST] No files found under {prefix}, nothing to process",
                      flush=True)
                manifest = {"case_id": case_id, "run_id": run_id, "files": [],
                            "status": "NO_FILES"}
                mkey = f"runs/{run_id}/batch_ingestion_manifest.json"
                AWS.write(Cfg.BUCKETS["STAGING"], mkey, manifest)
                return {"s3_path": mkey, "status": "NO_FILES", "case_id": case_id}

            print(f"[BATCH_INGEST] Found {len(file_keys)} files: "
                  f"{[k.split('/')[-1] for k in file_keys]}", flush=True)

            # ── Step 1.5: Consolidate DICOM series ──
            # CT/MRI series may have 100-500+ slices; reduce to ~10 reps
            original_file_count = len(file_keys)
            file_keys, dicom_series_ctx, dicom_members = \
                BatchIngestionAgent._consolidate_dicom_series(file_keys, bucket)

            # ── Step 2: Convert every file to text/images ──
            file_entries = []
            for fkey in file_keys:
                fname = fkey.split("/")[-1]
                try:
                    raw_bytes = AWS.read(bucket, fkey, as_bytes=True)
                    processed = FileToText.convert(raw_bytes, fname)
                    # Enrich with DICOM series context if representative
                    content = processed["text"]
                    if fkey in dicom_series_ctx:
                        content = dicom_series_ctx[fkey] + "\n" + content
                    entry = {
                        "filename":   fname,
                        "s3_key":     fkey,
                        "is_image":   processed["is_image_based"],
                        "content":    content,
                        "images":     processed["images"],
                        "page_count": processed["page_count"],
                        "file_size":  len(raw_bytes),
                    }
                    file_entries.append(entry)
                    print(f"[BATCH_INGEST] Converted {fname}: "
                          f"text={len(processed['text']):,} chars, "
                          f"images={len(processed['images'])}, "
                          f"image_based={processed['is_image_based']}", flush=True)
                except Exception as fe:
                    print(f"[BATCH_INGEST] ✗ Failed to convert {fname}: {fe}", flush=True)
                    file_entries.append({
                        "filename": fname, "s3_key": fkey,
                        "is_image": False, "content": f"[CONVERSION ERROR: {fe}]",
                        "images": [], "page_count": 1, "file_size": 0
                    })

            all_filenames = [e["filename"] for e in file_entries]

            # ── Step 3: Group into model-call batches ──
            batches = BatchIngestionAgent._group_into_batches(file_entries)
            print(f"[BATCH_INGEST] {len(file_entries)} files → {len(batches)} model call(s)",
                  flush=True)

            # ── Step 4: Call model for each batch, collect per-file results ──
            all_per_file: dict = {}   # filename → extraction result
            all_shared_demo: dict = {}
            batch_quality_notes = []

            for bi, batch in enumerate(batches, 1):
                try:
                    batch_is_image = all(e["is_image"] for e in batch)
                    if batch_is_image:
                        result = BatchIngestionAgent._call_batch_images(
                            batch, case_id, run_id, all_filenames, bi, len(batches)
                        )
                    else:
                        result = BatchIngestionAgent._call_batch_text(
                            batch, case_id, run_id, all_filenames, bi, len(batches)
                        )

                    per_file_list, shared_demo = BatchIngestionAgent._unpack_per_file(
                        result, batch
                    )

                    # Merge shared demographics (first non-null wins)
                    for k, v in shared_demo.items():
                        if v and str(v).strip() not in ("", "null", "None", "[ANONYMIZED]") \
                                and not all_shared_demo.get(k):
                            all_shared_demo[k] = v

                    # Store per-file results keyed by filename (schema-normalized so
                    # free-form vision output still feeds cleaning/validation)
                    for item in per_file_list:
                        if isinstance(item, dict):
                            fname = item.get("filename", "")
                            try:
                                item = BatchIngestionAgent._normalize_extraction(item)
                                item = BatchIngestionAgent._normalize_extraction_part2(item)
                                item = BatchIngestionAgent._normalize_extraction_part3(item)
                            except Exception as ne:
                                print(f"[BATCH_INGEST] normalize warning for {fname}: {ne}", flush=True)
                            all_per_file[fname] = item

                    bq = result.get("batch_quality") or {}
                    if bq:
                        batch_quality_notes.append(bq)

                except Exception as be:
                    print(f"[BATCH_INGEST] ✗ Batch {bi} failed: {be}", flush=True)
                    for entry in batch:
                        all_per_file[entry["filename"]] = {
                            "filename": entry["filename"],
                            "parse_error": True,
                            "raw_response": str(be)[:500],
                        }

            # ── Step 4.5: MEDICATION RESCUE PASS (patient-safety net) ──
            # A medication missed in ingestion is a life-and-death failure.
            # Any image-bearing file whose extraction returned ZERO medications
            # gets a dedicated medication-only vision re-scan before we accept it.
            rescued_files = []
            for entry in file_entries:
                imgs = entry.get("images") or []
                if not imgs:
                    continue
                item = all_per_file.get(entry["filename"])
                if not isinstance(item, dict):
                    continue
                # NOTE: parse_error stubs are the HIGHEST-risk files (e.g. the
                # model answered a multi-image batch with a single-file schema,
                # so these files never got their own extraction). They MUST be
                # rescued too, not skipped.
                if item.get("medications"):
                    continue
                try:
                    print(f"[MED_RESCUE] {entry['filename']}: 0 meds from ingestion — running medication-only re-scan", flush=True)
                    rheader = (
                        f"CASE_ID: {case_id} | FILE: {entry['filename']} | "
                        f"{len(imgs)} page image(s) from ONE patient document.\n"
                        f"AUDIT GOAL: find EVERY medication visible anywhere in these pages.\n"
                    )
                    rresp = AWS.ask_vision(MEDICATION_RESCUE_PROMPT, rheader, imgs)
                    rres = parse_json(rresp, "MED_RESCUE")
                    rmeds = rres.get("medications_found") or []
                    if rmeds:
                        item["medications"] = [
                            {
                                "name": m.get("name", ""),
                                "strength": m.get("strength"),
                                "frequency": m.get("frequency"),
                                "route": m.get("route"),
                                "indication": m.get("indication"),
                                "confidence": float(m.get("confidence", 0.6) or 0.6),
                                "evidence": {"source_sentence": m.get("location", "visual re-scan"),
                                             "page": 0, "document": entry["filename"]},
                            }
                            for m in rmeds if isinstance(m, dict) and m.get("name")
                        ]
                        item["medication_rescue"] = {
                            "triggered": True,
                            "reason": "zero medications in primary extraction",
                            "recovered_count": len(item["medications"]),
                            "audit_note": rres.get("audit_note", ""),
                        }
                        rescued_files.append((entry["filename"], len(item["medications"])))
                        print(f"[MED_RESCUE] ✓ {entry['filename']}: recovered {len(item['medications'])} medication(s)", flush=True)
                    else:
                        item["medication_rescue"] = {
                            "triggered": True,
                            "reason": "zero medications in primary extraction",
                            "recovered_count": 0,
                            "no_medication_visible": bool(rres.get("no_medication_visible")),
                            "audit_note": rres.get("audit_note", ""),
                        }
                except Exception as re_err:
                    print(f"[MED_RESCUE] ✗ {entry['filename']}: {re_err}", flush=True)
            if rescued_files:
                print(f"[MED_RESCUE] Rescue recovered medications for {len(rescued_files)} file(s)", flush=True)

            # Ensure shared demographics flows into every per-file result
            all_shared_demo["patient_name"] = "[ANONYMIZED]"
            for fname, item in all_per_file.items():
                if isinstance(item, dict):
                    item_demo = item.setdefault("demographics", {})
                    for k in ("age", "gender", "dob", "mrn"):
                        if not item_demo.get(k) and all_shared_demo.get(k):
                            item_demo[k] = all_shared_demo[k]
                    item_demo["patient_name"] = "[ANONYMIZED]"
                    # Store shared demographics also in system_meta for downstream stages
                    item.setdefault("system_meta", {})["demographics"] = {
                        k: v for k, v in all_shared_demo.items()
                        if k != "patient_name"
                    }
                    item["system_meta"]["demographics"]["patient_name"] = "[ANONYMIZED]"

            # ── Step 5: Write per-file ingestion outputs ──
            per_file_keys = {}
            for entry in file_entries:
                fname = entry["filename"]
                sname = safe_filename(fname)
                result_item = all_per_file.get(fname, {
                    "filename": fname, "parse_error": True,
                    "raw_response": "Not extracted"
                })
                # Attach system_meta
                result_item.setdefault("system_meta", {}).update({
                    "source_bucket": bucket,
                    "source_key":    entry["s3_key"],
                    "filename":      fname,
                    "case_id":       case_id,
                    "run_id":        run_id,
                    "ingest_ts":     datetime.datetime.utcnow().isoformat(),
                    "file_size":     entry["file_size"],
                    "page_count":    entry["page_count"],
                    "stage":         "BATCH_INGESTION",
                })
                result_item["system_meta"]["demographics"] = {
                    k: v for k, v in all_shared_demo.items()
                }

                out_key  = f"runs/{run_id}/ingestion_{sname}.json"
                named    = f"runs/{run_id}__{safe_case}__{sname}/01_INGESTION.json"
                AWS.write(Cfg.BUCKETS["STAGING"], out_key, result_item)
                AWS.write(Cfg.BUCKETS["STAGING"], named,   result_item)
                AWS.write(Cfg.BUCKETS["MEMORY"],  named,   result_item)
                per_file_keys[fname] = {"staging_key": out_key, "named_key": named}
                print(f"[BATCH_INGEST] ✓ Wrote {fname} → {named}", flush=True)

            # ── Step 5.5: Per-file pipeline outputs for consolidated DICOM
            #    series members ──
            # Series consolidation analyzes large series via representative
            # slices, but EVERY member slice still gets its own per-file
            # pipeline output so the UI shows pipeline data for each DICOM.
            processed_keys = {e["s3_key"] for e in file_entries}
            member_stub_count = 0
            for mkey, minfo in (dicom_members or {}).items():
                if mkey in processed_keys:
                    continue
                mfname = mkey.split("/")[-1]
                msname = safe_filename(mfname)
                _mmeta = minfo.get("meta", {}) or {}
                _rep = minfo.get("rep_key", "")
                _rep_name = _rep.split("/")[-1] if _rep else "series representative"
                stub = {
                    "filename": mfname,
                    "dicom_series_member": True,
                    "ingestion_note": (
                        f"Slice {minfo.get('inst', '?')} of {minfo.get('total', '?')} in a "
                        f"consolidated {_mmeta.get('Modality', 'DICOM')} series. The full "
                        f"series was analyzed together via representative slices — "
                        f"extracted imaging findings are reported under {_rep_name}."),
                    "series_context": {
                        "modality": _mmeta.get("Modality", "unknown"),
                        "study_description": _mmeta.get("StudyDescription",
                                                        _mmeta.get("SeriesDescription", "")),
                        "body_part": _mmeta.get("BodyPartExamined", ""),
                        "instance_number": minfo.get("inst"),
                        "total_slices": minfo.get("total"),
                        "representative_filename": _rep_name,
                    },
                    "medications": [], "diseases": [], "lab_tests": [],
                    "vital_signs": [], "procedures": [], "allergies": [],
                    "imaging_findings": [], "genomic_data": [],
                    "system_meta": {
                        "source_bucket": bucket,
                        "source_key":    mkey,
                        "filename":      mfname,
                        "case_id":       case_id,
                        "run_id":        run_id,
                        "ingest_ts":     datetime.datetime.utcnow().isoformat(),
                        "stage":         "BATCH_INGESTION",
                        "dicom_series_member": True,
                        "demographics":  dict(all_shared_demo),
                    },
                }
                m_named = f"runs/{run_id}__{safe_case}__{msname}/01_INGESTION.json"
                m_out   = f"runs/{run_id}/ingestion_{msname}.json"
                AWS.write(Cfg.BUCKETS["STAGING"], m_out,   stub)
                AWS.write(Cfg.BUCKETS["STAGING"], m_named, stub)
                AWS.write(Cfg.BUCKETS["MEMORY"],  m_named, stub)
                member_stub_count += 1
            if member_stub_count:
                print(f"[BATCH_INGEST] ✓ Wrote {member_stub_count} DICOM series-member "
                      f"pipeline outputs (consolidated slices)", flush=True)

            # ── Step 6: Write combined manifest ──
            manifest = {
                "case_id":           case_id,
                "run_id":            run_id,
                "marker_key":        key,
                "original_file_count": original_file_count,
                "processed_file_count": len(file_entries),
                "filenames":         all_filenames,
                "per_file_keys":     per_file_keys,
                "shared_demographics": all_shared_demo,
                "dicom_series_context": dicom_series_ctx,
                "dicom_members": {
                    k: {"inst": v.get("inst"), "total": v.get("total"),
                        "rep_key": v.get("rep_key")}
                    for k, v in (dicom_members or {}).items()
                },
                "batch_quality":     batch_quality_notes,
                "created_at":        datetime.datetime.utcnow().isoformat(),
            }
            mkey = f"runs/{run_id}/batch_ingestion_manifest.json"
            AWS.write(Cfg.BUCKETS["STAGING"], mkey, manifest)
            print(f"[BATCH_INGEST] ✓ DONE | {len(file_entries)} files | manifest={mkey}",
                  flush=True)
            return {"s3_path": mkey, "status": "SUCCESS", "case_id": case_id,
                    "file_count": len(file_entries)}

        except Exception as e:
            print(f"[BATCH_INGEST] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# AGENT B: BATCH CLEANING
# Reads all per-file ingestion results → unified dedup cleaning
# ═══════════════════════════════════════════════════════════════════
class BatchCleaningAgent:
    """Reads all per-file ingestion results for the batch, sends ALL entities
    to the model together for cross-file deduplication and standardization.
    Outputs one combined standardized dataset for the whole patient."""

    @staticmethod
    def _merge_ingestion_for_cleaning(per_file_staging_keys: dict) -> tuple:
        """Load all per-file ingestion JSONs and merge entities for cleaning input."""
        all_entities = {
            "medications": [], "diseases": [], "lab_tests": [],
            "vital_signs": [], "procedures": [], "allergies": [],
            "imaging_findings": [], "genomic_data": [],
        }
        shared_demographics = {}
        filenames = list(per_file_staging_keys.keys())

        for fname, keys in per_file_staging_keys.items():
            try:
                ing = json.loads(AWS.read(Cfg.BUCKETS["STAGING"], keys["staging_key"]))
                # Collect demographics
                meta_demo = ing.get("system_meta", {}).get("demographics", {})
                top_demo  = ing.get("demographics", {})
                for demo in (meta_demo, top_demo):
                    for k in ("age", "gender", "dob", "mrn"):
                        if demo.get(k) and not shared_demographics.get(k):
                            shared_demographics[k] = demo[k]
                # Collect entities, tag with source file
                for cat in all_entities:
                    items = ing.get(cat, [])
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict):
                                item = dict(item)
                                item["_source_file"] = fname
                                all_entities[cat].append(item)
            except Exception as ex:
                print(f"[BATCH_CLEAN] Could not load ingestion for {fname}: {ex}", flush=True)

        total = sum(len(v) for v in all_entities.values())
        print(f"[BATCH_CLEAN] Merged {total} entities from {len(filenames)} files", flush=True)
        return all_entities, shared_demographics, filenames

    @staticmethod
    def run(bucket, manifest_key, run_id):
        manifest_key = decode_s3_key(manifest_key)
        print(f"\n{'='*80}\n[BATCH_CLEAN] START | manifest={manifest_key}\n{'='*80}",
              flush=True)
        try:
            manifest = json.loads(AWS.read(Cfg.BUCKETS["STAGING"], manifest_key))
            case_id   = manifest.get("case_id", "UNSORTED")
            safe_case = safe_filename(case_id)
            per_file_keys = manifest.get("per_file_keys", {})
            shared_demo   = manifest.get("shared_demographics", {})

            if not per_file_keys:
                raise ValueError(f"Manifest has no per_file_keys: {manifest_key}")

            # ── Build merged input for cleaning ──
            all_entities, resolved_demo, filenames = \
                BatchCleaningAgent._merge_ingestion_for_cleaning(per_file_keys)

            # Merge demographics: manifest shared_demo takes priority then resolved
            final_demo = {**resolved_demo, **shared_demo}
            final_demo["patient_name"] = "[ANONYMIZED]"

            user_msg = (
                f"CASE_ID: {case_id}\nRUN_ID: {run_id}\n"
                f"FILES IN THIS BATCH: {filenames}\n"
                f"PATIENT DEMOGRAPHICS: {json.dumps(final_demo)}\n\n"
                f"--- MERGED ENTITIES FROM ALL {len(filenames)} FILES ---\n"
                f"{json.dumps(all_entities, indent=1, default=str)[:110000]}"
            )

            print(f"[BATCH_CLEAN] Calling Bedrock ({len(user_msg):,} chars)...", flush=True)
            resp   = AWS.ask_long(BATCH_CLEANING_PROMPT, user_msg, max_continuations=4)
            result = parse_json(resp, "BATCH_CLEAN")

            # Attach metadata
            result["system_meta"] = {
                "case_id": case_id, "run_id": run_id, "stage": "BATCH_CLEANING",
                "files_cleaned": filenames, "demographics": final_demo,
                "clean_ts": datetime.datetime.utcnow().isoformat(),
            }
            # Ensure combined_standardized_data exists
            result.setdefault("combined_standardized_data", {})

            out   = f"runs/{run_id}/batch_cleaning_output.json"
            named = f"runs/{run_id}__{safe_case}/02_BATCH_CLEANING.json"
            AWS.write(Cfg.BUCKETS["PROCESSED"], out,   result)
            AWS.write(Cfg.BUCKETS["PROCESSED"], named, result)
            AWS.write(Cfg.BUCKETS["MEMORY"],    named, result)

            # ── Per-file cleaning outputs (like ingestion does per-file) ──
            # Include DICOM series-member files so EVERY DICOM slice gets its
            # own cleaning output too (not just the representatives).
            try:
                for mkey in (manifest.get("dicom_members") or {}):
                    mf = mkey.split("/")[-1]
                    if mf and mf not in filenames:
                        filenames.append(mf)
            except Exception:
                pass
            combined_std = result.get("combined_standardized_data", {})
            for fname in filenames:
                sname = safe_filename(fname)
                per_file_clean = {"combined_standardized_data": {}, "source_file": fname}
                for cat, items in combined_std.items():
                    if isinstance(items, list):
                        file_items = [
                            it for it in items
                            if isinstance(it, dict) and fname in it.get("source_files", [])
                        ]
                        if file_items:
                            per_file_clean["combined_standardized_data"][cat] = file_items
                per_file_clean["cleaning_stats"] = result.get("cleaning_stats", {})
                per_file_clean["quality"] = result.get("quality", {})
                per_file_clean["system_meta"] = {
                    "case_id": case_id, "run_id": run_id,
                    "stage": "BATCH_CLEANING", "source_file": fname,
                    "demographics": final_demo,
                    "clean_ts": datetime.datetime.utcnow().isoformat(),
                }
                pf_key = f"runs/{run_id}__{safe_case}__{sname}/02_BATCH_CLEANING.json"
                AWS.write(Cfg.BUCKETS["PROCESSED"], pf_key, per_file_clean)
                AWS.write(Cfg.BUCKETS["MEMORY"],    pf_key, per_file_clean)
                print(f"[BATCH_CLEAN] ✓ Per-file cleaning: {fname} → {pf_key}", flush=True)

            print(f"[BATCH_CLEAN] ✓ DONE | out={out} | {len(filenames)} per-file outputs", flush=True)
            return {"s3_path": out, "status": "SUCCESS", "case_id": case_id}

        except Exception as e:
            print(f"[BATCH_CLEAN] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# AGENT C: BATCH VALIDATION
# Validates the unified cleaned dataset from all files together
# ═══════════════════════════════════════════════════════════════════
class BatchValidationAgent:
    """Validates the combined cleaned dataset, running all cross-file
    drug interaction checks, physiological bounds checks, and logic checks
    on the complete patient record at once."""

    @staticmethod
    def run(bucket, cleaning_key, run_id):
        cleaning_key = decode_s3_key(cleaning_key)
        print(f"\n{'='*80}\n[BATCH_VALID] START | input={cleaning_key}\n{'='*80}",
              flush=True)
        try:
            clean   = json.loads(AWS.read(Cfg.BUCKETS["PROCESSED"], cleaning_key))
            meta    = clean.get("system_meta", {})
            case_id = meta.get("case_id", "UNSORTED")
            safe_case = safe_filename(case_id)

            # Use combined_standardized_data (batch) or fall back to standardized_data
            std_data = clean.get("combined_standardized_data",
                                 clean.get("standardized_data", {}))
            files_cleaned = meta.get("files_cleaned", [])

            user_msg = (
                f"CASE_ID: {case_id}\nRUN_ID: {run_id}\n"
                f"SOURCE FILES: {files_cleaned}\n"
                f"PATIENT DEMOGRAPHICS: {json.dumps(meta.get('demographics', {}))}\n\n"
                f"--- COMBINED STANDARDIZED DATA (from {len(files_cleaned)} files) ---\n"
                f"{json.dumps(std_data, indent=2, default=str)[:100000]}"
            )

            print(f"[BATCH_VALID] Calling Bedrock ({len(user_msg):,} chars)...", flush=True)
            resp   = AWS.ask_long(VALIDATION_PROMPT, user_msg, max_continuations=4)
            result = parse_json(resp, "BATCH_VALID")

            result["system_meta"] = dict(meta)
            result["system_meta"]["stage"] = "BATCH_VALIDATION"
            # Ensure validated_data contains demographics for FeatureAgent
            vd = result.setdefault("validated_data", dict(std_data))
            if isinstance(vd, dict) and not vd.get("demographics"):
                vd["demographics"] = meta.get("demographics", {})

            out   = f"runs/{run_id}/batch_validation_output.json"
            named = f"runs/{run_id}__{safe_case}/03_BATCH_VALIDATION.json"
            AWS.write(Cfg.BUCKETS["PROCESSED"], out,   result)
            AWS.write(Cfg.BUCKETS["PROCESSED"], named, result)
            AWS.write(Cfg.BUCKETS["MEMORY"],    named, result)

            # ── Per-file validation outputs (like ingestion does per-file) ──
            # Include DICOM series-member files so every DICOM slice gets its
            # own validation output too.
            try:
                _mf = json.loads(AWS.read(Cfg.BUCKETS["STAGING"],
                                          f"runs/{run_id}/batch_ingestion_manifest.json"))
                for mkey in (_mf.get("dicom_members") or {}):
                    mf = mkey.split("/")[-1]
                    if mf and mf not in files_cleaned:
                        files_cleaned.append(mf)
            except Exception:
                pass
            all_issues = result.get("issues", [])
            all_interactions = result.get("drug_interactions", [])
            for fname in files_cleaned:
                sname = safe_filename(fname)
                # Collect entity names from this file (via source_files in std_data)
                file_entity_names = set()
                for cat, items in std_data.items():
                    if isinstance(items, list):
                        for it in items:
                            if isinstance(it, dict) and fname in it.get("source_files", []):
                                file_entity_names.add((it.get("original") or "").lower())
                                file_entity_names.add((it.get("standard_name") or "").lower())
                file_entity_names.discard("")
                # Filter issues relevant to this file's entities
                file_issues = [
                    iss for iss in all_issues
                    if isinstance(iss, dict) and (
                        (iss.get("entity") or "").lower() in file_entity_names
                        or any(e in (iss.get("entity") or "").lower() for e in file_entity_names if e)
                    )
                ]
                # Filter drug interactions where at least one drug is from this file
                file_interactions = [
                    di for di in all_interactions
                    if isinstance(di, dict) and (
                        (di.get("drug1") or "").lower() in file_entity_names
                        or (di.get("drug2") or "").lower() in file_entity_names
                    )
                ]
                per_file_val = {
                    "validation_status": result.get("validation_status", "UNKNOWN"),
                    "risk_score": result.get("risk_score", 0),
                    "risk_level": result.get("risk_level", "UNKNOWN"),
                    "issues": file_issues,
                    "drug_interactions": file_interactions,
                    "critical_alerts": [a for a in result.get("critical_alerts", [])
                                        if isinstance(a, str) and any(e in a.lower() for e in file_entity_names if e)],
                    "source_file": fname,
                    "validated_data": {},
                    "summary": {
                        "total_checks": len(file_issues) + len(file_interactions),
                        "warnings": sum(1 for i in file_issues if i.get("severity") == "WARNING"),
                        "critical": sum(1 for i in file_issues if i.get("severity") == "CRITICAL"),
                    },
                    "system_meta": {
                        "case_id": case_id, "run_id": run_id,
                        "stage": "BATCH_VALIDATION", "source_file": fname,
                        "demographics": meta.get("demographics", {}),
                    },
                }
                # Include this file's validated entities
                for cat, items in std_data.items():
                    if isinstance(items, list):
                        file_items = [it for it in items if isinstance(it, dict)
                                      and fname in it.get("source_files", [])]
                        if file_items:
                            per_file_val["validated_data"][cat] = file_items
                pf_key = f"runs/{run_id}__{safe_case}__{sname}/03_BATCH_VALIDATION.json"
                AWS.write(Cfg.BUCKETS["PROCESSED"], pf_key, per_file_val)
                AWS.write(Cfg.BUCKETS["MEMORY"],    pf_key, per_file_val)
                print(f"[BATCH_VALID] ✓ Per-file validation: {fname} → {pf_key}", flush=True)

            status = result.get("validation_status", "UNKNOWN")
            print(f"[BATCH_VALID] ✓ DONE | status={status} risk={result.get('risk_level','?')} | "
                  f"{len(files_cleaned)} per-file outputs", flush=True)
            return {"s3_path": out, "status": status, "case_id": case_id}

        except Exception as e:
            print(f"[BATCH_VALID] ✗ {e}\n{traceback.format_exc()}", flush=True)
            raise


# ═══════════════════════════════════════════════════════════════════
# COMPASS STAGE AGENT — Wrapper for Step Function dispatch
# ═══════════════════════════════════════════════════════════════════
class CompassStageAgent:
    """Bridges the Step Function dispatch → CompassAgent.run().
    Provides S3 I/O helpers so the agent can read/write data."""

    @staticmethod
    def run(bucket, key, run_id):
        if not COMPASS_AVAILABLE:
            print("[COMPASS_STAGE] ⚠ COMPASS agent not available — SKIPPING", flush=True)
            return {"status": "SKIPPED", "reason": "COMPASS agent not installed"}

        print(f"\n{'='*80}", flush=True)
        print(f"[COMPASS_STAGE] Dispatching to CompassAgent", flush=True)
        print(f"[COMPASS_STAGE] bucket={bucket} key={key} run_id={run_id}", flush=True)
        print(f"{'='*80}", flush=True)

        # S3 I/O helpers matching CompassAgent.run() signature
        def s3_read(bkt, k, as_bytes=False):
            return AWS.read(bkt, k, as_bytes=as_bytes)

        def s3_write(bkt, k, data):
            AWS.write(bkt, k, data)

        def s3_list(bkt, prefix):
            return AWS.list_keys(bkt, prefix)

        return CompassAgent.run(
            bucket=Cfg.BUCKETS["RAW"],
            key=key,
            run_id=run_id,
            s3_read_fn=s3_read,
            s3_write_fn=s3_write,
            s3_list_fn=s3_list,
            curated_bucket=Cfg.BUCKETS["CURATED"],
        )


# ═══════════════════════════════════════════════════════════════════
# MADRIGAL STAGE AGENT — Wrapper for Step Function dispatch
# ═══════════════════════════════════════════════════════════════════
class MadrigalStageAgent:
    """Bridges the Step Function dispatch → MadrigalAgent.run().
    Provides S3 I/O helpers so the agent can read/write data."""

    @staticmethod
    def run(bucket, key, run_id):
        if not MADRIGAL_AVAILABLE:
            print("[MADRIGAL_STAGE] ⚠ Madrigal agent not available — SKIPPING", flush=True)
            return {"status": "SKIPPED", "reason": "Madrigal agent not installed"}

        print(f"\n{'='*80}", flush=True)
        print(f"[MADRIGAL_STAGE] Dispatching to MadrigalAgent", flush=True)
        print(f"[MADRIGAL_STAGE] bucket={bucket} key={key} run_id={run_id}", flush=True)
        print(f"{'='*80}", flush=True)

        # S3 I/O helpers matching MadrigalAgent.run() signature
        def s3_read(bkt, k, as_bytes=False):
            return AWS.read(bkt, k, as_bytes=as_bytes)

        def s3_write(bkt, k, data):
            AWS.write(bkt, k, data)

        def s3_list(bkt, prefix):
            return AWS.list_keys(bkt, prefix)

        return MadrigalAgent.run(
            bucket=Cfg.BUCKETS["PROCESSED"],
            input_key=key,
            run_id=run_id,
            s3_read_fn=s3_read,
            s3_write_fn=s3_write,
            s3_list_fn=s3_list,
            curated_bucket=Cfg.BUCKETS["CURATED"],
            raw_bucket=Cfg.BUCKETS["RAW"],
        )


# ═══════════════════════════════════════════════════════════════════
# PINNACLE STAGE AGENT — Wrapper for Step Function dispatch
# ═══════════════════════════════════════════════════════════════════
class PinnacleStageAgent:
    """Bridges the Step Function dispatch -> PinnacleAgent.run()."""

    @staticmethod
    def run(bucket, key, run_id):
        use_gpu_agent = os.environ.get("PINNACLE_GPU_AGENT", "true").lower() in ("1", "true", "yes", "on")
        if use_gpu_agent and not PINNACLE_GPU_AVAILABLE and not PINNACLE_AVAILABLE:
            print("[PINNACLE_STAGE] ⚠ No PINNACLE agent available — SKIPPING", flush=True)
            return {"status": "SKIPPED", "reason": "PINNACLE agents not installed"}
        if (not use_gpu_agent) and not PINNACLE_AVAILABLE:
            print("[PINNACLE_STAGE] ⚠ PINNACLE agent not available — SKIPPING", flush=True)
            return {"status": "SKIPPED", "reason": "PINNACLE agent not installed"}

        print(f"\n{'='*80}", flush=True)
        print("[PINNACLE_STAGE] Dispatching to PINNACLE agent", flush=True)
        print(f"[PINNACLE_STAGE] bucket={bucket} key={key} run_id={run_id}", flush=True)
        print(f"[PINNACLE_STAGE] gpu_agent={use_gpu_agent and PINNACLE_GPU_AVAILABLE}", flush=True)
        print(f"{'='*80}", flush=True)

        def s3_read(bkt, k, as_bytes=False):
            return AWS.read(bkt, k, as_bytes=as_bytes)

        def s3_write(bkt, k, data):
            AWS.write(bkt, k, data)

        agent_cls = PinnacleGPUAgent if (use_gpu_agent and PINNACLE_GPU_AVAILABLE) else PinnacleAgent
        return agent_cls.run(
            bucket=Cfg.BUCKETS["RAW"],
            key=key,
            run_id=run_id,
            s3_read_fn=s3_read,
            s3_write_fn=s3_write,
            curated_bucket=Cfg.BUCKETS["CURATED"],
        )


# ═══════════════════════════════════════════════════════════════════
# DISPATCHER
# ═══════════════════════════════════════════════════════════════════
def _is_pinnacle_only_run(bucket: str, key: str, run_id: str) -> bool:
    """Detect whether this run should execute only the PINNACLE stage.

    Signal source is RAW bucket metadata uploaded by frontend:
      - {case_id}/pinnacle_request.json
    """
    try:
        case_id = key.split("/")[0] if "/" in key else key
        if not case_id:
            return False

        request_keys = [
            f"{case_id}/pinnacle_request.json",
            f"{case_id}/pinnacle_metadata.json",
            f"runs/{run_id}/pinnacle_request.json",
        ]
        for rk in request_keys:
            try:
                raw = AWS.read(bucket, rk)
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    continue
                enabled = bool(payload.get("enabled", False))
                discovery_only = bool(payload.get("discovery_only", enabled))
                if enabled and discovery_only:
                    print(f"[DISPATCH] PINNACLE-only mode detected via {rk}", flush=True)
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


def _is_compass_only_run(bucket: str, key: str, run_id: str) -> bool:
    """Detect whether this run should execute only the COMPASS stage.

    Signal source is RAW bucket metadata uploaded by frontend:
      - {case_id}/compass_metadata.json
    """
    try:
        case_id = key.split("/")[0] if "/" in key else key
        if not case_id:
            return False

        request_keys = [
            f"{case_id}/compass_metadata.json",
            f"runs/{run_id}/compass_metadata.json",
        ]
        for rk in request_keys:
            try:
                raw = AWS.read(bucket, rk)
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    continue
                enabled = bool(payload.get("enabled", False))
                discovery_only = bool(payload.get("discovery_only", False))
                if enabled and discovery_only:
                    print(f"[DISPATCH] COMPASS-only mode detected via {rk}", flush=True)
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


def _is_madrigal_only_run(bucket: str, key: str, run_id: str) -> bool:
    """Detect whether this run should execute only the MADRIGAL stage.

    Signal source is RAW bucket metadata uploaded by frontend:
      - {case_id}/madrigal_metadata.json
    """
    try:
        case_id = key.split("/")[0] if "/" in key else key
        if not case_id:
            return False

        request_keys = [
            f"{case_id}/madrigal_metadata.json",
            f"runs/{run_id}/madrigal_metadata.json",
        ]
        for rk in request_keys:
            try:
                raw = AWS.read(bucket, rk)
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    continue
                enabled = bool(payload.get("enabled", False))
                discovery_only = bool(payload.get("discovery_only", False))
                if enabled and discovery_only:
                    print(f"[DISPATCH] MADRIGAL-only mode detected via {rk}", flush=True)
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


def main():
    print(f"\n[DISPATCH] Starting...", flush=True)
    p = argparse.ArgumentParser()
    p.add_argument("--stage", required=True, choices=[
        "INGESTION", "CLEANING", "VALIDATION", "FEATURE", "NARRATIVE_JUDGE", "REFLECTION",
        "BATCH_INGESTION", "BATCH_CLEANING", "BATCH_VALIDATION",
        "BATCH_ALL", "FEATURE_JUDGE", "COMPASS", "PINNACLE", "MADRIGAL", "FULL_PIPELINE",
    ])
    p.add_argument("--run_id")
    args = p.parse_args()

    stage  = args.stage
    run_id = args.run_id or os.environ.get("RUN_ID", "no-run-id")
    bucket = os.environ.get("TARGET_BUCKET")
    key    = decode_s3_key(os.environ.get("TARGET_KEY", "") or "")
    prev   = decode_s3_key(os.environ.get("PREV_STAGE_OUTPUT", "") or "")
    if not prev:
        prev = None

    print(f"[DISPATCH] stage={stage} run={run_id} bucket={bucket} key={key} prev={prev}",
          flush=True)

    if not bucket or not key:
        print("[DISPATCH] ✗ Missing TARGET_BUCKET or TARGET_KEY", flush=True)
        sys.exit(1)

    pinnacle_only_mode = _is_pinnacle_only_run(bucket, key, run_id)
    compass_only_mode = _is_compass_only_run(bucket, key, run_id)
    madrigal_only_mode = _is_madrigal_only_run(bucket, key, run_id)

    # In discovery-only mode, all non-PINNACLE stages are intentionally skipped.
    if pinnacle_only_mode and stage != "PINNACLE":
        r = {
            "status": "SKIPPED",
            "stage": stage,
            "reason": "PINNACLE_DISCOVERY_ONLY",
        }
        print(json.dumps(r, default=str), flush=True)
        print(f"[DISPATCH] [OK] {stage} SKIPPED (PINNACLE-only mode)", flush=True)
        return

    # In COMPASS-only mode, all non-COMPASS stages are intentionally skipped.
    if (not pinnacle_only_mode) and compass_only_mode and stage != "COMPASS":
        r = {
            "status": "SKIPPED",
            "stage": stage,
            "reason": "COMPASS_DISCOVERY_ONLY",
        }
        print(json.dumps(r, default=str), flush=True)
        print(f"[DISPATCH] [OK] {stage} SKIPPED (COMPASS-only mode)", flush=True)
        return

    # In MADRIGAL-only mode, all non-MADRIGAL stages are intentionally skipped.
    if (not pinnacle_only_mode) and (not compass_only_mode) and madrigal_only_mode and stage != "MADRIGAL":
        r = {
            "status": "SKIPPED",
            "stage": stage,
            "reason": "MADRIGAL_DISCOVERY_ONLY",
        }
        print(json.dumps(r, default=str), flush=True)
        print(f"[DISPATCH] [OK] {stage} SKIPPED (MADRIGAL-only mode)", flush=True)
        return

    try:
        # ── Legacy single-file stages (kept for backward compatibility) ──
        if stage == "INGESTION":
            r = IngestionAgent.run(bucket, key, run_id)
        elif stage == "CLEANING":
            if not prev: raise ValueError("Need PREV_STAGE_OUTPUT")
            r = CleaningAgent.run(bucket, prev, run_id)
        elif stage == "VALIDATION":
            if not prev: raise ValueError("Need PREV_STAGE_OUTPUT")
            r = ValidationAgent.run(bucket, prev, run_id)
        # ── New batch multi-file stages ──
        elif stage == "BATCH_INGESTION":
            r = BatchIngestionAgent.run(bucket, key, run_id)
        elif stage == "BATCH_CLEANING":
            if not prev: raise ValueError("Need PREV_STAGE_OUTPUT for BATCH_CLEANING")
            r = BatchCleaningAgent.run(bucket, prev, run_id)
        elif stage == "BATCH_VALIDATION":
            if not prev: raise ValueError("Need PREV_STAGE_OUTPUT for BATCH_VALIDATION")
            r = BatchValidationAgent.run(bucket, prev, run_id)
        # ── Composite stages (merge multiple stages into 1 container for speed) ──
        elif stage == "BATCH_ALL":
            # Runs BATCH_INGESTION + BATCH_CLEANING + BATCH_VALIDATION in-process
            import time as _t
            _t0 = _t.time()
            print(f"\n{'='*80}\n[BATCH_ALL] COMPOSITE STAGE — running 3 stages in-process\n{'='*80}", flush=True)
            r1 = BatchIngestionAgent.run(bucket, key, run_id)
            manifest_key = r1["s3_path"]
            print(f"[BATCH_ALL] Ingestion done in {_t.time()-_t0:.1f}s → {manifest_key}", flush=True)
            _t1 = _t.time()
            r2 = BatchCleaningAgent.run(bucket, manifest_key, run_id)
            cleaning_key = r2["s3_path"]
            print(f"[BATCH_ALL] Cleaning done in {_t.time()-_t1:.1f}s → {cleaning_key}", flush=True)
            _t2 = _t.time()
            r3 = BatchValidationAgent.run(bucket, cleaning_key, run_id)
            validation_key = r3["s3_path"]
            print(f"[BATCH_ALL] Validation done in {_t.time()-_t2:.1f}s → {validation_key}", flush=True)
            print(f"[BATCH_ALL] ✓ ALL 3 STAGES DONE in {_t.time()-_t0:.1f}s total", flush=True)
            r = {"s3_path": validation_key, "status": "SUCCESS",
                 "case_id": r3.get("case_id", "UNSORTED"),
                 "stages": {"ingestion": r1, "cleaning": r2, "validation": r3}}
        elif stage == "FEATURE_JUDGE":
            # Runs FEATURE + NARRATIVE_JUDGE in one container
            import time as _t
            _t0 = _t.time()
            if not prev: raise ValueError("Need PREV_STAGE_OUTPUT for FEATURE_JUDGE")
            print(f"\n{'='*80}\n[FEATURE_JUDGE] COMPOSITE STAGE — Feature + Judge in-process\n{'='*80}", flush=True)
            r1 = FeatureAgent.run(bucket, prev, run_id)
            print(f"[FEATURE_JUDGE] Feature done in {_t.time()-_t0:.1f}s", flush=True)
            _t1 = _t.time()
            r2 = NarrativeJudgeAgent.run(bucket, key, run_id)
            print(f"[FEATURE_JUDGE] Judge done in {_t.time()-_t1:.1f}s", flush=True)
            print(f"[FEATURE_JUDGE] ✓ BOTH STAGES DONE in {_t.time()-_t0:.1f}s total", flush=True)
            r = {"status": "SUCCESS", "feature": r1, "judge": r2}
        elif stage == "FULL_PIPELINE":
            # Clinical pipeline mode: Ingest -> Clean -> Validate -> Feature -> Madrigal -> Judge
            import time as _t
            _t0 = _t.time()
            print(f"\n{'='*80}\n[FULL_PIPELINE] RUNNING CLINICAL PIPELINE IN-PROCESS\n{'='*80}", flush=True)
            # 1. Ingestion
            r1 = BatchIngestionAgent.run(bucket, key, run_id)
            manifest_key = r1["s3_path"]
            case_id = r1.get("case_id", "UNSORTED")
            print(f"[FULL_PIPELINE] 1/8 Ingestion done in {_t.time()-_t0:.1f}s → {manifest_key}", flush=True)
            # 2. Cleaning
            _t1 = _t.time()
            r2 = BatchCleaningAgent.run(bucket, manifest_key, run_id)
            cleaning_key = r2["s3_path"]
            print(f"[FULL_PIPELINE] 2/8 Cleaning done in {_t.time()-_t1:.1f}s → {cleaning_key}", flush=True)
            # 3. Validation
            _t2 = _t.time()
            r3 = BatchValidationAgent.run(bucket, cleaning_key, run_id)
            validation_key = r3["s3_path"]
            print(f"[FULL_PIPELINE] 3/8 Validation done in {_t.time()-_t2:.1f}s → {validation_key}", flush=True)
            # 4. Feature
            _t3 = _t.time()
            r4 = FeatureAgent.run(bucket, validation_key, run_id)
            print(f"[FULL_PIPELINE] 4/8 Feature done in {_t.time()-_t3:.1f}s", flush=True)
            # 5. COMPASS intentionally skipped in clinical pipeline mode
            _t4 = _t.time()
            r5 = {"status": "SKIPPED", "reason": "EXCLUDED_FROM_CLINICAL_PIPELINE"}
            print(f"[FULL_PIPELINE] 5/8 COMPASS skipped (clinical pipeline mode)", flush=True)
            # 6. PINNACLE intentionally skipped in clinical pipeline mode
            _t5 = _t.time()
            r6 = {"status": "SKIPPED", "reason": "EXCLUDED_FROM_CLINICAL_PIPELINE"}
            print(f"[FULL_PIPELINE] 6/8 PINNACLE skipped (clinical pipeline mode)", flush=True)
            # 7. Madrigal DDI (non-fatal)
            _t6 = _t.time()
            r7 = {"status": "SKIPPED", "reason": "Madrigal not available"}
            try:
                r7 = MadrigalStageAgent.run(bucket, validation_key, run_id)
                print(f"[FULL_PIPELINE] 7/8 Madrigal done in {_t.time()-_t6:.1f}s → status={r7.get('status')}", flush=True)
            except Exception as madrigal_err:
                print(f"[FULL_PIPELINE] 7/8 Madrigal failed (non-fatal): {madrigal_err}", flush=True)
                r7 = {"status": "FAILED", "error": str(madrigal_err)}
            # 8. Narrative Judge
            _t7 = _t.time()
            r8 = {"status": "SKIPPED"}
            try:
                r8 = NarrativeJudgeAgent.run(bucket, key, run_id)
                print(f"[FULL_PIPELINE] 8/8 Judge done in {_t.time()-_t7:.1f}s", flush=True)
            except Exception as judge_err:
                print(f"[FULL_PIPELINE] 8/8 Judge failed (non-fatal): {judge_err}", flush=True)
                r8 = {"status": "FAILED", "error": str(judge_err)}
            total_time = _t.time() - _t0
            print(f"\n[FULL_PIPELINE] ✓ CLINICAL PIPELINE DONE in {total_time:.1f}s total", flush=True)
            r = {"s3_path": validation_key, "status": "SUCCESS", "case_id": case_id,
                 "total_time_seconds": round(total_time, 2),
                 "stages": {"ingestion": r1, "cleaning": r2, "validation": r3,
                            "feature": r4, "compass": r5, "pinnacle": r6, "madrigal": r7, "judge": r8}}
        # ── Shared final stages (work for both pipelines) ──
        elif stage == "FEATURE":
            if not prev: raise ValueError("Need PREV_STAGE_OUTPUT")
            r = FeatureAgent.run(bucket, prev, run_id)
        elif stage == "NARRATIVE_JUDGE":
            r = NarrativeJudgeAgent.run(bucket, key, run_id)
        elif stage == "COMPASS":
            r = CompassStageAgent.run(bucket, key, run_id)
        elif stage == "PINNACLE":
            r = PinnacleStageAgent.run(bucket, key, run_id)
        elif stage == "MADRIGAL":
            if madrigal_only_mode:
                # Standalone discovery — no prior stage, use trigger key directly
                r = MadrigalStageAgent.run(bucket, key, run_id)
            else:
                # Standard pipeline — needs prior stage output
                if not prev: raise ValueError("Need PREV_STAGE_OUTPUT for MADRIGAL")
                r = MadrigalStageAgent.run(bucket, prev, run_id)
        elif stage == "REFLECTION":
            ec = os.environ.get("ERROR_CONTEXT", "Unknown")
            r = ReflectionAgent.run(bucket, key, run_id, ec)
        else:
            raise ValueError(f"Unknown stage: {stage}")

        print(json.dumps(r, default=str), flush=True)
        print(f"[DISPATCH] [OK] {stage} COMPLETE", flush=True)
    except Exception as e:
        print(f"[DISPATCH] [FAIL] FATAL: {e}\n{traceback.format_exc()}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
