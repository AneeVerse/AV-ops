# Data (JSON + SQL)

- `huly/workspace-backup.tar.gz` — official Huly backup for workspace `aneeverse` (JSON snapshots inside).
- `crm/`, `erpnext/`, `supabase/`, `postgres/` — per-table JSON. Tables over 5000 rows are listed in `index.json` only; full rows are in `sql/`.
- `sql/*.sql.gz` — full database dumps for restore.
- `n8n/workflows.json` — n8n workflows.
- n8n credentials are in the email secrets pack, not here.
