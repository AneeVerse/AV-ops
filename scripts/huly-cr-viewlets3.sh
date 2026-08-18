#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
SQL='SELECT "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy", "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data FROM model_tx WHERE "_id" = '"'"'6a82cb7fa175e8c33097603f'"'"';'
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --format=records --execute "$SQL"
echo '==== workspace status ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --format=csv --execute 'SELECT * FROM global_account.workspace_status;'
echo '==== workspace ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --format=csv --execute 'SELECT uuid, name FROM global_account.workspace;'
