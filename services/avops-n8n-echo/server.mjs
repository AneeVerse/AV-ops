import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

function loadEnv () {
  const file = path.join(root, '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
}

function textOf (value) {
  if (typeof value !== 'string') throw new Error('invalid input')
  const text = value.trim()
  if (text.length < 1 || text.length > 200 || /[\u0000-\u001f]/.test(text)) throw new Error('invalid input')
  return text
}

function echoUrl () {
  const url = process.env.AVOPS_N8N_ECHO_URL || ''
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('echo url is not configured')
  }
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.port !== '5678') {
    throw new Error('echo url is not local')
  }
  if (!parsed.pathname.startsWith('/webhook/')) throw new Error('echo url is not local')
  return parsed.toString()
}

async function echoTest (args) {
  const input = textOf(args?.input)
  const secret = process.env.AVOPS_N8N_ECHO_SECRET
  if (!secret) throw new Error('echo secret is not configured')
  const response = await fetch(echoUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-avops-echo': secret
    },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(8000)
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body || body.result !== 'AV OPS TEST OK') {
    throw new Error('echo workflow failed')
  }
  return { ok: true, result: body.result, input: body.input }
}

const tool = {
  name: 'echo_test',
  description: 'Run the one approved n8n test workflow. It echoes the input and returns AV OPS TEST OK. It does not send messages or change data.',
  inputSchema: {
    type: 'object',
    properties: { input: { type: 'string' } },
    required: ['input'],
    additionalProperties: false
  }
}

function rpcResult (id, result) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError (id, message) {
  return { jsonrpc: '2.0', id, error: { code: -32000, message } }
}

async function handleRpc (message) {
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message?.id ?? null, 'invalid request')
  }
  if (message.method === 'initialize') {
    return rpcResult(message.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'avops-n8n-echo', version: '0.1.0' }
    })
  }
  if (message.method === 'notifications/initialized' || message.method === 'initialized') return null
  if (message.method === 'tools/list') {
    return rpcResult(message.id, { tools: [tool] })
  }
  if (message.method === 'tools/call') {
    if (message.params?.name !== 'echo_test') {
      return rpcResult(message.id, { content: [{ type: 'text', text: 'invalid tool' }], isError: true })
    }
    try {
      const data = await echoTest(message.params?.arguments)
      return rpcResult(message.id, { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false })
    } catch (error) {
      return rpcResult(message.id, { content: [{ type: 'text', text: String(error.message || 'request failed') }], isError: true })
    }
  }
  if (message.id == null) return null
  return rpcError(message.id, 'method not found')
}

loadEnv()
const rl = readline.createInterface({ input: process.stdin })
rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }
  const response = await handleRpc(message)
  if (response) process.stdout.write(JSON.stringify(response) + '\n')
})
