#!/usr/bin/env bash
# Restore Huly, Obsidian, Cultura, and Studio into /opt/av_ops.
# Hermes and n8n are not started.
set -euo pipefail
B=/root/vps-restore-backup
ROOT=/opt/av_ops
log(){ echo "[$(date -u +%H:%M:%S)] $*"; }

[[ -f "$B/huly/huly-selfhost.tar.gz" ]] || { echo "backup missing at $B"; exit 1; }

# ---------- nginx + certs (only the sites we are bringing back) ----------
log "nginx and certificates"
tmp=$(mktemp -d)
tar -C "$tmp" -xzf "$B/infra/nginx.tar.gz"
tar -C /etc -xzf "$B/infra/letsencrypt.tar.gz"
install -d /etc/nginx/sites-available /etc/nginx/sites-enabled
for site in app.aneeverse.com studio.aneeverse.com culturajewels.conf md.aneeverse.com.conf supabase.aneeverse.com; do
  install -m 644 "$tmp/nginx/sites-available/$site" "/etc/nginx/sites-available/$site"
  ln -sfn "/etc/nginx/sites-available/$site" "/etc/nginx/sites-enabled/$site"
done
install -m 640 "$tmp/nginx/.htpasswd-md-obsidian" /etc/nginx/.htpasswd-md-obsidian
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
rm -rf "$tmp"

# ---------- Huly ----------
log "Huly compose into docker/av_ops"
stage=$(mktemp -d)
tar -C "$stage" -xzf "$B/huly/huly-selfhost.tar.gz"
cp -a "$stage/huly-selfhost/." "$ROOT/docker/av_ops/"
rm -rf "$stage"
tar -C "$ROOT/docker/av_ops" -xzf "$B/huly/huly-custom-bundles.tar.gz"
install -m 600 "$B/huly/huly.env" "$ROOT/docker/av_ops/.env"
# huly.env is missing keys that only live in huly_v7.conf (CALENDAR_IMAGE, DISABLE_SIGNUP).
# huly.env can lag the live conf. Image tags and any missing keys come from huly_v7.conf.
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
install -m 600 "$B/huly/.huly.secret" "$ROOT/docker/av_ops/.huly.secret"
install -m 600 "$B/huly/.cr.secret" "$ROOT/docker/av_ops/.cr.secret"
install -m 600 "$B/huly/.rp.secret" "$ROOT/docker/av_ops/.rp.secret"

log "Huly Docker volumes"
for vol in huly_v7_cr_data huly_v7_cr_certs huly_v7_files huly_v7_elastic huly_v7_redpanda; do
  rm -rf "/var/lib/docker/volumes/$vol"
  tar --numeric-owner -C /var/lib/docker/volumes -xzf "$B/huly/${vol}.tar.gz"
done
systemctl restart docker
sleep 3

log "Huly custom images"
docker load -i "$B/huly/custom-images.tar"

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
# Point the viewer at the restored vault if the launcher hardcodes the old path.
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
# Installed @medusajs/workflow-engine-redis@2.12.3 reads options.redis.redisUrl.
python3 - <<'PY'
from pathlib import Path
path = Path("/opt/av_ops/web/cultura/deploy/backend/medusa-config.ts")
text = path.read_text()
old = """    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },"""
new = """    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redis: {
          redisUrl: process.env.REDIS_URL,
        },
      },
    },"""
if old in text:
    path.write_text(text.replace(old, new, 1))
    print("workflow options patched")
PY
mkdir -p /root/projects
ln -sfn "$ROOT/web/cultura" /root/projects/cultura

log "Cultura database"
python3 <<'PY'
import os, urllib.parse, subprocess, pathlib
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
npm install --include=dev --legacy-peer-deps
cd "$ROOT/web/cultura/deploy/frontend"
npm install --omit=dev --legacy-peer-deps
pm2 start npm --name backend --cwd "$ROOT/web/cultura/deploy/backend" -- start
pm2 start npm --name frontend --cwd "$ROOT/web/cultura/deploy/frontend" -- start

# ---------- Studio ----------
log "Studio app and supabase"
tar -C /tmp -xzf "$B/studio/contentbeta.tar.gz"
tar -C /tmp -xzf "$B/studio/contentbeta-supabase.tar.gz"
rm -rf "$ROOT/web/studio/contentbeta" "$ROOT/web/studio/supabase"
mv /tmp/contentbeta "$ROOT/web/studio/contentbeta"
mv /tmp/contentbeta-supabase "$ROOT/web/studio/supabase"
sed -i 's|/opt/contentbeta-supabase|/opt/av_ops/web/studio/supabase|g' "$ROOT/web/studio/supabase/docker-compose.yml" || true
ln -sfn "$ROOT/web/studio/contentbeta" /opt/contentbeta
ln -sfn "$ROOT/web/studio/supabase" /opt/contentbeta-supabase
cd "$ROOT/web/studio/supabase"
docker compose up -d
cd "$ROOT/web/studio/contentbeta"
npm install --omit=dev --legacy-peer-deps
pm2 start npm --name contentbeta --cwd "$ROOT/web/studio/contentbeta" -- start -- -p 3000 -H 127.0.0.1

pm2 save
pm2 startup systemd -u root --hp /root || true

log "RESTORE_DONE"
docker ps --format '{{.Names}} {{.Status}}'
pm2 list
systemctl is-active obsidian-web nginx docker postgresql redis-server || true
