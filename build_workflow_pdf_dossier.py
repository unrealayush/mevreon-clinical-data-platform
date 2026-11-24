import os
import sys
import base64
import subprocess
from pathlib import Path

def encode_image(path):
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        return f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"

def main():
    base_dir = Path(r"c:\Users\ayu23\OneDrive\Desktop\Data platform")
    clips_dir = base_dir / "clips"
    brain_dir = Path(r"C:\Users\ayu23\.gemini\antigravity-ide\brain\61f18f96-2277-427e-b509-7909b0618a88")
    
    output_pdf = base_dir / "mevreon_clinical_platform_workflow_dossier.pdf"
    output_brain_pdf = brain_dir / "mevreon_clinical_platform_workflow_dossier.pdf"
    html_path = base_dir / "workflow_dossier.html"

    print("Encoding split clips to base64 for zero-latency embedded rendering...")
    
    clips_data = [
        {
            "num": "01",
            "time": "00:18",
            "title": "Platform Ingestion Gateway & GCP Cloud Run Authentication",
            "agent": "Cloud Run Gateway & Session Manager",
            "category": "Infrastructure & Security",
            "img": encode_image(str(clips_dir / "clip_01_gateway_auth.png")),
            "description": "The Mevreon platform initializes via Google Cloud Platform (GCP) serverless infrastructure. The web client verifies the backend service health endpoint (/api/health) and authenticates using enterprise Access Key ID 'MEVREON-GCP-ACCESS-2026' and cryptographically matched secret keys. Upon validation, a signed JWT bearer token is minted and stored in browser session storage.",
            "metrics": [
                ("Backend Status", "HTTP 200 OK (Healthy)"),
                ("Deployment Region", "us-central1 (Cloud Run)"),
                ("GCS Bucket Fabric", "5 Tiered Buckets Online"),
                ("Auth Mode", "Access Key ID + Signed JWT")
            ],
            "technical_notes": "Tiered Google Cloud Storage topology is linked: mevreon-raw-gcp (ingested clinical files), mevreon-staging-gcp (OCR tokens & structured extractions), mevreon-processed-gcp (ontologically cleaned records), mevreon-curated-gcp (final dashboard & narrative models), and mevreon-memory-gcp (pipeline run telemetry)."
        },
        {
            "num": "02",
            "time": "00:52",
            "title": "Upload Workspace & 5-Stage Deterministic Agentic Architecture",
            "agent": "Orchestrator & Ingestion Gateway",
            "category": "Pipeline Architecture",
            "img": encode_image(str(clips_dir / "clip_02_upload_architecture.png")),
            "description": "The dedicated Upload Workspace provides streamlined options for single-patient and multi-patient directory uploads. It features intuitive drag-and-drop zones, support for multi-modal formats (.pdf, .dcm, .vcf, .docx, .jpeg), and showcases the 5-stage deterministic agent processing pipeline that governs all clinical data synthesis.",
            "metrics": [
                ("Upload Modes", "Single-Patient & Multi-Folder"),
                ("Supported Formats", "PDF, DICOM, VCF, DOCX, JPG, TSV"),
                ("Pipeline Stages", "5 Deterministic Agents"),
                ("Specialized Toggles", "COMPASS, PINNACLE, MADRIGAL")
            ],
            "technical_notes": "The 5-stage pipeline consists of: (1) Ingestion Agent (OCR, layout parsing, DICOM headers), (2) Cleaning Agent (RxNorm, LOINC, ICD-10 standardized mappings), (3) Validation Agent (deterministic physiological range bounds), (4) Feature Agent (Gemini longitudinal clinical narrative synthesis), and (5) Narrative Judge Agent (8-metric grounding & hallucination audit)."
        },
        {
            "num": "03",
            "time": "01:28",
            "title": "Staging Saadhna Agarwal Folder & GCS __PROCESS__ Autonomous Trigger",
            "agent": "Autonomous Pipeline Trigger",
            "category": "Clinical Ingestion",
            "img": encode_image(str(clips_dir / "clip_03_folder_upload_process.png")),
            "description": "A new patient folder ('sadhnaagarwal11' — Patient: Saadhna Agarwal) is uploaded containing 5 heterogeneous clinical documents. The system uploads each document to GCS 'mevreon-raw-gcp' and drops an autonomous sentinel marker ('sadhnaagarwal11/__PROCESS__'), which instantly triggers Cloud Run containerized pipeline evaluation.",
            "metrics": [
                ("Patient Case ID", "sadhnaagarwal11 (Saadhna Agarwal)"),
                ("Files Ingested", "5 Multimodal Records"),
                ("Key Genetic Test", "25MBE869-MLPA.pdf (2.2 MB)"),
                ("Sentinel Marker", "sadhnaagarwal11/__PROCESS__")
            ],
            "technical_notes": "Ingested file manifest: 0043YF0028425047_875705d.pdf (Clinical Biopsy Consultation, 237 KB), 25MBE869-MLPA.pdf (MLPA Molecular Genetics, 2.2 MB), Scan 11 May 25 12·23·09.pdf (Radiological Mammogram, 6.7 MB), WhatsApp Scan 2025-05-22.pdf (Histopathology Report, 7.1 MB), and WhatsApp Image 2026-02-17.jpeg (Pathology slide, 377 KB)."
        },
        {
            "num": "04",
            "time": "02:10",
            "title": "Tab 1: Longitudinal Clinical Narrative & Oncology Profile",
            "agent": "Feature Agent (Gemini Synthesis)",
            "category": "Clinical Synthesis",
            "img": encode_image(str(clips_dir / "clip_04_longitudinal_narrative.png")),
            "description": "Upon pipeline completion, the platform transitions to the synthesized clinical dashboard for Saadhna Agarwal (Patient 9). The Overview tab presents a comprehensive longitudinal patient story, chronic conditions, demographic breakdown, and chronological clinical encounter milestones synthesized by Gemini.",
            "metrics": [
                ("Patient Profile", "62-Year-Old Female"),
                ("Primary Diagnosis", "Metastatic Stage IV Breast Carcinoma"),
                ("Histology", "Grade 2 Invasive Ductal Carcinoma"),
                ("Risk Status", "High Comorbidity Profile")
            ],
            "technical_notes": "The longitudinal narrative accurately fuses oncological history, surgical margins, MLPA molecular genetic copy number alterations, endocrine receptor status, systemic therapies, and comorbidity management (hypertension and primary hypothyroidism) into a coherent, cited executive brief."
        },
        {
            "num": "05",
            "time": "02:52",
            "title": "Tab 2: Files & 5-Agent Pipeline Visualizer (MLPA Molecular Test)",
            "agent": "Ingestion & Validation Agents",
            "category": "Audit Trail & Verification",
            "img": encode_image(str(clips_dir / "clip_05_pipeline_visualizer_mlpa.png")),
            "description": "The Files & Pipeline tab displays the complete data lineage and execution state across all 5 autonomous agents. All 5 raw uploaded source documents are browsable in a high-speed GCS file tree. Clicking '25MBE869-MLPA.pdf' opens the integrated document viewer with inline optical OCR extraction tokens.",
            "metrics": [
                ("Pipeline Execution", "5 / 5 Stages Completed (100%)"),
                ("Source Files Online", "5 Verified in GCS Bucket"),
                ("Active Preview", "25MBE869-MLPA.pdf (Molecular Panel)"),
                ("Data Lineage", "Raw -> Staging -> Processed -> Curated")
            ],
            "technical_notes": "The viewer allows clinicians to cross-reference extracted facts against the original source documents. Layout-aware bounding boxes link synthesized clinical assertions directly to page-level coordinates in the scanned MLPA and biopsy PDFs."
        },
        {
            "num": "06",
            "time": "03:32",
            "title": "Tab 3: Medications Tracker & Standardized RxNorm Regimens",
            "agent": "Cleaning Agent (RxNorm Standardization)",
            "category": "Pharmacotherapy & Safety",
            "img": encode_image(str(clips_dir / "clip_06_medications_rxnorm.png")),
            "description": "The Medications Tracker tab normalizes active pharmacological regimens from unstructured clinical notes into RxNorm concept unique identifiers (RxCUIs). Active regimens, dosages, frequencies, routes, therapeutic classes, and automated drug-drug interaction (DDI) contraindication checks are clearly visualized.",
            "metrics": [
                ("Active Regimens", "4 Standardized Therapies"),
                ("Thyroid Replacement", "Levothyroxine Sodium"),
                ("Antihypertensive", "Telmisartan / Amlodipine / HCTZ"),
                ("Safety Audit", "Zero Lethal DDI Contraindications")
            ],
            "technical_notes": "Normalized medications: (1) Levothyroxine (RxNorm 10582, Thyroid Replacement), (2) Telmisartan/Amlodipine/Hydrochlorothiazide (Triple Antihypertensive combination), (3) Cilidipine (Calcium Channel Blocker), and (4) Alpha-Tocopherol / Vitamin E (Supportive antioxidant therapy)."
        },
        {
            "num": "07",
            "time": "04:12",
            "title": "Tab 4: Labs & Longitudinal Diagnostic Trend Panels",
            "agent": "Validation Agent (LOINC & Physiological Bounds)",
            "category": "Laboratory Analytics",
            "img": encode_image(str(clips_dir / "clip_07_labs_loinc_trends.png")),
            "description": "The Labs & Diagnostics tab organizes all clinical lab tests into standardized LOINC categories (Biochemistry, Hematology, Metabolic Panels, Tumor Markers). Observed lab draw values are deterministically checked against age- and gender-adjusted physiological reference intervals.",
            "metrics": [
                ("Coding Standard", "LOINC Standardized Ontologies"),
                ("Validation Mechanism", "Deterministic Range Bounds"),
                ("Visualization", "Multi-Encounter Trend Charts"),
                ("Abnormal Flagging", "High / Low Alert Indicators")
            ],
            "technical_notes": "Multi-encounter scatter and longitudinal trend charts enable instant tracking of renal function, hepatic enzyme stability, complete blood count (CBC) recovery intervals, and response to ongoing systemic pharmacotherapy."
        },
        {
            "num": "08",
            "time": "04:52",
            "title": "Tab 5: AI Narrative Judge (95% VERY GOOD — Gemini 2.5 Flash)",
            "agent": "Narrative Judge Agent (Gemini 2.5 Flash)",
            "category": "Hallucination Audit & Grounding",
            "img": encode_image(str(clips_dir / "clip_08_ai_narrative_judge.png")),
            "description": "The AI Narrative Judge tab presents an independent clinical audit performed by Gemini 2.5 Flash. The agent evaluates the synthesized longitudinal narrative against source patient records across 8 critical dimensions, computing an overall quality grade of 95% (VERY GOOD) with zero hallucinations.",
            "metrics": [
                ("Overall Quality Score", "95% (VERY GOOD Grade)"),
                ("Factual Correctness", "87% Grounded Verification"),
                ("Narrative Completeness", "92% Comprehensive Coverage"),
                ("Hallucination Rate", "0.0% (Zero Unsupported Claims)")
            ],
            "technical_notes": "The 8-dimension evaluation rubric assesses: (1) Temporal Consistency, (2) Citation Grounding, (3) Factual Correctness, (4) Completeness, (5) Diagnostic Alignment, (6) Medication Fidelity, (7) Clinical Safety, and (8) Hallucination Absence. Direct quote citations substantiate every metric."
        },
        {
            "num": "09",
            "time": "05:28",
            "title": "Tab 6: Patient Export Suite (Master Parquet, JSON, FHIR)",
            "agent": "Curated Export & Analytics Service",
            "category": "Interoperability & Data Lake",
            "img": encode_image(str(clips_dir / "clip_09_export_suite.png")),
            "description": "The Patient Export Suite enables seamless downstream integration with clinical trial data lakes, EHR systems, and biostatistical pipelines. Formats include high-speed columnar Parquet files ('master_data.parquet'), complete UI state JSON models ('DASHBOARD.json'), and narrative dossiers.",
            "metrics": [
                ("Columnar Format", "master_data.parquet (Apache Arrow)"),
                ("Structured Model", "DASHBOARD.json (Schema v8.0)"),
                ("Narrative File", "LONGITUDINAL_PATIENT_NARRATIVE.json"),
                ("Security Protocol", "HIPAA-Compliant Stateless Extraction")
            ],
            "technical_notes": "Curated outputs are persisted to 'gs://mevreon-curated-gcp/cases/sadhnaagarwal11/', enabling direct BigQuery federation, Spark distributed training, and automated clinical trial cohort matching."
        },
        {
            "num": "10",
            "time": "05:52",
            "title": "Stage 10: Multimodal Comparison — Patient 1 Neurology CT DICOM Series",
            "agent": "Cross-Organism Clinical Registry",
            "category": "Multi-Modal Scale & PACS",
            "img": encode_image(str(clips_dir / "clip_10_multimodal_patient1.png")),
            "description": "The final stage demonstrates the multi-case enterprise capability of the platform by cross-examining Patient 1 (NEUROLOGY). Ingesting 137 source files including high-resolution CT DICOM imaging series, the system extracts volumetric brain slice headers, 6 encounters, 11 timeline events, and 9 ICD-10 diagnoses.",
            "metrics": [
                ("Patient Case ID", "NEUROLOGY (Patient 1)"),
                ("Ingested Source Files", "137 Files (DICOM + PDF + Word)"),
                ("Clinical Encounters", "6 Documented Hospital Encounters"),
                ("ICD-10 Diagnoses", "9 Standardized Neurological Codes")
            ],
            "technical_notes": "Demonstrates the universal versatility of the Mevreon agentic engine across complex imaging-heavy neurology cases, molecular oncology cases, and diverse diagnostic clinical portfolios."
        }
    ]

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mevreon GCP Clinical Data Platform — Split Clip Technical Dossier</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

    @page {{
        size: A4 portrait;
        margin: 14mm 12mm 14mm 12mm;
    }}

    * {{
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }}

    body {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: #04070d;
        color: #e2e8f0;
        line-height: 1.45;
        font-size: 11pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }}

    .cover-page {{
        height: 100vh;
        max-height: 260mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 24mm 16mm;
        background: radial-gradient(circle at 80% 20%, rgba(20, 184, 166, 0.15) 0%, transparent 60%),
                    radial-gradient(circle at 20% 80%, rgba(14, 165, 233, 0.12) 0%, transparent 60%),
                    #04070d;
        border: 1px solid rgba(20, 184, 166, 0.3);
        border-radius: 12px;
        page-break-after: always;
    }}

    .header-badge {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 20px;
        background: rgba(20, 184, 166, 0.12);
        border: 1px solid rgba(20, 184, 166, 0.4);
        color: #2dd4bf;
        font-size: 9pt;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }}

    .cover-title {{
        font-size: 28pt;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.15;
        margin-top: 18px;
        margin-bottom: 12px;
        letter-spacing: -0.02em;
    }}

    .cover-title span {{
        color: #2dd4bf;
    }}

    .cover-subtitle {{
        font-size: 13pt;
        color: #94a3b8;
        max-width: 650px;
        line-height: 1.5;
        margin-bottom: 24px;
    }}

    .meta-grid {{
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
        margin: 24px 0;
    }}

    .meta-card {{
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 8px;
        padding: 14px 18px;
    }}

    .meta-label {{
        font-size: 8.5pt;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
    }}

    .meta-value {{
        font-size: 11pt;
        color: #f1f5f9;
        font-weight: 700;
        font-family: 'JetBrains Mono', monospace;
    }}

    .section-page {{
        padding: 8mm 0;
        page-break-after: always;
    }}

    .section-page:last-child {{
        page-break-after: avoid;
    }}

    .stage-header {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid rgba(20, 184, 166, 0.4);
        padding-bottom: 10px;
        margin-bottom: 14px;
    }}

    .stage-pill {{
        background: #14b8a6;
        color: #04070d;
        font-size: 9pt;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 6px;
        letter-spacing: 0.05em;
    }}

    .stage-time {{
        font-family: 'JetBrains Mono', monospace;
        font-size: 10pt;
        color: #38bdf8;
        font-weight: 700;
    }}

    .clip-title {{
        font-size: 16pt;
        font-weight: 800;
        color: #ffffff;
        margin: 6px 0 4px 0;
        letter-spacing: -0.01em;
    }}

    .clip-subtitle {{
        font-size: 9.5pt;
        color: #94a3b8;
        margin-bottom: 12px;
    }}

    .clip-frame-container {{
        width: 100%;
        border-radius: 8px;
        border: 1px solid rgba(51, 65, 85, 0.9);
        overflow: hidden;
        margin-bottom: 14px;
        background: #0b0f17;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }}

    .clip-img {{
        width: 100%;
        height: auto;
        display: block;
    }}

    .metrics-row {{
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
    }}

    .metric-pill {{
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 6px;
        padding: 8px 12px;
    }}

    .metric-pill-label {{
        font-size: 7.5pt;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 2px;
    }}

    .metric-pill-value {{
        font-size: 9pt;
        color: #2dd4bf;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }}

    .description-box {{
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(30, 41, 59, 0.8);
        border-left: 3px solid #14b8a6;
        padding: 10px 14px;
        font-size: 9.5pt;
        color: #cbd5e1;
        line-height: 1.5;
        margin-bottom: 10px;
        border-radius: 0 6px 6px 0;
    }}

    .notes-box {{
        background: rgba(11, 15, 23, 0.8);
        border: 1px solid rgba(30, 41, 59, 0.6);
        padding: 8px 14px;
        font-size: 8.5pt;
        color: #94a3b8;
        line-height: 1.45;
        border-radius: 6px;
    }}

    .notes-box strong {{
        color: #38bdf8;
    }}

    .doc-footer {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid rgba(51, 65, 85, 0.6);
        padding-top: 8px;
        margin-top: 12px;
        font-size: 8pt;
        color: #64748b;
        font-family: 'JetBrains Mono', monospace;
    }}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
    <div>
        <div class="header-badge">Mevreon Clinical AI Systems • Google Cloud Platform</div>
        <h1 class="cover-title">Autonomous Medical Data Platform<br/><span>Split-Clip Technical Dossier</span></h1>
        <p class="cover-subtitle">Complete 10-stage execution walkthrough: From multimodal patient folder upload to longitudinal clinical story, 5-agent audit trail, RxNorm medications, and Gemini 2.5 Flash narrative verification.</p>
        
        <div class="meta-grid">
            <div class="meta-card">
                <div class="meta-label">Live Cloud Run Frontend</div>
                <div class="meta-value">mevreon-gcp-frontend</div>
            </div>
            <div class="meta-card">
                <div class="meta-label">Backend API Gateway</div>
                <div class="meta-value">mevreon-gcp-backend (HTTP 200)</div>
            </div>
            <div class="meta-card">
                <div class="meta-label">Primary Patient Staged</div>
                <div class="meta-value">sadhnaagarwal11 (Saadhna Agarwal)</div>
            </div>
            <div class="meta-card">
                <div class="meta-label">Companion Walkthrough MP4</div>
                <div class="meta-value">06:00 (1080p Full HD • 3,600 Frames)</div>
            </div>
        </div>
    </div>

    <div>
        <div class="meta-card" style="margin-bottom: 14px;">
            <div class="meta-label">Deterministic 5-Stage Agentic Pipeline</div>
            <div class="meta-value" style="font-size: 9.5pt; color: #cbd5e1; font-weight: normal; margin-top: 4px;">
                1. Ingestion Agent (OCR & DICOM) &nbsp;➔&nbsp; 
                2. Cleaning Agent (RxNorm/LOINC) &nbsp;➔&nbsp; 
                3. Validation Agent (Physiological Bounds) &nbsp;➔&nbsp; 
                4. Feature Agent (Gemini Synthesis) &nbsp;➔&nbsp; 
                5. Narrative Judge Agent (Hallucination Audit)
            </div>
        </div>
        <div class="doc-footer">
            <span>Mevreon Bio-AI Platform v8.0 • Confidential Clinical Briefing</span>
            <span>Google Cloud Run (us-central1)</span>
        </div>
    </div>
</div>

<!-- 10 DEDICATED CLIP PAGES -->
"""

    for c in clips_data:
        metrics_html = "".join([
            f"""<div class="metric-pill">
                <div class="metric-pill-label">{m[0]}</div>
                <div class="metric-pill-value">{m[1]}</div>
            </div>"""
            for m in c["metrics"]
        ])

        html_content += f"""
<div class="section-page">
    <div class="stage-header">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="stage-pill">STAGE {c['num']}</span>
            <span style="font-size: 9.5pt; color: #94a3b8; font-weight: 600; text-transform: uppercase;">{c['category']}</span>
        </div>
        <div class="stage-time">VIDEO TIMECODE: {c['time']} / 06:00</div>
    </div>

    <h2 class="clip-title">{c['title']}</h2>
    <div class="clip-subtitle">Active Agent: <strong style="color: #2dd4bf;">{c['agent']}</strong></div>

    <div class="clip-frame-container">
        <img class="clip-img" src="{c['img']}" alt="{c['title']}" />
    </div>

    <div class="metrics-row">
        {metrics_html}
    </div>

    <div class="description-box">
        {c['description']}
    </div>

    <div class="notes-box">
        <strong>Engine Specifications & Clinical Logic:</strong> {c['technical_notes']}
    </div>

    <div class="doc-footer">
        <span>Stage {c['num']} of 10 • Patient: Saadhna Agarwal (sadhnaagarwal11)</span>
        <span>Page {int(c['num']) + 1} of 11</span>
    </div>
</div>
"""

    html_content += """
</body>
</html>
"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Generated HTML report at: {html_path} ({os.path.getsize(html_path)} bytes)")

    # Find Chrome
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    chrome_bin = None
    for p in chrome_paths:
        if os.path.exists(p):
            chrome_bin = p
            break

    if not chrome_bin:
        print("Error: No Chrome or Edge binary found!")
        sys.exit(1)

    print(f"Compiling PDF via headless browser: {chrome_bin}...")
    chrome_cmd = [
        chrome_bin,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={str(output_pdf)}",
        str(html_path)
    ]

    subprocess.run(chrome_cmd, check=True)

    if output_pdf.exists():
        pdf_size = os.path.getsize(output_pdf)
        print(f"[SUCCESS] Generated PDF at: {output_pdf} ({pdf_size} bytes, {pdf_size/1024/1024:.2f} MB)")
        
        # Copy to brain artifacts
        import shutil
        shutil.copy2(output_pdf, output_brain_pdf)
        print(f"[SUCCESS] Copied PDF to brain artifacts: {output_brain_pdf}")
    else:
        print("Error: PDF was not generated.")
        sys.exit(1)

if __name__ == '__main__':
    main()
