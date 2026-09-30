#!/bin/bash
set -euo pipefail

echo "=== systemd /root refs ==="
grep -RhsE "WorkingDirectory=|/root/" /etc/systemd/system/*.service 2>/dev/null | grep -E "root" | sort -u || true
echo
echo "=== unit cats jwel/sales ==="
for u in jwel-img-gen-bridge jwel-img-gen-ui; do
  echo "---- $u ----"
  systemctl cat "$u" 2>/dev/null | head -25
done
echo
echo "=== pm2 dump cwd ==="
pm2 prettylist 2>/dev/null | head -5 || true
pm2 jlist > /tmp/pm2.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/pm2.json'))
for x in d:
    e=x.get('pm2_env',{})
    print(f"{x.get('name')}: cwd={e.get('pm_cwd')} script={e.get('pm_exec_path')}")
PY
echo
echo "=== odd dirs ==="
ls -la /root/ | head -80
ls -la "/root/{{.Destination}}" 2>/dev/null || echo "no Destination dir"
du -sh /root/go /root/.gradle /root/.android /root/.codex /root/.codex-proxy /root/leadgen-system 2>/dev/null
echo
echo "=== go what is ==="
ls /root/go 2>/dev/null | head
head -5 /root/package.json 2>/dev/null || true
