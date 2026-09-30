#!/usr/bin/env bash
set -euo pipefail
echo "=== repeated dns ==="
ok=0
fail=0
for i in 1 2 3 4 5 6 7 8; do
  if docker exec huly_v7-transactor-1 getent hosts redpanda >/dev/null; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    echo "dns miss $i"
  fi
done
echo "dns ok=$ok fail=$fail"
echo "=== tcp ==="
docker exec huly_v7-transactor-1 node -e 'const n=require("net"); const s=n.connect(9092,"redpanda",()=>{console.log("TCP_OK"); s.end(); process.exit(0)}); s.setTimeout(5000); s.on("timeout",()=>{console.log("TCP_TIMEOUT"); process.exit(1)}); s.on("error",e=>{console.log("TCP_FAIL",e.message); process.exit(1)})'
echo "=== restart transactor ==="
docker restart huly_v7-transactor-1
sleep 12
echo "=== recent errors ==="
docker logs huly_v7-transactor-1 --since 20s 2>&1 | grep -E 'EAI_AGAIN|listening|started|error' | tail -15 || true
docker ps --filter name=huly_v7-transactor --format '{{.Names}} {{.Status}}'
