# Huly production deploy guide (aneeverse)

This document describes **how this fork is deployed today** so the next person or agent does not start from scratch.

**Day-to-day:** run `local.cmd` (local UI + production data) or `ship.cmd` (build and deploy front). See [LOCAL-AND-DEPLOY.md](LOCAL-AND-DEPLOY.md).

## Production at a glance

| Item | Value |
|------|--------|
| Live URL | https://huly.aneeverse.com |
| VPS (Hostinger) | `148.230.67.132` — hostname `srv1474915` |
| SSH | `ssh -i ~/.ssh/id_ed25519 root@148.230.67.132` |
| Huly stack path | `/opt/huly-selfhost` |
| Compose project | `huly_v7` (containers `huly_v7-*`) |
| Docker nginx (internal) | `127.0.0.1:8087` → container `huly_v7-nginx-1` |
| Host nginx (TLS) | `/etc/nginx/sites-available/huly.aneeverse.com` |
| SSL | Let's Encrypt `/etc/letsencrypt/live/huly.aneeverse.com/` |
| DNS | `huly.aneeverse.com` A → `148.230.67.132` (Hostinger DNS zone `aneeverse.com`) |
| Version | `v0.7.426` (`HULY_VERSION` in `huly_v7.conf`) |
| Custom front image | `huly-front-custom:lead-wizard` (pinned in `compose.override.yml`) |

**Do not deploy Huly on** DigitalOcean `64.227.187.210` — that server runs horeca1 prod and is full.

---

## Custom code in this repo (vs upstream Huly)

These changes are **not** in official `hardcoreeng/front:v0.7.426` until you build and deploy them.

### 1. Lead wizard (frontend only)

- **Files:** `plugins/lead-resources/src/components/CreateCustomer.svelte`, `CreateLead.svelte`
- **Behavior:** Funnel **+ Lead** → Create Customer → **Next** → Lead form with customer pre-selected.
- **Deploy type:** Frontend bundle (webpack) — see below.

### 2. Tracker States + Dashboard (model + optional DB patch)

- **Files:** `models/tracker/src/viewlets.ts`, `plugin.ts`, `migration.ts`
- **Behavior:** Issues toolbar gets **States** and **Dashboard** (same task viewlets as Leads).
- **Deploy type:** Model docs in workspace DB. For **existing** workspaces, run `scripts/huly-insert-issue-viewlets.sh` on VPS (or wait for upgrade migration on next full model deploy).

### 3. Viewlet toolbar order (frontend only)

- **File:** `plugins/view-resources/src/components/ViewletSelector.svelte`
- **Behavior:** Toolbar order **States → List → Board → Dashboard** (matches Leads).
- **Deploy type:** Frontend bundle.

### 4. Company app (model + frontend)

- **Files:** `models/tracker` (`Project.company`, Company Application), `plugins/tracker-resources` (project Company picker, company page tabs)
- **Behavior:** Left-bar **Company** tab lists Contacts companies. Open a company → **Projects** / **Issues**. Tracker create/edit project has optional **Company**.
- **Deploy type:** Frontend bundle **and** `scripts/huly-insert-company-app.sh`. `ship.cmd` alone does not create the sidebar tab or field. Official `upgrade-workspace` on stock images does not include this fork’s model.

---

## Two deploy paths (pick one)

### A) Frontend / UI change only (most common)

Use when you changed `.svelte` / `.ts` under `plugins/*-resources` or `packages/*`.

**On Windows dev machine** (Git Bash — `rm` in npm scripts fails in PowerShell):

```bash
cd /e/Projects/platform-develop
rush install --bypass-policy   # once, or after dependency changes

cd dev/prod
NODE_OPTIONS=--max-old-space-size=8192 rushx package
# Or if rushx package fails on Windows:
# NODE_ENV=production NODE_OPTIONS=--max-old-space-size=8192 npx webpack --stats-error-details

# Copy public assets, remove dev config
cp -r public/huly dist/huly 2>/dev/null || true
rm -f dist/config.json

# Pack (exclude sourcemaps to save size)
tar --exclude='*.map' --exclude='*.map.gz' --exclude='report.html' \
  -czf huly-front-dist.tgz -C dist .
```

**Upload and deploy on VPS:**

```powershell
scp -i $env:USERPROFILE\.ssh\id_ed25519 `
  dev/prod/huly-front-dist.tgz `
  scripts/huly-deploy-front.sh `
  root@148.230.67.132:/tmp/
```

```bash
ssh -i ~/.ssh/id_ed25519 root@148.230.67.132 'bash /tmp/huly-deploy-front.sh'
```

**What `huly-deploy-front.sh` does:**

1. Extract tarball to `/tmp/huly-front-extract`
2. Keeps live `config.json` / `branding.json` from running front container
3. Replaces `/app/dist` inside `huly_v7-front-1`
4. Restarts `huly_v7-front-1` and **`huly_v7-nginx-1`** (required — otherwise 502 from stale upstream IP)
5. `docker commit` → `huly-front-custom:lead-wizard`

**Verify:** Hard-refresh https://huly.aneeverse.com (Ctrl+F5). Check `index.html` references new `bundle.*.js`.

**Typical time:** ~8 min webpack + ~2 min upload/restart. **No** `rush install` on VPS. **No** Cockroach/account rebuild.

---

### B) Model-only change (no webpack)

Use when you only changed `models/*` (viewlets, migrations, classes) and production **already has** the UI components (States/Dashboard do).

**For Tracker viewlets on live workspace:**

```bash
scp -i ~/.ssh/id_ed25519 scripts/huly-insert-issue-viewlets.sh root@148.230.67.132:/tmp/
ssh -i ~/.ssh/id_ed25519 root@148.230.67.132 'bash /tmp/huly-insert-issue-viewlets.sh'
```

This inserts `tracker:viewlet:IssueStatusTable` and `tracker:viewlet:IssueDashboard` into `model_tx` for all workspaces, then restarts `huly_v7-workspace-1`, `huly_v7-transactor-1`, `huly_v7-nginx-1`.

**Verify:** Project → Issues → toolbar shows States + Dashboard icons.

**For Company app + `Project.company` field:**

```bash
bash scripts/huly-deploy-production.sh model-company
```

This inserts `tracker:app:Company`, `tracker:class:Project_company`, and the Organization panel footer mixin, then restarts workspace, transactor, and nginx.

**Verify:** Left bar shows **Company**. Open a company → Projects and Issues tabs. Create/edit a Tracker project → Company picker.

---

### C) Full stack / first-time install

Use official self-host on VPS only:

```bash
# On VPS — see scripts/install-huly-vps.sh for full bootstrap
/opt/huly-selfhost   # clone from hcengineering/huly-selfhost
./setup.sh
docker compose up -d
```

Then host nginx + certbot for `huly.aneeverse.com`. See `scripts/huly-ssl.sh`, `scripts/install-huly-vps.sh`.

After first install, apply **A** for custom UI and **B** for tracker viewlets.

---

## VPS layout (important paths)

```
/opt/huly-selfhost/
  huly_v7.conf          # secrets + DB URL (source before tool commands)
  compose.yml
  compose.override.yml  # extra_hosts, memory limits, image: huly-front-custom:lead-wizard
  run-tool.sh           # huly CLI in tool container (create-account, upgrade-workspace, …)

/etc/nginx/sites-enabled/huly.aneeverse.com   # proxy_pass → 127.0.0.1:8087

Docker containers (docker compose ps):
  huly_v7-front-1       # serves /app/dist + bundle.js
  huly_v7-nginx-1       # internal routing — restart after front recreate
  huly_v7-workspace-1   # model migrations
  huly_v7-transactor-1
  huly_v7-account-1
  huly_v7-cockroach-1
  …
```

**Huly admin CLI on VPS:**

```bash
cd /opt/huly-selfhost
./run-tool.sh create-account user@example.com -p 'password' -f First -l Last
./run-tool.sh generate-token --admin user@example.com aneeverse
./run-tool.sh upgrade-workspace aneeverse
```

---

## Hostinger firewall (connectivity issues)

VPS uses Hostinger managed firewall group **`openclaw`** (firewall id `233317`, VM id `1474915`).

- Default policy: **drop all**, then allow rules for 22, 80, 443, 18789.
- Some client IPs can still get **`ERR_CONNECTION_TIMED_OUT`** (packets never reach nginx — check access.log for their IP).

**Diagnose on VPS:**

```bash
bash /tmp/huly-check-ip-block.sh    # scripts/huly-check-ip-block.sh — fail2ban, iptables, nginx
grep 'FRIEND_IP' /var/log/nginx/access.log   # no lines = blocked before nginx
```

**Mitigations (in order):**

1. Ensure friends use **https://huly.aneeverse.com** (not raw IP, not port 8087).
2. **Preferred (2026-08-18):** Hostinger managed firewall **deactivated** on VM `1474915`; OS **ufw** allows 22/80/443. Re-run `scripts/huly-os-firewall-lockdown.sh` on VPS after reboot if needed.
3. If re-enabling Hostinger firewall: allow TCP 80/443 from `any`, sync via hPanel or `VPS_syncFirewallV1`.
4. **Long-term fix:** put **Cloudflare** in front of `huly.aneeverse.com`; bind extra docker ports (`8081`, `8082`, `8087`, `8000`) to localhost only.

**After any front container recreate:** always `docker restart huly_v7-nginx-1`.

---

## Script index (`scripts/`)

| Script | Purpose |
|--------|---------|
| `huly-deploy-front.sh` | **Main UI deploy** — tarball → front container → restart nginx |
| `huly-insert-issue-viewlets.sh` | **Model patch** — Tracker States/Dashboard on live DB |
| `huly-insert-company-app.sh` | **Model patch** — Company app, `Project.company`, company panel tabs |
| `huly-deploy-production.sh` | **Orchestrator** — `front` \| `model-tracker` \| `model-company` \| `verify` |
| `huly-tool.sh` | Run `hardcoreeng/tool` against live stack (on VPS) |
| `huly-check-ip-block.sh` | Debug IP / firewall blocks |
| `install-huly-vps.sh` | First-time VPS bootstrap |
| `huly-pin-front-image.sh` | Pin `huly-front-custom:lead-wizard` in compose.override |

Other `huly-*.sh` files are one-off diagnostics from past sessions; safe to ignore unless debugging.

---

## Checklist for agents

- [ ] Identify change type: **frontend (A)** vs **model (B)** vs **full install (C)**
- [ ] Build on Windows with **Git Bash** for webpack if needed
- [ ] Never commit secrets (`huly_v7.conf`, passwords, API tokens) to git
- [ ] Deploy front → restart **both** `front` and **docker nginx**
- [ ] Model tracker viewlets → run insert script OR full workspace upgrade
- [ ] Company app → `ship.cmd` **and** `huly-deploy-production.sh model-company`
- [ ] Ask user to hard-refresh and verify on https://huly.aneeverse.com
- [ ] Do **not** run full `rush build` on VPS for UI-only changes
- [ ] Do **not** use Hostinger MCP DNS (use REST API or hPanel if DNS changes needed)

---

## Logins (production)

Stored on VPS at `/root/huly-login.txt` (do not copy into git). Workspace: **aneeverse**.

---

## Local repo notes

- Rush monorepo: install once with `rush install --bypass-policy`
- AGENTS.md: do not auto-run builds for verification; ask user to verify manually after deploy
