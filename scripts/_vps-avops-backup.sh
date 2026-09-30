#!/usr/bin/env bash
# Snapshot persistent AV OPS data on this server. Does not include Docker images.
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/root/av-ops-backup-$STAMP
ROOT=/opt/av_ops
mkdir -p "$OUT"
tar -C "$ROOT/docker/av_ops" -czf "$OUT/huly-config.tar.gz" \
  --exclude=node_modules --exclude=.git \
  compose.yml compose.override.yml huly_v7.conf .env .huly.nginx secrets .huly.secret .cr.secret .rp.secret 2>/dev/null || true
for vol in huly_v7_cr_data huly_v7_cr_certs huly_v7_files huly_v7_elastic huly_v7_redpanda; do
  [[ -d /var/lib/docker/volumes/$vol ]] && tar -C /var/lib/docker/volumes -czf "$OUT/${vol}.tar.gz" "$vol"
done
tar -C "$ROOT/memory" -czf "$OUT/obsidian.tar.gz" obsidian
tar -C "$ROOT/web" -czf "$OUT/cultura.tar.gz" --exclude=node_modules --exclude=.next cultura
tar -C "$ROOT/web" -czf "$OUT/studio.tar.gz" --exclude=node_modules --exclude=.next studio
du -sh "$OUT" "$OUT"/*
echo "BACKUP_WRITTEN:$OUT"
