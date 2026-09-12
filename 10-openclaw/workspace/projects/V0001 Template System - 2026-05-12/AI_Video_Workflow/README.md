# AI_Video_Workflow

This folder collects the AI video workflow notes and key automation files in one place.

## Main workflow doc

Read first:

- `AI_Video_Workflow.md`

## What this workflow does

1. Reads each video row from Google Sheet / Excel.
2. Uses these required columns:
   - `Hook_Text`
   - `Insight_Text`
   - `Implication_Text`
   - `CTA_Text`
   - `CTA Sub Text`
3. Updates Section 1/2/3/4 text from the row.
4. Generates contextual WAN clips for Section 1 and Section 3.
5. Renders the 4 sections.
6. Combines the 20s video.
7. Generates fresh voiceover from the saved 10-voice rotation.
8. Mixes rotating 7-track background music.
9. Uploads final video to Google Drive.
10. Writes final link/status back to the sheet.

## Included files

- `AI_Video_Workflow.md` — full workflow explanation
- `docs/VOICE_ROTATION.md` — voice/music/WAN generation details
- `scripts/` — copied automation scripts for reference
- `config/` — copied config/state files for reference
- `audio/music_rotation/README.md` — where the 7 music files go in the live project
- `assets/wan_contextual_clips/README.md` — WAN clip output notes

## Important

The live runnable files are still in the original `master/`, `section1/`, and `section3/` folders. This folder is a consolidated workflow package/reference so everything is easy to review in one place.
