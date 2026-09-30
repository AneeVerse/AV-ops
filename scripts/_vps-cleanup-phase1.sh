#!/bin/bash
set -e
echo "=== PHASE1: stop/disable unwanted services ==="
systemctl stop scrapegraphai-web chat-control codex-proxy automation-api traitdna-video-platform 2>&1 || true
systemctl disable scrapegraphai-web chat-control codex-proxy automation-api traitdna-video-platform 2>&1 || true

rm -f /etc/systemd/system/scrapegraphai-web.service \
      /etc/systemd/system/chat-control.service \
      /etc/systemd/system/codex-proxy.service \
      /etc/systemd/system/automation-api.service \
      /etc/systemd/system/traitdna-video-platform.service
systemctl daemon-reload
echo UNITS_GONE

echo "=== nginx sites ==="
for s in scrape chat codex; do
  rm -f /etc/nginx/sites-enabled/${s}.aneeverse.com \
        /etc/nginx/sites-available/${s}.aneeverse.com \
        /etc/nginx/sites-enabled/${s} \
        /etc/nginx/sites-available/${s}
  # also catch any variant names
  find /etc/nginx -maxdepth 3 -type f -iname "*${s}*" -print -delete 2>/dev/null || true
done
nginx -t && systemctl reload nginx && echo NGINX_OK

echo "=== remove app dirs ==="
rm -rf /opt/scrapegraphai /opt/codex-proxy /tmp/codex-proxy-src
rm -rf /root/.openclaw/workspace/chat-control
rm -rf /root/.openclaw/workspace/projects/traitdna-video-platform
rm -rf /root/.openclaw/workspace/tmp/automation-api-venv
echo DIRS_REMOVED

echo "=== leftover checks ==="
ss -lntp | grep -E ':(8010|3001|3010|8020|8088|8001|8787)\b' || echo "ports clear"
systemctl list-units --type=service --all | grep -Ei 'scrape|chat-control|codex|automation-api|traitdna' || echo "units clear"
ls /etc/nginx/sites-enabled/
echo PHASE1_DONE
