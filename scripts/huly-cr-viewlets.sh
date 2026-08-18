#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
CR() { docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "$1"; }

echo '==== model_tx schema ===='
CR "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='model_tx' ORDER BY ordinal_position;"
echo
echo '==== sample model_tx ===='
CR "SELECT * FROM model_tx LIMIT 1;"
echo
echo '==== viewlets in model_tx ===='
CR "SELECT _id, data->>'objectId' AS object_id, data->>'objectClass' AS object_class FROM model_tx WHERE data->>'objectClass' = 'view:class:Viewlet' OR data::text LIKE '%Viewlet%' LIMIT 30;"
