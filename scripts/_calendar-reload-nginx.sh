#!/usr/bin/env bash
set -euo pipefail
STACK=/opt/huly-selfhost
echo "=== nginx location ==="
grep -n "location /_calendar\|location /_accounts\|proxy_pass http://calendar" "$STACK/.huly.nginx" || true
echo "=== compose nginx volumes ==="
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/huly-selfhost/compose.yml")
alts = list(Path("/opt/huly-selfhost").glob("docker-compose*.yml")) + list(Path("/opt/huly-selfhost").glob("compose*.yml"))
for f in alts:
    t = f.read_text(errors="ignore")
    if "nginx" in t and ("huly.nginx" in t or "volumes:" in t):
        print("---", f)
        # print nginx service snippet
        lines = t.splitlines()
        in_n = False
        depth = 0
        for i, line in enumerate(lines):
            if line.startswith("  nginx:"):
                in_n = True
            elif in_n and line.startswith("  ") and not line.startswith("    ") and not line.startswith("  nginx:"):
                if i > 0:
                    break
            if in_n:
                print(line)
PY
echo "=== calendar status ==="
docker ps --filter name=calendar --format '{{.Names}} {{.Status}} {{.Ports}}'
echo "=== calendar logs ==="
docker logs --tail 80 huly_v7-calendar-1 || true
echo "=== reload nginx ==="
docker exec huly_v7-nginx-1 nginx -t || true
docker exec huly_v7-nginx-1 nginx -s reload || docker restart huly_v7-nginx-1
sleep 2
echo "=== probe ==="
curl -sS -o /tmp/cal-signin.out -w "https=%{http_code} ctype=%{content_type}\n" https://app.aneeverse.com/_calendar/signin || true
head -c 180 /tmp/cal-signin.out; echo
curl -sS -o /tmp/cal-int.out -w "int=%{http_code}\n" http://127.0.0.1:8087/_calendar/signin || true
head -c 180 /tmp/cal-int.out; echo
echo "=== transactor CALENDAR_URL ==="
docker inspect huly_v7-transactor-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'CALENDAR|MAIL_URL' || true
