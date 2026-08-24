-- Drop fork-only model_tx rows that point at resources the current front bundle
-- no longer registers. Without this, restoring an old URL such as
-- /workbench/local-ws/company/my-clients throws
-- ResourceNotFound tracker:resolver:CompanyLocation and the workbench never boots.
--
-- These rows were injected by SQL, not generated from the bundled model, so a plain
-- DELETE is the local equivalent of the TxRemoveDoc dance in
-- scripts/huly-cleanup-fork-model.sh (production must keep its tx history intact).
-- Idempotent: safe to run on every local start.

DELETE FROM model_tx
WHERE "objectId" IN (
  'tracker:app:Company',
  'tracker:ids:TrackerProjectChatNavModel'
);

-- Do not strip ObjectEditorFooter on Organization: CompanyRelated is restored
-- and model sync re-applies it. Deleting it here would fight every local start.
