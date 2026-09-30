#!/usr/bin/env bash
# Resume / finish remaining backup pieces for stamp 20260922T105828Z
set -euo pipefail
B=/root/vps-full-backup-20260922T105828Z
log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# Kill any leftover failed backup processes
pkill -f '/root/_vps-full-backup.sh' 2>/dev/null || true
sleep 1

# ---------- HULY: stop stack for consistent volumes ----------
log "Stopping Huly for consistent volume backup..."
cd /opt/huly-selfhost
docker compose -f compose.yml -f compose.override.yml stop || docker compose stop || true
sleep 5

log "Packing huly-selfhost + custom bundles..."
tar -C /opt -czf "$B/huly/huly-selfhost.tar.gz" --exclude=huly-selfhost/.git huly-selfhost
tar -C /opt -czf "$B/huly/huly-custom-bundles.tar.gz" huly-account huly-front huly-calendar

for vol in huly_v7_cr_data huly_v7_cr_certs huly_v7_files huly_v7_elastic huly_v7_redpanda; do
  log "volume $vol"
  rm -f "$B/huly/${vol}.tar.gz"
  tar -C /var/lib/docker/volumes -czf "$B/huly/${vol}.tar.gz" "$vol"
done

log "docker save custom images..."
IMG_FRONT=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^huly-front-custom:' | head -1 || true)
IMG_ACCT=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^huly-account-custom:' | head -1 || true)
IMG_CAL=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^huly-calendar-custom:' | head -1 || true)
echo "front=$IMG_FRONT acct=$IMG_ACCT cal=$IMG_CAL" | tee "$B/huly/custom-image-tags.txt"
if [[ -n "${IMG_FRONT:-}" && -n "${IMG_ACCT:-}" && -n "${IMG_CAL:-}" ]]; then
  docker save -o "$B/huly/custom-images.tar" "$IMG_FRONT" "$IMG_ACCT" "$IMG_CAL"
else
  log "WARN: missing custom image tags — listing all huly images"
  docker images | tee "$B/huly/docker-images.txt"
fi

grep -E '^[A-Z0-9_]+=' /opt/huly-selfhost/huly_v7.conf > "$B/huly/huly_v7.conf.keys.txt" || true
cp -a /opt/huly-selfhost/.env "$B/huly/huly.env" 2>/dev/null || true
cp -a /opt/huly-selfhost/.huly.secret "$B/huly/" 2>/dev/null || true
cp -a /opt/huly-selfhost/.cr.secret "$B/huly/" 2>/dev/null || true
cp -a /opt/huly-selfhost/.rp.secret "$B/huly/" 2>/dev/null || true

log "Starting Huly again..."
docker compose -f compose.yml -f compose.override.yml start || docker compose start || true

# ---------- STUDIO ----------
log "Studio contentbeta + supabase..."
tar -C /opt -czf "$B/studio/contentbeta.tar.gz" \
  --exclude=contentbeta/node_modules \
  --exclude=contentbeta/.next/cache \
  contentbeta
tar -C /opt -czf "$B/studio/contentbeta-supabase.tar.gz" contentbeta-supabase

# Dump supabase DB from container (try common users)
log "contentbeta-db dump..."
if docker exec contentbeta-db bash -lc 'pg_dumpall -U postgres' 2>/dev/null | gzip -c > "$B/studio/contentbeta-db.sql.gz"; then
  log "dumped as postgres"
elif docker exec contentbeta-db bash -lc 'pg_dumpall -U supabase_admin' 2>/dev/null | gzip -c > "$B/studio/contentbeta-db.sql.gz"; then
  log "dumped as supabase_admin"
else
  # fallback: tar the supabase volumes dir inside compose project
  log "WARN: pg_dumpall failed — packing docker named volumes for contentbeta if any"
  docker inspect contentbeta-db --format '{{json .Mounts}}' > "$B/studio/contentbeta-db-mounts.json"
  # also pack bind mounts under contentbeta-supabase/volumes
  tar -C /opt/contentbeta-supabase -czf "$B/studio/supabase-volumes.tar.gz" volumes 2>/dev/null || true
fi
ls -lah "$B/studio/contentbeta-db.sql.gz" 2>/dev/null || true

# ---------- OBSIDIAN ----------
log "Obsidian..."
tar -C /root/projects -czf "$B/obsidian/md.aneeverse.tar.gz" md.aneeverse
tar -C /opt -czf "$B/obsidian/obsidian-web.tar.gz" obsidian-web
tar -C /home -czf "$B/obsidian/home-obsidian.tar.gz" obsidian 2>/dev/null || true

# ---------- MANIFEST ----------
log "checksums..."
find "$B" -type f -printf '%s\t%p\n' | sort -k2 > "$B/meta/file-list.txt"
( cd "$B" && find . -type f ! -name 'SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum ) > "$B/SHA256SUMS"
du -sh "$B" "$B"/* > "$B/meta/sizes.txt"
date -u > "$B/meta/finished.txt"
cat "$B/meta/sizes.txt"
echo "BACKUP_COMPLETE:$B"
