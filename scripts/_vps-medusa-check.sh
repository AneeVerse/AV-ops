#!/bin/bash
echo "=== admin files ==="
find /root/projects/cultura/deploy/backend/.medusa -name index.html 2>/dev/null
echo "=== last errors ==="
grep -a "Error starting server\|index.html\|listening on\|Server is ready" /root/.pm2/logs/backend-out.log | tail -8
echo "=== pm2 ==="
pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin)
x=[i for i in d if i["name"]=="backend"][0]
print("status", x["pm2_env"]["status"], "restarts", x["pm2_env"]["restart_time"], "pid", x["pid"])'
echo "=== child ==="
pgrep -af 'medusa start' || echo no_medusa
ss -lntp | grep 9000 || echo no_9000
