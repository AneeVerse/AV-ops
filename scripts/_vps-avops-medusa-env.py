import json
from pathlib import Path

dump = json.loads(Path("/root/vps-restore-backup/infra/pm2-dump.pm2").read_text())
for app in dump:
    name = app.get("name")
    if name not in ("backend", "frontend", "contentbeta"):
        continue
    env = app.get("pm2_env") or {}
    print("NAME", name)
    print("cwd", env.get("pm_cwd"))
    print("script", env.get("pm_exec_path"))
    print("args", env.get("args"))
    print("node_env", (env.get("env") or {}).get("NODE_ENV"))
    keys = sorted((env.get("env") or {}).keys())
    print("env_keys", ",".join(keys))

cfg = Path("/opt/av_ops/web/cultura/deploy/backend")
print("--- dotenv keys ---")
envf = cfg / ".env"
if envf.exists():
    keys = []
    for line in envf.read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            keys.append(line.split("=", 1)[0])
    print(",".join(keys))
else:
    print("NO_ENV")
print("--- config env refs ---")
for name in ("medusa-config.ts", "medusa-config.js"):
    p = cfg / name
    if p.exists():
        text = p.read_text()
        refs = sorted(set(__import__("re").findall(r"process\.env\.([A-Z0-9_]+)", text)))
        print(name, ",".join(refs))
