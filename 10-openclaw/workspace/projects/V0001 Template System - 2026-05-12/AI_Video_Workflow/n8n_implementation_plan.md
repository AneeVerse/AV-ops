# n8n Implementation Plan — AI Video Workflow

## Goal
Build an n8n workflow for the AI Video Workflow that takes rows from Google Sheet/Excel, generates a 20s vertical video, uploads outputs to Google Drive, and writes status/link back to the sheet.

## Drive storage target
Google Drive folder:
https://drive.google.com/drive/folders/1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP

Folder ID:
`1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP`

## Current local workflow reference
Consolidated folder:
`projects/V0001 Template System - 2026-05-12/AI_Video_Workflow/`

Live runnable workflow:
`projects/V0001 Template System - 2026-05-12/master/`

Main render script:
`master/scripts/render_with_rotating_voice.py`

## Required input columns
Each row must include:

- `Hook_Text`
- `Insight_Text`
- `Implication_Text`
- `CTA_Text`
- `CTA Sub Text`

## n8n workflow design

### Phase 1 — MVP workflow
Purpose: make one reliable automated run before scaling.

1. **Trigger**
   - Manual trigger first.
   - Later: Cron trigger or Google Sheet trigger.

2. **Read pending row**
   - Google Sheets node reads rows.
   - Filter row where status is blank / `Pending`.

3. **Prepare payload**
   - Map columns into a JSON object:
     - section1 = `Hook_Text`
     - section2 = `Insight_Text`
     - section3 = `Implication_Text`
     - section4_main = `CTA_Text`
     - section4_sub = `CTA Sub Text`

4. **Render request**
   - Preferred: n8n calls an internal render service/webhook on the server.
   - Render service runs the existing Python workflow:
     - updates section configs from row text
     - generates WAN clips for Section 1 and Section 3
     - renders four sections
     - combines 20s video
     - generates rotating voiceover
     - mixes rotating music

5. **Upload video to Drive**
   - Upload final MP4 into folder ID:
     `1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP`

6. **Update sheet**
   - Write back:
     - `Status = Done`
     - `Video_Link = <Drive link>`
     - `Rendered_At = timestamp`
     - `Voice_Name`
     - `Music_Name`
     - `Error` blank

7. **Error handling**
   - On failure, update row:
     - `Status = Failed`
     - `Error = short failure reason`
   - Keep generated intermediate files for debugging.

## Recommended architecture

### Option A — Best: n8n orchestrates, server renders
n8n should not directly run heavy ffmpeg/video generation if avoidable.

Recommended flow:

`Google Sheet → n8n → Render API/Webhook on server → Drive Upload → Sheet Update`

Why:
- n8n stays stable and lightweight.
- Python/ffmpeg/Replicate logic stays in existing tested scripts.
- Easier debugging.
- Easier to scale later.

### Option B — n8n Execute Command node
n8n directly runs the Python script using Execute Command.

Only use if CB_n8n runs on the same VPS and has access to:
- workspace files
- ffmpeg
- Python dependencies
- `.env` with Replicate credentials
- Google auth/upload credentials

Risk:
- harder to secure
- harder to debug from n8n UI
- workflow can timeout for long video generation

## n8n nodes needed

MVP nodes:

1. Manual Trigger
2. Google Sheets — Read rows
3. IF — find pending row
4. Set / Code — prepare render payload
5. HTTP Request — call render endpoint
6. Google Drive — upload final video OR receive uploaded link from renderer
7. Google Sheets — update row
8. Error Trigger / Error branch

## Render API payload

Example request body:

```json
{
  "row_id": "2",
  "hook_text": "Your hook text here",
  "insight_text": "Your insight text here",
  "implication_text": "Your implication text here",
  "cta_text": "Book a demo",
  "cta_sub_text": "Start today",
  "drive_folder_id": "1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP"
}
```

Expected response:

```json
{
  "status": "done",
  "video_path": "/path/to/final.mp4",
  "drive_file_id": "...",
  "drive_link": "https://drive.google.com/file/d/.../view",
  "voice_name": "Juniper",
  "music_name": "Corporate.wav"
}
```

## Implementation steps

### Step 1 — Store credentials
Completed locally:
- `CB_N8N_API_KEY` stored in `.env`

Still needed:
- CB_n8n base URL, unless already known elsewhere.

### Step 2 — Package workflow assets in Drive
Upload this consolidated folder/reference docs into the target Drive folder.

### Step 3 — Create n8n workflow draft
Use CB_n8n API to create a workflow with:
- Manual Trigger
- Google Sheets row read
- payload preparation
- render webhook/HTTP call placeholder
- Drive output handling
- sheet update placeholder

### Step 4 — Build render endpoint
Create a small server-side render endpoint that:
- accepts row payload
- writes row text into configs
- runs Python render workflow
- uploads MP4 to requested Drive folder
- returns Drive link

### Step 5 — End-to-end test
Run one row only.
Validate:
- video generated
- Drive upload works
- sheet row status updated
- errors are visible in n8n execution logs

### Step 6 — Productionize
Add:
- concurrency limit = 1 video at a time
- retry for Replicate 429/API failures
- row lock: `Status = Rendering`
- output manifest JSON per video
- logs folder in Drive
- optional notifications on success/failure

## Open questions / blockers

1. What is the CB_n8n base URL?
2. Which Google Sheet should n8n read from?
3. Should the first workflow be Manual Trigger only, or scheduled?
4. Should n8n upload the final MP4 itself, or should the render service upload and return the link?

## Recommendation
Start with **Option A**: n8n orchestrates and a server-side render endpoint does the heavy rendering. This is cleaner, safer, and more reliable than running ffmpeg-heavy work directly inside n8n.
