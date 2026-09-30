#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/av_ops/web/courses
log(){ echo "[$(date -u +%H:%M:%S)] $*"; }

log "extract"
rm -rf "$ROOT"
mkdir -p "$ROOT"
tar -C "$ROOT" -xzf /root/cource-buildx100.tar.gz
test -f "$ROOT/package.json"
test -f "$ROOT/.env.local"
chmod 600 "$ROOT/.env.local"

log "install"
cd "$ROOT"
npm install --legacy-peer-deps

log "build"
npm run build

log "pm2"
pm2 delete courses >/dev/null 2>&1 || true
pm2 start npm --name courses --cwd "$ROOT" -- start -- -p 3010 -H 127.0.0.1
pm2 save

log "nginx"
install -m 644 /dev/stdin /etc/nginx/sites-available/courses.aneeverse.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name courses.aneeverse.com;

    client_max_body_size 64m;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
ln -sfn /etc/nginx/sites-available/courses.aneeverse.com /etc/nginx/sites-enabled/courses.aneeverse.com
nginx -t
systemctl reload nginx

log "certificate"
certbot --nginx -d courses.aneeverse.com --non-interactive --agree-tos --redirect --keep-until-expiring || \
  certbot --nginx -d courses.aneeverse.com --non-interactive --agree-tos --redirect -m admin@aneeverse.com

sleep 4
ss -ltnp | grep 3010 || echo NO_3010
curl -s -o /dev/null -w 'local %{http_code}\n' http://127.0.0.1:3010/
curl -sk -o /dev/null -w 'public %{http_code}\n' https://courses.aneeverse.com/ || true
pm2 describe courses | awk '/status|restarts|uptime/'
log "COURSES_DONE"
