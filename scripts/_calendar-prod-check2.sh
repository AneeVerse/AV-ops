#!/bin/bash
set -euo pipefail
cd /opt/huly-selfhost
set -a
# shellcheck disable=SC1091
source ./huly_v7.conf
set +a
echo "=== env keys in huly_v7.conf ==="
grep -E '^[A-Z0-9_]+=' huly_v7.conf | cut -d= -f1
echo
echo "=== google-related conf ==="
grep -iE 'google|gmail|oauth|client_id|credential' huly_v7.conf || echo '(none)'
echo
echo "=== account env google ==="
docker inspect huly_v7-account-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -iE 'GOOGLE|OAUTH|CLIENT' | sed -E 's/(SECRET|PASSWORD|KEY|CREDENTIAL).*/\1=***/I'
echo
echo "=== files ==="
ls -la /opt/huly-selfhost
echo
echo "=== cockroach connect ==="
echo "CR_USERNAME=${CR_USERNAME:-unset} CR_DATABASE=${CR_DATABASE:-unset} CR_DB_URL host part:"
echo "${CR_DB_URL:-unset}" | sed -E 's/password=[^@]+/password=***/'
echo
# Try docker exec with URL from compose
docker exec huly_v7-cockroach-1 env | grep -E 'COCKROACH_' | sed 's/PASSWORD=.*/PASSWORD=***/'
echo
# Query via psql-compatible if we have the compose env
docker compose --env-file huly_v7.conf exec -T cockroach ./cockroach sql --insecure --user="${CR_USERNAME}" --database="${CR_DATABASE}" <<'SQL' || true
SELECT _id, "modifiedOn" FROM model_tx WHERE _id LIKE '%calendar%' OR _id LIKE 'pi-%' OR _id LIKE 'plugin-configuration-%' ORDER BY "modifiedOn" DESC LIMIT 40;
SQL
