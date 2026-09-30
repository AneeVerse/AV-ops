# VPS full reset + restore playbook

**Backup stamp:** `20260922T105828Z`  
**On VPS:** `/root/vps-full-backup-20260922T105828Z` (~2.6 GB)  
**Local:** `local-secrets/vps-full-backup-20260922T105828Z/`  
**Do not wipe until local copy + SHA256 verify succeed.**

## What is in the backup

| Stack | Contents |
|-------|----------|
| **infra/** | `/root/.env`, nginx, Let’s Encrypt, systemd units, PM2 dump, project keys |
| **cultura/** | code tarball + Medusa Postgres (`medusa-db.dump` + `.sql.gz`) |
| **huly/** | selfhost config, custom account/front/calendar bundles + images, Cockroach/MinIO/Elastic/Redpanda/certs volumes |
| **studio/** | contentbeta app, contentbeta-supabase, Postgres dump |
| **obsidian/** | vault (`md.aneeverse`), obsidian-web, home/obsidian |

## Before wipe (you must do in Hostinger panel)

1. Confirm local backup folder is complete and `SHA256SUMS` verifies.
2. **Snapshots & backups → Create snapshot** (extra safety net).
3. Only then: **OS & Panel → Reinstall OS** → Ubuntu 24.04 LTS.
4. After reinstall: set root password / SSH key, note same IP `148.230.67.132`.

## After wipe — restore order

1. Base: `apt update && apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx redis-server postgresql postgresql-contrib nodejs npm` (+ enable docker).
2. Upload backup folder to `/root/vps-full-backup-20260922T105828Z`.
3. Restore **infra** nginx sites + certs (or re-issue certs with certbot).
4. Restore **Huly** volumes + `docker load` custom images + compose up.
5. Restore **Studio** (supabase compose + contentbeta + pm2).
6. Restore **Cultura** (postgres role/db + `pg_restore` + npm install + pm2).
7. Restore **Obsidian** vault + obsidian-web service.
8. Smoke-test: `app.aneeverse.com`, `studio.aneeverse.com`, `culturajewels.com`, `md.aneeverse.com`.

## After everything works — Hostinger CPU 100% limit

Yes: open a Hostinger ticket (VPS) and ask them to **remove the CPU limitation**. Clean OS does **not** clear Hostinger-side throttling (`CPU limitation activated` / high steal%).

### Ticket text (copy/paste)

Subject: Please remove CPU limitation on VPS srv1474915 (148.230.67.132)

Body:

We are seeing “CPU limitation activated” on KVM 2 VPS `srv1474915` / IP `148.230.67.132` (Ubuntu). Panel shows CPU pinned at 100% with the limitation warning. We have already removed heavy unused workloads (Hermes/OpenClaw) and will finish a clean rebuild of only production sites (Huly, Cultura, Studio, Obsidian).

Please remove the CPU limitation / fair-use throttle on this VPS so normal performance is restored. Confirm when the limit is cleared.

---

*Agent will continue restore after local download verifies and you confirm OS reinstall is done.*
