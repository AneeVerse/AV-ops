#!/usr/bin/env bash
set -euo pipefail
HOME_DIR=/opt/av_ops/docker/hermes_agent
# Locate the launcher the installer published.
HERMES_BIN=""
for c in /root/.local/bin/hermes "$HOME_DIR/hermes-agent/.hermes/bin/hermes" "$HOME_DIR/hermes-agent/venv/bin/hermes"; do
  if [[ -x "$c" ]]; then HERMES_BIN=$c; break; fi
done
if [[ -z "$HERMES_BIN" ]]; then
  HERMES_BIN=$(find /root/.local /opt/av_ops/docker/hermes_agent -name hermes -type f -perm -111 2>/dev/null | head -1)
fi
echo "BIN=$HERMES_BIN"
test -n "$HERMES_BIN"
"$HERMES_BIN" --version || true

# Dashboard auth. Bind stays on localhost; nginx is the public front.
USER_NAME=aneeverse
PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
SECRET=$(openssl rand -base64 32)
ENV_FILE="$HOME_DIR/.env"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
grep -q '^HERMES_DASHBOARD_PUBLIC_URL=' "$ENV_FILE" || cat >> "$ENV_FILE" <<EOF
HERMES_DASHBOARD_PUBLIC_URL=https://bots.aneeverse.com
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=${USER_NAME}
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=${PASS}
HERMES_DASHBOARD_BASIC_AUTH_SECRET=${SECRET}
EOF
# Keep the password out of the service log. Write it for the operator once.
install -m 600 /dev/null /root/hermes-dashboard-login.txt
printf 'url=https://bots.aneeverse.com\nusername=%s\npassword=%s\n' "$USER_NAME" "$PASS" > /root/hermes-dashboard-login.txt

install -m 644 /dev/stdin /etc/systemd/system/hermes-dashboard.service <<EOF
[Unit]
Description=Hermes Agent dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$HOME_DIR
Environment=HOME=/root
Environment=HERMES_HOME=$HOME_DIR
EnvironmentFile=$HOME_DIR/.env
ExecStart=$HERMES_BIN dashboard --host 127.0.0.1 --port 9119 --no-open
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

install -m 644 /dev/stdin /etc/nginx/sites-available/bots.aneeverse.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name bots.aneeverse.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name bots.aneeverse.com;

    ssl_certificate /etc/letsencrypt/live/bots.aneeverse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bots.aneeverse.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:9119;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/bots.aneeverse.com /etc/nginx/sites-enabled/bots.aneeverse.com
nginx -t
systemctl reload nginx
systemctl daemon-reload
systemctl enable --now hermes-dashboard.service
sleep 6
systemctl is-active hermes-dashboard
ss -ltnp | grep 9119 || true
curl -s -o /dev/null -w 'local %{http_code}\n' http://127.0.0.1:9119/ || true
curl -sk -o /dev/null -w 'public %{http_code}\n' https://bots.aneeverse.com/ || true
echo WIRE_DONE
