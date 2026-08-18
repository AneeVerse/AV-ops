#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" --execute \
  "SELECT \"workspaceId\", \"objectId\", \"_class\" FROM model_tx WHERE \"objectId\" IN ('tracker:viewlet:IssueStatusTable','tracker:viewlet:IssueDashboard');"
