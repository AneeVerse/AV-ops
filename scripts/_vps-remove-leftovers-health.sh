#!/bin/bash
set -e

echo "=== REMOVE leftovers ==="
rm -rf /opt/android-sdk
echo "android-sdk gone"

rm -f /root/.openclaw/workspace/projects/parent_app_source.tar.gz \
      /root/.openclaw/workspace/projects/parenting-monitor-prototype-source.tar.gz
rm -f /root/.pm2/logs/parenting-monitor-api-out.log \
      /root/.pm2/logs/parenting-monitor-api-error.log
# drop any leftover parenting dirs if present
find /root/.openclaw/workspace -maxdepth 3 -iname '*parenting*' -print -exec rm -rf {} + 2>/dev/null || true
pm2 delete parenting-monitor-api 2>/dev/null || true

# strip parenting-monitor nginx location from bot.aneeverse.com
BOT=/etc/nginx/sites-enabled/bot.aneeverse.com
if [ -f "$BOT" ] && grep -q parenting-monitor-api "$BOT"; then
  python3 - <<'PY'
from pathlib import Path
p = Path('/etc/nginx/sites-enabled/bot.aneeverse.com')
text = p.read_text()
# remove location /parenting-monitor-api/ { ... }
import re
new = re.sub(
    r'\n\s*location /parenting-monitor-api/ \{.*?\n\s*\}\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
if new == text:
    raise SystemExit('failed to strip parenting location')
p.write_text(new)
print('nginx parenting block removed')
PY
  nginx -t && systemctl reload nginx && echo NGINX_OK
else
  echo "no parenting nginx block or already gone"
fi

rm -rf /root/.cache/uv
echo "uv cache gone"

echo
echo "=== VPS HEALTH ==="
echo "--- uptime / load ---"
uptime
echo
echo "--- cpu ---"
nproc
top -bn1 | head -5
echo
echo "--- memory ---"
free -h
echo
echo "--- disk ---"
df -h / /var /tmp 2>/dev/null | uniq
echo
echo "--- largest /opt ---"
du -sh /opt/* 2>/dev/null | sort -hr | head -15
echo
echo "--- docker ---"
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -40
echo
echo "--- key services ---"
for u in nginx n8n novino-gateway-proxy obsidian-web sales1-next sales-n8n-bridge automation-api jwel-img-gen-bridge jwel-img-gen-ui; do
  printf '%-28s %s\n' "$u" "$(systemctl is-active $u 2>/dev/null || echo missing)"
done
echo "openclaw: $(pgrep -c -f 'openclaw.*gateway' || echo 0) proc"
echo "hermes:   $(pgrep -c -f 'hermes_cli' || echo 0) proc"
echo
echo "--- listening keep ports ---"
ss -lntp | grep -E ':(80|443|3000|3001|5678|8001|8010|18789|9119)\b' || true
echo
echo "--- nginx sites ---"
ls /etc/nginx/sites-enabled/
echo
echo "--- pm2 ---"
pm2 list 2>/dev/null | head -20
echo
echo "--- supabase ---"
docker ps --format '{{.Names}} {{.Status}}' | grep contentbeta || echo none
echo
echo "--- failed units ---"
systemctl --failed --no-pager 2>/dev/null | head -20
echo DONE
