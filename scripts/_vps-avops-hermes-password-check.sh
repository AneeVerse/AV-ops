#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
lines = Path("/opt/av_ops/docker/hermes_agent/.env").read_text().splitlines()
ok = any(line == "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=Dontchangeme@01" for line in lines)
print("saved", "yes" if ok else "no")
PY
code=$(curl -sk -o /tmp/hermes-login-body.txt -w '%{http_code}' -X POST https://bots.aneeverse.com/auth/password-login \
  -H 'Content-Type: application/json' \
  -d '{"provider":"basic","username":"aneeverse","password":"Dontchangeme@01","next":"/"}')
echo "auth_post ${code}"
# Do not print the body if it contains a session token. Only print keys.
python3 - <<'PY'
import json
from pathlib import Path
raw = Path("/tmp/hermes-login-body.txt").read_text()[:500]
try:
    data = json.loads(raw)
    print("body_keys", ",".join(sorted(data.keys())))
except Exception:
    print("body_prefix", raw[:80].replace("\n", " "))
PY
rm -f /tmp/hermes-login-body.txt
