# AV-ops

Backup of the Aneeverse VPS (`srv1474915`, `148.230.67.132`).

This repo is **one folder** with all app code, nginx/systemd config, and database data as JSON/SQL.  
Copied from the live VPS. Nothing on the server was moved. Production kept running.

**GitHub:** https://github.com/AneeVerse/AV-ops.git

## What is in git vs not in git

| In this repo | Not in this repo (secrets pack) |
|---|---|
| App source, compose files, nginx, systemd | `.env`, DB passwords, API keys |
| JSON table dumps + SQL dumps | SSL `.pem` / `.key` (Let's Encrypt) |
| n8n workflow JSON | n8n credentials, SSH keys |
| Docker/container inventory | `/var/lib/docker` (46 GB — pull images from `00-inventory`) |

After a wipe, clone this repo, put secrets back from the email zip, then restore.

## VPS map

| URL | App | Folder |
|---|---|---|
| https://app.aneeverse.com | Huly | `03-huly` |
| https://supabase.aneeverse.com | Contentbeta Supabase | `05-supabase` |
| https://crm.aneeverse.com | Frappe CRM | `06-frappe-crm` |
| https://sales1.aneeverse.com | ERPNext + Sales Next | `07-erpnext`, `10-openclaw` |
| https://n8n.aneeverse.com | n8n | `08-n8n`, `18-data-json/n8n` |
| https://scrape.aneeverse.com | ScrapeGraphAI | `09-scrapegraphai` |
| https://chat.aneeverse.com | OpenClaw chat-control | `10-openclaw` |
| https://md.aneeverse.com | Obsidian web | `13-obsidian` |
| https://codex.aneeverse.com | Codex proxy | `14-codex-proxy` |
| https://bot.aneeverse.com / bots / studio / erp | Other nginx vhosts | `01-nginx` |

Exact live paths: `00-inventory/paths.json`.

---

## Folders

### `00-inventory` — what was on the VPS

| File | What it includes |
|---|---|
| `paths.json` | IP, hostname, SSH, every app path and URL |
| `collected.json` | What was copied and where the JSON data lives |
| `containers-images.jsonl` | Every Docker container and image |
| `services.txt` | Running systemd services + PM2 list |

Use this first when rebuilding the machine.

### `01-nginx` — all site configs

Copied from `/etc/nginx`.

- `nginx.conf` — main nginx config
- `sites-available/` — every vhost: `app`, `crm`, `n8n`, `sales1`, `supabase`, `chat`, `codex`, `scrape`, `md`, `bot`, `bots`, `studio`, `erp`, `culturajewels`, plus backups
- `sites-enabled/` — the enabled copies (symlinks on the VPS)

Put these back under `/etc/nginx/` and reload nginx. SSL certs are **not** here (secrets pack).

### `02-systemd` — services that start on boot

Unit files from `/etc/systemd/system/`:

- `n8n.service`
- `novino-gateway-proxy.service`
- `chat-control.service`
- `sales1-next.service`
- `sales-n8n-bridge.service`
- `automation-api.service`
- `scrapegraphai-web.service`
- `obsidian-web.service`
- `jwel-img-gen-ui.service` / `jwel-img-gen-bridge.service`
- `codex-proxy.service` / `codex-proxy-tunnel.service`
- `traitdna-video-platform.service`
- `pm2-root.service`
- `hermes-dashboard-firewall.service`

Passwords were stripped from unit files. Real values are in the secrets pack.

### `03-huly` — Huly (app.aneeverse.com)

| Path | Live path | What it includes |
|---|---|---|
| `huly-selfhost/` | `/opt/huly-selfhost` | `compose.yml`, override, backup/restore scripts, nginx template |
| `huly-front/` | `/opt/huly-front` | Custom front image source/dist |
| `huly-account/` | `/opt/huly-account` | Custom account image |
| `huly-calendar/` | `/opt/huly-calendar` | Custom calendar image |

Compose project on the VPS is `huly_v7`.  
Workspace backup JSON is in `18-data-json/huly/`.  
`huly_v7.conf` and `.env` are in the secrets pack.

### `04-contentbeta` — Contentbeta Next app

Source from `/opt/contentbeta` (PM2 process `contentbeta`). App pages, components, lib, n8n-workflows. `node_modules` not included.

### `05-supabase` — Contentbeta Supabase

Compose/config from `/opt/contentbeta-supabase`. Serves https://supabase.aneeverse.com.  
`.env` and keys are in the secrets pack. Database JSON/SQL is in `18-data-json/supabase` and `18-data-json/sql`.

### `06-frappe-crm` — Frappe CRM

Install files from `/opt/frappe-crm` (`easy-install.py`, `frappe_docker`, compose).  
Live URL: https://crm.aneeverse.com. Data: `18-data-json/crm` + `18-data-json/sql/crm-all.sql.gz`.

### `07-erpnext` — ERPNext Sales

`erpnext-sales1-compose.yml` from `/root`.  
Live URL: https://sales1.aneeverse.com. Data: `18-data-json/erpnext` + `18-data-json/sql/erpnext-all.sql.gz`.

### `08-n8n` — n8n config placeholders

Folder for n8n config. Real `n8n.env` and encryption keys are in the secrets pack.  
Exported workflows: `18-data-json/n8n/workflows.json`.

### `09-scrapegraphai` — ScrapeGraphAI web UI

`/opt/scrapegraphai` — `webui/app.py` and README. Playwright browsers and venv were not copied (too large).  
`.env` is in the secrets pack.

### `10-openclaw` — OpenClaw workspace and Novino proxy

| Path | Live path | What it includes |
|---|---|---|
| `novino-gateway-proxy/` | `/root/.openclaw/novino-gateway-proxy` | Novino / OpenClaw gateway proxy |
| `workspace/` | `/root/.openclaw/workspace` | Chat control, sales Next app, TraitDNA, automation scripts, video/PPT projects |

Large videos (`.mp4`) and the Obsidian AppImage were left out of git (GitHub 100 MB limit).  
`.env` files are in the secrets pack.

### `12-jwel` — jewelry image generation

- `jwel_img_gen_ui/` — UI from `/root/jwel_img_gen_ui`
- `jwel_img_gen_bridge/` — n8n/Gemini sheet bridge from `/root/jwel_img_gen_bridge`

### `13-obsidian` — Obsidian via noVNC

`/opt/obsidian-web` (`run.sh`). The 124 MB `Obsidian.AppImage` is in the secrets `large-binaries` folder, not git.

### `14-codex-proxy` — Codex proxies

`/opt/codex-proxy` and `/opt/codex-cursor-proxy`. API keys are in the secrets pack.

### `15-deploy` — PM2 frontend / backend

Source from `/root/deploy/frontend` (PM2 `frontend`) and `/root/deploy/backend` (PM2 `backend`).  
`node_modules` not included. `.env` in secrets pack.

### `16-leadgen-medusa` — leadgen + Medusa store

- `leadgen-system/` — `/root/leadgen-system`
- `my-medusa-store/` — `/root/my-medusa-store`
- `my-medusa-store-storefront/` — storefront

Medusa data is in `18-data-json/postgres/onecarat_medusa/`.

### `17-scripts` — root helper scripts

From `/root` on the VPS:

- `crm_prod_setup-compose.yml`
- `erpnext-sales1-compose.yml`
- `fix_db.sh`
- `restart-verify-hermes-dashboard.sh`
- `drive_*_webp_batch.py`
- `package.json`

Passwords for those compose files are in the secrets pack.

### `18-data-json` — all data (JSON + SQL)

| Path | What it includes |
|---|---|
| `huly/workspace-backup.tar.gz` | Official Huly backup for workspace `aneeverse` (JSON snapshots) |
| `crm/` | Frappe CRM tables as JSON + `index.json` |
| `erpnext/` | ERPNext tables as JSON + `index.json` |
| `supabase/` | Supabase Postgres tables as JSON |
| `postgres/` | Host Postgres (includes `onecarat_medusa`) as JSON |
| `sql/*.sql.gz` | Full dumps: CRM, ERPNext, Supabase, host Postgres |
| `n8n/workflows.json` | Exported n8n workflows |
| `docker/` | Container/image list and running services |

Tables with more than 5000 rows are listed in each `index.json` only; full rows are in the matching `sql/*.sql.gz`.

---

## Restore after a clean VPS

1. Clone this repo:

```bash
git clone https://github.com/AneeVerse/AV-ops.git
```

2. Put secrets back from the email zip (`AV-ops-secrets-EMAIL.zip`): `.env`, SSL, SSH keys, DB passwords.

3. Install Docker, nginx, Node, Python.

4. Copy each folder to the live path in `00-inventory/paths.json`.

5. Start stacks:

```bash
cd /opt/huly-selfhost && docker compose up -d
# same for CRM, ERPNext, Supabase compose files
```

6. Restore data from `18-data-json` (Huly: `backup-restore.sh` on `huly/workspace-backup.tar.gz`; others: `sql/*.sql.gz`).

7. Enable systemd units from `02-systemd` and `systemctl daemon-reload`.

8. Pull Docker images listed in `00-inventory/containers-images.jsonl`.

Hostinger also has full disk backups of this VPS if you need the whole machine as it was.
