#!/bin/bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
WS='2160d043-24bd-4a5d-b6da-ca514daf5eee'
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "
SELECT _id, calendar, data->>'title' AS title, data->>'location' AS loc,
       data->>'participants' AS parts
FROM event
WHERE \"workspaceId\" = '$WS'
  AND (
    _id IN ('6a8f28566c31eac269607584','6a8f28336c31eac269607560','6a8f28126c31eac26960752f','6a8f169fc077742e032a5a90')
    OR data->>'title' ILIKE '%Happy Birthday%'
    OR data->>'title' ILIKE '%gggg%'
    OR data->>'title' ILIKE '%ddddd%'
    OR data->>'title' ILIKE '%ffffffff%'
    OR data->>'title' ILIKE '%AV-Daily%'
  )
ORDER BY \"modifiedOn\" DESC
LIMIT 30;
"
echo '=== logs owner/push ==='
docker logs huly_v7-calendar-1 2>&1 | grep -E 'Ensured calendar owner|Pushed local events|Incoming sync finished' | tail -20
