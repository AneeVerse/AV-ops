#!/usr/bin/env bash
set -euo pipefail
B=/opt/av_ops/web/cultura/deploy/backend
echo "=== config ==="
ls -la "$B"/medusa-config.* || true
echo "=== medusa dir ==="
find "$B/.medusa" -maxdepth 2 -type d 2>/dev/null | head || echo 'NO_MEDUSA_DIR'
echo "=== ts-node dep ==="
node -e 'const p=require("/opt/av_ops/web/cultura/deploy/backend/package.json"); const d=p.devDependencies||{}; const r=p.dependencies||{}; console.log("dev", d["ts-node"]); console.log("dep", r["ts-node"]); console.log(JSON.stringify(p.scripts));'
echo "=== obsidian proc ==="
pgrep -af 'Obsidian|websockify' | head
tail -n 8 /var/log/obsidian-app.log || true

echo "=== install ts-node ==="
cd "$B"
npm install --include=dev --legacy-peer-deps
test -d node_modules/ts-node && echo TS_NODE_OK || echo TS_NODE_MISSING

pm2 delete backend >/dev/null 2>&1 || true
cat > /tmp/cultura-backend.ecosystem.cjs <<EOF
module.exports = {
  apps: [{
    name: "backend",
    cwd: "$B",
    script: "npm",
    args: "start",
    env: { NODE_ENV: "development" }
  }]
}
EOF
pm2 start /tmp/cultura-backend.ecosystem.cjs
sleep 15
ss -ltnp | grep 9000 || echo NO_9000
pm2 describe backend | awk '/status|restarts|uptime|script/'
echo "=== err tail ==="
tail -n 25 /root/.pm2/logs/backend-error.log || true
echo "=== out tail ==="
tail -n 20 /root/.pm2/logs/backend-out.log || true
