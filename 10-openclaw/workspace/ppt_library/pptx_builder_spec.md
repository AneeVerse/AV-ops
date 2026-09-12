# PPTX Builder Specification — PDF to PPT Automation

## Purpose

The PPTX Builder is the component that receives finalized slide content from n8n and creates the final `.pptx` presentation using the approved PPTX template library.

The builder must preserve the original template design exactly.

```text
n8n = orchestration
Next.js = UI
AI = content planning/writing
Image model = Replicate primary, ChatGPT image fallback
PPTX Builder = final .pptx assembly
```

---

## Hard Rules

1. Final output must be `.pptx`.
2. Do not use Google Slides for final generation.
3. Do not change fonts.
4. Do not change font colors.
5. Do not move or resize layout elements.
6. Do not modify logos, icons, brand assets, shapes, or background elements.
7. Replace only approved text placeholders and intended image placeholders.
8. Do not rebuild slides from scratch.
9. Keep custom fonts and branding intact.
10. Output should be editable in PowerPoint.

---

## Recommended Implementation

Preferred implementation:

```text
n8n → HTTP Request / Execute Command → Python PPTX Builder → final .pptx → Google Drive
```

Recommended stack:

- Python
- `python-pptx`
- `Pillow` for image preparation/cropping if needed
- Google Drive API handled by n8n where possible

Alternative:

- Node.js PPTX builder, only if it can safely preserve formatting.

Recommendation: start with **Python** because PPTX manipulation and XML-level control are more reliable.

---

## Input Payload From n8n

n8n should send a JSON payload to the builder.

Example:

```json
{
  "run_id": "pdf_to_ppt_20260520_113000",
  "project_name": "Client Presentation",
  "output_file_name": "Client Presentation.pptx",
  "template_library_version": "revised_18_slides_v1",
  "slides": [
    {
      "order": 1,
      "template_id": "slide_01_hero_cover",
      "template_file_link": "https://docs.google.com/presentation/d/...",
      "template_file_id": "...",
      "template_file_name": "Slide 01 - Hero Cover.pptx",
      "text": {
        "heading": "Keep Freight Moving With Less Friction",
        "subheading": "A connected workflow for sourcing, compliance, booking, and payments.",
        "body": "",
        "bullets": []
      },
      "images": {
        "hero_image": {
          "file_id": "...",
          "url": "...",
          "placement": "hero_right_weighted"
        }
      },
      "notes": {
        "source_pdf_pages": [1, 2],
        "content_warning": ""
      }
    }
  ]
}
```

---

## Output Payload From Builder

The builder should return:

```json
{
  "success": true,
  "run_id": "pdf_to_ppt_20260520_113000",
  "output_pptx_path": "/tmp/pdf_to_ppt_20260520_113000.pptx",
  "slide_count": 10,
  "warnings": [],
  "errors": []
}
```

n8n then uploads the PPTX to:

```text
PDF to PPT / 10 Final PPT Outputs
```

---

## Template Source

Templates come from:

```text
PDF to PPT / 05 Final Templates
```

Template metadata comes from:

```text
PDF to PPT / 06 Automation JSON / ppt_template_library.json
```

The builder should not decide which template to use. Template selection happens before this step in n8n/AI.

The builder only receives selected templates and fills them.

---

## Slide Assembly Logic

For each slide in the input payload:

1. Download/open selected single-slide PPTX template.
2. Duplicate/import that slide into the final presentation.
3. Replace approved text placeholders.
4. Replace approved image placeholders if provided.
5. Preserve all styling and design elements.
6. Append slide to final deck in given order.

Final output order must match the `order` field.

---

## Text Replacement Rules

The builder must replace text without changing formatting.

Preferred method:

- Find text boxes by placeholder labels or mapped shape IDs.
- Replace text inside existing runs/paragraphs where possible.
- Preserve font family, font size, bold, italic, color, alignment, and line spacing.

Do not:

- Create new text boxes unless explicitly required.
- Change font size automatically unless later approved.
- Move text boxes.
- Resize text boxes.
- Change colors.

If text does not fit:

- Return warning/error to n8n.
- Do not silently shrink font.
- n8n should send content back to AI rewrite step.

---

## Required Placeholder Mapping

Before production, each template should have a mapping like this:

```json
{
  "template_id": "slide_09_ui_product_showcase",
  "text_placeholders": {
    "heading": {
      "shape_name": "heading_box",
      "required": true
    },
    "body": {
      "shape_name": "body_box",
      "required": false
    }
  },
  "image_placeholders": {
    "main_image": {
      "shape_name": "image_placeholder_1",
      "required": true,
      "fit": "cover"
    }
  }
}
```

If shape names are not available, we need to create a stable mapping using:

- slide number
- shape index
- existing placeholder text
- position coordinates

Recommended next technical task: create `pptx_placeholder_map.json`.

---

## Image Replacement Rules

### General image rules

- Replace only intended image placeholders.
- Do not replace logos.
- Do not replace icons.
- Do not replace decorative brand elements.
- Do not insert generated images into random areas.
- Generated images should usually contain no text.

### Slide 1 hero image

Slide 1 always requires a generated image.

Prompt/placement requirements:

- Image should contain no text.
- Left side must have clean/empty space.
- Left side should be darker or less busy.
- Main visual detail should sit mostly on the right side.
- Do not generate logos or brand marks inside the image.

Builder responsibility:

- Insert generated image into the intended hero image area only.
- Preserve existing text boxes and branding.

### Slide 18 image-only slide

Slide 18 is an image-only template.

Rules:

- One full-slide generated image.
- No text required.
- Image should fill the intended full-slide image area.
- Preserve any template background/brand frame if present.

### Other image slides

Only generate/insert images when:

- Selected template has an intended image area, or
- AI/template metadata marks `requires_image = true`.

Otherwise, do not generate images.

---

## Image Provider Logic

Primary provider:

```text
Replicate API
```

Credentials:

```text
.env
```

Fallback provider:

```text
ChatGPT image model
```

n8n should handle image generation before calling the PPTX Builder.

The builder should receive ready-to-use image files/URLs.

---

## Content Validation Before Builder

n8n should validate content before sending to builder.

Validation checks:

- Heading length <= template max heading characters
- Body length <= template max body characters
- Bullet/paragraph count <= max count
- Required image exists for image-required template
- Template ID exists in JSON
- Final slide count is acceptable

If validation fails:

- Send slide back to AI rewrite node
- Do not call builder yet

---

## Builder Validation

The builder should still check:

- Template file exists/downloaded
- Slide imported successfully
- Required text placeholders found
- Required image placeholders found
- Images loaded successfully
- Final slide count equals expected count

Return warnings for:

- Missing optional placeholders
- Text overflow risk
- Image aspect ratio mismatch

Return errors for:

- Missing template
- Missing required placeholder
- Missing required image
- PPTX save failure

---

## File Storage

Temporary files:

```text
/tmp/pdf_to_ppt/{run_id}/
```

Expected temporary structure:

```text
/tmp/pdf_to_ppt/{run_id}/
├── templates/
├── images/
├── build_payload.json
├── output.pptx
└── builder_log.json
```

Final PPTX should be uploaded by n8n to:

```text
PDF to PPT / 10 Final PPT Outputs
```

Logs should be saved to:

```text
PDF to PPT / 12 Logs and Debug
```

---

## Recommended Builder Phases

### Phase 1 — Text-only PPTX builder

Goal:

- Combine selected PPTX templates
- Replace text only
- Preserve formatting
- Output editable PPTX

### Phase 2 — Image replacement

Goal:

- Insert generated image into Slide 1
- Insert images into selected image templates
- Support Slide 18 full-image template

### Phase 3 — Robust validation

Goal:

- Detect missing placeholders
- Detect text overflow risk
- Return structured errors/warnings

### Phase 4 — n8n integration

Goal:

- n8n sends build payload
- Builder returns PPTX path/result
- n8n uploads final PPTX to Drive

---

## MVP Recommendation

Build in this order:

```text
1. Create placeholder map for all 18 templates
2. Build text-only PPTX builder
3. Test with manually prepared slide content JSON
4. Add image insertion support
5. Connect builder to n8n
6. Connect n8n to Next.js UI
```

Do not start with the full UI first. The PPTX builder must be reliable before the UI is useful.

---

## Open Decisions

1. Exact placeholder mapping method:
   - shape names
   - shape index
   - coordinate-based mapping

2. Builder runtime:
   - local script called by n8n
   - internal HTTP API
   - Dockerized service

3. Image fit behavior:
   - cover
   - contain
   - crop center/right

4. Text overflow handling:
   - error only
   - AI rewrite retry
   - optional manual review

Recommended defaults:

- Placeholder map by shape index + coordinates first.
- Builder as local Python script for MVP.
- Text overflow should trigger AI rewrite, not font shrinking.
