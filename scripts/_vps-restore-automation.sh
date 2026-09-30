#!/bin/bash
set -e
VENV=/root/.openclaw/workspace/tmp/automation-api-venv
WD=/root/.openclaw/workspace

if [ ! -x "$VENV/bin/uvicorn" ]; then
  echo "Recreating venv..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q fastapi uvicorn
fi

cat >/etc/systemd/system/automation-api.service <<'EOF'
[Unit]
Description=Automation API service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw/workspace
ExecStart=/root/.openclaw/workspace/tmp/automation-api-venv/bin/uvicorn scripts.automation_api:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now automation-api
sleep 2
systemctl is-active automation-api
ss -lntp | grep 8001 || true
curl -s -o /dev/null -w "sales-api:%{http_code}\n" http://127.0.0.1:8001/internal/sales/ || true

# parenting monitor probe
echo "=== parenting 8097 ==="
find /root /opt /home -maxdepth 5 -iname '*parent*' 2>/dev/null | head -20
ls /etc/systemd/system/*parent* 2>/dev/null || echo no_parent_unit

# final status
echo "=== KEEP STATUS ==="
df -h / | tail -1
uptime
echo "nginx sites:"; ls /etc/nginx/sites-enabled/
for u in nginx n8n novino-gateway-proxy obsidian-web sales1-next sales-n8n-bridge automation-api jwel-img-gen-bridge jwel-img-gen-ui; do
  printf '%-28s %s\n' "$u" "$(systemctl is-active $u 2>/dev/null)"
done
echo "openclaw:"; pgrep -af 'openclaw.*gateway' | head -1
echo "hermes:"; pgrep -af 'hermes_cli' | wc -l
echo "supabase:"; docker ps --format '{{.Names}}' | grep contentbeta || true
echo "huly:"; docker ps --format '{{.Names}}' | grep huly_v7 | wc -l
echo "pm2:"; pm2 jlist 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print(", ".join(f"{x[\"name\"]}:{x[\"pm2_env\"][\"status\"]}" for x in d))' 2>/dev/null || pm2 list | head -10
echo DONE
