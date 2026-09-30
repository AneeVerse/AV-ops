#!/usr/bin/env bash
# Runs ON the VPS. Installs the Novino OpenClaw gateway proxy and /_novino nginx.
# Token is copied from chat-control .env.local and never printed.
set -euo pipefail

STACK=/opt/huly-selfhost
HOST_NGINX=/etc/nginx/sites-available/app.aneeverse.com
DEST=/root/.openclaw/novino-gateway-proxy
CHAT_ENV=/root/.openclaw/workspace/chat-control/.env.local
STAMP=$(date +%Y%m%d%H%M%S)
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/novino-gateway-proxy"

say() { echo "==== $* ===="; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -d "$SRC" ] || die "missing $SRC (copy scripts/novino-gateway-proxy onto the VPS first)"
[ -s "$CHAT_ENV" ] || die "missing $CHAT_ENV (OPENCLAW_GATEWAY_TOKEN lives there)"
[ -f "$HOST_NGINX" ] || die "missing $HOST_NGINX"
command -v node >/dev/null || die "node is not installed"
command -v npm >/dev/null || die "npm is not installed"

mkdir -p "$STACK/backups" "$DEST"
cp -a "$HOST_NGINX" "$STACK/backups/app.aneeverse.com.novino.$STAMP"

say "install proxy files"
cp -a "$SRC/index.js" "$SRC/package.json" "$DEST/"
chmod 755 "$DEST/index.js"

say "write env from chat-control (token not printed)"
python3 - "$CHAT_ENV" "$DEST/.env" <<'PY'
from pathlib import Path
import sys

src, dest = Path(sys.argv[1]), Path(sys.argv[2])
vals = {}
for line in src.read_text(encoding='utf-8', errors='replace').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    vals[key.strip()] = value.strip().strip('"').strip("'")

token = vals.get('OPENCLAW_GATEWAY_TOKEN') or ''
if not token:
    raise SystemExit('OPENCLAW_GATEWAY_TOKEN missing in chat-control env')

ws = vals.get('OPENCLAW_GATEWAY_WS') or vals.get('OPENCLAW_GATEWAY_URL') or 'ws://127.0.0.1:18789'
origin = vals.get('OPENCLAW_GATEWAY_ORIGIN') or 'https://bot.aneeverse.com'
dest.write_text(
    'OPENCLAW_GATEWAY_TOKEN=' + token + '\n'
    'OPENCLAW_GATEWAY_WS=' + ws + '\n'
    'OPENCLAW_GATEWAY_ORIGIN=' + origin + '\n'
    'NOVINO_AGENT=novino\n'
    # 0.0.0.0: Hostinger firewall group openclaw does not publish 3011.
    # Host nginx proxies /_novino to 127.0.0.1:3011.
    'NOVINO_BIND=0.0.0.0\n'
    'NOVINO_PORT=3011\n'
    'NOVINO_ALLOWED_ORIGINS=https://app.aneeverse.com\n',
    encoding='utf-8',
)
dest.chmod(0o600)
print('env written')
PY

say "npm install"
(cd "$DEST" && npm install --omit=dev)

say "systemd unit"
install -m 644 "$SRC/novino-gateway-proxy.service" /etc/systemd/system/novino-gateway-proxy.service
systemctl daemon-reload
systemctl enable novino-gateway-proxy.service
systemctl restart novino-gateway-proxy.service
sleep 1
if ! systemctl is-active --quiet novino-gateway-proxy.service; then
  journalctl -u novino-gateway-proxy.service -n 40 --no-pager || true
  die "novino-gateway-proxy.service is not active"
fi
echo "novino-gateway-proxy is active"

say "patch host nginx /_novino/"
python3 - "$HOST_NGINX" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
text = p.read_text()
block = '''    location /_novino/ {
        proxy_pass http://127.0.0.1:3011/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        client_max_body_size 2m;
    }

'''
if 'location /_novino/' in text:
    print('host nginx /_novino already present')
else:
    needle = '''    location / {
        proxy_pass http://127.0.0.1:8087;'''
    if needle not in text:
        raise SystemExit('could not find host nginx location / -> 8087')
    p.write_text(text.replace(needle, block + needle))
    print('inserted host nginx /_novino')
PY

say "reload host nginx"
nginx -t
nginx -s reload

say "probe"
curl -sS -m 10 -o /tmp/novino-health.out -w "local=%{http_code}\n" http://127.0.0.1:3011/health || true
curl -sS -m 10 -o /tmp/novino-https.out -w "https=%{http_code}\n" https://app.aneeverse.com/_novino/health || true
head -c 200 /tmp/novino-health.out; echo
head -c 200 /tmp/novino-https.out; echo
echo DONE
