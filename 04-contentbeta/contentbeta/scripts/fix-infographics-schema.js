#!/usr/bin/env node
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

const sql = `
ALTER TABLE public.infographics ADD COLUMN IF NOT EXISTS remotion_code text;
ALTER TABLE public.infographics ADD COLUMN IF NOT EXISTS theme text;
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='infographics' ORDER BY 1;
`

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519')
  const conn = new Client()
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: '148.230.67.132',
      username: 'root',
      privateKey: fs.readFileSync(keyPath),
      readyTimeout: 30000,
    })
  })

  const remote = `/tmp/fix-infographics.sql`
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      const ws = sftp.createWriteStream(remote)
      ws.on('error', reject)
      ws.on('close', resolve)
      ws.end(sql)
    })
  })

  await new Promise((resolve, reject) => {
    const cmd =
      'docker cp /tmp/fix-infographics.sql contentbeta-db:/tmp/fix-infographics.sql && ' +
      'docker exec contentbeta-db psql -U supabase_admin -d postgres -f /tmp/fix-infographics.sql && ' +
      // reload PostgREST schema cache
      'docker kill -s SIGUSR1 contentbeta-rest 2>/dev/null || docker restart contentbeta-rest; ' +
      'rm -f /tmp/fix-infographics.sql'
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        conn.end()
        if (code) reject(new Error('exit ' + code))
        else resolve()
      })
    })
  })
  console.log('INFOGRAPHICS_SCHEMA_FIXED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
