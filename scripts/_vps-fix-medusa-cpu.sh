#!/bin/bash
set -euo pipefail
CFG=/root/projects/cultura/deploy/backend/medusa-config.ts
cp -a "$CFG" "${CFG}.bak-redis-$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path
p = Path('/root/projects/cultura/deploy/backend/medusa-config.ts')
text = p.read_text()
old = """  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || \"supersecret\",
      cookieSecret: process.env.COOKIE_SECRET || \"supersecret\",
    },
    cookieOptions: {
      sameSite: \"lax\",
      secure: false,
    },

  },"""
new = """  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || \"supersecret\",
      cookieSecret: process.env.COOKIE_SECRET || \"supersecret\",
    },
    cookieOptions: {
      sameSite: \"lax\",
      secure: false,
    },

  },"""
if 'redisUrl: process.env.REDIS_URL' in text:
    print('redisUrl already present')
else:
    if old not in text:
        raise SystemExit('projectConfig block not found for patch')
    text = text.replace(old, new, 1)
    print('patched redisUrl')

# inject redis modules if missing
needle = '  modules: {\n    product: {'
inject = '''  modules: {
    [Modules.CACHE]: {
      resolve: "@medusajs/cache-redis",
      options: {
        redisUrl: process.env.CACHE_REDIS_URL || process.env.REDIS_URL,
      },
    },
    [Modules.EVENT_BUS]: {
      resolve: "@medusajs/event-bus-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redis: {
          url: process.env.REDIS_URL,
        },
      },
    },
    product: {'''
if '@medusajs/cache-redis' in text:
    print('redis modules already present')
else:
    if needle not in text:
        raise SystemExit('modules block not found')
    text = text.replace(needle, inject, 1)
    print('patched redis modules')

p.write_text(text)
print('OK')
PY

# ensure admin symlink still present
mkdir -p /root/projects/cultura/deploy/backend/public
ln -sfn /root/projects/cultura/deploy/backend/.medusa/server/public/admin /root/projects/cultura/deploy/backend/public/admin

# soft CPU cap helper (keep store usable, prevent pegging both cores)
apt-get install -y cpulimit >/dev/null 2>&1 || true

# restart medusa via pm2 with memory guard
cd /root/projects/cultura/deploy/backend
pm2 delete backend || true
pm2 start npm --name backend --max-memory-restart 900M --cwd /root/projects/cultura/deploy/backend -- start
pm2 save

echo "waiting for ready..."
for i in $(seq 1 18); do
  sleep 5
  if curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:9000/health | grep -q 200; then
    echo UP_$i
    break
  fi
  echo wait_$i
done

# attach cpulimit if available (limit to ~1 full core = 100%)
MEDUSA_PID=$(pgrep -f '/node_modules/.bin/medusa start' | head -1 || true)
if command -v cpulimit >/dev/null && [ -n "$MEDUSA_PID" ]; then
  # kill old cpulimit watchers
  pkill -f 'cpulimit -p .*medusa' 2>/dev/null || true
  nohup cpulimit -p "$MEDUSA_PID" -l 120 -b >/tmp/cpulimit-medusa.log 2>&1 || true
  echo "cpulimit on pid $MEDUSA_PID at 120%"
fi

echo "=== verify redis usage ==="
grep -a 'fake redis\|redisUrl\|Server is ready\|cache-redis\|event-bus-redis' /root/.pm2/logs/backend-out.log | tail -20
echo "=== cpu sample ==="
ps -o pid,pcpu,pmem,etime,cmd -p "$MEDUSA_PID" 2>/dev/null || ps aux | grep medusa | grep -v grep
uptime
curl -s -o /dev/null -w 'health:%{http_code}\n' --max-time 5 http://127.0.0.1:9000/health
echo MEDUSA_CPU_FIX_DONE
