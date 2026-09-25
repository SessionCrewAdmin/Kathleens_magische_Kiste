# Content Extractor V2 · History PDF Vertical Slice

## Integration

The History Knowledge Base remains canonical in `data/history/`. Reviewed PDF imports are an additive overlay in Supabase; the existing History Content Center and Assessment History Adapter merge that overlay into the selected chapter at read time. No second client-side History KB or direct PDF-to-Assessment path is introduced.

Run `supabase/migrations/202609250001_history_content_imports.sql` in the existing Supabase project before enabling imports. Writes require the already configured Kisten admin passphrase via `toolbox_verify_admin`; direct table access is revoked. Re-importing the same PDF into the same chapter is blocked by its SHA-256 fingerprint.

## Current vertical slice

- Select one PDF (maximum 20 MB / 100 pages), grade, and existing History chapter.
- PDF.js extracts machine-readable text page-by-page; low-text pages fall back to German Tesseract.js OCR.
- Per-page text, heading candidates, printed page references, and explainable confidence are shown in a review editor.
- The teacher selects pages, edits a heading, and writes a short summary before confirmation.
- Import records include source metadata, page provenance, timestamp, import session ID, extractor version, review state, and confidence.
- Original PDFs and extracted page text remain in browser memory and are not sent to or stored in GitHub or Supabase.
- Confirmation appends reviewed topic/source objects; History Content Center, the existing Assessment Engine, and History game adapters can use them immediately.
- The import report exposes an admin-password-protected rollback for that exact import session.

## Deliberate limits of the first slice

ZIP/batch, image-only uploads, automatic OCR of non-PDF images, term/person/event extraction, editing/rollback of prior sessions, and Vocabulary imports are not included yet. Subject and chapter are teacher-selected rather than silently guessed. Confidence is a deterministic heuristic based on text/OCR quality, structure signals, and History vocabulary; it is a review aid, not a claim of factual verification. Grammar/LehrplanPLUS remain unchanged.

The hosted GitHub Pages app needs the migration above. Until it has been applied, the canonical static History KB continues to work, while the import page reports that persistence setup is missing. First-time OCR also downloads the German OCR engine/language data from its pinned CDN; the original PDF is still processed locally in the browser.
