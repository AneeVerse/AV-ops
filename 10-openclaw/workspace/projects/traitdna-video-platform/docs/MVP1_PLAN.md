# TraitDNA Video Platform — MVP1 Plan

## Purpose
Build a small production dashboard for TraitDNA BatchFlow so Ahmad can track which videos are done, which video is next, review generated videos, and regenerate bad videos without losing version history or wasting AI credits.

## Source of Truth
- Planning/content source: Google Sheet `1MMslDeXLGBKG6tjPao1_pRIGzaRTOlubwn5UJssB8xE`
- Tab: `300_Video_Master_Attribution`
- Final storage root: Google Drive folder `Gen` (`1ICdGOWUiR3905Vuef-pqbXJ0fvg8paND`)

## MVP1 Scope
MVP1 is intentionally small. It does **not** include full automatic rendering yet.

MVP1 includes:
1. Sync rows from Google Sheet into a local tracking DB.
2. Track whether each video is not started, ready, queued, in progress, needs review, approved, rejected, failed, or regenerating.
3. Show next video to work on.
4. Track generated video versions.
5. Provide approve/reject/regenerate actions at logic level.
6. Provide a minimal local web UI for dashboard, queue, and video detail.
7. Provide a dry-run job system for generation/regeneration so the workflow can be tested safely before connecting expensive AI APIs.

MVP1 excludes:
- Real AI rendering trigger from UI.
- Real Supabase deployment.
- Multi-user auth.
- Advanced cost accounting.
- Concurrent workers.

## Why MVP1 uses local SQLite first
SQLite is enough to validate the production logic before adding Supabase. It avoids delaying the first working version with infrastructure decisions. Once the workflow is approved, the schema can migrate to Supabase/Postgres.

## Video Lifecycle
Main status values:
- `Not Started`
- `Ready`
- `Queued`
- `In Progress`
- `Needs Review`
- `Approved`
- `Rejected`
- `Regeneration Queued`
- `Regenerating`
- `Failed`

Recommended flow:
`Ready → Queued → In Progress → Needs Review → Approved`

Bad video flow:
`Needs Review → Rejected → Regeneration Queued → Regenerating → Needs Review → Approved`

Failed flow:
`In Progress → Failed → Queued/Retry → In Progress`

## Next Video Logic
The dashboard must show:
- Next video to review: oldest `Needs Review` video.
- Next failed video: oldest `Failed` video.
- Next new video: first ordered `Video_ID` where status is `Ready` and no approved final version exists.

Recommended action priority:
1. Failed
2. Needs Review
3. Rejected / Regeneration Queued
4. Ready

## Version Logic
Every generated attempt is a version:
- `V0005_v1`
- `V0005_v2`
- etc.

Only one version can be `is_current_final = 1`.
Only approved videos are counted as done.
Rejected versions remain in history.

## Regeneration Modes
MVP1 must support job records for:
- `full_render`
- `regenerate_section_1`
- `regenerate_section_3`
- `reassemble_only`
- `audio_remix_only`

Credit-saving rule:
Do not regenerate expensive assets unless the selected regeneration mode requires it.

## MVP1 UI Pages
1. Dashboard
   - totals by status
   - next recommended action
   - next video to review
   - next new video
2. Queue
   - table of videos
   - filters by status
   - links to detail pages
3. Video Detail
   - sheet text
   - current version
   - version history
   - approve / reject / regenerate buttons
4. Jobs
   - job records and dry-run statuses

## MVP1 Safety Checks
- Do not call AI APIs in MVP1 dry-run mode.
- Do not overwrite Drive files from MVP1 unless explicitly connected later.
- Do not mark a video `Approved` unless the user clicks approve.
- Do not create duplicate active jobs for the same video.
- Do not treat `Generated` as done; only `Approved` is done.

## Definition of Done for MVP1
MVP1 is done when:
1. Sheet sync imports rows and maps column `AF` / `Production_Status` correctly.
2. Dashboard correctly shows status totals and next video.
3. Video detail page shows content and versions.
4. Dry-run generate creates a new version in `Needs Review`.
5. Approve marks the version current final and video `Approved`.
6. Reject marks the version rejected and video `Rejected`.
7. Regenerate creates a new dry-run job/version without deleting history.
8. Automated tests pass.
