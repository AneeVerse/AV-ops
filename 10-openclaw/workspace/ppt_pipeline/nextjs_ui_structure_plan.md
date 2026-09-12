# PDF to PPT Next.js UI Structure Plan

## Goal
Build a clean, professional web UI for uploading a PDF and generating an editable PPTX through the n8n V9 workflow.

Active backend webhook:

```txt
/webhook/PDF2PPTPRODq86GshHc/webhook/pdf-to-ppt-production-v9-images
```

## Product Experience

The UI should feel like a simple business automation tool, not a generic file uploader.

Primary user journey:

1. User lands on the PDF to PPT generator page.
2. User uploads a PDF.
3. User enters project/presentation name.
4. User selects slide count, default 10.
5. User clicks Generate PPT.
6. UI shows clear progress states while backend runs.
7. UI displays final PPTX link and supporting artifact links.
8. User can start a new generation.

## Visual Direction

### Style
- Minimal, premium, clean SaaS dashboard style.
- Dark/light neutral background with strong card-based layout.
- Primary accent: Aneeverse blue/purple gradient or deep blue.
- Avoid clutter. The core action should be obvious.

### Layout Feel
- Centered max-width page.
- Left side: upload/generation form.
- Right side: process preview/status card.
- On mobile: stack vertically.

### Tone
- Practical and operational.
- Avoid playful copy.
- Clear labels and status messages.

## Page Map

For MVP, use one main route:

```txt
/app/pdf-to-ppt/page.tsx
```

Optional later routes:

```txt
/app/pdf-to-ppt/history/page.tsx
/app/pdf-to-ppt/[runId]/page.tsx
```

## Main Page Wireframe

Desktop layout:

```txt
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
│ PDF to PPT Generator                         Aneeverse logo   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│ │ Upload PDF                  │ │ Generation Status        │ │
│ │                             │ │                          │ │
│ │ [Drag & drop PDF area]      │ │ 1 Upload PDF       ✅/…  │ │
│ │                             │ │ 2 Extract content  ⏳    │ │
│ │ Project name [__________]   │ │ 3 Plan slides      ⏳    │ │
│ │ Slide count  [-] 10 [+]     │ │ 4 Generate image   ⏳    │ │
│ │                             │ │ 5 Build PPTX       ⏳    │ │
│ │ [Generate PPTX]             │ │ 6 Upload files     ⏳    │ │
│ └─────────────────────────────┘ └──────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Result Card, appears after success                       │ │
│ │ Final PPTX: [Open PPTX] [Copy link]                      │ │
│ │ Advanced artifacts: Source PDF, Text, Payload, Logs      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Mobile layout:

```txt
Header
Upload card
Status card
Result card
```

## Component Structure

Recommended implementation approach:

Use existing component libraries instead of hand-coding primitives:

- Ant Design for Layout, Sider, Header, Menu, Card, Upload.Dragger, Form, Input, InputNumber, Button, Steps, Progress, Result, Descriptions, Collapse, Alert, Tags.
- Ant Design Icons for dashboard/action icons.
- Custom CSS only for brand/layout polish.

Implemented MVP structure:

```txt
app/
  page.tsx                  # Ant Design dashboard UI
  layout.tsx                # Ant reset CSS + app CSS
  styles.css                # Layout/brand polish only
  api/
    generate/route.ts       # Proxies PDF upload to n8n V9 webhook
    history/route.ts        # Legacy history route retained
    upload/route.ts         # Legacy upload route retained
```

Future refactor structure, if page grows:

```txt
components/pdf-to-ppt/
  DashboardShell.tsx
  UploadPanel.tsx
  PipelinePanel.tsx
  ResultPanel.tsx
  ArtifactLinks.tsx
lib/pdf-to-ppt/
  types.ts
  api.ts
```

Layout rule from Ahmad:

```txt
Sidebar first -> top navbar second -> page content
```

Do not build basic UI primitives from scratch unless no library component exists.

## Component Responsibilities

### `PdfToPptShell.tsx`
Top-level client component.

Responsibilities:
- Owns page state.
- Stores selected PDF, project name, slide count.
- Calls API helper.
- Manages statuses: idle, uploading, processing, success, error.
- Passes props to child components.

State shape:

```ts
type GenerationState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';
```

### `UploadCard.tsx`
Container for user inputs.

Contains:
- `PdfDropzone`
- `ProjectNameInput`
- `SlideCountSelector`
- `GenerateButton`

### `PdfDropzone.tsx`
PDF selection UI.

Behavior:
- Drag and drop PDF.
- Click to browse.
- Show selected file name, size, and remove button.
- Validate file type and max size before submission.

Validation:
- Accept only `.pdf`.
- Suggested max UI warning: 100MB.
- Do not block 50MB+ files.

Visual states:
- Empty
- Drag active
- File selected
- Invalid file
- Disabled while generating

### `ProjectNameInput.tsx`
Simple text input.

Behavior:
- Auto-fill from filename if empty.
- User can edit.
- Required before generation.

### `SlideCountSelector.tsx`
Numeric selector.

Rules:
- Default: 10
- Minimum: 3
- Maximum: 30 for initial UI
- Helper text: “Default 10. The AI may adapt if content needs it.”

### `GenerateButton.tsx`
Primary CTA.

States:
- Disabled if no PDF or no project name.
- Loading while request is running.
- Text changes:
  - idle: “Generate PPTX”
  - loading: “Generating…”

### `GenerationStatusCard.tsx`
Shows progress steps.

Important limitation:
- Current n8n webhook is synchronous, so the frontend does not get true backend progress events yet.
- MVP should show estimated staged progress while request is pending.
- Later version can use async jobs + polling/SSE.

Steps:

```txt
1. Uploading PDF
2. Extracting all pages
3. Planning slides with AI
4. Generating hero image
5. Building editable PPTX
6. Uploading files to Drive
```

Status logic MVP:
- Before request: all pending.
- On submit: Uploading active.
- After 2s: Extracting active.
- After 8s: Planning active.
- After 30s: Generating image active.
- After 60s: Building PPTX active.
- After 100s: Uploading files active.
- On success: all complete.
- On error: current step error.

### `StatusStep.tsx`
Single progress row.

Props:

```ts
{
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}
```

Icons:
- pending: grey dot
- active: spinner
- complete: check
- error: alert icon

### `ResultCard.tsx`
Success output.

Primary action:
- Open Final PPTX

Secondary actions:
- Copy PPTX link
- Start new generation

Display:
- Slide count
- PDF pages
- Text chars
- Image provider
- Validation result

### `ArtifactLinks.tsx`
Advanced links, collapsed by default.

Links:
- Source PDF
- Extracted text
- Build payload JSON
- Generated image manifest
- Generated image(s)
- Validation report
- Run summary

### `ErrorCard.tsx`
Clear error display.

Should show:
- Human-readable error title.
- Backend error message if available.
- Retry button.
- “Check logs” only if log link exists.

### `AdvancedDetails.tsx`
Collapsible technical details.

Useful for debugging but should not distract normal users.

## Data Contract

The n8n V9 response currently returns:

```ts
export type PdfToPptResponse = {
  success: boolean;
  run_id: string;
  original_file_name: string;
  provider: string;
  image_provider: string | null;
  pdf_pages: number;
  text_chars: number;
  chunks: number;
  slide_count: number;
  validation_valid: boolean;
  validation_issues: number;
  final_ppt_drive_id: string;
  final_ppt_link: string;
  final_ppt_file: string;
  source_pdf_link?: string;
  extracted_text_link?: string;
  build_payload_link?: string;
  generated_images_manifest_link?: string;
  generated_image_links?: string[];
  validation_report_link?: string;
  run_summary_link?: string;
  artifacts?: Record<string, unknown>;
};
```

## API Helper

`lib/pdf-to-ppt/api.ts`

Function:

```ts
export async function generatePptx(input: {
  file: File;
  projectName: string;
  slideCount: number;
}): Promise<PdfToPptResponse>
```

Implementation:
- Build `FormData`.
- Append:
  - `pdf_file`
  - `project_name`
  - `target_slide_count`
- POST to backend URL.
- Timeout should be high: 20–25 minutes for large PDFs.
- Parse JSON.
- Throw clear error if response is not OK or `success !== true`.

## Environment Config

Use env var:

```txt
NEXT_PUBLIC_PDF_TO_PPT_WEBHOOK_URL=https://n8n.aneeverse.com/webhook/PDF2PPTPRODq86GshHc/webhook/pdf-to-ppt-production-v9-images
```

Avoid hardcoding production URL inside components.

## UX Copy

### Header
Title:

```txt
PDF to PPT Generator
```

Subtitle:

```txt
Upload a PDF and generate an editable, branded PowerPoint deck.
```

### Upload Card
Title:

```txt
Create a presentation
```

Helper:

```txt
Upload your source PDF. We’ll extract all pages, plan the deck, generate the hero image, and return an editable PPTX.
```

### Status Card
Title:

```txt
Generation pipeline
```

Helper:

```txt
Large PDFs can take a few minutes. Keep this tab open.
```

### Result Card
Title:

```txt
Your PPTX is ready
```

CTA:

```txt
Open PPTX
```

## UI States

### Idle
- Upload card visible.
- Status card shows all pending.
- No result card.

### File Selected
- File metadata visible.
- Generate button enabled if project name exists.

### Processing
- Inputs disabled.
- Generate button loading.
- Status card animates estimated progress.
- Warning: “Do not close this tab.”

### Success
- Result card appears.
- Status complete.
- Inputs reset option available.

### Error
- Error card appears.
- Inputs remain available for retry.
- Status marks failed step.

## Validation Rules

Before submit:

```txt
PDF required
Project name required
Slide count must be 3–30
File extension or MIME type must be PDF
```

Warnings:

```txt
Large files may take longer.
Scanned PDFs may produce weaker text extraction unless OCR is added later.
```

## Backend Flow Mapped to UI

| UI Step | Backend Action |
|---|---|
| Uploading PDF | Browser posts PDF to n8n webhook |
| Extracting all pages | Python extracts text from PDF |
| Planning slides with AI | OpenRouter creates document plan + build payload |
| Generating hero image | Replicate creates slide 1 image |
| Building editable PPTX | Python PPTX builder replaces placeholders |
| Uploading files to Drive | n8n uploads source, PPTX, logs, images |

## Recommended MVP Implementation Order

1. Create route and layout shell.
2. Build upload card and form state.
3. Build API helper.
4. Build status card with estimated progress.
5. Build result card.
6. Add error handling.
7. Test with sample PDF.
8. Polish responsive layout.

## Later Improvements

### True Progress Tracking
Current webhook is synchronous. For real progress:
- n8n should create a job ID immediately.
- Backend writes progress state to file/database/Supabase.
- Frontend polls `/api/pdf-to-ppt/status/:runId` or uses SSE.

### History Page
Store previous generated decks:
- run ID
- project name
- date
- final PPTX link
- status

### Auth
If exposed publicly, add auth before launch.

### Cost Controls
Add limits:
- max PDF size
- max pages
- per-user daily generation cap
- confirmation for very large PDFs

## MVP Definition of Done

The UI is ready when:

- User can upload Truckstop sample PDF.
- UI calls V9 webhook successfully.
- Final PPTX link appears.
- Generated image link appears in advanced details.
- Errors are readable.
- Mobile layout is usable.
- No API keys/secrets are exposed.
