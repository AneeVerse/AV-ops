#!/bin/bash
set -u
echo "=== host ==="
uptime; free -h | head -2; vmstat 1 3 | tail -3
echo "=== top ==="
ps aux --sort=-%cpu | head -12
echo "=== redpanda ==="
docker ps -a --filter name=huly_v7-redpanda --format '{{.Names}} {{.Status}}'
docker inspect huly_v7-redpanda-1 --format 'Health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
echo '--- health log ---'
docker inspect huly_v7-redpanda-1 --format '{{range .State.Health.Log}}{{.Start}} exit={{.ExitCode}}{{println}}{{.Output}}{{end}}' 2>/dev/null | tail -30
echo '--- healthcheck cmd ---'
docker inspect huly_v7-redpanda-1 --format '{{json .Config.Healthcheck}}'
echo '--- rpk cluster ---'
docker exec huly_v7-redpanda-1 rpk cluster info 2>&1 | head -40
echo "=== cockroach ==="
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | grep -E 'NAME|cockroach|redpanda|elastic|transactor|front'
echo "=== huly compose healthcheck in files ==="
grep -n -A8 -i 'healthcheck\|redpanda\|cockroach' /opt/huly-selfhost/compose.yml /opt/huly-selfhost/compose.override.yml 2>/dev/null | head -80
