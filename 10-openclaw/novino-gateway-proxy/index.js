'use strict'

/**
 * Tiny HTTP bridge: Aneeverse /_novino -> OpenClaw gateway WebSocket.
 * OPENCLAW_GATEWAY_TOKEN never leaves this process.
 */

const http = require('http')
const crypto = require('crypto')
const { WebSocket } = require('ws')

const AGENT = process.env.NOVINO_AGENT || 'novino'
const BIND = process.env.NOVINO_BIND || '127.0.0.1'
const PORT = Number(process.env.NOVINO_PORT || 3011)
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_WS || process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN
const GATEWAY_ORIGIN = process.env.OPENCLAW_GATEWAY_ORIGIN || 'https://bot.aneeverse.com'
const SESSION_PREFIX = `agent:${AGENT}:`
const DEFAULT_SESSION = `${SESSION_PREFIX}main`

const ALLOWED_ORIGINS = new Set(
  (process.env.NOVINO_ALLOWED_ORIGINS || 'https://app.aneeverse.com')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
)

function isAllowedOrigin (origin) {
  if (origin == null || origin === '') {
    return true
  }
  if (ALLOWED_ORIGINS.has(origin)) {
    return true
  }
  try {
    const url = new URL(origin)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function json (res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

function readBody (req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('Request too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function cleanVisibleText (value) {
  return value
    .replace(/<final>([\s\S]*?)<\/final>/gi, '$1')
    .replace(/<answer>([\s\S]*?)<\/answer>/gi, '$1')
    .replace(/<assistant>([\s\S]*?)<\/assistant>/gi, '$1')
    .replace(/<\/?(?:final|answer|assistant)>/gi, '')
    .trim()
}

function messageText (message) {
  let text = ''
  if (typeof message.text === 'string') {
    text = message.text
  } else if (typeof message.content === 'string') {
    text = message.content
  } else if (Array.isArray(message.content)) {
    text = message.content
      .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
  }
  return cleanVisibleText(text)
}

function mapMessages (messages) {
  if (!Array.isArray(messages)) {
    return []
  }
  return messages.map((message, index) => ({
    id: String(message.id ?? `${index}-${message.timestamp ?? ''}`),
    role: typeof message.role === 'string' ? message.role : 'assistant',
    text: messageText(message),
    timestamp: message.timestamp ?? null
  }))
}

function assertNovinoSession (sessionKey) {
  if (typeof sessionKey !== 'string' || !sessionKey.startsWith(SESSION_PREFIX)) {
    throw new Error(`sessionKey must start with ${SESSION_PREFIX}`)
  }
  return sessionKey
}

class OpenClawRpcClient {
  constructor () {
    this.ws = undefined
    this.pending = new Map()
    this.connected = false
  }

  async connect () {
    if (!GATEWAY_TOKEN) {
      throw new Error('OPENCLAW_GATEWAY_TOKEN is not set')
    }

    this.ws = new WebSocket(GATEWAY_URL, {
      headers: { Origin: GATEWAY_ORIGIN }
    })

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('OpenClaw Gateway connection timed out')), 10000)

      this.ws.once('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      this.ws.once('close', (code, reason) => {
        if (!this.connected) {
          clearTimeout(timer)
          reject(new Error(`OpenClaw Gateway closed before connect (${code}): ${String(reason)}`))
        }
      })
      this.ws.once('open', () => {
        this.installMessageHandler()
        setTimeout(() => {
          this.request('connect', {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: ['tool-events'],
            client: {
              id: 'openclaw-control-ui',
              version: 'aneeverse-novino-proxy/1.0.0',
              platform: 'server',
              mode: 'webchat'
            },
            auth: { token: GATEWAY_TOKEN },
            userAgent: 'openclaw-control-ui',
            locale: 'en'
          })
            .then(() => {
              this.connected = true
              clearTimeout(timer)
              resolve()
            })
            .catch((err) => {
              clearTimeout(timer)
              reject(err instanceof Error ? err : new Error(String(err)))
            })
        }, 50)
      })
    })
  }

  installMessageHandler () {
    this.ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(String(data))
      } catch {
        return
      }
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        return
      }
      if (msg.type !== 'res') {
        return
      }
      const pending = this.pending.get(msg.id)
      if (pending == null) {
        return
      }
      this.pending.delete(msg.id)
      if (msg.ok) {
        pending.resolve(msg.payload)
      } else {
        pending.reject(new Error(msg.error?.message || 'OpenClaw request failed'))
      }
    })
  }

  request (method, params) {
    if (this.ws == null || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('OpenClaw Gateway is not connected'))
    }
    const id = crypto.randomUUID()
    const payload = { type: 'req', id, method, params }
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`OpenClaw request timed out: ${method}`))
        }
      }, 120000)
    })
    this.ws.send(JSON.stringify(payload))
    return promise
  }

  close () {
    this.ws?.close()
  }
}

async function withOpenClaw (fn) {
  const client = new OpenClawRpcClient()
  await client.connect()
  try {
    return await fn(client)
  } finally {
    client.close()
  }
}

function pathnameOf (req) {
  const host = req.headers.host || '127.0.0.1'
  const url = new URL(req.url || '/', `http://${host}`)
  return url.pathname.replace(/\/+$/, '') || '/'
}

async function handleHistory (body) {
  const sessionKey = assertNovinoSession(
    typeof body.sessionKey === 'string' && body.sessionKey.trim() !== '' ? body.sessionKey.trim() : DEFAULT_SESSION
  )
  const result = await withOpenClaw((client) =>
    client.request('chat.history', { sessionKey, limit: 200, maxChars: 300000 })
  )
  return {
    sessionKey,
    sessionId: result?.sessionId ?? null,
    messages: mapMessages(result?.messages)
  }
}

async function handleSend (body) {
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message === '') {
    const err = new Error('Message is required')
    err.status = 400
    throw err
  }
  const sessionKey = assertNovinoSession(
    typeof body.sessionKey === 'string' && body.sessionKey.trim() !== '' ? body.sessionKey.trim() : DEFAULT_SESSION
  )
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : crypto.randomUUID()
  const result = await withOpenClaw((client) =>
    client.request('chat.send', {
      sessionKey,
      message,
      deliver: false,
      idempotencyKey
    })
  )
  return {
    sessionKey,
    idempotencyKey,
    messages: mapMessages(result?.messages),
    sessionId: result?.sessionId ?? null
  }
}

function handleNew () {
  const stamp = new Date().toISOString().slice(0, 10)
  const sessionKey = `${SESSION_PREFIX}web-${stamp}-${crypto.randomUUID().slice(0, 8)}`
  return { sessionKey }
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = req.headers.origin
    if (!isAllowedOrigin(origin)) {
      json(res, 403, { error: 'Origin not allowed' })
      return
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const path = pathnameOf(req)

    if (req.method === 'GET' && (path === '/health' || path === '/')) {
      json(res, 200, { ok: true, agent: AGENT })
      return
    }

    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' })
      return
    }

    const body = await readBody(req)
    if (body.agentId != null && body.agentId !== AGENT) {
      json(res, 400, { error: `Only agent ${AGENT} is allowed` })
      return
    }

    if (path === '/history') {
      json(res, 200, await handleHistory(body))
      return
    }
    if (path === '/send') {
      json(res, 200, await handleSend(body))
      return
    }
    if (path === '/new') {
      json(res, 200, handleNew())
      return
    }

    json(res, 404, { error: 'Not found' })
  } catch (err) {
    const status = Number(err?.status) || 500
    json(res, status, { error: err instanceof Error ? err.message : 'Novino proxy failed' })
  }
})

server.requestTimeout = 180000
server.headersTimeout = 181000
server.keepAliveTimeout = 5000

server.listen(PORT, BIND, () => {
  console.log(`novino-gateway-proxy listening on ${BIND}:${PORT} -> ${GATEWAY_URL} agent=${AGENT}`)
})
