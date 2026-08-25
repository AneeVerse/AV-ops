#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost

sed -i 's/^HTTP_BIND=.*/HTTP_BIND=/' huly_v7.conf

cat > compose.override.yml <<'YAML'
x-huly-hosts: &huly-hosts
  extra_hosts:
    - "app.aneeverse.com:host-gateway"

services:
  nginx:
    <<: *huly-hosts
  account:
    <<: *huly-hosts
  front:
    <<: *huly-hosts
  workspace:
    <<: *huly-hosts
  transactor:
    <<: *huly-hosts
  fulltext:
    <<: *huly-hosts
  stats:
    <<: *huly-hosts
  collaborator:
    <<: *huly-hosts
  kvs:
    <<: *huly-hosts
    deploy:
      resources:
        limits:
          memory: 256M
  rekoni:
    <<: *huly-hosts
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
YAML

docker compose --env-file huly_v7.conf stop nginx || true
docker rm -f huly_v7-nginx-1 || true
docker compose --env-file huly_v7.conf up -d
sleep 8

echo "==== nginx ports ===="
docker compose --env-file huly_v7.conf ps nginx
echo "==== account logs ===="
docker compose --env-file huly_v7.conf logs --tail=15 account

PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1!"
EMAIL="admin@aneeverse.com"
SECRET=$(grep '^SECRET=' huly_v7.conf | cut -d= -f2-)
CR_DB_URL=$(grep '^CR_DB_URL=' huly_v7.conf | cut -d= -f2-)
HULY_VERSION=$(grep '^HULY_VERSION=' huly_v7.conf | cut -d= -f2-)

set +e
docker run --rm --network huly_v7_huly_net \
  -e SERVER_SECRET="$SECRET" \
  -e DB_URL="$CR_DB_URL" \
  -e ACCOUNT_DB_URL="$CR_DB_URL" \
  -e STORAGE_CONFIG="minio|minio?accessKey=minioadmin&secretKey=minioadmin" \
  -e ACCOUNTS_URL="http://account:3000" \
  -e TRANSACTOR_URL="ws://transactor:3333" \
  -e QUEUE_CONFIG="redpanda:9092" \
  -e STATS_URL="http://stats:4900" \
  "hardcoreeng/tool:${HULY_VERSION}" \
  bundle.js create-account "$EMAIL" -p "$PASS" -f Admin -l Aneeverse
CREATE_RC=$?
set -e

cat > /root/huly-login.txt <<EOF
URL_HTTP=http://148.230.67.132:8087
URL_DOMAIN=http://app.aneeverse.com
URL_HTTPS=https://app.aneeverse.com
EMAIL=$EMAIL
PASSWORD=$PASS
CREATE_RC=$CREATE_RC
EOF
chmod 600 /root/huly-login.txt
echo "==== LOGIN ===="
cat /root/huly-login.txt
curl -sI -m 10 http://127.0.0.1:8087/ | head -8
echo OK
