import json
from pathlib import Path
root = Path("/opt/av_ops/web/cultura/deploy/backend")
installed = json.loads((root / "node_modules/@medusajs/workflow-engine-redis/package.json").read_text())["version"]
print("installed", installed)
lock = root / "package-lock.json"
print("lock", lock.exists(), lock.stat().st_size if lock.exists() else 0)
if lock.exists():
    data = json.loads(lock.read_text())
    pkgs = data.get("packages") or {}
    key = "node_modules/@medusajs/workflow-engine-redis"
    print("locked", (pkgs.get(key) or {}).get("version"))
