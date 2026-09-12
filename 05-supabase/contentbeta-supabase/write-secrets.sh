#!/bin/bash
set -euo pipefail
REMOTE=/opt/contentbeta-supabase
cd "$REMOTE"

ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg2NTEyMDA1LCJleHAiOjIxMDE4NzIwMDV9.ebM5IOqntSN2PI3no_RBpDo94Gbn_TFLnnLIQeKIUOs'
SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODY1MTIwMDUsImV4cCI6MjEwMTg3MjAwNX0.k4157RnwQNq7txZwfdBo-DdG0DImrBJwysSfiWsSj0k'
JWT='O9QfcJjAR+N3YBVfT7xzmF9JumrK8UhKqGpQv/HKYdE='
PGPASS='mQFjAnfaX78ruQ0MPrPPK0nLrYNutQtp'

umask 077
cat > .env <<EOF
POSTGRES_PASSWORD=$PGPASS
JWT_SECRET=$JWT
JWT_EXPIRY=3600
ANON_KEY=$ANON
SERVICE_ROLE_KEY=$SERVICE
SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_KEY=$SERVICE
PGRST_DB_SCHEMAS=public,storage,graphql_public
SUPABASE_PUBLIC_URL=https://supabase.aneeverse.com
API_EXTERNAL_URL=https://supabase.aneeverse.com
SITE_URL=https://app.aneeverse.com
ADDITIONAL_REDIRECT_URLS=http://localhost:3000,http://127.0.0.1:3000,https://app.aneeverse.com/**
DISABLE_SIGNUP=false
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=studio.aneeverse@gmail.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=ContentBeta
EOF

sed "s|\${SUPABASE_ANON_KEY}|$ANON|g; s|\${SUPABASE_SERVICE_KEY}|$SERVICE|g" volumes/api/kong.yml.tpl > volumes/api/kong.yml

echo "CONFIG_OK"
