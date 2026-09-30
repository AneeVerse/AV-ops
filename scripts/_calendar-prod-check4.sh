#!/bin/bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
echo "=== databases ==="
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "SHOW DATABASES;"
echo
echo "=== search model_tx ==="
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "
SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'model_tx';
"
echo
echo "=== plugin-configuration rows ==="
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "
SELECT _id, data->>'objectId' AS object_id, data->'operations' AS ops
FROM model_tx
WHERE _id LIKE 'plugin-configuration%'
   OR data->>'objectId' LIKE 'plugin-configuration%'
   OR _id LIKE 'pi-%'
LIMIT 50;
"
echo
echo "=== disable calendar? ==="
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "
SELECT _id, \"modifiedOn\", left(data::text, 300) FROM model_tx
WHERE data::text ILIKE '%calendar%' AND data::text ILIKE '%enabled%'
LIMIT 20;
"
