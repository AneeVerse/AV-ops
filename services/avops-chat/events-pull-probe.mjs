import crypto from 'node:crypto'
import fs from 'node:fs'

const root = '/opt/av_ops/docker/avops-chat'
const oauth = JSON.parse(fs.readFileSync(root + '/oauth.json', 'utf8'))
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: oauth.client_id,
    client_secret: oauth.client_secret,
    refresh_token: oauth.refresh_token,
    grant_type: 'refresh_token'
  })
})
const user = await tokenRes.json()
if (!user.access_token) throw new Error('refresh failed')
const listed = await fetch('https://workspaceevents.googleapis.com/v1/subscriptions?pageSize=10', {
  headers: { authorization: 'Bearer ' + user.access_token }
})
const listBody = await listed.json()
const subs = (listBody.subscriptions || []).map((row) => ({
  name: row.name || null,
  state: row.state || null,
  target: row.targetResource || null,
  expire: row.expireTime || null
}))

const sa = JSON.parse(fs.readFileSync('/opt/av_ops/docker/hermes_agent/profiles/avops/google-chat-sa.json', 'utf8'))
const now = Math.floor(Date.now() / 1000)
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/pubsub',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600
})
const signer = crypto.createSign('RSA-SHA256')
signer.update(unsigned)
const assertion = unsigned + '.' + signer.sign(sa.private_key, 'base64url')
const saTokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  })
})
const saToken = await saTokenRes.json()
let pull = { status: saTokenRes.status, error: saToken.error || null }
if (saToken.access_token) {
  const res = await fetch('https://pubsub.googleapis.com/v1/projects/hermes-avops/subscriptions/hermes-chat-events-sub:pull', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + saToken.access_token,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ maxMessages: 5, returnImmediately: true })
  })
  const body = await res.json().catch(() => ({}))
  pull = {
    status: res.status,
    received: Array.isArray(body.receivedMessages) ? body.receivedMessages.length : 0,
    error: body.error?.status || body.error?.message || null
  }
}
console.log(JSON.stringify({
  list_status: listed.status,
  subscriptions: subs,
  list_error: listBody.error?.status || null,
  pull
}, null, 2))
