#!/usr/bin/env bash
# Model patch: Project-level chat (ActivityExtension + comments collection + Chat nav).
# Reuses existing ChatMessage / ActivityDoc infrastructure — no custom message store.
# Idempotent — safe to re-run.
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
NOW=$(date +%s%3N)
if [ ${#NOW} -lt 13 ]; then NOW=$(($(date +%s) * 1000)); fi

insert_doc() {
  local OID="$1"
  local DATA_JSON="$2"
  docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT w.uuid, substr(md5(w.uuid::text || '${OID}'), 1, 24), 'core:class:TxCreateDoc', 'core:space:Tx',
  'core:account:System', 'core:account:System', ${NOW}, ${NOW},
  substr(md5(w.uuid::text || '${OID}-hash'), 1, 11), NULL, 'core:space:Model', '${OID}',
  '${DATA_JSON}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (SELECT 1 FROM model_tx m WHERE m."workspaceId" = w.uuid AND m."objectId" = '${OID}');
SQL
}

insert_doc "tracker:class:Project_comments" \
  '{"objectClass":"core:class:Attribute","attributes":{"_class":"core:class:Attribute","name":"comments","attributeOf":"tracker:class:Project","label":"chunter:string:Comments","type":{"_class":"core:class:Collection","label":"chunter:string:Comments","of":"chunter:class:ChatMessage"}}}'

insert_doc "tracker:ids:ProjectActivityExtension" \
  '{"objectClass":"activity:class:ActivityExtension","attributes":{"_class":"activity:class:ActivityExtension","ofClass":"tracker:class:Project","components":{"input":{"component":"chunter:component:ChatMessageInput"}}}}'

insert_doc "tracker:ids:ProjectChatMessageViewlet" \
  '{"objectClass":"chunter:class:ChatMessageViewlet","attributes":{"_class":"chunter:class:ChatMessageViewlet","messageClass":"chunter:class:ChatMessage","objectClass":"tracker:class:Project","label":"chunter:string:LeftComment"}}'

insert_doc "tracker:ids:TrackerProjectChatNavModel" \
  '{"objectClass":"workbench:class:ApplicationNavModel","attributes":{"_class":"workbench:class:ApplicationNavModel","extends":"tracker:app:Tracker","spaces":[{"id":"projects","spaceClass":"tracker:class:Project","specials":[{"id":"chat","label":"tracker:string:ProjectChat","icon":"chunter:icon:Chunter","component":"tracker:component:ProjectChat"}]}]}}'

CHAT_SPECIAL='{"id":"chat","label":"tracker:string:ProjectChat","icon":"chunter:icon:Chunter","component":"tracker:component:ProjectChat"}'

docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" <<SQL
-- Company app: append Chat under client-tracker group specials (index 0 in fork model)
UPDATE model_tx
SET data = jsonb_set(
  data,
  '{attributes,navigatorModel,spaces,0,specials}',
  COALESCE(data->'attributes'->'navigatorModel'->'spaces'->0->'specials', '[]'::jsonb) || '${CHAT_SPECIAL}'::jsonb
),
"modifiedOn" = ${NOW}
WHERE "objectId" = 'tracker:app:Company'
  AND "_class" = 'core:class:TxCreateDoc'
  AND data->'attributes'->'navigatorModel'->'spaces'->0->>'id' = 'client-tracker'
  AND NOT (
    COALESCE(data->'attributes'->'navigatorModel'->'spaces'->0->'specials', '[]'::jsonb)
    @> '[{"id":"chat"}]'::jsonb
  );

SELECT "objectId", "_class" FROM model_tx
WHERE "objectId" IN (
  'tracker:class:Project_comments',
  'tracker:ids:ProjectActivityExtension',
  'tracker:ids:ProjectChatMessageViewlet',
  'tracker:ids:TrackerProjectChatNavModel'
);
SQL

echo '==== restart workspace + transactor ===='
docker restart huly_v7-workspace-1 huly_v7-transactor-1
sleep 12
docker restart huly_v7-nginx-1
echo '==== project chat model patch done ===='
