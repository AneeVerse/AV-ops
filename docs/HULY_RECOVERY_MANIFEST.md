# Huly recovery manifest

No passwords, API keys, or certificate contents are in this file.

## Backup timestamp

- Cockroach `BACKUP` started: 2026-09-30 06:58:49 UTC
- Cockroach `BACKUP` finished: 2026-09-30 06:58:54 UTC
- Backup collection id: `2026/09/30-065850.02`
- MinIO object mirror: immediately after, same day
- Packed tar: 2026-09-30 07:02 UTC

## Server

- Host: `srv1474915`
- IP: `148.230.67.132`
- Compose project: `huly_v7`
- Compose directory: `/opt/av_ops/docker/av_ops`
- Cluster: CockroachDB v24.2.10, single node, node id 1, live at backup time

## Source and images

Source commit baked into the custom images (not rebuilt during this backup):

- Front: `huly-front-custom:5d606cb-20260912182642` (commit `5d606cb`)
- Account: `huly-account-custom:5d606cb-20260907163731` (commit `5d606cb`)
- Calendar: `huly-calendar-custom:d1fa7ae-20260901182106` (commit `d1fa7ae`)

| Role | Image | Running container |
|---|---|---|
| Front | `huly-front-custom:5d606cb-20260912182642` | `huly_v7-front-1` |
| Account | `huly-account-custom:5d606cb-20260907163731` | `huly_v7-account-1` |
| Calendar | `huly-calendar-custom:d1fa7ae-20260901182106` | `huly_v7-calendar-1` |
| Transactor | `hardcoreeng/transactor:v0.7.426` | `huly_v7-transactor-1` |
| Workspace | `hardcoreeng/workspace:v0.7.426` | `huly_v7-workspace-1` |
| Collaborator | `hardcoreeng/collaborator:v0.7.426` | `huly_v7-collaborator-1` |
| Fulltext | `hardcoreeng/fulltext:v0.7.426` | `huly_v7-fulltext-1` |
| Rekoni | `hardcoreeng/rekoni-service:v0.7.426` | `huly_v7-rekoni-1` |
| Stats | `hardcoreeng/stats:v0.7.426` | `huly_v7-stats-1` |
| KVS | `hardcoreeng/hulykvs:v0.7.426` | `huly_v7-kvs-1` |
| Mail | `hardcoreeng/mail:v0.7.426` | `huly_v7-mail-1` |
| Edge nginx | `nginx:1.21.3` | `huly_v7-nginx-1` |
| CockroachDB | `cockroachdb/cockroach:latest-v24.2` (v24.2.10) | `huly_v7-cockroach-1` |
| MinIO | `pgsty/minio:RELEASE.2026-06-18T00-00-00Z` | `huly_v7-minio-1` |
| Elasticsearch | `elasticsearch:7.14.2` | `huly_v7-elastic-1` |
| Redpanda | `docker.redpanda.com/redpandadata/redpanda:v24.3.6` | `huly_v7-redpanda-1` |

Full container and image ids are in `config/running-containers.txt` and `config/images.txt` inside the backup. No images were pulled.

## Where the backup is

| Copy | Path |
|---|---|
| VPS directory | `/root/huly-recovery-20260930` (mode 700) |
| VPS tar | `/root/huly-recovery-20260930.tar` (mode 600, 93 MB) |
| PC tar | `local-secrets/huly-recovery-20260930.tar` (gitignored) |

Tar SHA256 (both copies):

`0fd45982fc76fdceb661f6ca5a79cd570bfae3c44ee24d637e2dc4e75a0e7b8b`

Inside the directory, `SHA256SUMS` covers 307 files, all checked OK on the VPS before packing.

Do not unpack the Cockroach `progress/` checkpoint files on Windows. Those names are longer than the old Windows path limit. Keep the tar, or unpack it on Linux.

## Cockroach backup path

- Method: online full-cluster `BACKUP INTO 'nodelocal://1/huly-20260930'`
- Files: `cockroach/nodelocal/2026/09/30-065850.02/`
- Manifest: `BACKUP_MANIFEST` and `BACKUP_MANIFEST-CHECKSUM` are present
- Job: succeeded, fraction 1
- Logical size reported by Cockroach: 9,620,319 bytes, 14,953 rows, 98 tables, 3 databases (`defaultdb`, `postgres`, `system`), 4 schemas
- On-disk backup tree: 2,587,626 bytes, 70 files
- Also copied: `cockroach/certs/` (private keys; not listed here)
- The 2.2 GB Docker volume is mostly store files. The consistent backup is the logical snapshot above, not a tar of that volume.

Database of record: `defaultdb`, including `global_account` (people, accounts, workspaces).

## MinIO backup path

- Method: `mc mirror` while MinIO stayed healthy
- Path: `minio/objects/`
- 2 buckets, 225 objects, 89.47 MiB transferred, 93,817,707 bytes on disk
- Copied file count matches the object count (225)

## Elasticsearch decision

`REBUILDABLE`

Huly search is a derived index built by `huly_v7-fulltext-1` from documents stored in Cockroach and MinIO. It is not the system of record. A restore should start an empty Elasticsearch and let fulltext reindex. The 46 MB volume was not copied.

## Redpanda decision

`REBUILDABLE`

Redpanda is the live event queue. Workspace documents are in Cockroach and MinIO. A restore should start a new Redpanda. Events that were only in the queue at 06:58 UTC are not in this backup. The 625 MB volume was not copied.

## Compose / config backup path

`config/huly-running-config.tgz`

Contains the compose file, the current override (MinIO image `pgsty/minio`, not the removed `minio/minio` name from the 22 Sep archive), `.env`, `huly_v7.conf`, and `secrets/`.

Secrets are present in that archive. They are not written in this manifest.

Use this config for a restore. Do not use the 22 Sep compose override as the source of truth.

Custom images are not inside this tar. They are still in the 22 Sep backup as `huly/custom-images.tar`, and the tags match the containers that were running.

## Expected restore order

On a new machine, not on this production VPS:

1. Load the custom images from the 22 Sep `custom-images.tar`. Pull the stock `hardcoreeng/*:v0.7.426` images and `pgsty/minio` only if they are not already present.
2. Lay down `config/huly-running-config.tgz`.
3. Start an empty Cockroach node with the saved certs.
4. `RESTORE FROM` the collection `2026/09/30-065850.02` into that empty cluster.
5. Start MinIO and upload `minio/objects/` back into the same bucket names.
6. Start Elasticsearch empty and let the fulltext service reindex.
7. Start Redpanda empty.
8. Start the rest of the Huly containers.

## Known dependencies

- Cockroach certs must match the cluster being restored, or the node must be new and the restore must be a full cluster restore into an empty node.
- MinIO bucket names must stay the same. Huly stores those ids in Cockroach.
- Front and account images are commit `5d606cb`. Calendar is the older commit `d1fa7ae`.
- Host Nginx for `app.aneeverse.com` is not inside this Huly tar. It is in `/root/av-ops-recovery-20260930`.

## Known limitations

- This backup was not restored onto a second server. Validity is the Cockroach job status, `BACKUP_MANIFEST`, file checksums, and the MinIO object count. It is not a rehearsed boot.
- A follow-up listing query after the backup hit the Cockroach memory limit. The container process was OOM-killed at 2026-09-30 07:00:27 UTC and came back by its existing restart policy. Huly returned HTTP 200 after that. The backup files were already complete before that query. Do not run a wide `SHOW BACKUP` on this node; its memory limit is tight.
- Cockroach was also OOM-killed earlier the same morning at 06:45 UTC, before this backup started.
- Windows cannot extract some Cockroach checkpoint filenames from the tar. Extract on Linux.
- Uncommitted Huly source on the developer PC is not what these images run, and it is not in this backup.

## Update 2026-09-30 08:40 UTC

Cockroach's container cap is 1.5 GB. Elasticsearch's cap is 1 GB. Neither container was restarted when those caps were raised. The historical OOM notes above still describe what happened before those caps existed. Do not lower them.

A repeating logical backup now exists:

- Script: `/opt/av_ops/scripts/avops-nightly-backup.sh`
- Timer: `avops-nightly-backup.timer` at 02:30 UTC
- Retention: 7 dated directories under `/var/backups/avops/`
- First good run: `20260930T083326Z`, 100,464,059 bytes, 309 checksums OK
- Status file: `/var/lib/avops/backup-status.txt`

That job takes a new Cockroach `BACKUP`, mirrors MinIO, and archives Huly config. It does not run `SHOW BACKUP`. It does not replace this 06:58 UTC snapshot or the 22 Sep backup. It is not copied off the VPS by itself.

## Read interface for Hermes (2026-10-01)

Hermes does not get a Cockroach connection. The supported read path is the transactor websocket already proxied by Huly nginx at `127.0.0.1:8087`. The private service is `avops-mcp.service` from `/opt/av_ops/docker/avops-mcp/`. It starts after Huly. Its API token is created in Huly Settings and is not written here.
