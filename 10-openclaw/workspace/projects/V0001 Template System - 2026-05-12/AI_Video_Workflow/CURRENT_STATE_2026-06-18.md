# AI Video Project — Current State

## Project folders

- Main project: `projects/V0001 Template System - 2026-05-12/`
- Consolidated workflow docs: `projects/V0001 Template System - 2026-05-12/AI_Video_Workflow/`
- Live runnable project: `projects/V0001 Template System - 2026-05-12/master/`
- Render bridge: `scripts/ai_video_n8n_bridge.py`
- n8n workflow creator: `scripts/create_n8n_ai_video_bulk_workflow.py`
- Source spreadsheet copy: `tmp/ai_video_source_excel.xlsx`

## n8n / service setup

- n8n service is active locally on `127.0.0.1:5678`.
- AI video render bridge is active on `127.0.0.1:8013`.
- Health check: `GET http://127.0.0.1:8013/health` returns `{ "ok": true, "service": "ai-video-n8n-bridge" }`.
- n8n workflow name: `AI Video Bulk Render - Template to Drive`.
- n8n webhook path: `/webhook/ai-video-bulk-render`.
- n8n calls local renderer: `POST http://127.0.0.1:8013/ai-video-render-bulk`.
- Local workflow JSON: `AI_Video_Workflow/n8n_ai_video_bulk_render_active.json`.

## Current workflow behavior

For each row:

1. Read row fields from spreadsheet / payload.
2. Map text fields into section configs:
   - Section 1: `Hook_Text`
   - Section 2: `Insight_Text`
   - Section 3: `Implication_Text`
   - Section 4 main: `CTA_Text`
   - Section 4 sub: `CTA Sub Text` / `CTA Sub Text `
3. Generate contextual WAN/Kling clips for Section 1 and Section 3.
4. Render all sections and full silent 20s video.
5. Generate fresh voice-over using the next voice in rotation.
6. Mix voice-over + background music.
7. Upload final voiced + music MP4 to Google Drive.
8. Return Drive link and verification metadata.

## Output requirements verified

Final uploaded video must be:

- 1080×1920
- 30 fps
- 20 seconds
- H.264 video
- AAC audio included

## Drive folder

Default output Drive folder:

- `1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP`
- Link: `https://drive.google.com/drive/folders/1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP`

## Voice rotation

Voice config: `master/config/voice_rotation_config.json`
Voice state: `master/config/voice_rotation_state.json`

Voice order:

1. Juniper
2. Hope
3. Sarah
4. Alexandra
5. Rachel
6. Drew
7. Paul
8. Roger
9. James
10. Mark

Current state after rows 1–2:

- `last_used_voice_number`: 5
- `last_used_voice_name`: Rachel
- `next_voice_number`: 6
- Next voice: Drew
- `total_videos_created_with_rotation`: 5

## Music

- Current music: `Corporate.wav`
- Path: `../../AE_reference_import_2026-05-12/extracted/V0001 folder/(Footage)/music/Corporate.wav`
- Music volume: `0.32`
- Voice delay: `250ms`
- Voice loudnorm target: `-16 LUFS`

## Generated rows

### Row 1 / V0001

- Voice: Alexandra
- Final voiced video: `master/output/rotating_voice_renders/traitdna_rotating_voice_04_alexandra_V0001_20260618_150300_001.mp4`
- Silent render: `master/output/traitdna_n8n_bulk_V0001_20260618_150300_001.mp4`
- Generated VO: `master/audio/rotating_voice_generated/voice_04_alexandra_V0001_20260618_150300_001_fitted.mp3`
- Drive file ID: `1q8Da6dJzc5QGLiW64lnZCJ3-QjZ4673T`
- Drive link: `https://drive.google.com/file/d/1q8Da6dJzc5QGLiW64lnZCJ3-QjZ4673T/view?usp=drivesdk`
- Verified: 1080×1920, 30 fps, 20 seconds, AAC audio.

### Row 2 / V0002

- Voice: Rachel
- Final voiced video: `master/output/rotating_voice_renders/traitdna_rotating_voice_05_rachel_V0002_20260618_150851_002.mp4`
- Silent render: `master/output/traitdna_n8n_bulk_V0002_20260618_150851_002.mp4`
- Generated VO: `master/audio/rotating_voice_generated/voice_05_rachel_V0002_20260618_150851_002_fitted.mp3`
- Drive file ID: `1uoztRy2PqU6bKdyRkuJLvZ0oq-NQueGt`
- Drive link: `https://drive.google.com/file/d/1uoztRy2PqU6bKdyRkuJLvZ0oq-NQueGt/view?usp=drivesdk`
- Verified: 1080×1920, 30 fps, 20 seconds, AAC audio.

Rows 1–2 response file:

- `AI_Video_Workflow/rows_1_2_with_vo_response.json`

Rows 1–2 timing file:

- `AI_Video_Workflow/rows_1_2_with_vo_timing.json`
- Runtime: 700 seconds (~11m 40s)

## Next rows from source sheet

### Row 3 / V0003

- Next voice should be: Drew
- Hook: `The Software Developers getting hired aren't better qualified. They're better positioned.`
- Insight: `Titles you ignore are often the ones recruiting your exact background — and paying more than the roles you're applying to.`
- Implication: `Widening your search is faster than stacking another credential.`
- CTA: `Start with your TraitDNA™ Work-Style Report — free, 15 minutes.`
- CTA sub text column exists as `CTA Sub Text ` with a trailing space; value may need normalization.
- Audience: Active Job Seeker
- Occupation: Software Developer

### Row 4 / V0004

- Voice after row 3 should be: Paul
- Hook: `Going deeper as a Software Developer isn't always the fastest path. Wider may pay more.`
- Insight: `Adjacent roles recruit from your background at a premium.`
- Implication: `A lateral-then-up move can pay more than waiting for promotion.`
- CTA: `Get your TraitDNA™ Work-Style Report free — see the roles your work style actually fits.`
- Audience: Employed / Open to Opportunities
- Occupation: Software Developer

## Important caveat

The spreadsheet header is `CTA Sub Text ` with a trailing space, while the renderer also checks `CTA Sub Text`. The previous payload normalized it to `CTA Sub Text`, so continuing should preserve that normalization to avoid missing the CTA sub text.
