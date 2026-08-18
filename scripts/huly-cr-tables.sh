#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL="${CR_DB_URL}?sslmode=disable"
# cockroach container should use localhost
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
echo "trying $URL_LOCAL"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "SHOW DATABASES;"
echo
echo '==== tables ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "SHOW TABLES FROM defaultdb;" | head -150
