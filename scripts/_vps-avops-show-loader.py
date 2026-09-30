from pathlib import Path
text = Path("/opt/av_ops/web/cultura/deploy/backend/node_modules/@medusajs/modules-sdk/dist/loaders/utils/load-internal.js").read_text()
lines = text.splitlines()
for i, line in enumerate(lines, 1):
    if "url" in line and ("destruct" in line or "database" in line or "const {" in line or ".url" in line):
        if 1:
            print(f"{i}:{line[:200]}")
