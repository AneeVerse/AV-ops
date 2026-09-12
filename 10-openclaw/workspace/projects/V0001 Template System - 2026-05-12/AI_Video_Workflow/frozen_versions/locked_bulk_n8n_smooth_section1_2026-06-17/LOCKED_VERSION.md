# Locked Version — Bulk n8n AI Video Template

Freeze date: 2026-06-17 UTC

## Locked decision
This version is frozen as the current approved working template.

## What is included
- n8n workflow: `AI Video Bulk Render - Template to Drive`
- n8n workflow ID: `o4SfALgN5fFFTMES`
- Webhook path: `/webhook/ai-video-bulk-render`
- Local render bridge: `http://127.0.0.1:8013/ai-video-render-bulk`
- Section 1 animation fixed to smooth line-by-line fade/slide reveal
- Section 3 remains as approved smooth line reveal
- Full render remains 20s vertical MP4
- Google Drive upload/share handled by render bridge after n8n trigger

## Last approved test output
Drive link:
https://drive.google.com/file/d/1flz6lZe0lUXC3SjtrEkbomVKXQAJ1oG_/view?usp=drivesdk

Verified specs:
- 1080x1920
- 30 fps
- 20 sec
- generated through n8n workflow

## Current architecture
n8n controls orchestration. Heavy rendering is done by local backend bridge.

Flow:
`n8n webhook -> local render bridge -> Python/ffmpeg render -> Google Drive upload/share -> n8n response`

## Notes
Do not change Section 1 animation behavior unless explicitly requested. The previous cumulative subtitle reveal caused visible jumps and is intentionally replaced.

## WAN contextual video rule added by Ahmad
- Section 1 and Section 3 background clips should be generated through WAN based on row text.
- Section 1 uses `Hook_Text` / column T.
- Section 3 uses `Implication_Text` / column V.
- WAN outputs must be realistic/live-action, not animated.
- WAN outputs must have no text, captions, subtitles, logos, watermarks, or readable/gibberish text.
- Template text overlays are still allowed; the generated background video itself must be text-free.

## WAN-enabled n8n bridge update — 2026-06-17
Implemented and tested:
- n8n bridge now generates fresh WAN background clips for Section 1 and Section 3 before rendering.
- Section 1 WAN uses sheet `Hook_Text` / column T.
- Section 3 WAN uses sheet `Implication_Text` / column V.
- Prompts explicitly request realistic live-action style and ban animation/cartoon/motion graphics.
- Prompts and negative prompt explicitly ban text, captions, subtitles, letters, logos, and watermarks.

Test output through n8n:
https://drive.google.com/file/d/1WP91RnIjj35dCc7fery_KvuzgXyrfNnD/view?usp=drivesdk

## Section 1 top shadow update — 2026-06-17
Implemented after Ahmad feedback:
- Only Section 1 renderer changed.
- Added a soft black top gradient between the WAN/background video and top hook text.
- Purpose: match Section 3's readability shadow behavior, but inverted for top-positioned text.
- No other sections changed.

Test output through n8n:
https://drive.google.com/file/d/1ihJuDod_cDcozgOLPXnv0VUKO6t9mMME/view?usp=drivesdk

## Section 1 top shadow fixed — 2026-06-17
Ahmad approved the stronger Section 1 top black overlay.

Locked values:
- `top_shadow_height`: 840
- `top_shadow_alpha`: 210

Scope:
- Section 1 only.
- No other sections changed.

Approved review output:
https://drive.google.com/file/d/1UmykYKcE65K1vIoqk7G8RVfC4yNRvjK9/view?usp=drivesdk
