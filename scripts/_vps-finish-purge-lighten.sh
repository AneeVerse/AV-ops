#!/bin/bash
# Lighten guest load while Hostinger CPU limit/steal clears; verify purge.
set -u

echo "=== wait for openclaw delete if still running ==="
for i in $(seq 1 30); do
  if pgrep -f 'rm -rf /root/.openclaw' >/dev/null; then
    echo "deleting... $i"
    sleep 10
  else
    break
  fi
done

# ensure gone
rm -rf /root/.openclaw /root/.hermes /root/projects/hermes /root/projects/bot.aneeverse 2>/dev/null || true
pkill -9 -f 'hermes_cli|openclaw/dist' 2>/dev/null || true

echo "=== leftovers ==="
ls /root/.openclaw /root/.hermes /usr/local/lib/hermes-agent /usr/lib/node_modules/openclaw 2>&1 | head
pgrep -af 'hermes|openclaw' || echo procs_clean
ls /etc/nginx/sites-enabled/

echo "=== lighten: stop optional heavy guests (obsidian) temporarily? keep it, but restart redpanda ==="
# Restart redpanda to clear unhealthy state (doesn't fix SASL HC but refreshes)
cd /opt/huly-selfhost 2>/dev/null || true
if [ -f /opt/huly-selfhost/compose.yml ]; then
  docker compose -f /opt/huly-selfhost/compose.yml -f /opt/huly-selfhost/compose.override.yml restart redpanda 2>&1 | tail -5 || \
  docker restart huly_v7-redpanda-1 2>&1 | tail -3
fi

# Drop docker builder leftovers
docker builder prune -af 2>&1 | tail -3
docker image prune -f 2>&1 | tail -3

# Sync disks / drop caches carefully? skip drop_caches on production.

echo "=== health ==="
curl -s -o /dev/null -w 'medusa:%{http_code} ' --max-time 8 http://127.0.0.1:9000/health || echo medusa_fail
curl -sk -o /dev/null -w 'huly:%{http_code} ' --max-time 8 https://app.aneeverse.com/
curl -sk -o /dev/null -w 'studio:%{http_code} ' --max-time 8 https://studio.aneeverse.com/
curl -sk -o /dev/null -w 'n8n:%{http_code}\n' --max-time 8 https://n8n.aneeverse.com/
pm2 list | head -12
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'huly|contentbeta' | head -25

echo "=== load/steal ==="
uptime
vmstat 1 5
df -h / | tail -1
echo LIGHTEN_DONE
