import crypto from 'node:crypto'
import fs from 'node:fs'
import { spawn } from 'node:child_process'

const sa = JSON.parse(fs.readFileSync('/opt/av_ops/docker/hermes_agent/profiles/avops/google-chat-sa.json', 'utf8'))
const sub = 'projects/hermes-avops/subscriptions/hermes-chat-events-ops'

function serviceToken () {
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
  return unsigned + '.' + signer.sign(sa.private_key, 'base64url')
}

async function accessToken () {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: serviceToken()
    })
  })
  const body = await res.json()
  if (!body.access_token) throw new Error(body.error || 'pubsub token failed')
  return body.access_token
}

function runSync (spaces) {
  const args = ['/opt/av_ops/docker/avops-chat/sync.mjs']
  if (spaces.length) args.push('--spaces', spaces.join(','))
  return new Promise((resolve) => {
    const child = spawn('node', args, { stdio: 'inherit' })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function writeHealth (extra) {
  const file = '/opt/av_ops/docker/avops-chat/puller-health.json'
  let current = {}
  try { current = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { current = {} }
  fs.writeFileSync(file, JSON.stringify({ ...current, at: new Date().toISOString(), ...extra }, null, 2) + '\n')
}

function decodeData (message) {
  try {
    return JSON.parse(Buffer.from(message.message?.data || '', 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function isDiagnostic (row) {
  const attrs = row.message?.attributes || {}
  if (attrs.avops_diagnostic) return true
  const data = decodeData(row)
  return Boolean(data && typeof data === 'object' && data.avops_diagnostic)
}

function matchResource (value, kind) {
  const text = String(value || '')
  const message = text.match(/spaces\/[A-Za-z0-9_-]+\/messages\/[A-Za-z0-9._-]+/)
  if (kind === 'message') return message ? message[0] : ''
  const space = text.match(/spaces\/[A-Za-z0-9_-]+/)
  return space ? space[0] : ''
}

function eventIdentity (row) {
  const data = decodeData(row) || {}
  const attrs = row.message?.attributes || {}
  const nested = data.message || data.data?.message || {}
  const eventType = data.eventType || data.type || attrs['ce-type'] || ''
  const message = matchResource(nested.name, 'message') || matchResource(data.subject, 'message') || matchResource(attrs['ce-subject'], 'message') || matchResource(data.resource?.name, 'message')
  const space = matchResource(message, 'space') || matchResource(data.subject, 'space') || matchResource(attrs['ce-subject'], 'space') || matchResource(nested.space?.name, 'space') || matchResource(data.space?.name, 'space')
  const key = message ? eventType + '|' + message : ''
  return { eventType, space, message, key }
}

function readSeen () {
  try { return JSON.parse(fs.readFileSync('/opt/av_ops/docker/avops-chat/event-seen.json', 'utf8')) } catch { return { keys: {} } }
}

function writeSeen (seen) {
  const entries = Object.entries(seen.keys || {})
  const trimmed = entries.length > 4000 ? entries.slice(entries.length - 4000) : entries
  fs.writeFileSync('/opt/av_ops/docker/avops-chat/event-seen.json', JSON.stringify({ keys: Object.fromEntries(trimmed) }, null, 2) + '\n')
}

function eventSummary (row) {
  const data = decodeData(row) || {}
  const attrs = row.message?.attributes || {}
  const identity = eventIdentity(row)
  return {
    event_type: identity.eventType || null,
    resource: identity.message || identity.space || '',
    space: identity.space || null,
    ce_source: attrs['ce-source'] || null,
    body_keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 12) : [],
    diagnostic: isDiagnostic(row) ? String(attrs.avops_diagnostic || data.avops_diagnostic || '').slice(0, 80) : null
  }
}

async function renewIfNeeded () {
  const stamp = '/opt/av_ops/docker/avops-chat/events-renew.stamp'
  const age = fs.existsSync(stamp) ? Date.now() - fs.statSync(stamp).mtimeMs : Infinity
  if (age < 12 * 60 * 60 * 1000) return
  const child = spawn('node', ['/opt/av_ops/docker/avops-chat/events-subs-check.mjs', '--due'], { stdio: 'inherit' })
  const code = await new Promise((resolve) => child.on('exit', resolve))
  const retryIn = code === 0 ? 12 * 60 * 60 * 1000 : 60 * 60 * 1000
  fs.writeFileSync(stamp, new Date(Date.now() - (12 * 60 * 60 * 1000 - retryIn)).toISOString())
  if (code !== 0) console.log(JSON.stringify({ at: new Date().toISOString(), alert: 'subscription renewal failed', exit: code }))
}

let token = ''
let tokenAt = 0
for (;;) {
  await renewIfNeeded().catch((error) => {
    console.log(JSON.stringify({ at: new Date().toISOString(), renew_error: String(error.message || error).slice(0, 160) }))
  })
  try {
    if (!token || Date.now() - tokenAt > 45 * 60 * 1000) {
      token = await accessToken()
      tokenAt = Date.now()
    }
    const pullStarted = Date.now()
    const res = await fetch(`https://pubsub.googleapis.com/v1/${sub}:pull`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ maxMessages: 20, returnImmediately: false })
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 401) {
      token = ''
      continue
    }
    if (!res.ok) throw new Error(body.error?.status || String(res.status))
    const received = body.receivedMessages || []
    const pulledAt = new Date().toISOString()
    writeHealth({ last_pull_at: pulledAt, last_pull_status: res.status, last_error: null, waiting: received.length })
    if (!received.length) {
      if (Date.now() - pullStarted < 5000) await sleep(2000)
      continue
    }
    const seen = readSeen()
    seen.keys = seen.keys || {}
    const immediate = []
    const pending = []
    let suppressed = 0
    for (const row of received) {
      const identity = eventIdentity(row)
      if (isDiagnostic(row) || (identity.key && seen.keys[identity.key])) {
        if (identity.key && seen.keys[identity.key]) suppressed += 1
        immediate.push(row)
      } else pending.push(row)
    }
    const ackRows = async (rows) => {
      const ackIds = rows.map((row) => row.ackId).filter(Boolean)
      if (!ackIds.length) return true
      const ack = await fetch(`https://pubsub.googleapis.com/v1/${sub}:acknowledge`, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({ ackIds })
      })
      return ack.ok
    }
    if (immediate.length) await ackRows(immediate)
    if (!pending.length) {
      writeHealth({ last_delivery_at: pulledAt, last_delivery_count: received.length, last_ack: true, last_sync_exit: 0, last_diagnostic_only: pending.length === 0 && suppressed === 0, last_suppressed: suppressed })
      console.log(JSON.stringify({ at: pulledAt, events: received.length, acked: true, suppressed, sync_exit: 0, diagnostic_only: suppressed === 0 }))
      continue
    }
    const ackIds = pending.map((row) => row.ackId).filter(Boolean)
    await fetch(`https://pubsub.googleapis.com/v1/${sub}:modifyAckDeadline`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ ackIds, ackDeadlineSeconds: 180 })
    })
    const lockWaitMs = 0
    const spaces = [...new Set(pending.map((row) => eventIdentity(row).space).filter(Boolean))]
    let dmSpaces = []
    try { dmSpaces = JSON.parse(fs.readFileSync('/opt/av_ops/docker/avops-chat/dm-spaces.json', 'utf8')) } catch { dmSpaces = [] }
    const dmSet = new Set(Array.isArray(dmSpaces) ? dmSpaces : [])
    const workSpaces = spaces.filter((id) => !dmSet.has(id))
    const dmOnly = spaces.length > 0 && workSpaces.length === 0
    const summaries = pending.map(eventSummary)
    const deliveries = pending.map((row) => ({
      message_id: row.message?.messageId || null,
      publish_time: row.message?.publishTime || null
    }))
    let code = lockWaitMs < 0 || !spaces.length ? 1 : (dmOnly ? 0 : await runSync(workSpaces))
    const attempts = globalThis.avopsAttempts || (globalThis.avopsAttempts = new Map())
    let acked = false
    if (code === 0) {
      for (const row of pending) {
        const identity = eventIdentity(row)
        if (identity.key) seen.keys[identity.key] = { at: new Date().toISOString(), pubsub: row.message?.messageId || null }
      }
      writeSeen(seen)
      acked = await ackRows(pending)
      for (const row of pending) attempts.delete(row.message?.messageId)
    } else {
      for (const row of pending) {
        const id = row.message?.messageId || row.ackId
        attempts.set(id, (attempts.get(id) || 0) + 1)
      }
      const giveUp = pending.every((row) => attempts.get(row.message?.messageId || row.ackId) >= 3)
      if (giveUp) {
        acked = await ackRows(pending)
        console.log(JSON.stringify({ at: new Date().toISOString(), alert: 'event processing failed 3 times; left for reconciliation', spaces }))
      } else {
        await fetch(`https://pubsub.googleapis.com/v1/${sub}:modifyAckDeadline`, {
          method: 'POST',
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
          body: JSON.stringify({ ackIds, ackDeadlineSeconds: 0 })
        })
      }
    }
    const processedAt = new Date().toISOString()
    const publishMs = deliveries.map((row) => Date.parse(row.publish_time)).filter(Number.isFinite)
    const latencyMs = publishMs.length ? Date.parse(processedAt) - Math.min(...publishMs) : null
    writeHealth({ last_delivery_at: processedAt, last_delivery_count: received.length, last_ack: acked, last_sync_exit: code, last_deliveries: deliveries, last_diagnostic_only: false, last_suppressed: suppressed, last_latency_ms: latencyMs, last_lock_wait_ms: lockWaitMs })
    console.log(JSON.stringify({ at: processedAt, pulled_at: pulledAt, events: pending.length, suppressed, acked, sync_exit: code, lock_wait_ms: lockWaitMs, latency_ms: latencyMs, spaces, deliveries, summaries }))
  } catch (error) {
    writeHealth({ last_error: String(error.message || error).slice(0, 200) })
    console.log(JSON.stringify({ at: new Date().toISOString(), error: String(error.message || error).slice(0, 200) }))
    await sleep(2000)
  }
}
