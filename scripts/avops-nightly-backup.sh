#!/usr/bin/env bash
# Nightly logical backup for AV OPS. Does not stop containers and does not
# tar live database directories. Secrets stay inside the backup directory.
set -euo pipefail
umask 077

ROOT=/var/backups/avops
LOG=/var/log/avops-backup.log
STATUS_DIR=/var/lib/avops
LOCK=/var/lock/avops-backup.lock
KEEP=7
MIN_FREE_KB=8000000

mkdir -p "$ROOT" "$STATUS_DIR"
chmod 700 "$ROOT" "$STATUS_DIR"
touch "$LOG"
chmod 600 "$LOG"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$(date -u +%H:%M:%S)] another backup is running" >> "$LOG"
  exit 1
fi

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$ROOT/$STAMP"
mkdir -p "$DEST/db" "$DEST/cockroach" "$DEST/minio" "$DEST/hermes" "$DEST/obsidian" "$DEST/config"
chmod 700 "$DEST"

log() { echo "[$(date -u +%H:%M:%S)] $*" >> "$LOG"; }

finish() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    printf "FAILED %s exit=%s\n" "$STAMP" "$code" > "$STATUS_DIR/backup-status.txt"
    log "FAILED stamp=$STAMP exit=$code"
  fi
}
trap finish EXIT

avail=$(df -P / | awk 'NR==2 {print $4}')
if [ "$avail" -lt "$MIN_FREE_KB" ]; then
  log "abort: only ${avail}KB free"
  exit 1
fi

log "start stamp=$STAMP avail_kb=$avail"

log "cockroach backup"
docker exec huly_v7-cockroach-1 \
  cockroach sql --certs-dir=/cockroach/certs --host=127.0.0.1 --user=root \
  -e "BACKUP INTO 'nodelocal://1/nightly-${STAMP}';" >> "$LOG" 2>&1
docker cp "huly_v7-cockroach-1:/cockroach/cockroach-data/extern/nightly-${STAMP}" "$DEST/cockroach/nodelocal"
docker exec huly_v7-cockroach-1 rm -rf "/cockroach/cockroach-data/extern/nightly-${STAMP}"

log "minio mirror"
python3 - << PY
import subprocess
import sys
from urllib.parse import quote, urlparse, parse_qs
cfg = subprocess.check_output(
    ["docker", "exec", "huly_v7-account-1", "printenv", "STORAGE_CONFIG"],
    text=True,
).strip()
rest = cfg.split("|", 1)[1]
u = urlparse(rest)
q = parse_qs(u.query)
access = quote(q["accessKey"][0], safe="")
secret = quote(q["secretKey"][0], safe="")
host = f"http://{access}:{secret}@127.0.0.1:9000"
subprocess.check_call(
    ["docker", "exec", "huly_v7-minio-1", "sh", "-c",
     "rm -rf /tmp/avops-minio-mirror && mkdir -p /tmp/avops-minio-mirror"]
)
result = subprocess.run(
    [
        "docker", "exec", "-e", f"MC_HOST_local={host}",
        "huly_v7-minio-1",
        "mc", "mirror", "--overwrite", "local", "/tmp/avops-minio-mirror",
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.PIPE,
    text=True,
)
if result.returncode != 0:
    sys.stderr.write("minio mirror failed\n")
    sys.exit(1)
PY
docker cp huly_v7-minio-1:/tmp/avops-minio-mirror "$DEST/minio/objects"
docker exec huly_v7-minio-1 rm -rf /tmp/avops-minio-mirror

log "postgres dumps"
# Cultura Postgres runs in Docker. The host socket is gone.
docker exec postgres-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -Fc --no-owner --no-privileges -d "$POSTGRES_DB"' > "$DEST/db/onecarat_medusa.dump"
docker exec contentbeta-db pg_dump -U postgres -Fc --no-owner --no-privileges -d postgres > "$DEST/db/supabase-postgres.dump"
if command -v redis-cli >/dev/null; then
  redis-cli -h 127.0.0.1 --rdb "$DEST/db/redis.rdb" >> "$LOG" 2>&1 || log "redis rdb skipped"
fi

log "hermes sqlite"
python3 - << PY
import sqlite3
from pathlib import Path
src_root = Path("/opt/av_ops/docker/hermes_agent")
dst_root = Path("$DEST/hermes")
for name in ("state.db", "projects.db", "shared-state.db"):
    src = sqlite3.connect(f"file:{src_root / name}?mode=ro", uri=True)
    dst_path = dst_root / name
    if dst_path.exists():
        dst_path.unlink()
    dst = sqlite3.connect(dst_path)
    src.backup(dst)
    dst.close()
    src.close()
PY
cp -a /opt/av_ops/docker/hermes_agent/config.yaml /opt/av_ops/docker/hermes_agent/.env "$DEST/hermes/"

log "obsidian"
tar -C /opt/av_ops/docker/obsidian -czf "$DEST/obsidian/vault.tgz" obsidian

log "config"
tar -C /opt/av_ops/docker/av_ops -czf "$DEST/config/huly-config.tgz" \
  compose.yml compose.override.yml .env huly_v7.conf secrets
tar -C /etc -czf "$DEST/config/nginx-sites.tgz" nginx/sites-enabled nginx/n8n.htpasswd 2>/dev/null || \
  tar -C /etc -czf "$DEST/config/nginx-sites.tgz" nginx/sites-enabled
tar -C /etc/systemd/system -czf "$DEST/config/systemd-custom.tgz" \
  hermes-dashboard.service obsidian-web.service avops-block-published.service avops-block-published.timer \
  avops-nightly-backup.service avops-nightly-backup.timer
if [ -f /root/.pm2/dump.pm2 ]; then
  cp -a /root/.pm2/dump.pm2 "$DEST/config/pm2-dump.pm2"
fi
if [ -d /opt/av_ops/docker/n8n ]; then
  tar -C /opt/av_ops/docker -czf "$DEST/config/n8n.tgz" n8n
fi

log "checksums"
(
  cd "$DEST"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)

mapfile -t old < <(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -printf "%f\n" | sort)
if [ "${#old[@]}" -gt "$KEEP" ]; then
  remove=$(( ${#old[@]} - KEEP ))
  for name in "${old[@]:0:remove}"; do
    log "retention remove $name"
    rm -rf "$ROOT/$name"
  done
fi

bytes=$(du -sb "$DEST" | awk '{print $1}')
printf "OK %s bytes=%s\n" "$STAMP" "$bytes" > "$STATUS_DIR/backup-status.txt"
ln -sfn "$DEST" "$STATUS_DIR/latest"
log "OK stamp=$STAMP bytes=$bytes"
trap - EXIT
