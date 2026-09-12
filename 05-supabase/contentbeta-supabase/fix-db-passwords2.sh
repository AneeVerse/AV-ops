#!/bin/bash
set -euo pipefail
PGPASS='mQFjAnfaX78ruQ0MPrPPK0nLrYNutQtp'

echo "=== try supabase_admin login ==="
for pass in "$PGPASS" postgres your-super-secret-and-long-postgres-password; do
  if docker exec -e PGPASSWORD="$pass" contentbeta-db psql -U supabase_admin -d postgres -c 'select current_user, current_setting('\''is_superuser'\'');' 2>/dev/null; then
    echo "LOGIN_OK with pass_len=${#pass}"
    WORKING_PASS="$pass"
    break
  else
    echo "fail pass_len=${#pass}"
  fi
done

if [[ -z "${WORKING_PASS:-}" ]]; then
  echo "trying peer/local as postgres via docker exec without password"
  docker exec -i contentbeta-db psql -U postgres -d postgres -c "select rolname, rolsuper from pg_roles where rolname in ('postgres','supabase_admin');"
  # escalate via SET ROLE if possible
  docker exec -i contentbeta-db psql -U postgres -d postgres -c "SET ROLE supabase_admin; select current_user;"
fi

# Use supabase_admin with discovered password, else try SET ROLE from postgres
apply() {
  local sql="$1"
  if [[ -n "${WORKING_PASS:-}" ]]; then
    docker exec -e PGPASSWORD="$WORKING_PASS" -i contentbeta-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "$sql"
  else
    docker exec -i contentbeta-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE supabase_admin; $sql"
  fi
}

echo "=== alter passwords as superuser ==="
SQL=$(cat <<EOF
ALTER ROLE authenticator WITH PASSWORD '${PGPASS}';
ALTER ROLE supabase_auth_admin WITH PASSWORD '${PGPASS}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${PGPASS}';
ALTER ROLE supabase_admin WITH PASSWORD '${PGPASS}';
ALTER ROLE postgres WITH PASSWORD '${PGPASS}';
ALTER ROLE pgbouncer WITH PASSWORD '${PGPASS}';
SELECT 'passwords_updated' AS status;
EOF
)

if [[ -n "${WORKING_PASS:-}" ]]; then
  docker exec -e PGPASSWORD="$WORKING_PASS" -i contentbeta-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<< "$SQL"
else
  docker exec -i contentbeta-db bash -lc "psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOS'
SET ROLE supabase_admin;
ALTER ROLE authenticator WITH PASSWORD '${PGPASS}';
ALTER ROLE supabase_auth_admin WITH PASSWORD '${PGPASS}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${PGPASS}';
ALTER ROLE supabase_admin WITH PASSWORD '${PGPASS}';
ALTER ROLE postgres WITH PASSWORD '${PGPASS}';
SELECT current_user;
EOS"
fi

cd /opt/contentbeta-supabase
docker compose restart auth rest
sleep 10
docker ps --filter name=contentbeta --format 'table {{.Names}}\t{{.Status}}'
echo "=== auth ==="
docker logs contentbeta-auth 2>&1 | tail -20
echo "=== rest ==="
docker logs contentbeta-rest 2>&1 | tail -15
