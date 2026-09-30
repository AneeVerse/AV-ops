#!/usr/bin/env bash
set -euo pipefail
echo "=== VPS ALIVE ==="
hostname; date -u
echo "=== CULTURA LIVE DB COUNTS ==="
python3 <<'PY'
import os, urllib.parse, subprocess, pathlib
env = pathlib.Path("/root/projects/cultura/deploy/backend/.env").read_text()
url = None
for line in env.splitlines():
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip("\"'")
        break
u = urllib.parse.urlparse(url)
db = (u.path or "/").lstrip("/") or "postgres"
e = os.environ.copy()
e["PGPASSWORD"] = urllib.parse.unquote(u.password or "")
sql = """
SELECT 'product' AS t, count(*)::text AS c FROM product
UNION ALL SELECT 'product_variant', count(*)::text FROM product_variant
UNION ALL SELECT 'image', count(*)::text FROM image
UNION ALL SELECT 'product_collection', count(*)::text FROM product_collection
UNION ALL SELECT 'order', count(*)::text FROM "order"
UNION ALL SELECT 'db_size', pg_size_pretty(pg_database_size(current_database()));
"""
subprocess.check_call(
    ["psql", "-h", u.hostname or "127.0.0.1", "-p", str(u.port or 5432),
     "-U", u.username or "postgres", "-d", db, "-c", sql],
    env=e,
)
PY

echo "=== CULTURA UPLOAD/MEDIA DIRS ==="
du -sh /root/projects/cultura/deploy/backend/uploads \
  /root/projects/cultura/deploy/backend/static \
  /root/projects/cultura/deploy/backend/public \
  /root/projects/cultura/deploy/frontend/public \
  2>/dev/null || true
find /root/projects/cultura -type d \( -iname '*upload*' -o -iname '*media*' \) 2>/dev/null | head -30
# S3/minio style?
grep -E 'S3_|FILE_|UPLOAD|MEDUSA_FF|BUCKET' /root/projects/cultura/deploy/backend/.env 2>/dev/null | sed 's/=.*/=***/' || true

echo "=== WHAT IS INSIDE cultura-code BACKUP TAR (sample) ==="
tar -tzf /root/vps-full-backup-20260922T105828Z/cultura/cultura-code.tar.gz | grep -iE 'upload|media|static|product|public' | head -40 || true
echo "upload_paths_in_tar:" $(tar -tzf /root/vps-full-backup-20260922T105828Z/cultura/cultura-code.tar.gz | grep -ciE 'upload|media' || true)

echo "=== BACKUP DB DUMP vs LIVE ==="
ls -lah /root/vps-full-backup-20260922T105828Z/cultura/medusa-db.*
# restore listing from dump
pg_restore -l /root/vps-full-backup-20260922T105828Z/cultura/medusa-db.dump 2>/dev/null | grep -iE 'TABLE DATA.*product|TABLE DATA.*image|TABLE DATA.*order' | head -30 || true

echo "=== HULY LIVE VOLUMES ==="
du -sh /var/lib/docker/volumes/huly_v7_* 2>/dev/null
ls -lah /root/vps-full-backup-20260922T105828Z/huly/*.tar* 2>/dev/null

echo "=== HULY FILES (images/attachments) sample ==="
find /var/lib/docker/volumes/huly_v7_files/_data -type f 2>/dev/null | head -20
find /var/lib/docker/volumes/huly_v7_files/_data -type f 2>/dev/null | wc -l

echo "=== STUDIO ==="
ls -lah /root/vps-full-backup-20260922T105828Z/studio/
gunzip -c /root/vps-full-backup-20260922T105828Z/studio/contentbeta-db.sql.gz | head -5

echo "DONE_VERIFY"
