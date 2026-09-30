#!/usr/bin/env bash
set -euo pipefail
B=/root/vps-restore-backup
echo "=== nginx bots ==="
tar -tzf "$B/infra/nginx.tar.gz" | grep -E 'bots|hermes|bot\.' || true
echo "=== letsencrypt bots ==="
tar -tzf "$B/infra/letsencrypt.tar.gz" | grep -i bots || true
echo "=== backup hermes files ==="
find "$B" -iname '*hermes*' | head -40
echo "=== systemd hermes ==="
find "$B/infra" -iname '*hermes*' | head
echo "=== disk ==="
df -h / | tail -1
free -h | head -2
