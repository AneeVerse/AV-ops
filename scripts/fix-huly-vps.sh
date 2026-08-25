#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost

python3 - <<'PY'
from pathlib import Path

p = Path("compose.yml")
text = p.read_text()
old = """  kvs:
    image: hardcoreeng/hulykvs:${HULY_VERSION}
    depends_on:
      cockroach:
        condition: service_started
    ports:
      - 8094:8094
"""
new = """  kvs:
    image: hardcoreeng/hulykvs:${HULY_VERSION}
    depends_on:
      cockroach:
        condition: service_started
"""
if old not in text:
    raise SystemExit("compose.yml kvs block not found")
p.write_text(text.replace(old, new, 1))
print("compose.yml: removed kvs host port")

op = Path("compose.override.yml")
ot = op.read_text()
ot2 = ot.replace(
"""  kvs:
    ports:
      - "127.0.0.1:8094:8094"
    deploy:
      resources:
        limits:
          memory: 256M
""",
"""  kvs:
    deploy:
      resources:
        limits:
          memory: 256M
"""
)
op.write_text(ot2)
print("compose.override.yml updated")
PY

docker compose --env-file huly_v7.conf up -d

cat > /etc/nginx/sites-available/app.aneeverse.com <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name app.aneeverse.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:8087;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        client_max_body_size 200m;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/app.aneeverse.com /etc/nginx/sites-enabled/app.aneeverse.com
nginx -t
nginx -s reload

echo "==== STATUS ===="
docker compose --env-file huly_v7.conf ps
echo "==== LOCAL HTTP :8087 ===="
curl -sI -m 15 http://127.0.0.1:8087/ | head -20
echo "==== LOCAL HTTP host header ===="
curl -sI -m 15 -H "Host: app.aneeverse.com" http://127.0.0.1/ | head -20
echo "==== DNS ===="
getent hosts app.aneeverse.com || echo "NO_DNS_YET"
echo "FIX_OK"
