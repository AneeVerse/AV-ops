#!/bin/bash
set -e
pm2 stop backend
mkdir -p /root/projects/cultura/deploy/backend/public
ln -sfn /root/projects/cultura/deploy/backend/.medusa/server/public/admin /root/projects/cultura/deploy/backend/public/admin
ls -la /root/projects/cultura/deploy/backend/public/admin/index.html
pm2 start backend
echo "waiting for boot..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 10
  if ss -lntp | grep -q ':9000'; then
    echo "UP after ${i}0s"
    break
  fi
  echo "still booting ${i}0s restarts=$(pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin); x=[i for i in d if i["name"]=="backend"][0]; print(x["pm2_env"]["restart_time"], x["pm2_env"]["status"])')"
done
curl -s -o /dev/null -w 'medusa:%{http_code}\n' --max-time 10 http://127.0.0.1:9000/health || echo medusa_fail
pm2 save
uptime
echo MEDUSA_FIX_DONE
