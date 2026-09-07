# AneeVerse Huly fork — full change history

This document records **everything we changed** from upstream [Huly / Hardcore Engineering `platform`](https://github.com/hcengineering/platform) for our internal ops workspace. It is the narrative companion to:

- [LOCAL-AND-DEPLOY.md](LOCAL-AND-DEPLOY.md) — day-to-day `local.cmd` / `prod-local.cmd` / `ship.cmd`
- [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md) — VPS layout, deploy stages, firewall

**Repo today:** [AneeVerse/AV-ops](https://github.com/AneeVerse/AV-ops)  
**Live site:** https://app.aneeverse.com  
**Upstream base:** Huly self-host stack ~`v0.7.426` (`HULY_VERSION` on VPS)  
**Workspace:** `aneeverse`  
**Period covered:** 2026-08-18 → 2026-08-20 (all fork commits in this git history)

---

## 1. Why we forked

We run Huly as **internal company ops** (leads, clients, projects, issues, files), not as a public SaaS product.

Goals vs stock Huly:

| Need | Why stock Huly was not enough |
|------|-------------------------------|
| CRM-style **Clients** (removed) | Was a Lead-like ClientFunnel app; dropped — use Company + Lead instead |
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
4. **Client app — removed** — `Client` / `ClientFunnel` / My Clients taken out of source and production (`huly-remove-client-crm.sh`)  
5. **Company / project Drive** — folders on orgs & projects, optional Google Drive sync  
6. **AneeRequest import** — Supabase → Huly companies / projects / issues  
7. **Deploy & local tooling** — `local.cmd`, `prod-local.cmd`, `ship.cmd`, model SQL patches, GitHub Actions  
8. **Localhost login** — persist token + remember last email  
9. **Issue / nav polish** — scoping, no wrong auto-select, project labels with company, archive imported projects  
10. **API tokens** — personal tokens with an optional **No expiry** option, in the UI and the account service  
11. **Novino chat** — native right-sidebar workbench chat talking to OpenClaw agent `novino` via `/_novino`
12. **Tools directory** — left-rail launcher for hosted Aneeverse apps (ERP, n8n, OpenClaw, Studio, …)  
13. **Admin-provisioned employees** — Contacts → Employees creates a login (email + password), no public signup; admin can delete the row

**Important platform rule:** custom **classes / apps / viewlets** are stored in the workspace **`model_tx`** DB. Official Docker images do not ship our model. Every environment (local Docker **and** production) needs the model patch scripts, not only a new front bundle.

**Second platform rule:** that trick only works for the *model*. Service code is a compiled bundle
inside its image, so `server/account` changes need an image we build — see
[4.11](#411-api-tokens--the-custom-account-image).

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
| 2026-08-26 | (this change) | Remove Client CRM from product + production DB; Delete on archived Lead funnels | Client funnels (ECOM, hb) were leftover API-visible spaces; archived Lead funnels could not be deleted |
| 2026-08-26 | (this change) | Bottom-right **Novino** chat panel in the workbench | Talk to OpenClaw agent `novino` from Aneeverse; tasks use a Huly API token |
| 2026-08-26 | (this change) | Planner Join with Google Meet; custom calendar image; events sync hangoutLink; primary calendar prefers Google | Stock calendar dropped Meet links and new events stayed on HULY; Create meeting required a Huly room |
| 2026-08-26 | (this change) | Planner ↔ Google two-way visibility: owner on participants, remap HULY events to Google, Join after hangoutLink | Google events were stored but hidden (ACL / wrong person); Planner writes never left HULY so Join stayed a placeholder |
| 2026-08-27 | (this change) | Left-rail **Tools** directory of hosted Aneeverse apps | Same launcher as ContentBeta `/tba`, inside Huly with Huly UI |
| 2026-08-27 | (this change) | Move **Novino** into the right widget sidebar (exclusive with Calendar) | Same drawer chrome as Calendar; no floating FAB overlay |
| 2026-08-27 | (this change) | Open Novino chat without a second username/password | Anyone already in Aneeverse can use the widget; chat-control no longer gates the UI |
| 2026-08-27 | (this change) | Native Novino chat UI (no chat.aneeverse.com iframe) + `/_novino` gateway proxy | Same Huly theme as the rest of the workbench; gateway token stays on the VPS |
| 2026-09-01 | (this change) | Admin-create employees: password login, welcome email, row delete, no public signup | Invite/join was the only add path; Kick only deactivated; production login preferred OTP |

---

## 4. Feature areas (detail)

### 4.1 Lead wizard & Lead UX

**Why:** Creating a lead required too many steps; we wanted Funnel **+ Lead** → create customer → **Next** → lead with customer already selected.

**What changed (vs upstream):**

- `plugins/lead-resources/.../CreateCustomer.svelte`, `CreateLead.svelte` — wizard flow  
- Email / channel icons and My Leads viewlet tweaks  
- Column/sidebar reorder kept on the row (no six-dot handle clutter)  
- Later: funnel picker on My Leads so stage tabs appear when a funnel is selected  
- Lead funnels match Tracker spaces: **Archive** when active, real **Delete** when already archived  

**Deploy:** Frontend bundle **and** `model` (the Delete action is a model doc).

---

### 4.13 Novino chat (OpenClaw)

**Why:** Talk to the Novino OpenClaw agent from inside Aneeverse (same right widget sidebar as Calendar), same bot as Discord `#di_novino` and https://chat.aneeverse.com. Tasks it runs against Huly must use a **personal API token**, not raw Cockroach SQL.

**What changed:** `NovinoChat` is a Fixed workbench widget injected in `plugins/workbench-resources` (not `model_tx`). The aside is a native Huly chat panel (Header, Scroller, composer) talking same-origin to `/_novino`. Host nginx forwards that path to `novino-gateway-proxy` on the VPS, which speaks WebSocket to OpenClaw (`ws://127.0.0.1:18789`). Agent is hardcoded `novino`; `chat.send` uses `deliver: false` so workbench chat does not fan out to Discord. The gateway token never reaches the browser. Opening Novino replaces Calendar (and vice versa). Tools directory can still open https://chat.aneeverse.com in a tab; that site is not the workbench widget. Lead list/create/update/delete goes through the Huly API CLI in Novino’s workspace, not memory search.

**Deploy:** Frontend bundle **and** VPS `scripts/huly-enable-novino-proxy.sh` (systemd proxy + host nginx `/_novino`). No `model_tx`. `prod-local.cmd` webpack proxies `/_novino` to https://app.aneeverse.com (inner docker nginx cannot reach the host proxy).

---

### 4.14 Tools directory

**Why:** Hosted Aneeverse apps (ERP, CRM, n8n, OpenClaw, ContentBeta Studio, …) lived only as the ContentBeta `/tba` page. Ops needed the same launcher inside Huly.

**What changed:** New `tools` plugin (types + catalog, assets, resources, model). Left-rail **Tools** icon (`alias: tools`, `order: 250`) opens a search + category card grid. Cards open the catalog URL in a new tab. Catalog is hardcoded in `plugins/tools/src/catalog.ts` (same sites as ContentBeta, plus Aneeverse marked “This app”).

**Deploy:** Frontend bundle **and** `model` (the Application doc lives in `model_tx`).

---

### 4.15 Admin-provisioned employees (login, delete, no signup)

**Why:** Contacts → Employees only sent an invite. The person had to open a join/signup page and pick their own password. Delete was blocked (`IgnoreActions` on Employee); only Kick deactivated them. Production login preferred OTP when mail was configured, so email + password was not the default.

**What the admin and employee see:**

- **Add Employee:** first name, last name, email, optional phone, required password, workspace role (default User), avatar. Submit creates the account and the contact row — no join page.
- **Welcome email:** login URL, email, the password admin set (new accounts only), and a forgot-password link.
- **Login:** email + password. Forgot password is the existing `/login/password` → email link → `/login/recovery` flow.
- **Delete:** confirm, then leave workspace + remove the Person so they disappear from the list (not merely Inactive). Kick stays as the softer deactivate. Generic `view.action.Delete` stays ignored so a raw doc delete cannot skip `leaveWorkspace`. Requires **Maintainer+** workspace role (same as removing another member from the workspace).

**What changed:**

- `server/account` — `provisionWorkspaceUser` RPC: confirmed `signUpByEmail`, `assignWorkspace`, welcome email. Existing accounts are assigned without overwriting their password. Same permission check as `sendInvite`.
- `foundations/core/packages/account-client` — client method for that RPC.
- `CreateEmployee.svelte` — password + phone fields; calls `provisionWorkspaceUser` instead of `ensurePerson` + `sendInvite`.
- `deleteEmployee` + `EmployeeDeletePresenter` — visible row trash; model action `contact.action.DeleteEmployee`.
- Login: `DISABLE_SIGNUP=true` on aneeverse front + account (compose env via deploy scripts). Password form is the default; Sign up and Login as guest are hidden. `config-aneeverse.json` has the flag for prod-local webpack.

**Deploy:** custom **account** image (`account.cmd` locally, account stage in `deploy.cmd`) **and** front **and** `model_tx` (the Delete action and table column are model docs).

---

### 4.16 Contacts login UX (all tabs, visible password, reset from detail)

**Why:** Employee create had a masked password with no show/hide toggle; Guest/Person still used invite-only or CRM-only flows; admins could not set or reset another user's password after create.

**What changed:**

- Shared `PasswordEditBox` + `LoginCredentialsFields`; `provisionContactLogin` helper.
- **Employee / Guest / Person create:** email + password provisioning (`provisionWorkspaceUser`). Person tab has optional **Platform login** toggle (off = CRM-only).
- **Company members:** **Add person with login** on the Members section (`CreatePersonWithLogin` popup).
- **Person detail (`EditPerson`):** `ContactLoginPanel` for Maintainer+ — set password or send reset email when `personUuid` is set.
- **Account RPCs:** `setWorkspaceUserPassword`, `sendWorkspaceUserPasswordReset` (Maintainer+, target must be workspace member).
- Re-provisioning an existing account now applies the password entered by the admin and clears failed-login lockout state; before this fix the API silently kept the old password.
- Admin password changes are limited to lower-role members (a Maintainer cannot replace an Owner/Maintainer password).
- Forgot-password links expire after one hour and resetting or setting a password clears password lockout state.
- Welcome emails include the login and recovery links but never include a plaintext password.
- **Context menu:** **Send reset link** for provisioned active users; **Resend invite** hidden when `personUuid` is set (legacy invite-only inactive users only).

**Deploy:** custom **account** image **and** front **and** `model_tx` (SendResetLink action).

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

**Deploy:** Front **and** `model` (Company lives in `models/tracker`).

---

### 4.4 Client app (removed)

**Removed 2026-08-26.** The Client / ClientFunnel / My Clients CRM is gone from source. Leftover production classes and spaces (`ECOM`, `hb`, and their client docs) are deleted by `scripts/huly-remove-client-crm.sh`. Use **Company** + **Lead** instead. Archived Lead funnels can be deleted (same as archived Tracker projects).

The old files (`models/tracker/src/client.ts`, `plugins/tracker-resources/.../client/*`, `huly-insert-client-model.sh`) are no longer in the tree.

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

### 4.6 Space pickers (My Leads / My Issues)

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
| `local.cmd` | Local Docker stack + UI on **8080** |
| `prod-local.cmd` | SSH tunnel + UI against **live** aneeverse data |
| `ship.cmd` | Build front, upload, restart front + docker nginx (via unified orchestrator) |

**Orchestrator:** `scripts/huly-deploy-production.sh`

| Stage | What it applies |
|-------|-----------------|
| `front` | Custom webpack dist → `huly_v7-front-1`, commit image `huly-front-custom:lead-wizard` |
| `model` | Diff `models/**` vs image model.json → `model_tx` |
| `model-company` | Company app + `Project.company` (legacy named stage; now covered by `model`) |
| `model-company-drive` | Drive folder fields on company/project |
| `model-request` | Request lifecycle fields on Project |
| `model-project-chat` | Project ActivityExtension + Chat nav (reuses ChatMessage) |
| `verify` | Curl live site + check front `index.html` |
| `all` | Above in order (skip flags available) |

Also: `.github/workflows/deploy-production.yml` with secrets `HULY_VPS`, `HULY_SSH_KEY_B64`.

**VPS (summary):** Hostinger `148.230.67.132`, stack `/opt/huly-selfhost`, compose project `huly_v7`, public nginx → `127.0.0.1:8087`. Do **not** put Huly on the DigitalOcean box used for horeca1.

---

### 4.11 API tokens & the custom account image

**Why:** Settings → API Tokens existed in our source but failed in every environment. The reason is
structural, not a bug in the page: stock `hardcoreeng/account:v0.7.426` contains **zero** occurrences
of `createApiToken`. The endpoints are fork code, and a service bundle cannot be patched from the
database the way `model_tx` patches the model. So the feature could not work until we ran our own
account image.

**What changed:**

- `server/account/src/operations.ts` — `expiryDays: 0` means "never", stored as `expiresOn: -1`
  (the sentinel invites already use) and signed **without** an `exp` claim.
- `server/account/src/utils.ts` — the per-request expiry check treats `expiresOn < 0` as valid.
  Revocation still wins, and is checked first.
- `ApiTokenCreatePopup.svelte` / `ApiTokens.svelte` — a **No expiry** option, a "Never" cell in the
  Expires column, and the underlying server error printed under the generic failure message.
- `scripts/huly-build-account.sh` + `account.cmd` — build `huly-account-custom`, refusing to produce
  an image whose bundle lacks `createApiToken`.
- `scripts/huly-deploy-account.sh` + the `account` stage in the orchestrator — ship it to production
  as a thin layer on the stock image, verify it answers, roll back if it does not.

**Deploy type:** custom account image, shipped by `deploy.cmd` before the front.

---

### 4.12 Integrations page

**Why:** The page rendered its header and nothing else. A `dev/tool configure --disable` run had left
`TxUpdateDoc` rows in `model_tx` disabling gmail, telegram, calendar and github (among others), and
a disabled plugin's transactions are filtered out of the client model — which removes every
`setting:class:IntegrationType` the page lists.

**What changed:** `scripts/huly-enable-integrations.sql` writes enable-rows for those four plugins,
timestamped after both the bundled model and the fork patch so they win, under a `pi-` id prefix so
`huly-model-patch.mjs` does not retire them. `local.cmd` applies it on every start.

**Connect UX (2026-08-27):** After Google OAuth the Integrations list now refreshes itself (popup
close / `postMessage` / `BroadcastChannel` / window focus) instead of waiting for a manual reload.
The extra Calendar card from `allowMultiple` is labeled **Connect another account** so it is not
mistaken for a second unconnected Calendar. Google’s primary calendar (named after the email) is
no longer listed under the email row. OAuth uses `prompt: select_account consent` so Google shows
the account picker. Personal Gmail still fails with **Error 403: org_internal** until the GCP
project `aneeverse-cal-760101` OAuth consent **User type** is changed from Internal to External
(Internal = Google Workspace `@aneeverse.com` only).

**Gmail / Telegram / GitHub:** The cards are **on** (plugins re-enabled). They stay **Available**
until someone Connects them. Production only runs the **calendar** pod — there is no gmail,
telegram, or github service in `compose.override.yml`, so those Connect buttons cannot complete
until those backends are deployed and given OAuth/bot credentials.

---

## 5. Map: original Huly → our product concepts

```
Upstream Huly              Our internal meaning
─────────────────────      ──────────────────────────────────────────
Lead / Funnel              Sales pipeline (kept, UX improved)
Contacts Organization      “Company” — hub for projects, issues, files
Tracker Project            Delivery project, usually linked to a Company
Tracker Issue              Task / work item (global All issues default)
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
| `huly-remove-client-crm.sh` | Delete leftover Client CRM spaces + model_tx |
| `huly-insert-company-drive.sh` | Drive fields |
| `huly-insert-request-fields.sh` | Request lifecycle on Project |
| `huly-insert-project-chat.sh` | Project chat ActivityExtension + nav |
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
3. Note deploy stage: `front` / `model` / `model-company` / `model-company-drive`  
4. Update [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md) if VPS steps change  

---

## 10. Quick “start here” for a new engineer

1. Read this file for **why** and **what**  
2. Read [LOCAL-AND-DEPLOY.md](LOCAL-AND-DEPLOY.md) for daily commands  
3. Read [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md) before touching production  
4. `rush install --bypass-policy` once  
5. `local.cmd` for safe UI work; `prod-local.cmd` only when you must hit live data  
6. Ship with `ship.cmd` (or Actions **Deploy Production**) and verify https://app.aneeverse.com  

---

*Generated from git history of AneeVerse/AV-ops (platform-develop) as of 2026-08-21. Upstream Huly remains Hardcore Engineering’s open-source platform; this document describes only AneeVerse customizations.*
