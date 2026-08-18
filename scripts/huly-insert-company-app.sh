#!/usr/bin/env bash
# Insert Company app + Project.company field + Organization panel tabs into live workspaces.
# Official upgrade-workspace images do not include this fork's model; this patch is required
# (same approach as huly-insert-issue-viewlets.sh).
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
NOW=$(date +%s%3N)
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

APP_JSON='{"attributes":{"_class":"workbench:class:Application","label":"tracker:string:CompanyApplication","icon":"contact:icon:Company","alias":"company","hidden":false,"navigatorModel":{"specials":[{"id":"companies","position":"top","label":"tracker:string:AllCompanies","icon":"contact:icon:Company","component":"workbench:component:SpecialView","accessLevel":"DocGuest","componentProps":{"_class":"contact:class:Organization","icon":"contact:icon:Company","label":"tracker:string:AllCompanies","createLabel":"contact:string:CreateOrganization","createComponent":"contact:component:CreateOrganization"}}],"spaces":[]}},"objectClass":"workbench:class:Application"}'

ATTR_JSON='{"attributes":{"_class":"core:class:Attribute","name":"company","attributeOf":"tracker:class:Project","label":"tracker:string:Company","type":{"_class":"core:class:RefTo","label":"core:string:Ref","icon":"core:icon:TypeRef","to":"contact:class:Organization"}},"objectClass":"core:class:Attribute"}'

MIXIN_JSON='{"attributes":{"editor":"tracker:component:CompanyRelated"},"mixin":"view:mixin:ObjectEditorFooter","objectClass":"core:class:Class"}'

docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w.uuid,
  substr(md5(w.uuid::text || 'CompanyApp-tx'), 1, 24),
  'core:class:TxCreateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w.uuid::text || 'CompanyApp-hash'), 1, 11),
  NULL,
  'core:space:Model',
  'tracker:app:Company',
  '${APP_JSON}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = 'tracker:app:Company'
);

INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w.uuid,
  substr(md5(w.uuid::text || 'ProjectCompany-tx'), 1, 24),
  'core:class:TxCreateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w.uuid::text || 'ProjectCompany-hash'), 1, 11),
  NULL,
  'core:space:Model',
  'tracker:class:Project_company',
  '${ATTR_JSON}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = 'tracker:class:Project_company'
);

INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT
  w.uuid,
  substr(md5(w.uuid::text || 'OrgCompanyFooter-tx'), 1, 24),
  'core:class:TxMixin',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  ${NOW},
  ${NOW},
  substr(md5(w.uuid::text || 'OrgCompanyFooter-hash'), 1, 11),
  NULL,
  'core:space:Model',
  'contact:class:Organization',
  '${MIXIN_JSON}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid
    AND m."objectId" = 'contact:class:Organization'
    AND m."_class" = 'core:class:TxMixin'
    AND m.data->>'mixin' = 'view:mixin:ObjectEditorFooter'
);

SELECT "workspaceId", "objectId", "_class", data->>'mixin' AS mixin
FROM model_tx
WHERE "objectId" IN ('tracker:app:Company', 'tracker:class:Project_company', 'contact:class:Organization')
  AND (
    "objectId" IN ('tracker:app:Company', 'tracker:class:Project_company')
    OR data->>'mixin' = 'view:mixin:ObjectEditorFooter'
  );

UPDATE model_tx
SET data = jsonb_set(data, '{attributes,navigatorModel,spaces}', '[]'::jsonb, true)
WHERE "objectId" = 'tracker:app:Company'
  AND "_class" = 'core:class:TxCreateDoc';
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
