# AV-ops

One folder backup of the Aneeverse VPS (`srv1474915`, `148.230.67.132`).

This repo is the **code + config + JSON data**. Secrets are **not** in git.

Secrets zip on this PC: `E:\Projects\AV-ops-secrets-EMAIL.zip`  
Full secrets folder: `E:\Projects\AV-ops-secrets`  
The VPS has no `mail` command, so the zip is ready for you to send to your email.

## Folders

| Folder | What it is |
|---|---|
| `00-inventory` | Machine list: containers, images, services, disks |
| `01-nginx` | All site configs |
| `02-systemd` | Service unit files (passwords removed) |
| `03-huly` | Huly compose, scripts, custom front/account/calendar |
| `04-contentbeta` | Contentbeta Next app |
| `05-supabase` | Contentbeta Supabase compose |
| `06-frappe-crm` | Frappe CRM install files |
| `07-erpnext` | ERPNext compose |
| `08-n8n` | n8n config + exported workflows JSON |
| `09-scrapegraphai` | ScrapeGraphAI web UI |
| `10-openclaw` | OpenClaw workspace apps (chat-control, sales, novino, traitdna, …) |
| `12-jwel` | Jewelry image gen UI + bridge |
| `13-obsidian` | Obsidian web |
| `14-codex-proxy` | Codex proxies |
| `15-deploy` | PM2 frontend/backend source |
| `16-leadgen-medusa` | Leadgen + Medusa |
| `17-scripts` | Root helper scripts |
| `18-data-json` | Databases and app data as JSON |

## After a clean VPS

1. Open the email pack `AV-ops-secrets` and put `.env`, SSL, SSH keys, DB passwords back.
2. Install Docker, nginx, Node, Python.
3. Copy each folder back to the path in `00-inventory/paths.json`.
4. `docker compose up -d` in Huly / CRM / ERP / Supabase.
5. Restore JSON data from `18-data-json`.
6. Enable systemd units from `02-systemd`.

Hostinger disk backups also exist on this VPS if you need the whole machine back as-is.
