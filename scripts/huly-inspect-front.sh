#!/usr/bin/env bash
set -euo pipefail
docker exec huly_v7-front-1 sh -c 'cat /app/dist/index.html; echo; ls -la /app/dist/config.json /app/dist/huly 2>/dev/null; ls /app/dist/*.html /app/dist/config* 2>/dev/null; echo ====ENV====; env | grep -Ei "dist|public|static|front" || true'
