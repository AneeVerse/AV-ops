#!/usr/bin/env python3
import json
import os
import subprocess

def sh(cmd, t=60):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=t)
    return p.stdout or ""

print("=== NGINX SITES ===")
for name in sorted(os.listdir("/etc/nginx/sites-enabled")):
    path = f"/etc/nginx/sites-enabled/{name}"
    print(f"\n# {name}")
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                s = line.strip()
                if any(k in s for k in ("server_name", "proxy_pass", "root ", "listen ", "unix:")) and not s.startswith("#"):
                    print(" ", s[:160])
    except Exception as e:
        print(" ", e)

print("\n=== SYSTEMD CUSTOM ===")
for name in sorted(os.listdir("/etc/systemd/system")):
    if name.endswith(".service") and not name.startswith("dbus-"):
        print(name, "->", sh(["systemctl", "is-active", name], 10).strip(), sh(["systemctl", "is-enabled", name], 10).strip())

print("\n=== USER SERVICES RUNNING ===")
env = {**os.environ, "XDG_RUNTIME_DIR": "/run/user/0"}
print(sh(["systemctl", "--user", "list-units", "--type=service", "--state=running", "--no-pager", "--no-legend"], 30))

print("\n=== PM2 ===")
try:
    data = json.loads(sh(["pm2", "jlist"], 30) or "[]")
    for p in data:
        e = p.get("pm2_env") or {}
        print(p.get("name"), e.get("status"), e.get("pm_cwd"), e.get("script") or e.get("pm_exec_path"))
except Exception as e:
    print("pm2 err", e)

print("\n=== DOCKER ===")
print(sh(["timeout", "25", "docker", "ps", "-a", "--format", "{{.Names}} | {{.Image}} | {{.Status}}"], 35))

print("\n=== OPT SIZES ===")
print(sh(["bash", "-lc", "du -xh --max-depth=1 /opt 2>/dev/null | sort -hr | head -20"], 60))

print("\n=== ROOT PROJECTISH ===")
for name in sorted(os.listdir("/root")):
    if name.startswith("."):
        continue
    p = f"/root/{name}"
    if os.path.isdir(p) or name.endswith((".py", ".sh", ".yml", ".service")):
        print(name)

print("\n=== DISK/NPM/DOCKER CACHE HINTS ===")
print("df", sh(["df", "-h", "/"]).splitlines()[-1])
for path in ("/root/.npm", "/home/*/.npm", "/var/cache", "/tmp"):
    pass
print(sh(["bash", "-lc", "du -sh /root/.npm /root/.cache /root/.pm2 /var/cache/apt /tmp /var/tmp /var/lib/docker 2>/dev/null"], 90))
