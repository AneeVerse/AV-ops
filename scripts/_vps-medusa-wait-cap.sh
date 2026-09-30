#!/bin/bash
set -euo pipefail
CFG=/root/projects/cultura/deploy/backend/medusa-config.ts
# fix workflow engine option key
python3 - <<'PY'
from pathlib import Path
p=Path('/root/projects/cultura/deploy/backend/medusa-config.ts')
t=p.read_text()
old='''    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redis: {
          url: process.env.REDIS_URL,
        },
      },
    },'''
new='''    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },'''
if old in t:
    p.write_text(t.replace(old,new,1))
    print('workflow redisUrl fixed')
elif 'WORKFLOW_ENGINE' in t and 'redisUrl: process.env.REDIS_URL' in t:
    print('already ok')
else:
    print('WARN workflow block unexpected')
PY

# wait until ready or fail with logs
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:9000/health || echo 000)
  if [ "$code" = "200" ]; then
    echo READY_$i
    break
  fi
  # if crashed, show error
  status=$(pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin); x=[i for i in d if i["name"]=="backend"][0]; print(x["pm2_env"]["status"], x["pm2_env"]["restart_time"])')
  echo "wait $i health=$code pm2=$status"
  sleep 5
done

curl -s -o /dev/null -w 'health:%{http_code}\n' --max-time 5 http://127.0.0.1:9000/health || true
grep -a 'Server is ready\|fake redis\|Connection to Redis\|Error starting\|error' /root/.pm2/logs/backend-out.log | tail -25
echo '---err---'
tail -40 /root/.pm2/logs/backend-error.log

# re-apply cpulimit on current medusa pid
pkill -f 'cpulimit -p' 2>/dev/null || true
MEDUSA_PID=$(pgrep -f '/node_modules/.bin/medusa start' | head -1 || true)
if [ -n "$MEDUSA_PID" ] && command -v cpulimit >/dev/null; then
  cpulimit -p "$MEDUSA_PID" -l 100 -b
  echo cpulimit_100_on_$MEDUSA_PID
fi

sleep 3
echo '=== cpu now ==='
ps -o pid,pcpu,pmem,etime,cmd -C node | grep -E 'medusa|PID' || true
ps -o pid,pcpu,pmem,etime,cmd -p "$MEDUSA_PID" 2>/dev/null || true
uptime
pm2 save
echo DONE
