# AV OPS recovery inventory

Recorded 2026-09-30 06:41 UTC from a read-only inspection plus online dumps.
No secret values are stored in this file.

## Current as of 2026-09-30 08:40 UTC

This section supersedes older notes below where they disagree.

Host `srv1474915` (`148.230.67.132`). 2 vCPU, 7.7 GB RAM, 2 GB swap at `/swapfile` (fstab, swappiness 10). About 2.9 GB RAM available. Swap has about 467 MB in use after n8n was added. Disk about 35 GB used, 62 GB free.

Memory caps that must stay: Cockroach 1.5 GB, Elasticsearch 1 GB, n8n 1 GB. Cockroach and Elasticsearch were not restarted in the afternoon pass.

### Source of truth

| System | Source | What production actually runs |
|---|---|---|
| Huly development | PC `E:\Projects\platform-develop`, GitHub `AneeVerse/AV-ops` | Not deployed from the dirty working tree |
| Huly production | Docker images | Front and account `5d606cb`. Calendar `d1fa7ae`. Stock services `hardcoreeng/*:v0.7.426` |
| VPS deployment tree | `/opt/av_ops`, GitHub `AneeVerse/av_ops` | Compose, env, and site files. This is not the Huly application source. Commit `8de7e23` is local on the VPS and was not pushed. Do not `git add` `docker/` or `web/` |
| Studio | GitHub `AneeVerse/studio.aneeverse` at `0b62bdc` plus a dirty tree | The running tree on the VPS. The uncommitted patch is in the 30 Sep recovery set. It was not committed or redeployed |
| Cultura | VPS tree `/opt/av_ops/web/cultura` | PM2 frontend and backend. Database `onecarat_medusa` on host Postgres |
| Courses | PC `E:\Projects\cource-buildx100`, deployed at `/opt/av_ops/web/courses` | Next app. Separate from the Huly repo |

### Nightly backups

Script: `/opt/av_ops/scripts/avops-nightly-backup.sh` (also in this repo at `scripts/avops-nightly-backup.sh`).

Timer: `avops-nightly-backup.timer`, 02:30 UTC, 7-day retention.

Directory: `/var/backups/avops/` mode 700. Status: `/var/lib/avops/backup-status.txt`.

Each run is a logical Cockroach `BACKUP`, a MinIO object mirror, `pg_dump` of Cultura and Supabase, a Redis RDB, Hermes sqlite copies, the Obsidian vault, and config archives. It does not tar live database directories and it does not copy Elasticsearch or Redpanda volumes.

Measured size of the first good run `20260930T083326Z`: 100,464,059 bytes. 309 checksums matched. Seven copies would be about 700 MB. The job refuses to start if the disk has under 8 GB free.

The 22 Sep backup and `/root/huly-recovery-20260930` were not deleted. A nightly set is not copied off the VPS automatically. The PC is not an always-on target.

### Courses

The app reads Supabase tables `courses`, `modules`, `lessons`, and `enrollments` (`/opt/av_ops/web/courses/lib/supabase/queries.ts`). It uses `https://supabase.aneeverse.com`, the same database as Studio. Those tables are not in `public`. The Studio tables (brands, jobs, layouts) are present. Course content is not static in the Next build.

Intended schema: `/opt/av_ops/web/courses/supabase/schema.sql` (profiles, courses, modules, lessons, enrollments, video_progress, RLS). `seed.sql` inserts a mock admin and a sample course. Do not apply the seed to the shared Studio database. The schema file was not applied in this pass because it writes to that shared database.

### Hermes

Dashboard only, `127.0.0.1:9119`, `https://bots.aneeverse.com`. Gateway was not started. `config.yaml` selects provider `auto`, model `anthropic/claude-opus-4.6`, OpenRouter base URL. No provider API key is set in the Hermes environment. A Studio OpenAI key exists and was not copied into Hermes. Obsidian is not mounted for Hermes. Hermes has no Huly read token and no write access.

### n8n

`n8nio/n8n:2.41.4` is running as `n8n-n8n-1`, bound to `127.0.0.1:5678`, memory cap 1 GB, using about 491 MB. Nginx serves `https://n8n.aneeverse.com` with the existing certificate. The UI requires basic auth. Credentials are in `/opt/av_ops/docker/n8n/nginx-auth.txt` (root-only). Webhook paths are not behind that password. `/webhook/generate` returns 404 because no workflow is active.

Studio workflow JSON is on disk under `contentbeta/n8n-workflows`. `scripts/sync-n8n-workflows.js` would import and activate them and call paid APIs. It was not run. Old `/var/lib/n8n` data was not on the server.

### Left unchanged on purpose

SSH, UFW, Huly schema, Cockroach data, Elasticsearch data and version, application source, and the Hermes gateway. Redpanda's restart policy is now `unless-stopped`. The process was not restarted.

Host: `srv1474915` (`148.230.67.132`), Ubuntu 26.04.1, uptime 2 days 14 hours.
Disk: 96 GB, 31 GB used, 66 GB free. RAM 7.7 GB, swap none.
Root tree: `/opt/av_ops` (8.0 GB).

## Backup locations

| Copy | Path | Taken | Size | Where it lives |
|---|---|---|---|---|
| Pre-wipe backup | stamp `20260922T105828Z` | 22 Sep 2026 11:10–11:38 UTC; Cultura DB refreshed 23 Sep 2026 07:52 UTC | 2.8 GB | VPS `/root/vps-restore-backup` and this PC `local-secrets/vps-full-backup-20260922T105828Z` (2,784.6 MB) |
| Fresh recovery | `20260930` | 30 Sep 2026 ~06:45 UTC | 4.6 MB | VPS `/root/av-ops-recovery-20260930` (mode 700) and this PC `local-secrets/av-ops-recovery-20260930` (gitignored) |

The fresh set does **not** replace the 22 Sep volume archives. It adds current config, logical database dumps for Postgres/Supabase/Redis/Hermes, and the Obsidian vault.

Hostinger snapshot: UNKNOWN. Nothing on the OS proves a panel snapshot exists.

## System inventory

| System | Current source | Version / commit | Production location | Database | Persistent storage | Backup location | Last backup | Recovery method | Confidence | Missing |
|---|---|---|---|---|---|---|---|---|---|---|
| Huly / AV OPS | PC `E:\Projects\platform-develop`, GitHub `AneeVerse/AV-ops` | Images from `5d606cb` (front, account) and `d1fa7ae` (calendar). Stock services `v0.7.426` | `/opt/av_ops/docker/av_ops` | CockroachDB volume `huly_v7_cr_data` 2.2 GB | MinIO `huly_v7_files` 92 MB, Elasticsearch `huly_v7_elastic` 46 MB, Redpanda `huly_v7_redpanda` 625 MB | 22 Sep volume tars + custom image tar (764 MB). 30 Sep config tar only | Volumes 22 Sep. Config 30 Sep | Restore volume tars with `tar --numeric-owner`, load `custom-images.tar`, use 30 Sep compose/env | PARTIAL | No dump of live Cockroach/MinIO/Elastic/Redpanda since 22 Sep. Those files were written again on 30 Sep |
| Cultura | VPS tree, no git. Code tarball in 22 Sep backup | Medusa. Catalog counts unchanged: 26 products, 57 variants, 106 images, 3 orders | `/opt/av_ops/web/cultura` | Host PostgreSQL 18 `onecarat_medusa` (~20 MB) | Product media tarball 164 MB in 22 Sep backup. Redis cache 1.8 MB | 23 Sep dump and 30 Sep `pg_dump` (920 KB custom, 298 table-data entries) | 30 Sep | `pg_restore` the 30 Sep dump. Restore code and media from 22 Sep tarballs. Re-apply `medusa-config.ts` from the 30 Sep copy | GOOD for catalog | Redis is a cache. Media newer than 22 Sep was not found outside Next.js image cache |
| Studio | GitHub `AneeVerse/studio.aneeverse` | `0b62bdc` plus 39 uncommitted paths | `/opt/av_ops/web/studio/contentbeta` | Supabase Postgres 15, bind mount `supabase/volumes/db/data`, DB ~15 MB | Supabase storage inside that volumes tree (62 MB total) | 22 Sep sql.gz + supabase tar. 30 Sep `pg_dump` (2.4 MB, 116 table-data entries) and `studio-uncommitted.patch` (396 KB) | 30 Sep | Restore GitHub commit, apply the patch, `pg_restore` the 30 Sep dump, restore storage files from the 22 Sep supabase tar if objects are not inside the SQL dump | GOOD for database and the uncommitted patch | Binary storage objects changed after 22 Sep were not copied as files. Patch is not on GitHub |
| Courses | PC `E:\Projects\cource-buildx100` and `local-secrets/cource-buildx100.tar.gz` (28 Sep) | Next app. No git on the VPS. No files in the app tree newer than the deploy | `/opt/av_ops/web/courses` | Same Supabase as Studio | none separate | Env file in the 30 Sep set. Source on the PC | Env 30 Sep. Source 28 Sep | Redeploy the PC tarball and the saved env | PARTIAL | No `course` / `lesson` / `module` tables in the Supabase dump. Public tables are Studio tables (brands, carousels, jobs) |
| Hermes | Upstream `NousResearch/hermes-agent` `71cb7d60f` | Dashboard only. Gateway stopped | `/opt/av_ops/docker/hermes_agent` | SQLite `state.db`, `projects.db`, `shared-state.db` | Home dir is 2.4 GB, mostly reinstallable tools/cache/clone | 30 Sep sqlite online backups plus `.env` and `config.yaml`. Not in the 22 Sep backup | 30 Sep | Restore the three sqlite files and env, reinstall the agent | GOOD for the new empty-ish dashboard | Old agent profiles were already gone before 22 Sep. Model key was never present |
| Obsidian | Vault on the VPS | 60 markdown notes. Newest note body 12 Aug 2026. App UI state touched 30 Sep | `/opt/av_ops/memory/obsidian` | none | vault | 22 Sep tarballs and 30 Sep vault tar (60 md files, 50 KB) | 30 Sep | Extract the 30 Sep vault tar | GOOD | Not wired to Hermes |
| Nginx + TLS | `/etc/nginx`, `/etc/letsencrypt` | Sites for app, bots, courses, cultura, md, studio, supabase | host | none | certs | 22 Sep nginx+certs (missing bots and courses vhosts). 30 Sep `nginx.tgz` and `letsencrypt.tgz` include current sites | 30 Sep | Extract tarballs. Certs can also be reissued with certbot if DNS still points here | GOOD | Secrets are inside these tarballs. Permissions on the fresh dir are 700 |
| PM2 | `/root/.pm2/dump.pm2` | frontend, backend, contentbeta, courses online | host | none | dump | 22 Sep dump is stale. 30 Sep copy taken without `pm2 save` | 30 Sep | Restore dump or start the four apps again from their directories | GOOD | Cultura backend still shows 130 historical restarts |
| systemd | `hermes-dashboard`, `obsidian-web`, `pm2-root`, nginx, postgres, redis, docker | enabled and running | `/etc/systemd/system` for the custom units | none | unit files | 22 Sep has obsidian and an old n8n unit. 30 Sep copied hermes, obsidian, pm2 units | 30 Sep | Reinstall unit files and `systemctl enable` | GOOD | n8n unit in the old backup has no running service |
| Docker config | compose under `/opt/av_ops/docker/av_ops` | override edited 28 Sep (MinIO image `pgsty/minio`, `pull_policy`) | same | see Huly | named volumes listed above | 22 Sep selfhost tar has the old override. 30 Sep `huly-config-20260930.tgz` has current `.env`, compose, override, `huly_v7.conf`, `secrets/` | 30 Sep for config. 22 Sep for images and volumes | Use the 30 Sep config with the 22 Sep image tar and volume tars | PARTIAL | Live volume data is older in the backup than on disk |

## What was not dumped on 30 Sep morning, and why

The 06:41 UTC pass did not dump Cockroach or MinIO. That gap was closed later the same morning by `/root/huly-recovery-20260930` (see `docs/HULY_RECOVERY_MANIFEST.md`) and again at 08:33 UTC by the first nightly run. Elasticsearch and Redpanda are still not volume-copied. They are rebuildable. Do not hot-tar their live directories.

## Verification already done

- 22 Sep `SHA256SUMS`: 49 files OK, 1 mismatch. The mismatch is `meta/sizes.txt` only (a size note). Every data archive matched.
- All 18 `.gz` archives in the 22 Sep set passed `gzip -t`.
- `custom-images.tar` is readable. Tags inside the note match the running images.
- 22 Sep Cultura `medusa-db.dump` lists with `pg_restore -l` (1039 lines).
- 30 Sep Cultura dump lists (1038 TOC lines, 298 table-data entries) and is non-empty (919,854 bytes).
- 30 Sep Supabase dump lists (473 TOC lines, 116 table-data entries) and is non-empty (2,355,411 bytes).
- 30 Sep Redis RDB is 33,479 bytes after `BGSAVE` status `ok`.
- Hermes sqlite backups open and report tables: state 24, projects 4, shared-state 15.
- 30 Sep `SHA256SUMS`: 30 files OK, 0 failed.
- No restore onto production was performed. These checks are archive and dump-catalog checks, not a boot of a second copy.

## AV OPS MCP (2026-10-01)

Read-only bridge. It is not a database and it does not hold a Cockroach credential.

| Item | Value |
|---|---|
| Source | `services/avops-mcp/` in this repo |
| Runtime | `/opt/av_ops/docker/avops-mcp/` |
| Service | `avops-mcp.service` |
| Bind | `127.0.0.1:8765` |
| Config | `/opt/av_ops/docker/avops-mcp/.env` mode 600. Not in Git |
| Depends on | Huly nginx at `127.0.0.1:8087` and a Huly Settings API token |
| Hermes | stdio MCP on the `avops` profile only |

Restore order: Huly transactor and nginx first, then this directory and unit, then put a new API token in `.env` and start the service. The token is not in the backup docs. The nightly config archive may copy the env file; treat that archive as secret.
