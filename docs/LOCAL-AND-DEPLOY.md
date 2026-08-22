# Local run and production ship (aneeverse)

Simple Windows commands from the repo root. **SSH key and passwords stay on your machine — they are not in git.**

| Command | What it does |
|---------|----------------|
| `local.cmd` | Starts local Docker (Cockroach/account/transactor) and webpack UI on **8080**. Data is **local**, not production. |
| `prod-local.cmd` | Stops ports **8080** / **18087**, SSH-tunnels to production, starts local UI against live aneeverse |
| `ship.cmd` | Builds the front bundle, uploads it, restarts production front + nginx |

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

## Ship to production (`ship.cmd`)

```powershell
cd E:\Projects\platform-develop
.\ship.cmd
```

This:

1. Webpack-packages `dev/prod`
2. Copies the tarball + `scripts/huly-deploy-front.sh` to the VPS
3. Replaces `/app/dist` in `huly_v7-front-1`, restarts front and docker nginx

After it prints `deploy done`, hard-refresh https://huly.aneeverse.com (**Ctrl+F5**).

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
