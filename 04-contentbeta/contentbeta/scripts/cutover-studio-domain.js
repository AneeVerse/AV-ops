#!/usr/bin/env node
/**
 * Cut over ContentBeta: app.aneeverse.com → studio.aneeverse.com
 */
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

const host = process.env.VPS_HOST || '148.230.67.132'
const username = process.env.VPS_USER || 'root'
const keyPath =
  process.env.VPS_KEY_PATH ||
  `${process.env.USERPROFILE || process.env.HOME}/.ssh/id_ed25519`
const root = path.resolve(__dirname, '..')

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({
        host,
        port: 22,
        username,
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 30000,
      })
  })
}

function exec(conn, cmd, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    console.log(`$ ${cmd.slice(0, 180)}${cmd.length > 180 ? '…' : ''}`)
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let stderr = ''
      const t = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => {
        stderr += d.toString()
        process.stderr.write(d)
      })
      stream.on('close', (code) => {
        clearTimeout(t)
        if (code !== 0) reject(new Error(stderr || `exit ${code}`))
        else resolve()
      })
    })
  })
}

function upload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      console.log(`↑ ${path.basename(local)} -> ${remote}`)
      sftp.fastPut(local, remote, (e) => {
        sftp.end()
        if (e) reject(e)
        else resolve()
      })
    })
  })
}

async function main() {
  const bootstrap = `#!/bin/bash
set -euo pipefail
DOMAIN=studio.aneeverse.com
OLD=app.aneeverse.com

if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
  cat >/etc/nginx/sites-available/$DOMAIN <<'NGX'
server {
    listen 80;
    listen [::]:80;
    server_name studio.aneeverse.com;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGX
  ln -sfn /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
  nginx -t && systemctl reload nginx
  for i in $(seq 1 20); do
    dig +short $DOMAIN A | grep -q 148.230.67.132 && break
    echo "waiting DNS ($i)..."
    sleep 3
  done
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

install -m 644 /tmp/nginx-studio.aneeverse.com.conf /etc/nginx/sites-available/$DOMAIN
ln -sfn /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN

rm -f /etc/nginx/sites-enabled/$OLD
if [ -f /etc/nginx/sites-available/$OLD ]; then
  mv /etc/nginx/sites-available/$OLD /etc/nginx/sites-available/$OLD.disabled.contentbeta
fi

nginx -t
systemctl reload nginx

ENV=/opt/contentbeta-supabase/.env
if [ -f "$ENV" ]; then
  sed -i 's|^SITE_URL=.*|SITE_URL=https://studio.aneeverse.com|' "$ENV"
  sed -i 's|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=http://localhost:3000,http://127.0.0.1:3000,https://studio.aneeverse.com/**,https://app.aneeverse.com/**|' "$ENV"
  cd /opt/contentbeta-supabase && docker compose up -d auth
fi

pm2 status contentbeta || true
curl -sS -o /dev/null -w "studio_https:%{http_code}\\n" https://studio.aneeverse.com/login || true
curl -sS -o /dev/null -w "local:%{http_code}\\n" http://127.0.0.1:3000/login || true
rm -f /tmp/nginx-studio.aneeverse.com.conf /tmp/cutover-studio.sh
echo DONE
`

  const localBootstrap = path.join(root, 'deploy', 'app', '_cutover-studio.sh')
  fs.writeFileSync(localBootstrap, bootstrap.replace(/\r\n/g, '\n'))

  const conn = await connect()
  try {
    await upload(
      conn,
      path.join(root, 'deploy', 'app', 'nginx-studio.aneeverse.com.conf'),
      '/tmp/nginx-studio.aneeverse.com.conf'
    )
    await upload(conn, localBootstrap, '/tmp/cutover-studio.sh')
    await exec(conn, 'chmod +x /tmp/cutover-studio.sh && bash /tmp/cutover-studio.sh')
    console.log('\nUse https://studio.aneeverse.com — app.aneeverse.com DNS restored to Vercel')
  } finally {
    conn.end()
    if (fs.existsSync(localBootstrap)) fs.unlinkSync(localBootstrap)
  }
}

main().catch((e) => {
  console.error('FAILED', e.message || e)
  process.exit(1)
})
