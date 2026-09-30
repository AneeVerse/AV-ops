#!/usr/bin/env bash
set -euo pipefail
ENV_FILE=/opt/av_ops/docker/hermes_agent/.env
PASS='Dontchangeme@01'
python3 - "$ENV_FILE" "$PASS" <<'PY'
import sys
from pathlib import Path
path, password = sys.argv[1], sys.argv[2]
file = Path(path)
lines = file.read_text().splitlines()
out = []
found = False
for line in lines:
    if line.startswith("HERMES_DASHBOARD_BASIC_AUTH_PASSWORD="):
        out.append(f"HERMES_DASHBOARD_BASIC_AUTH_PASSWORD={password}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"HERMES_DASHBOARD_BASIC_AUTH_PASSWORD={password}")
file.write_text("\n".join(out) + "\n")
file.chmod(0o600)
PY
printf 'url=https://bots.aneeverse.com\nusername=aneeverse\npassword=%s\n' "$PASS" > /root/hermes-dashboard-login.txt
chmod 600 /root/hermes-dashboard-login.txt
systemctl restart hermes-dashboard
sleep 4
systemctl is-active hermes-dashboard
curl -sk -o /dev/null -w 'login_page %{http_code}\n' https://bots.aneeverse.com/login
# Confirm the new password is accepted without printing it.
code=$(curl -sk -o /dev/null -w '%{http_code}' -X POST https://bots.aneeverse.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"aneeverse\",\"password\":\"${PASS}\"}" || true)
echo "auth_post ${code}"
