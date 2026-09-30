#!/bin/bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
WS='2160d043-24bd-4a5d-b6da-ca514daf5eee'
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "
SELECT _id, calendar, data->>'title' AS title, data->>'location' AS loc, participants
FROM event
WHERE \"workspaceId\" = '$WS'
  AND _id IN (
    '6a8f28566c31eac269607584',
    '6a8f28336c31eac269607560',
    '6a8f169fc077742e032a5a90',
    '6a8f1571b5b5347334ef4e83',
    '6a8f12a3c077742e032a566f'
  );
"
echo '=== collaborator tables ==='
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "
SELECT table_name FROM information_schema.tables
WHERE table_name ILIKE '%collaborat%' OR table_name ILIKE '%participant%'
ORDER BY table_name;
"
