# PDF to Editable PPT Roadmap

## Goal

Input: PDF document  
Output: editable 10-slide PPTX first, then optionally Google Slides link.

The deck must include:

- PPT structure: slide order, layouts, visual hierarchy
- Copy structure: headlines, subheadlines, bullets, captions, CTA
- Editable text and layout wherever possible

## Recommended Tool Stack

### Phase 1: PDF extraction and analysis

Tools:

- `PyMuPDF` / `fitz` for PDF text, images, page previews, metadata
- `pdfplumber` for tables and structured text extraction
- OCR fallback: `Tesseract` or cloud OCR if scanned PDFs are common
- AI model for content understanding, summarization, and copywriting

Purpose:

- Extract raw PDF text
- Extract useful images/charts/tables
- Detect sections/headings
- Create content summary
- Decide what should become 10 slides

### Phase 2: Slide planning

Tools:

- AI model
- JSON schema validation

Output:

A structured `deck_plan.json` with:

- deck title
- slide count
- slide objective
- slide title
- subheading
- main bullets
- visual suggestion
- source PDF references
- speaker/copy notes if needed

### Phase 3: Copy structure generation

Tools:

- AI model
- rules/checker script

Purpose:

Convert PDF content into presentation-ready copy:

- Short headlines
- Clean bullet points
- Strong slide narrative
- No dense paragraph dumping
- Consistent tone

### Phase 4: PPTX generation

Tools:

- Python `python-pptx`
- Optional: branded PPT template `.pptx`
- Optional: image/chart extraction from PDF

Purpose:

Generate editable PowerPoint slides:

- Text boxes are editable
- Shapes are editable
- Layout is consistent
- Extracted images/charts can be placed where useful

This is the best first output format because it is easiest to automate and test locally.

### Phase 5: QA and validation

Tools:

- Python validation script
- LibreOffice headless export for preview PDF/images
- Optional visual screenshot comparison

Checks:

- Exactly 10 slides
- Text not overflowing badly
- Required fields are present
- File opens successfully
- PPTX is editable
- Basic spelling/format sanity

### Phase 6: Google Slides conversion

Tools:

- Google Drive API
- Google Slides API
- Google Workspace CLI / service account

Recommended practical path:

1. Generate PPTX locally.
2. Upload PPTX to Google Drive.
3. Convert uploaded PPTX to Google Slides.
4. Generate shareable link.

Direct Google Slides creation can come later if needed.

### Phase 7: n8n automation

Tools:

- n8n webhook / form trigger
- Google Drive node
- Code node / external Python service
- AI model node/API
- Google Sheets/Drive/Slides nodes

Future n8n flow:

1. User uploads PDF.
2. n8n stores PDF in Drive.
3. Python service extracts PDF content.
4. AI creates deck plan + copy structure.
5. Python generates PPTX.
6. n8n uploads PPTX to Drive.
7. n8n optionally converts to Google Slides.
8. n8n returns final file/link.

## Roadmap

### Milestone 1: Manual prototype

Deliverable:

- One PDF converted into a 10-slide editable PPTX.

Tasks:

1. Build PDF extraction script.
2. Build deck planning prompt/schema.
3. Generate deck plan JSON.
4. Generate PPTX from JSON.
5. QA output manually.

### Milestone 2: Repeatable local workflow

Deliverable:

- CLI command that takes `input.pdf` and returns `output.pptx`.

Tasks:

1. Standardize folder structure.
2. Add configurable slide count.
3. Add theme/template support.
4. Add validation script.
5. Save intermediate artifacts:
   - extracted text
   - image assets
   - deck plan JSON
   - final PPTX

### Milestone 3: Google Drive / Slides integration

Deliverable:

- PPTX uploaded to Drive and optionally converted to Google Slides.

Tasks:

1. Add Drive upload.
2. Add share-link creation.
3. Add Google Slides conversion.
4. Return both PPTX link and Google Slides link.

### Milestone 4: n8n automation

Deliverable:

- End-to-end automated workflow.

Tasks:

1. Create n8n trigger.
2. Accept PDF upload or Drive file link.
3. Call the PDF-to-PPT generator.
4. Upload generated deck.
5. Update status/logs.
6. Send final link.

## Recommended Build Order

1. Build PPTX generator first.
2. Add Google Drive upload second.
3. Add Google Slides conversion third.
4. Build n8n automation last.

Reason:

PPTX generation is the easiest to control, debug, and validate. Google Slides is useful for sharing, but should be treated as delivery/conversion layer first, not the core generation engine.

## n8n Compatibility Decision

Because this workflow must become an n8n automation later, choose tools that can run in or be called from n8n.

### n8n-friendly architecture

Recommended pattern:

- n8n controls the workflow/orchestration.
- A small Python service/script handles PDF extraction and PPTX generation.
- AI APIs handle summarization, copy structure, and slide planning.
- Google Drive/Slides nodes handle storage and sharing.

This is better than trying to do everything inside n8n Code nodes.

### Tools that are compatible with n8n

#### PDF extraction

Use:

- Python script with `PyMuPDF`
- Python script with `pdfplumber`
- Optional OCR service/API for scanned PDFs

n8n integration method:

- Execute Command node if self-hosted n8n
- HTTP Request node to call a Python microservice
- Dockerized worker service

#### AI planning/copywriting

Use:

- OpenAI / Gemini / Anthropic API
- Structured JSON output

n8n integration method:

- Native AI nodes if available
- HTTP Request node
- OpenAI/Gemini/Anthropic nodes

#### PPTX generation

Use:

- Python `python-pptx`

n8n integration method:

- Execute Command node
- Python worker API
- Docker container

#### File storage and sharing

Use:

- Google Drive API
- Google Drive n8n node

n8n integration method:

- Upload generated PPTX to Drive
- Set permissions
- Return share link

#### Google Slides conversion

Use:

- Google Drive API conversion from PPTX to Google Slides
- Optional Google Slides API for direct edits later

n8n integration method:

- Google Drive node if it supports conversion in the target setup
- HTTP Request node to Google Drive API
- Custom Python/Node helper if needed

## Final Tool Choice for n8n Future

Core tools to standardize on:

1. `PyMuPDF` for PDF parsing
2. `pdfplumber` for tables/structured extraction
3. AI API for slide plan and copy structure
4. `python-pptx` for editable PPTX generation
5. Google Drive API for upload/share
6. Google Drive conversion to Google Slides as optional delivery format
7. n8n as the orchestrator

Avoid tools that only work manually or depend heavily on a desktop UI.

## Preferred Production Architecture

```text
PDF Upload / Drive Link
        ↓
n8n Trigger
        ↓
Download PDF
        ↓
Python PDF Extractor
        ↓
AI Slide Planner + Copywriter
        ↓
Python PPTX Generator
        ↓
QA / Validation
        ↓
Upload PPTX to Google Drive
        ↓
Optional Convert to Google Slides
        ↓
Return Final Link
```

## Practical Recommendation

For prototype:

- Run the Python workflow locally/manual first.

For n8n:

- Wrap the Python workflow as either:
  1. Execute Command node, if n8n is self-hosted on the same server, or
  2. HTTP API microservice, if we want cleaner production scaling.

Best long-term option: **HTTP API microservice called by n8n**.

Reason:

- Easier debugging
- Cleaner file handling
- Easier to reuse
- Less fragile than large n8n Code nodes
- Can be deployed independently
