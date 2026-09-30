#!/bin/bash
set -euo pipefail
echo "=== search credential json (names only) ==="
find /root /opt /etc -maxdepth 4 \( -iname '*client_secret*' -o -iname '*gcp*' -o -iname '*google*json' -o -iname 'credentials.json' \) 2>/dev/null | head -40
echo
echo "=== grep client_id files (paths only) ==="
grep -rl 'client_secret' /opt /root --include='*.json' --include='*.env' --include='*.conf' --include='*.yml' 2>/dev/null | head -20
echo
echo "=== model_tx count ==="
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "SELECT count(*) FROM model_tx;"
echo
echo "=== workspace names ==="
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%workspace%' OR table_name ILIKE '%plugin%' LIMIT 40;"
echo
echo "=== disk space ==="
df -h / | tail -1
echo
echo "=== transactor CALENDAR in compose.yml ==="
grep -n -A30 '^  transactor:' /opt/huly-selfhost/compose.yml | head -35
