# TraitDNA Video Platform MVP1

Local MVP1 production dashboard for tracking TraitDNA BatchFlow video status, versions, review, approval, and regeneration intent.

## What MVP1 does

- Syncs real rows from Google Sheet `300_Video_Master_Attribution`.
- Reads `Production_Status` from column `AF`.
- Current live sync uses `gog` with Google account `anees@aneeverse.com` through the systemd env file `.service.env`.
- Tracks which videos are Ready, Needs Review, Approved, Rejected, Failed, etc.
- Shows next video to work on.
- Creates dry-run generated versions without spending AI credits.
- Approves/rejects versions.
- Queues regeneration modes while preserving old version history.
- Provides a minimal local web UI.

## What MVP1 does not do yet

- It does not trigger real AI video generation from the website.
- It does not upload final videos from UI yet.
- It does not use Supabase yet.
- It does not have auth yet.

## Commands

From this folder:

```bash
python3 -m app.cli init-db
python3 -m app.cli sync-sheet --range '300_Video_Master_Attribution!A1:AF8'
python3 -m app.cli dashboard
python3 -m app.web
```

Open locally:

```text
http://127.0.0.1:8787
```

Current public MVP1 link on this server:

```text
http://148.230.67.132:8787
```

The live service is managed by systemd:

```bash
systemctl status traitdna-video-platform.service
systemctl restart traitdna-video-platform.service
journalctl -u traitdna-video-platform.service -n 100 --no-pager
```

For public access without a domain, the app must bind to all interfaces:

```bash
HOST=0.0.0.0 PORT=8787 python3 -m app.web
```

## CLI examples

```bash
# Sync real sheet
python3 -m app.cli sync-sheet

# See dashboard JSON
python3 -m app.cli dashboard

# Mark video locally ready
python3 -m app.cli set-status V0008 Ready

# Create a dry-run version, no AI credits used
python3 -m app.cli dry-generate V0008 --reason 'test render'

# Inspect video + versions/jobs
python3 -m app.cli get V0008

# Approve version
python3 -m app.cli approve V0008 1 --notes 'looks good'

# Reject version
python3 -m app.cli reject V0008 1 --reason 'bad section 1 visual'

# Queue regeneration
python3 -m app.cli queue-regen V0008 --type regenerate_section_1 --reason 'fix section 1'
```

## Important design decisions

- Only `Approved` means done.
- `Generated` is normalized to `Needs Review` because generation alone is not final approval.
- Once the platform creates versions for a video, Sheet sync does not downgrade that local workflow state.
- Regeneration does not delete old versions.
- MVP1 uses SQLite first so workflow can be validated before adding Supabase.

## Definition of Done status

MVP1 current status: implemented and locally tested.

Passed checks:
- DB schema initializes.
- Sheet sync imports real Sheet rows.
- Dashboard and queue pages load.
- Video detail page loads.
- Dry-run generate creates a Needs Review version.
- Approve marks current final.
- Reject marks rejected.
- Regeneration queue preserves history.
- Duplicate active regeneration jobs are blocked.
- Sheet sync accepts both `CTA Sub Text` and `CTA Sub Text ` headers.
- Public service responds on `0.0.0.0:8787`.
- Live Sync Sheet action processes the full 300-row Sheet and shows a sync confirmation.
- Unit tests pass.

Security note: MVP1 currently has no login/auth. Anyone with the IP link can access the dashboard until auth is added.
