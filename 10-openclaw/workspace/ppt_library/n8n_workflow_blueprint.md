# n8n Workflow Blueprint — PDF to PPT Automation

## Project Goal

Build an n8n-driven system where a user uploads a PDF through a UI, the PDF is converted into structured slide content, the best PPT templates are selected using the template JSON, required images are generated using Replicate API (from `.env`) or an optional ChatGPT image model fallback, and a final `.pptx` file is produced and saved to Google Drive.

Core principle:

```text
PPTX = visual template/design
JSON = automation rules/metadata
n8n = workflow orchestration
AI = content extraction, slide planning, content writing, template matching
Image model = Replicate API primary; ChatGPT image model optional fallback
```

---

## Updated Product Decisions

These are hard requirements for the build:

1. **Input PDF can be large**
   - PDF can be 50+ pages and 50MB+ if infrastructure supports upload limits.
   - Extract text from every page. Do not skip pages.
   - Large documents should be chunked for AI processing after extraction.

2. **Output deck target**
   - Default output is 10 slides.
   - Do not force exactly 10 if the PDF clearly needs fewer or more, but 10 is the standard target.

3. **PPTX-only output**
   - Final build must be `.pptx`, not Google Slides.
   - Reason: custom fonts and branding must be preserved.

4. **Do not change design system**
   - Do not change fonts, font colors, logos, icons, brand assets, shapes, or layout.
   - Only replace intended editable text and intended image placeholders.

5. **Next.js UI**
   - UI should be built in Next.js.
   - n8n should handle backend workflow/orchestration as much as possible.

6. **Image generation provider**
   - Primary: Replicate API using credentials from `.env`.
   - Optional fallback: ChatGPT image model.

---

## Image Generation Rules

### Slide 1 hero image

Slide 1 always requires a generated image.

Prompt requirements:

- No text inside the generated image.
- Leave clean/empty space on the left side because slide text sits on the left.
- Left side should be slightly darker/less busy so overlaid text remains readable.
- Main subject/detail should sit mostly on the right side.
- Do not generate logos or brand assets inside the image.

### Other image-based slides

- Generate images only when the selected template has an intended image area or when the slide genuinely needs a visual.
- Do not generate decorative/random images.
- Do not replace logos, icons, or brand assets.
- Generated images should usually contain no text.
- If a template has an image placeholder, generate/insert only the image for that placeholder.

---

## Current Project Assets

Google Drive project folder:

```text
PDF to PPT
├── 01 Original PPT
├── 02 Single Slide PPTs
├── 03 Slide Images
├── 04 Template Index
├── 05 Final Templates
├── 06 Automation JSON
├── 11 n8n Workflow Docs
└── old
```

Existing automation JSON:

```text
PDF to PPT / 06 Automation JSON / ppt_template_library.json
```

This JSON contains:

- 18 final slide templates
- Template categories
- Character limits
- Use / avoid rules
- Image generation rules: Replicate primary, ChatGPT image fallback
- Final PPTXX template links
- Preview image links

---

## Recommended Additional Drive Folders

Create these before production testing:

```text
PDF to PPT
├── 07 Uploaded PDFs
├── 08 Generated Content
├── 09 Generated Images
├── 10 Final PPTX Outputs
└── 12 Logs and Debug
```

Purpose:

- `07 Uploaded PDFs` — store user-uploaded source PDFs
- `08 Generated Content` — store extracted text, slide outline, slide JSON
- `09 Generated Images` — store generated image outputs
- `10 Final PPTX Outputs` — store generated final PPT files
- `12 Logs and Debug` — store workflow logs and failed-run payloads

---

## High-Level Workflow

```text
1. UI / Webhook receives PDF upload
2. Save PDF to Google Drive
3. Extract readable PDF text
4. AI summarizes and structures PDF
5. AI creates target slide outline, default 10 slides
6. Load template library JSON
7. AI selects best template for each slide
8. AI writes slide-specific content within template limits
9. Identify slides needing images
10. Generate image prompts for applicable slides
11. Generate images using Replicate API or ChatGPT image model fallback and save to Drive
12. Build final `.pptx` from selected PPTX templates
13. Save final PPT to Drive
14. Return final PPT download/review link to UI
```

---

## n8n Node-by-Node Blueprint

### UI Layer — Next.js Upload Interface

**Technology:** Next.js

Purpose:

- Upload PDF
- Enter project/client name
- Set target slide count, default 10
- Add optional notes/tone/audience
- Show workflow status/progress
- Display final PPTX download link

Next.js should send the upload to the n8n webhook. n8n remains the main automation/orchestration layer.

### Node 1 — Webhook Trigger

**Node type:** Webhook

**Purpose:** Receive upload request from UI.

Expected input:

```json
{
  "pdf_file": "binary",
  "project_name": "Client Presentation",
  "target_slide_count": 10,
  "tone": "professional",
  "audience": "executives",
  "brand_notes": "optional",
  "user_notes": "optional"
}
```

Output:

- Binary PDF
- User configuration
- Run ID

Suggested run ID format:

```text
pdf_to_ppt_YYYYMMDD_HHMMSS
```

---

### Node 2 — Validate Upload

**Node type:** Code / IF

Checks:

- File exists
- File is PDF
- File is expected to support large uploads; 50MB+ PDFs are allowed if infrastructure permits
- Target slide count exists; default to 10
- Project name exists; fallback to run ID

If invalid:

- Return error response to UI
- Stop workflow

---

### Node 3 — Upload PDF to Google Drive

**Node type:** Google Drive

Store uploaded PDF in:

```text
PDF to PPT / 07 Uploaded PDFs / {run_id}_{project_name}.pdf
```

Output:

```json
{
  "pdf_drive_file_id": "...",
  "pdf_drive_link": "..."
}
```

---

### Node 4 — Extract PDF Text

**Node type options:**

Option A:
- n8n PDF Extract node / community node that can process all pages

Option B:
- HTTP request to external extraction API

Option C:
- Execute Command / custom script

Output:

```json
{
  "raw_pdf_text": "...",
  "page_count": 23,
  "extraction_quality": "good|partial|poor"
}
```

Extraction rules:

- Extract text from all PDF pages, regardless of page count.
- Do not skip pages.
- Large PDFs must be chunked after extraction if needed.
- If extraction quality is poor, send to OCR fallback before failing.
- Save extraction quality/page coverage in logs.

---

### Node 5 — Save Extracted Text

**Node type:** Google Drive

Save as:

```text
PDF to PPT / 08 Generated Content / {run_id}_extracted_text.txt
```

---

### Node 6 — AI: PDF Understanding Summary

**Node type:** AI / LLM

Prompt goal:

- Understand the PDF
- Extract key sections
- Identify main story
- Remove irrelevant noise
- Decide whether content can support target slide count
- For large PDFs, summarize in chunks first, then create one consolidated summary

Input:

- Raw PDF text
- Target slide count
- Audience
- Tone
- User notes

Output:

```json
{
  "document_summary": "...",
  "main_topics": ["..."],
  "recommended_storyline": "...",
  "content_risks": ["missing data", "too technical", "too short"]
}
```

---

### Node 7 — Load Template Library JSON

**Node type:** Google Drive → Download File / Read JSON

Load:

```text
PDF to PPT / 06 Automation JSON / ppt_template_library.json
```

Output:

```json
{
  "templates": [...]
}
```

---

### Node 8 — AI: Create Slide Outline

**Node type:** AI / LLM

Goal:

Create a target slide outline before choosing exact templates.

Default target:

```text
10 slides
```

Rules:

- Default output is 10 slides. Do not force exactly 10 if PDF content clearly needs fewer/more, but the normal target is 10 slides regardless of PDF page count.
- Each slide must have one clear message.
- Avoid repeating the same idea.
- Identify where visuals/images would help.

Output:

```json
{
  "slide_outline": [
    {
      "slide_number": 1,
      "message": "...",
      "content_type": "cover|data|timeline|content|image|section_divider",
      "needs_image": false,
      "source_evidence": "PDF section/page reference if available"
    }
  ]
}
```

---

### Node 9 — AI: Template Matching

**Node type:** AI / LLM or Code + AI hybrid

Input:

- Slide outline
- Template library JSON

Selection rules:

- Match content type to template category
- Respect `when_to_use`
- Avoid templates where `when_not_to_use` applies
- Prefer `Strong` templates where possible
- Use `Good` templates when they fit better
- Use Slide 18 only for image-only slides
- Use image templates only when visual generation is planned

Output:

```json
{
  "selected_slides": [
    {
      "output_slide_number": 1,
      "template_id": "slide_01_hero_cover",
      "template_name": "Slide 01 - Hero Cover",
      "reason": "Best fit for opening value proposition",
      "requires_image": false
    }
  ]
}
```

---

### Node 10 — AI: Generate Slide Content Within Limits

**Node type:** AI / LLM

Input:

- PDF summary
- Slide outline
- Selected template metadata
- Character limits

Rules:

- Must follow `max_heading_characters`
- Must follow `max_body_characters`
- Must follow max bullet/paragraph count
- Use bullets only when layout supports them
- Keep wording clear and business-ready
- Do not hallucinate facts not supported by PDF
- If source data is missing, write more general wording or flag it

Output:

```json
{
  "slides": [
    {
      "slide_number": 1,
      "template_id": "slide_01_hero_cover",
      "heading": "...",
      "body": "...",
      "bullets": [],
      "speaker_notes": "optional",
      "validation": {
        "heading_characters": 42,
        "body_characters": 128,
        "within_limits": true
      }
    }
  ]
}
```

---

### Node 11 — Validate Generated Content

**Node type:** Code

Checks:

- Heading length <= max
- Body length <= max
- Bullet count <= max
- Required image prompts exist for image-based slides
- Template IDs exist in JSON

If invalid:

- Send failed slide back to AI rewrite node
- Limit retries to avoid infinite loops

Output:

```json
{
  "valid": true,
  "slides": [...],
  "issues": []
}
```

---

### Node 12 — AI: Generate Image Prompts

**Node type:** AI / LLM

Only for slides where:

```json
"requires_image": true
```

Rules:

- Use Replicate API as the primary image-generation provider. API credentials should come from `.env`. ChatGPT image model can be used as fallback or alternate provider.
- Prompt should match slide message and brand/tone
- Avoid text-heavy images unless needed
- If the image is a UI/dashboard mockup, specify clean SaaS-style layout

Output:

```json
{
  "image_jobs": [
    {
      "slide_number": 9,
      "template_id": "slide_09_ui_product_showcase",
      "prompt": "...",
      "aspect_ratio": "16:9",
      "style": "professional logistics SaaS dashboard"
    }
  ]
}
```

---

### Node 13 — Image Generation

**Node type:** HTTP Request / API node

Provider priority:

1. Replicate API using `.env` credentials
2. ChatGPT image model fallback if needed

Input:

- Image prompt
- Aspect ratio
- Style

Output:

```json
{
  "slide_number": 9,
  "image_url": "...",
  "image_file_id": "..."
}
```

Store images in:

```text
PDF to PPT / 09 Generated Images / {run_id}/
```

---

### Node 14 — Build PPT Payload

**Node type:** Code

Create final build payload:

```json
{
  "run_id": "...",
  "output_name": "Client Presentation.pptx",
  "slides": [
    {
      "order": 1,
      "template_pptx_link": "...",
      "template_id": "...",
      "text_replacements": {
        "heading": "...",
        "body": "...",
        "bullets": []
      },
      "image_replacements": {
        "main_image": "generated_image_url_or_file_id"
      }
    }
  ]
}
```

---

### Node 15 — PPT Assembly

**Required approach:** PPTX-only builder

Use n8n for orchestration, but call a script/API to build PPTX.

Reason:

- PPTX manipulation is easier and more reliable in code
- n8n is better for workflow, Drive, AI, API routing
- Template PPTX files can be downloaded, edited, combined, and uploaded back

Implementation options:

1. n8n Execute Command node running Python `python-pptx`
2. Internal API endpoint that accepts build payload
3. Docker/service dedicated to PPT generation

Do not build final output in Google Slides because custom fonts/branding may break.

Recommended first version:

```text
n8n → Execute Command / HTTP call → Python PPTX builder → final PPTX
```

Output:

```json
{
  "final_pptx_path": "/tmp/generated_ppt.pptx"
}
```

Builder constraints:

- Preserve template fonts, font colors, layouts, logos, icons, and brand assets.
- Replace only known text placeholders and intended image placeholders.
- Never rebuild the slide from scratch.
- Never convert final output to Google Slides.

---

### Node 16 — Upload Final PPTX to Google Drive

**Node type:** Google Drive

Store in:

```text
PDF to PPT / 10 Final PPTX Outputs / {run_id}_{project_name}.pptx
```

Output:

```json
{
  "final_ppt_drive_link": "...",
  "final_ppt_file_id": "..."
}
```

---

### Node 17 — Save Run Metadata

**Node type:** Google Drive / Sheets / DB

Save:

```text
PDF to PPT / 12 Logs and Debug / {run_id}_run_summary.json
```

Include:

- Uploaded PDF link
- Extracted text link
- Selected templates
- Generated content JSON
- Generated image links
- Final PPTX link
- Errors/warnings

---

### Node 18 — Respond to UI

**Node type:** Respond to Webhook

Return:

```json
{
  "success": true,
  "project_name": "...",
  "final_ppt_link": "...",
  "slide_count": 10,
  "warnings": []
}
```

---

## Main Data Objects

### A. Template Library JSON

Already created:

```text
ppt_template_library.json
```

Used for:

- Template selection
- Content limits
- Image rules
- PPTX template links

### B. Slide Outline JSON

Created from PDF before choosing templates.

### C. Slide Content JSON

Created after template selection.

### D. PPT Build Payload JSON

Used by PPT builder script/API.

---

## Image Logic

Rules:

1. Slide 1 always requires a fresh generated hero image.
2. Slide 1 image must have no text, clean/darker left-side space, and main visual detail mostly on the right.
3. Slide 18 is image-only.
4. Slide 18 always requires a fresh image.
5. Any slide with an intended image area should use Replicate/ChatGPT image model-generated or approved visuals.
6. Do not generate or replace logos, icons, or brand assets.
7. Generated images should be saved in Drive.
8. The final PPTX should reference/use the generated image file.

---

## Suggested First MVP Scope

Build first version with:

- PDF upload
- Text extraction
- 10-slide outline
- Template matching using JSON
- Slide content generation
- Image prompt generation
- Manual image generation optional at first
- PPT build with text only first
- Add image replacement after text-only pipeline works

MVP order:

```text
MVP 1: PDF → slide outline + selected templates + slide content JSON
MVP 2: JSON → final PPT with text inserted
MVP 3: Add generated images
MVP 4: Add UI polish + user controls
```

---

## Risks / Things to Decide

1. PPT builder implementation
   - Decision: Python/Node PPTX builder called by n8n.
   - Output must remain `.pptx`.
   - Google Slides must not be used for final build.

2. PDF extraction method
   - Need robust extraction for 50MB+ / 50+ page PDFs.
   - Built-in n8n node vs script/API/OCR fallback.

3. Replicate/ChatGPT image model API access
   - Need exact Replicate model endpoint and `.env` variable names.
   - ChatGPT image model can be optional fallback.

4. UI implementation
   - Decision: Next.js UI.
   - Need to decide deployment location and auth if required.

5. Final deck style
   - Strictly use template text boxes and intended image placeholders.
   - Do not change branding/design elements.

---

## Next Build Step After This Blueprint

Create the actual n8n workflow in phases:

```text
Phase 1: PDF upload → extract text → save content JSON
Phase 2: Load template JSON → generate outline → match templates
Phase 3: Generate slide content within character rules
Phase 4: Build PPTX
Phase 5: Add image generation
Phase 6: Final UI + testing
```
