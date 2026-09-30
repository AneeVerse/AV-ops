#!/usr/bin/env bash
set -euo pipefail
echo "=== running images ==="
docker ps --format '{{.Names}} {{.Image}}'
echo "=== prune build cache ==="
docker builder prune -f
echo "=== unused custom images ==="
python3 - <<'PY'
import subprocess
ps = subprocess.check_output(["docker", "ps", "--format", "{{.Image}}"], text=True).splitlines()
used = set(ps)
out = subprocess.check_output(
    ["docker", "images", "--format", "{{.Repository}}:{{.Tag}} {{.ID}}"], text=True
)
removed = 0
for line in out.splitlines():
    if not line.strip():
        continue
    ref, iid = line.rsplit(" ", 1)
    repo = ref.split(":")[0]
    if repo not in ("huly-front-custom", "huly-account-custom"):
        continue
    if ref in used or iid in used:
        print("keep", ref)
        continue
    print("remove", ref)
    subprocess.check_call(["docker", "rmi", ref])
    removed += 1
print("removed", removed)
PY
df -h / | tail -1
