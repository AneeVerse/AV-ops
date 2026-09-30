#!/usr/bin/env bash
# Full VPS backup for clean OS reinstall + restore (Cultura, Huly, Studio, Obsidian).
set -euo pipefail

STAMP="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"
B="/root/vps-full-backup-${STAMP}"
mkdir -p "$B"/{infra,cultura,huly,studio,obsidian,meta}

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

log "Backup dir: $B"
echo "$STAMP" > "$B/meta/stamp.txt"
hostname > "$B/meta/hostname.txt"
date -u > "$B/meta/started.txt"
df -h / > "$B/meta/df.txt"
docker ps -a > "$B/meta/docker-ps.txt" 2>&1 || true
pm2 list > "$B/meta/pm2.txt" 2>&1 || true
systemctl list-units --type=service --state=running > "$B/meta/systemd-running.txt" 2>&1 || true

# ---------- 1 INFRA ----------
if [[ ! -f "$B/infra/nginx.tar.gz" ]]; then
  log "[1/8] infra nginx+ssl+env+units"
  cp -a /root/.env "$B/infra/root.env" 2>/dev/null || true
  tar -C /etc -czf "$B/infra/nginx.tar.gz" nginx
  tar -C /etc -czf "$B/infra/letsencrypt.tar.gz" letsencrypt 2>/dev/null || true
  mkdir -p "$B/infra/systemd"
  cp -a /etc/systemd/system/obsidian-web.service \
    /etc/systemd/system/jwel-img-gen-bridge.service \
    /etc/systemd/system/jwel-img-gen-ui.service \
    /etc/systemd/system/medusa-cpulimit.service \
    /etc/systemd/system/n8n.service \
    /etc/systemd/system/novino-gateway-proxy.service \
    "$B/infra/systemd/" 2>/dev/null || true
  ls /etc/systemd/system/*.service 2>/dev/null | xargs -r -I{} basename {} > "$B/infra/systemd-service-list.txt" || true
  pm2 save 2>/dev/null || true
  cp -a /root/.pm2/dump.pm2 "$B/infra/pm2-dump.pm2" 2>/dev/null || true
  cp -a /root/projects/_infra "$B/infra/projects-_infra" 2>/dev/null || true
  cp -a /root/projects/_keys "$B/infra/projects-_keys" 2>/dev/null || true
  cp -a /root/projects/README.txt "$B/infra/projects-README.txt" 2>/dev/null || true
else
  log "[1/8] infra already present — skip"
fi

# ---------- 2 CULTURA CODE ----------
if [[ ! -f "$B/cultura/cultura-code.tar.gz" ]]; then
  log "[2/8] cultura code"
  tar -C /root/projects -czf "$B/cultura/cultura-code.tar.gz" \
    --exclude=cultura/deploy/backend/node_modules \
    --exclude=cultura/deploy/frontend/node_modules \
    --exclude=cultura/deploy/backend/.medusa/client \
    --exclude=cultura/my-medusa-store/node_modules \
    --exclude=cultura/my-medusa-store-storefront/node_modules \
    --exclude=cultura/jwel_img_gen_ui/node_modules \
    --exclude=cultura/jwel_img_gen_bridge/node_modules \
    --exclude=cultura/deploy/backend/.cache \
    cultura
else
  log "[2/8] cultura code already present — skip"
fi

# ---------- 3 CULTURA DB ----------
if [[ ! -f "$B/cultura/medusa-db.dump" ]]; then
  log "[3/8] cultura postgres dump"
  export BACKUP_CULTURA_DIR="$B/cultura"
  python3 <<'PY'
import os, urllib.parse, subprocess, pathlib, gzip
cdir = pathlib.Path(os.environ["BACKUP_CULTURA_DIR"])
env = pathlib.Path("/root/projects/cultura/deploy/backend/.env").read_text()
url = None
for line in env.splitlines():
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip("\"'")
        break
if not url:
    raise SystemExit("no DATABASE_URL")
u = urllib.parse.urlparse(url)
db = (u.path or "/").lstrip("/") or "postgres"
user = u.username or "postgres"
host = u.hostname or "127.0.0.1"
port = str(u.port or 5432)
password = urllib.parse.unquote(u.password or "")
out = cdir / "medusa-db.dump"
envp = os.environ.copy()
envp["PGPASSWORD"] = password
subprocess.check_call(
    ["pg_dump", "-h", host, "-p", port, "-U", user, "-d", db, "-Fc", "-f", str(out)],
    env=envp,
)
print("dumped", out, "bytes", out.stat().st_size)
out2 = cdir / "medusa-db.sql.gz"
p = subprocess.Popen(
    ["pg_dump", "-h", host, "-p", port, "-U", user, "-d", db, "--no-owner", "--no-acl"],
    env=envp,
    stdout=subprocess.PIPE,
)
assert p.stdout is not None
with gzip.open(out2, "wb") as g:
    while True:
        chunk = p.stdout.read(1024 * 1024)
        if not chunk:
            break
        g.write(chunk)
rc = p.wait()
if rc != 0:
    raise SystemExit(rc)
print("dumped", out2, "bytes", out2.stat().st_size)
(cdir / "db-meta.txt").write_text(f"host={host}\nport={port}\nuser={user}\ndb={db}\n")
PY
else
  log "[3/8] cultura db already present — skip"
fi

# ---------- 4 HULY ----------
log "[4/8] huly config + volumes + custom images"
tar -C /opt -czf "$B/huly/huly-selfhost.tar.gz" \
  --exclude=huly-selfhost/.git \
  huly-selfhost
tar -C /opt -czf "$B/huly/huly-custom-bundles.tar.gz" huly-account huly-front huly-calendar

# volume tarballs (stop not required for consistency-ish; prefer quiet period)
for vol in huly_v7_cr_data huly_v7_cr_certs huly_v7_files huly_v7_elastic huly_v7_redpanda; do
  if [[ ! -f "$B/huly/${vol}.tar.gz" ]]; then
    log "  volume $vol"
    tar -C /var/lib/docker/volumes -czf "$B/huly/${vol}.tar.gz" "$vol"
  fi
done

# save custom images (needed on clean host)
if [[ ! -f "$B/huly/custom-images.tar" ]]; then
  log "  docker save custom images"
  IMG_FRONT=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^huly-front-custom:' | head -1)
  IMG_ACCT=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^huly-account-custom:' | head -1)
  IMG_CAL=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^huly-calendar-custom:' | head -1)
  echo "front=$IMG_FRONT acct=$IMG_ACCT cal=$IMG_CAL" > "$B/huly/custom-image-tags.txt"
  docker save -o "$B/huly/custom-images.tar" $IMG_FRONT $IMG_ACCT $IMG_CAL
fi

# workspace-level backup if we can discover workspace name
if [[ -f /opt/huly-selfhost/huly_v7.conf ]]; then
  # shellcheck disable=SC1091
  source /opt/huly-selfhost/huly_v7.conf || true
  echo "HULY_CONF_SOURCED=1" > "$B/huly/huly-conf-export.txt" || true
  grep -E '^[A-Z0-9_]+=' /opt/huly-selfhost/huly_v7.conf > "$B/huly/huly_v7.conf.keys.txt" || true
fi

# ---------- 5 STUDIO ----------
log "[5/8] studio contentbeta + supabase"
tar -C /opt -czf "$B/studio/contentbeta.tar.gz" \
  --exclude=contentbeta/node_modules \
  --exclude=contentbeta/.next/cache \
  contentbeta
tar -C /opt -czf "$B/studio/contentbeta-supabase.tar.gz" contentbeta-supabase

# supabase postgres dump from container
if [[ ! -f "$B/studio/contentbeta-db.sql.gz" ]]; then
  log "  contentbeta-db dump"
  docker exec contentbeta-db pg_dumpall -U postgres | gzip -c > "$B/studio/contentbeta-db.sql.gz" \
    || docker exec contentbeta-db bash -lc 'pg_dumpall -U postgres' | gzip -c > "$B/studio/contentbeta-db.sql.gz"
fi

# ---------- 6 OBSIDIAN ----------
log "[6/8] obsidian vault + web"
tar -C /root/projects -czf "$B/obsidian/md.aneeverse.tar.gz" md.aneeverse
tar -C /opt -czf "$B/obsidian/obsidian-web.tar.gz" obsidian-web
tar -C /home -czf "$B/obsidian/home-obsidian.tar.gz" obsidian 2>/dev/null || true

# ---------- 7 MANIFEST ----------
log "[7/8] checksums + sizes"
find "$B" -type f -printf '%s\t%p\n' | sort -k2 > "$B/meta/file-list.txt"
( cd "$B" && find . -type f ! -name 'SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum ) > "$B/SHA256SUMS"
du -sh "$B" "$B"/* > "$B/meta/sizes.txt"
date -u > "$B/meta/finished.txt"
log "[8/8] DONE"
cat "$B/meta/sizes.txt"
echo "BACKUP_COMPLETE:$B"
