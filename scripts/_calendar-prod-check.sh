#!/bin/bash
set -euo pipefail
echo "=== containers ==="
docker ps -a --format '{{.Names}}	{{.Image}}	{{.Status}}' | grep -E 'calendar|gmail|kvs|transactor|nginx|front' || true
echo
echo "=== compose override ==="
cat /opt/huly-selfhost/compose.override.yml
echo
echo "=== huly_v7.conf (redacted) ==="
grep -E 'HULY_VERSION|SECRET|CALENDAR|HOST|ACCOUNT_IMAGE' /opt/huly-selfhost/huly_v7.conf | sed 's/SECRET=.*/SECRET=***/'
echo
echo "=== .huly.nginx calendar? ==="
grep -n 'calendar\|_gmail\|_telegram' /opt/huly-selfhost/.huly.nginx || echo '(no calendar/gmail/telegram locations)'
echo
echo "=== transactor env ==="
docker inspect huly_v7-transactor-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'CALENDAR|SECRET=' | sed 's/SECRET=.*/SECRET=***/'
echo
echo "=== front env ==="
docker inspect huly_v7-front-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'CALENDAR|DISABLED|TITLE'
echo
echo "=== kvs ==="
docker ps --format '{{.Names}} {{.Status}}' | grep kvs || echo 'kvs not running'
echo
echo "=== compose.yml calendar service? ==="
grep -n 'calendar' /opt/huly-selfhost/compose.yml || echo '(no calendar in compose.yml)'
echo
echo "=== existing Credentials env anywhere? ==="
docker ps -q | while read -r id; do
  name=$(docker inspect -f '{{.Name}}' "$id")
  if docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$id" | grep -q '^Credentials='; then
    echo "FOUND Credentials on $name (value redacted)"
  fi
done
echo
echo "=== /_calendar via host nginx ==="
curl -sI https://app.aneeverse.com/_calendar/signin | head -15
echo
echo "=== /_calendar via docker nginx ==="
curl -sI http://127.0.0.1:8087/_calendar/signin | head -15
echo
echo "=== integrations plugin rows ==="
# best-effort; may fail if cockroach creds differ
set +e
docker exec huly_v7-cockroach-1 cockroach sql --insecure -e "SELECT _id, data FROM model_tx WHERE _id LIKE 'plugin-configuration-calendar%' OR _id LIKE 'pi-calendar%' ORDER BY \"modifiedOn\" LIMIT 20;" 2>/dev/null | head -40
echo done
