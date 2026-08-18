#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
echo '==== tool help ===='
./run-tool.sh --help 2>&1 | head -80 || true
echo
echo '==== cockroach dbs ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --insecure -e "SHOW DATABASES;" 2>/dev/null | head -40
echo
echo '==== account workspaces ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --insecure -e "SELECT datname FROM pg_database;" 2>/dev/null | head -40
