#!/usr/bin/env bash
set -euo pipefail
B=/root/vps-restore-backup
echo "FILE_COUNT=$(find "$B" -type f | wc -l)"
du -sh "$B"
echo "--- required ---"
for f in \
  huly/huly-selfhost.tar.gz huly/huly-custom-bundles.tar.gz huly/custom-images.tar huly/huly.env \
  huly/.huly.secret huly/.cr.secret huly/.rp.secret \
  huly/huly_v7_cr_data.tar.gz huly/huly_v7_cr_certs.tar.gz huly/huly_v7_files.tar.gz huly/huly_v7_elastic.tar.gz huly/huly_v7_redpanda.tar.gz \
  infra/nginx.tar.gz infra/letsencrypt.tar.gz \
  obsidian/md.aneeverse.tar.gz obsidian/obsidian-web.tar.gz \
  cultura/cultura-code.tar.gz cultura/cultura-product-media.tar.gz cultura/medusa-db.dump \
  studio/contentbeta.tar.gz studio/contentbeta-supabase.tar.gz
do
  if [[ -f "$B/$f" ]]; then echo "OK $f"; else echo "MISSING $f"; fi
done
echo "--- nginx sites ---"
tar -tzf "$B/infra/nginx.tar.gz" | grep -E 'sites-available|htpasswd' | head -40
echo "--- huly selfhost top ---"
tar -tzf "$B/huly/huly-selfhost.tar.gz" | head -15
echo "--- bundles top ---"
tar -tzf "$B/huly/huly-custom-bundles.tar.gz" | awk -F/ '{print $1}' | sort -u | head
echo "--- cultura top ---"
tar -tzf "$B/cultura/cultura-code.tar.gz" | awk -F/ '{print $1}' | sort -u | head
echo "--- media sample ---"
tar -tzf "$B/cultura/cultura-product-media.tar.gz" | head -6
echo "--- md sample ---"
tar -tzf "$B/obsidian/md.aneeverse.tar.gz" | head -6
echo "--- studio sample ---"
tar -tzf "$B/studio/contentbeta.tar.gz" | head -4
tar -tzf "$B/studio/contentbeta-supabase.tar.gz" | head -4
echo "--- host ---"
docker --version
nginx -v
node -v
systemctl is-active docker nginx postgresql redis-server || true
test -x /opt/av_ops/scripts/restore.sh && echo RESTORE_SCRIPT_OK
df -h /
