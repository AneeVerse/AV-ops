#!/usr/bin/env bash
# Runs ON THE VPS. Enables Huly Google Calendar sync:
#   - nginx /_calendar
#   - transactor CALENDAR_URL
#   - calendar container (stock hardcoreeng/calendar)
#   - integrations plugin enable-rows
#
# Requires /opt/huly-selfhost/secrets/calendar-credentials.json
# (Google OAuth "Web application" client JSON with redirect
#  https://app.aneeverse.com/_calendar/signin/code).
set -euo pipefail

STACK=/opt/huly-selfhost
CONF="$STACK/huly_v7.conf"
OVERRIDE="$STACK/compose.override.yml"
NGINX="$STACK/.huly.nginx"
CREDS_JSON="$STACK/secrets/calendar-credentials.json"
CREDS_ENV="$STACK/secrets/calendar.env"
STAMP=$(date +%Y%m%d%H%M%S)

say() { echo "==== $* ===="; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$CONF" ] || die "missing $CONF"
# shellcheck disable=SC1090
source "$CONF"
: "${HULY_VERSION:?}"
: "${SECRET:?}"
: "${DOCKER_NAME:?}"

[ -s "$CREDS_JSON" ] || die "missing $CREDS_JSON (Google OAuth web client JSON)"

python3 - "$CREDS_JSON" <<'PY' || die "credentials JSON is not a web OAuth client"
import json, sys
p = sys.argv[1]
d = json.load(open(p))
web = d.get("web") or {}
need = ["client_id", "client_secret", "redirect_uris"]
missing = [k for k in need if not web.get(k)]
if missing:
    raise SystemExit(f"credentials.web missing {missing}")
uris = web["redirect_uris"]
want = "https://app.aneeverse.com/_calendar/signin/code"
if want not in uris:
    raise SystemExit(f"redirect_uris must include {want}, got {uris}")
print("credentials ok", web["client_id"].split("-")[0] + "-…")
PY

mkdir -p "$STACK/secrets" "$STACK/backups"
chmod 700 "$STACK/secrets"
cp -a "$OVERRIDE" "$STACK/backups/compose.override.yml.$STAMP"
cp -a "$NGINX" "$STACK/backups/.huly.nginx.$STAMP"
cp -a "$CONF" "$STACK/backups/huly_v7.conf.$STAMP"

# One-line Credentials env for the calendar container.
python3 - "$CREDS_JSON" "$CREDS_ENV" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
# Compact JSON, no newlines, docker env_file takes everything after first =
line = json.dumps(d, separators=(",", ":"))
open(sys.argv[2], "w").write("Credentials=" + line + "\n")
PY
chmod 600 "$CREDS_ENV"

say "patch nginx /_calendar"
if grep -q 'location /_calendar' "$NGINX"; then
  echo "nginx /_calendar already present"
else
  python3 - "$NGINX" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
text = p.read_text()
block = '''
    location /_calendar {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        rewrite ^/_calendar(/.*)$ $1 break;
        proxy_pass http://calendar:8095/;
    }

'''
needle = "    location /_collaborator {"
if needle not in text:
    raise SystemExit("could not find /_collaborator block to insert before")
p.write_text(text.replace(needle, block + needle, 1))
print("inserted /_calendar")
PY
fi

say "patch compose.override.yml"
python3 - "$OVERRIDE" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
text = p.read_text()
changed = False

# transactor CALENDAR_URL next to existing MAIL_URL
if "CALENDAR_URL=http://calendar:8095" not in text:
    old = """  transactor:
    <<: *huly-hosts
    environment:
      - MAIL_URL=http://mail:8097
"""
    new = """  transactor:
    <<: *huly-hosts
    environment:
      - MAIL_URL=http://mail:8097
      - CALENDAR_URL=http://calendar:8095
"""
    if old not in text:
        raise SystemExit("transactor environment block not found as expected")
    text = text.replace(old, new, 1)
    changed = True
    print("added transactor CALENDAR_URL")
else:
    print("transactor CALENDAR_URL already present")

if "\n  calendar:" not in text and not text.startswith("  calendar:"):
    calendar = '''
  calendar:
    image: hardcoreeng/calendar:${HULY_VERSION}
    extra_hosts:
      - "app.aneeverse.com:host-gateway"
    env_file:
      - secrets/calendar.env
    environment:
      - SECRET=${SECRET}
      - ACCOUNTS_URL=http://account:3000
      - KVS_URL=http://kvs:8094
      - WATCH_URL=https://app.aneeverse.com/_calendar/push
      - SERVICE_ID=calendar-service
    restart: unless-stopped
    networks:
      - huly_net
    deploy:
      resources:
        limits:
          memory: 256M
'''
    text = text.rstrip() + "\n" + calendar
    changed = True
    print("added calendar service")
else:
    print("calendar service already present")

if changed:
    p.write_text(text)
PY

say "apply integrations SQL (idempotent)"
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
if [ -f /tmp/huly-enable-integrations.sql ]; then
  docker exec -i huly_v7-cockroach-1 ./cockroach sql --url "$URL_LOCAL" < /tmp/huly-enable-integrations.sql
else
  echo "WARNING: /tmp/huly-enable-integrations.sql missing, skip"
fi

say "compose up calendar + transactor + nginx"
cd "$STACK"
docker compose --env-file huly_v7.conf up -d calendar transactor nginx

say "wait for calendar"
for i in $(seq 1 30); do
  if docker inspect -f '{{.State.Status}}' "${DOCKER_NAME}-calendar-1" 2>/dev/null | grep -q running; then
    break
  fi
  sleep 2
done
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'calendar|transactor|nginx' || true
echo "---- calendar logs ----"
docker logs --tail 40 "${DOCKER_NAME}-calendar-1" || true

say "probe /_calendar/signin (401 without token is healthy)"
curl -sS -o /tmp/cal-signin.out -w "https=%{http_code}\n" https://app.aneeverse.com/_calendar/signin || true
curl -sS -o /tmp/cal-signin-int.out -w "internal=%{http_code}\n" http://127.0.0.1:8087/_calendar/signin || true
head -c 200 /tmp/cal-signin.out; echo
