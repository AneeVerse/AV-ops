#!/usr/bin/env node
/**
 * Create or update auth user on VPS GoTrue via admin API.
 * Usage: node scripts/create-vps-auth-user.js <email> <password> [role=admin|user]
 * Does not print the password.
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('ssh2')

const email = process.argv[2]
const password = process.argv[3]
const role = process.argv[4] || 'admin'
if (!email || !password) {
  console.error('Usage: node scripts/create-vps-auth-user.js <email> <password> [role]')
  process.exit(1)
}

const host = process.env.VPS_HOST || '148.230.67.132'
const username = process.env.VPS_USER || 'root'
const keyPath =
  process.env.VPS_KEY_PATH ||
  `${process.env.USERPROFILE || process.env.HOME}/.ssh/id_ed25519`

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let out = ''
      let errOut = ''
      stream.on('data', (d) => (out += d.toString()))
      stream.stderr.on('data', (d) => (errOut += d.toString()))
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(errOut || out || `exit ${code}`))
        else resolve(out.trim())
      })
    })
  })
}

async function main() {
  const conn = new Client()
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host,
        port: 22,
        username,
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 30000,
      })
  })

  try {
    const keys = await sshExec(conn, 'cat /opt/contentbeta-supabase/CONTENTBETA_KEYS.txt')
    const serviceKey = keys
      .split(/\r?\n/)
      .find((l) => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))
      ?.slice('SUPABASE_SERVICE_ROLE_KEY='.length)
    if (!serviceKey) throw new Error('Missing service role key on VPS')

    const existing = await sshExec(
      conn,
      `docker exec contentbeta-db psql -U supabase_admin -d postgres -tAc "select id from auth.users where email='${email.replace(/'/g, "''")}';"`
    )

    // Write a one-shot remote script so we don't put password on process list awkwardly in logs
    const payload = JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, email_verified: true },
    })

    const remoteScript = `#!/bin/bash
set -euo pipefail
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /opt/contentbeta-supabase/CONTENTBETA_KEYS.txt | cut -d= -f2-)
EXISTING=$(docker exec contentbeta-db psql -U supabase_admin -d postgres -tAc "select id from auth.users where email='${email.replace(/'/g, "''")}';")
BODY='${payload.replace(/'/g, `'\\''`)}'
if [ -n "$EXISTING" ]; then
  curl -sS -X PUT "http://127.0.0.1:8000/auth/v1/admin/users/$EXISTING" \\
    -H "apikey: $SERVICE_KEY" \\
    -H "Authorization: Bearer $SERVICE_KEY" \\
    -H "Content-Type: application/json" \\
    -d "$BODY"
  echo
  echo UPDATED_ID=$EXISTING
else
  RESP=$(curl -sS -X POST "http://127.0.0.1:8000/auth/v1/admin/users" \\
    -H "apikey: $SERVICE_KEY" \\
    -H "Authorization: Bearer $SERVICE_KEY" \\
    -H "Content-Type: application/json" \\
    -d "$BODY")
  echo "$RESP"
  ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  echo CREATED_ID=$ID
fi
# App treats public.admins.email as admin access
if [ "${role}" = "admin" ]; then
  docker exec contentbeta-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "insert into public.admins (id, email) select id, email from auth.users where email='${email.replace(/'/g, "''")}' on conflict (email) do nothing;" 2>/dev/null \\
    || docker exec contentbeta-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "insert into public.admins (id, email) select id, email from auth.users where email='${email.replace(/'/g, "''")}' and not exists (select 1 from public.admins where email='${email.replace(/'/g, "''")}');"
fi
echo '--- auth.users ---'
docker exec contentbeta-db psql -U supabase_admin -d postgres -tAc "select email from auth.users order by email;"
echo '--- admins ---'
docker exec contentbeta-db psql -U supabase_admin -d postgres -tAc "select email from public.admins order by email;"
`

    const localTmp = path.join(__dirname, '_tmp-create-user.sh')
    fs.writeFileSync(localTmp, remoteScript.replace(/\r\n/g, '\n'))

    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err)
        sftp.fastPut(localTmp, '/tmp/create-contentbeta-user.sh', (e) => {
          sftp.end()
          if (e) reject(e)
          else resolve()
        })
      })
    })
    fs.unlinkSync(localTmp)

    const out = await sshExec(
      conn,
      'chmod +x /tmp/create-contentbeta-user.sh && bash /tmp/create-contentbeta-user.sh; rm -f /tmp/create-contentbeta-user.sh'
    )
    console.log(out)
    console.log(existing ? `Updated password for ${email}` : `Created user ${email}`)
    console.log(`App role metadata: ${role}`)
  } finally {
    conn.end()
  }
}

main().catch((e) => {
  console.error('FAILED', e.message || e)
  process.exit(1)
})
