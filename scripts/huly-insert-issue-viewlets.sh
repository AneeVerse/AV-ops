#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
NOW=$(date +%s%3N)
# fallback if date %3N unsupported
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w.uuid,
  substr(md5(w.uuid::text || 'IssueStatusTable-tx'), 1, 24),
  'core:class:TxCreateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w.uuid::text || 'IssueStatusTable-hash'), 1, 11),
  NULL,
  'core:space:Model',
  'tracker:viewlet:IssueStatusTable',
  '{"attributes":{"_class":"view:class:Viewlet","attachTo":"tracker:class:Issue","config":["","identifier","title","status","priority","assignee","dueDate","modifiedOn"],"descriptor":"task:viewlet:StatusTable","viewOptions":{"groupBy":[],"orderBy":[],"other":[{"key":"hideArchived","type":"toggle","defaultValue":true,"actionTarget":"options","action":"view:function:HideArchived","label":"view:string:HideArchived"}]},"configOptions":{"sortable":true}},"objectClass":"view:class:Viewlet"}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = 'tracker:viewlet:IssueStatusTable'
);

INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w.uuid,
  substr(md5(w.uuid::text || 'IssueDashboard-tx'), 1, 24),
  'core:class:TxCreateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w.uuid::text || 'IssueDashboard-hash'), 1, 11),
  NULL,
  'core:space:Model',
  'tracker:viewlet:IssueDashboard',
  '{"attributes":{"_class":"view:class:Viewlet","attachTo":"tracker:class:Issue","options":{},"config":[],"descriptor":"task:viewlet:Dashboard"},"objectClass":"view:class:Viewlet"}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = 'tracker:viewlet:IssueDashboard'
);

SELECT "workspaceId", "objectId", "_class" FROM model_tx
WHERE "objectId" IN ('tracker:viewlet:IssueStatusTable', 'tracker:viewlet:IssueDashboard');
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
