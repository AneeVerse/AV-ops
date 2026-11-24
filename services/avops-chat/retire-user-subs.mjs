import crypto from 'node:crypto'
import fs from 'node:fs'

const root = '/opt/av_ops/docker/avops-chat'
const topic = 'projects/hermes-avops/topics/hermes-chat-events'
const eventType = 'google.workspace.chat.message.v1.created'
const excluded = 'spaces/AAQACOxtNdo'
const operate = new Set(JSON.parse(fs.readFileSync(root + '/operate.json', 'utf8')))
if (operate.has(excluded)) throw new Error('credential space is enrolled; refusing to continue')

const sa = JSON.parse(fs.readFileSync('/opt/av_ops/docker/hermes_agent/profiles/avops/google-chat-sa.json', 'utf8'))
const expectedAuthority = `projects/${sa.project_id}/serviceAccounts/${sa.client_id}`
const oauth = JSON.parse(fs.readFileSync(root + '/oauth.json', 'utf8'))

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function userToken () {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauth.client_id,
      client_secret: oauth.client_secret,
      refresh_token: oauth.refresh_token,
      grant_type: 'refresh_token'
    })
  })
  const body = await res.json()
  if (!body.access_token) throw new Error('user token failed')
  return body.access_token
}

function appToken () {
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
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + signer.sign(sa.private_key, 'base64url')
    })
  }).then(async (res) => {
    const body = await res.json()
    if (!body.access_token) throw new Error('app token failed')
    return body.access_token
  })
}

async function google (url, options, bearer) {
  const res = await fetch(url, {
    ...options,
    headers: { authorization: 'Bearer ' + bearer, 'content-type': 'application/json', ...(options.headers || {}) }
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

function spaceId (row) {
  return (String(row.targetResource || '').match(/spaces\/[A-Za-z0-9_-]+/) || [])[0] || ''
}

function validApp (row, id) {
  return Boolean(row)
    && row.state === 'ACTIVE'
    && row.targetResource === `//chat.googleapis.com/${id}`
    && (row.eventTypes || []).includes(eventType)
    && row.notificationEndpoint?.pubsubTopic === topic
    && row.serviceAccountAuthority === expectedAuthority
    && !row.suspensionReason
}

async function listUserSubs (bearer) {
  const rows = []
  let pageToken = ''
  do {
    const url = new URL('https://workspaceevents.googleapis.com/v1/subscriptions')
    url.searchParams.set('pageSize', '100')
    url.searchParams.set('filter', `event_types:"${eventType}"`)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const page = await google(url, {}, bearer)
    if (page.status !== 200) throw new Error(String(page.body.error?.message || page.status).slice(0, 200))
    const got = page.body.subscriptions || []
    rows.push(...got)
    pageToken = page.body.nextPageToken || ''
    if (!pageToken && got.length >= 100) throw new Error('user subscription list truncated at 100; nothing deleted')
  } while (pageToken)
  return rows
}

async function appSubs (id, bearer) {
  const url = new URL('https://workspaceevents.googleapis.com/v1/subscriptions')
  url.searchParams.set('pageSize', '10')
  url.searchParams.set('filter', `event_types:"${eventType}" AND target_resource="//chat.googleapis.com/${id}"`)
  const page = await google(url, {}, bearer)
  if (page.status !== 200) throw new Error(String(page.body.error?.message || page.status).slice(0, 200))
  return (page.body.subscriptions || []).filter((row) => row.serviceAccountAuthority)
}

async function finishOperation (operation, bearer) {
  let current = operation
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (current.done || current.error) return current
    if (!current.name) return current
    await sleep(1000)
    const next = await google('https://workspaceevents.googleapis.com/v1/' + current.name, {}, bearer)
    current = next.body
  }
  return current
}

const userBearer = await userToken()
const appBearer = await appToken()
const listed = await listUserSubs(userBearer)
const candidates = listed.filter((row) => row.userAuthority && operate.has(spaceId(row)) && spaceId(row) !== excluded)
console.log(JSON.stringify({ user_listed: listed.length, candidates: candidates.length, operate: operate.size }))

const outPath = root + '/events-retire.json'
const results = []
function save () {
  fs.writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n', { mode: 0o600 })
}

for (let index = 0; index < candidates.length; index += 10) {
  const batch = candidates.slice(index, index + 10)
  for (const row of batch) {
    const id = spaceId(row)
    const before = await appSubs(id, appBearer)
    const app = before.find((item) => validApp(item, id))
    if (before.length !== 1 || !app) {
      results.push({ space: id, result: 'retained', reason: 'app subscription failed validation', app_count: before.length })
      continue
    }
    const read = await google(`https://chat.googleapis.com/v1/${id}/messages?pageSize=1`, {}, appBearer)
    if (read.status !== 200) {
      results.push({ space: id, result: 'retained', reason: 'space not readable', http: read.status })
      continue
    }
    const deleted = await google('https://workspaceevents.googleapis.com/v1/' + row.name, { method: 'DELETE' }, userBearer)
    const operation = await finishOperation(deleted.body || {}, userBearer)
    if (deleted.status !== 200 || operation.error || operation.done !== true) {
      results.push({
        space: id,
        result: 'retained',
        reason: 'delete did not finish',
        http: deleted.status,
        error: String(operation.error?.message || deleted.body?.error?.message || '').slice(0, 180)
      })
      continue
    }
    const after = await appSubs(id, appBearer)
    const still = after.find((item) => item.name === app.name && validApp(item, id))
    if (!still) {
      results.push({ space: id, result: 'deleted_app_missing', user: row.name, app: app.name })
    } else {
      results.push({
        space: id,
        result: 'deleted',
        user: row.name,
        app: app.name,
        app_state: still.state,
        app_expire: still.expireTime
      })
    }
    await sleep(120)
  }
  save()
  const deleted = results.filter((item) => item.result === 'deleted').length
  const retained = results.filter((item) => item.result !== 'deleted').length
  console.log(JSON.stringify({ progress: Math.min(index + 10, candidates.length), deleted, retained }))
}

const migrationPath = root + '/events-migration.json'
if (fs.existsSync(migrationPath)) {
  const migration = JSON.parse(fs.readFileSync(migrationPath, 'utf8'))
  for (const item of results) {
    if (item.result === 'deleted' && migration.spaces?.[item.space]) {
      migration.spaces[item.space].legacy_retained = false
      migration.spaces[item.space].legacy_reason = 'user subscription deleted after app-only Test Space proof and per-space app validation'
      migration.spaces[item.space].legacy_deleted_at = new Date().toISOString()
    }
  }
  fs.writeFileSync(migrationPath, JSON.stringify(migration, null, 2) + '\n', { mode: 0o600 })
}
console.log(JSON.stringify({
  deleted: results.filter((item) => item.result === 'deleted').length,
  retained: results.filter((item) => item.result !== 'deleted').length,
  problems: results.filter((item) => item.result !== 'deleted')
}))
