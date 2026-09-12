#!/bin/bash
set -euo pipefail
PGPASS='mQFjAnfaX78ruQ0MPrPPK0nLrYNutQtp'

docker exec -i contentbeta-db psql -U postgres -d postgres <<SQL
\\du
\\dn
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('auth','public') AND table_name='users';
SELECT column_name FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position;
SQL

echo "=== reset role passwords ==="
docker exec -i contentbeta-db psql -U postgres -d postgres <<SQL
ALTER ROLE postgres WITH PASSWORD '${PGPASS}';
DO \$\$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'authenticator',
    'supabase_auth_admin',
    'supabase_storage_admin',
    'supabase_admin',
    'supabase_functions_admin',
    'authenticator',
    'pgbouncer',
    'dashboard_user'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', r, '${PGPASS}');
      RAISE NOTICE 'updated %', r;
    END IF;
  END LOOP;
END
\$\$;
SQL

echo "=== restart auth/rest ==="
cd /opt/contentbeta-supabase
docker compose restart auth rest
sleep 8
docker ps --filter name=contentbeta --format 'table {{.Names}}\t{{.Status}}'
docker logs contentbeta-auth 2>&1 | tail -15
docker logs contentbeta-rest 2>&1 | tail -10
