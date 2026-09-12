#!/bin/bash
set -e
export PATH="/tmp/codex-proxy-src/.venv/bin:$PATH"
pkill -f 'codex-proxy serve' 2>/dev/null || true
pkill -f 'cloudflared tunnel --url http://127.0.0.1:8088' 2>/dev/null || true
fuser -k 8088/tcp 2>/dev/null || true
sleep 1
cd /tmp/codex-proxy-src
nohup ./.venv/bin/codex-proxy serve --host 127.0.0.1 --port 8088 > /opt/codex-proxy/proxy.log 2>&1 &
echo $! > /opt/codex-proxy/proxy.pid
sleep 2
echo "PUBLIC_URL=https://codex.aneeverse.com"
echo "API_KEY=$(cat /opt/codex-proxy/api.key)"
echo "CURSOR_BASE=https://codex.aneeverse.com/v1"
curl -sS -m 5 -o /dev/null -w "local=%{http_code}\n" -H "Authorization: Bearer $(cat /opt/codex-proxy/api.key)" http://127.0.0.1:8088/v1/models
