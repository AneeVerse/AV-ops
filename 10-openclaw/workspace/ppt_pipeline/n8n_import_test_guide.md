# n8n Import & Test Guide — PDF to PPT Automation

## Purpose

This guide explains how to import and test the draft n8n workflow for the PDF → PPTX automation system.

Workflow file:

```text
n8n_pdf_to_ppt_workflow_draft.json
```

Goal of first n8n test:

```text
Upload PDF → run backend pipeline → generate PPTX → upload final PPTX to Google Drive → return link
```

---

## Current Workflow Draft

Stored in Google Drive:

```text
PDF to PPT / 11 n8n Workflow Docs / n8n_pdf_to_ppt_workflow_draft.json
```

Workflow nodes:

```text
Webhook - PDF Upload
↓
Validate Upload Config
↓
Write PDF To Local Temp
↓
Run Backend Pipeline
↓
Parse Pipeline Result
↓
Prepare Final PPTX Binary
↓
Upload Final PPTX To Drive
↓
Respond With PPTX Link
```

---

## Required Before Import

### 1. n8n must run on the same server

The draft workflow currently calls local scripts:

```text
/root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py
```

So n8n must run on the same VPS/server where this path exists.

If n8n runs somewhere else, either:

- copy the backend pipeline folder there, or
- convert the backend into an HTTP API service.

---

### 2. Required local folders/files

These must exist:

```text
/root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py
/root/.openclaw/workspace/ppt_pipeline/scripts/extract_pdf_text.py
/root/.openclaw/workspace/ppt_pipeline/scripts/ai_slide_planner.py
/root/.openclaw/workspace/ppt_library/pptx_builder_repeat.py
/root/.openclaw/workspace/ppt_library/Original-2_Revised_Text_Only.pptx
/root/.openclaw/workspace/ppt_library/pptx_placeholder_map.json
/root/.openclaw/workspace/ppt_library/test_images/hero.png
```

---

### 3. Required Python environment

The scripts currently use:

```text
/root/.openclaw/workspace/.venv-ppt/bin/python
```

But the draft n8n workflow currently calls:

```text
python3 /root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py
```

Recommended update inside n8n Execute Command node:

```bash
/root/.openclaw/workspace/.venv-ppt/bin/python /root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py "{{$json.local_pdf_path}}"
```

This avoids missing Python packages.

---

### 4. Required system tools

Installed/needed:

```text
pdftotext
pdfinfo
LibreOffice / soffice, optional
```

Check:

```bash
which pdftotext
which pdfinfo
```

---

### 5. Required API key

OpenRouter project key is now saved as:

```text
CB_openrouter_CB_bot_anees
```

Stored in:

```text
/root/.openclaw/workspace/.env
/root/.env
```

The planner checks this key first.

Current working AI provider:

```text
OpenRouter
```

Tested with:

```text
openai/gpt-4o-mini
```

---

## Import Steps

### Step 1 — Download workflow JSON

Download from Google Drive:

```text
n8n_pdf_to_ppt_workflow_draft.json
```

### Step 2 — Import into n8n

In n8n:

```text
Workflows → Import from File → select JSON
```

### Step 3 — Replace Google Drive credential

Node:

```text
Upload Final PPTX To Drive
```

Replace credential placeholder:

```text
REPLACE_WITH_CREDENTIAL_ID
```

with your actual Google Drive OAuth credential in n8n.

### Step 4 — Update Execute Command node

Node:

```text
Run Backend Pipeline
```

Change command to:

```bash
/root/.openclaw/workspace/.venv-ppt/bin/python /root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py "{{$json.local_pdf_path}}"
```

### Step 5 — Check webhook path

Webhook path:

```text
/pdf-to-ppt-generate
```

Test URL will look like:

```text
https://YOUR_N8N_DOMAIN/webhook-test/pdf-to-ppt-generate
```

Production URL:

```text
https://YOUR_N8N_DOMAIN/webhook/pdf-to-ppt-generate
```

---

## Test Request

Use a multipart/form-data POST.

Required file field:

```text
pdf_file
```

Optional fields:

```text
project_name
 target_slide_count
 tone
 audience
 user_notes
```

Example curl:

```bash
curl -X POST "https://YOUR_N8N_DOMAIN/webhook-test/pdf-to-ppt-generate" \
  -F "pdf_file=@/path/to/sample.pdf" \
  -F "project_name=Test Presentation" \
  -F "target_slide_count=10" \
  -F "tone=professional" \
  -F "audience=executives"
```

Expected response:

```json
{
  "success": true,
  "run_id": "...",
  "final_ppt_file": "...pptx",
  "final_ppt_drive_id": "...",
  "final_ppt_link": "..."
}
```

---

## Expected Output

Final PPTX should be uploaded to:

```text
PDF to PPT / 10 Final PPT Outputs
```

The PPTX should:

- have about 10 slides
- preserve template fonts/colors/layout
- replace text placeholders
- replace only approved image placeholders
- keep brand assets unchanged
- be editable in PowerPoint

---

## Current Known Limitations

### 1. Source PDF is not yet uploaded to Drive in workflow

The draft stores the PDF locally for processing.

Production improvement:

```text
After webhook → upload source PDF to 07 Uploaded PDFs
```

### 2. Generated content/logs are not fully uploaded yet

Production improvement:

```text
Upload extracted text, chunks, build payload, validation report, and run summary to Drive.
```

### 3. Image generation not connected yet

Current backend uses local test hero image.

Next phase:

```text
Replicate / ChatGPT image generation
↓
Save generated image to Drive
↓
Pass local image path to PPTX builder
```

### 4. Next.js UI not built yet

Current test uses direct webhook upload.

Next phase:

```text
Next.js upload UI → n8n webhook
```

---

## Common Errors & Fixes

### Error: No PDF file uploaded

Cause:

- wrong multipart field name

Fix:

```text
Use field name: pdf_file
```

---

### Error: Uploaded file must be PDF

Cause:

- uploaded file name does not end with `.pdf`

Fix:

```text
Upload a valid PDF file.
```

---

### Error: command failed / script not found

Cause:

- n8n is not running on same server
- script path is wrong
- Python env path is wrong

Fix:

```bash
ls /root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py
ls /root/.openclaw/workspace/.venv-ppt/bin/python
```

Update Execute Command node accordingly.

---

### Error: OpenRouter/Gemini failed

Cause:

- missing/invalid API key
- quota/rate limit

Fix:

Check `.env`:

```text
CB_openrouter_CB_bot_anees=...
```

Then rerun provider test.

---

### Error: final PPTX not uploaded

Cause:

- Google Drive credential not set
- wrong Drive node settings
- binary property mismatch

Fix:

Check Drive node:

```text
binary property = final_pptx
folder = 10 Final PPT Outputs
```

---

## Recommended First Manual Test

Use this existing sample PDF:

```text
/root/.openclaw/workspace/ppt_pipeline/samples/sample_source.pdf
```

First test locally before n8n:

```bash
/root/.openclaw/workspace/.venv-ppt/bin/python \
  /root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py \
  /root/.openclaw/workspace/ppt_pipeline/samples/sample_source.pdf
```

Then test through n8n webhook.

---

## Next Step After Import Test

After workflow works in n8n:

```text
1. Add source PDF upload to Google Drive
2. Add extracted text/log upload to Google Drive
3. Add image generation node
4. Add Next.js UI
5. Run end-to-end test with real client PDF
```
