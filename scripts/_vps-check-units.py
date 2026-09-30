#!/usr/bin/env python3
import os
import subprocess

def sh(cmd, t=30):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=t)
    return (p.stdout or "").strip()

for unit in (
    "automation-api.service",
    "traitdna-video-platform.service",
    "novino-gateway-proxy.service",
    "chat-control.service",
    "scrapegraphai-web.service",
    "codex-proxy.service",
):
    print(f"\n=== {unit} ===")
    print(sh(["systemctl", "cat", unit], 15)[:1200])

print("\n=== PORT 8010/3001/3010/8020/8088 ===")
print(sh(["bash", "-lc", "ss -lntp | grep -E ':(8010|3001|3010|8020|8088|8097) '"], 15))

print("\n=== SUPABASE COMPOSE ===")
for p in ("/opt/contentbeta-supabase/docker-compose.yml", "/opt/contentbeta/deploy/supabase/docker-compose.yml"):
    print(p, "exists", os.path.isfile(p))

print("\n=== CONTENTBETA ===")
print(sh(["bash", "-lc", "ls /opt/contentbeta | head; grep -R \"studio\\|contentbeta\" /etc/nginx/sites-enabled/studio.aneeverse.com | head"], 20))
