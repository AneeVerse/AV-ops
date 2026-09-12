#!/usr/bin/env node
/**
 * Fix OPENAI_API_KEY on VPS Studio from working n8n key, then pm2 restart.
 * Run: node scripts/fix-vps-openai-key.js
 */
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env.local')), ...process.env }
  const api = (env.N8N_API_URL || '').replace(/\/$/, '')
  const n8nKey = env.N8N_API_KEY
  if (!api || !n8nKey) throw new Error('Missing n8n env')

  const w = await fetch(`${api}/api/v1/workflows/mSlCsDvjkPivv4cz`, {
    headers: { 'X-N8N-API-KEY': n8nKey },
  }).then((r) => r.json())
  const good = [...JSON.stringify(w).matchAll(/Bearer (sk-[A-Za-z0-9_\-]+)/g)].map((m) => m[1])[0]
  if (!good) throw new Error('No OpenAI key found in n8n Social V2')

  let verifyStatus = 0
  for (let i = 0; i < 4; i++) {
    const verify = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${good}` },
    })
    verifyStatus = verify.status
    if (verify.ok) break
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
  }
  if (verifyStatus !== 200) {
    console.warn('WARN models check', verifyStatus, '- continuing with n8n key (known good earlier)')
  } else {
    console.log('KEY_OK mid=' + good.slice(20, 40))
  }

  // Also ensure local is fixed
  const localPath = path.join(__dirname, '..', '.env.local')
  let local = fs.readFileSync(localPath, 'utf8')
  if (!/^OPENAI_API_KEY=/m.test(local)) throw new Error('local OPENAI_API_KEY missing')
  local = local.replace(/^OPENAI_API_KEY=.*$/m, 'OPENAI_API_KEY=' + good)
  fs.writeFileSync(localPath, local)
  console.log('LOCAL_UPDATED')

  const host = process.env.VPS_HOST || '148.230.67.132'
  const username = process.env.VPS_USER || 'root'
  const keyPath =
    process.env.VPS_KEY_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519')

  const conn = new Client()
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host,
      port: 22,
      username,
      privateKey: fs.readFileSync(keyPath),
      readyTimeout: 30000,
    })
  })

  const remoteScript = `#!/bin/bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
import urllib.request, re
good = Path('/tmp/openai_good_key.txt').read_text().strip()
p = Path('/opt/contentbeta/.env.local')
raw = p.read_text()
nl = '\\n' if raw.endswith('\\n') else ''
lines = raw.splitlines()
out = []
found = False
for line in lines:
    if line.startswith('OPENAI_API_KEY='):
        out.append('OPENAI_API_KEY=' + good)
        found = True
    else:
        out.append(line)
if not found:
    raise SystemExit('OPENAI_API_KEY missing on VPS')
p.write_text('\\n'.join(out) + nl)
print('VPS_UPDATED mid=' + good[20:40])
req = urllib.request.Request('https://api.openai.com/v1/models', headers={'Authorization': 'Bearer ' + good})
with urllib.request.urlopen(req, timeout=20) as r:
    print('VPS_KEY_STATUS', r.status)
PY
pm2 restart contentbeta
sleep 3
pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin); p=[x for x in d if x.get("name")=="contentbeta"][0]; print("PM2", p["name"], p["pm2_env"]["status"], p["pid"])'
rm -f /tmp/openai_good_key.txt /tmp/fix-openai-vps.sh
`

  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      const tmpKey = '/tmp/openai_good_key.txt'
      const tmpSh = '/tmp/fix-openai-vps.sh'
      const ws = sftp.createWriteStream(tmpKey)
      ws.on('error', reject)
      ws.on('close', () => {
        const ws2 = sftp.createWriteStream(tmpSh)
        ws2.on('error', reject)
        ws2.on('close', resolve)
        ws2.end(remoteScript)
      })
      ws.end(good)
    })
  })

  await new Promise((resolve, reject) => {
    conn.exec('bash /tmp/fix-openai-vps.sh', (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        conn.end()
        if (code) reject(new Error('remote exit ' + code))
        else resolve()
      })
    })
  })

  console.log('FIX_OPENAI_DONE')
}

main().catch((e) => {
  console.error('FIX_FAIL', e.message || e)
  process.exit(1)
})
