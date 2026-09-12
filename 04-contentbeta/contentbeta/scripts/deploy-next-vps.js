#!/usr/bin/env node
/**
 * Deploy ContentBeta Next.js to Hostinger VPS.
 *
 * Env: VPS_HOST, VPS_USER, VPS_PASSWORD, VPS_KEY_PATH (same as vps-ssh.js)
 */
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const host = process.env.VPS_HOST || '148.230.67.132'
const username = process.env.VPS_USER || 'root'
const password = process.env.VPS_PASSWORD || ''
const keyPath =
  process.env.VPS_KEY_PATH ||
  `${process.env.USERPROFILE || process.env.HOME}/.ssh/id_ed25519`
const remoteDir = '/opt/contentbeta'
const domain = 'studio.aneeverse.com'
const tarballLocal = path.join(root, 'deploy', 'app', 'contentbeta-deploy.tgz')
const tarballRemote = '/tmp/contentbeta-deploy.tgz'

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const cfg = { host, port: 22, username, readyTimeout: 60000 }
    if (password) cfg.password = password
    else if (fs.existsSync(keyPath)) cfg.privateKey = fs.readFileSync(keyPath)
    else return reject(new Error('No VPS_PASSWORD or SSH key found'))
    conn.on('ready', () => resolve(conn))
    conn.on('error', reject)
    conn.connect(cfg)
  })
}

function exec(conn, cmd, { timeoutMs = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${cmd.slice(0, 200)}${cmd.length > 200 ? '…' : ''}`)
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err)
      let stderr = ''
      const timer = setTimeout(() => {
        stream.close()
        reject(new Error(`Timeout after ${timeoutMs}ms`))
      }, timeoutMs)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => {
        stderr += d.toString()
        process.stderr.write(d)
      })
      stream.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0) reject(new Error(`Exit ${code}\n${stderr.slice(-2000)}`))
        else resolve()
      })
    })
  })
}

function upload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      console.log(`\n↑ ${path.basename(localPath)} -> ${remotePath}`)
      sftp.fastPut(localPath, remotePath, (e) => {
        sftp.end()
        if (e) reject(e)
        else resolve()
      })
    })
  })
}

function pack() {
  fs.mkdirSync(path.dirname(tarballLocal), { recursive: true })
  if (fs.existsSync(tarballLocal)) fs.unlinkSync(tarballLocal)
  const excludes = [
    '--exclude=node_modules',
    '--exclude=.next',
    '--exclude=.next-dev',
    '--exclude=deploy/app/contentbeta-deploy.tgz',
    '--exclude=deploy/supabase/cloud-data.sql',
    '--exclude=deploy/supabase/dump-log.txt',
    '--exclude=.claude',
    '--exclude=*.jsonl',
    '--exclude=tsconfig.tsbuildinfo',
  ]
  console.log('Packing…')
  execSync(
    `tar -czf "${tarballLocal}" ${excludes.join(' ')} -C "${root}" .`,
    { stdio: 'inherit', shell: true }
  )
  console.log(`Packed ${(fs.statSync(tarballLocal).size / 1024 / 1024).toFixed(2)} MB`)
}

async function main() {
  pack()
  if (!fs.existsSync(path.join(root, '.env.local'))) {
    throw new Error('Missing .env.local — required for production env on VPS')
  }

  const remoteBootstrap = `#!/bin/bash
set -euo pipefail
DOMAIN="${domain}"
APP_DIR="${remoteDir}"

mkdir -p "$APP_DIR"
tar -xzf ${tarballRemote} -C "$APP_DIR"
install -m 600 /tmp/contentbeta.env.local "$APP_DIR/.env.local"
mkdir -p "$APP_DIR/deploy/app"
install -m 644 /tmp/contentbeta-ecosystem.config.cjs "$APP_DIR/deploy/app/ecosystem.config.cjs"
rm -f ${tarballRemote} /tmp/contentbeta.env.local /tmp/contentbeta-ecosystem.config.cjs

cd "$APP_DIR"
echo "== npm ci =="
npm ci
echo "== next build =="
NODE_ENV=production npm run build

echo "== pm2 =="
pm2 startOrReload "$APP_DIR/deploy/app/ecosystem.config.cjs" --update-env
pm2 save

echo "== nginx http bootstrap (if needed) =="
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  cat >"/etc/nginx/sites-available/$DOMAIN" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
EOF
  ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
  nginx -t
  systemctl reload nginx
  # Wait briefly for DNS
  for i in 1 2 3 4 5 6 7 8 9 10; do
    dig +short "$DOMAIN" A | grep -q '148.230.67.132' && break
    sleep 3
  done
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

echo "== nginx full TLS config =="
install -m 644 /tmp/nginx-studio.aneeverse.com.conf "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t
systemctl reload nginx
rm -f /tmp/nginx-studio.aneeverse.com.conf

echo "== verify =="
pm2 status contentbeta
curl -sS -o /dev/null -w "local:%{http_code}\\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "https:%{http_code}\\n" "https://$DOMAIN/" || true
echo DONE
`

  const bootstrapLocal = path.join(root, 'deploy', 'app', '_remote-bootstrap.sh')
  fs.writeFileSync(bootstrapLocal, remoteBootstrap.replace(/\r\n/g, '\n'))

  const conn = await connect()
  try {
    await exec(conn, `mkdir -p ${remoteDir}`)
    await upload(conn, tarballLocal, tarballRemote)
    await upload(conn, path.join(root, '.env.local'), '/tmp/contentbeta.env.local')
    await upload(
      conn,
      path.join(root, 'deploy', 'app', 'nginx-studio.aneeverse.com.conf'),
      '/tmp/nginx-studio.aneeverse.com.conf'
    )
    await upload(
      conn,
      path.join(root, 'deploy', 'app', 'ecosystem.config.cjs'),
      '/tmp/contentbeta-ecosystem.config.cjs'
    )
    await upload(conn, bootstrapLocal, '/tmp/contentbeta-bootstrap.sh')
    await exec(conn, 'chmod +x /tmp/contentbeta-bootstrap.sh && bash /tmp/contentbeta-bootstrap.sh && rm -f /tmp/contentbeta-bootstrap.sh', {
      timeoutMs: 1200000,
    })
    console.log(`\nDeploy complete → https://${domain}`)
  } finally {
    conn.end()
    if (fs.existsSync(tarballLocal)) fs.unlinkSync(tarballLocal)
    if (fs.existsSync(bootstrapLocal)) fs.unlinkSync(bootstrapLocal)
  }
}

main().catch((e) => {
  console.error('\nDEPLOY_FAILED', e.message || e)
  process.exit(1)
})
