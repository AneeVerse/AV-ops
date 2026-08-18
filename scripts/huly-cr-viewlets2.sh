#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
CR() { docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --format=csv --execute "$1"; }

echo '==== TxCreateDoc sample ===='
CR 'SELECT "_id", "_class", "objectId", "objectSpace", data FROM model_tx WHERE "_class" = '"'"'core:class:TxCreateDoc'"'"' LIMIT 2;'
echo
echo '==== named viewlets ===='
CR 'SELECT "objectId", "_class" FROM model_tx WHERE "objectId" LIKE '"'"'tracker:viewlet:%'"'"' OR "objectId" LIKE '"'"'lead:viewlet:%'"'"' OR "objectId" LIKE '"'"'task:viewlet:%'"'"';'
echo
echo '==== create viewlet txs ===='
CR 'SELECT "objectId", "_class" FROM model_tx WHERE data->>'"'"'objectClass'"'"' = '"'"'view:class:Viewlet'"'"' AND "_class" = '"'"'core:class:TxCreateDoc'"'"' LIMIT 20;'
echo
echo '==== tx table schema ===='
CR "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tx' ORDER BY ordinal_position;"
