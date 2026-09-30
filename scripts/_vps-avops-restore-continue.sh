#!/usr/bin/env bash
# Resume after volumes and custom images are already in place.
set -euo pipefail
B=/root/vps-restore-backup
ROOT=/opt/av_ops
log(){ echo "[$(date -u +%H:%M:%S)] $*"; }

if [[ -f "$ROOT/docker/av_ops/huly_v7.conf" ]]; then
  while IFS= read -r line; do
    key=${line%%=*}
    if [[ "$key" == *_IMAGE ]] || ! grep -q "^${key}=" "$ROOT/docker/av_ops/.env"; then
      grep -v "^${key}=" "$ROOT/docker/av_ops/.env" > "$ROOT/docker/av_ops/.env.tmp" || true
      mv "$ROOT/docker/av_ops/.env.tmp" "$ROOT/docker/av_ops/.env"
      printf '%s\n' "$line" >> "$ROOT/docker/av_ops/.env"
    fi
  done < <(grep -E '^[A-Z0-9_]+=' "$ROOT/docker/av_ops/huly_v7.conf")
fi
grep -q '^CALENDAR_IMAGE=.' "$ROOT/docker/av_ops/.env"
log "Huly env has CALENDAR_IMAGE"

log "Huly compose up"
cd "$ROOT/docker/av_ops"
docker compose -f compose.yml -f compose.override.yml up -d

# ---------- Obsidian ----------
log "Obsidian vault"
stage=$(mktemp -d)
tar -C "$stage" -xzf "$B/obsidian/md.aneeverse.tar.gz"
rm -f "$ROOT/memory/obsidian/.gitkeep"
cp -a "$stage/md.aneeverse/second-brain/." "$ROOT/memory/obsidian/"
rm -rf "$stage"
tar -C "$ROOT/memory" -xzf "$B/obsidian/obsidian-web.tar.gz"
if [[ -f "$ROOT/memory/obsidian-web/run.sh" ]]; then
  sed -i \
    -e 's|/root/projects/md.aneeverse/second-brain|/opt/av_ops/memory/obsidian|g' \
    -e 's|/home/obsidian/second-brain|/opt/av_ops/memory/obsidian|g' \
    -e 's|/root/second-brain|/opt/av_ops/memory/obsidian|g' \
    "$ROOT/memory/obsidian-web/run.sh" || true
fi
grep -R -n -E 'second-brain|VAULT|obsidian' "$ROOT/memory/obsidian-web" --include='*.sh' --include='*.service' --include='*.env' | head -40 || true
install -m 644 /dev/stdin /etc/systemd/system/obsidian-web.service <<'EOF'
[Unit]
Description=Obsidian web access via noVNC
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/av_ops/memory/obsidian-web/run.sh
Restart=always
RestartSec=5
Environment=HOME=/root
Environment=USER=root
Environment=LOGNAME=root

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now obsidian-web.service || log "obsidian-web failed to start; check run.sh"

# ---------- Cultura ----------
log "Cultura code and media"
stage=$(mktemp -d)
tar -C "$stage" -xzf "$B/cultura/cultura-code.tar.gz"
cp -a "$stage/cultura/." "$ROOT/web/cultura/"
rm -rf "$stage"
tar -C "$ROOT/web/cultura" -xzf "$B/cultura/cultura-product-media.tar.gz"
mkdir -p /root/projects
ln -sfn "$ROOT/web/cultura" /root/projects/cultura

log "Cultura database"
python3 <<'PY'
import urllib.parse, subprocess, pathlib
env = pathlib.Path("/opt/av_ops/web/cultura/deploy/backend/.env").read_text()
url = [l.split("=",1)[1].strip().strip("\"'") for l in env.splitlines() if l.startswith("DATABASE_URL=")][0]
u = urllib.parse.urlparse(url)
db = (u.path or "/").lstrip("/") or "postgres"
user = u.username or "onecarat"
password = urllib.parse.unquote(u.password or "")
sql = f"""
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{user}') THEN
    CREATE ROLE {user} LOGIN PASSWORD '{password.replace("'", "''")}';
  ELSE
    ALTER ROLE {user} WITH LOGIN PASSWORD '{password.replace("'", "''")}';
  END IF;
END
$$;
SELECT 'role-ready';
"""
subprocess.check_call(["sudo","-u","postgres","psql","-v","ON_ERROR_STOP=1","-c",sql])
exists = subprocess.check_output(["sudo","-u","postgres","psql","-tAc",f"SELECT 1 FROM pg_database WHERE datname='{db}'"], text=True).strip()
if exists != "1":
    subprocess.check_call(["sudo","-u","postgres","psql","-v","ON_ERROR_STOP=1","-c",f"CREATE DATABASE {db} OWNER {user};"])
print("db", db, "user", user)
PY
export PGPASSWORD
PGPASSWORD=$(python3 - <<'PY'
import urllib.parse, pathlib
env = pathlib.Path("/opt/av_ops/web/cultura/deploy/backend/.env").read_text()
url = [l.split("=",1)[1].strip().strip("\"'") for l in env.splitlines() if l.startswith("DATABASE_URL=")][0]
u = urllib.parse.urlparse(url)
print(urllib.parse.unquote(u.password or ""))
PY
)
pg_restore -h 127.0.0.1 -p 5432 -U onecarat -d onecarat_medusa --no-owner --no-acl --clean --if-exists "$B/cultura/medusa-db.dump" || true
unset PGPASSWORD
sudo -u postgres psql -d onecarat_medusa -c "SELECT 'product', count(*) FROM product UNION ALL SELECT 'image', count(*) FROM image;"

log "Cultura npm install"
cd "$ROOT/web/cultura/deploy/backend"
npm install --omit=dev
cd "$ROOT/web/cultura/deploy/frontend"
npm install --omit=dev
pm2 delete backend >/dev/null 2>&1 || true
pm2 delete frontend >/dev/null 2>&1 || true
pm2 start npm --name backend --cwd "$ROOT/web/cultura/deploy/backend" -- start
pm2 start npm --name frontend --cwd "$ROOT/web/cultura/deploy/frontend" -- start

# ---------- Studio ----------
log "Studio app and supabase"
rm -rf /tmp/contentbeta /tmp/contentbeta-supabase
tar -C /tmp -xzf "$B/studio/contentbeta.tar.gz"
tar -C /tmp -xzf "$B/studio/contentbeta-supabase.tar.gz"
rm -rf "$ROOT/web/studio/contentbeta" "$ROOT/web/studio/supabase"
mv /tmp/contentbeta "$ROOT/web/studio/contentbeta"
mv /tmp/contentbeta-supabase "$ROOT/web/studio/supabase"
if [[ -f "$ROOT/web/studio/supabase/docker-compose.yml" ]]; then
  sed -i 's|/opt/contentbeta-supabase|/opt/av_ops/web/studio/supabase|g' "$ROOT/web/studio/supabase/docker-compose.yml"
fi
ln -sfn "$ROOT/web/studio/contentbeta" /opt/contentbeta
ln -sfn "$ROOT/web/studio/supabase" /opt/contentbeta-supabase
cd "$ROOT/web/studio/supabase"
docker compose up -d
cd "$ROOT/web/studio/contentbeta"
npm install --omit=dev
pm2 delete contentbeta >/dev/null 2>&1 || true
pm2 start npm --name contentbeta --cwd "$ROOT/web/studio/contentbeta" -- start -- -p 3000 -H 127.0.0.1

pm2 save
pm2 startup systemd -u root --hp /root || true

log "RESTORE_DONE"
docker ps --format '{{.Names}} {{.Status}}'
pm2 list
systemctl is-active obsidian-web nginx docker postgresql redis-server || true
