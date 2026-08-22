#!/usr/bin/env bash
# Undo fork-only model_tx patches so the simplified front bundle can load.
# Safe to re-run (idempotent). Does NOT delete workspace business data.
#
# Run on VPS from repo: bash scripts/huly-cleanup-fork-model.sh
# One-off from 2026-08-22. Run manually on the VPS if ever needed again:
#   scp huly-cleanup-fork-model.sh root@<vps>:/tmp/ && ssh root@<vps> 'bash /tmp/huly-cleanup-fork-model.sh'
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
NOW=$(date +%s%3N)
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

insert_remove_doc() {
  local OID="$1"
  local OCLASS="$2"
  local TAG="$3"
  docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w.uuid,
  substr(md5(w.uuid::text || '${TAG}-tx'), 1, 24),
  'core:class:TxRemoveDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w.uuid::text || '${TAG}-hash'), 1, 11),
  NULL,
  'core:space:Model',
  '${OID}',
  jsonb_build_object('objectClass', '${OCLASS}')
FROM global_account.workspace w
WHERE EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid
    AND m."objectId" = '${OID}'
    AND m."_class" = 'core:class:TxCreateDoc'
)
AND NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid
    AND m."objectId" = '${OID}'
    AND m."_class" = 'core:class:TxRemoveDoc'
);
SQL
}

echo '==== hide Company app (sidebar) ===='
docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
UPDATE model_tx
SET
  data = jsonb_set(COALESCE(data, '{}'::jsonb), '{attributes,hidden}', 'true'::jsonb, true),
  "modifiedOn" = ${NOW}
WHERE "objectId" = 'tracker:app:Company'
  AND "_class" = 'core:class:TxCreateDoc'
  AND COALESCE(data->'attributes'->>'hidden', 'false') <> 'true';
SQL

echo '==== remove Company app from model (prevents /company routes loading fork nav) ===='
insert_remove_doc 'tracker:app:Company' 'workbench:class:Application' 'RemoveCompanyApp'

echo '==== remove Project Chat nav merge ===='
insert_remove_doc 'tracker:ids:TrackerProjectChatNavModel' 'workbench:class:ApplicationNavModel' 'RemoveTrackerProjectChatNavModel'

echo '==== strip removed component mixins ===='
docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
UPDATE model_tx
SET
  data = data #- '{attributes,editor}',
  "modifiedOn" = ${NOW}
WHERE "objectId" = 'contact:class:Organization'
  AND "_class" = 'core:class:TxMixin'
  AND data->>'mixin' = 'view:mixin:ObjectEditorFooter'
  AND data->'attributes' ? 'editor';

UPDATE model_tx
SET
  data = data #- '{attributes,presenter}',
  "modifiedOn" = ${NOW}
WHERE "objectId" IN ('tracker:class:TypeRequestStatus', 'tracker:class:TypeRequestPriority')
  AND "_class" = 'core:class:TxMixin'
  AND data->>'mixin' = 'view:mixin:AttributePresenter'
  AND data->'attributes' ? 'presenter';
SQL

echo '==== verify ===='
docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<'SQL'
SELECT "workspaceId", "objectId", "_class", data->'attributes'->>'hidden' AS hidden
FROM model_tx
WHERE "objectId" = 'tracker:app:Company'
ORDER BY "workspaceId", "_class";

SELECT "workspaceId", "objectId", "_class"
FROM model_tx
WHERE "objectId" = 'tracker:ids:TrackerProjectChatNavModel'
ORDER BY "workspaceId", "_class";

SELECT "workspaceId", "objectId", data->'attributes'->>'editor' AS editor, data->'attributes'->>'presenter' AS presenter
FROM model_tx
WHERE (
  ("objectId" = 'contact:class:Organization' AND data->>'mixin' = 'view:mixin:ObjectEditorFooter')
  OR ("objectId" IN ('tracker:class:TypeRequestStatus', 'tracker:class:TypeRequestPriority') AND data->>'mixin' = 'view:mixin:AttributePresenter')
)
ORDER BY 1, 2;
SQL

echo '==== restart workspace + transactor ===='
docker restart huly_v7-workspace-1 huly_v7-transactor-1
sleep 12
echo '==== restart nginx ===='
docker restart huly_v7-nginx-1
sleep 5
docker ps --filter name=huly_v7-workspace --filter name=huly_v7-transactor --filter name=huly_v7-nginx --format 'table {{.Names}}\t{{.Status}}'
echo '==== public ===='
curl -sS -o /dev/null -w 'site:%{http_code}\n' https://huly.aneeverse.com/ || true
echo '==== fork model cleanup done ===='
