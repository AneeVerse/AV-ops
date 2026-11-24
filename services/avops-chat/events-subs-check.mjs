import crypto from 'node:crypto'
import fs from 'node:fs'

const root = '/opt/av_ops/docker/avops-chat'
const renewSpace = process.argv.includes('--renew') ? process.argv[process.argv.indexOf('--renew') + 1] : ''
const renewAppSpace = process.argv.includes('--renew-app') ? process.argv[process.argv.indexOf('--renew-app') + 1] : ''
const dueOnly = process.argv.includes('--due')
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
const token = tokenBody.access_token
const operate = new Set(JSON.parse(fs.readFileSync(root + '/operate.json', 'utf8')))

async function google (url, options = {}, bearer = token) {
  const res = await fetch(url, {
    ...options,
    headers: { authorization: 'Bearer ' + bearer, 'content-type': 'application/json', ...(options.headers || {}) }
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

function appAccessToken () {
  const sa = JSON.parse(fs.readFileSync('/opt/av_ops/docker/hermes_agent/profiles/avops/google-chat-sa.json', 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/chat.app.messages.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signer.sign(sa.private_key, 'base64url') })
  }).then(async (res) => {
    const body = await res.json()
    if (!body.access_token) throw new Error(body.error || 'app token failed')
    return body.access_token
  })
}

const found = []
let pageToken = ''
do {
  const url = new URL('https://workspaceevents.googleapis.com/v1/subscriptions')
  url.searchParams.set('pageSize', '100')
  url.searchParams.set('filter', 'event_types:"google.workspace.chat.message.v1.created"')
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  const page = await google(url)
  if (page.status !== 200) throw new Error(String(page.body.error?.message || page.status).slice(0, 200))
  found.push(...(page.body.subscriptions || []))
  pageToken = page.body.nextPageToken || ''
} while (pageToken)

const saved = { at: new Date().toISOString(), spaces: {} }
const now = Date.now()
let active = 0
let wrongTopic = 0
let wrongEvent = 0
const missing = []
const covered = new Set()
for (const row of found) {
  const target = String(row.targetResource || '')
  const id = (target.match(/spaces\/[A-Za-z0-9_-]+/) || [])[0] || ''
  const events = row.eventTypes || []
  const topic = row.notificationEndpoint?.pubsubTopic || ''
  const expire = row.expireTime || null
  const record = {
    name: row.name,
    state: row.state || null,
    expire,
    topic,
    events,
    suspended: row.suspensionReason || null
  }
  if (id) saved.spaces[id] = record
  if (row.state === 'ACTIVE') active += 1
  if (topic !== 'projects/hermes-avops/topics/hermes-chat-events') wrongTopic += 1
  if (!events.includes('google.workspace.chat.message.v1.created')) wrongEvent += 1
  if (operate.has(id)) covered.add(id)
}
for (const id of operate) if (!covered.has(id)) missing.push(id)
fs.writeFileSync(root + '/events-subs.json', JSON.stringify(saved, null, 2) + '\n', { mode: 0o600 })
const expires = found.map((row) => row.expireTime).filter(Boolean).sort()
const due = found.filter((row) => row.expireTime && Date.parse(row.expireTime) - now < 48 * 60 * 60 * 1000)

async function finishOperation (operation, bearer = token) {
  let current = operation
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (current.done || current.response || current.error) return current
    if (!current.name) return current
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const next = await google('https://workspaceevents.googleapis.com/v1/' + current.name, {}, bearer)
    current = next.body
  }
  return current
}

async function reactivate (row, bearer = token) {
  const before = { state: row.state, expire: row.expireTime, target: row.targetResource, events: row.eventTypes, topic: row.notificationEndpoint?.pubsubTopic }
  const res = await google('https://workspaceevents.googleapis.com/v1/' + row.name + '?updateMask=ttl', {
    method: 'PATCH',
    body: JSON.stringify({ ttl: '0s' })
  }, bearer)
  const operation = await finishOperation(res.body, bearer)
  const afterName = operation.response?.name || row.name
  const read = await google('https://workspaceevents.googleapis.com/v1/' + afterName, {}, bearer)
  const after = read.body || {}
  const sameTarget = after.targetResource === before.target
  const sameTopic = (after.notificationEndpoint?.pubsubTopic || '') === (before.topic || '')
  const sameEvent = (after.eventTypes || []).includes('google.workspace.chat.message.v1.created')
  return {
    http: res.status,
    error: String(res.body.error?.message || operation.error?.message || '').slice(0, 240),
    before_expire: before.expire,
    after_state: after.state || null,
    after_expire: after.expireTime || null,
    same_target: sameTarget,
    same_topic: sameTopic,
    same_event: sameEvent,
    active: after.state === 'ACTIVE'
  }
}

const renewals = []
const targets = []
const stamp = root + '/events-renew.stamp'
if (renewSpace) {
  const row = found.find((item) => String(item.targetResource || '').includes(renewSpace))
  if (!row) renewals.push({ space: renewSpace, error: 'subscription not found' })
  else targets.push(row)
}
if (dueOnly && due.length) {
  const age = fs.existsSync(stamp) ? Date.now() - fs.statSync(stamp).mtimeMs : Infinity
  if (age >= 12 * 60 * 60 * 1000) targets.push(...due)
}
for (const row of targets) {
  const id = (String(row.targetResource || '').match(/spaces\/[A-Za-z0-9_-]+/) || [])[0] || ''
  const result = await reactivate(row)
  renewals.push({ space: id, ...result })
  if (result.after_expire && saved.spaces[id]) {
    saved.spaces[id].expire = result.after_expire
    saved.spaces[id].state = result.after_state
  }
}
if (renewals.length) fs.writeFileSync(root + '/events-subs.json', JSON.stringify(saved, null, 2) + '\n', { mode: 0o600 })
if (dueOnly && renewals.length && renewals.every((row) => row.active === true)) fs.writeFileSync(stamp, new Date().toISOString())

const appRenewals = []
let appListed = 0
let appActive = 0
let appCovered = 0
let appMissing = []
let appError = null
const appSaved = { at: new Date().toISOString(), spaces: {} }
try {
  const appToken = await appAccessToken()
  const appRows = []
  // List is capped at 100 rows and omits nextPageToken, so each Space is queried by target.
  for (const id of operate) {
    const url = new URL('https://workspaceevents.googleapis.com/v1/subscriptions')
    url.searchParams.set('pageSize', '10')
    url.searchParams.set('filter', `event_types:"google.workspace.chat.message.v1.created" AND target_resource="//chat.googleapis.com/${id}"`)
    const page = await google(url, {}, appToken)
    if (page.status !== 200) throw new Error(String(page.body.error?.message || page.status).slice(0, 200))
    const rows = (page.body.subscriptions || []).filter((row) => row.serviceAccountAuthority)
    if (!rows.length) appMissing.push(id)
    appRows.push(...rows)
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  appListed = appRows.length
  const appTargets = []
  for (const row of appRows) {
    const id = (String(row.targetResource || '').match(/spaces\/[A-Za-z0-9_-]+/) || [])[0] || ''
    if (row.state === 'ACTIVE') appActive += 1
    if (operate.has(id)) appCovered += 1
    if (id) {
      appSaved.spaces[id] = {
        name: row.name,
        state: row.state || null,
        expire: row.expireTime || null,
        topic: row.notificationEndpoint?.pubsubTopic || '',
        events: row.eventTypes || [],
        authority: row.serviceAccountAuthority,
        suspended: row.suspensionReason || null
      }
    }
    const dueApp = row.expireTime && Date.parse(row.expireTime) - now < 48 * 60 * 60 * 1000
    if (renewAppSpace && id === renewAppSpace) appTargets.push(row)
    else if (dueOnly && dueApp) appTargets.push(row)
  }
  for (const row of appTargets) {
    const id = (String(row.targetResource || '').match(/spaces\/[A-Za-z0-9_-]+/) || [])[0] || ''
    const result = await reactivate(row, appToken)
    appRenewals.push({ space: id, authority: 'app', ...result })
    if (result.after_expire && appSaved.spaces[id]) {
      appSaved.spaces[id].expire = result.after_expire
      appSaved.spaces[id].state = result.after_state
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  fs.writeFileSync(root + '/events-subs-app.json', JSON.stringify(appSaved, null, 2) + '\n', { mode: 0o600 })
} catch (error) {
  appError = String(error.message || error).slice(0, 240)
}

const health = {
  at: new Date().toISOString(),
  listed: found.length,
  active,
  operate: operate.size,
  operate_covered: covered.size,
  missing: missing.length,
  wrong_topic: wrongTopic,
  wrong_event: wrongEvent,
  earliest_expire: expires[0] || null,
  latest_expire: expires[expires.length - 1] || null,
  due_within_48h: due.length,
  renewals,
  app_listed: appListed,
  app_active: appActive,
  app_operate_covered: appCovered,
  app_missing: appMissing.length,
  app_list_error: appError,
  app_renewals: appRenewals
}
fs.writeFileSync(root + '/events-health.json', JSON.stringify(health, null, 2) + '\n')
console.log(JSON.stringify(health, null, 2))
if (appError || appMissing.length || renewals.some((row) => row.active !== true) || appRenewals.some((row) => row.active !== true)) process.exitCode = 2
