import crypto from 'node:crypto'
import fs from 'node:fs'
import { Packr } from 'msgpackr'
import WebSocket from 'ws'

function loadEnv (file) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[trimmed.slice(0, eq).trim()]) process.env[trimmed.slice(0, eq).trim()] = value
  }
}
loadEnv('/opt/av_ops/docker/avops-mcp/.env')
const token = process.env.HULY_READ_TOKEN
const packr = new Packr({ structuredClone: true, bundleStrings: true, copyBuffers: false })
const ws = new WebSocket(`${(process.env.HULY_TRANSACTOR_URL || 'ws://127.0.0.1:8087').replace(/\/$/, '')}/${token}?sessionId=${crypto.randomUUID()}`)
let binary = false
let seq = 1
const pending = new Map()
function request (method, params) {
  const id = method === 'hello' ? -1 : seq++
  const body = { method, params, id, time: Date.now(), ...(method === 'hello' ? { binary: false, compression: false } : {}) }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 15000)
    pending.set(id, { resolve, reject, timer })
    ws.send(binary && method !== 'hello' ? packr.pack(body) : JSON.stringify(body))
  })
}
ws.on('message', (data) => {
  let message
  try { message = binary ? packr.unpack(data) : JSON.parse(data.toString()) } catch { return }
  const waiter = pending.get(message?.id)
  if (!waiter) return
  clearTimeout(waiter.timer)
  pending.delete(message.id)
  if (message.error) waiter.reject(new Error('request failed'))
  else waiter.resolve(message.id === -1 ? message : message.result)
})
function rowsOf (result) {
  const rows = result?.dataType === 'TotalArray' && Array.isArray(result.value) ? result.value : result
  return Array.isArray(rows) ? rows : []
}
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('connect')), 8000)
  ws.once('open', () => { clearTimeout(timer); resolve() })
  ws.once('error', () => { clearTimeout(timer); reject(new Error('ws')) })
})
const hello = await request('hello', [])
binary = hello?.binary === true
const people = rowsOf(await request('findAll', ['contact:class:Person', { name: { $like: '%nees%' } }, { limit: 10 }]))
const out = []
for (const person of people) {
  const socials = rowsOf(await request('findAll', ['contact:class:SocialIdentity', { attachedTo: person._id }, { limit: 8 }]))
  out.push({
    id: person._id,
    name: person.name,
    has_person_uuid: Boolean(person.personUuid),
    socials: socials.map((row) => ({
      type: row.type || null,
      is_anees_account: String(row.value || row.key || '').toLowerCase() === 'anees@aneeverse.com',
      is_mayur_account: String(row.value || row.key || '').toLowerCase() === 'mayur@aneeverse.com'
    }))
  })
}
console.log(JSON.stringify(out, null, 2))
ws.close()
