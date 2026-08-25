#!/usr/bin/env bash
set -euo pipefail

cat > /etc/nginx/sites-available/app.aneeverse.com <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name app.aneeverse.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.aneeverse.com;

    ssl_certificate /etc/letsencrypt/live/app.aneeverse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.aneeverse.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:8087;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/app.aneeverse.com /etc/nginx/sites-enabled/app.aneeverse.com
nginx -t
nginx -s reload

cd /opt/huly-selfhost
sed -i 's/^SECURE=.*/SECURE=true/' huly_v7.conf
docker compose --env-file huly_v7.conf up -d --force-recreate account front transactor workspace collaborator

sleep 5
echo '==== HTTPS ===='
curl -sI -m 15 https://app.aneeverse.com/ | head -12
echo DONE
