#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="app.aneeverse.com"
HTTP_PORT="8087"
INSTALL_DIR="/opt/huly-selfhost"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl gettext-base openssl ca-certificates >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required"
  exit 1
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
  git clone --depth 1 https://github.com/hcengineering/huly-selfhost.git "$INSTALL_DIR"
else
  git -C "$INSTALL_DIR" pull --ff-only || true
fi

cd "$INSTALL_DIR"

[ -f .huly.secret ] || openssl rand -hex 32 > .huly.secret
[ -f .cr.secret ] || openssl rand -hex 32 > .cr.secret
[ -f .rp.secret ] || openssl rand -hex 32 > .rp.secret

export HOST_ADDRESS="$HOST_NAME"
export SECURE="true"
export HTTP_PORT
export HTTP_BIND="127.0.0.1"
export TITLE="Huly"
export DEFAULT_LANGUAGE="en"
export LAST_NAME_FIRST="true"
export CR_DATABASE="defaultdb"
export CR_USERNAME="selfhost"
export REDPANDA_ADMIN_USER="superadmin"
export VOLUME_ELASTIC_PATH=""
export VOLUME_FILES_PATH=""
export VOLUME_CR_DATA_PATH=""
export VOLUME_CR_CERTS_PATH=""
export VOLUME_REDPANDA_PATH=""
export HULY_SECRET
HULY_SECRET="$(cat .huly.secret)"
export COCKROACH_SECRET
COCKROACH_SECRET="$(cat .cr.secret)"
export REDPANDA_SECRET
REDPANDA_SECRET="$(cat .rp.secret)"

envsubst < .template.huly.conf > huly_v7.conf
ln -sfn huly_v7.conf .env

# Keep Huly's docker nginx on localhost only so host nginx can terminate TLS.
cat > compose.override.yml <<'YAML'
services:
  nginx:
    ports:
      - "127.0.0.1:8087:80"
  elastic:
    environment:
      - ES_JAVA_OPTS=-Xms256m -Xmx256m
    deploy:
      resources:
        limits:
          memory: 512M
  cockroach:
    command: start-single-node --accept-sql-without-tls --cache=256MiB --max-sql-memory=256MiB
    deploy:
      resources:
        limits:
          memory: 768M
  redpanda:
    deploy:
      resources:
        limits:
          memory: 512M
  minio:
    deploy:
      resources:
        limits:
          memory: 256M
  kvs:
    ports:
      - "127.0.0.1:8094:8094"
    deploy:
      resources:
        limits:
          memory: 256M
YAML

echo "Pulling and starting Huly containers..."
docker compose --env-file huly_v7.conf up -d --pull always

cat > /etc/nginx/sites-available/app.aneeverse.com <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name app.aneeverse.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:8087;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        client_max_body_size 200m;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/app.aneeverse.com /etc/nginx/sites-enabled/app.aneeverse.com
nginx -t
nginx -s reload

echo "HULY_INSTALL_OK"
docker compose --env-file huly_v7.conf ps
