#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
PW=$(grep '^CR_USER_PASSWORD=' huly_v7.conf | cut -d= -f2-)
SQL=(docker exec huly_v7-cockroach-1 ./cockroach sql --url "postgres://selfhost:${PW}@127.0.0.1:26257/defaultdb?sslmode=disable")

"${SQL[@]}" -e "GRANT ALL ON DATABASE defaultdb TO selfhost;"
"${SQL[@]}" -e "GRANT ALL ON SCHEMA public TO selfhost;"
"${SQL[@]}" -e "SHOW GRANTS FOR selfhost;"

grep -q "app.aneeverse.com" /etc/hosts || echo "127.0.0.1 app.aneeverse.com" >> /etc/hosts

docker compose --env-file huly_v7.conf up -d --force-recreate account workspace transactor fulltext kvs front nginx
echo "waiting for account..."
sleep 12
echo "==== account logs ===="
docker compose --env-file huly_v7.conf logs --tail=25 account

chmod +x ./run-tool.sh
# run-tool.sh uses docker -t which breaks without TTY; run tool directly
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
echo "==== HTTP ===="
curl -sI -m 10 http://127.0.0.1:8087/ | head -8
docker compose --env-file huly_v7.conf ps
