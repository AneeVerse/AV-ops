#!/bin/bash
echo "=== samples ==="
for i in 1 2 3 4 5; do
  pid=$(pgrep -f '/node_modules/.bin/medusa start' | head -1)
  if [ -n "$pid" ]; then
    ps -o pid=,pcpu=,pmem=,etime=,cmd= -p "$pid"
  else
    echo no_medusa
  fi
  sleep 2
done
uptime
curl -s -o /dev/null -w 'health:%{http_code}\n' --max-time 8 http://127.0.0.1:9000/health
pgrep -af 'cpulimit' | head -3
redis-cli info clients | head -6
pm2 list | head -12
# confirm no fake redis on latest boot
grep -a '2026-09-21 06:5\|2026-09-21 07:' /root/.pm2/logs/backend-out.log | grep -E 'fake redis|Connection to Redis|Server is ready' | tail -10
