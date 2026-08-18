#!/usr/bin/env bash
set -euo pipefail

TAR=/tmp/huly-front-dist.tgz
EXTRACT=/tmp/huly-front-extract
CONTAINER=huly_v7-front-1

test -f "$TAR"
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
tar -xzf "$TAR" -C "$EXTRACT"

if [ -f "$EXTRACT/index.html" ]; then
  DIST="$EXTRACT"
elif [ -f "$EXTRACT/dist/index.html" ]; then
  DIST="$EXTRACT/dist"
else
  echo "index.html not found in tarball"
  find "$EXTRACT" -name index.html | head
  exit 1
fi

echo "using DIST=$DIST"
head -c 300 "$DIST/index.html"; echo

if docker exec "$CONTAINER" test -f /app/dist/config.json; then
  docker cp "$CONTAINER:/app/dist/config.json" /tmp/huly-config.json.bak
  cp /tmp/huly-config.json.bak "$DIST/config.json"
  echo "kept production config.json"
else
  echo "no config.json in container (front generates it from env)"
fi

if docker exec "$CONTAINER" test -f /app/dist/branding.json && [ ! -f "$DIST/branding.json" ]; then
  docker cp "$CONTAINER:/app/dist/branding.json" "$DIST/branding.json"
  echo "kept branding.json"
fi

echo "==== replacing /app/dist ===="
docker exec "$CONTAINER" rm -rf /app/dist
docker cp "$DIST" "$CONTAINER:/app/dist"

echo "==== verify ===="
docker exec "$CONTAINER" sh -c 'ls -lh /app/dist/index.html; ls /app/dist/bundle*.js | head; echo ---INDEX---; cat /app/dist/index.html'

echo "==== restart front ===="
docker restart "$CONTAINER"
sleep 10
docker ps --filter name=huly_v7-front --filter name=huly_v7-nginx --format 'table {{.Names}}\t{{.Status}}'

echo "==== restart nginx ===="
docker restart huly_v7-nginx-1
sleep 5
docker ps --filter name=huly_v7-nginx --format 'table {{.Names}}\t{{.Status}}'

echo "==== curl local ===="
curl -sS -o /dev/null -w 'nginx:%{http_code}\n' http://127.0.0.1:8087/ || true
curl -sS http://127.0.0.1:8087/ | head -c 400; echo

echo "==== commit custom image ===="
docker commit "$CONTAINER" huly-front-custom:lead-wizard
echo "deploy done"
