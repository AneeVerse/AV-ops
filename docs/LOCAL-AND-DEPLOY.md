# Local run and production ship (aneeverse)

Simple Windows commands from the repo root. **SSH key and passwords stay on your machine — they are not in git.**

| Command | What it does |
|---------|----------------|
| `local.cmd` | Stops anything on ports **8080** and **18087**, opens an SSH tunnel to production, starts the local UI |
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

Then open **http://localhost:8080/** and log in with the **same production account**.

- The UI is your local code (hot reload on save).
- Data is the **live** aneeverse workspace (via SSH tunnel to the VPS).
- Stop with **Ctrl+C** (tunnel is closed automatically).

If something was already running on 8080, `local.cmd` kills it first.

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

Tracker **States / Dashboard** viewlets (first time, or after a workspace upgrade wiped them):

```bash
bash scripts/huly-deploy-production.sh model-tracker
```

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

Full production layout, nginx, and firewall notes: [HULY-PRODUCTION-DEPLOY.md](HULY-PRODUCTION-DEPLOY.md).
