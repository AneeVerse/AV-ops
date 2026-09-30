#!/usr/bin/env bash
# Base packages for a fresh AV OPS VPS. Safe to re-run.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 nginx certbot python3-certbot-nginx postgresql postgresql-contrib redis-server ca-certificates curl xz-utils
systemctl enable --now docker nginx postgresql redis-server
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz -o /tmp/node.tar.xz
  tar -C /usr/local --strip-components=1 -xJf /tmp/node.tar.xz
fi
command -v pm2 >/dev/null || npm install -g pm2
echo SETUP_OK
