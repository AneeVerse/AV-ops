import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { TEST_SPACE, classifySpace } from './policy.mjs'

const root = '/opt/av_ops/docker/avops-chat'
const vault = '/opt/av_ops/docker/obsidian/obsidian/Chat/Spaces'
const operateFile = path.join(root, 'operate.json')
const stateFile = path.join(root, 'sync-state.json')
const spaceProjectFile = path.join(root, 'space-projects.json')

function loadEnv () {
  const file = path.join(root, '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    const key = trimmed.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function readJson (file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson (file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

function laterIso (left, right) {
  if (!left) return right || null
  if (!right) return left
  return left > right ? left : right
}

function earlierIso (left, right) {
  if (!left) return right || null
  if (!right) return left
  return left < right ? left : right
}

function mergeSpace (prior, incoming) {
  if (!prior) return incoming
  if (!incoming) return prior
  const incomingNewer = (incoming.last_success || '') > (prior.last_success || '')
  const base = incomingNewer ? { ...prior, ...incoming } : { ...incoming, ...prior }
  return {
    ...base,
    seen: [...new Set([...(prior.seen || []), ...(incoming.seen || [])])].slice(-2500),
    newest: laterIso(prior.newest, incoming.newest),
    oldest: earlierIso(prior.oldest, incoming.oldest),
    head_ready: prior.head_ready === true || incoming.head_ready === true,
    history_complete: prior.history_complete === true || incoming.history_complete === true,
    discovered: Math.max(prior.discovered || 0, incoming.discovered || 0),
    processed: Math.max(prior.processed || 0, incoming.processed || 0),
    skipped: Math.max(prior.skipped || 0, incoming.skipped || 0),
    last_success: laterIso(prior.last_success, incoming.last_success),
    error: incomingNewer ? (incoming.error || null) : (prior.error || null)
  }
}

function withStateLock (fn) {
  const lockFile = path.join(root, 'state.lock')
  const started = Date.now()
  while (Date.now() - started < 10000) {
    try {
      const fd = fs.openSync(lockFile, 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      try { return fn() } finally {
        try { fs.unlinkSync(lockFile) } catch { /* already cleared */ }
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        const pid = Number(fs.readFileSync(lockFile, 'utf8'))
        if (pid > 0) {
          try { process.kill(pid, 0) } catch { fs.unlinkSync(lockFile); continue }
        }
      } catch { /* retry */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
    }
  }
  throw new Error('state lock timeout')
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
  const infoRes = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(body.access_token))
  const info = await infoRes.json()
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: 'Bearer ' + body.access_token }
  })
  const user = await userRes.json().catch(() => ({}))
  return {
    token: body.access_token,
    email: user.email || info.email || null,
    scopes: String(info.scope || '').split(' ').filter(Boolean)
  }
}

async function googleGet (token, url) {
  const res = await fetch(url, { headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000) })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function listSpaces (token, admin) {
  const spaces = []
  let pageToken = ''
  let pages = 0
  let error = null
  while (pages < 20) {
    const url = new URL(admin ? 'https://chat.googleapis.com/v1/spaces:search' : 'https://chat.googleapis.com/v1/spaces')
    url.searchParams.set('pageSize', '100')
    if (admin) {
      url.searchParams.set('useAdminAccess', 'true')
      url.searchParams.set('query', 'customer = "customers/my_customer" AND spaceType = "SPACE"')
    }
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const result = await googleGet(token, url)
    if (result.status !== 200) {
      error = String(result.body.error?.message || result.status).slice(0, 220)
      break
    }
    spaces.push(...(result.body.spaces || []))
    pageToken = result.body.nextPageToken || ''
    pages += 1
    if (!pageToken) break
  }
  return { spaces, pages, complete: !pageToken && !error, error }
}

function mcpCall (name, args) {
  const child = spawn('node', ['/opt/av_ops/docker/avops-mcp/server.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('mcp timeout')) }, 40000)
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
        if (msg.result?.isError) reject(new Error(String(text).slice(0, 240)))
        else resolve(JSON.parse(text))
      }
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) + '\n')
  })
}

function chatCall (name, args) {
  const child = spawn('node', [path.join(root, 'server.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('chat timeout')) }, 30000)
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
        if (msg.result?.isError) reject(new Error(String(text).slice(0, 240)))
        else resolve(JSON.parse(text))
      }
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) + '\n')
  })
}

async function handleOperateMessage (space, message, mapped, state, actions) {
  // Hermes answers live Chat. This job only marks the message seen.
  void state
  actions.push({ message: message.name, space: space.name, skipped: true, reason: 'hermes owns chat actions', project: mapped || null })
  return { processed: 0, skipped: 1 }
}

async function fetchPages (token, spaceName, filter, maxPages) {
  const messages = []
  let pageToken = ''
  let pages = 0
  let error = null
  while (pages < maxPages) {
    const url = new URL(`https://chat.googleapis.com/v1/${spaceName}/messages`)
    url.searchParams.set('pageSize', '100')
    url.searchParams.set('orderBy', 'createTime desc')
    if (filter) url.searchParams.set('filter', filter)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    let result = await googleGet(token, url)
    if (result.status !== 200 && /order/i.test(String(result.body.error?.message || ''))) {
      url.searchParams.delete('orderBy')
      result = await googleGet(token, url)
    }
    if (result.status !== 200) {
      error = String(result.body.error?.message || result.status).slice(0, 180)
      break
    }
    messages.push(...(result.body.messages || []))
    pageToken = result.body.nextPageToken || ''
    pages += 1
    if (!pageToken) break
  }
  return { messages, pages, complete: !pageToken && !error, error }
}

async function pageMessages (token, spaceName, checkpoint, maxPages = 8) {
  const head = await fetchPages(
    token,
    spaceName,
    checkpoint?.head_ready && checkpoint.newest ? `createTime > "${checkpoint.newest}"` : '',
    checkpoint?.head_ready ? 2 : 4
  )
  if (head.error) return { messages: head.messages, pages: head.pages, complete: false, error: head.error }
  if (checkpoint?.history_complete) return { messages: head.messages, pages: head.pages, complete: true, error: null }
  const knownOldest = checkpoint?.oldest || head.messages.map((message) => message.createTime).filter(Boolean).sort()[0]
  if (!knownOldest || head.complete) return { messages: head.messages, pages: head.pages, complete: head.complete, error: null }
  const older = await fetchPages(token, spaceName, `createTime < "${knownOldest}"`, maxPages)
  return {
    messages: [...head.messages, ...older.messages],
    pages: head.pages + older.pages,
    complete: older.complete && !older.error,
    error: older.error
  }
}

loadEnv()
const lockFile = path.join(root, 'sync.lock')
const eventMode = process.argv.includes('--spaces')
if (!eventMode) {
  if (fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, 'utf8'))
    let running = false
    if (pid > 0) {
      try { process.kill(pid, 0); running = true } catch { running = false }
    }
    if (running) {
      console.log(JSON.stringify({ skipped: true, reason: 'sync already running' }))
      process.exit(0)
    }
    fs.unlinkSync(lockFile)
  }
  fs.writeFileSync(lockFile, String(process.pid))
  const releaseLock = () => { try { if (fs.readFileSync(lockFile, 'utf8') === String(process.pid)) fs.unlinkSync(lockFile) } catch { /* lock already cleared */ } }
  process.on('exit', releaseLock)
}
const auth = await userToken()
if (process.argv.includes('--spaces')) {
  const raw = process.argv[process.argv.indexOf('--spaces') + 1] || ''
  const names = [...new Set(raw.split(',').map((item) => item.trim()).filter((item) => /^spaces\/[A-Za-z0-9_-]+$/.test(item)))]
  if (!names.length) {
    console.log(JSON.stringify({ mode: 'event', error: 'no spaces' }))
    process.exit(1)
  }
  const started = Date.now()
  const operate = new Set(readJson(operateFile, [TEST_SPACE]))
  const spaceProjects = readJson(spaceProjectFile, {})
  const state = readJson(stateFile, { reminders: {}, spaces: {}, tickets: {} })
  state.spaces = state.spaces || {}
  state.tickets = state.tickets || {}
  const ticketsAtStart = JSON.parse(JSON.stringify(state.tickets))
  const registry = readJson(path.join(vault, 'registry.json'), { spaces: [] })
  const displayNames = new Map((registry.spaces || []).map((row) => [row.name, row.display_name || '']))
  const actions = []
  let duplicates = 0
  for (const name of names) {
    if (!operate.has(name)) {
      actions.push({ space: name, skipped: true, reason: 'outside operate set' })
      continue
    }
    const previous = state.spaces[name] || {}
    const seen = new Set(previous.seen || [])
    const counted = await pageMessages(auth.token, name, previous, 2)
    const fresh = counted.messages.filter((message) => message.name && !seen.has(message.name) && message.createTime > (previous.head_at || ''))
    for (const message of counted.messages) if (message.name) seen.add(message.name)
    let processed = 0
    let skipped = counted.messages.length - fresh.length
    duplicates += skipped
    const space = { name, display_name: displayNames.get(name) || name, operate: true }
    if (previous.head_ready === true) {
      for (const message of fresh) {
        if (message.sender?.type === 'BOT') { skipped += 1; continue }
        const result = await handleOperateMessage(space, message, spaceProjects[name]?.project_id || null, state, actions)
        processed += result.processed
        skipped += result.skipped
      }
    }
    const times = counted.messages.map((message) => message.createTime).filter(Boolean).sort()
    const newest = times.at(-1) || previous.newest || null
    const oldest = times[0] && (!previous.oldest || times[0] < previous.oldest) ? times[0] : (previous.oldest || times[0] || null)
    const readOk = !counted.error
    state.spaces[name] = {
      seen: [...seen].slice(-2500),
      newest,
      oldest,
      head_ready: previous.head_ready === true || readOk,
      head_at: previous.head_at || newest,
      history_complete: previous.history_complete === true || (readOk && counted.complete),
      discovered: (previous.discovered || 0) + counted.messages.filter((message) => message.name && !(previous.seen || []).includes(message.name)).length,
      processed: (previous.processed || 0) + processed,
      skipped: (previous.skipped || 0) + skipped,
      role: previous.role || 'operate',
      error: counted.error,
      last_success: counted.error ? (previous.last_success || null) : new Date().toISOString()
    }
  }
  withStateLock(() => {
    const disk = readJson(stateFile, { reminders: {}, spaces: {}, tickets: {} })
    disk.spaces = disk.spaces || {}
    disk.tickets = disk.tickets || {}
    for (const name of names) {
      if (state.spaces[name]) disk.spaces[name] = mergeSpace(disk.spaces[name], state.spaces[name])
    }
    for (const [id, ticket] of Object.entries(state.tickets)) {
      if (JSON.stringify(ticket) !== JSON.stringify(ticketsAtStart[id])) disk.tickets[id] = { ...(disk.tickets[id] || {}), ...ticket }
    }
    disk.duplicate_count = (disk.duplicate_count || 0) + duplicates
    writeJson(stateFile, disk)
  })
  console.log(JSON.stringify({
    mode: 'event',
    account: auth.email,
    spaces: names,
    elapsed_ms: Date.now() - started,
    duplicates_suppressed: duplicates,
    actions,
    failures: names.filter((name) => state.spaces[name]?.error).map((name) => ({ name, error: state.spaces[name].error }))
  }))
  process.exit(0)
}
const canList = auth.scopes.some((scope) => scope.endsWith('/chat.spaces') || scope.endsWith('/chat.spaces.readonly') || scope.endsWith('/chat.admin.spaces.readonly'))
const userList = canList ? await listSpaces(auth.token, false) : { spaces: [], pages: 0, complete: false, error: 'scope chat.spaces.readonly is not granted' }
const adminAllowed = auth.scopes.some((scope) => scope.includes('chat.admin.spaces'))
const adminList = adminAllowed ? await listSpaces(auth.token, true) : { spaces: [], pages: 0, complete: false, error: 'admin scope is not granted' }
const appList = await chatCall('list_app_spaces', {}).catch((error) => ({ spaces: [], error: error.message }))
const operate = new Set(readJson(operateFile, [TEST_SPACE]))
const spaceProjects = readJson(spaceProjectFile, {})
const reminderFile = readJson(path.join(root, 'reminder.json'), { hours: 12 })
const reminderWindowMs = Math.max(1, Number(reminderFile.hours) || 12) * 60 * 60 * 1000
const state = readJson(stateFile, { reminders: {}, spaces: {}, tickets: {} })
state.spaces = state.spaces || {}
state.tickets = state.tickets || {}
const duplicateBaseline = state.duplicate_count || 0
const byName = new Map()
for (const space of [...(appList.spaces || []), ...userList.spaces, ...adminList.spaces]) {
  if (!space.name) continue
  const prior = byName.get(space.name) || { name: space.name }
  byName.set(space.name, {
    ...prior,
    display_name: space.displayName || space.display_name || prior.display_name || '',
    type: space.spaceType || space.type || prior.type || '',
    external: space.externalUserAllowed === true,
    app_member: (appList.spaces || []).some((item) => item.name === space.name) || prior.app_member === true,
    user_visible: userList.spaces.some((item) => item.name === space.name) || prior.user_visible === true,
    admin_visible: adminList.spaces.some((item) => item.name === space.name) || prior.admin_visible === true,
    operate: operate.has(space.name)
  })
}
const registry = []
const actions = []
let duplicates = 0
for (const space of byName.values()) {
  const decision = classifySpace(space)
  const previous = state.spaces?.[space.name] || {}
  const seen = new Set(previous.seen || [])
  let counted = { messages: [], pages: 0, complete: false, error: null }
  const shouldRead = decision.role === 'operate' || decision.role === 'history-only' || space.app_member === true
  if (decision.role === 'excluded' && /credentials|direct message|unnamed/i.test(decision.reason)) counted.error = decision.reason
  else if (!space.user_visible && !space.app_member) counted.error = decision.reason || 'not readable with the current grant'
  else if (!shouldRead) counted.error = decision.reason || 'listed only; message bodies are not copied'
  else counted = await pageMessages(auth.token, space.name, previous, space.operate ? 8 : 4)
  const fresh = counted.messages.filter((message) => message.name && !seen.has(message.name) && message.createTime > (previous.head_at || ''))
  for (const message of counted.messages) if (message.name) seen.add(message.name)
  let processed = 0
  let skipped = counted.messages.length - fresh.length
  duplicates += skipped
  const times = counted.messages.map((message) => message.createTime).filter(Boolean).sort()
  if (space.operate && previous.head_ready === true) {
    for (const message of fresh) {
      if (message.sender?.type === 'BOT') { skipped += 1; continue }
      const result = await handleOperateMessage(space, message, spaceProjects[space.name]?.project_id || null, state, actions)
      processed += result.processed
      skipped += result.skipped
    }
  }
  const newest = times.at(-1) || previous.newest || null
  const oldest = times[0] && (!previous.oldest || times[0] < previous.oldest) ? times[0] : (previous.oldest || times[0] || null)
  registry.push({
    name: space.name,
    display_name: space.display_name,
    type: space.type,
    external: space.external,
    app_member: space.app_member,
    user_visible: space.user_visible,
    admin_visible: space.admin_visible,
    operate: space.operate,
    role: decision.role,
    project: spaceProjects[space.name]?.project || null,
    discovered: (previous.discovered || 0) + counted.messages.filter((message) => message.name && !(previous.seen || []).includes(message.name)).length,
    processed: (previous.processed || 0) + processed,
    skipped: (previous.skipped || 0) + skipped,
    inaccessible: counted.error ? 1 : 0,
    error: counted.error,
    pages: counted.pages,
    complete: previous.history_complete === true || (!counted.error && counted.complete),
    latest: newest,
    checkpoint: new Date().toISOString()
  })
  const readOk = (decision.role === 'operate' || decision.role === 'history-only' || space.app_member === true) && !counted.error
  state.spaces[space.name] = {
    seen: [...seen].slice(-2500),
    newest,
    oldest,
    head_ready: previous.head_ready === true || readOk,
    head_at: previous.head_at || newest,
    history_complete: previous.history_complete === true || (readOk && counted.complete),
    discovered: registry.at(-1).discovered,
    processed: registry.at(-1).processed,
    skipped: registry.at(-1).skipped,
    role: decision.role,
    error: counted.error,
    last_success: counted.error ? (previous.last_success || null) : new Date().toISOString()
  }
  if (readOk) await new Promise((resolve) => setTimeout(resolve, 60))
}
state.last_success = new Date().toISOString()
state.duplicate_count = (state.duplicate_count || 0) + duplicates
const reminders = { sent: [], suppressed: [], deferred: [], escalated: [] }
const reportSpace = 'spaces/AAQAiYhvg_U'
for (const [identifier, ticket] of Object.entries(state.tickets || {})) {
  if (!ticket?.issue_id) continue
  const target = operate.has(ticket.space) ? ticket.space : null
  if (!target) continue
  const current = await mcpCall('get_issue', { issue_id: ticket.issue_id }).catch(() => null)
  const open = current && current.is_done !== true && current.status_name !== 'Done' && current.status_name !== 'Canceled'
  if (!open) continue
  const retryAt = Date.parse(ticket.retry_after || '')
  if (Number.isFinite(retryAt) && Date.now() < retryAt) {
    reminders.deferred.push(identifier)
    continue
  }
  const askedAt = Date.parse(ticket.asked_at || '')
  if (Number.isFinite(askedAt) && Date.now() - askedAt < reminderWindowMs) {
    reminders.suppressed.push(identifier)
    continue
  }
  const escalate = Boolean(ticket.reminded_at) && !ticket.escalated_at
  const text = `${identifier} needs a progress update. What is completed, what remains, is anything blocking it, and when do you expect completion?`
  const sent = await chatCall('send_message', {
    space: target,
    text,
    ...(ticket.requester ? { mention: ticket.requester } : {})
  }).catch((error) => ({ ok: false, error: String(error.message || error).slice(0, 160) }))
  if (sent.ok === true && sent.message_id) {
    const now = new Date().toISOString()
    ticket.asked_at = now
    ticket.reminded_at = now
    delete ticket.retry_after
    reminders.sent.push({ identifier, mentioned: sent.mentioned || ticket.requester || null, space: target })
    if (escalate && operate.has(reportSpace)) {
      const escalated = await chatCall('send_message', {
        space: reportSpace,
        text: `${identifier} is still open after a progress request. Source space: https://chat.google.com/room/${target.replace('spaces/', '')}`
      }).catch((error) => ({ ok: false, error: String(error.message || error).slice(0, 160) }))
      if (escalated.ok === true && escalated.message_id) {
        ticket.escalated_at = now
        reminders.escalated.push(identifier)
      }
    }
  } else {
    ticket.retry_after = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    reminders.deferred.push(identifier)
  }
}
withStateLock(() => {
  const disk = readJson(stateFile, { reminders: {}, spaces: {}, tickets: {} })
  for (const [id, row] of Object.entries(disk.spaces || {})) state.spaces[id] = mergeSpace(state.spaces[id], row)
  for (const [id, ticket] of Object.entries(disk.tickets || {})) {
    const mine = state.tickets[id]
    if (!mine) state.tickets[id] = ticket
    else if ((ticket.asked_at || '') > (mine.asked_at || '')) state.tickets[id] = { ...mine, ...ticket }
  }
  state.duplicate_count = Math.max(disk.duplicate_count || 0, duplicateBaseline) + duplicates
  writeJson(stateFile, state)
})
fs.mkdirSync(vault, { recursive: true })
writeJson(path.join(vault, 'registry.json'), {
  at: state.last_success,
  account: auth.email,
  scopes: auth.scopes,
  user_list_error: userList.error,
  admin_list_error: adminList.error,
  user_count: userList.spaces.length,
  admin_count: adminList.spaces.length,
  spaces: registry
})
const lines = [
  '# Google Chat registry',
  '',
  `Checked: ${state.last_success}`,
  `Account: ${auth.email || 'not returned by this grant'}`,
  `User spaces: ${userList.spaces.length}${userList.error ? ' (' + userList.error + ')' : ''}`,
  `Admin spaces: ${adminList.spaces.length}${adminList.error ? ' (' + adminList.error + ')' : ''}`,
  '',
  '| Space | Type | App | User | Admin | Messages | Complete | Tickets |',
  '|---|---|---|---|---|---:|---|---|',
  ...registry.map((row) => `| ${row.display_name || row.name} | ${row.type || ''} | ${row.app_member} | ${row.user_visible} | ${row.admin_visible} | ${row.discovered} | ${row.complete} | ${row.operate ? 'operate' : 'read only'} |`)
]
fs.writeFileSync(path.join(vault, 'registry.md'), lines.join('\n') + '\n')
const checkpoints = {}
for (const [id, row] of Object.entries(state.spaces)) {
  checkpoints[id] = {
    discovered: row.discovered || 0,
    processed: row.processed || 0,
    skipped: row.skipped || 0,
    complete: row.history_complete === true,
    newest: row.newest || null,
    oldest: row.oldest || null,
    error: row.error || null,
    role: row.role || null,
    last_success: row.last_success || null
  }
}
writeJson(path.join(vault, 'checkpoints.json'), { at: state.last_success, spaces: checkpoints })
writeJson(path.join(vault, 'health.json'), {
  at: state.last_success,
  account: auth.email,
  user_spaces: userList.spaces.length,
  admin_spaces: adminList.spaces.length,
  operate: [...operate].length,
  history_complete: registry.filter((row) => row.complete).length,
  read_failures: registry.filter((row) => row.error).length,
  duplicates: state.duplicate_count,
  reminders
})
console.log(JSON.stringify({
  account: auth.email,
  user_spaces: userList.spaces.length,
  user_error: userList.error,
  admin_spaces: adminList.spaces.length,
  admin_error: adminList.error,
  operate: registry.filter((row) => row.operate).length,
  history_complete: registry.filter((row) => row.complete).length,
  failures: registry.filter((row) => row.error && row.operate).map((row) => ({ name: row.display_name, error: row.error })).slice(0, 20),
  actions,
  reminders
}, null, 2))
