#!/bin/bash
echo "=== units ==="
systemctl list-unit-files --no-pager | grep -Ei 'hermes|openclaw|novino|sales|automation|jwel' || true
echo "=== cron ==="
crontab -l 2>/dev/null || echo no_crontab
ls /etc/cron.d 2>/dev/null
echo "=== openclaw cmdline ==="
tr '\0' ' ' < /proc/2892194/cmdline 2>/dev/null || echo gone
echo
echo "=== parents ==="
ps -o pid,ppid,lstart,cmd -C node -C python -C hermes 2>/dev/null | head -5
pgrep -af 'hermes_cli|openclaw' | head -20
echo "=== medusa scripts ==="
python3 - <<'PY'
import json
p=json.load(open("/root/projects/cultura/deploy/backend/package.json"))
print(p.get("scripts"))
PY
echo "=== admin dir ==="
ls /root/projects/cultura/deploy/backend/.medusa 2>/dev/null | head
find /root/projects/cultura/deploy/backend -name index.html -path '*admin*' 2>/dev/null | head
echo "=== huly health ==="
docker ps --format '{{.Names}} {{.Status}}' | grep huly || true
