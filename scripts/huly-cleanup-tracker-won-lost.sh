#!/usr/bin/env bash
# Remove orphan Tracker IssueStatus docs named Won/Lost that were seeded via
# CreateTaskType (StatusCategory.defaultStatusName). Leave Lead/Client Won/Lost alone.
#
# Safe / idempotent. Run on VPS:
#   bash scripts/huly-cleanup-tracker-won-lost.sh
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')'?sslmode=disable'
NOW=$(date +%s%3N)
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

WON_ID='6a8970a09d322a8b8662f5ee'
LOST_ID='6a8970a09d322a8b8662f5f1'
TAG='CleanupTrackerWonLost'

run_sql () {
  docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL"
}

echo "==== orphan IssueStatus docs ===="
run_sql <<SQL
SELECT "objectId", data->'attributes'->>'name' AS name, data->'attributes'->>'ofAttribute' AS of_attr
FROM model_tx
WHERE "_class" = 'core:class:TxCreateDoc'
  AND "objectId" IN ('${WON_ID}', '${LOST_ID}');
SQL

echo "==== issues still pointing at orphan statuses (should be 0) ===="
run_sql <<SQL
SELECT count(*) AS issue_refs FROM tracker
WHERE data->>'status' IN ('${WON_ID}', '${LOST_ID}');
SQL

insert_remove_doc () {
  local OID="$1"
  local OCLASS="$2"
  local SUFFIX="$3"
  run_sql <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w."workspaceId",
  substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-tx'), 1, 24),
  'core:class:TxRemoveDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-hash'), 1, 11),
  NULL,
  'core:space:Model',
  '${OID}',
  jsonb_build_object('objectClass', '${OCLASS}')
FROM (SELECT DISTINCT "workspaceId" FROM model_tx) w
WHERE EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w."workspaceId"
    AND m."objectId" = '${OID}'
    AND m."_class" = 'core:class:TxCreateDoc'
)
AND NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w."workspaceId"
    AND m."objectId" = '${OID}'
    AND m."_class" = 'core:class:TxRemoveDoc'
);
SQL
}

# Pull orphan status refs off Classic project type (and any other project types that got them)
echo "==== \$pull Won/Lost from project type statuses ===="
for OID in "${WON_ID}" "${LOST_ID}"; do
  SUFFIX="pull-${OID}"
  run_sql <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w."workspaceId",
  substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-tx'), 1, 24),
  'core:class:TxUpdateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-hash'), 1, 11),
  NULL,
  'core:space:Model',
  'tracker:ids:ClassingProjectType',
  jsonb_build_object(
    'objectClass', 'task:class:ProjectType',
    'operations', jsonb_build_object(
      '\$pull', jsonb_build_object('statuses', jsonb_build_object('_id', '${OID}'))
    )
  )
FROM (SELECT DISTINCT "workspaceId" FROM model_tx) w
WHERE EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w."workspaceId"
    AND m."objectId" = 'tracker:ids:ClassingProjectType'
    AND m.data::text LIKE '%${OID}%'
)
AND NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w."workspaceId"
    AND m._id = substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-tx'), 1, 24)
);
SQL
done

# Drop Won/Lost from the Sub-Task task type statuses array via \$pull
echo "==== \$pull Won/Lost from Sub-Task task type statuses ===="
TASK_TYPE_ID='6a8970999d322a8b8662f5e9'
for OID in "${WON_ID}" "${LOST_ID}"; do
  SUFFIX="pull-tt-${OID}"
  run_sql <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w."workspaceId",
  substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-tx'), 1, 24),
  'core:class:TxUpdateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-hash'), 1, 11),
  NULL,
  'core:space:Model',
  '${TASK_TYPE_ID}',
  jsonb_build_object(
    'objectClass', 'task:class:TaskType',
    'operations', jsonb_build_object(
      '\$pull', jsonb_build_object('statuses', '${OID}')
    )
  )
FROM (SELECT DISTINCT "workspaceId" FROM model_tx) w
WHERE EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w."workspaceId"
    AND m."objectId" = '${TASK_TYPE_ID}'
    AND m.data::text LIKE '%${OID}%'
)
AND NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w."workspaceId"
    AND m._id = substr(md5(w."workspaceId"::text || '${TAG}-${SUFFIX}-tx'), 1, 24)
);
SQL
done

echo "==== TxRemoveDoc orphan IssueStatus Won/Lost ===="
insert_remove_doc "${WON_ID}" 'tracker:class:IssueStatus' 'remove-won'
insert_remove_doc "${LOST_ID}" 'tracker:class:IssueStatus' 'remove-lost'

echo "==== verify remove txs present ===="
run_sql <<SQL
SELECT "objectId", "_class", _id
FROM model_tx
WHERE "objectId" IN ('${WON_ID}', '${LOST_ID}')
ORDER BY "modifiedOn";
SQL

echo "==== restart workspace + transactor + nginx ===="
docker compose up -d --force-recreate workspace transactor
sleep 6
docker restart huly_v7-nginx-1
sleep 2
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'workspace|transactor|nginx|front'
echo "cleanup done"
