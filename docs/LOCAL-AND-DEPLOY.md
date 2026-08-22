# Local run and production ship (aneeverse)

Simple Windows commands from the repo root. **SSH key and passwords stay on your machine — they are not in git.**

| Command | What it does |
|---------|----------------|
| `local.cmd` | Starts local Docker (Cockroach/account/transactor) and webpack UI on **8080**. Data is **local**, not production. |
| `prod-local.cmd` | Stops ports **8080** / **18087**, SSH-tunnels to production, starts local UI against live aneeverse |
| `deploy.cmd` | Validates, builds only what changed, ships it, smoke-tests production, rolls back on failure |

Live site: https://huly.aneeverse.com

---

## One-time setup

1. Git for Windows (Git Bash) installed.
2. SSH key that can log into the VPS, default path:

   `%USERPROFILE%\.ssh\id_ed25519`

   Optional override (PowerShell, this session only):

   ```powershell
   $env:HULY_SSH_KEY = "C:\path\to\your_key"
   $env:HULY_VPS = "root@148.230.67.132"
   ```

3. First clone only: from repo root, in **Git Bash**:

   ```bash
   rush install --bypass-policy
   ```

   Skip this after dependencies are already installed.

---

## Run locally (`local.cmd`)

Double-click `local.cmd`, or in PowerShell:

```powershell
cd E:\Projects\platform-develop
.\local.cmd
```

Then open **http://localhost:8080/**.

- The UI is your local code (hot reload on save).
- Data is the **local** Docker workspace (`user1` / `1234`, workspace `local-ws`).
- Docker Desktop must be running. First start can take several minutes while images pull.
- Stop with **Ctrl+C**.

If something was already running on 8080, `local.cmd` kills it first.

Before starting webpack it also does two things to the local DB:

- **Drops stale fork model rows** left over from the rollback. Without this, restoring an old URL
  like `/company/my-clients` throws `ResourceNotFound tracker:resolver:CompanyLocation` and the
  workbench never renders.
- **Syncs `models/**` into the local DB.** The local transactor serves the model baked into its
  image, so model edits are invisible until the difference is written to `model_tx`. This is the
  same mechanism production uses — see
  [Model changes](HULY-PRODUCTION-DEPLOY.md#model-changes).

## Run against production data (`prod-local.cmd`)

```powershell
.\prod-local.cmd
```

Log in with the **same production account**. Edits hit the live workspace.

Git Bash equivalent:

```bash
./scripts/huly-local-prod.sh          # terminal 1 — keep open
cd dev/prod && HULY_PROD_PROXY=http://127.0.0.1:18087 rushx dev-aneeverse   # terminal 2
```

---

## Ship to production (`deploy.cmd`)

```powershell
cd E:\Projects\platform-develop
.\deploy.cmd
```

This:

1. Checks for duplicate plugin ids (~2 s) — the bug class that black-screened production
2. Builds `dev/prod` with a warm webpack cache, skipping the build entirely if nothing changed
3. Uploads only the files the VPS is missing, then builds and switches to a new front image
4. Pushes any `models/**` edits into the workspace model, after the front so the bundle is ready
5. Logs into production and verifies the workbench renders — **rolls back automatically if not**

After it prints `done`, hard-refresh https://huly.aneeverse.com (**Ctrl+F5**).

Useful variants:

```powershell
.\deploy.cmd status     # what would deploy, without doing anything
.\deploy.cmd rollback   # back to the previous front image
.\deploy.cmd smoke      # check production as it is right now
```

`ship.cmd` still works and forwards to `deploy.cmd`.

---

## What is never committed

These stay local (see `.gitignore`):

- `.env` / `.env.*`
- SSH keys (`id_ed25519`, `*.pem`)
- `huly_v7.conf`, credential files
- `*.tgz` (build tarballs)
- `node_modules/`, `common/temp/`, `dist/`

Do not paste VPS passwords or `huly_v7.conf` into the repo.

---

## More detail

- Full history of fork changes vs upstream Huly (what/why): [ANEEVERSE-FORK-CHANGES.md](ANEEVERSE-FORK-CHANGES.md)
- Full production layout, nginx, and firewall notes: [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md).
