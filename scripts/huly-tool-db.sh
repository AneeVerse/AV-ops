#!/usr/bin/env bash
set -euo pipefail
echo '==== upgrade-workspace help ===='
bash /tmp/huly-tool.sh upgrade-workspace --help 2>&1 | head -40
echo
echo '==== change-field help ===='
bash /tmp/huly-tool.sh change-field --help 2>&1 | head -40
echo
echo '==== configure help ===='
bash /tmp/huly-tool.sh configure --help 2>&1 | head -40
echo
echo '==== cockroach databases ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --insecure --execute "SHOW DATABASES;"
echo
echo '==== defaultdb tables ===='
docker exec huly_v7-cockroach-1 ./cockroach sql --insecure --execute "SHOW TABLES FROM defaultdb;" | head -80
