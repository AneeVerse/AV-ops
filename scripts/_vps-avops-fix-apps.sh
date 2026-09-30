#!/usr/bin/env bash
set -euo pipefail
log(){ echo "[$(date -u +%H:%M:%S)] $*"; }

log "electron libs for Obsidian"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgtk-3-0 libgbm1 libasound2t64 libxcomposite1 libxdamage1 libxrandr2 libxkbcommon0 libpango-1.0-0 libcairo2 || \
apt-get install -y libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libgtk-3-0t64 libgbm1 libasound2t64 libxcomposite1 libxdamage1 libxrandr2 libxkbcommon0 libpango-1.0-0 libcairo2
systemctl restart obsidian-web
sleep 8
tail -n 15 /var/log/obsidian-app.log || true
systemctl is-active obsidian-web

log "cultura backend layout"
ls -la /opt/av_ops/web/cultura/deploy/backend/medusa-config.* /opt/av_ops/web/cultura/deploy/backend/.medusa 2>/dev/null || true
find /opt/av_ops/web/cultura/deploy/backend/.medusa -maxdepth 2 -type d 2>/dev/null | head

log "cultura backend deps"
cd /opt/av_ops/web/cultura/deploy/backend
npm install --legacy-peer-deps
pm2 delete backend >/dev/null 2>&1 || true
pm2 start npm --name backend --cwd /opt/av_ops/web/cultura/deploy/backend -- start
sleep 12
pm2 describe backend | sed -n '1,25p'
ss -ltnp | grep 9000 || echo 'NO_9000'
tail -n 30 /root/.pm2/logs/backend-error.log || true

log "supabase health"
curl -sk -o /dev/null -w 'auth %{http_code}\n' --resolve supabase.aneeverse.com:443:127.0.0.1 https://supabase.aneeverse.com/auth/v1/health || true
sudo -u postgres psql -d onecarat_medusa -c "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('product','product_variant','image','order') ORDER BY 1;"
log "FIX_APPS_DONE"
