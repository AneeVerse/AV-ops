#!/usr/bin/env bash
set -euo pipefail
echo '==== config files in container ===='
docker exec huly_v7-front-1 find /app -name 'config*.json' 2>/dev/null || true
echo '==== json in dist ===='
docker exec huly_v7-front-1 ls -la /app/dist/*.json 2>/dev/null || echo 'no json in dist'
echo '==== html in dist ===='
docker exec huly_v7-front-1 ls -la /app/dist/*.html 2>/dev/null || echo 'no html'
echo '==== mounts ===='
docker inspect huly_v7-front-1 --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
echo '==== relevant env ===='
docker inspect huly_v7-front-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Ei 'config|account|front|url|host|nginx' || true
echo '==== nginx sites ===='
ls /opt/huly-selfhost
grep -n config /opt/huly-selfhost/nginx.conf /opt/huly-selfhost/nginx/*.conf /opt/huly-selfhost/*.yml 2>/dev/null | head -40
