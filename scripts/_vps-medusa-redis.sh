#!/bin/bash
echo "=== redis ==="
systemctl is-active redis-server redis 2>/dev/null
ss -lntp | grep 6379 || echo no_6379
redis-cli ping 2>/dev/null || true
echo "=== medusa env redis ==="
grep -iE 'REDIS|WORKER|DATABASE|NODE_ENV' /root/projects/cultura/deploy/backend/.env 2>/dev/null | sed 's/=.*/=***/'
echo "=== medusa-config redis ==="
grep -n -iE 'redis|projectConfig|worker' /root/projects/cultura/deploy/backend/medusa-config.ts | head -40
echo "=== sample config ==="
sed -n '1,120p' /root/projects/cultura/deploy/backend/medusa-config.ts
echo "=== which redis pkg ==="
ls /root/projects/cultura/deploy/backend/node_modules/@medusajs/caching* 2>/dev/null | head
dpkg -l | grep -i redis | head
