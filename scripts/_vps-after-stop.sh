#!/bin/bash
echo "=== pid 862 ==="
ps -o pid,ppid,stat,lstart,cmd -p 862 || echo gone
tr '\0' ' ' < /proc/862/cmdline 2>/dev/null; echo
echo "=== still hermes/openclaw ==="
pgrep -af 'hermes_cli|openclaw/dist' || echo none
echo "=== top cpu ==="
ps -eo pid,ppid,stat,pcpu,pmem,comm --sort=-pcpu | head -25
echo "=== runnable count ==="
ps -eo stat | awk 'NR>1 {c[substr($1,1,1)]++} END {for (k in c) print c[k], k}'
echo "=== medusa ==="
pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin);
[print(x["name"], x["pm2_env"].get("status"), "restarts", x["pm2_env"].get("restart_time")) for x in d]'
echo "=== huly ==="
docker ps --format '{{.Names}} {{.Status}}' | grep huly
echo DONE
