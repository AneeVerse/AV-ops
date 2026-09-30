#!/usr/bin/env python3
import os, subprocess
print("DISK:", subprocess.getoutput("df -h /").splitlines()[-1])
paths = [
    ("Cultura total", "/root/projects/cultura"),
    ("  cultura/deploy", "/root/projects/cultura/deploy"),
    ("  jwel bridge", "/root/projects/cultura/jwel_img_gen_bridge"),
    ("  jwel ui", "/root/projects/cultura/jwel_img_gen_ui"),
    ("Hermes (.hermes)", "/root/.hermes"),
    ("OpenClaw (.openclaw)", "/root/.openclaw"),
    ("Studio contentbeta", "/opt/contentbeta"),
    ("Supabase", "/opt/contentbeta-supabase"),
    ("Huly compose (/opt)", "/opt/huly-selfhost"),
    ("Obsidian web", "/opt/obsidian-web"),
    ("md vault", "/root/projects/md.aneeverse/second-brain"),
    ("n8n", "/root/.n8n"),
    ("pm2", "/root/.pm2"),
    ("projects folder", "/root/projects"),
    ("Docker data", "/var/lib/docker"),
    ("root .local", "/root/.local"),
    ("root .npm", "/root/.npm"),
    ("root .cache", "/root/.cache"),
]
for name, p in paths:
    if not os.path.exists(p):
        print(f"{name}: MISSING")
        continue
    try:
        r = subprocess.run(["du", "-sh", p], capture_output=True, text=True, timeout=120)
        size = (r.stdout or "").split()[0] if r.stdout.strip() else f"err:{r.stderr[:80]}"
        print(f"{name}: {size}", flush=True)
    except subprocess.TimeoutExpired:
        print(f"{name}: TIMEOUT (>120s)", flush=True)
print("--- docker ---", flush=True)
print(subprocess.getoutput("docker system df"), flush=True)
print("DONE", flush=True)
