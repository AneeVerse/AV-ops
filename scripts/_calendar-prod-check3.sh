#!/bin/bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
echo "=== account/front/transactor names ==="
docker ps --format '{{.Names}}' | sort
echo
echo "=== plugin rows ==="
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute \
"SELECT _id, \"modifiedOn\", data FROM model_tx WHERE _id LIKE '%calendar%' OR _id LIKE 'pi-%' OR _id LIKE 'plugin-configuration-%' ORDER BY \"modifiedOn\" DESC LIMIT 40;"
echo
echo "=== .huly.nginx locations ==="
grep -n 'location ' .huly.nginx
