#!/usr/bin/env bash
set -euo pipefail
echo '==== transactor logs ===='
docker logs --tail 80 huly_v7-transactor-1 2>&1 | tail -80
echo
echo '==== workspace logs ===='
docker logs --tail 80 huly_v7-workspace-1 2>&1 | tail -80
