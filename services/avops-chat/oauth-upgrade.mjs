import fs from 'node:fs'
import http from 'node:http'
import crypto from 'node:crypto'

const oauthPath = '/opt/av_ops/docker/avops-chat/oauth.json'
const expected = 'anees@aneeverse.com'
const redirect = 'http://127.0.0.1:8788/callback'
const scopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.app',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.admin.spaces.readonly',
  'https://www.googleapis.com/auth/chat.admin.memberships',
  'https://www.googleapis.com/auth/admin.directory.user.readonly'
]
const current = JSON.parse(fs.readFileSync(oauthPath, 'utf8'))
const state = crypto.randomBytes(16).toString('hex')
const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
auth.searchParams.set('client_id', current.client_id)
auth.searchParams.set('redirect_uri', redirect)
auth.searchParams.set('response_type', 'code')
auth.searchParams.set('scope', scopes.join(' '))
auth.searchParams.set('access_type', 'offline')
auth.searchParams.set('prompt', 'consent')
auth.searchParams.set('login_hint', expected)
auth.searchParams.set('state', state)
console.log('AUTH_URL=' + auth.toString())

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, redirect)
    if (url.pathname !== '/callback') {
      res.writeHead(404).end('not found')
      return
    }
    if (url.searchParams.get('state') !== state) {
      res.writeHead(400).end('state did not match. No token was saved.')
      return
    }
    const error = url.searchParams.get('error')
    if (error) {
      res.writeHead(400).end('Google did not grant access: ' + String(error).slice(0, 80))
      return
    }
    const code = url.searchParams.get('code')
    if (!code) {
      res.writeHead(400).end('missing code')
      return
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: current.client_id,
        client_secret: current.client_secret,
        redirect_uri: redirect,
        grant_type: 'authorization_code'
      })
    })
    const token = await tokenRes.json()
    if (!token.refresh_token) {
      res.writeHead(400).end('Google did not return a refresh token. No token was saved.')
      return
    }
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: 'Bearer ' + token.access_token }
    })
    const info = await infoRes.json()
    const email = String(info.email || '').toLowerCase()
    if (email !== expected) {
      res.writeHead(403).end('Signed in as ' + (email || 'an unknown account') + '. Expected ' + expected + '. No token was saved.')
      console.log('REJECTED_EMAIL=' + (email || 'unknown'))
      return
    }
    const infoToken = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token.access_token))
    const tokenInfo = await infoToken.json()
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
    fs.copyFileSync(oauthPath, oauthPath + '.bak-' + stamp)
    const next = {
      client_id: current.client_id,
      client_secret: current.client_secret,
      refresh_token: token.refresh_token
    }
    fs.writeFileSync(oauthPath, JSON.stringify(next) + '\n', { mode: 0o600 })
    fs.chmodSync(oauthPath, 0o600)
    console.log('SAVED_EMAIL=' + email)
    console.log('SCOPES=' + String(tokenInfo.scope || ''))
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('Hermes Chat access saved for ' + email + '. You can close this tab.')
    setTimeout(() => process.exit(0), 300)
  } catch (error) {
    console.log('CALLBACK_ERROR=' + String(error.message || error).slice(0, 180))
    res.writeHead(500).end('callback failed. No token was saved.')
  }
})
server.listen(8788, '127.0.0.1')
