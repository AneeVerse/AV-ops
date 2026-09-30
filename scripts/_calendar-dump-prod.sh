#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
CR() { docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "$1"; }

echo "=== tables matching calendar/event ==="
CR "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%calendar%' OR table_name ILIKE '%event%' OR table_name = 'doc' ORDER BY table_schema, table_name;"

echo "=== all tables ==="
CR "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog','crdb_internal') ORDER BY table_schema, table_name;"
