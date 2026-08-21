# Phase 0 / 0C — Engineering baseline (Employee work)

**Date:** 2026-08-21  
**Repo:** AneeVerse/AV-ops (`E:\Projects\platform-develop`)  
**Scope:** Audit + local boot + Playwright MCP smoke. **No feature code yet.**

---

## 1. Git

| Item | Value |
|------|--------|
| Branch | `master` (tracks `origin/master`) |
| HEAD | `cf679a9` — Keep Client list pages clean and restore funnel spaces |
| Remote | `https://github.com/AneeVerse/AV-ops.git` |
| Dirty | Docs from fork-history work (`AGENTS.md`, deploy docs, `ANEEVERSE-FORK-CHANGES.md`) + temp smoke scripts/screenshots under `scripts/_tmp-*` |
| Secrets in tree | None found; `.env`, `huly_v7.conf`, SSH keys, `*.tgz` are gitignored |

**Note:** Unrelated dirty docs/tmp smoke assets must **not** be mixed into the Employee commit.

---

## 2. Huly / upstream baseline

| Item | Value |
|------|--------|
| Connected server (local) | **0.7.426** (console: `Connected to server: 0.7.426`) |
| Model version (local) | **0.7.426** |
| Production doc | `v0.7.426` / custom front `huly-front-custom:lead-wizard` |

---

## 3. Tooling

| Tool | Status |
|------|--------|
| Node | `v24.18.0` (Rush warns; supported range `>=20 <25`; `.nvmrc` says `v22`) |
| npm | `11.16.0` |
| Rush | `5.158.1` / pnpm `10.15.1` |
| `common/temp` + `dev/prod` deps | Present |
| Docker Desktop | Running (Engine 29.6.2); was empty before `local.cmd` |
| Git Bash | Required by local webpack scripts |

---

## 4. Deploy / local commands (verified present)

- `local.cmd` → `scripts/huly-local-stack.ps1` (Docker + Client model seed + webpack **8080**)
- `prod-local.cmd` → tunnel to production (do **not** use for Employee feature work)
- `ship.cmd` / `scripts/huly-deploy-production.sh` (`front`, `model-*`, `all`)
- Model patches: `huly-insert-*.sh`, `huly-local-apply-fork-model.mjs`
- Actions: `.github/workflows/deploy-production.yml`

**Isolation:** `local.cmd` = local Docker DB (`user1` / `1234`, workspace `local-ws`). Not production.

---

## 5. Playwright MCP

| Item | Status |
|------|--------|
| Server | `user-playwright` — **ready** |
| Tools | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_wait_for`, `browser_console_messages`, etc. |
| Fake config? | **No** — real Cursor MCP server, not invented |

---

## 6. Local boot (Phase 0C)

| Check | Result |
|-------|--------|
| Docker compose up | OK (`dev-cockroach-1`, account, transactor, …) |
| Client model seed | OK — *“Client model already present, transactor left running”* (idempotent skip) |
| Webpack | Compiled; UI on `http://localhost:8080` |
| Login page | Loads |
| Login `user1` / `1234` | Works → Select workspace |
| Workspace `local-ws` | Loads; role **OWNER** |
| Sidebar / Tracker / Issues | OK (`…/tracker/…/issues`) |
| Lead / Company / Contacts via hard `page.goto` | **Session dropped → login** (see known issues) |
| Drive | Not fully exercised (same navigation risk) |
| Console | Non-blocking: `huly.local` DNS failures (analytics `4017`, hulypulse `8099`); many Svelte unknown-prop warnings; slow `findAll` warnings |

---

## 7. Phase 0B — local speed (recommended; minimal change)

Already good:

- Docker containers reused (`up -d`)
- Client model patch **skips** when rows present
- Webpack HMR after first compile

Recommended daily workflow:

1. Docker Desktop running  
2. `.\local.cmd`  
3. Wait for “Local DB. Log in as user1 / 1234” + webpack compile  
4. Open `http://localhost:8080` → `user1` / `1234` → `local-ws`  
5. Develop with HMR; avoid full multi-app hard reloads until token persistence is confirmed  
6. Ctrl+C stops webpack; containers can stay up for faster next start  

**Safe future opts (not required for Employee):** prefer Node 22 for Rush; map `huly.local` or disable pulse/analytics in local config to quiet console errors.

**No risky architectural speed changes made in this phase.**

---

## 8. Known pre-existing issues (do not mix into Employee)

1. Hard navigation to `/workbench/local-ws/company` or `/contact` logged the session out in Playwright (possible localhost token/cookie persistence gap). In-SPA Tracker load works.  
2. `ERR_NAME_NOT_RESOLVED` for `huly.local` services — local config points at hostnames not in Windows hosts.  
3. Working tree has prior docs + `_tmp-smoke` artifacts unrelated to Employee.

---

## 9. Go / no-go for Employee implementation

**GO** for V1 Add Employee on local:

- Auth, workspace, Tracker, Employee/Account stack available  
- Invite APIs exist in account service  
- Playwright MCP available for later E2E  

**Constraints:** UI-only V1 expected (reuse `sendInvite` + existing Employee); **no** model stage unless proven necessary; keep Company off V1.
