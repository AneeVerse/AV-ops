# PDF to PPT Development Status

## Current MVP Status

Built local Python MVP that converts a PDF into an editable 10-slide PPTX.

## Implemented

- Project structure
- Python virtual environment dependencies
- PDF extraction using PyMuPDF + pdfplumber
- Page preview image rendering
- Deck plan JSON schema
- AI deck planner using Gemini API
- OpenRouter planner support, but current environment returned 401 during test
- Deterministic fallback deck planner
- Editable PPTX generator using python-pptx
- PPTX validation script
- CLI runner

## Main command

From `projects/PDF_to_PPT_Workflow`:

```bash
. .venv/bin/activate
./scripts/pdf_to_pptx.py inputs/sample.pdf --slides 10 --planner ai --provider gemini --out outputs/sample_deck.pptx
```

Fallback-only command:

```bash
./scripts/pdf_to_pptx.py inputs/sample.pdf --slides 10 --planner fallback --out outputs/sample_deck_fallback.pptx
```

## Current files

- `scripts/pdf_to_pptx.py` — main runner
- `src/pdf_to_ppt/extract_pdf.py` — PDF extraction
- `src/pdf_to_ppt/deck_schema.py` — deck/slide schemas
- `src/pdf_to_ppt/plan_deck.py` — fallback deck planner
- `src/pdf_to_ppt/generate_pptx.py` — editable PPTX generator
- `src/pdf_to_ppt/validate.py` — output validator

## Validation result

Tested with `inputs/sample.pdf`.

Outputs:

- `outputs/sample_deck_fallback.pptx` — fallback planner, 10 slides, validation passed
- `outputs/sample_deck_ai_gemini.pptx` — Gemini AI planner, 10 slides, validation passed

## Next Development Steps

1. Improve branded/template styling.
2. Add extraction of images/charts from PDF.
3. Add support for custom audience/tone/brand brief.
4. Add Google Drive upload.
5. Add Google Slides conversion.
6. Wrap as HTTP API or n8n Execute Command workflow.
