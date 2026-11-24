import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { TEST_SPACE, classifySpace } from './policy.mjs'

const root = '/opt/av_ops/docker/avops-chat'
const vault = '/opt/av_ops/docker/obsidian/obsidian/Chat/Spaces'

function readJson (file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson (file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

async function userToken () {
  const oauth = readJson(path.join(root, 'oauth.json'))
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
  if (!body.access_token) throw new Error('chat token refresh failed')
  return body.access_token
}

async function googleJson (token, url, options = {}) {
  let lastError = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          authorization: 'Bearer ' + token,
          ...(options.body ? { 'content-type': 'application/json' } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(20000)
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(String(body.error?.message || res.status))
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
      return { status: res.status, body }
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

async function listUserSpaces (token) {
  const spaces = []
  let pageToken = ''
  for (let page = 0; page < 20; page += 1) {
    const url = new URL('https://chat.googleapis.com/v1/spaces')
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const result = await googleJson(token, url)
    if (result.status !== 200) throw new Error(String(result.body.error?.message || result.status).slice(0, 200))
    spaces.push(...(result.body.spaces || []))
    pageToken = result.body.nextPageToken || ''
    if (!pageToken) break
  }
  return spaces
}

function mcpProjects () {
  const child = spawn('node', ['/opt/av_ops/docker/avops-mcp/server.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] })
  return new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve([]) }, 40000)
    let buf = ''
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.id !== 1) continue
        clearTimeout(timer)
        child.kill()
        const text = msg.result?.content?.[0]?.text || '{}'
        const parsed = JSON.parse(text)
        resolve(parsed.items || [])
      }
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_projects', arguments: { limit: 50 } } }) + '\n')
  })
}

async function addApp (token, spaceName) {
  const result = await googleJson(token, `https://chat.googleapis.com/v1/${spaceName}/members`, {
    method: 'POST',
    body: { member: { name: 'users/app', type: 'BOT' } }
  })
  const message = String(result.body.error?.message || '')
  const already = result.status === 409 || /already exists/i.test(message)
  return {
    ok: result.status === 200 || already,
    status: result.status,
    error: already ? null : message.slice(0, 180)
  }
}

async function readProbe (token, spaceName) {
  const result = await googleJson(token, `https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=1`)
  return {
    ok: result.status === 200,
    status: result.status,
    error: result.status === 200 ? null : String(result.body.error?.message || result.status).slice(0, 180)
  }
}

const token = await userToken()
const projects = await mcpProjects()
const byIdentifier = Object.fromEntries(projects.filter((item) => item.identifier && item.id).map((item) => [item.identifier, item.id]))
writeJson(path.join(root, 'projects.json'), byIdentifier)

const spaces = await listUserSpaces(token)
const groups = { operate: [], 'history-only': [], excluded: [] }
for (const space of spaces) {
  const row = {
    name: space.name,
    display_name: space.displayName || '',
    type: space.spaceType || space.type || '',
    user_visible: true
  }
  const decision = classifySpace(row)
  groups[decision.role] ||= []
  groups[decision.role].push({ ...row, ...decision, project_id: decision.project ? (byIdentifier[decision.project] || null) : null })
}

const progress = readJson(path.join(root, 'enroll-progress.json'), [])
const done = new Map(progress.filter((row) => row.membership && row.history).map((row) => [row.id, row]))
const results = []
let failures = 0
for (const space of groups.operate) {
  if (done.has(space.name)) {
    results.push(done.get(space.name))
    continue
  }
  const added = space.name === TEST_SPACE ? { ok: true, status: 200, error: null } : await addApp(token, space.name)
  const membership = await googleJson(token, `https://chat.googleapis.com/v1/${space.name}/members?pageSize=100`)
  const bot = (membership.body.memberships || []).some((item) => item.member?.type === 'BOT')
  const readable = added.ok ? await readProbe(token, space.name) : { ok: false, status: added.status, error: added.error }
  const enrolled = (added.ok || bot) && readable.ok && (bot || space.name === TEST_SPACE)
  if (!enrolled) failures += 1
  results.push({
    name: space.display_name,
    id: space.name,
    project: space.project,
    project_id: space.project_id,
    membership: bot,
    history: readable.ok,
    status: readable.status || added.status,
    error: readable.error || added.error
  })
  writeJson(path.join(root, 'enroll-progress.json'), results)
  await new Promise((resolve) => setTimeout(resolve, 250))
}

const enrolled = results.filter((row) => row.membership && row.history).map((row) => row.id)
if (!enrolled.includes(TEST_SPACE)) enrolled.unshift(TEST_SPACE)
const previous = readJson(path.join(root, 'operate.json'), [TEST_SPACE])
const operate = [...new Set([...(Array.isArray(previous) ? previous : []), ...enrolled])]
if (results.some((row) => row.membership && row.history)) writeJson(path.join(root, 'operate.json'), operate)

const map = {}
for (const row of results) {
  if (row.project_id) map[row.id] = { project: row.project, project_id: row.project_id, name: row.name }
}
writeJson(path.join(root, 'space-projects.json'), map)
fs.mkdirSync(vault, { recursive: true })
writeJson(path.join(vault, 'enrollment.json'), {
  at: new Date().toISOString(),
  operate: operate.length,
  added_ok: results.filter((row) => row.membership).length,
  history_ok: results.filter((row) => row.history).length,
  failed: results.filter((row) => !row.membership || !row.history),
  history_only: groups['history-only'].map((row) => ({ name: row.display_name, id: row.name, reason: row.reason })),
  excluded: groups.excluded.map((row) => ({ name: row.display_name, id: row.name, type: row.type, reason: row.reason })),
  results
})
console.log(JSON.stringify({
  standing: groups.operate.length,
  history_only: groups['history-only'].length,
  excluded: groups.excluded.length,
  enrolled: results.filter((row) => row.membership && row.history).length,
  failed: results.filter((row) => !row.membership || !row.history).map((row) => ({ name: row.name, id: row.id, error: row.error })),
  stopped_early: failures >= 8 && results.length <= 10
}, null, 2))
