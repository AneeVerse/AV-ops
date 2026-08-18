#!/usr/bin/env bash
set -euo pipefail
echo '==== LIVE ===='
curl -sS https://huly.aneeverse.com/ | head -c 350
echo
echo
echo '==== FRONT CONTAINER ===='
docker exec huly_v7-front-1 cat /app/dist/index.html
echo
echo '==== VIEWLETS IN DB ===='
cd /opt/huly-selfhost && source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute "SELECT \"objectId\" FROM model_tx WHERE \"objectId\" IN ('tracker:viewlet:IssueStatusTable','tracker:viewlet:IssueDashboard');"
echo '==== COMPOSE FRONT IMAGE ===='
grep -A3 '  front:' /opt/huly-selfhost/compose.override.yml | head -6
echo '==== FIREWALL ===='
ufw status | head -8
echo '==== CONTAINERS ===='
docker ps --filter name=huly_v7-front --filter name=huly_v7-nginx --format 'table {{.Names}}\t{{.Status}}'
