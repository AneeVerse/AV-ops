# Huly production deploy guide (aneeverse)

This document describes **how this fork is deployed today** so the next person or agent does not start from scratch.

**Day-to-day:** run `local.cmd` (local Docker) / `prod-local.cmd` (live data) or `deploy.cmd` (build, deploy, smoke-test). See [LOCAL-AND-DEPLOY.md](LOCAL-AND-DEPLOY.md).

**Full fork change log (features + why vs upstream):** [ANEEVERSE-FORK-CHANGES.md](ANEEVERSE-FORK-CHANGES.md).

## Production at a glance

| Item | Value |
|------|--------|
| Live URL | https://app.aneeverse.com |
| VPS (Hostinger) | `148.230.67.132` — hostname `srv1474915` |
| SSH | `ssh -i ~/.ssh/id_ed25519 root@148.230.67.132` |
| Huly stack path | `/opt/huly-selfhost` |
| Compose project | `huly_v7` (containers `huly_v7-*`) |
| Docker nginx (internal) | `127.0.0.1:8087` → container `huly_v7-nginx-1` |
| Host nginx (TLS) | `/etc/nginx/sites-available/app.aneeverse.com` |
| SSL | Let's Encrypt `/etc/letsencrypt/live/app.aneeverse.com/` |
| DNS | `app.aneeverse.com` A → `148.230.67.132` (Hostinger DNS zone `aneeverse.com`) |
| Version | `v0.7.426` (`HULY_VERSION` in `huly_v7.conf`) |
| Custom front image | `huly-front-custom:lead-wizard` (pinned in `compose.override.yml`) |
| Custom account image | `huly-account-custom:<sha>-<ts>` (pinned via `ACCOUNT_IMAGE` in `huly_v7.conf`) |

**Do not deploy Huly on** DigitalOcean `64.227.187.210` — that server runs horeca1 prod and is full.

**Hostname history (2026-08-24):** Huly moved from `huly.aneeverse.com` to `app.aneeverse.com`. The old
name is fully retired — DNS record, nginx vhost and Let's Encrypt cert were all deleted, so it no longer
resolves. `app.aneeverse.com` previously served a different app, which now lives on **`apps.aneeverse.com`**
(Vercel project `aneerequest`, team `aneeverses-projects-c3e1b973`) — do not point `apps` at this VPS.

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
- **Deploy type:** Model docs in workspace DB via workspace upgrade on VPS.

### 3. Viewlet toolbar order (frontend only)

- **File:** `plugins/view-resources/src/components/ViewletSelector.svelte`
- **Behavior:** Toolbar order **States → List → Board → Dashboard** (matches Leads).
- **Deploy type:** Frontend bundle.

### 4. Company app (model + frontend)

- **Files:** `models/tracker` (`Project.company`, Company Application), `plugins/tracker-resources` (project Company picker, company page tabs)
- **Behavior:** Left-bar **Company** tab lists Contacts companies. Open a company → **Projects** / **Issues**. Tracker create/edit project has optional **Company**.
- **Deploy type:** Frontend bundle only (Company app rollback in progress on `rollback/simplify-fork`).

### 5. API tokens (frontend + account service)

- **Files:** `server/account/src/operations.ts`, `utils.ts`, `plugins/setting-resources/src/components/ApiToken*.svelte`
- **Behavior:** Settings → **API Tokens** creates, lists and revokes personal API tokens. Expiry is
  7/30/90/180/365 days or **No expiry**, stored as `expiresOn: -1` with no `exp` claim on the JWT.
- **Deploy type:** **Custom account image** — see [Account service changes](#account-service-changes).
  The stock `hardcoreeng/account` image has no `createApiToken` at all, so on stock images the whole
  page fails, not just the no-expiry option.

### 6. Integrations page

- **File:** `scripts/huly-enable-integrations.sql`
- **Behavior:** The Gmail / Telegram / Calendar / GitHub cards on Settings → **Integrations**.
- **Why a script:** a `dev/tool configure --disable` run left `TxUpdateDoc` rows in `model_tx`
  turning those plugins off, and a disabled plugin's transactions are filtered out of the client
  model — which removes every `setting:class:IntegrationType` and leaves the page blank. The SQL
  writes enable-rows that sort after both the bundled model and the fork patch.
- **Deploy type:** SQL against the workspace database. Applied automatically by `local.cmd`;
  run it by hand against production if that page is empty there too.

---

## The one command

```powershell
deploy.cmd
```

That is the whole day-to-day flow. It runs six stages and **skips whatever did not change**:

| Stage | What it does | Fails the deploy when |
|-------|--------------|------------------------|
| `validate` | Plugin-id collision check (~2 s) | A `mergeIds` key is declared twice — this is what black-screened production on 2026-08-22 |
| `account` | Builds the account bundle, ships it, switches the account container (see [Account service changes](#account-service-changes)) | The service does not come up, its RPC does not answer, or the shipped bundle lacks `createApiToken` → **automatic rollback** |
| `calendar` | Builds the calendar bundle, ships it, switches the calendar container (Google Meet Join + event-id fix) | The service does not come up, `/signin` does not answer, or the bundle lacks Meet mapping → **automatic rollback** |
| `build` | Webpack with the filesystem cache warm | `index.html` references a chunk that is missing from `dist` |
| `ship` | Uploads only the files the VPS lacks, builds a front image, switches the container | The bundle inside the container is incomplete, or nginx does not return 200 |
| `model` | Pushes `models/**` edits into `model_tx` (see [Model changes](#model-changes)) | The generated patch is implausibly large, or it fails to apply |
| `smoke` | Logs into production and checks the workbench renders | Reload loop, console errors, or the workbench never appears → **automatic rollback** |

The account stage runs **before** the front, the mirror image of the model rule: the UI calls
account methods, so the service has to understand them by the time the new bundle is live.

Other commands:

```powershell
deploy.cmd status            # what would deploy, and why (no build, no changes)
deploy.cmd validate          # just the pre-build checks
deploy.cmd account           # force an account image build + ship on its own
deploy.cmd calendar          # force a calendar image build + ship on its own
deploy.cmd model             # force a model sync on its own
deploy.cmd smoke             # test production as it is right now
deploy.cmd rollback          # switch back to the previous front image
deploy.cmd account-rollback  # switch the account service back to its previous image
deploy.cmd calendar-rollback # switch the calendar service back to its previous image
deploy.cmd verify            # live headers + which image is running
deploy.cmd prune             # reclaim docker disk on the VPS
```

Flags (set them as environment variables):

| Flag | Effect |
|------|--------|
| `FRESH=1` | Throw away the webpack cache and build cold |
| `FORCE=1` | Redeploy even when nothing changed |
| `SKIP_SMOKE=1` | Skip the smoke test (not recommended) |
| `NO_ROLLBACK=1` | Leave a failed deploy live for debugging |
| `ALLOW_SERVER_CHANGES=1` | Proceed when server code changed, deploying the front only |

### Why it is fast

- **Warm webpack cache.** `USE_CACHE=true` is now passed by the deploy script, with a prod-only
  cache dir (`dev/prod/.build_prod`). The cold build is ~15 min; later builds reuse the cache.
  Use `FRESH=1` if you ever suspect a stale cache.
- **Delta upload.** A sha1 manifest is compared against the VPS, so only changed files go over
  the wire instead of a 78 MB tarball every time.
- **Skips no-op work.** If the source fingerprint matches what is live, nothing is built. If the
  built bundle is byte-identical to production, nothing is uploaded and the container is not restarted.

### Why it is safe

- **Validation runs before the build**, so an error like a duplicate plugin id costs 2 seconds
  instead of a 20-minute build followed by an outage.
- **Integrity gate.** Both the local build and the VPS refuse to deploy if any script referenced
  by `index.html` is missing. This is the guard against two builds racing into `dev/prod/dist`.
- **The front is a real image now.** Deploys build `huly-front-custom:<sha>-<timestamp>` on top of
  `hardcoreeng/front:$HULY_VERSION` and point compose at it via `FRONT_IMAGE` in `huly_v7.conf`.
  Previously the dist was `docker cp`-ed into the running container, so any `docker compose up`
  reverted the UI to stock — and each `docker commit` left behind a 2.3 GB orphan image, which is
  what filled the disk to 97%.
- **Rollback is one command** because the previous image is kept. The smoke test triggers it
  automatically.

### What it does not do

Production runs the official `hardcoreeng/*:v0.7.426` images for every backend service **except the
account service**, which now runs an image we build (see below).

If you change `server/` (other than `server/account`), `server-plugins/`, `pods/` (other than
`pods/account`) or `services/`, the deploy **stops and tells you** rather than reporting a success
it cannot deliver — those still need custom backend images built by hand (section C).

`models/**` changes are handled by the `model` stage described below.

---

## Account service changes

The account service is a **compiled bundle** inside `hardcoreeng/account`. Unlike `models/**`, there
is no database-side trick that can add a method to it: stock `v0.7.426` contains zero occurrences of
`createApiToken`, so the API Tokens page fails outright against it. The only way to ship
`server/account` code is to run an image we built.

The `account` stage does that:

1. `scripts/huly-build-account.sh` compiles the dependency chain (`rush build --to
   @hcengineering/pod-account`) and bundles `pods/account/bundle/bundle.js`.
2. It refuses to continue if the bundle has no `createApiToken`, which is the cheap signal that the
   build did not actually pick up `server/account`.
3. The bundle (~10 MB) is uploaded, and `scripts/huly-deploy-account.sh` builds
   `huly-account-custom:<sha>-<ts>` as a **thin layer on `hardcoreeng/account:$HULY_VERSION`** —
   only `bundle.js` is replaced, so each deploy adds a few MB rather than another 400 MB image.
4. Compose is pointed at it through `ACCOUNT_IMAGE` in `huly_v7.conf`, the same env-driven pin the
   front uses, so later deploys rewrite one line instead of editing YAML.
5. It verifies the container is running, that the log says `server started on port`, that an
   unauthenticated RPC answers with a structured error, and that the deployed bundle really contains
   `createApiToken`. **Any of those failing rolls the account service back on the spot** — this is
   the service everything else authenticates against, so a bad deploy here is a full outage, not one
   broken page.

Locally the same image is used: `account.cmd` builds `huly-account-custom:local`, and `local.cmd`
picks it up automatically (falling back to the stock image, with a printed warning, when it is
absent). Re-run `account.cmd` after changing anything under `server/account` or `pods/account`.

---

## Model changes

This is the part that is easy to get wrong, because editing `models/**` and shipping a front
bundle changes **nothing**.

The model is compiled to `model.json` and baked into the transactor image
(`pods/server/Dockerfile`). At startup the transactor builds its model as
`systemTx.concat(userTx)` — the image's model first, then whatever rows sit in the workspace's
`model_tx` table (`foundations/server/packages/middleware/src/model.ts`). Since production runs
the official `hardcoreeng/transactor` image, the only way to change the model without building a
custom backend image is to write the difference into `model_tx`.

The `model` stage does exactly that:

1. Reads the base model straight out of the running transactor
   (`docker exec … cat /usr/src/app/model.json`), cached per image id under `scripts/.model-cache/`.
2. Builds our model (`models/all` → `bundle/model.json`).
3. Diffs the two with `scripts/huly-model-patch.mjs` and emits override transactions —
   `TxUpdateDoc` for changed docs, `TxCreateDoc` for new ones, `TxMixin` replayed as-is.
4. Applies them with `UPSERT`, fanned out across every workspace, then restarts the workspace
   and transactor so they reload the model.

It runs **after** the front ships, deliberately: a model doc that points at a component the live
bundle does not have yet is precisely what black-screens the workbench.

Properties worth knowing:

- **Idempotent.** Transaction ids are derived from content, so re-running produces a
  byte-identical patch and the stage is skipped. Rows that drop out of the patch are deleted.
- **Bounded.** It refuses to emit more than 60 transactions, since a diff that big means the
  cached base model and this checkout are different upstream versions.
- **It never deletes upstream docs.** Docs present in the image model but absent from ours are
  reported and left alone — removing a doc the live bundle still references is an outage.
- **Generated ids are skipped.** Docs created via `builder.createDoc` without an explicit id get a
  fresh random id on every model build, so they cannot be matched between two builds. If a change
  must apply to such a doc, give it a stable id in `models/**` first.

Locally the same mechanism runs automatically as part of `local.cmd`
(`scripts/huly-model-sync.ps1`), so local and production stay consistent.

---

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

**Verify:** Hard-refresh https://app.aneeverse.com (Ctrl+F5). Check `index.html` references new `bundle.*.js`.

**Typical time:** ~8 min webpack + ~2 min upload/restart. **No** `rush install` on VPS. **No** Cockroach/account rebuild.

---

### B) Model-only change (no webpack)

Use when you only changed `models/*` (viewlets, migrations, classes). Run workspace upgrade on the VPS:

```bash
cd /opt/huly-selfhost
./run-tool.sh upgrade-workspace aneeverse
```

Then restart `huly_v7-workspace-1`, `huly_v7-transactor-1`, and `huly_v7-nginx-1` if needed.

---

### C) Full stack / first-time install

Use official self-host on VPS only:

```bash
# On VPS — see scripts/install-huly-vps.sh for full bootstrap
/opt/huly-selfhost   # clone from hcengineering/huly-selfhost
./setup.sh
docker compose up -d
```

Then host nginx + certbot for `app.aneeverse.com`. See `scripts/huly-ssl.sh`, `scripts/install-huly-vps.sh`.

After first install, apply **A** for custom UI and **B** for tracker viewlets.

---

## VPS layout (important paths)

```
/opt/huly-selfhost/
  huly_v7.conf          # secrets + DB URL (source before tool commands)
  compose.yml
  compose.override.yml  # extra_hosts, memory limits, image: huly-front-custom:lead-wizard
  run-tool.sh           # huly CLI in tool container (create-account, upgrade-workspace, …)

/etc/nginx/sites-enabled/app.aneeverse.com   # proxy_pass → 127.0.0.1:8087

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

1. Ensure friends use **https://app.aneeverse.com** (not raw IP, not port 8087).
2. **Preferred (2026-08-18):** Hostinger managed firewall **deactivated** on VM `1474915`; OS **ufw** allows 22/80/443. Re-run `scripts/huly-os-firewall-lockdown.sh` on VPS after reboot if needed.
3. If re-enabling Hostinger firewall: allow TCP 80/443 from `any`, sync via hPanel or `VPS_syncFirewallV1`.
4. **Long-term fix:** put **Cloudflare** in front of `app.aneeverse.com`; bind extra docker ports (`8081`, `8082`, `8087`, `8000`) to localhost only.

**After any front container recreate:** always `docker restart huly_v7-nginx-1`.

---

## Script index (`scripts/`)

| Script | Purpose |
|--------|---------|
| `huly-deploy-production.sh` | **Orchestrator** — the stages behind `deploy.cmd` |
| `huly-deploy-front.sh` | **Runs on the VPS** — applies the delta, builds/pins the front image, prunes, rolls back |
| `huly-build-account.sh` | Builds the account bundle + `huly-account-custom` image (behind `account.cmd`) |
| `huly-deploy-account.sh` | **Runs on the VPS** — builds/pins the account image, verifies it, rolls back |
| `huly-enable-integrations.sql` | Re-enables the plugins behind Settings → Integrations |
| `huly-check-plugin-ids.mjs` | Pre-build gate for duplicate `mergeIds` keys |
| `huly-deploy-smoke.mjs` | Post-deploy logged-in check (reload loop, console errors, workbench) |
| `huly-dist-manifest.mjs` | sha1 manifest of `dist` used to compute the upload delta |
| `huly-tool.sh` | Run `hardcoreeng/tool` against live stack (on VPS) |
| `huly-check-ip-block.sh` | Debug IP / firewall blocks |
| `install-huly-vps.sh` | First-time VPS bootstrap |
| `huly-pin-front-image.sh` | Pin `huly-front-custom:lead-wizard` in compose.override |

Other `huly-*.sh` files are one-off diagnostics from past sessions; safe to ignore unless debugging.

---

## Checklist for agents

- [ ] Just run `deploy.cmd` — it validates, builds, ships, smokes, and rolls back on failure
- [ ] Run `deploy.cmd status` first if you want to know what will happen
- [ ] Never commit secrets (`huly_v7.conf`, passwords, API tokens) to git
- [ ] Never start two front builds at once — they share `dev/prod/dist` and `rushx package`
      begins with `rm -rf ./dist`, so they corrupt each other's output
- [ ] If the deploy stops on server-side changes, do not paper over it with
      `ALLOW_SERVER_CHANGES=1` unless the front really is all you need
- [ ] `server/account` changes are shipped by the `account` stage — run `account.cmd` locally first
      and confirm the feature works before deploying
- [ ] Model **doc** changes still need the workspace DB updated — the bundle alone is not enough
- [ ] Ask user to hard-refresh and verify on https://app.aneeverse.com
- [ ] Do **not** run full `rush build` on VPS for UI-only changes
- [ ] Do **not** use Hostinger MCP DNS (use REST API or hPanel if DNS changes needed)

---

## Disk space on the VPS

`/` is 96 GB and shared with unrelated stacks (supabase, frappe, erpnext). It reached **97% full**
because every deploy ran `docker commit` on the front container, writing a fresh 2.3 GB image and
orphaning the previous one. That is fixed: deploys now build a thin layer on top of the stock front
image and keep only the newest few tags.

`deploy.cmd` checks free space before building and prunes when it is low. To reclaim manually:

```powershell
deploy.cmd prune
```

---

## Logins (production)

Stored on VPS at `/root/huly-login.txt` (do not copy into git). Workspace: **aneeverse**.

---

## Local repo notes

- Rush monorepo: install once with `rush install --bypass-policy`
- AGENTS.md: do not auto-run builds for verification; ask user to verify manually after deploy

---

## GitHub Actions production deploy

Workflow: `.github/workflows/deploy-production.yml`

### Secrets required

- `HULY_VPS` — SSH target (`root@148.230.67.132`)
- `HULY_SSH_KEY_B64` — base64-encoded private key used for VPS deploy

Generate `HULY_SSH_KEY_B64` locally:

```bash
base64 -w 0 ~/.ssh/id_ed25519
```

On macOS (BSD base64):

```bash
base64 ~/.ssh/id_ed25519 | tr -d '\n'
```

### Triggering deploy

1. Open GitHub Actions
2. Run `Deploy Production`
3. Choose ref and stage toggles (front/model/verify)
4. Start workflow

The workflow executes the same orchestrator entrypoint:

```bash
./scripts/huly-deploy-production.sh all
```

### Failure handling / rollback

- The workflow is fail-fast by stage; no silent partial success is reported.
- Re-run with stage toggles if only a subset should be retried.
- For emergency rollback, use existing rollback scripts in `scripts/` and restart `workspace`, `transactor`, and `nginx` as described above.
