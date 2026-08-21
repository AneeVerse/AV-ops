# AneeVerse Huly fork — full change history

This document records **everything we changed** from upstream [Huly / Hardcore Engineering `platform`](https://github.com/hcengineering/platform) for our internal ops workspace. It is the narrative companion to:

- [LOCAL-AND-DEPLOY.md](LOCAL-AND-DEPLOY.md) — day-to-day `local.cmd` / `prod-local.cmd` / `ship.cmd`
- [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md) — VPS layout, deploy stages, firewall

**Repo today:** [AneeVerse/AV-ops](https://github.com/AneeVerse/AV-ops)  
**Live site:** https://huly.aneeverse.com  
**Upstream base:** Huly self-host stack ~`v0.7.426` (`HULY_VERSION` on VPS)  
**Workspace:** `aneeverse`  
**Period covered:** 2026-08-18 → 2026-08-20 (all fork commits in this git history)

---

## 1. Why we forked

We run Huly as **internal company ops** (leads, clients, projects, issues, files), not as a public SaaS product.

Goals vs stock Huly:

| Need | Why stock Huly was not enough |
|------|-------------------------------|
| CRM-style **Clients** (like Leads, but for active accounts) | Upstream has Lead + Tracker + Contacts; no first-class Client funnel app |
| **Company** as a hub (projects + issues + files under one org) | Contacts orgs existed; Tracker projects were not linked |
| Match **AneeRequest** data model (companies, requests, tasks) | We needed import + `aneerequestId` keys for idempotent sync |
| Fast Windows workflow | Official self-host is Linux/VPS-heavy; we needed one-click local + ship |
| Ship UI without rebuilding the whole stack | Official images do not include our model; we patch live `model_tx` |

We keep credentials and SSH keys **off git**. Production secrets live on the Hostinger VPS (`/opt/huly-selfhost/huly_v7.conf`, `/root/huly-login.txt`).

---

## 2. What is upstream vs what is ours

### Upstream (unchanged intent)

- Rush monorepo, Tracker, Lead, Contacts, Drive, Chat, account, Cockroach, Docker self-host
- Official images: `hardcoreeng/front:v0.7.426` and related pods
- Core platform APIs, permissions, workspaces

### Ours (not in official images until we build/deploy)

1. **Lead UX** — one-step customer → lead wizard, My Leads polish, email channel icons  
2. **Tracker viewlets** — Issues **States** + **Dashboard** (same idea as Lead)  
3. **Company app** — sidebar app + `Project.company` + company Projects/Issues tabs  
4. **Client app** — `Client` / `ClientFunnel` model + My Clients UI (lives under Tracker plugins)  
5. **Company / project Drive** — folders on orgs & projects, optional Google Drive sync  
6. **AneeRequest import** — Supabase → Huly companies / projects / issues  
7. **Deploy & local tooling** — `local.cmd`, `prod-local.cmd`, `ship.cmd`, model SQL patches, GitHub Actions  
8. **Localhost login** — persist token + remember last email  
9. **Issue / nav polish** — scoping, no wrong auto-select, project labels with company, archive imported projects  

**Important platform rule:** custom **classes / apps / viewlets** are stored in the workspace **`model_tx`** DB. Official Docker images do not ship our model. Every environment (local Docker **and** production) needs the model patch scripts, not only a new front bundle.

---

## 3. Timeline (chronological)

Dates are commit dates in this repo (Aug 2026).

| Date | Commit | What we did | Why |
|------|--------|-------------|-----|
| 2026-08-18 | `9288ad3` | First docs + early custom patches (lead wizard, issue viewlets, deploy scripts, firewall helpers) | Capture how production was already set up so agents/people do not rediscover VPS by hand |
| 2026-08-18 | `069cb4f` | Full Huly tree into `AV-ops` + `local.cmd` / `ship.cmd` + ignore secrets | Own a fork we can change freely; one-command local UI and production front ship |
| 2026-08-18 | `4d5ad24` | One-step lead create, email icons, My Leads viewlets, less drag-handle UI | Faster lead intake for sales; toolbar closer to how we work |
| 2026-08-18 | `30891e1` | **Company** app: link Tracker projects/issues to Contacts orgs | Company as the ops hub (projects + issues under one customer org) |
| 2026-08-19 | `7190148` | Persist login token on localhost; prefill last email | Local webpack refresh was logging people out constantly |
| 2026-08-19 | `45f7280` | `local.cmd` → local Docker DB; add `prod-local.cmd` for live data; seed Client model on local start | Separate safe local data from production; still allow UI against live when needed |
| 2026-08-19 | `ec6f661` | **Client** model: classes, funnel type, statuses in Tracker | Mirror Lead for active clients; model must live in `model_tx` |
| 2026-08-19 | `bb4ce94` | **Client** UI: navigator, My Clients, create flow, presenters | Use the Client model in the product UI |
| 2026-08-19 | `5c6fd3e` | Drive folders on companies/projects + optional Google Drive sync | Files next to the company/project, aligned with AneeRequest folder tree |
| 2026-08-19 | `04efd28` | Funnel/project pickers so My Leads / My Issues / My Clients show stage tabs | StatesBar only works when a space is selected; auto-select first, allow clear |
| 2026-08-19 | `72abeeb` | Production `model-client` + `model-company-drive` deploy commands | Same patches as local must apply on live VPS |
| 2026-08-19 | `8b063b5` | AneeRequest sample import script | Bring real companies/projects from Supabase without duplicate rows |
| 2026-08-19 | `2e43df7` | Unify `ship.cmd` + GitHub Actions on `huly-deploy-production.sh all` | One deploy path; fewer “half-deployed” states |
| 2026-08-19 | `77d4271` | Fix Create Client spinner; harden model patch SQL generation | Create Client hung; fragile SQL broke patches |
| 2026-08-19 | `03b3368` | Fix Company model deploy wiping Client funnel sidebar | `model-company` cleared `navigatorModel.spaces` after `model-client` |
| 2026-08-19 | `f6eaffa` | Fix company Issues tab showing **all** tracker issues | Lost `$in` space filter when no project selected in SpaceSelector |
| 2026-08-19 | `ccf5d57` | Scope client Issues to company projects; stop auto-selecting unrelated spaces | Client Issues must not jump to random Tracker projects |
| 2026-08-20 | `7097fca` | All Tracker issues by default; label projects with company (+ identifier) | Ops need global issue view; duplicate project names were ambiguous |
| 2026-08-20 | `09af9ce` | Admins can archive imported company projects; backfill owners | Imported AneeRequest projects lacked owners → no Archive/Delete |
| 2026-08-20 | `cf679a9` | Clean My Clients list; restore Client funnel spaces in sidebar | Leftover company nav on list pages; ECOM funnel needed to open like Lead |

---

## 4. Feature areas (detail)

### 4.1 Lead wizard & Lead UX

**Why:** Creating a lead required too many steps; we wanted Funnel **+ Lead** → create customer → **Next** → lead with customer already selected.

**What changed (vs upstream):**

- `plugins/lead-resources/.../CreateCustomer.svelte`, `CreateLead.svelte` — wizard flow  
- Email / channel icons and My Leads viewlet tweaks  
- Column/sidebar reorder kept on the row (no six-dot handle clutter)  
- Later: funnel picker on My Leads so stage tabs appear when a funnel is selected  

**Deploy:** Frontend bundle only (`ship.cmd` / `front` stage).

---

### 4.2 Tracker Issues — States + Dashboard

**Why:** Leads already had States / Dashboard-style views; Issues should match for status board + dashboard.

**What changed:**

- Model: `models/tracker/src/viewlets.ts`, `plugin.ts`, `migration.ts`  
- UI order: `plugins/view-resources/.../ViewletSelector.svelte` → **States → List → Board → Dashboard**  
- Live patch: `scripts/huly-insert-issue-viewlets.sh`  

**Deploy:** Model patch (`model-tracker`) and/or migration on upgrade; front for toolbar order.

---

### 4.3 Company app

**Why:** Ops think in **companies**, not only loose Tracker projects. We needed:

- Left-bar **Company** application listing Contacts organizations  
- Open company → **Projects** / **Issues** (and later **Files**)  
- Tracker create/edit project → optional **Company** field (`Project.company`)

**Key files:**

- Model: `models/tracker` (Company application, `Project.company`)  
- UI: `plugins/tracker-resources/.../company/*`, project create/edit  
- Contacts: org panel / logo / full-width company pages  
- Patch: `scripts/huly-insert-company-app.sh`  

**Deploy:** Front **and** `model-company`. `ship.cmd` alone does **not** create the sidebar tab.

**Bug we hit:** Running company patch after Client patch wiped Client funnel spaces in the navigator (`03b3368`). Company insert must preserve Client `navigatorModel.spaces`.

---

### 4.4 Client app (fork-specific CRM)

**Why:** Leads = pipeline. We needed a parallel **Clients** funnel for active accounts (Kanban by status, My Clients, create client under a funnel like Lead).

**Architecture choice:** Implement Client **inside Tracker** (model + `plugins/tracker-resources/.../client/*`), not a separate top-level plugin package for the product UI. (Upstream `plugins/client` is the platform client connection package — different meaning.)

**Model pieces:**

- Classes: `Client`, `ClientFunnel`  
- Default funnel + statuses (Lead-like space type)  
- Application navigator: My Clients, funnels in sidebar  
- Files: `models/tracker/src/client.ts`, `clientSpaceType.ts`, types/plugin updates  

**UI pieces:**

- `MyClients.svelte`, `CreateClient.svelte`, `CreateClientFunnel.svelte`  
- Presenters, Kanban card, company-linked Issues/Files helpers  
- `clientUtils.ts`  

**Local + prod patching:**

- Local start: `scripts/huly-local-apply-fork-model.mjs` (seeded by `local.cmd`)  
- Production: generate SQL → `scripts/huly-insert-client-model.sh` via `model-client`  

**Deploy:** Front **and** `model-client`.

**Follow-up fixes:**

- Create Client spinner hang  
- Issues scoped to that company’s projects only  
- Hide company nav leftovers on My Clients list  
- Restore funnel list (e.g. ECOM) so opening a funnel shows client Kanban  

---

### 4.5 Drive on companies & projects (+ Google Drive)

**Why:** Files belong next to the company/project (AneeRequest-style tree), not only in a generic Drive space.

**What changed:**

- `Organization.driveFolder`, `aneerequestId` on org / project / drive types  
- UI: `CompanyDriveFiles.svelte`, `ProjectDriveFiles.svelte`  
- Server: `server-plugins/drive-resources/src/companyDrive.ts` bootstrap trigger  
- Optional: `googleSync.ts` for Google Drive sync  
- Patch: `scripts/huly-insert-company-drive.sh`  

**Deploy:** Front + `model-company-drive` (triggers may also need server image / upgrade depending on what is running on VPS).

---

### 4.6 Space pickers (My Leads / My Issues / My Clients)

**Why:** Status / States UI only renders when a **space** (funnel or project) is selected. Global “All” views had no stage tabs.

**What changed:** Auto-select first space where needed; allow clearing; StatusTable / IssuesView respect explicit space filters.

---

### 4.7 Tracker issue list behavior

**Why:** Day-to-day ops want:

1. **All issues** across projects by default (not forced into one project)  
2. Clear project names when many companies share names like “Website”  
3. Company / client issue tabs must **never** show unrelated Tracker issues  

**What changed:**

- Stop auto-selecting a project on All issues / My issues  
- Present projects as `Name · Company · IDENT` (disambiguation)  
- Preserve `space: { $in: [...] }` when SpaceSelector has no single project  

---

### 4.8 AneeRequest → Huly import

**Why:** Migrate / sync real work from AneeRequest (Supabase) into this Huly workspace without duplicates.

**Script:** `scripts/aneerequest-sample-import.mjs`

- Reads AneeRequest clients / requests / tasks (default status filter: **Ongoing**)  
- Creates/updates Contacts organizations, Tracker projects, issues  
- Uses `aneerequestId` fields for **idempotent** reruns  
- `--backfill-members` so admins can archive/delete imported projects (owners/members)  

**Env:** Supabase URL + service role; Huly user/password/workspace; optional login file. Secrets stay local / on VPS — not in git.

---

### 4.9 Localhost login persistence

**Why:** Webpack/dev refresh cleared session; typing email every time was painful.

**What changed:** Persist token for localhost; remember `#login.lastEmail` on the login form (still editable).

---

### 4.10 Local run & production ship tooling

**Why:** Official docs assume Linux self-host rebuilds. We develop on Windows and patch a live VPS.

| Command | Purpose |
|---------|---------|
| `local.cmd` | Local Docker stack + UI on **8080**; seeds Client model |
| `prod-local.cmd` | SSH tunnel + UI against **live** aneeverse data |
| `ship.cmd` | Build front, upload, restart front + docker nginx (via unified orchestrator) |

**Orchestrator:** `scripts/huly-deploy-production.sh`

| Stage | What it applies |
|-------|-----------------|
| `front` | Custom webpack dist → `huly_v7-front-1`, commit image `huly-front-custom:lead-wizard` |
| `model-tracker` | Issue States/Dashboard viewlets |
| `model-client` | Client classes / funnel / navigator |
| `model-company` | Company app + `Project.company` |
| `model-company-drive` | Drive folder fields on company/project |
| `model-request` | Request lifecycle fields on Project |
| `model-project-chat` | Project ActivityExtension + Chat nav (reuses ChatMessage) |
| `verify` | Curl live site + check front `index.html` |
| `all` | Above in order (skip flags available) |

Also: `.github/workflows/deploy-production.yml` with secrets `HULY_VPS`, `HULY_SSH_KEY_B64`.

**VPS (summary):** Hostinger `148.230.67.132`, stack `/opt/huly-selfhost`, compose project `huly_v7`, public nginx → `127.0.0.1:8087`. Do **not** put Huly on the DigitalOcean box used for horeca1.

---

## 5. Map: original Huly → our product concepts

```
Upstream Huly              Our internal meaning
─────────────────────      ──────────────────────────────────────────
Lead / Funnel              Sales pipeline (kept, UX improved)
Contacts Organization      “Company” — hub for projects, issues, files
Tracker Project            Delivery project, usually linked to a Company
Tracker Issue              Task / work item (global All issues default)
(new) Client / ClientFunnel Active-client CRM (Lead-like, separate app)
Drive                      Plus company/project folders (+ optional GDrive)
(none)                     AneeRequest Supabase import + aneerequestId
```

---

## 6. Key file index (custom / heavily touched)

### Product UI & model

| Area | Paths |
|------|--------|
| Lead wizard | `plugins/lead-resources/src/components/CreateCustomer.svelte`, `CreateLead.svelte`, `MyLeads.svelte` |
| Viewlet order | `plugins/view-resources/src/components/ViewletSelector.svelte` |
| Tracker viewlets / migration | `models/tracker/src/viewlets.ts`, `migration.ts`, `plugin.ts` |
| Client model | `models/tracker/src/client.ts`, `clientSpaceType.ts`, `types.ts` |
| Client UI | `plugins/tracker-resources/src/components/client/*`, `clientUtils.ts` |
| Company UI | `plugins/tracker-resources/src/components/company/*` |
| Issues scoping | `plugins/tracker-resources/src/components/issues/IssuesView.svelte`, `Issues.svelte` |
| Drive company sync | `server-plugins/drive-resources/src/companyDrive.ts`, `googleSync.ts` |
| Contact/Drive fields | `models/contact/src/index.ts`, `models/drive/src/index.ts`, `plugins/contact/src/index.ts` |

### Ops scripts

| Script | Role |
|--------|------|
| `huly-deploy-production.sh` | Unified production stages |
| `huly-deploy-front.sh` | Front tarball → container |
| `huly-insert-issue-viewlets.sh` | Tracker States/Dashboard |
| `huly-insert-company-app.sh` | Company app model |
| `huly-insert-client-model.sh` | Client model_tx |
| `huly-insert-company-drive.sh` | Drive fields |
| `huly-insert-request-fields.sh` | Request lifecycle on Project |
| `huly-insert-project-chat.sh` | Project chat ActivityExtension + nav |
| `huly-local-apply-fork-model.mjs` | Local (and SQL dump) Client model |
| `aneerequest-sample-import.mjs` | Supabase → Huly |
| `aneeverse-ship.ps1` / `aneeverse-local.ps1` | Windows wrappers |
| `install-huly-vps.sh`, `huly-ssl.sh`, firewall helpers | First install / connectivity |

---

## 7. Deploy rules (do not forget)

1. **UI-only** (`.svelte` / front TS) → `front` / `ship.cmd`  
2. **New classes / apps / viewlets** → matching `model-*` stage; official `upgrade-workspace` on stock images will **not** include our fork model  
3. After front replace → restart **front and** `huly_v7-nginx-1` (stale upstream → 502)  
4. Hard-refresh browser (Ctrl+F5)  
5. Never commit `.env`, SSH keys, `huly_v7.conf`, login files, `*.tgz`  
6. Prefer `ship.cmd` / `huly-deploy-production.sh all` over ad-hoc half steps  
7. Order matters: Client model before Company patch that touches navigator (or ensure Company patch preserves Client spaces)

---

## 8. What we deliberately did *not* change

- We did not replace Huly with a new product — we **extend** it.  
- We did not fork every microservice image for every change; many model changes are **SQL/model_tx patches** on the running stack.  
- We did not put production secrets in this repo.  
- We did not use the DigitalOcean horeca1 server for Huly (capacity / separation).

---

## 9. How to extend this doc

When you add a fork feature:

1. Add a row to the **Timeline** with commit hash, date, what, why  
2. Add or update a subsection under **Feature areas**  
3. Note deploy stage: `front` / `model-client` / `model-company` / `model-company-drive` / `model-tracker`  
4. Update [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md) if VPS steps change  

---

## 10. Quick “start here” for a new engineer

1. Read this file for **why** and **what**  
2. Read [LOCAL-AND-DEPLOY.md](LOCAL-AND-DEPLOY.md) for daily commands  
3. Read [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md) before touching production  
4. `rush install --bypass-policy` once  
5. `local.cmd` for safe UI work; `prod-local.cmd` only when you must hit live data  
6. Ship with `ship.cmd` (or Actions **Deploy Production**) and verify https://huly.aneeverse.com  

---

*Generated from git history of AneeVerse/AV-ops (platform-develop) as of 2026-08-21. Upstream Huly remains Hardcore Engineering’s open-source platform; this document describes only AneeVerse customizations.*
