#!/bin/bash
set -euo pipefail
cd /opt/contentbeta-supabase

ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg2NTEyMDA1LCJleHAiOjIxMDE4NzIwMDV9.ebM5IOqntSN2PI3no_RBpDo94Gbn_TFLnnLIQeKIUOs'
SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODY1MTIwMDUsImV4cCI6MjEwMTg3MjAwNX0.k4157RnwQNq7txZwfdBo-DdG0DImrBJwysSfiWsSj0k'
JWT='O9QfcJjAR+N3YBVfT7xzmF9JumrK8UhKqGpQv/HKYdE='
PGPASS='mQFjAnfaX78ruQ0MPrPPK0nLrYNutQtp'

echo "=== migrate auth user ==="
docker exec -i contentbeta-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < sql/07_auth_user.sql

echo "=== counts ==="
docker exec -i contentbeta-db psql -U postgres -d postgres <<'SQL'
SELECT 'brands' AS t, count(*) FROM public.brands
UNION ALL SELECT 'admins', count(*) FROM public.admins
UNION ALL SELECT 'brand_profiles', count(*) FROM public.brand_profiles
UNION ALL SELECT 'generated_posts', count(*) FROM public.generated_posts
UNION ALL SELECT 'reference_layouts', count(*) FROM public.reference_layouts
UNION ALL SELECT 'carousel_slide_prompts', count(*) FROM public.carousel_slide_prompts
UNION ALL SELECT 'auth.users', count(*) FROM auth.users
UNION ALL SELECT 'auth.identities', count(*) FROM auth.identities;
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users;
SQL

echo "=== nginx http bootstrap ==="
cat > /etc/nginx/sites-available/supabase.aneeverse.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name supabase.aneeverse.com;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/supabase.aneeverse.com /etc/nginx/sites-enabled/supabase.aneeverse.com
nginx -t
systemctl reload nginx

echo "=== certbot ==="
certbot --nginx -d supabase.aneeverse.com --non-interactive --agree-tos -m studio.aneeverse@gmail.com --redirect || true

echo "=== smoke ==="
sleep 2
curl -sS -o /tmp/rest.json -w 'local_rest:%{http_code}\n' "http://127.0.0.1:8000/rest/v1/brands?select=id,name" \
  -H "apikey: $ANON" -H "Authorization: Bearer $SERVICE"
cat /tmp/rest.json; echo
curl -sS -o /tmp/auth.json -w 'local_auth:%{http_code}\n' "http://127.0.0.1:8000/auth/v1/settings" -H "apikey: $ANON"
head -c 200 /tmp/auth.json; echo
curl -sS -o /tmp/rest_https.json -w 'https_rest:%{http_code}\n' "https://supabase.aneeverse.com/rest/v1/brands?select=id,name" \
  -H "apikey: $ANON" -H "Authorization: Bearer $SERVICE" || true
cat /tmp/rest_https.json 2>/dev/null; echo
curl -sS -o /tmp/auth_https.json -w 'https_auth:%{http_code}\n' "https://supabase.aneeverse.com/auth/v1/settings" -H "apikey: $ANON" || true

umask 077
cat > /opt/contentbeta-supabase/CONTENTBETA_KEYS.txt <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://supabase.aneeverse.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
POSTGRES_PASSWORD=$PGPASS
JWT_SECRET=$JWT
EOF
chmod 600 /opt/contentbeta-supabase/CONTENTBETA_KEYS.txt
echo DONE
