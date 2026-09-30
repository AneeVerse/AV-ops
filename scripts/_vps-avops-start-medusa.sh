#!/usr/bin/env bash
set -euo pipefail
B=/opt/av_ops/web/cultura/deploy/backend
pm2 delete cultura-backend.ecosystem >/dev/null 2>&1 || true
pm2 delete backend >/dev/null 2>&1 || true
cat > "$B/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: "backend",
    cwd: "$B",
    script: "./node_modules/@medusajs/cli/cli.js",
    args: "start",
    env: {
      NODE_ENV: "production"
    }
  }]
}
EOF
pm2 start "$B/ecosystem.config.js"
sleep 18
ss -ltnp | grep 9000 || echo NO_9000
pm2 describe backend | awk '/status|restarts|uptime|unstable/'
echo "=== out ==="
tail -n 30 /root/.pm2/logs/backend-out.log
echo "=== err ==="
tail -n 20 /root/.pm2/logs/backend-error.log
curl -s -o /dev/null -w 'store9000 %{http_code}\n' http://127.0.0.1:9000/health || true
curl -s -o /dev/null -w 'storefront %{http_code}\n' http://127.0.0.1:8000/
pm2 save
