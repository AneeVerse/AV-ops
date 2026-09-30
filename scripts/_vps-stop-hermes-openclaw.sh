#!/bin/bash
set -u
echo "=== parents ==="
for pid in $(pgrep -f 'hermes_cli|openclaw/dist/index.js' || true); do
  ppid=$(awk '/^PPid:/ {print $2}' /proc/$pid/status 2>/dev/null || echo '?')
  echo "pid=$pid ppid=$ppid"
done

echo "=== boot hooks ==="
grep -Rsn --exclude-dir=node_modules -E 'hermes_cli|openclaw' /etc/systemd/system /etc/rc.local /root/.bashrc /etc/profile.d /root/.profile 2>/dev/null | head -40 || true

echo "=== STOP services ==="
systemctl stop novino-gateway-proxy sales1-next sales-n8n-bridge automation-api hermes-dashboard-firewall 2>/dev/null || true
systemctl disable novino-gateway-proxy sales1-next sales-n8n-bridge automation-api hermes-dashboard-firewall 2>/dev/null || true

echo "=== KILL processes ==="
pkill -f 'hermes_cli' || true
pkill -f 'openclaw/dist/index.js' || true
pkill -f 'sales_n8n_bridge.py' || true
pkill -f 'scripts.automation_api' || true
sleep 2
# second pass
pkill -9 -f 'hermes_cli' || true
pkill -9 -f 'openclaw/dist/index.js' || true
sleep 1
echo "left hermes: $(pgrep -c -f hermes_cli || echo 0)"
echo "left openclaw: $(pgrep -c -f 'openclaw/dist/index.js' || echo 0)"

echo "=== nginx drop bot/bots ==="
rm -f /etc/nginx/sites-enabled/bot.aneeverse.com /etc/nginx/sites-enabled/bots.aneeverse.com
nginx -t && systemctl reload nginx
echo NGINX_OK

echo "=== load after stop ==="
uptime
vmstat 1 3
echo STOP_DONE
