#!/usr/bin/env bash
set -euo pipefail
TOKEN=$(bash /tmp/huly-tool.sh generate-token --admin '4d.x.art@gmail.com' aneeverse | tail -1)
echo "token_len=${#TOKEN}"
echo "$TOKEN" | head -c 40; echo '...'

echo '==== probe transactor ===='
for path in \
  "/api/v1/model" \
  "/api/v1/model?token=$TOKEN" \
  "/api/v1/manage?token=$TOKEN&operation=status" \
  ; do
  echo "-- $path"
  docker exec huly_v7-transactor-1 wget -q -S -O - "http://127.0.0.1:3333${path}" 2>&1 | head -20 || true
done

echo '==== probe via nginx ===='
curl -sS -o /tmp/huly-model.out -w 'code:%{http_code} size:%{size_download}\n' \
  "https://huly.aneeverse.com/_transactor/api/v1/model?token=${TOKEN}" || true
head -c 200 /tmp/huly-model.out; echo
