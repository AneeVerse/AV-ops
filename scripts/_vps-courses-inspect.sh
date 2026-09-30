#!/usr/bin/env bash
set -euo pipefail
echo "=== nginx names ==="
tar -tzf /root/vps-restore-backup/infra/nginx.tar.gz | grep -i course || echo none_in_tar
ls /etc/nginx/sites-available | grep -i course || echo none_live
echo "=== cert ==="
ls /etc/letsencrypt/live | grep -i course || echo no_cert
echo "=== dns ==="
getent hosts courses.aneeverse.com || true
echo "=== disk ==="
df -h / | tail -1
