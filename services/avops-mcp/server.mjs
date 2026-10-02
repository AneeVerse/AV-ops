import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { Packr } from 'msgpackr'
import WebSocket from 'ws'

const root = path.dirname(fileURLToPath(import.meta.url))
const logPath = path.join(root, 'mcp.log')
const packr = new Packr({ structuredClone: true, bundleStrings: true, copyBuffers: false })

const CLASS = {
  organization: 'contact:class:Organization',
  person: 'contact:class:Person',
  project: 'tracker:class:Project',
  issue: 'tracker:class:Issue',
  message: 'chunter:class:ChatMessage'
}

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

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

function logLine (entry) {
  const row = JSON.stringify({ ts: new Date().toISOString(), ...entry })
  fs.appendFile(logPath, row + '\n', () => {})
  process.stderr.write(row + '\n')
}

function category (error) {
  const message = String(error?.message || error)
  if (message.includes('HULY_READ_TOKEN')) return 'auth'
  if (message.includes('invalid') || message.includes('required')) return 'validation'
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('transactor') || message.includes('websocket')) return 'upstream'
  return 'internal'
}

function limitOf (value) {
  const n = value == null ? DEFAULT_LIMIT : Number(value)
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw new Error('invalid limit')
  }
  return n
}

function idOf (value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:._-]{1,128}$/.test(value)) {
    throw new Error(`invalid ${name}`)
  }
  return value
}

function textOf (value, name) {
  if (typeof value !== 'string') throw new Error(`invalid ${name}`)
  const text = value.trim()
  if (text.length < 1 || text.length > 80 || /[\u0000-\u001f]/.test(text)) {
    throw new Error(`invalid ${name}`)
  }
  return text
}

function likeOf (value) {
  return '%' + value.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%'
}

function timeOf (value, name) {
  if (value == null) return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid ${name}`)
  return n
}

function clip (value, max = 400) {
  if (value == null) return null
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > max ? text.slice(0, max) + '…' : text
}

function page (rows, limit) {
  const list = Array.isArray(rows) ? rows.slice(0, limit) : []
  const last = list[list.length - 1]
  const cursor = last?.modifiedOn ?? last?.modified_on ?? last?.created_on
  return {
    items: list,
    next_cursor: typeof cursor === 'number' ? cursor : null
  }
}

function orgView (doc, fallback = {}) {
  return {
    id: doc._id ?? fallback.id ?? null,
    name: doc.name ?? null,
    description: clip(doc.description),
    city: doc.city ?? null,
    member_count: Array.isArray(doc.members) ? doc.members.length : 0,
    modified_on: doc.modifiedOn ?? null
  }
}

function personView (doc, fallback = {}) {
  return {
    id: doc._id ?? fallback.id ?? null,
    name: doc.name ?? null,
    city: doc.city ?? null,
    modified_on: doc.modifiedOn ?? null
  }
}

function projectView (doc, fallback = {}) {
  return {
    id: doc._id ?? fallback.id ?? null,
    name: doc.name ?? null,
    identifier: doc.identifier ?? null,
    organization_id: doc.company ?? fallback.organization_id ?? null,
    description: clip(doc.description),
    archived: doc.archived === true,
    modified_on: doc.modifiedOn ?? null
  }
}

function issueView (doc, fallback = {}) {
  return {
    id: doc._id ?? fallback.id ?? null,
    identifier: doc.identifier ?? null,
    number: doc.number ?? null,
    title: doc.title ?? null,
    project_id: doc.space ?? fallback.project_id ?? null,
    status_id: doc.status ?? null,
    assignee_id: doc.assignee ?? fallback.assignee_id ?? null,
    due_date: doc.dueDate ?? null,
    is_done: doc.isDone === true,
    priority: doc.priority ?? null,
    blocked_by: Array.isArray(doc.blockedBy) ? doc.blockedBy.map((row) => row?._id || row).slice(0, 20) : [],
    modified_on: doc.modifiedOn ?? null
  }
}

function messageView (doc, fallback = {}) {
  return {
    id: doc._id ?? fallback.id ?? null,
    attached_to: doc.attachedTo ?? fallback.attached_to ?? null,
    space_id: doc.space ?? null,
    created_by: doc.createdBy ?? doc.modifiedBy ?? null,
    created_on: doc.createdOn ?? doc.modifiedOn ?? null,
    text: clip(doc.message, 500)
  }
}

class HulyClient {
  constructor () {
    this.ws = null
    this.binary = false
    this.seq = 1
    this.pending = new Map()
  }

  async connect () {
    const token = process.env.HULY_READ_TOKEN
    if (!token) throw new Error('HULY_READ_TOKEN is not configured')
    const endpoint = (process.env.HULY_TRANSACTOR_URL || 'ws://127.0.0.1:8087').replace(/\/$/, '')
    const sessionId = crypto.randomUUID()
    const url = `${endpoint}/${token}?sessionId=${sessionId}`
    this.ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('transactor connect timeout')), 8000)
      this.ws.once('open', () => {
        clearTimeout(timer)
        resolve()
      })
      this.ws.once('error', (error) => {
        clearTimeout(timer)
        reject(new Error('transactor websocket failed'))
      })
    })
    this.ws.on('message', (data, isBinary) => this.onMessage(data, isBinary))
    const hello = await this.hello()
    this.binary = hello?.binary === true
  }

  hello () {
    const body = { method: 'hello', params: [], id: -1, binary: false, compression: false, time: Date.now() }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(-1)
        reject(new Error('transactor timeout'))
      }, 12000)
      this.pending.set(-1, { resolve, reject, timer })
      this.ws.send(JSON.stringify(body))
    })
  }

  onMessage (data) {
    let message
    try {
      if (!this.binary) {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString()
        message = JSON.parse(text)
      } else {
        message = packr.unpack(data)
      }
    } catch {
      return
    }
    const waiter = message?.id != null ? this.pending.get(message.id) : undefined
    if (!waiter) return
    clearTimeout(waiter.timer)
    this.pending.delete(message.id)
    if (message.error) waiter.reject(new Error('transactor request failed'))
    else waiter.resolve(message.id === -1 ? message : message.result)
  }

  request (method, params) {
    const id = this.seq++
    const body = { method, params, id, time: Date.now() }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('transactor timeout'))
      }, 12000)
      this.pending.set(id, { resolve, reject, timer })
      const payload = this.binary ? packr.pack(body) : JSON.stringify(body)
      this.ws.send(payload)
    })
  }

  async findAll (className, query, options) {
    const limit = options.limit
    const findOptions = { limit, sort: { modifiedOn: -1 } }
    if (options.projection) findOptions.projection = options.projection
    const result = await this.request('findAll', [className, query, findOptions])
    const rows = result?.dataType === 'TotalArray' && Array.isArray(result.value) ? result.value : result
    return Array.isArray(rows) ? rows.slice(0, limit) : []
  }

  close () {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('transactor closed'))
    }
    this.pending.clear()
    this.ws?.close()
  }
}

async function withHuly (fn) {
  const client = new HulyClient()
  try {
    await client.connect()
    return await fn(client)
  } finally {
    client.close()
  }
}

function cursorQuery (args, extra) {
  const query = { ...extra }
  const before = timeOf(args.before, 'before')
  if (before != null) query.modifiedOn = { $lt: before }
  return query
}

async function searchOrganizations (client, args) {
  const limit = limitOf(args.limit)
  const query = cursorQuery(args, {})
  if (args.query != null) query.name = { $like: likeOf(textOf(args.query, 'query')) }
  const rows = await client.findAll(CLASS.organization, query, { limit })
  return page(rows.map(orgView), limit)
}

async function getOrganization (client, args) {
  const id = idOf(args.organization_id, 'organization_id')
  const rows = await client.findAll(CLASS.organization, { _id: id }, { limit: 1 })
  return rows[0] ? orgView(rows[0], { id }) : null
}

async function searchProjects (client, args) {
  const limit = limitOf(args.limit)
  const query = cursorQuery(args, {})
  if (args.organization_id != null) query.company = idOf(args.organization_id, 'organization_id')
  if (args.query != null) query.name = { $like: likeOf(textOf(args.query, 'query')) }
  const rows = await client.findAll(CLASS.project, query, { limit })
  const fallback = typeof query.company === 'string' ? { organization_id: query.company } : {}
  return page(rows.map((row) => projectView(row, fallback)), limit)
}

async function getProject (client, args) {
  const id = idOf(args.project_id, 'project_id')
  const rows = await client.findAll(CLASS.project, { _id: id }, { limit: 1 })
  return rows[0] ? projectView(rows[0], { id }) : null
}

function issueFallback (query) {
  const fallback = {}
  if (typeof query.space === 'string') fallback.project_id = query.space
  if (typeof query.assignee === 'string') fallback.assignee_id = query.assignee
  return fallback
}

async function searchIssues (client, args) {
  const limit = limitOf(args.limit)
  const query = cursorQuery(args, {})
  if (args.project_id != null) query.space = idOf(args.project_id, 'project_id')
  if (args.assignee_id != null) query.assignee = idOf(args.assignee_id, 'assignee_id')
  if (args.query != null) query.title = { $like: likeOf(textOf(args.query, 'query')) }
  if (args.open_only === true) query.isDone = { $ne: true }
  const rows = await client.findAll(CLASS.issue, query, { limit })
  return page(rows.map((row) => issueView(row, issueFallback(query))), limit)
}

async function getIssue (client, args) {
  const id = idOf(args.issue_id, 'issue_id')
  const rows = await client.findAll(CLASS.issue, { _id: id }, { limit: 1 })
  return rows[0] ? issueView(rows[0], { id }) : null
}

async function overdueIssues (client, args) {
  const limit = limitOf(args.limit)
  const before = timeOf(args.before, 'before') ?? Date.now()
  const query = { dueDate: { $gt: 0, $lt: before }, isDone: { $ne: true } }
  if (args.project_id != null) query.space = idOf(args.project_id, 'project_id')
  const rows = await client.findAll(CLASS.issue, query, { limit })
  return page(rows.map((row) => issueView(row, issueFallback(query))), limit)
}

async function unassignedIssues (client, args) {
  const limit = limitOf(args.limit)
  const query = cursorQuery(args, { assignee: null, isDone: { $ne: true } })
  if (args.project_id != null) query.space = idOf(args.project_id, 'project_id')
  const rows = await client.findAll(CLASS.issue, query, { limit })
  return page(rows.map((row) => issueView(row, issueFallback(query))), limit)
}

async function blockedIssues (client, args) {
  const limit = limitOf(args.limit)
  const query = cursorQuery(args, { isDone: { $ne: true } })
  if (args.project_id != null) query.space = idOf(args.project_id, 'project_id')
  const rows = await client.findAll(CLASS.issue, query, { limit: MAX_LIMIT })
  const blocked = rows.filter((row) => Array.isArray(row.blockedBy) && row.blockedBy.length > 0).slice(0, limit)
  return {
    items: blocked.map((row) => issueView(row, issueFallback(query))),
    next_cursor: rows.length ? rows[rows.length - 1].modifiedOn ?? null : null,
    note: 'Blocked means the issue blockedBy list is non-empty. This looks at the newest open issues up to 50, then keeps those that are blocked.'
  }
}

async function searchPeople (client, args) {
  const limit = limitOf(args.limit)
  const query = cursorQuery(args, {})
  if (args.query != null) query.name = { $like: likeOf(textOf(args.query, 'query')) }
  const rows = await client.findAll(CLASS.person, query, { limit })
  return page(rows.map(personView), limit)
}

async function getPerson (client, args) {
  const id = idOf(args.person_id, 'person_id')
  const rows = await client.findAll(CLASS.person, { _id: id }, { limit: 1 })
  return rows[0] ? personView(rows[0], { id }) : null
}

async function personWork (client, args) {
  const limit = limitOf(args.limit)
  const personId = idOf(args.person_id, 'person_id')
  const rows = await client.findAll(CLASS.issue, cursorQuery(args, { assignee: personId, isDone: { $ne: true } }), { limit })
  return page(rows.map((row) => issueView(row, { assignee_id: personId })), limit)
}

async function projectsForOrg (client, organizationId, limit) {
  return client.findAll(CLASS.project, { company: organizationId }, { limit })
}

async function activityForProjects (client, projectIds, limit) {
  if (projectIds.length === 0) return []
  const rows = await client.findAll(CLASS.issue, { space: { $in: projectIds.slice(0, 20) } }, { limit })
  return rows.map(issueView)
}

async function messagesFor (client, ids, since, until, limit) {
  if (ids.length === 0) return []
  const query = { attachedTo: { $in: ids.slice(0, 20) } }
  if (since != null || until != null) {
    query.modifiedOn = {}
    if (since != null) query.modifiedOn.$gt = since
    if (until != null) query.modifiedOn.$lt = until
  }
  const rows = await client.findAll(CLASS.message, query, { limit })
  const fallback = ids.length === 1 ? { attached_to: ids[0] } : {}
  return rows.map((row) => messageView(row, fallback))
}

async function clientActivity (client, args) {
  const limit = limitOf(args.limit)
  const organizationId = idOf(args.organization_id, 'organization_id')
  const projects = await projectsForOrg(client, organizationId, 20)
  const issues = await activityForProjects(client, projects.map((row) => row._id), limit)
  return {
    organization_id: organizationId,
    projects: projects.map((row) => projectView(row, { organization_id: organizationId })),
    recent_issues: issues
  }
}

async function projectActivity (client, args) {
  const limit = limitOf(args.limit)
  const projectId = idOf(args.project_id, 'project_id')
  const issues = await client.findAll(CLASS.issue, { space: projectId }, { limit })
  const since = timeOf(args.since, 'since')
  const messages = await messagesFor(client, [projectId], since, undefined, Math.min(limit, 15))
  return { project_id: projectId, recent_issues: issues.map((row) => issueView(row, { project_id: projectId })), recent_messages: messages }
}

async function searchMessages (client, args) {
  const limit = limitOf(args.limit)
  const since = timeOf(args.since, 'since') ?? Date.now() - 7 * 24 * 60 * 60 * 1000
  const until = timeOf(args.until, 'until')
  if (until != null && until < since) throw new Error('invalid until')
  if ((until ?? Date.now()) - since > 31 * 24 * 60 * 60 * 1000) throw new Error('invalid time range')
  let ids = []
  if (args.attached_to != null) ids = [idOf(args.attached_to, 'attached_to')]
  else if (args.project_id != null) ids = [idOf(args.project_id, 'project_id')]
  else if (args.organization_id != null) {
    const projects = await projectsForOrg(client, idOf(args.organization_id, 'organization_id'), 20)
    ids = projects.map((row) => row._id)
  } else {
    throw new Error('organization_id, project_id, or attached_to is required')
  }
  const items = await messagesFor(client, ids, since, until, limit)
  return { items, since, until: until ?? null }
}

async function messageThread (client, args) {
  const limit = limitOf(args.limit)
  const messageId = idOf(args.message_id, 'message_id')
  const rows = await client.findAll(CLASS.message, { attachedTo: messageId }, { limit })
  const parent = await client.findAll(CLASS.message, { _id: messageId }, { limit: 1 })
  return {
    parent: parent[0] ? messageView(parent[0], { id: messageId }) : null,
    replies: rows.map((row) => messageView(row, { attached_to: messageId }))
  }
}

async function clientContext (client, args) {
  const limit = limitOf(args.limit)
  let organization
  if (args.organization_id != null) {
    const rows = await client.findAll(CLASS.organization, { _id: idOf(args.organization_id, 'organization_id') }, { limit: 1 })
    organization = rows[0]
  } else {
    const name = textOf(args.name, 'name')
    const rows = await client.findAll(CLASS.organization, { name: { $like: likeOf(name) } }, { limit: 5 })
    if (rows.length !== 1) {
      return { matches: rows.map(orgView), note: 'Provide organization_id when the name is not unique.' }
    }
    organization = rows[0]
  }
  if (!organization) return null
  const organizationId = args.organization_id != null ? idOf(args.organization_id, 'organization_id') : organization._id
  if (!organizationId) return null
  const projects = await projectsForOrg(client, organizationId, 20)
  const projectIds = projects.map((row) => row._id)
  const issues = await activityForProjects(client, projectIds, limit)
  const openIssues = issues.filter((row) => row.is_done !== true)
  const now = Date.now()
  const overdue = openIssues.filter((row) => typeof row.due_date === 'number' && row.due_date > 0 && row.due_date < now)
  const peopleIds = [...new Set(openIssues.map((row) => row.assignee_id).filter(Boolean))].slice(0, 20)
  const people = peopleIds.length
    ? (await client.findAll(CLASS.person, { _id: { $in: peopleIds } }, { limit: peopleIds.length })).map(personView)
    : []
  const messages = await messagesFor(client, projectIds, now - 14 * 24 * 60 * 60 * 1000, undefined, Math.min(limit, 15))
  return {
    client: orgView(organization, { id: organizationId }),
    projects: projects.map((row) => projectView(row, { organization_id: organizationId })),
    open_issues: openIssues,
    overdue_issues: overdue,
    assigned_people: people,
    recent_messages: messages
  }
}

const tools = [
  tool('search_organizations', 'Search AV OPS clients. A client is a Huly Organization.', { query: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, searchOrganizations),
  tool('get_organization', 'Get one AV OPS client by Huly organization id.', { organization_id: { type: 'string' } }, getOrganization, ['organization_id']),
  tool('list_organizations', 'List AV OPS clients, newest modified first.', { limit: { type: 'integer' }, before: { type: 'integer' } }, searchOrganizations),
  tool('search_projects', 'Search AV OPS projects. Optional organization_id is the Huly Organization stored in Project.company.', { query: { type: 'string' }, organization_id: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, searchProjects),
  tool('get_project', 'Get one project by id.', { project_id: { type: 'string' } }, getProject, ['project_id']),
  tool('list_projects', 'List projects, newest modified first.', { organization_id: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, searchProjects),
  tool('search_issues', 'Search AV OPS tasks. A task is a Huly Issue.', { query: { type: 'string' }, project_id: { type: 'string' }, assignee_id: { type: 'string' }, open_only: { type: 'boolean' }, limit: { type: 'integer' }, before: { type: 'integer' } }, searchIssues),
  tool('get_issue', 'Get one issue by id.', { issue_id: { type: 'string' } }, getIssue, ['issue_id']),
  tool('list_issues', 'List issues, newest modified first.', { project_id: { type: 'string' }, assignee_id: { type: 'string' }, open_only: { type: 'boolean' }, limit: { type: 'integer' }, before: { type: 'integer' } }, searchIssues),
  tool('get_overdue_issues', 'Open issues whose dueDate is set and earlier than before (default now).', { project_id: { type: 'string' }, before: { type: 'integer' }, limit: { type: 'integer' } }, overdueIssues),
  tool('get_unassigned_issues', 'Open issues with no assignee.', { project_id: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, unassignedIssues),
  tool('get_blocked_issues', 'Open issues whose blockedBy list is non-empty, taken from the newest 50 open issues.', { project_id: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, blockedIssues),
  tool('search_people', 'Search people by name.', { query: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, searchPeople),
  tool('get_person', 'Get one person by id.', { person_id: { type: 'string' } }, getPerson, ['person_id']),
  tool('get_person_work', 'Open issues assigned to a person.', { person_id: { type: 'string' }, limit: { type: 'integer' }, before: { type: 'integer' } }, personWork, ['person_id']),
  tool('get_client_activity', 'Projects and recent issues for one organization.', { organization_id: { type: 'string' }, limit: { type: 'integer' } }, clientActivity, ['organization_id']),
  tool('get_project_activity', 'Recent issues and messages for one project.', { project_id: { type: 'string' }, since: { type: 'integer' }, limit: { type: 'integer' } }, projectActivity, ['project_id']),
  tool('search_messages', 'Recent chat messages attached to an organization\'s projects, one project, or one object. Requires a scope and stays inside 31 days.', { organization_id: { type: 'string' }, project_id: { type: 'string' }, attached_to: { type: 'string' }, since: { type: 'integer' }, until: { type: 'integer' }, limit: { type: 'integer' } }, searchMessages),
  tool('get_message_thread', 'One chat message and messages attached to it.', { message_id: { type: 'string' }, limit: { type: 'integer' } }, messageThread, ['message_id']),
  tool('get_client_context', 'Bounded summary for one client: organization, projects, open and overdue issues, assignees, and recent messages.', { organization_id: { type: 'string' }, name: { type: 'string' }, limit: { type: 'integer' } }, clientContext)
]

function tool (name, description, properties, handler, required = []) {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    handler
  }
}

const byName = new Map(tools.map((item) => [item.name, item]))

async function callTool (name, args) {
  const spec = byName.get(name)
  if (!spec) throw new Error('invalid tool')
  const input = args && typeof args === 'object' ? args : {}
  for (const key of spec.inputSchema.required) {
    if (input[key] == null || input[key] === '') throw new Error(`${key} is required`)
  }
  const started = Date.now()
  try {
    const result = await withHuly((client) => spec.handler(client, input))
    logLine({ tool: name, ms: Date.now() - started, ok: true })
    return result
  } catch (error) {
    logLine({ tool: name, ms: Date.now() - started, ok: false, error: category(error) })
    throw error
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
      serverInfo: { name: 'avops-mcp', version: '0.1.0' }
    })
  }
  if (message.method === 'notifications/initialized' || message.method === 'initialized') return null
  if (message.method === 'tools/list') {
    return rpcResult(message.id, {
      tools: tools.map((item) => ({ name: item.name, description: item.description, inputSchema: item.inputSchema }))
    })
  }
  if (message.method === 'tools/call') {
    try {
      const data = await callTool(message.params?.name, message.params?.arguments)
      return rpcResult(message.id, { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false })
    } catch (error) {
      return rpcResult(message.id, { content: [{ type: 'text', text: String(error.message || 'request failed') }], isError: true })
    }
  }
  if (message.id == null) return null
  return rpcError(message.id, 'method not found')
}

function startHttp () {
  const host = process.env.AVOPS_MCP_BIND || '127.0.0.1'
  if (host !== '127.0.0.1') throw new Error('AVOPS_MCP_BIND must be 127.0.0.1')
  const port = Number(process.env.AVOPS_MCP_PORT || 8765)
  const auth = process.env.AVOPS_MCP_AUTH
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
      return
    }
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404).end()
      return
    }
    if (!auth || req.headers.authorization !== `Bearer ${auth}`) {
      res.writeHead(401).end()
      return
    }
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 100000) req.destroy()
      else chunks.push(chunk)
    })
    req.on('end', async () => {
      try {
        const response = await handleRpc(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(response ?? {}))
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  server.listen(port, host)
}

function startStdio () {
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
}

loadEnv()
if (process.argv.includes('--http')) startHttp()
else startStdio()
