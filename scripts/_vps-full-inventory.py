#!/usr/bin/env python3
"""VPS inventory: apps, resources, backups, connections."""
import os, subprocess, json, re

def sh(cmd, timeout=60):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (r.stdout or "") + (r.stderr or "")
    except subprocess.TimeoutExpired:
        return "TIMEOUT"

def du(path, timeout=90):
    if not os.path.exists(path):
        return "MISSING"
    try:
        r = subprocess.run(["du", "-sh", path], capture_output=True, text=True, timeout=timeout)
        return (r.stdout or "").split()[0] if r.stdout.strip() else "?"
    except subprocess.TimeoutExpired:
        return "TIMEOUT"

print("=" * 60)
print("1) HOST / RESOURCES")
print("=" * 60)
print(sh("hostname; uptime; nproc; free -h; df -h / | tail -1"))

print("=" * 60)
print("2) NGINX SITES (public URLs)")
print("=" * 60)
print(sh("ls -1 /etc/nginx/sites-enabled/"))
for f in sorted(os.listdir("/etc/nginx/sites-enabled")):
    p = f"/etc/nginx/sites-enabled/{f}"
    try:
        t = open(p).read()
    except Exception:
        continue
    names = re.findall(r"server_name\s+([^;]+);", t)
    passes = re.findall(r"proxy_pass\s+([^;]+);", t)
    print(f"\n[{f}]")
    print("  server_name:", ", ".join(dict.fromkeys(n.strip() for n in names)))
    for pp in passes[:8]:
        print("  ->", pp.strip())

print("\n" + "=" * 60)
print("3) SYSTEMD KEY SERVICES")
print("=" * 60)
units = [
    "nginx", "n8n", "novino-gateway-proxy", "obsidian-web",
    "sales1-next", "sales-n8n-bridge", "automation-api",
    "jwel-img-gen-bridge", "jwel-img-gen-ui", "pm2-root", "redis",
]
for u in units:
    st = sh(f"systemctl is-active {u} 2>/dev/null").strip()
    print(f"  {u}: {st}")

print("\n" + "=" * 60)
print("4) DOCKER")
print("=" * 60)
print(sh("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -40"))
print(sh("docker system df"))

print("\n" + "=" * 60)
print("5) PM2")
print("=" * 60)
print(sh("pm2 list"))

print("\n" + "=" * 60)
print("6) PROCESS MEMORY (top consumers)")
print("=" * 60)
print(sh("ps aux --sort=-%mem | head -25"))

print("\n" + "=" * 60)
print("7) OPENCLAW / HERMES PROC COUNTS")
print("=" * 60)
print("openclaw:", sh("pgrep -c -f 'openclaw.*gateway' || echo 0").strip())
print("hermes procs:", sh("pgrep -c -f 'hermes_cli' || echo 0").strip())
print(sh("pgrep -af 'hermes_cli.main' | sed 's/.*--profile /profile=/;s/ gateway.*//' | head -20"))

print("\n" + "=" * 60)
print("8) DISK BY APP")
print("=" * 60)
paths = [
    ("OpenClaw", "/root/.openclaw"),
    ("Hermes", "/root/.hermes"),
    ("Cultura total", "/root/projects/cultura"),
    ("  deploy", "/root/projects/cultura/deploy"),
    ("  jwel ui", "/root/projects/cultura/jwel_img_gen_ui"),
    ("  jwel bridge", "/root/projects/cultura/jwel_img_gen_bridge"),
    ("Studio", "/opt/contentbeta"),
    ("Supabase files", "/opt/contentbeta-supabase"),
    ("Huly compose", "/opt/huly-selfhost"),
    ("Obsidian web", "/opt/obsidian-web"),
    ("md vault", "/root/projects/md.aneeverse/second-brain"),
    ("n8n", "/root/.n8n"),
    ("Docker /var/lib/docker", "/var/lib/docker"),
    ("root .local", "/root/.local"),
    ("projects/", "/root/projects"),
]
for name, p in paths:
    print(f"  {name}: {du(p)}")

print("\n" + "=" * 60)
print("9) BACKUP LOCATIONS (search)")
print("=" * 60)
print("--- known backup dirs ---")
for p in [
    "/opt/huly-selfhost/backups",
    "/opt/backups",
    "/root/projects/hermes/hermes-update-backup-20260901-123430",
    "/root/projects/hermes/hermes-discord-fix-backups",
    "/root/projects/_infra/nginx-backups",
    "/root/.hermes",
    "/var/backups",
]:
    if os.path.exists(p):
        print(f"  {p}: {du(p)}")
        print(sh(f"ls -la {p} 2>/dev/null | head -15"))

print("--- find *backup* under /opt /root/projects (depth 3) ---")
print(sh("find /opt /root/projects /root/.openclaw/workspace/backups -maxdepth 3 \\( -iname '*backup*' -o -iname '*bak*' \\) 2>/dev/null | head -60"))

print("--- cron ---")
print(sh("crontab -l 2>/dev/null; ls /etc/cron.d/ 2>/dev/null; systemctl list-timers --all 2>/dev/null | head -25"))

print("\n" + "=" * 60)
print("10) HULY BACKUP SCRIPTS")
print("=" * 60)
print(sh("ls -la /opt/huly-selfhost/backup*.sh /opt/huly-selfhost/backups 2>/dev/null | head -30"))

print("DONE")
