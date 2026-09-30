#!/usr/bin/env bash
set -euo pipefail
# Kill broken phase-A only AFTER cultura tar finishes (or if tar already done).
B=/root/vps-full-backup-20260922T105828Z
echo "Waiting for cultura tar..."
while pgrep -f 'tar -C /root/projects -czf /root/vps-full-backup' >/dev/null; do
  ls -lah "$B/cultura/cultura-code.tar.gz" 2>/dev/null || true
  sleep 15
done
echo "Tar finished."
ls -lah "$B/cultura/" || true
# Kill broken parent bash that will fail on mangled python
pkill -f 'DONE_PHASE_A' 2>/dev/null || true
sleep 2
# Re-upload path: run full backup script against same stamp (skips done bits)
export BACKUP_CULTURA_DIR="$B/cultura"
nohup /root/_vps-full-backup.sh 20260922T105828Z > /root/vps-full-backup.log 2>&1 &
echo "Started full backup PID $!"
sleep 2
tail -20 /root/vps-full-backup.log || true
