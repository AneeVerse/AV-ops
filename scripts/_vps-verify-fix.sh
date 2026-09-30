#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/0
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/0/bus
echo "=== user still active? ==="
systemctl --user is-active openclaw-gateway.service hermes-gateway.service hermes-dashboard.service 2>/dev/null || true
echo "=== procs ==="
pgrep -af 'hermes_cli|openclaw/dist' || echo none
echo "=== pm2 ==="
pm2 list
echo "=== medusa listen ==="
ss -lntp | grep -E ':9000|:8000' || echo no_listen
echo "=== recent medusa errors ==="
grep -E 'Error starting|Server is ready|listening|index.html' /root/.pm2/logs/backend-out.log | tail -15
tail -20 /root/.pm2/logs/backend-error.log
echo "=== curls ==="
curl -s -o /dev/null -w 'm9000:%{http_code}\n' --max-time 10 http://127.0.0.1:9000/health || echo m9000_fail
curl -sk -o /dev/null -w 'huly:%{http_code}\n' --max-time 10 https://app.aneeverse.com/
curl -sk -o /dev/null -w 'cultura:%{http_code}\n' --max-time 10 https://culturajewels.com/
curl -sk -o /dev/null -w 'studio:%{http_code}\n' --max-time 10 https://studio.aneeverse.com/
curl -sk -o /dev/null -w 'n8n:%{http_code}\n' --max-time 10 https://n8n.aneeverse.com/
echo "=== huly restart counts ==="
docker ps -a --filter name=huly_v7 --format '{{.Names}} {{.Status}}'
echo "=== load ==="
uptime
vmstat 1 3
echo "=== system jwel ==="
systemctl is-active jwel-img-gen-bridge jwel-img-gen-ui nginx n8n
pm2 save
echo VERIFY_DONE
