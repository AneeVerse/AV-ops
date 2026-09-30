from pathlib import Path
root = Path("/opt/av_ops/web/cultura/deploy/backend/node_modules/@medusajs/workflow-engine-redis")
print("exists", root.exists())
if not root.exists():
    raise SystemExit(0)
for p in root.rglob("*.js"):
    text = p.read_text(errors="ignore")
    if "url" in text and ("redis" in text or "destruct" in text):
        print("FILE", p.relative_to(root))
        for i, line in enumerate(text.splitlines(), 1):
            if "url" in line:
                print(f"  {i}:{line.strip()[:180]}")
