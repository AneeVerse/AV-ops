#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost

cat > compose.override.yml <<'YAML'
x-huly-hosts: &huly-hosts
  extra_hosts:
    - "app.aneeverse.com:host-gateway"

services:
  nginx:
    <<: *huly-hosts
    ports:
      - "0.0.0.0:8087:80"
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

# Cockroach: give selfhost rights so account DB can initialize (must use root)
CRSQL=(docker exec -e COCKROACH_USER= -e COCKROACH_PASSWORD= huly_v7-cockroach-1 ./cockroach sql --insecure --user=root)
"${CRSQL[@]}" -e "ALTER USER selfhost WITH PASSWORD '$(sed -n 's/^CR_USER_PASSWORD=//p' huly_v7.conf)';"
"${CRSQL[@]}" -e "ALTER USER selfhost CREATEDB;"
"${CRSQL[@]}" -e "GRANT admin TO selfhost;"
"${CRSQL[@]}" -e "GRANT ALL ON DATABASE defaultdb TO selfhost;"
"${CRSQL[@]}" -e "GRANT ALL ON SCHEMA public TO selfhost;"

grep -q "app.aneeverse.com" /etc/hosts || echo "127.0.0.1 app.aneeverse.com" >> /etc/hosts

docker compose --env-file huly_v7.conf up -d --force-recreate account workspace transactor fulltext kvs front nginx
sleep 8

echo "==== account logs ===="
docker compose --env-file huly_v7.conf logs --tail=20 account

PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1!"
EMAIL="admin@aneeverse.com"

chmod +x ./run-tool.sh
set +e
./run-tool.sh create-account "$EMAIL" -p "$PASS" -f Admin -l Aneeverse
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

docker compose --env-file huly_v7.conf up -d nginx

echo "==== LOGIN FILE ===="
cat /root/huly-login.txt
echo "==== HTTP CHECK ===="
curl -sI -m 10 http://127.0.0.1:8087/ | head -8
echo "DONE"
