#!/usr/bin/env bash
# Remove the fork Client CRM (Client / ClientFunnel / My Clients) from a running
# Huly Cockroach workspace: workspace docs first, then model_tx TxRemoveDoc so
# the transactor stops serving those classes.
#
# Does NOT touch Company (tracker:app:Company / Project.company).
#
# VPS:  bash scripts/huly-remove-client-crm.sh
# Local: HULY_COCKROACH=dev-cockroach-1 HULY_INSECURE=1 HULY_RESTART=0 bash scripts/huly-remove-client-crm.sh
set -euo pipefail

STACK="${HULY_STACK:-/opt/huly-selfhost}"
COCKROACH="${HULY_COCKROACH:-huly_v7-cockroach-1}"
TRANSACTOR="${HULY_TRANSACTOR:-huly_v7-transactor-1}"
WORKSPACE="${HULY_WORKSPACE:-huly_v7-workspace-1}"
RESTART="${HULY_RESTART:-1}"

if [ -f "$STACK/huly_v7.conf" ]; then
  # shellcheck disable=SC1091
  source "$STACK/huly_v7.conf"
  URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
  SQL=(docker exec -i "$COCKROACH" ./cockroach sql --url "$URL_LOCAL")
else
  SQL=(docker exec -i "$COCKROACH" ./cockroach sql --insecure --database=defaultdb)
fi

echo '==== Client CRM currently present ===='
"${SQL[@]}" <<'SQL'
SELECT _id, data->>'name' AS name, data->>'archived' AS archived
FROM space
WHERE _class = 'tracker:class:ClientFunnel'
   OR _id LIKE 'tracker:%Client%' AND _id NOT LIKE '%Company%';

SELECT count(*) AS client_docs FROM task WHERE _class = 'tracker:class:Client';

SELECT DISTINCT "objectId"
FROM model_tx
WHERE "objectId" LIKE 'tracker:%Client%'
  AND "objectId" NOT LIKE '%Company%'
ORDER BY 1;
SQL

echo '==== delete Client workspace docs ===='
"${SQL[@]}" <<'SQL'
BEGIN;

DELETE FROM tx
WHERE "objectId" IN (SELECT _id FROM space WHERE _class = 'tracker:class:ClientFunnel')
   OR "objectId" IN (SELECT _id FROM task WHERE _class = 'tracker:class:Client')
   OR space IN (SELECT _id FROM space WHERE _class = 'tracker:class:ClientFunnel')
   OR data->>'objectClass' IN ('tracker:class:Client', 'tracker:class:ClientFunnel');

DELETE FROM task
WHERE _class = 'tracker:class:Client'
   OR space IN (SELECT _id FROM space WHERE _class = 'tracker:class:ClientFunnel');

DELETE FROM space
WHERE _class = 'tracker:class:ClientFunnel'
   OR (_id LIKE 'tracker:%Client%' AND _id NOT LIKE '%Company%');

COMMIT;
SQL

echo '==== TxRemoveDoc Client model objects ===='
"${SQL[@]}" <<'SQL'
BEGIN;
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  m."workspaceId",
  substr(md5(m."workspaceId"::text || m."objectId" || '-rm-client-crm-tx'), 1, 24),
  'core:class:TxRemoveDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint,
  substr(md5(m."workspaceId"::text || m."objectId" || '-rm-client-crm-hash'), 1, 11),
  NULL,
  'core:space:Model',
  m."objectId",
  jsonb_build_object(
    'objectClass',
    COALESCE(m.data->>'objectClass', m.data->'attributes'->>'_class', 'core:class:Doc')
  )
FROM (
  SELECT DISTINCT ON ("workspaceId", "objectId")
    "workspaceId", "objectId", data
  FROM model_tx
  WHERE "objectId" LIKE 'tracker:%Client%'
    AND "objectId" NOT LIKE '%Company%'
    AND _class = 'core:class:TxCreateDoc'
  ORDER BY "workspaceId", "objectId", "modifiedOn" DESC
) m
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx r
  WHERE r."workspaceId" = m."workspaceId"
    AND r."objectId" = m."objectId"
    AND r._class = 'core:class:TxRemoveDoc'
);
COMMIT;
SQL

echo '==== verify ===='
"${SQL[@]}" <<'SQL'
SELECT count(*) AS leftover_funnels FROM space WHERE _class = 'tracker:class:ClientFunnel';
SELECT count(*) AS leftover_clients FROM task WHERE _class = 'tracker:class:Client';
SELECT count(*) AS leftover_creates
FROM model_tx c
WHERE c."objectId" LIKE 'tracker:%Client%'
  AND c."objectId" NOT LIKE '%Company%'
  AND c._class = 'core:class:TxCreateDoc'
  AND NOT EXISTS (
    SELECT 1 FROM model_tx r
    WHERE r."workspaceId" = c."workspaceId"
      AND r."objectId" = c."objectId"
      AND r._class = 'core:class:TxRemoveDoc'
  );
SQL

if [ "$RESTART" = "1" ]; then
  echo '==== restart workspace + transactor ===='
  docker restart "$WORKSPACE" "$TRANSACTOR"
  sleep 12
fi
echo '==== Client CRM removal done ===='
