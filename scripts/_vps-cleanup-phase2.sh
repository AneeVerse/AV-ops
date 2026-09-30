#!/bin/bash
set -e
echo "=== kill leftover processes ==="
pkill -f 'codex-proxy' 2>/dev/null || true
pkill -f 'scrapegraphai' 2>/dev/null || true
pkill -f 'chat-control' 2>/dev/null || true
pkill -f 'automation_api' 2>/dev/null || true
pkill -f 'traitdna' 2>/dev/null || true
sleep 1
ss -lntp | grep -E ':(3010|8020|8088|8001|8787)\b' || echo "ports clear"

echo "=== remove codex tunnel if any ==="
systemctl stop codex-proxy-tunnel 2>/dev/null || true
systemctl disable codex-proxy-tunnel 2>/dev/null || true
rm -f /etc/systemd/system/codex-proxy-tunnel.service
systemctl daemon-reload || true
systemctl list-units --type=service --all | grep -Ei 'scrape|chat-control|codex|automation-api|traitdna' || echo "units clear"

echo "=== disk before ==="
df -h / | tail -1
du -sh /root/.npm /root/.cache /var/cache/apt /tmp 2>/dev/null || true
docker system df 2>/dev/null || true

echo "=== clear npm cache ==="
npm cache clean --force 2>&1 | tail -5 || true
rm -rf /root/.npm/_cacache /root/.npm/_logs 2>/dev/null || true
# also common user caches
rm -rf /root/.cache/pip /root/.cache/ms-playwright /root/.cache/puppeteer /root/.cache/typescript 2>/dev/null || true
# keep hermes/openclaw runtime caches that are needed? clear large generic
du -sh /root/.cache/* 2>/dev/null | sort -hr | head -20

echo "=== clear apt / tmp ==="
apt-get clean 2>&1 | tail -3 || true
rm -rf /var/cache/apt/archives/*.deb 2>/dev/null || true
# safe tmp cleanup - leave sockets/sessions
find /tmp -maxdepth 1 -type f -mtime +1 -delete 2>/dev/null || true
find /tmp -maxdepth 1 -type d -name 'codex*' -exec rm -rf {} + 2>/dev/null || true
find /tmp -maxdepth 1 -type d -name 'npm-*' -exec rm -rf {} + 2>/dev/null || true
find /var/tmp -maxdepth 1 -type f -mtime +2 -delete 2>/dev/null || true

echo "=== docker prune (unused only, keep running containers) ==="
docker container prune -f 2>&1 | tail -5
docker image prune -af 2>&1 | tail -10
docker volume prune -f 2>&1 | tail -5
docker builder prune -af 2>&1 | tail -5
docker network prune -f 2>&1 | tail -5

echo "=== check android-sdk size (candidate leftover) ==="
du -sh /opt/android-sdk 2>/dev/null || echo "no android-sdk"

echo "=== disk after ==="
df -h / | tail -1
du -sh /root/.npm /root/.cache 2>/dev/null || true
docker system df 2>/dev/null || true

echo "=== verify KEEP stack briefly ==="
systemctl is-active nginx n8n openclaw-gateway novino-gateway-proxy 2>&1 || true
# huly/cultura/md via docker or pm2
docker ps --format '{{.Names}}' 2>/dev/null | head -40
pm2 list 2>/dev/null | head -30 || true
ss -lntp | grep -E ':(80|443|3000|5678|18789|8097)\b' || true

echo PHASE2_DONE
