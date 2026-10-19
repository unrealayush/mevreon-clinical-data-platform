# Mevreon Platform Development Status & Roadmap

## Architecture Milestones
- [x] Multimodal ingestion pipeline (DICOM, PDF, VCF, DOCX, XLSX, OCR)
- [x] Deterministic physiological bounds engine (`validate_lab_value` for 40+ tests)
- [x] Ontological cleaning (RxNorm, LOINC, ICD-10, SNOMED CT)
- [x] Grounded evidence highlighting (PDF receipts with bounding box highlights)
- [x] GCP migration (FastAPI gateway, Cloud Run Jobs, Vertex AI Gemini, GCS buckets)
- [x] GCP S3-compatibility shim (`gcpStorage.js`) for seamless React UI communication
- [x] Cloud Run deployment (frontend + backend live in `us-central1`)
- [x] Storage pagination & token continuation support
- [x] Fix monolith entrypoint in `run_monolith.sh`

## Next Phase Engineering
- [ ] Refactor 11,000-line `App.jsx` into modular domain components (`pages/`, `features/`)
- [ ] Migrate in-memory user authentication store to Cloud SQL / Firebase Auth
- [ ] Migrate plaintext API keys to Google Cloud Secret Manager
- [ ] Consolidate or prune unused legacy components (`components/AgentTabs.jsx`, etc.)
