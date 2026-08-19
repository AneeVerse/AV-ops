#!/usr/bin/env bash
# Model + data patch: Company Drive (Organizations/Projects folders, triggers, Files tabs).
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
NOW=$(date +%s%3N)
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

# Project drive folder attributes
for ATTR in \
  "tracker:class:Project_driveFolder|driveFolder|tracker:string:ProjectDriveFolder|drive:class:Folder" \
  "tracker:class:Project_productionFolder|productionFolder|tracker:string:ProductionFolder|drive:class:Folder" \
  "tracker:class:Project_distributedFolder|distributedFolder|tracker:string:DistributedFolder|drive:class:Folder" \
  "tracker:class:Project_aneerequestId|aneerequestId|tracker:string:AneerequestId|core:class:String" \
  "contact:class:Organization_driveFolder|driveFolder|contact:string:CompanyDriveFolder|drive:class:Folder" \
  "contact:class:Organization_aneerequestId|aneerequestId|contact:string:AneerequestId|core:class:String"
do
  IFS='|' read -r OID NAME LABEL TYPE <<< "$ATTR"
  ATTR_JSON="{\"attributes\":{\"_class\":\"core:class:Attribute\",\"name\":\"${NAME}\",\"attributeOf\":\"${OID%%_*}\",\"label\":\"${LABEL}\",\"type\":{\"_class\":\"core:class:RefTo\",\"label\":\"core:string:Ref\",\"icon\":\"core:icon:TypeRef\",\"to\":\"${TYPE}\"}}}"
  if [[ "$TYPE" == "core:class:String" ]]; then
    ATTR_JSON="{\"attributes\":{\"_class\":\"core:class:Attribute\",\"name\":\"${NAME}\",\"attributeOf\":\"${OID%%_*}\",\"label\":\"${LABEL}\",\"type\":{\"_class\":\"core:class:TypeString\",\"label\":\"core:string:String\"}}}"
  fi
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
done

echo '==== restart workspace + transactor ===='
docker restart huly_v7-workspace-1 huly_v7-transactor-1
sleep 12
docker restart huly_v7-nginx-1
echo '==== company drive model patch done ===='
