#!/usr/bin/env bash
# Finish restore: Redpanda ownership, Obsidian user, Cultura npm, Studio.
set -euo pipefail
B=/root/vps-restore-backup
ROOT=/opt/av_ops
log(){ echo "[$(date -u +%H:%M:%S)] $*"; }

log "Redpanda ownership"
chown -R 101:101 /var/lib/docker/volumes/huly_v7_redpanda/_data
rm -f /var/lib/docker/volumes/huly_v7_redpanda/_data/pid.lock
docker start huly_v7-redpanda-1
sleep 8
docker ps --filter name=huly_v7-redpanda --format '{{.Names}} {{.Status}}'
docker logs huly_v7-redpanda-1 2>&1 | tail -n 5

log "Obsidian user and packages"
systemctl stop obsidian-web || true
id obsidian >/dev/null 2>&1 || useradd --create-home --shell /bin/bash obsidian
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y xvfb fluxbox x11vnc novnc websockify python3-websockify dbus-x11 sudo
apt-get install -y libfuse2 || apt-get install -y libfuse2t64 || true
tar -C /home -xzf "$B/obsidian/home-obsidian.tar.gz"
rm -rf /home/obsidian/second-brain
ln -sfn "$ROOT/memory/obsidian" /home/obsidian/second-brain
chown -R obsidian:obsidian /home/obsidian "$ROOT/memory/obsidian"
ln -sfn "$ROOT/memory/obsidian-web" /opt/obsidian-web
chmod +x "$ROOT/memory/obsidian-web/run.sh" "$ROOT/memory/obsidian-web/bin/Obsidian.AppImage"
systemctl reset-failed obsidian-web || true
systemctl start obsidian-web || true
sleep 6
systemctl is-active obsidian-web || true
ss -ltnp | grep 6080 || true
journalctl -u obsidian-web -n 15 --no-pager || true

log "Cultura npm"
cd "$ROOT/web/cultura/deploy/backend"
npm install --omit=dev --legacy-peer-deps
cd "$ROOT/web/cultura/deploy/frontend"
npm install --omit=dev --legacy-peer-deps
pm2 delete backend >/dev/null 2>&1 || true
pm2 delete frontend >/dev/null 2>&1 || true
pm2 start npm --name backend --cwd "$ROOT/web/cultura/deploy/backend" -- start
pm2 start npm --name frontend --cwd "$ROOT/web/cultura/deploy/frontend" -- start

log "Studio"
rm -rf /tmp/contentbeta /tmp/contentbeta-supabase
tar -C /tmp -xzf "$B/studio/contentbeta.tar.gz"
tar -C /tmp -xzf "$B/studio/contentbeta-supabase.tar.gz"
rm -rf "$ROOT/web/studio/contentbeta" "$ROOT/web/studio/supabase"
mv /tmp/contentbeta "$ROOT/web/studio/contentbeta"
mv /tmp/contentbeta-supabase "$ROOT/web/studio/supabase"
if [[ -f "$ROOT/web/studio/supabase/docker-compose.yml" ]]; then
  sed -i 's|/opt/contentbeta-supabase|/opt/av_ops/web/studio/supabase|g' "$ROOT/web/studio/supabase/docker-compose.yml"
fi
find "$ROOT/web/studio/supabase" -name '*.yml' -o -name '*.yaml' -o -name '*.env' | head
ln -sfn "$ROOT/web/studio/contentbeta" /opt/contentbeta
ln -sfn "$ROOT/web/studio/supabase" /opt/contentbeta-supabase
cd "$ROOT/web/studio/supabase"
docker compose up -d
cd "$ROOT/web/studio/contentbeta"
npm install --omit=dev --legacy-peer-deps
pm2 delete contentbeta >/dev/null 2>&1 || true
if grep -q '"start"' package.json; then
  pm2 start npm --name contentbeta --cwd "$ROOT/web/studio/contentbeta" -- start -- -p 3000 -H 127.0.0.1
else
  pm2 start node_modules/next/dist/bin/next --name contentbeta --cwd "$ROOT/web/studio/contentbeta" -- start -p 3000 -H 127.0.0.1
fi
pm2 save
pm2 startup systemd -u root --hp /root || true
log "FINISH_DONE"
pm2 list
docker ps --format '{{.Names}} {{.Status}}'
