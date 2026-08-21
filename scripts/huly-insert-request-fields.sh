#!/usr/bin/env bash
# Model patch: Request lifecycle fields on Tracker Project (Request = Project).
# Idempotent — safe to re-run. Official images do not include this fork model.
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
NOW=$(date +%s%3N)
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

insert_attr() {
  local OID="$1"
  local NAME="$2"
  local LABEL="$3"
  local ATTR_JSON="$4"
  docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT w.uuid, substr(md5(w.uuid::text || '${OID}'), 1, 24), 'core:class:TxCreateDoc', 'core:space:Tx',
  'core:account:System', 'core:account:System', ${NOW}, ${NOW},
  substr(md5(w.uuid::text || '${OID}-hash'), 1, 11), NULL, 'core:space:Model', '${OID}',
  '${ATTR_JSON}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (SELECT 1 FROM model_tx m WHERE m."workspaceId" = w.uuid AND m."objectId" = '${OID}');
SQL
}

# Type classes (enum-backed number types)
insert_attr "tracker:class:TypeRequestStatus" "_class" "tracker:string:RequestStatus" \
  '{"objectClass":"core:class:Class","attributes":{"_class":"core:class:Class","kind":0,"label":"tracker:string:RequestStatus","extends":"core:class:Type","domain":"model"}}'

insert_attr "tracker:class:TypeRequestPriority" "_class" "tracker:string:RequestPriority" \
  '{"objectClass":"core:class:Class","attributes":{"_class":"core:class:Class","kind":0,"label":"tracker:string:RequestPriority","extends":"core:class:Type","domain":"model"}}'

# Project attributes
insert_attr "tracker:class:Project_requestStatus" "requestStatus" "tracker:string:RequestStatus" \
  '{"objectClass":"core:class:Attribute","attributes":{"_class":"core:class:Attribute","name":"requestStatus","attributeOf":"tracker:class:Project","label":"tracker:string:RequestStatus","type":{"_class":"tracker:class:TypeRequestStatus","label":"tracker:string:RequestStatus"}}}'

insert_attr "tracker:class:Project_requestPriority" "requestPriority" "tracker:string:RequestPriority" \
  '{"objectClass":"core:class:Attribute","attributes":{"_class":"core:class:Attribute","name":"requestPriority","attributeOf":"tracker:class:Project","label":"tracker:string:RequestPriority","type":{"_class":"tracker:class:TypeRequestPriority","label":"tracker:string:RequestPriority"}}}'

insert_attr "tracker:class:Project_requestDueDate" "requestDueDate" "tracker:string:RequestDueDate" \
  '{"objectClass":"core:class:Attribute","attributes":{"_class":"core:class:Attribute","name":"requestDueDate","attributeOf":"tracker:class:Project","label":"tracker:string:RequestDueDate","type":{"_class":"core:class:TypeDate","label":"core:string:Date"}}}'

insert_attr "tracker:class:Project_requestAssignee" "requestAssignee" "tracker:string:RequestAssignee" \
  '{"objectClass":"core:class:Attribute","attributes":{"_class":"core:class:Attribute","name":"requestAssignee","attributeOf":"tracker:class:Project","label":"tracker:string:RequestAssignee","type":{"_class":"core:class:RefTo","label":"core:string:Ref","icon":"core:icon:TypeRef","to":"contact:mixin:Employee"}}}'

# Presenter mixins for enum types
docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT w.uuid, substr(md5(w.uuid::text || 'TypeRequestStatus-presenter'), 1, 24), 'core:class:TxMixin', 'core:space:Tx',
  'core:account:System', 'core:account:System', ${NOW}, ${NOW},
  substr(md5(w.uuid::text || 'TypeRequestStatus-presenter-hash'), 1, 11), NULL, 'core:space:Model',
  'tracker:class:TypeRequestStatus',
  '{"objectClass":"core:class:Class","mixin":"view:mixin:AttributePresenter","attributes":{"presenter":"tracker:component:RequestStatusPresenter"}}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = 'tracker:class:TypeRequestStatus'
    AND m."_class" = 'core:class:TxMixin' AND m.data->>'mixin' = 'view:mixin:AttributePresenter'
);

INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT w.uuid, substr(md5(w.uuid::text || 'TypeRequestPriority-presenter'), 1, 24), 'core:class:TxMixin', 'core:space:Tx',
  'core:account:System', 'core:account:System', ${NOW}, ${NOW},
  substr(md5(w.uuid::text || 'TypeRequestPriority-presenter-hash'), 1, 11), NULL, 'core:space:Model',
  'tracker:class:TypeRequestPriority',
  '{"objectClass":"core:class:Class","mixin":"view:mixin:AttributePresenter","attributes":{"presenter":"tracker:component:RequestPriorityPresenter"}}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = 'tracker:class:TypeRequestPriority'
    AND m."_class" = 'core:class:TxMixin' AND m.data->>'mixin' = 'view:mixin:AttributePresenter'
);
SQL

echo '==== restart workspace + transactor ===='
docker restart huly_v7-workspace-1 huly_v7-transactor-1
sleep 12
docker restart huly_v7-nginx-1
echo '==== request fields model patch done ===='
