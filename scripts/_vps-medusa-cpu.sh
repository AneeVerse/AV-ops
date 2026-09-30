#!/bin/bash
echo "=== top cpu ==="
ps aux --sort=-%cpu | head -15
echo "=== medusa pm2 ==="
pm2 list
pm2 describe backend 2>/dev/null | grep -E 'status|restarts|uptime|pid|script|unstable' | head -20
echo "=== medusa children ==="
pgrep -af 'medusa|cultura/deploy/backend' | head -20
echo "=== openclaw leftover ==="
pgrep -af 'openclaw|hermes_cli' || echo none
ls /usr/lib/node_modules/openclaw 2>&1 | head -3
echo "=== medusa logs recent ==="
tail -40 /root/.pm2/logs/backend-out.log
echo "=== err ==="
tail -30 /root/.pm2/logs/backend-error.log
echo "=== ports ==="
ss -lntp | grep -E ':9000|:8000|:18789'
echo "=== load ==="
uptime
vmstat 1 2 | tail -2
