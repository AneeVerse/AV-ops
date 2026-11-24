import crypto from 'node:crypto'
import fs from 'node:fs'

const root = '/opt/av_ops/docker/avops-chat'
const sa = JSON.parse(fs.readFileSync('/opt/av_ops/docker/hermes_agent/profiles/avops/google-chat-sa.json', 'utf8'))
const topic = 'projects/hermes-avops/topics/hermes-chat-events'
const eventType = 'google.workspace.chat.message.v1.created'
const authority = `projects/${sa.project_id}/serviceAccounts/${sa.client_id}`

function serviceToken () {
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
  return unsigned + '.' + signer.sign(sa.private_key, 'base64url')
}

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceToken() })
})
const tokenBody = await tokenRes.json()
if (!tokenBody.access_token) throw new Error('app token failed')
const token = tokenBody.access_token

async function google (url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(options.headers || {}) }
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function listAll (filter) {
  const rows = []
  let pageToken = ''
  do {
    const url = new URL('https://workspaceevents.googleapis.com/v1/subscriptions')
    url.searchParams.set('pageSize', '100')
    if (filter) url.searchParams.set('filter', filter)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const page = await google(url)
    if (page.status !== 200) throw new Error(String(page.body.error?.message || page.status).slice(0, 200))
    rows.push(...(page.body.subscriptions || []))
    pageToken = page.body.nextPageToken || ''
  } while (pageToken)
  return rows
}

async function listBotSpaces () {
  const names = new Set()
  let pageToken = ''
  do {
    const url = new URL('https://chat.googleapis.com/v1/spaces')
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const page = await google(url)
    if (page.status !== 200) throw new Error(String(page.body.error?.message || page.status).slice(0, 200))
    for (const space of page.body.spaces || []) if (space.name) names.add(space.name)
    pageToken = page.body.nextPageToken || ''
  } while (pageToken)
  return names
}

function spaceId (resource) {
  return (String(resource || '').match(/spaces\/[A-Za-z0-9_-]+/) || [])[0] || ''
}

function recordFrom (row) {
  return {
    name: row.name || null,
    state: row.state || null,
    expire: row.expireTime || null,
    topic: row.notificationEndpoint?.pubsubTopic || '',
    events: row.eventTypes || [],
    authority: row.serviceAccountAuthority || null,
    suspended: row.suspensionReason || null,
    target: row.targetResource || null
  }
}

function valid (row) {
  return row.state === 'ACTIVE' &&
    row.notificationEndpoint?.pubsubTopic === topic &&
    (row.eventTypes || []).includes(eventType) &&
    row.serviceAccountAuthority === authority &&
    !row.suspensionReason
}

async function finish (operation) {
  let current = operation
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (current.done || current.response || current.error || current.state) return current
    if (!current.name) return current
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const next = await google('https://workspaceevents.googleapis.com/v1/' + current.name)
    current = next.body
  }
  return current
}

const operate = JSON.parse(fs.readFileSync(root + '/operate.json', 'utf8'))
const ids = Array.isArray(operate) ? operate : (operate.spaces || [])
const existing = (await listAll('event_types:"google.workspace.chat.message.v1.created"')).filter((row) => row.serviceAccountAuthority)
const bySpace = new Map()
for (const row of existing) {
  const id = spaceId(row.targetResource)
  if (id) bySpace.set(id, row)
}
const members = await listBotSpaces()
const results = {}
let created = 0
let reused = 0
let failed = 0
for (const id of ids) {
  const current = bySpace.get(id)
  if (current && valid(current)) {
    const readable = await google(`https://chat.googleapis.com/v1/${id}/messages?pageSize=1`)
    results[id] = { ...recordFrom(current), result: 'already_active', member: members.has(id), readable: readable.status === 200, legacy_retained: true, legacy_reason: 'live event not yet observed for this space' }
    reused += 1
  } else if (!members.has(id)) {
    results[id] = { name: null, state: 'SKIPPED', result: 'not_a_member', member: false, readable: false, legacy_retained: true, legacy_reason: 'Chat app is not a member, so the user subscription remains the working path' }
    failed += 1
  } else {
    const readable = await google(`https://chat.googleapis.com/v1/${id}/messages?pageSize=1`)
    if (readable.status !== 200) {
      results[id] = { name: null, state: 'SKIPPED', result: 'not_readable', member: true, readable: false, error: String(readable.body.error?.message || readable.status).slice(0, 180), legacy_retained: true, legacy_reason: 'app cannot read messages, so the user subscription remains' }
      failed += 1
    } else {
      let outcome = null
      for (let attempt = 0; attempt < 4 && !outcome; attempt += 1) {
        const res = await google('https://workspaceevents.googleapis.com/v1/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            targetResource: `//chat.googleapis.com/${id}`,
            eventTypes: [eventType],
            notificationEndpoint: { pubsubTopic: topic },
            // Name-only on purpose. The gateway hydrates, then answers only a DM, the test space, an active thread, or a message that names Hermes.
            payloadOptions: { includeResource: false }
          })
        })
        if (res.status === 429 || res.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
          continue
        }
        if (res.status === 409) {
          const metadata = (res.body.error?.details || []).find((item) => item.metadata)?.metadata || {}
          const name = metadata.current_subscription || metadata.subscription || ''
          const read = name ? await google('https://workspaceevents.googleapis.com/v1/' + name) : { status: 404, body: {} }
          outcome = { ...recordFrom(read.body.name ? read.body : {}), result: 'already_exists', member: true, readable: true, http: res.status, legacy_retained: true, legacy_reason: 'legacy user subscription retained until a live event proves this space' }
          reused += 1
        } else if (res.status === 200) {
          const done = await finish(res.body)
          const createdRow = done.response || (done.name?.startsWith('subscriptions/') ? done : null)
          const name = createdRow?.name
          const read = name ? await google('https://workspaceevents.googleapis.com/v1/' + name) : { status: 0, body: {} }
          const row = read.body?.name ? read.body : createdRow
          if (row?.name && valid(row)) {
            outcome = { ...recordFrom(row), result: 'created', member: true, readable: true, legacy_retained: true, legacy_reason: 'legacy user subscription retained until a live event proves this space' }
            created += 1
          } else {
            outcome = { ...recordFrom(row || {}), result: 'created_unverified', member: true, readable: true, error: String(done.error?.message || 'subscription was not readable after create').slice(0, 180), legacy_retained: true }
            failed += 1
          }
        } else {
          outcome = { name: null, state: 'ERROR', result: 'create_failed', member: true, readable: true, error: String(res.body.error?.message || res.status).slice(0, 220), legacy_retained: true, legacy_reason: 'create failed; user subscription retained' }
          failed += 1
        }
      }
      results[id] = outcome || { name: null, state: 'ERROR', result: 'retry_exhausted', legacy_retained: true, legacy_reason: 'create retries exhausted; user subscription retained' }
      if (!outcome) failed += 1
    }
  }
  if ((Object.keys(results).length % 10) === 0) {
    fs.writeFileSync(root + '/events-migration.json', JSON.stringify({ at: new Date().toISOString(), created, reused, failed, spaces: results }, null, 2) + '\n', { mode: 0o600 })
    console.log(JSON.stringify({ progress: Object.keys(results).length, created, reused, failed }))
  }
  await new Promise((resolve) => setTimeout(resolve, 120))
}
const report = { at: new Date().toISOString(), operate: ids.length, created, reused, failed, authority, topic, event_type: eventType, spaces: results }
fs.writeFileSync(root + '/events-migration.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
const appRegistry = { at: report.at, spaces: {} }
for (const [id, row] of Object.entries(results)) {
  if (row.name) appRegistry.spaces[id] = row
}
fs.writeFileSync(root + '/events-subs-app.json', JSON.stringify(appRegistry, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ operate: ids.length, created, reused, failed, members: members.size }))
