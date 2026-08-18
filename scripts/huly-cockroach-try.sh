#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
PW=$(grep '^CR_USER_PASSWORD=' huly_v7.conf | cut -d= -f2-)
echo "try selfhost"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "postgres://selfhost:${PW}@127.0.0.1:26257/defaultdb?sslmode=disable" -e "SHOW USERS;" || echo FAIL_SELFHOST
echo "try root with same pw"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "postgres://root:${PW}@127.0.0.1:26257/defaultdb?sslmode=disable" -e "SHOW USERS;" || echo FAIL_ROOT_PW
echo "try root no pw"
docker exec huly_v7-cockroach-1 ./cockroach sql --url "postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable" -e "SHOW USERS;" || echo FAIL_ROOT_NOPW
