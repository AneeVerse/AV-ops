#!/usr/bin/env node
/**
 * Simple SSH helper for Hostinger VPS.
 * Usage: node scripts/vps-ssh.js 'remote command...'
 * Env: VPS_HOST, VPS_USER, VPS_PASSWORD (or SSH key via VPS_KEY_PATH)
 */
const { Client } = require('ssh2')
const fs = require('fs')

const host = process.env.VPS_HOST || '148.230.67.132'
const username = process.env.VPS_USER || 'root'
const password = process.env.VPS_PASSWORD || ''
const keyPath = process.env.VPS_KEY_PATH || `${process.env.USERPROFILE || process.env.HOME}/.ssh/id_ed25519`
const cmd = process.argv.slice(2).join(' ')
if (!cmd) {
  console.error('Usage: node scripts/vps-ssh.js <command>')
  process.exit(1)
}

const conn = new Client()
const cfg = {
  host,
  port: 22,
  username,
  readyTimeout: 30000,
}
if (password) cfg.password = password
else if (fs.existsSync(keyPath)) cfg.privateKey = fs.readFileSync(keyPath)

conn
  .on('ready', () => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) {
        console.error(err)
        conn.end()
        process.exit(1)
      }
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        conn.end()
        process.exit(code ?? 0)
      })
    })
  })
  .on('error', (e) => {
    console.error('SSH_ERR', e.message)
    process.exit(1)
  })
  .connect(cfg)
