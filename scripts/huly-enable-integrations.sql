-- Re-enable the plugins that own the cards on Settings -> Integrations.
--
-- The transactor replays model_tx in modifiedOn order on top of the model baked into
-- its image. The bundled model ships gmail/telegram/calendar/github enabled, but this
-- workspace has TxUpdateDoc rows (from `dev/tool configure --disable`) turning them
-- off, and a disabled plugin's transactions are filtered out of the client model
-- (returnUITxes in foundations/core/packages/client-resources) — so every
-- setting:class:IntegrationType disappears and the Integrations page renders empty.
--
-- These rows sort after both the bundled model and the fork patch (which uses epoch
-- 1800000000000), so they win. The _id prefix is `pi-`, not the `fp-` the model patch
-- owns, so scripts/huly-model-patch.mjs will not retire them.
--
-- Idempotent: UPSERT on the same ids, safe to run on every start.

BEGIN;

UPSERT INTO model_tx ("workspaceId", _id, _class, space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data)
SELECT
  w.uuid,
  'pi-' || p.plugin,
  'core:class:TxUpdateDoc',
  'core:space:Tx',
  'core:account:System',
  'core:account:System',
  1787000000000 + p.ord,
  1787000000000 + p.ord,
  NULL,
  NULL,
  'core:space:Model',
  'plugin-configuration-' || p.plugin,
  ('{"objectClass": "core:class:PluginConfiguration", "operations": {"enabled": true}}')::jsonb
FROM (VALUES
  ('gmail', 1),
  ('telegram', 2),
  ('calendar', 3),
  ('github', 4)
) AS p(plugin, ord)
CROSS JOIN (SELECT DISTINCT "workspaceId" AS uuid FROM model_tx) AS w;

COMMIT;
