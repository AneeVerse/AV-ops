#!/usr/bin/env bash
set -euo pipefail
B=/root/vps-full-backup-20260922T105828Z
log() { echo "[$(date -u +%H:%M:%S)] $*"; }

cd /opt/huly-selfhost
set -a
# shellcheck disable=SC1091
[[ -f huly_v7.conf ]] && source huly_v7.conf || true
[[ -f .env ]] && source .env || true
set +a

log "Stopping huly containers by name..."
docker ps --format '{{.Names}}' | grep '^huly_v7-' | xargs -r docker stop
sleep 8
docker ps --format '{{.Names}}' | grep '^huly_v7-' || echo "all huly stopped"

log "Re-pack huly volumes (consistent)..."
for vol in huly_v7_cr_data huly_v7_cr_certs huly_v7_files huly_v7_elastic huly_v7_redpanda; do
  log "volume $vol"
  rm -f "$B/huly/${vol}.tar.gz"
  tar -C /var/lib/docker/volumes -czf "$B/huly/${vol}.tar.gz" "$vol"
  ls -lah "$B/huly/${vol}.tar.gz"
done

# ensure selfhost + bundles present
[[ -f "$B/huly/huly-selfhost.tar.gz" ]] || tar -C /opt -czf "$B/huly/huly-selfhost.tar.gz" --exclude=huly-selfhost/.git huly-selfhost
[[ -f "$B/huly/huly-custom-bundles.tar.gz" ]] || tar -C /opt -czf "$B/huly/huly-custom-bundles.tar.gz" huly-account huly-front huly-calendar

log "Save custom docker images..."
mapfile -t IMGS < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^huly-(front|account|calendar)-custom:' || true)
printf '%s\n' "${IMGS[@]}" | tee "$B/huly/custom-image-tags.txt"
if ((${#IMGS[@]} > 0)); then
  docker save -o "$B/huly/custom-images.tar" "${IMGS[@]}"
  ls -lah "$B/huly/custom-images.tar"
else
  docker images > "$B/huly/docker-images.txt"
  log "ERROR: no custom images found"
fi

cp -a /opt/huly-selfhost/.env "$B/huly/huly.env" 2>/dev/null || true
cp -a /opt/huly-selfhost/.huly.secret "$B/huly/" 2>/dev/null || true
cp -a /opt/huly-selfhost/.cr.secret "$B/huly/" 2>/dev/null || true
cp -a /opt/huly-selfhost/.rp.secret "$B/huly/" 2>/dev/null || true
grep -E '^[A-Z0-9_]+=' /opt/huly-selfhost/huly_v7.conf > "$B/huly/huly_v7.conf.keys.txt" || true

log "Starting huly containers..."
docker ps -a --format '{{.Names}}' | grep '^huly_v7-' | xargs -r docker start
sleep 5
docker ps --format '{{.Names}}\t{{.Status}}' | grep huly || true

log "Studio..."
tar -C /opt -czf "$B/studio/contentbeta.tar.gz" \
  --exclude=contentbeta/node_modules \
  --exclude=contentbeta/.next/cache \
  contentbeta
tar -C /opt -czf "$B/studio/contentbeta-supabase.tar.gz" contentbeta-supabase
docker inspect contentbeta-db --format '{{json .Mounts}}' > "$B/studio/contentbeta-db-mounts.json" || true

# Try dump with password from supabase .env
if [[ -f /opt/contentbeta-supabase/.env ]]; then
  set -a; source /opt/contentbeta-supabase/.env; set +a
fi
DBUSER="${POSTGRES_USER:-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD:-}"
if docker exec -e PGPASSWORD="$PGPASSWORD" contentbeta-db pg_dumpall -U "$DBUSER" 2>/tmp/pgdump.err | gzip -c > "$B/studio/contentbeta-db.sql.gz"; then
  log "supabase dump ok as $DBUSER size=$(stat -c%s "$B/studio/contentbeta-db.sql.gz")"
else
  log "pg_dumpall failed; packing bind volumes"
  cat /tmp/pgdump.err || true
  tar -C /opt/contentbeta-supabase -czf "$B/studio/supabase-volumes.tar.gz" volumes
  # also copy any anonymous volumes via docker cp of data dir
  DATADIR=$(docker inspect contentbeta-db --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}')
  if [[ -n "$DATADIR" && -d "$DATADIR" ]]; then
    log "packing postgres data dir $DATADIR"
    tar -C "$(dirname "$DATADIR")" -czf "$B/studio/contentbeta-pgdata.tar.gz" "$(basename "$DATADIR")"
  fi
fi

log "Obsidian..."
tar -C /root/projects -czf "$B/obsidian/md.aneeverse.tar.gz" md.aneeverse
tar -C /opt -czf "$B/obsidian/obsidian-web.tar.gz" obsidian-web
tar -C /home -czf "$B/obsidian/home-obsidian.tar.gz" obsidian 2>/dev/null || true

log "Manifest..."
find "$B" -type f -printf '%s\t%p\n' | sort -k2 > "$B/meta/file-list.txt"
( cd "$B" && find . -type f ! -name 'SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum ) > "$B/SHA256SUMS"
du -sh "$B" "$B"/* > "$B/meta/sizes.txt"
date -u > "$B/meta/finished.txt"
cat "$B/meta/sizes.txt"
echo "BACKUP_COMPLETE:$B"
