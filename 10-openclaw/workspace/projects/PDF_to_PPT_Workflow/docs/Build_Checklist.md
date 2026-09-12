# PDF to PPT / Google Slides Workflow - Build Checklist

## 1. Core workflow foundation

- [x] Create project folder structure
- [x] Create roadmap document
- [x] Decide practical build direction: editable PPTX first, Google Slides later
- [x] Decide n8n-compatible architecture
- [x] Set architecture: n8n orchestrator + Python worker + AI API + Google Drive API

## 2. PDF extraction

- [x] Add PDF text extraction
- [x] Add basic document parsing
- [x] Add support for extracting page-level content
- [ ] Add better image extraction from PDF
- [ ] Add chart/table extraction from PDF
- [ ] Add OCR fallback for scanned PDFs
- [ ] Add quality scoring for extracted PDF content

## 3. Slide planning and copy structure

- [x] Create fallback deck planner
- [x] Create AI deck planner
- [x] Add Gemini AI planner support
- [x] Generate 10-slide structure from PDF content
- [x] Generate editable slide copy/content
- [ ] Improve prompt for stronger business/storytelling structure
- [ ] Add client-specific copy tone rules
- [ ] Add slide-type classification: title, section, content, comparison, process, CTA, closing
- [ ] Add validation for missing/weak slide copy

## 4. PPTX generation

- [x] Create editable PPTX generator
- [x] Generate 10-slide PPTX output
- [x] Validate slide count
- [x] Test with sample PDF
- [x] Test with Truckstop Partner Playbook PDF
- [x] Improve slide layouts
- [x] Improve visual hierarchy
- [x] Add reusable layout system
- [ ] Add speaker notes or metadata if needed
- [ ] Add stronger QA validation for formatting issues

## 5. Client template recreation

- [x] Collect client PPT file
- [x] Collect client logo file
- [x] Collect client font file
- [x] Inspect client PPT design style
- [x] Extract brand colors from client PPT/logo
- [x] Identify typography rules from client PPT
- [x] Identify logo placement rules
- [x] Identify title slide layout
- [x] Identify section divider layout
- [x] Identify standard content slide layout
- [x] Identify image-heavy slide layout
- [x] Identify closing/CTA slide layout
- [x] Recreate template layouts in code
- [x] Add client font support in generated PPTX
- [x] Add logo placement in generated PPTX
- [x] Apply client colors across generated slides
- [x] Create reusable client template config
- [x] Test generated deck against client template

## 6. Google Slides support

- [ ] Upload generated PPTX to Google Drive
- [ ] Convert PPTX to Google Slides
- [ ] Preserve editability after conversion
- [ ] Check font compatibility in Google Slides
- [ ] Check logo and layout compatibility in Google Slides
- [ ] Generate shareable Google Slides link

## 7. n8n automation

- [x] Confirm workflow must be usable in n8n later
- [x] Decide Python worker/microservice should handle PDF extraction + PPTX generation
- [ ] Create API wrapper around Python worker
- [ ] Create n8n trigger/upload flow
- [ ] Send uploaded PDF to worker
- [ ] Receive generated PPTX from worker
- [ ] Upload PPTX to Google Drive from n8n
- [ ] Convert to Google Slides from n8n
- [ ] Return PPTX/Slides link to user/client
- [ ] Add error handling in n8n
- [ ] Add logging in n8n

## 8. Testing and QA

- [x] Validate generated PPTX has 10 slides
- [x] Confirm Gemini AI planner works
- [x] Confirm OpenRouter currently fails because of 401 Unauthorized
- [ ] Test with multiple client PDFs
- [ ] Test with long PDFs
- [ ] Test with design-heavy PDFs
- [ ] Test with scanned PDFs
- [ ] Compare generated deck against client PPT style
- [ ] Create manual QA checklist for deck review
- [ ] Create automated QA checks where possible

## 9. Final delivery package

- [ ] Create clean README for running locally
- [ ] Create client-template setup instructions
- [ ] Create n8n setup instructions
- [ ] Create example input/output files
- [ ] Create final workflow documentation
- [ ] Package project for handoff or deployment

## Current status summary

Done so far:

- Local MVP is working.
- PDF can be processed into editable 10-slide PPTX.
- Gemini AI planner works.
- Truckstop PDF generated successfully.
- n8n-compatible architecture has been decided.

Current next step:

- Review the generated Truckstop template deck visually, then improve exact spacing/layout fidelity against the client reference PPT.
