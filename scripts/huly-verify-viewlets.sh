#!/usr/bin/env bash
set -euo pipefail
echo '==== our txs in logs ===='
docker logs huly_v7-transactor-1 2>&1 | grep -E 'IssueStatusTable|IssueDashboard|failed to apply model' | tail -30
echo
echo '==== generate token ===='
bash /tmp/huly-tool.sh generate-token --help 2>&1 | head -30
