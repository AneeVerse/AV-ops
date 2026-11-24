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
const tokenBody = await tokenRes.json()
if (!tokenBody.access_token) throw new Error('refresh failed')
const operate = JSON.parse(fs.readFileSync(root + '/operate.json', 'utf8'))
const ids = Array.isArray(operate) ? operate : (operate.spaces || [])
const previous = fs.existsSync(root + '/events-subs.json') ? JSON.parse(fs.readFileSync(root + '/events-subs.json', 'utf8')) : { spaces: {} }
const spaces = previous.spaces || {}
let created = 0
let existing = 0
let failed = 0
for (const id of ids) {
  if (spaces[id]?.name) {
    existing += 1
    continue
  }
  let done = false
  for (let attempt = 0; attempt < 4 && !done; attempt += 1) {
    const res = await fetch('https://workspaceevents.googleapis.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + tokenBody.access_token,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        targetResource: `//chat.googleapis.com/${id}`,
        eventTypes: ['google.workspace.chat.message.v1.created'],
        notificationEndpoint: { pubsubTopic: 'projects/hermes-avops/topics/hermes-chat-events' },
        payloadOptions: { includeResource: false }
      })
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
      continue
    }
    if (res.ok && body.name) {
      spaces[id] = { name: body.name, state: body.state || null, expire: body.expireTime || null }
      created += 1
    } else if (res.status === 409) {
      spaces[id] = { name: body.error?.details?.[0]?.metadata?.name || 'already-exists', state: 'ALREADY_EXISTS', expire: null }
      existing += 1
    } else {
      spaces[id] = { name: null, state: 'ERROR', error: String(body.error?.message || res.status).slice(0, 240) }
      failed += 1
    }
    done = true
  }
  if (!done) {
    spaces[id] = { name: null, state: 'ERROR', error: 'retry exhausted' }
    failed += 1
  }
  fs.writeFileSync(root + '/events-subs.json', JSON.stringify({ at: new Date().toISOString(), spaces }, null, 2) + '\n', { mode: 0o600 })
  await new Promise((resolve) => setTimeout(resolve, 80))
}
console.log(JSON.stringify({ operate: ids.length, created, existing, failed }))
