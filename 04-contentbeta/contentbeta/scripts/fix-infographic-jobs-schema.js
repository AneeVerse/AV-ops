#!/usr/bin/env node
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

const sql = `
ALTER TABLE public.infographic_jobs ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE public.infographic_jobs ADD COLUMN IF NOT EXISTS design_explanation text;
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='infographic_jobs' ORDER BY 1;
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

  const remote = '/tmp/fix-infographic-jobs.sql'
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
      'docker cp /tmp/fix-infographic-jobs.sql contentbeta-db:/tmp/fix-infographic-jobs.sql && ' +
      'docker exec contentbeta-db psql -U supabase_admin -d postgres -f /tmp/fix-infographic-jobs.sql && ' +
      'docker kill -s SIGUSR1 contentbeta-rest 2>/dev/null || docker restart contentbeta-rest; ' +
      'sleep 2; rm -f /tmp/fix-infographic-jobs.sql'
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
  console.log('INFOGRAPHIC_JOBS_SCHEMA_FIXED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
