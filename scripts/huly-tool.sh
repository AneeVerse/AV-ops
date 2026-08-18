#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
NETWORK="${DOCKER_NAME}_huly_net"
STORAGE_CONFIG="minio|minio?accessKey=minioadmin&secretKey=minioadmin"

docker run --rm \
    --network "$NETWORK" \
    -e SERVER_SECRET="$SECRET" \
    -e DB_URL="$CR_DB_URL" \
    -e ACCOUNT_DB_URL="$CR_DB_URL" \
    -e STORAGE_CONFIG="$STORAGE_CONFIG" \
    -e ACCOUNTS_URL="http://account:3000" \
    -e TRANSACTOR_URL="ws://transactor:3333" \
    -e QUEUE_CONFIG="redpanda:9092" \
    -e STATS_URL="http://stats:4900" \
    "hardcoreeng/tool:${HULY_VERSION}" \
    bundle.js "$@"
