import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const ALLOWED_SPACE = 'spaces/AAQAOk6L6k8'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CHAT_API = 'https://chat.googleapis.com/v1'

const saTokens = new Map()
let userTokenCache = null

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

function operateIds () {
  try {
    const ids = JSON.parse(fs.readFileSync(path.join(root, 'operate.json'), 'utf8'))
    if (Array.isArray(ids) && ids.every((id) => typeof id === 'string')) return ids
  } catch { /* the test space remains the default */ }
  return [ALLOWED_SPACE]
}

function orgSpaceIds () {
  try {
    const ids = JSON.parse(fs.readFileSync(path.join(root, 'org-spaces.json'), 'utf8'))
    if (Array.isArray(ids) && ids.every((id) => typeof id === 'string')) return ids
  } catch { /* no company spaces yet */ }
  return []
}

function allowedSpace (name) {
  const id = typeof name === 'string' && name ? name : (process.env.AVOPS_CHAT_SPACE || ALLOWED_SPACE)
  if (!/^spaces\/[A-Za-z0-9_-]{4,80}$/.test(id)) throw new Error('invalid space')
  if (id === 'spaces/AAQACOxtNdo') throw new Error('that space is excluded')
  if (!operateIds().includes(id) && !orgSpaceIds().includes(id)) throw new Error('chat space is not allowlisted')
  return id
}

function readJson (file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function b64url (value) {
  return Buffer.from(value).toString('base64url')
}

function signJwt (sa, scope) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }))
  const data = `${header}.${payload}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(data), sa.private_key)
  return `${data}.${b64url(signature)}`
}

async function fetchToken (body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.access_token) {
    const message = payload?.error_description || payload?.error || `token request failed (${response.status})`
    throw new Error(String(message).slice(0, 240))
  }
  return payload
}

async function serviceTokenFor (key, scope) {
  const cached = saTokens.get(key)
  if (cached && cached.exp > Date.now() + 60000) return cached.token
  const file = process.env.AVOPS_CHAT_SA_JSON
  if (!file) throw new Error('chat service account is not configured')
  const sa = readJson(file)
  const assertion = signJwt(sa, scope)
  const payload = await fetchToken(new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  }))
  saTokens.set(key, { token: payload.access_token, exp: Date.now() + (payload.expires_in * 1000) })
  return payload.access_token
}

async function serviceToken () {
  return serviceTokenFor('bot', 'https://www.googleapis.com/auth/chat.bot')
}

async function appReadToken () {
  return serviceTokenFor('bot-read', 'https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/chat.app.messages.readonly')
}

async function appManageToken () {
  return serviceTokenFor('app-manage', 'https://www.googleapis.com/auth/chat.app.spaces.create https://www.googleapis.com/auth/chat.app.memberships https://www.googleapis.com/auth/chat.bot')
}

const OWNERS = {
  'mayur@aneeverse.com': 'users/109320900444412543011',
  'anees@aneeverse.com': 'users/103079656183450228872'
}
const SECRET_SPACE = 'spaces/AAQACOxtNdo'
const DM_FILE = path.join(root, 'dm-spaces.json')

function rememberDm (spaceName) {
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(spaceName || '')) return
  let rows = []
  try { rows = JSON.parse(fs.readFileSync(DM_FILE, 'utf8')) } catch { rows = [] }
  if (!Array.isArray(rows)) rows = []
  if (!rows.includes(spaceName)) {
    rows.push(spaceName)
    fs.writeFileSync(DM_FILE, JSON.stringify(rows, null, 2) + '\n')
  }
}

async function userToken () {
  if (userTokenCache && userTokenCache.exp > Date.now() + 60000) return userTokenCache.token
  const file = process.env.AVOPS_CHAT_OAUTH_JSON
  if (!file || !fs.existsSync(file)) throw new Error('chat read token is not configured')
  const oauth = readJson(file)
  if (!oauth.client_id || !oauth.client_secret || !oauth.refresh_token) {
    throw new Error('chat read token is not configured')
  }
  const payload = await fetchToken(new URLSearchParams({
    client_id: oauth.client_id,
    client_secret: oauth.client_secret,
    refresh_token: oauth.refresh_token,
    grant_type: 'refresh_token'
  }))
  userTokenCache = { token: payload.access_token, exp: Date.now() + (payload.expires_in * 1000) }
  return payload.access_token
}

async function chatRequest (token, url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15000)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message || `google chat failed (${response.status})`
    throw new Error(String(message).slice(0, 300))
  }
  return payload || {}
}

function memberView (membership) {
  const member = membership.member || {}
  if (member.type && member.type !== 'HUMAN') return null
  if (!member.name || !member.name.startsWith('users/')) return null
  return {
    name: member.name,
    display_name: member.displayName || '',
    email: (member.email || '').toLowerCase(),
    role: membership.role || ''
  }
}

async function members (spaceName) {
  const parent = allowedSpace(spaceName)
  const payload = await chatRequest(
    await serviceToken(),
    `${CHAT_API}/${parent}/members?pageSize=100`
  )
  const items = (payload.memberships || []).map(memberView).filter(Boolean)
  return items
}

function matchMember (items, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q || q.length > 80) throw new Error('name a member of the Hermes test space')
  const exact = items.filter((item) => item.email === q || item.display_name.toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new Error('more than one member matches')
  const partial = items.filter((item) => item.display_name.toLowerCase().includes(q) || item.email.startsWith(q))
  if (partial.length === 1) return partial[0]
  if (partial.length === 0) throw new Error('that person is not a member of the space')
  throw new Error(`more than one member matches: ${partial.map((item) => item.display_name).join(', ')}`)
}

function cleanText (value) {
  if (typeof value !== 'string') throw new Error('invalid text')
  const text = value.trim()
  if (text.length < 1 || text.length > 1200) throw new Error('invalid text')
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('invalid text')
  return text
}

async function appSpaces () {
  const allowed = new Set(operateIds())
  const spaces = []
  let pageToken = ''
  for (let page = 0; page < 5; page += 1) {
    const url = new URL(`${CHAT_API}/spaces`)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const payload = await chatRequest(await serviceToken(), url)
    spaces.push(...(payload.spaces || []))
    pageToken = payload.nextPageToken || ''
    if (!pageToken) break
  }
  return spaces.map((space) => ({
    name: space.name || '',
    display_name: space.displayName || '',
    type: space.spaceType || space.type || '',
    operate: allowed.has(space.name)
  }))
}

function knownSpace (name) {
  if (typeof name !== 'string' || !/^spaces\/[A-Za-z0-9_-]{4,80}$/.test(name)) {
    throw new Error('invalid space')
  }
  return name
}

async function listAppSpaces () {
  const items = await appSpaces()
  return {
    returned_count: items.length,
    operate_spaces: operateIds(),
    spaces: items,
    note: 'operate true is the only space where send_message is allowed. Other rows are spaces the Chat app has joined. This is not every company space.'
  }
}

async function readSpace (args) {
  const name = knownSpace(args?.space)
  const known = await appSpaces()
  if (!known.some((item) => item.name === name)) throw new Error('space is not visible to the chat app')
  const url = `${CHAT_API}/${name}/messages?pageSize=30&orderBy=${encodeURIComponent('createTime desc')}`
  let payload
  try {
    payload = await chatRequest(await userToken(), url)
  } catch (error) {
    if (!String(error.message).toLowerCase().includes('order')) throw error
    payload = await chatRequest(await userToken(), `${CHAT_API}/${name}/messages?pageSize=30`)
  }
  const messages = (payload.messages || []).slice(0, 30).map((message) => ({
    message_id: message.name || '',
    sender: message.sender?.displayName || '',
    time: message.createTime || '',
    text: String(message.text || '').slice(0, 500),
    private: Boolean(message.privateMessageViewer)
  }))
  return {
    space: name,
    operate: operateIds().includes(name),
    returned_count: messages.length,
    messages,
    note: operateIds().includes(name) ? 'operate space' : 'read only. do not send and do not create tickets from this space.'
  }
}

async function listMembers (args) {
  const parent = allowedSpace(args?.space)
  const items = await members(parent)
  return {
    space: parent,
    returned_count: items.length,
    members: items.map((item) => ({
      display_name: item.display_name,
      email: item.email,
      role: item.role
    }))
  }
}

async function listMessages (args) {
  const parent = allowedSpace(args?.space)
  const token = await userToken()
  const url = `${CHAT_API}/${parent}/messages?pageSize=30&orderBy=${encodeURIComponent('createTime desc')}`
  let payload
  try {
    payload = await chatRequest(token, url)
  } catch (error) {
    if (!String(error.message).toLowerCase().includes('order')) throw error
    payload = await chatRequest(token, `${CHAT_API}/${parent}/messages?pageSize=30`)
  }
  const messages = (payload.messages || []).slice(0, 30).map((message) => ({
    message_id: message.name || '',
    sender: message.sender?.displayName || '',
    time: message.createTime || '',
    text: String(message.text || '').slice(0, 500),
    private: Boolean(message.privateMessageViewer)
  }))
  return { space: parent, returned_count: messages.length, messages }
}

function peopleRecords () {
  const file = readJson(path.join(root, 'people.json'))
  const rows = []
  for (const [email, row] of Object.entries(file)) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !row.person_id) continue
    rows.push({
      email: email.toLowerCase(),
      person_id: row.person_id,
      huly_name: row.huly_name || '',
      chat_names: Array.isArray(row.chat_names) ? row.chat_names.filter((name) => typeof name === 'string') : [],
      chat_user: typeof row.chat_user === 'string' ? row.chat_user : ''
    })
  }
  return rows
}

function resolvePerson (query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q || q.length > 80) throw new Error('name the person to message')
  const hits = peopleRecords().filter((row) => row.email === q || row.chat_names.some((name) => name.toLowerCase() === q))
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) throw new Error('that person is not in the identity map')
  throw new Error('more than one person matches')
}

async function chatUserFor (person) {
  if (/^users\/\d+$/.test(person.chat_user)) return { user: person.chat_user, email: person.email, display_name: person.chat_names[0] || person.email }
  const names = new Set(person.chat_names.map((name) => name.toLowerCase()))
  const found = new Map()
  for (const id of operateIds()) {
    let payload
    try {
      payload = await chatRequest(await serviceToken(), `${CHAT_API}/${id}/members?pageSize=100`)
    } catch {
      continue
    }
    for (const item of (payload.memberships || []).map(memberView).filter(Boolean)) {
      const emailOk = !item.email || item.email === person.email
      if (names.has(item.display_name.toLowerCase()) && emailOk) found.set(item.name, { ...item, space: id })
    }
  }
  if (found.size !== 1) throw new Error(found.size === 0 ? 'that person was not found in an enrolled space' : 'more than one Chat user matches')
  const item = [...found.values()][0]
  let email = item.email
  if (!email) {
    try {
      const listed = await chatRequest(await userToken(), `${CHAT_API}/${item.space}/members?pageSize=100`)
      const hit = (listed.memberships || []).find((row) => row.member?.name === item.name)
      email = String(hit?.member?.email || '').toLowerCase()
    } catch {
      email = ''
    }
  }
  if (email && email !== person.email) throw new Error('Chat email does not match the identity map')
  return { user: item.name, email: email || '', display_name: item.display_name }
}

async function directoryUser (email) {
  const address = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('invalid email')
  const payload = await chatRequest(
    await userToken(),
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(address)}?projection=basic`
  )
  const id = String(payload.id || '')
  if (!/^\d+$/.test(id)) throw new Error('directory user was not returned')
  return {
    email: String(payload.primaryEmail || address).toLowerCase(),
    user: `users/${id}`,
    display_name: payload.name?.fullName || '',
    suspended: payload.suspended === true
  }
}

async function requireOwner (requester) {
  const email = String(requester || '').trim().toLowerCase()
  if (!OWNERS[email]) throw new Error('requester is not an authorized owner')
  const live = await directoryUser(email)
  if (live.user !== OWNERS[email]) throw new Error('owner directory identity does not match the verified user')
  if (live.suspended) throw new Error('owner account is suspended')
  return live
}

async function resolveChatRecipient (query) {
  const q = String(query || '').trim()
  let email = ''
  let display = ''
  let mappedUser = ''
  try {
    const person = resolvePerson(q)
    email = person.email
    display = person.chat_names[0] || ''
    mappedUser = person.chat_user || ''
  } catch (error) {
    if (!q.includes('@')) throw error
    email = q.toLowerCase()
  }
  const live = await directoryUser(email)
  if (mappedUser && mappedUser !== live.user) throw new Error('Chat user does not match the directory')
  if (live.suspended) throw new Error('that person is suspended')
  return { user: live.user, email: live.email, display_name: live.display_name || display }
}

async function directSpace (user) {
  const url = `${CHAT_API}/spaces:findDirectMessage?name=${encodeURIComponent(user)}`
  let space
  try {
    space = await chatRequest(await serviceToken(), url)
  } catch (error) {
    if (!/not found|404/i.test(String(error.message))) throw error
    space = await chatRequest(await serviceToken(), `${CHAT_API}/spaces:setup`, {
      method: 'POST',
      body: {
        space: { spaceType: 'DIRECT_MESSAGE' },
        memberships: [{ member: { name: user, type: 'HUMAN' } }]
      }
    })
  }
  return space
}

async function sendDirectMessage (args) {
  const text = cleanText(args?.text)
  const recipient = await resolveChatRecipient(args?.person)
  const found = await directSpace(recipient.user)
  if (!found.name) throw new Error('direct message space was not returned')
  const space = await chatRequest(await serviceToken(), `${CHAT_API}/${found.name}`)
  const spaceName = space.name || ''
  const spaceType = space.spaceType || space.type || ''
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(spaceName)) throw new Error('direct message space was not returned')
  if (spaceType !== 'DIRECT_MESSAGE' || space.singleUserBotDm !== true) throw new Error('destination is not a direct message with the Chat app')
  if (operateIds().includes(spaceName)) throw new Error('refusing to treat an enrolled project space as a direct message')
  const membership = await chatRequest(await serviceToken(), `${CHAT_API}/${spaceName}/members?pageSize=20`)
  const humans = (membership.memberships || []).map(memberView).filter(Boolean)
  if (humans.length !== 1 || humans[0].name !== recipient.user) throw new Error('direct message recipient does not match')
  const sent = await chatRequest(await serviceToken(), `${CHAT_API}/${spaceName}/messages`, {
    method: 'POST',
    body: { text }
  })
  const messageId = sent.name || ''
  if (!messageId.startsWith(spaceName + '/messages/')) throw new Error('message was not created in the direct message')
  const read = await chatRequest(await appReadToken(), `${CHAT_API}/${messageId}`)
  const readText = String(read.text || '')
  if (read.name !== messageId || readText !== text) throw new Error('direct message readback did not match')
  if (read.sender?.type !== 'BOT') throw new Error('direct message sender was not the Chat app')
  if (read.privateMessageViewer) throw new Error('message was an in-space private message, not a direct message')
  rememberDm(spaceName)
  return {
    ok: true,
    direct_message: true,
    space: spaceName,
    space_type: 'DIRECT_MESSAGE',
    single_user_bot_dm: true,
    message_id: messageId,
    recipient_user: recipient.user,
    recipient_display: humans[0].display_name,
    recipient_email: recipient.email || null,
    sender_type: read.sender.type,
    sender_name: read.sender.displayName || '',
    readback: true,
    private: false
  }
}

function cleanSpaceName (value) {
  const name = String(value || '').trim()
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,78}$/u.test(name)) throw new Error('invalid space name')
  return name
}

async function findNamedSpace (displayName) {
  const wanted = displayName.toLowerCase()
  const hits = new Map()
  for (const space of await appSpaces()) {
    if (String(space.display_name || '').toLowerCase() === wanted && space.name) hits.set(space.name, space.display_name)
  }
  let pageToken = ''
  for (let page = 0; page < 8; page += 1) {
    const url = new URL(`${CHAT_API}/spaces`)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    let payload
    try {
      payload = await chatRequest(await userToken(), url)
    } catch {
      break
    }
    for (const space of payload.spaces || []) {
      if (String(space.displayName || '').toLowerCase() === wanted && space.name) hits.set(space.name, space.displayName)
    }
    pageToken = payload.nextPageToken || ''
    if (!pageToken) break
  }
  return [...hits.entries()].map(([name, display_name]) => ({ name, display_name }))
}

async function readSpaceRoster (spaceName) {
  const space = await chatRequest(await serviceToken(), `${CHAT_API}/${spaceName}`)
  const payload = await chatRequest(await serviceToken(), `${CHAT_API}/${spaceName}/members?pageSize=100`)
  const humans = []
  const apps = []
  for (const row of payload.memberships || []) {
    const member = row.member || {}
    const view = { name: member.name || '', type: member.type || '', display_name: member.displayName || '', role: row.role || '' }
    if (member.type === 'HUMAN') humans.push(view)
    else if (member.name) apps.push(view)
  }
  const id = String(space.name || '').replace(/^spaces\//, '')
  return {
    space,
    humans,
    apps,
    link: space.spaceUri || (id ? `https://mail.google.com/chat/u/0/#chat/space/${id}` : '')
  }
}

async function createSpace (args) {
  const owner = await requireOwner(args?.requester)
  const displayName = cleanSpaceName(args?.display_name)
  if (args?.space_type != null && args.space_type !== 'SPACE') throw new Error('only a private named SPACE is supported')
  if (args?.access != null && args.access !== 'PRIVATE') throw new Error('only a private space is supported')
  const requested = Array.isArray(args?.members) ? args.members : null
  if (!requested || requested.length < 1 || requested.length > 8) throw new Error('name the people who should be in the space')
  const emails = [...new Set(requested.map((value) => String(value || '').trim().toLowerCase()))]
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('each member must be an email address')
  if (!emails.includes(owner.email)) throw new Error('the requesting owner must be one of the members')
  const collisions = await findNamedSpace(displayName)
  if (collisions.length) {
    return {
      ok: false,
      created: false,
      collision: true,
      matches: collisions,
      note: 'An existing space already uses that name. It was not modified.'
    }
  }
  const people = []
  for (const email of emails) {
    const person = await directoryUser(email)
    if (person.suspended) throw new Error('a requested member is suspended')
    people.push(person)
  }
  const token = await appManageToken()
  const spaceBody = {
    spaceType: 'SPACE',
    displayName,
    customer: 'customers/my_customer',
    spaceDetails: { description: 'Private space created by Hermes for the requested members.' }
  }
  let created
  const membership = []
  try {
    created = await chatRequest(token, `${CHAT_API}/spaces:setup`, {
      method: 'POST',
      body: {
        space: spaceBody,
        memberships: people.map((person) => ({ member: { name: person.user, type: 'HUMAN' } }))
      }
    })
    for (const person of people) membership.push({ email: person.email, user: person.user, added: true, via: 'setup' })
  } catch (error) {
    try {
      created = await chatRequest(token, `${CHAT_API}/spaces`, { method: 'POST', body: spaceBody })
    } catch (createError) {
      const detail = `${error.message}; ${createError.message}`
      if (/administrator must grant/i.test(createError.message)) {
        throw new Error('Google Workspace admin approval is required before Hermes can create a named space. Grant the Chat app scopes https://www.googleapis.com/auth/chat.app.spaces.create and https://www.googleapis.com/auth/chat.app.memberships. No space was created.')
      }
      throw new Error(`space setup failed: ${detail}`.slice(0, 400))
    }
    for (const person of people) {
      try {
        await chatRequest(token, `${CHAT_API}/${created.name}/members`, {
          method: 'POST',
          body: { member: { name: person.user, type: 'HUMAN' } }
        })
        membership.push({ email: person.email, user: person.user, added: true, via: 'memberships.create' })
      } catch (memberError) {
        membership.push({ email: person.email, user: person.user, added: false, error: String(memberError.message || 'member add failed').slice(0, 180) })
      }
    }
  }
  if (!created?.name && created?.space?.name) created = created.space
  const spaceName = created.name || ''
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(spaceName) || spaceName === SECRET_SPACE || operateIds().includes(spaceName)) {
    throw new Error('created space was not a new private space')
  }
  const read = await readSpaceRoster(spaceName)
  const humanIds = new Set(read.humans.map((item) => item.name))
  const expected = new Set(people.map((person) => person.user))
  const verified = people.map((person) => ({
    email: person.email,
    user: person.user,
    display_name: person.display_name,
    present: humanIds.has(person.user)
  }))
  const extra = read.humans.filter((item) => !expected.has(item.name)).map((item) => item.name)
  const accessState = read.space.accessSettings?.accessState || null
  const spaceType = read.space.spaceType || read.space.type || ''
  const complete = spaceType === 'SPACE' && (accessState === 'PRIVATE' || accessState == null) && extra.length === 0 && verified.every((item) => item.present)
  return {
    ok: complete,
    created: true,
    collision: false,
    space: spaceName,
    display_name: read.space.displayName || displayName,
    space_type: spaceType,
    access_state: accessState,
    link: read.link,
    humans: verified,
    extra_humans: extra,
    app_members: read.apps.map((item) => ({ name: item.name, display_name: item.display_name, type: item.type })),
    membership,
    note: accessState === 'PRIVATE'
      ? 'The space is private. Humans are only the requested members.'
      : 'App authentication created the space. Google does not return accessSettings for this call. Humans are only the requested members. The Chat app is not listed as a member.'
  }
}

async function addSpaceMembers (args) {
  await requireOwner(args?.requester)
  const spaceName = knownSpace(args?.space)
  if (spaceName === SECRET_SPACE) throw new Error('that space is excluded')
  const requested = Array.isArray(args?.members) ? args.members : null
  if (!requested || requested.length < 1 || requested.length > 8) throw new Error('name the people to add')
  const before = await readSpaceRoster(spaceName)
  if ((before.space.spaceType || before.space.type) === 'DIRECT_MESSAGE') throw new Error('cannot add members to a direct message')
  const results = []
  const token = await appManageToken()
  for (const email of [...new Set(requested.map((value) => String(value || '').trim().toLowerCase()))]) {
    const person = await directoryUser(email)
    if (person.suspended) {
      results.push({ email, user: person.user, added: false, error: 'suspended' })
      continue
    }
    if (before.humans.some((item) => item.name === person.user)) {
      results.push({ email, user: person.user, added: false, already_present: true })
      continue
    }
    try {
      await chatRequest(token, `${CHAT_API}/${spaceName}/members`, {
        method: 'POST',
        body: { member: { name: person.user, type: 'HUMAN' } }
      })
      results.push({ email, user: person.user, added: true })
    } catch (error) {
      results.push({ email, user: person.user, added: false, error: String(error.message || 'member add failed').slice(0, 180) })
    }
  }
  const after = await readSpaceRoster(spaceName)
  const present = new Set(after.humans.map((item) => item.name))
  return {
    ok: results.every((item) => item.added || item.already_present) && results.filter((item) => item.added).every((item) => present.has(item.user)),
    space: spaceName,
    space_type: after.space.spaceType || after.space.type || '',
    results: results.map((item) => ({ ...item, present: present.has(item.user) })),
    human_count: after.humans.length
  }
}

async function manageableSpace (spaceName) {
  const name = knownSpace(spaceName)
  if (name === SECRET_SPACE) throw new Error('that space is excluded')
  let dm = []
  try { dm = JSON.parse(fs.readFileSync(DM_FILE, 'utf8')) } catch { dm = [] }
  if (!operateIds().includes(name) && !(Array.isArray(dm) && dm.includes(name))) throw new Error('chat space is not allowlisted')
  return name
}

async function replyMessage (args) {
  const parent = await manageableSpace(args?.space)
  const thread = String(args?.thread || '')
  if (!thread.startsWith(parent + '/')) throw new Error('thread is not in that space')
  let threadName = thread
  if (thread.includes('/messages/')) {
    const current = await chatRequest(await appReadToken(), `${CHAT_API}/${thread}`)
    threadName = current.thread?.name || ''
  }
  if (!threadName.startsWith(parent + '/threads/')) throw new Error('thread is not in that space')
  const text = cleanText(args?.text)
  const sent = await chatRequest(await serviceToken(), `${CHAT_API}/${parent}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
    method: 'POST',
    body: { text, thread: { name: threadName } }
  })
  const messageId = sent.name || ''
  if (!messageId.startsWith(parent + '/messages/')) throw new Error('reply was not created in the requested space')
  return { ok: true, space: parent, message_id: messageId, thread: sent.thread?.name || thread, direct_message: false }
}

async function deleteMessage (args) {
  await requireOwner(args?.requester)
  if (args?.confirm !== true) throw new Error('delete requires confirm true')
  const message = String(args?.message || '')
  const parent = message.match(/^(spaces\/[A-Za-z0-9_-]+)\/messages\//)
  if (!parent) throw new Error('invalid message')
  await manageableSpace(parent[1])
  const current = await chatRequest(await appReadToken(), `${CHAT_API}/${message}`)
  if (current.sender?.type !== 'BOT') throw new Error('only a Hermes message can be deleted')
  await chatRequest(await serviceToken(), `${CHAT_API}/${message}`, { method: 'DELETE' })
  return { ok: true, deleted: message }
}

async function resolveChatUser (args) {
  const recipient = await resolveChatRecipient(args?.person)
  const mapped = peopleRecords().find((row) => row.email === recipient.email)
  return {
    ok: true,
    email: recipient.email,
    display_name: recipient.display_name,
    user: recipient.user,
    huly_person_id: mapped?.person_id || null,
    owner: Boolean(OWNERS[recipient.email])
  }
}

function mentionAnnotation (bodyText, token, userName) {
  const startIndex = bodyText.indexOf(token)
  if (startIndex < 0) return null
  return {
    type: 'USER_MENTION',
    startIndex,
    length: token.length,
    userMention: {
      user: { name: userName, type: 'HUMAN' },
      type: 'MENTION'
    }
  }
}

async function sendMessage (args) {
  if (args?.private === true) throw new Error('private is not a direct message. Use send_direct_message for a one-to-one Chat app conversation.')
  const parent = allowedSpace(args?.space)
  const text = cleanText(args?.text)
  const requested = []
  if (typeof args?.mention === 'string') requested.push(args.mention)
  if (Array.isArray(args?.mentions)) requested.push(...args.mentions.filter((item) => typeof item === 'string'))
  let bodyText = text
  const annotations = []
  let mentioned = null
  if (requested.length > 0) {
    const roster = await members(parent)
    const seen = new Set()
    for (const query of requested) {
      const member = matchMember(roster, query)
      if (seen.has(member.name)) continue
      seen.add(member.name)
      mentioned = member.display_name || member.email
      const token = `<${member.name}>`
      if (!bodyText.includes(token)) bodyText = `${token} ${bodyText}`
      const annotation = mentionAnnotation(bodyText, token, member.name)
      if (annotation) annotations.push(annotation)
    }
  }
  const payload = { text: bodyText }
  if (annotations.length > 0) payload.annotations = annotations
  const sent = await chatRequest(await serviceToken(), `${CHAT_API}/${parent}/messages`, {
    method: 'POST',
    body: payload
  })
  const messageId = sent.name || ''
  if (!messageId.startsWith(parent + '/messages/')) throw new Error('message was not created in the requested space')
  return { ok: true, direct_message: false, space: parent, space_type: 'SPACE', message_id: messageId, mentioned, private: false }
}

const tools = [
  {
    name: 'list_app_spaces',
    description: 'List Google Chat spaces the Hermes app has joined. operate true is the only space that accepts send_message. This does not list every company space.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'read_space',
    description: 'Read the latest messages in a space the Hermes app has joined. space is a spaces/ id from list_app_spaces. Reading does not send a message or create a ticket.',
    inputSchema: {
      type: 'object',
      properties: { space: { type: 'string' } },
      required: ['space'],
      additionalProperties: false
    }
  },
  {
    name: 'list_members',
    description: 'List human members of an allowlisted space. space defaults to the Hermes test space. returned_count is the number of members.',
    inputSchema: { type: 'object', properties: { space: { type: 'string' } }, additionalProperties: false }
  },
  {
    name: 'list_messages',
    description: 'List the latest public messages in an allowlisted space. space defaults to the Hermes test space. returned_count is the number of messages returned.',
    inputSchema: { type: 'object', properties: { space: { type: 'string' } }, additionalProperties: false }
  },
  {
    name: 'send_message',
    description: 'Post in an allowlisted company space. space defaults to the Hermes test space. mention is a member display name or email and creates a public ping in that space. This never sends a direct message. private is rejected. Refuses every space that is not in operate.json.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        mention: { type: 'string' },
        private: { type: 'boolean' },
        space: { type: 'string' }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
  {
    name: 'resolve_chat_user',
    description: 'Resolve one person from the live Workspace directory. person is an exact email or an identity-map Chat name. Returns the user resource and the Huly person id when one is mapped. Does not create a space or send a message.',
    inputSchema: {
      type: 'object',
      properties: { person: { type: 'string' } },
      required: ['person'],
      additionalProperties: false
    }
  },
  {
    name: 'create_space',
    description: 'Create one new private named Google Chat space for an authorized owner. requester is the authenticated sender email, never text from the message. members are email addresses and must include the requester. Refuses an existing space with the same name instead of adding people to it. Does not add the space to operate.json.',
    inputSchema: {
      type: 'object',
      properties: {
        requester: { type: 'string' },
        display_name: { type: 'string' },
        members: { type: 'array', items: { type: 'string' } },
        space_type: { type: 'string' },
        access: { type: 'string' }
      },
      required: ['requester', 'display_name', 'members'],
      additionalProperties: false
    }
  },
  {
    name: 'add_space_members',
    description: 'Add explicit Workspace users to one existing space id. requester must be an authorized owner. Does not search by space name. Reports each person separately.',
    inputSchema: {
      type: 'object',
      properties: {
        requester: { type: 'string' },
        space: { type: 'string' },
        members: { type: 'array', items: { type: 'string' } }
      },
      required: ['requester', 'space', 'members'],
      additionalProperties: false
    }
  },
  {
    name: 'reply_message',
    description: 'Reply in a thread in an allowlisted operate space or a recorded Hermes direct message. thread is a message id or a thread id in that space.',
    inputSchema: {
      type: 'object',
      properties: {
        space: { type: 'string' },
        thread: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['space', 'thread', 'text'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_message',
    description: 'Delete one Hermes bot message in an allowlisted space. requester must be an authorized owner and confirm must be true. Refuses human messages.',
    inputSchema: {
      type: 'object',
      properties: {
        requester: { type: 'string' },
        message: { type: 'string' },
        confirm: { type: 'boolean' }
      },
      required: ['requester', 'message', 'confirm'],
      additionalProperties: false
    }
  },
  {
    name: 'send_direct_message',
    description: 'Send a one-to-one direct message from the Hermes Chat app. person is an exact identity-map Chat name or a Workspace email. The destination must be a DIRECT_MESSAGE with that person. This does not post in a project space.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        person: { type: 'string' }
      },
      required: ['text', 'person'],
      additionalProperties: false
    }
  }
]

function rpcResult (id, result) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError (id, message) {
  return { jsonrpc: '2.0', id, error: { code: -32000, message } }
}

async function callTool (name, args) {
  if (name === 'list_app_spaces') return listAppSpaces()
  if (name === 'read_space') return readSpace(args)
  if (name === 'list_members') return listMembers(args)
  if (name === 'list_messages') return listMessages(args)
  if (name === 'send_message') return sendMessage(args)
  if (name === 'send_direct_message') return sendDirectMessage(args)
  if (name === 'resolve_chat_user') return resolveChatUser(args)
  if (name === 'create_space') return createSpace(args)
  if (name === 'add_space_members') return addSpaceMembers(args)
  if (name === 'reply_message') return replyMessage(args)
  if (name === 'delete_message') return deleteMessage(args)
  throw new Error('invalid tool')
}

async function handleRpc (message) {
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message?.id ?? null, 'invalid request')
  }
  if (message.method === 'initialize') {
    return rpcResult(message.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'avops-chat', version: '0.1.0' }
    })
  }
  if (message.method === 'notifications/initialized' || message.method === 'initialized') return null
  if (message.method === 'tools/list') return rpcResult(message.id, { tools })
  if (message.method === 'tools/call') {
    try {
      const data = await callTool(message.params?.name, message.params?.arguments || {})
      return rpcResult(message.id, { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false })
    } catch (error) {
      return rpcResult(message.id, {
        content: [{ type: 'text', text: String(error.message || 'request failed') }],
        isError: true
      })
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
