#!/bin/bash
set -u
export XDG_RUNTIME_DIR=/run/user/0
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/0/bus

echo "=== disable user hermes + openclaw + gemini browser ==="
mapfile -t UNITS < <(systemctl --user list-unit-files --no-legend --no-pager | awk '/^(hermes-|openclaw-|jwel-gemini-)/ {print $1}')
printf 'units: %s\n' "${UNITS[@]}"
systemctl --user disable --now "${UNITS[@]}" || true
systemctl --user mask "${UNITS[@]}" || true
sleep 2
echo "hermes left: $(pgrep -c -f hermes_cli || true)"
echo "openclaw left: $(pgrep -c -f 'openclaw/dist/index.js' || true)"

echo "=== stop medusa crash loop ==="
pm2 stop backend || true

echo "=== load now ==="
uptime
vmstat 1 2

echo "=== huly containers ==="
docker ps -a --format '{{.Names}} {{.Status}}' | grep huly || true

echo "=== medusa build ==="
cd /root/projects/cultura/deploy/backend
npm run build
echo BUILD_EXIT:$?

echo "=== start medusa ==="
pm2 start backend || pm2 restart backend
sleep 12
pm2 describe backend | grep -E 'status|restarts|unstable' || true
echo "--- last log ---"
tail -30 /root/.pm2/logs/backend-out.log
echo "--- health ---"
curl -s -o /dev/null -w 'medusa9000:%{http_code}\n' --max-time 8 http://127.0.0.1:9000/health || true
curl -s -o /dev/null -w 'medusa8000:%{http_code}\n' --max-time 8 http://127.0.0.1:8000/ || true
curl -sk -o /dev/null -w 'huly:%{http_code}\n' --max-time 10 https://app.aneeverse.com/ || true
curl -sk -o /dev/null -w 'cultura:%{http_code}\n' --max-time 10 https://culturajewels.com/ || true

echo "=== final ==="
uptime
vmstat 1 2
pgrep -af 'hermes_cli|openclaw/dist' || echo 'hermes+openclaw gone'
echo ALL_DONE
