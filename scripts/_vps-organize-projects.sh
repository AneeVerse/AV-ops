#!/bin/bash
set -euo pipefail

P=/root/projects
mkdir -p \
  "$P/cultura" \
  "$P/hermes" \
  "$P/app.aneeverse" \
  "$P/studio.aneeverse" \
  "$P/md.aneeverse" \
  "$P/bot.aneeverse" \
  "$P/n8n.aneeverse" \
  "$P/_keys" \
  "$P/_infra"

echo "=== stop cultura services before move ==="
systemctl stop jwel-img-gen-ui jwel-img-gen-bridge || true
pm2 stop frontend backend || true

move_into() {
  local src="$1" dest_dir="$2"
  local base
  base=$(basename "$src")
  if [ -e "$src" ] || [ -L "$src" ]; then
    if [ -e "$dest_dir/$base" ]; then
      echo "SKIP exists: $dest_dir/$base"
    else
      mv "$src" "$dest_dir/"
      echo "MOVED $src -> $dest_dir/$base"
    fi
  else
    echo "MISS $src"
  fi
}

echo "=== move cultura ==="
move_into /root/deploy "$P/cultura"
move_into /root/jwel_img_gen_bridge "$P/cultura"
move_into /root/jwel_img_gen_ui "$P/cultura"
move_into /root/my-medusa-store "$P/cultura"
move_into /root/my-medusa-store-storefront "$P/cultura"
[ -f /root/fix_db.sh ] && mv /root/fix_db.sh "$P/cultura/" && echo MOVED fix_db.sh

echo "=== move hermes backups/scripts ==="
move_into /root/hermes-discord-fix-backups "$P/hermes"
move_into /root/hermes-update-backup-20260901-123430 "$P/hermes"
move_into /root/leadgen-system "$P/hermes"
[ -f /root/hermes-dashboard-post-update-validation.log ] && mv /root/hermes-dashboard-post-update-validation.log "$P/hermes/"
[ -f /root/restart-verify-hermes-dashboard.sh ] && mv /root/restart-verify-hermes-dashboard.sh "$P/hermes/"
# pointer to live hermes home (do not move .hermes)
ln -sfn /root/.hermes "$P/hermes/runtime-home"
echo "NOTE: live Hermes data stays at /root/.hermes (symlinked)"

echo "=== app.aneeverse (Huly) ==="
[ -f /root/huly-login.txt ] && mv /root/huly-login.txt "$P/app.aneeverse/"
[ -f /root/huly.aneeverse.com.vhost.removed ] && mv /root/huly.aneeverse.com.vhost.removed "$P/app.aneeverse/"
ln -sfn /opt/huly-selfhost "$P/app.aneeverse/huly-selfhost"
cat > "$P/app.aneeverse/README.txt" <<'EOF'
Live Huly stack: /opt/huly-selfhost (docker compose huly_v7)
This folder holds small notes/configs only.
EOF

echo "=== studio.aneeverse ==="
ln -sfn /opt/contentbeta "$P/studio.aneeverse/contentbeta"
ln -sfn /opt/contentbeta-supabase "$P/studio.aneeverse/supabase"
cat > "$P/studio.aneeverse/README.txt" <<'EOF'
Live Studio (contentbeta): /opt/contentbeta  (pm2: contentbeta)
Supabase compose: /opt/contentbeta-supabase
EOF

echo "=== md.aneeverse (Obsidian vault) ==="
if [ -d /root/second-brain.real ]; then
  mv /root/second-brain.real "$P/md.aneeverse/second-brain"
  ln -sfn "$P/md.aneeverse/second-brain" /root/second-brain
  ln -sfn "$P/md.aneeverse/second-brain" /root/second-brain.real
  # fix broken home symlink
  ln -sfn "$P/md.aneeverse/second-brain" "/home/obsidian/Obsidian Vault"
  echo "vault moved + symlinks fixed"
fi
ln -sfn /opt/obsidian-web "$P/md.aneeverse/obsidian-web"

echo "=== bot.aneeverse (OpenClaw) ==="
ln -sfn /root/.openclaw "$P/bot.aneeverse/openclaw-home"
cat > "$P/bot.aneeverse/README.txt" <<'EOF'
Live OpenClaw home: /root/.openclaw (do not move — services depend on it)
Sales UI: /root/.openclaw/workspace/web-next/sales-app
EOF

echo "=== n8n pointer ==="
ln -sfn /root/.n8n "$P/n8n.aneeverse/n8n-home"
cat > "$P/n8n.aneeverse/README.txt" <<'EOF'
Live n8n data: /root/.n8n
Service: n8n.service -> http://127.0.0.1:5678
EOF

echo "=== keys + infra ==="
[ -f /root/anees@aneeverse_com_desktop_auth_key.json ] && mv /root/anees@aneeverse_com_desktop_auth_key.json "$P/_keys/"
[ -f /root/anees_aneeverse_com_desktop_auth_key_2.json ] && mv /root/anees_aneeverse_com_desktop_auth_key_2.json "$P/_keys/"
move_into /root/nginx-backups "$P/_infra"
chmod 700 "$P/_keys"

echo "=== update systemd jwel paths ==="
sed -i 's|/root/jwel_img_gen_bridge|/root/projects/cultura/jwel_img_gen_bridge|g' /etc/systemd/system/jwel-img-gen-bridge.service
sed -i 's|/root/jwel_img_gen_ui|/root/projects/cultura/jwel_img_gen_ui|g' /etc/systemd/system/jwel-img-gen-ui.service
systemctl daemon-reload

echo "=== update pm2 cultura paths ==="
pm2 delete frontend backend 2>/dev/null || true
cd "$P/cultura/deploy/frontend"
pm2 start npm --name frontend -- start
cd "$P/cultura/deploy/backend"
pm2 start npm --name backend -- start
pm2 save

echo "=== restart jwel ==="
systemctl start jwel-img-gen-bridge jwel-img-gen-ui

echo "=== DELETE junk ==="
rm -rf /root/webp_lossless_drive_batch_* \
       /root/webp_under_1000kb_drive_batch_* \
       /root/webp_under_1000kb_*.log \
       /root/drive_lossless_webp_batch.py \
       /root/drive_optimized_webp_batch.py \
       /root/drive_webp_under_1000kb_batch.py \
       /root/REMOVED-erp-crm-20260917-081152 \
       /root/crm_old_configs_20260519_141504 \
       /root/__pycache__ \
       /root/node_modules \
       /root/package.json \
       /root/package-lock.json \
       /root/.codex \
       /root/.codex-proxy \
       /root/.gradle \
       /root/.android \
       /root/.scrapegraphai.conf \
       /root/go \
       "/root/{{.Destination}}"
echo "junk removed (incl. go pkg cache 1.4G, gradle, codex leftovers, webp batches)"

# recreate empty GOPATH so go still works if needed
mkdir -p /root/go

echo "=== top-level README ==="
cat > "$P/README.txt" <<'EOF'
/root/projects layout
---------------------
cultura/          Cultura Jewels (Medusa deploy + jewelry image gen)
hermes/           Hermes backups/scripts (+ symlink runtime-home -> /root/.hermes)
app.aneeverse/    Huly notes + symlink to /opt/huly-selfhost
studio.aneeverse/ symlinks to /opt/contentbeta + supabase
md.aneeverse/     Obsidian vault (second-brain) + obsidian-web link
bot.aneeverse/    symlink to /root/.openclaw
n8n.aneeverse/    symlink to /root/.n8n
_keys/            desktop auth key jsons
_infra/           nginx backups

Runtime homes intentionally NOT moved:
  /root/.openclaw  /root/.hermes  /root/.n8n  /root/.pm2
EOF

echo
echo "=== VERIFY ==="
systemctl is-active jwel-img-gen-bridge jwel-img-gen-ui nginx n8n obsidian-web
pm2 list
echo "--- projects tree ---"
find "$P" -maxdepth 2 \( -type d -o -type l -o -name 'README.txt' \) | sort
echo "--- /root top (non-dot) ---"
ls -la /root | grep -v '^\.' | head -60
df -h / | tail -1
echo DONE
