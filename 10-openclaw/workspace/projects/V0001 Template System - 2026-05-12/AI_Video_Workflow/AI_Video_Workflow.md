# Google Sheet / Excel Workflow Notes

## Required Sheet Columns

Automation should read these fields from each row:

- `Hook_Text`
- `Insight_Text`
- `Implication_Text`
- `CTA_Text`
- `CTA Sub Text`

## Section Text Mapping

- Section 1 text = `Hook_Text`
- Section 2 text = `Insight_Text`
- Section 3 text = `Implication_Text`
- Section 4 main CTA text = `CTA_Text`
- Section 4 CTA sub text = `CTA Sub Text`

All four section text layers must update from the sheet row before rendering.

## Contextual WAN Video Generation

Generate contextual WAN clips only for:

- Section 1, based on `Hook_Text`
- Section 3, based on `Implication_Text`

Section 2 and Section 4 remain template-based, but their text content changes from the sheet.

## Voiceover

Voiceover is generated fresh for each video using the saved 10 voice-name rotation.

Voice rotation rule:

- Video 1 -> voice 1
- Video 2 -> voice 2
- ...
- Video 10 -> voice 10
- Video 11 -> voice 1 again

## Music

Background music uses the 7-file rotating music system.

Music rotation rule:

- Video 1 -> music 1
- Video 2 -> music 2
- ...
- Video 7 -> music 7
- Video 8 -> music 1 again
- Video 9 -> music 2 again

## End-to-End Row Flow

1. Read pending row from Google Sheet / Excel.
2. Extract the five required text fields.
3. Update Section 1/2/3/4 text configs from the row.
4. Generate Section 1 WAN clip from `Hook_Text`.
5. Generate Section 3 WAN clip from `Implication_Text`.
6. Render all 4 sections.
7. Combine the 4 sections into the full video.
8. Generate fresh voiceover from the row/script using the next saved voice name.
9. Mix rotating background music.
10. Upload final video to Google Drive.
11. Write final video link/status back to the sheet.
