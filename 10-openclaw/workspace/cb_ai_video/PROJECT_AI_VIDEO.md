# CB AI Video Project Knowledge

This agent is dedicated to Ahmad Anees / Content Beta AI video generation work, especially the TraitDNA / AI-Video_Gen workflow.

## Identity / Role

- Agent name/id: `cb_ai_video`
- Primary responsibility: generate, verify, QC, upload, and document AI video batches for Ahmad.
- Communication style: practical, direct, concise. Do not guess. Report exact paths, statuses, failures, and Drive links.
- User: Ahmad Anees. He prefers short, factual updates and Drive links only after outputs are verified unless he explicitly asks for partial links.

## Approved Current Master Template

Use this template by default:

```bash
/root/.openclaw/workspace/AI-Video_Gen/master-template
```

Main repeatable render script:

```bash
/root/.openclaw/workspace/AI-Video_Gen/master-template/scripts/render_batch_v0006_v0015.py
```

Default command pattern:

```bash
cd /root/.openclaw/workspace/AI-Video_Gen/master-template
TARGET_IDS='V0031,V0032' python3 scripts/render_batch_v0006_v0015.py
```

The script accepts comma-separated IDs via `TARGET_IDS`.

Important: as of 2026-07-05, the script's sheet range was expanded from `A1:BZ20` to:

```python
SHEET_RANGE = '300_Video_Master_Attribution!A1:BZ200'
```

This was necessary so V0020+ rows are fetched correctly.

## Deprecated / Do Not Use

Do not use these unless Ahmad explicitly approves:

```bash
/root/.openclaw/workspace/AI-Video/template-1
/root/.openclaw/workspace/projects/AI video automation template-02
```

Do not use Truckstop outputs for this project.

Deprecated reuse script:

```bash
/root/.openclaw/workspace/AI-Video_Gen/master-template/scripts/remake_v0016_with_v0011_old_template.py
```

This script intentionally errors because it reuses V0011 clips. New renders must generate fresh Section 1 and Section 3 clips.

## Source of Truth Sheet

Google Sheet:

```text
1MMslDeXLGBKG6tjPao1_pRIGzaRTOlubwn5UJssB8xE
```

Tab:

```text
300_Video_Master_Attribution
```

This sheet contains `Video_ID` rows such as V0018, V0019, etc. The render script fetches rows from this sheet.

## Output / Project Locations

Base project:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12
```

Master output folders:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/master/output/
```

Batch output pattern:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/master/output/Final_Batch_V0006_V0015_<RUN_ID>/V00XX.mp4
```

Generated WAN/Kling clips:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/master/assets/wan_contextual_clips/
```

Section configs:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section1/config/
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section2/config/
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section3/config/
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section4/config/
```

Section outputs:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section1/output/
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section2/output/
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section3/output/
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section4/output/
```

Drive upload folder used by the script:

```text
1ICdGOWUiR3905Vuef-pqbXJ0fvg8paND
```

## Approved Visual Style

The approved style is based on V0011 old code-screen side-profile developer/workstation visuals.

Critical rule: V0011 clips are reference/style only. Do not reuse the actual V0011 clips as final sources.

Section 1 and Section 3 must generate fresh clips every run showing:

- software developer at workstation
- back-side, side-angle, side-rear, 3/4 rear, or over-the-shoulder view
- laptop and/or external monitor setup
- IDE / terminal / code-editor ambience
- no readable code, no readable UI, no logos, no brand marks
- realistic professional B-roll, vertical 9:16

The prompt in `wan_config()` inside the main script includes wording like:

```text
Create a NEW unique realistic 5-second vertical 9:16 professional B-roll video. Do not reuse any prior clip.
Back-side, side-angle, or over-the-shoulder view; preferably 3/4 rear or side-rear.
Screens face the subject, not the camera.
```

## Section Logic

The final videos are 20 seconds vertical.

General section structure:

- Section 1: hook / developer workstation B-roll + headline text
- Section 2: insight / text section, sometimes routed to `section2_5`
- Section 3: implication / developer workstation B-roll + text overlay
- Section 4: CTA graphic section

Approved Section 4 behavior:

- Uses fixed background:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/section4/assets/section4_bg_1nNdVHN1ceDKpFAFX-r9Dkp0kpwigq-I8.mp4
```

- shown once, no loop/repeat
- no added CTA/subtext overlay from renderer
- fixed CTA VO:

```text
Free Trait D-N-A report - tap the profile link.
```

- CTA Sub Text / last Google Sheet column is excluded from VO.

## Voice / Audio

The workflow uses rotating ElevenLabs voices via Replicate.

Common voice examples seen in outputs:

- Sarah
- Alexandra
- Rachel
- Drew
- Mark
- Juniper

The render script auto-fits VO duration with `atempo` when needed. This is expected.

Final mux includes background music:

```bash
/root/.openclaw/workspace/projects/AE_reference_import_2026-05-12/extracted/V0001 folder/(Footage)/music/Corporate.wav
```

## Verification Required Before Reporting Done

Before saying a video is done, verify at minimum:

```bash
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json '<video.mp4>'
```

Expected final specs:

- duration: `20.000000`
- video codec: H.264 / h264
- resolution: 1080x1920
- frame rate: 30fps / `30/1`
- audio codec: AAC
- audio sample rate: 48000 Hz
- audio channels: 2

The script usually runs ffprobe and emits this in the final JSON summary.

## QC Required

QC Section 1 and Section 3 frames for each generated video.

QC frames are generated in:

```bash
/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/master/output/Final_Batch_V0006_V0015_<RUN_ID>/qc/
```

Use image analysis or visual inspection. Check:

- developer/person at workstation
- side/rear/over-shoulder angle
- laptop/monitor/code/IDE/terminal ambience
- no obvious readable code/logos

Note: Section 3 often includes large designed caption overlay from the template. This is expected and not a failure unless Ahmad asks for no overlay. The no-readable-code rule applies to generated B-roll screen content/logos, not the template's intended caption text.

Section 4 is CTA graphic, so it is expected to fail developer-workstation criteria. Do not mark the whole video failed for that.

## Upload / Drive Links

The script uploads videos with `gog drive upload` and shares publicly with reader permissions.

If links need to be recovered later, use:

```bash
gog drive search "name = 'V0021.mp4' or name = 'V0022.mp4'" --json --no-input --results-only
```

## Known Failure Modes

### Replicate 504 Gateway Timeout

Example failure:

```text
requests.exceptions.HTTPError: 504 Server Error: Gateway Timeout for url: https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions
```

This can happen while submitting a Section 1 or Section 3 Kling/WAN job.

Recovery:

1. Identify the last successfully uploaded/rendered video.
2. Restart only the remaining IDs, not the entire original batch.
3. Example:

```bash
cd /root/.openclaw/workspace/AI-Video_Gen/master-template
TARGET_IDS='V0025,V0026,V0027,V0028,V0029,V0030' python3 scripts/render_batch_v0006_v0015.py
```

### Missing rows / ordered rows wrong

If script errors like:

```text
RuntimeError: Missing/ordered rows wrong: ['V0019']
```

Then the sheet range may be too short. It was fixed in the master template to `A1:BZ200`.

## Recent Completed Outputs

### V0017 corrected

Final corrected V0017:

```text
https://drive.google.com/file/d/1MjJDOn9TspEohfPVnay-ZiuP9qYfTrA-/view?usp=drivesdk
```

### V0018

```text
https://drive.google.com/file/d/1_BMvxwt8VA__lVFNoCnJJuiPc4uiFM5W/view?usp=drivesdk
```

### V0019–V0020

```text
V0019: https://drive.google.com/file/d/1ZA6C_6BkB-R4BDda5_dtStO0heYBKVGJ/view?usp=drivesdk
V0020: https://drive.google.com/file/d/15ublNkafKlJcCNhx67TxcPtGdhprPdvq/view?usp=drivesdk
```

### V0021–V0030

```text
V0021: https://drive.google.com/file/d/1DtfjkZ1RGeI6BLg8eh9Z4D-4QBE0O1XR/view?usp=drivesdk
V0022: https://drive.google.com/file/d/1iwjHwJ37RdDvmVi0XqxOguY5a1lqO6Be/view?usp=drivesdk
V0023: https://drive.google.com/file/d/1Md_Dm_s9zqTg2JMXRKfNLmQbIki_AKTy/view?usp=drivesdk
V0024: https://drive.google.com/file/d/1sQlBzaSal3Q4GyKAHypRt_eIPdya_NVq/view?usp=drivesdk
V0025: https://drive.google.com/file/d/1hYRzpa-1_odSRjiHvG5oWZQpWX-nHgBc/view?usp=drivesdk
V0026: https://drive.google.com/file/d/13_HXzKssT0A8yGXy8mYsla5vQ9CiLClf/view?usp=drivesdk
V0027: https://drive.google.com/file/d/1tEHdEPyx1Vj739YxAQE-bKfbde56BmXp/view?usp=drivesdk
V0028: https://drive.google.com/file/d/1eHe9Vzpw8APx_48LZzKNpa7EhCM86xJh/view?usp=drivesdk
V0029: https://drive.google.com/file/d/1UHDMUXFMoH0ospnZig6jsDjmA3arion5/view?usp=drivesdk
V0030: https://drive.google.com/file/d/1rIsdcqDjeRPi0GW6PRv5QTrBQ6UZE3Tw/view?usp=drivesdk
```

## Practical Operating Procedure

When Ahmad says “make V0031” or “generate V0031-V0040”:

1. Confirm target IDs exist in source sheet if needed.
2. Run from master template using `TARGET_IDS`.
3. Let process run. For long waits, use `process poll` with reasonable timeout or schedule a cron reminder; do not spam polling.
4. If failure occurs, restart only remaining IDs.
5. Verify specs from ffprobe output.
6. QC Section 1 and Section 3 frames.
7. Share Drive links clearly.
8. If asked “done?”, give factual partial status.

## Important Human Preference

Ahmad prefers direct, operational answers:

- Do not over-explain.
- If a batch is partial, say exactly which videos are done and which are pending.
- If a link is available and he asks for it, send it even if later videos are still rendering.
- Do not claim full completion until all requested videos are complete and uploaded.
