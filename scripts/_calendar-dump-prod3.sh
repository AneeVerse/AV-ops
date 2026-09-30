#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
CR() { docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "$1"; }

echo "=== social_id columns ==="
CR "SELECT column_name FROM information_schema.columns WHERE table_schema='global_account' AND table_name='social_id';"

echo "=== social ids of interest ==="
CR "SELECT * FROM global_account.social_id WHERE _id IN ('1204849581229473793','1202200814811283457','1202209532929703937','1204437001008250881') OR value ILIKE '%mayur%' OR value ILIKE '%admin%' LIMIT 30;"

echo "=== workspace members ==="
CR "SELECT column_name FROM information_schema.columns WHERE table_schema='global_account' AND table_name='workspace_members';"
CR "SELECT * FROM global_account.workspace_members LIMIT 20;"

echo "=== calendar hidden column ==="
CR "SELECT _id, _class, hidden, data->>'user' AS u, data->>'externalUser' AS ext, data->>'name' AS name FROM calendar;"

echo "=== google events calendar+participants ==="
CR "SELECT _id, calendar, participants, data->>'title' AS title, data->>'user' AS u, data->>'location' AS loc FROM event WHERE data->>'user' = '1204849581229473793' OR calendar LIKE '6a8f12a1%' ORDER BY \"modifiedOn\" DESC LIMIT 12;"

echo "=== integrations columns+rows ==="
CR "SELECT column_name FROM information_schema.columns WHERE table_schema='global_account' AND table_name='integrations';"
CR "SELECT kind, \"socialId\", \"workspaceUuid\", key FROM global_account.integrations LIMIT 20;"
