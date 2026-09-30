#!/usr/bin/env bash
# Reshape /opt/av_ops into the AV OPS layout. av_tools stays empty.
set -euo pipefail
ROOT=/opt/av_ops
cd "$ROOT"

# Remove placeholder tools that do not belong in av_tools.
rm -rf \
  "$ROOT/av_tools/n8n" \
  "$ROOT/av_tools/hermes_agent" \
  "$ROOT/av_tools/obsidian" \
  "$ROOT/av_tools/av_studio" \
  "$ROOT/av_tools/av_ops" \
  "$ROOT/tools"

mkdir -p \
  "$ROOT/docker/av_ops" \
  "$ROOT/docker/hermes_agent" \
  "$ROOT/docker/n8n" \
  "$ROOT/docker/postgres" \
  "$ROOT/memory/obsidian" \
  "$ROOT/av_tools" \
  "$ROOT/web/cultura" \
  "$ROOT/web/studio" \
  "$ROOT/scripts" \
  "$ROOT/docs"

# av_tools must stay empty (no README, no extra tools).
find "$ROOT/av_tools" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

cat > "$ROOT/.gitignore" <<'EOF'
# Persistent data and secrets stay on the server, not in git.
**/.env
**/.env.*
!**/.env.example
**/*.secret
**/secrets/
**/data/
**/backups/
**/node_modules/
**/.next/
docker/av_ops/**
!docker/av_ops/README.md
memory/obsidian/**
!memory/obsidian/.gitkeep
web/cultura/**
!web/cultura/README.md
web/studio/**
!web/studio/README.md
EOF

cat > "$ROOT/README.md" <<'EOF'
# AV OPS

Central layout for the Aneeverse VPS.

- `docker/av_ops` — running Huly (AV OPS) deployment
- `docker/hermes_agent` — Hermes runtime (not started)
- `docker/n8n` — n8n runtime (not started)
- `docker/postgres` — reserved for n8n later
- `memory/obsidian` — long-term memory vault
- `av_tools` — empty; add open-source tools here later for Hermes to call
- `web/cultura` — Cultura Jewels store
- `web/studio` — Studio (contentbeta)
- `scripts` — setup, backup, restore
EOF

cat > "$ROOT/docker/av_ops/README.md" <<'EOF'
# AV OPS runtime (custom Huly)

Compose files, config, and Docker volumes for the Huly-based control center live here.
Source edits stay in the platform repo on the developer machine and are deployed into this folder.
EOF

cat > "$ROOT/docker/hermes_agent/README.md" <<'EOF'
# Hermes

AI operations head. This folder is reserved for the Docker runtime.

Do not start Hermes on this VPS until the Hostinger CPU limitation is removed.
Hermes will call open-source tools that are added later under `/opt/av_ops/av_tools`.
EOF

cat > "$ROOT/docker/n8n/README.md" <<'EOF'
# n8n

Automation layer. Folder reserved for a later Docker compose setup.
Previous n8n workflows were not in the restore backup, so nothing is started here.
EOF

cat > "$ROOT/docker/postgres/README.md" <<'EOF'
# Postgres

Reserved for n8n (and other new services) later.
Huly keeps its own CockroachDB inside `docker/av_ops`.
Cultura uses the host Postgres. Studio uses its own Supabase Postgres.
EOF

cat > "$ROOT/web/cultura/README.md" <<'EOF'
# Cultura Jewels

Medusa storefront and backend restored under this folder.
EOF

cat > "$ROOT/web/studio/README.md" <<'EOF'
# Studio

Contentbeta app and its Supabase stack restored under this folder.
EOF

touch "$ROOT/memory/obsidian/.gitkeep"

cat > "$ROOT/docs/architecture.md" <<'EOF'
# Architecture

AV OPS (custom Huly) is the control center.
Hermes is the AI brain and stays off until CPU headroom exists.
n8n is the automation layer and is not started in this restore.
Obsidian under `memory/obsidian` is long-term memory.
`av_tools` is empty until open-source tools are added for Hermes to use.
Cultura and Studio are websites under `web/`.
EOF

cat > "$ROOT/docs/restore-guide.md" <<'EOF'
# Restore

1. Fresh Ubuntu, Docker, nginx, Node 22, Postgres, Redis.
2. Restore this `/opt/av_ops` tree.
3. Restore persistent data from the off-box backup into `docker/av_ops`, `memory/obsidian`, `web/cultura`, and `web/studio`.
4. `docker compose up` inside `docker/av_ops`.
5. Start Cultura and Studio with pm2.
6. Do not start Hermes until the Hostinger CPU limit is cleared.
EOF

echo LAYOUT_OK
find "$ROOT" -not -path '*/.git/*' | sort
