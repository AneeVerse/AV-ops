#!/bin/bash
python3 - <<'PY'
import os
root="/root/projects/cultura/deploy/backend/node_modules/@medusajs/medusa"
for dirpath, dirs, files in os.walk(root):
    if "node_modules" in dirpath:
        continue
    for f in files:
        if f.endswith((".js",".mjs",".cjs")) and "admin" in f.lower():
            p=os.path.join(dirpath,f)
            if os.path.getsize(p) < 400000:
                t=open(p,errors="ignore").read()
                if "serveProductionBuild" in t or "outDir" in t and "admin" in t:
                    print("FILE", p)
PY
echo "=== grep outDir near serve ==="
grep -n "serve(" -n /root/projects/cultura/deploy/backend/node_modules/@medusajs/medusa/dist/loaders/admin.js | head
ls /root/projects/cultura/deploy/backend/node_modules/@medusajs/medusa/dist/loaders/ | head
