# PDF to Editable PPT Workflow

## Goal

Convert a supplied PDF into an editable 10-slide presentation.

Preferred outputs:

1. `.pptx` editable PowerPoint file
2. Google Slides editable deck / share link

## Important Requirement

The workflow must create both:

- **PPT structure**: slide sequence, layout, visual hierarchy, section flow
- **Copy structure**: headline, subheadline, body copy, bullets, captions, CTA, speaker/narrative logic where needed

The deck should not be a screenshot-based PDF copy. Text and layout should be editable as much as practically possible.

## Draft Process

1. Receive PDF.
2. Extract text, images, tables, charts, and document structure.
3. Analyze and summarize the core ideas.
4. Build a 10-slide outline.
5. Build slide-by-slide copy structure.
6. Design slide layouts.
7. Generate editable PPTX first.
8. QA slide count, formatting, readability, and editability.
9. Optionally upload/convert PPTX to Google Slides.
10. Deliver PPTX file and/or Google Slides link.

## Practical Direction

Start with PPTX generation because it is easier to automate reliably and validate locally. Google Slides can be added as a second phase by uploading/converting the PPTX to Drive or building directly with Google Slides API later.
