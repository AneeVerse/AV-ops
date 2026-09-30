# Aneeverse VPS Inventory & Operations Guide

**Host:** `srv1474915`  
**IP:** `148.230.67.132`  
**Provider:** Hostinger VPS  
**OS:** Ubuntu  
**Spec:** 2 vCPU · 8 GB RAM · 96 GB disk  
**Document date:** 19 Sep 2026 (from live scan)  
**Purpose:** Shareable overview of what runs on the VPS, resources, URLs, backups, and fresh-start guidance.

---

## 1. Current host health (at scan time)

| Metric | Value |
|--------|--------|
| Disk | **69 GB used / 96 GB** (~28 GB free, **72%**) |
| RAM | **7.8 GB** total · ~5.5 GB used · ~2.2 GB available |
| Swap | 8 GB · ~2.5 GB in use |
| Load average | Was elevated (e.g. ~4 / 12 / 32) — box often **overloaded** when everything is on |
| Uptime | ~39 days |

**Note:** Running *all* stacks at once on 2 vCPU / 8 GB is tight. Hermes (many agents) + Huly Docker are the main load drivers.

---

## 2. Public sites (nginx)

| Domain | Points to | App |
|--------|-----------|-----|
| `app.aneeverse.com` | `127.0.0.1:8087` / `:3011` | **Huly** |
| `bot.aneeverse.com` | `:18789` (+ sales `:3001` / `:8001`) | **OpenClaw** (+ sales tools) |
| `bots.aneeverse.com` | Hermes `:9119`, jwel UI `:3024`, VNC `:6084` | **Hermes** (+ jewelry UI) |
| `studio.aneeverse.com` | `:3000` | **Contentbeta / Studio** |
| `supabase.aneeverse.com` | `:8010` | **Supabase** (Contentbeta stack) |
| `n8n.aneeverse.com` | `:5678` | **n8n** |
| `md.aneeverse.com` | `:6080` | **Obsidian** (noVNC) |
| `culturajewels.com` / `www` / `api.` | `:8000` / `:9000` | **Cultura Jewels** (Medusa) |

---

## 3. What each app is + disk + RAM

### Summary table

| App | What it is | Disk (approx) | RAM alone (approx) | Always-on impact |
|-----|------------|---------------|--------------------|------------------|
| **Huly** | Project/work platform (Docker: front, account, CockroachDB, Elasticsearch, Redpanda, MinIO, etc.) | **~15 GB** Docker data (compose files under `/opt/huly-selfhost` are tiny ~1 MB) | **2.5–4 GB** (Cockroach alone often ~0.7–1 GB) | High |
| **OpenClaw** | Bot gateway + workspace + sales UI/API | **~16 GB** (`/root/.openclaw`) | **~400–600 MB** | Medium |
| **Hermes** | Multi-agent system (**~14 profiles** + dashboard) | **~3.2 GB** (`/root/.hermes`) | **~150 MB × 14 ≈ 2–2.5 GB** | **Very high** |
| **Cultura** | Medusa store + jewelry image-gen bridge/UI | **~5.1 GB** (`/root/projects/cultura`) | **~300–500 MB** if healthy | Medium (backend has been crash-looping) |
| **Studio** | Contentbeta Next.js app | **~909 MB** (`/opt/contentbeta`) | **~70–150 MB** | Low–medium |
| **Supabase** | Kong / Auth / REST / Postgres for Studio | Files ~66 MB + data inside Docker | **~300–600 MB** | Medium |
| **n8n** | Workflow automation | **~5 MB** (`/root/.n8n`) | **~180 MB** | Low–medium |
| **Obsidian** | Web access to vault via noVNC | Web ~119 MB · vault ~0.4 MB | **~200–400 MB** | Medium |
| **Tooling / caches** | `/root/.local`, npm, etc. | **~6 GB** `.local` + caches | 0 when idle | Disk only |

### Cultura breakdown

| Path | Size |
|------|------|
| Cultura total | **5.1 GB** |
| `deploy/` (Medusa backend + frontend) | 4.2 GB |
| `jwel_img_gen_ui` | 745 MB |
| `jwel_img_gen_bridge` | 235 MB |

### Docker (includes Huly + Supabase)

| Type | Size (approx) |
|------|----------------|
| Images | ~13.5 GB |
| Volumes | ~3 GB |
| Containers | ~0.4 GB |
| **Total Docker data** | **~15 GB** under `/var/lib/docker` |

### Hermes agent profiles (examples seen running)

- `aneerequest_operator`
- `cb-vidproject`
- `img_compress`
- `jwelimggen`
- `kakashi_tech_cource`
- `leadgen` / `leadgen2`
- `meta_ads_agent`
- `second_brain`
- `seedance_video_gen`
- `ugc_video1`
- `usopp-ga-ads-av`
- (+ default gateway / dashboard)

---

## 4. Folder layout (organized under `/root/projects`)

```
/root/projects/
├── cultura/              Medusa deploy + jewelry image tools (real files)
├── hermes/               Hermes backups/scripts + symlink → /root/.hermes
├── app.aneeverse/        Huly notes + symlink → /opt/huly-selfhost
├── studio.aneeverse/     symlinks → /opt/contentbeta + supabase
├── md.aneeverse/         Obsidian vault (second-brain) + link to obsidian-web
├── bot.aneeverse/        symlink → /root/.openclaw
├── n8n.aneeverse/        symlink → /root/.n8n
├── _keys/                desktop auth key JSON files
├── _infra/               nginx backups
└── README.txt
```

**Live runtimes intentionally left in place (not moved):**

| Path | Why |
|------|-----|
| `/root/.openclaw` | OpenClaw + sales + automation depend on this path |
| `/root/.hermes` | Hermes runtime home |
| `/root/.n8n` | n8n data |
| `/root/.pm2` | PM2 process list |
| `/opt/huly-selfhost` | Huly compose |
| `/opt/contentbeta` | Studio app |
| `/var/lib/docker` | All container images + volumes |

---

## 5. Key services (systemd / PM2 / Docker)

### Systemd (examples)

- `nginx` — reverse proxy + TLS  
- `n8n`  
- `novino-gateway-proxy` — Huly ↔ OpenClaw bridge  
- `obsidian-web`  
- `sales1-next`, `sales-n8n-bridge`, `automation-api` — used by `bot.aneeverse.com/sales`  
- `jwel-img-gen-bridge`, `jwel-img-gen-ui` — Cultura jewelry tools  
- `pm2-root`, `redis`

### PM2

- `contentbeta` — Studio  
- `frontend` / `backend` — Cultura Medusa  

**Warning (at scan):** Cultura `backend` had **thousands of PM2 restarts** (unstable).

### Docker (main containers)

- **Huly:** `huly_v7-*` (front, account, transactor, cockroach, elastic, redpanda, minio, …)  
- **Supabase:** `contentbeta-kong`, `contentbeta-auth`, `contentbeta-rest`, `contentbeta-db`  

**Note:** `huly_v7-redpanda-1` often shows **unhealthy** because of a SASL healthcheck quirk; the broker itself can still be up (false alarm if Huly works).

---

## 6. Will “only Huly (Docker) + Hermes” run well?

| Setup | Verdict on this 8 GB / 2 vCPU box |
|-------|-----------------------------------|
| Huly + Hermes (**all ~14 agents**) | Runs, but **tight** — still heavy RAM/CPU |
| Huly + Hermes (**3–5** important profiles) | **Should feel good** |
| Huly only | Comfortable |
| Hermes only (few profiles) | Comfortable |
| Everything (current) | Overloaded / swap risk |

**Rough RAM if only Huly + full Hermes:** ~5.5–7 GB of 8 GB → little headroom.

**Recommendation:** Prefer Huly + a **reduced** Hermes set; start other apps (Cultura, Studio, n8n, OpenClaw, Obsidian) only when needed.

---

## 7. Backups — important

### Status: **no full restore kit for a wiped VPS**

| Data | Full backup? | What exists on disk |
|------|--------------|---------------------|
| Huly DB / workspaces | **No full dump found** | Scripts: `/opt/huly-selfhost/backup-create.sh` & `backup-restore.sh` — `backups/` folder mostly small **nginx/config** snippets (~32 KB), not DB |
| Cultura / Medusa | **No** | Live code only under `projects/cultura` |
| OpenClaw | **No full export** | Live `/root/.openclaw` (~16 GB) |
| Hermes | **Partial tiny** | `projects/hermes/hermes-*-backup*` (KB-size configs, not full agent data) |
| n8n | **No** | Live `/root/.n8n` |
| Obsidian vault | **No offsite** | Live `projects/md.aneeverse/second-brain` |
| nginx | Tiny | `projects/_infra/nginx-backups` |
| OS apt | Irrelevant for apps | `/var/backups` |
| **Hostinger snapshot** | **Check panel** | Not visible from inside the VM |

**If the VPS is wiped without an off-box copy or Hostinger snapshot, most application data is lost.**

---

## 8. Fresh-start guide (if rebuilding)

### Phase 0 — Before wipe (mandatory)

1. Take a **Hostinger VPS snapshot**.  
2. Copy **off the server** (PC / Drive / another host) at least:

   - `/root/.openclaw`  
   - `/root/.hermes`  
   - `/root/.n8n`  
   - `/root/projects/cultura`  
   - `/root/projects/md.aneeverse/second-brain`  
   - `/opt/contentbeta` + `/opt/contentbeta-supabase`  
   - Huly: run `backup-create.sh` **or** dump Docker volumes (Cockroach / MinIO)  
   - `/etc/nginx/sites-enabled` + `/etc/letsencrypt`  
   - `/root/projects/_keys` and all `.env` files  

### Phase 1 — Decide what returns on an 8 GB box

Suggested always-on:

- Huly  
- n8n (optional)  
- Hermes with **few** profiles **or** OpenClaw (not both at full power)  
- Cultura when store must be live  

### Phase 2 — Rebuild

1. Fresh Ubuntu → Docker → nginx → certbot  
2. Restore **one stack at a time**  
3. After each stack: check `free -h` and `uptime`  

### Phase 3 — DNS / TLS

Point same domains at the VPS IP; renew or restore certificates.

---

## 9. Known issues (at last scan)

1. **High load** when Hermes×14 + Huly + other apps run together.  
2. **Cultura Medusa backend** unstable (very high PM2 restart count).  
3. **Redpanda “unhealthy”** may be a healthcheck false positive.  
4. **No complete application backups** for disaster recovery yet.  
5. System may show **“restart required”** after package updates (Hostinger MOTD).

---

## 10. Quick command cheat sheet

```bash
# Health
uptime; free -h; df -h /

# Sites
ls /etc/nginx/sites-enabled/

# Docker
docker ps
docker system df

# PM2
pm2 list

# Hermes / OpenClaw
pgrep -af hermes_cli
pgrep -af 'openclaw.*gateway'

# Disk by app
du -sh /root/.openclaw /root/.hermes /root/projects/cultura /opt/contentbeta /var/lib/docker
```

---

## 11. Contact / ownership notes

- VPS used for Aneeverse production-style services (Huly, bots, Cultura, Studio, n8n, Obsidian).  
- Paths and sizes above are from a **live SSH inventory** on **19 Sep 2026**; they change as data grows.  
- For restore planning, treat **Hostinger snapshot + off-box copies** as the only real safety net until full app backups are scheduled.

---

*End of document.*
