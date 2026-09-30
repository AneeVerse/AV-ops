#!/usr/bin/env bash
set -euo pipefail
B=/root/vps-full-backup-20260922T105828Z
log(){ echo "[$(date -u +%H:%M:%S)] $*"; }

log "Fresh Cultura DB dump (today)..."
export BACKUP_CULTURA_DIR="$B/cultura"
python3 <<'PY'
import os, urllib.parse, subprocess, pathlib, gzip
cdir = pathlib.Path(os.environ["BACKUP_CULTURA_DIR"])
env = pathlib.Path("/root/projects/cultura/deploy/backend/.env").read_text()
url = [l.split("=",1)[1].strip().strip("\"'") for l in env.splitlines() if l.startswith("DATABASE_URL=")][0]
u = urllib.parse.urlparse(url)
db = (u.path or "/").lstrip("/") or "postgres"
user = u.username or "postgres"
host = u.hostname or "127.0.0.1"
port = str(u.port or 5432)
password = urllib.parse.unquote(u.password or "")
envp = os.environ.copy(); envp["PGPASSWORD"] = password
out = cdir / "medusa-db.dump"
subprocess.check_call(["pg_dump","-h",host,"-p",port,"-U",user,"-d",db,"-Fc","-f",str(out)], env=envp)
out2 = cdir / "medusa-db.sql.gz"
p = subprocess.Popen(["pg_dump","-h",host,"-p",port,"-U",user,"-d",db,"--no-owner","--no-acl"], env=envp, stdout=subprocess.PIPE)
assert p.stdout
with gzip.open(out2,"wb") as g:
    while True:
        chunk = p.stdout.read(1024*1024)
        if not chunk: break
        g.write(chunk)
assert p.wait()==0
# counts file
sql = """COPY (
 SELECT 'product', count(*) FROM product
 UNION ALL SELECT 'product_variant', count(*) FROM product_variant
 UNION ALL SELECT 'image', count(*) FROM image
 UNION ALL SELECT 'order', count(*) FROM \"order\"
) TO STDOUT WITH CSV;"""
r = subprocess.check_output(["psql","-h",host,"-p",port,"-U",user,"-d",db,"-t","-A","-c",sql], env=envp, text=True)
(cdir/"db-counts-today.txt").write_text(r + f"\ndumped_at={__import__('datetime').datetime.utcnow().isoformat()}Z\n")
print(r)
print("dump_bytes", out.stat().st_size, out2.stat().st_size)
PY

log "Pack product image folders explicitly..."
tar -C /root/projects/cultura -czf "$B/cultura/cultura-product-media.tar.gz" \
  deploy/backend/static \
  deploy/frontend/public \
  deploy/frontend/public/uploads 2>/dev/null || \
tar -C /root/projects/cultura -czf "$B/cultura/cultura-product-media.tar.gz" \
  deploy/backend/static \
  deploy/frontend/public
ls -lah "$B/cultura/"

log "Fresh Studio DB dump..."
if docker exec contentbeta-db pg_dumpall -U postgres 2>/dev/null | gzip -c > "$B/studio/contentbeta-db.sql.gz"; then
  ls -lah "$B/studio/contentbeta-db.sql.gz"
else
  log "studio dump failed — keeping previous"
fi

log "Refresh checksums..."
( cd "$B" && find . -type f ! -name 'SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum ) > "$B/SHA256SUMS"
du -sh "$B" "$B"/* | tee "$B/meta/sizes.txt"
date -u > "$B/meta/refreshed.txt"
echo REFRESH_DONE
