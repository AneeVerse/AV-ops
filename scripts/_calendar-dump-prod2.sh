#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
CR() { docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "$1"; }

echo "=== calendar columns ==="
CR "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='calendar' ORDER BY ordinal_position;"

echo "=== event columns ==="
CR "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='event' ORDER BY ordinal_position;"

echo "=== calendars ==="
CR "SELECT _id, _class, \"createdBy\", \"modifiedBy\", left(data::text, 400) FROM calendar LIMIT 30;"

echo "=== recent events (title/location/calendar/user) ==="
CR "SELECT _id, _class, \"createdBy\", \"modifiedOn\", left(data::text, 500) FROM event ORDER BY \"modifiedOn\" DESC LIMIT 15;"

echo "=== social ids around google user ==="
CR "SELECT _id, type, value, \"personUuid\" FROM global_account.social_id WHERE _id = '1204849581229473793' OR value ILIKE '%mayur%' OR value ILIKE '%admin%' LIMIT 20;"

echo "=== integrations (no secrets) ==="
CR "SELECT column_name FROM information_schema.columns WHERE table_schema='global_account' AND table_name='integrations';"
CR "SELECT * FROM global_account.integrations LIMIT 20;"
