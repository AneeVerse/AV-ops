#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
CR() { docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "$1"; }

echo "=== contact columns ==="
CR "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='contact';"

echo "=== persons for accounts ==="
CR "SELECT _id, _class, data->>'personUuid' AS pu, data->>'name' AS name, data->>'city' AS city FROM contact WHERE _class LIKE '%Person%' OR _class LIKE '%Employee%' OR data::text ILIKE '%a7ed58fc%' OR data::text ILIKE '%3e275061%' OR data::text ILIKE '%23e5cbb6%' LIMIT 40;"

echo "=== social identity in contact domain ==="
CR "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%social%';"

echo "=== owner events on HULY with meet placeholder ==="
CR "SELECT _id, calendar, data->>'title' AS title, data->>'location' AS loc, data->>'user' AS u FROM event WHERE data->>'location' ILIKE '%meet.google.com%' ORDER BY \"modifiedOn\" DESC LIMIT 20;"

echo "=== integrations ==="
CR "SELECT social_id, kind, workspace_uuid, data FROM global_account.integrations;"
