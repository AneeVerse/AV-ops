#!/bin/bash
set -euo pipefail
cd /opt/contentbeta-supabase

echo "=== container status ==="
docker ps --filter name=contentbeta --format 'table {{.Names}}\t{{.Status}}'

echo "=== auth logs ==="
docker logs contentbeta-auth 2>&1 | tail -40 || true
echo "=== rest logs ==="
docker logs contentbeta-rest 2>&1 | tail -20 || true
echo "=== kong logs ==="
docker logs contentbeta-kong 2>&1 | tail -20 || true

echo "=== apply SQL ==="
for f in sql/01_schema.sql sql/02_rls.sql sql/03_brand_system_jobs.sql sql/04_brand_page_access.sql sql/05_ui_walkthrough.sql sql/06_cloud_data.sql sql/07_auth_user.sql; do
  echo "APPLY $f"
  docker exec -i contentbeta-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done
echo SQL_OK

echo "=== counts ==="
docker exec -i contentbeta-db psql -U postgres -d postgres -c "select 'brands' t, count(*) from public.brands union all select 'admins', count(*) from public.admins union all select 'generated_posts', count(*) from public.generated_posts union all select 'auth.users', count(*) from auth.users;"
