#!/usr/bin/env node
/**
 * Import AneeRequest Supabase data into Huly (Companies, Clients, Projects/Requests, Issues/Tasks).
 *
 * Mapping today: Client→Organization(+Client), Request→Project, Task→Issue.
 * Future (not yet): map request status/priority/due/assignee onto Project.request*
 * fields, and store task id on Issue for stronger idempotency.
 *
 *   node scripts/aneerequest-sample-import.mjs
 *   node scripts/aneerequest-sample-import.mjs --status=Ongoing
 *   node scripts/aneerequest-sample-import.mjs --status=all --limit=10
 *
 *   node scripts/aneerequest-sample-import.mjs --backfill-members
 *
 * Default imports AneeRequest Clients tab "Ongoing" only (not Leads/Closed/Archive).
 *
 * Env (or E:/Projects/Aneerequest/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL / ANEEREQUEST_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY / ANEEREQUEST_SUPABASE_SERVICE_ROLE_KEY
 *   HULY_USER HULY_PASSWORD HULY_WORKSPACE FRONT_URL
 *   HULY_LOGIN_FILE  (optional EMAIL= / PASSWORD= file, e.g. copied from VPS /root/huly-login.txt)
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile (path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
  }
}

loadEnvFile('E:/Projects/Aneerequest/.env.local')
loadEnvFile(join(__dirname, '../../Aneerequest/.env.local'))
if (process.env.HULY_LOGIN_FILE) loadEnvFile(process.env.HULY_LOGIN_FILE)

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg !== undefined ? Number(limitArg.split('=')[1]) : undefined
const statusArg = process.argv.find((a) => a.startsWith('--status='))
const statusFilter = (statusArg !== undefined ? statusArg.split('=')[1] : 'Ongoing').toLowerCase()
const backfillMembersOnly = process.argv.includes('--backfill-members')

const supabaseUrl = process.env.ANEEREQUEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.ANEEREQUEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const hulyUser = process.env.HULY_USER ?? process.env.EMAIL
const hulyPassword = process.env.HULY_PASSWORD ?? process.env.PASSWORD
const hulyWorkspace = process.env.HULY_WORKSPACE ?? 'aneeverse'
const frontUrl = process.env.FRONT_URL ?? 'https://huly.aneeverse.com'

if (!backfillMembersOnly && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing AneeRequest Supabase URL / service role key')
  process.exit(1)
}
if (!hulyUser || !hulyPassword) {
  console.error('Missing HULY_USER and HULY_PASSWORD')
  process.exit(1)
}

function genId () {
  return randomBytes(12).toString('hex')
}

function slugId (name, fallback) {
  const base = String(name ?? fallback ?? 'PRJ')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8)
  return base.length >= 2 ? base : 'AR' + String(fallback).replace(/-/g, '').slice(0, 6).toUpperCase()
}

async function sbAll (table, query = '') {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const sep = query.includes('?') ? '&' : '?'
    const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}${query}${sep}limit=${pageSize}&offset=${from}`
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'count=exact'
      }
    })
    if (!res.ok) {
      throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`)
    }
    const chunk = await res.json()
    rows.push(...chunk)
    if (chunk.length < pageSize) break
  }
  return rows
}

function httpEndpoint (wsEndpoint) {
  return String(wsEndpoint).replace(/^ws/i, 'http')
}

async function accountsRpc (url, method, params, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ method, params })
  })
  const body = await res.json()
  if (body.error != null) {
    throw new Error(`${method} failed: ${JSON.stringify(body.error)}`)
  }
  return body.result
}

async function hulyLogin () {
  const config = await (await fetch(`${frontUrl}/config.json`)).json()
  const accountsUrl = config.ACCOUNTS_URL
  const login = await accountsRpc(accountsUrl, 'login', { email: hulyUser, password: hulyPassword })
  if (!login?.token) throw new Error('Huly login failed: ' + JSON.stringify(login))
  let ws
  try {
    ws = await accountsRpc(
      accountsUrl,
      'selectWorkspace',
      { workspaceUrl: hulyWorkspace, kind: 'external', externalRegions: [] },
      login.token
    )
  } catch (e) {
    const info = await accountsRpc(accountsUrl, 'getLoginWithWorkspaceInfo', {}, login.token)
    const entries = Object.entries(info?.workspaces ?? {})
    const urls = entries.map(([id, w]) => w.url || w.workspaceUrl || id)
    console.warn('selectWorkspace failed, available workspaces:', urls.join(', ') || '(none)')
    const match = entries.find(([, w]) => (w.url || w.workspaceUrl) === hulyWorkspace) ?? entries[0]
    if (match === undefined) throw e
    ws = await accountsRpc(
      accountsUrl,
      'selectWorkspace',
      { workspaceUrl: match[1].url || match[1].workspaceUrl || hulyWorkspace, kind: 'external', externalRegions: [] },
      login.token
    )
  }
  if (!ws?.token || !ws?.endpoint) throw new Error('selectWorkspace failed: ' + JSON.stringify(ws))
  return {
    endpoint: httpEndpoint(ws.endpoint),
    token: ws.token,
    workspace: ws.workspace ?? hulyWorkspace
  }
}

function hulyClient (session) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + session.token
  }
  async function findAll (_class, query = {}, options = {}) {
    const params = new URLSearchParams()
    params.set('class', _class)
    if (Object.keys(query).length > 0) params.set('query', JSON.stringify(query))
    if (Object.keys(options).length > 0) params.set('options', JSON.stringify(options))
    const url = `${session.endpoint}/api/v1/find-all/${session.workspace}?${params.toString()}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`find-all ${_class}: ${res.status} ${await res.text()}`)
    const body = await res.json()
    if (body?.error != null) throw new Error(`find-all ${_class}: ${JSON.stringify(body.error)}`)
    if (Array.isArray(body)) return body
    if (Array.isArray(body?.value)) return body.value
    return []
  }
  async function findOne (_class, query) {
    const rows = await findAll(_class, query, { limit: 1 })
    return rows[0]
  }
  async function tx (body) {
    const url = `${session.endpoint}/api/v1/tx/${session.workspace}`
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await res.text()
    if (!res.ok) throw new Error(`tx ${body._class}: ${res.status} ${text}`)
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }
  async function account () {
    const url = `${session.endpoint}/api/v1/account/${session.workspace}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`account: ${res.status} ${await res.text()}`)
    return await res.json()
  }
  return { findAll, findOne, tx, account }
}

function createTx (accountId, objectClass, objectSpace, attributes, objectId, extra = {}) {
  const now = Date.now()
  return {
    _id: genId(),
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: objectId ?? genId(),
    objectClass,
    objectSpace,
    modifiedOn: now,
    createdOn: now,
    modifiedBy: accountId,
    createdBy: accountId,
    attributes,
    ...extra
  }
}

function removeTx (accountId, objectClass, objectSpace, objectId, extra = {}) {
  const now = Date.now()
  return {
    _id: genId(),
    _class: 'core:class:TxRemoveDoc',
    space: 'core:space:Tx',
    objectId,
    objectClass,
    objectSpace,
    modifiedOn: now,
    modifiedBy: accountId,
    createdBy: accountId,
    ...extra
  }
}

function updateTx (accountId, objectClass, objectSpace, objectId, operations, retrieve = false) {
  const now = Date.now()
  return {
    _id: genId(),
    _class: 'core:class:TxUpdateDoc',
    space: 'core:space:Tx',
    objectId,
    objectClass,
    objectSpace,
    modifiedOn: now,
    modifiedBy: accountId,
    operations,
    retrieve
  }
}

function mapPriority (p) {
  const v = String(p ?? '').toLowerCase()
  if (v === 'critical') return 1
  if (v === 'high') return 2
  if (v === 'medium') return 3
  if (v === 'low') return 4
  return 0
}

function mapStatusName (s) {
  const v = String(s ?? '').toLowerCase()
  if (v === 'done') return ['done']
  if (v === 'review' || v === 'under review') return ['under review', 'review', 'in progress']
  if (v.includes('progress')) return ['in progress']
  if (v === 'todo') return ['todo']
  return ['todo', 'backlog']
}

function pickStatus (statuses, wanted) {
  const names = mapStatusName(wanted)
  for (const name of names) {
    const hit = statuses.find((st) => String(st.name ?? '').toLowerCase() === name)
    if (hit) return hit._id
  }
  return statuses[0]?._id
}

function sameIdSet (a, b) {
  const as = [...new Set(a ?? [])].sort()
  const bs = [...new Set(b ?? [])].sort()
  return as.length === bs.length && as.every((x, i) => x === bs[i])
}

async function workspaceMemberUuids (huly, extraUuid) {
  const uuids = new Set()
  if (extraUuid) uuids.add(extraUuid)
  try {
    const employees = await huly.findAll('contact:mixin:Employee', { active: true })
    for (const e of employees) {
      if (e.personUuid) uuids.add(e.personUuid)
    }
    console.log('Active employees with personUuid:', employees.filter((e) => e.personUuid).length)
  } catch (e) {
    console.warn('Employee query failed:', e.message)
  }
  for (const cls of ['tracker:class:ClientFunnel', 'tracker:class:Project']) {
    try {
      const spaces = await huly.findAll(cls, { archived: false })
      for (const s of spaces) {
        for (const m of s.members ?? []) uuids.add(m)
      }
    } catch (e) {
      console.warn(cls, 'member scan failed:', e.message)
    }
  }
  const list = [...uuids].filter(Boolean)
  console.log('Workspace member uuids for imported projects:', list.length)
  return list
}

async function ensureProjectMembers (huly, accountId, project, memberUuids) {
  const nextMembers = [...new Set([...(project.members ?? []), ...memberUuids])]
  const nextOwners = [...new Set([...(project.owners ?? []), ...memberUuids])]
  const ops = {}
  if (!sameIdSet(project.members, nextMembers)) ops.members = nextMembers
  if (!sameIdSet(project.owners, nextOwners)) ops.owners = nextOwners
  if (project.autoJoin !== true) ops.autoJoin = true
  if (Object.keys(ops).length === 0) return false
  await huly.tx(updateTx(accountId, 'tracker:class:Project', 'core:space:Space', project._id, ops))
  return true
}

async function backfillCompanyProjectMembers (huly, accountId, memberUuids) {
  const projects = await huly.findAll('tracker:class:Project', { archived: false })
  const targets = projects.filter((p) => p.company != null || p.aneerequestId != null)
  let updated = 0
  for (const project of targets) {
    if (await ensureProjectMembers(huly, accountId, project, memberUuids)) {
      updated++
      console.log('members+', project.name, 'now', [...new Set([...(project.members ?? []), ...memberUuids])].length)
    }
  }
  console.log(`Backfill members: updated ${updated}/${targets.length} company projects`)
  return { updated, total: targets.length }
}

async function verifyHoreca1 (huly, meUuid) {
  const orgs = await huly.findAll('contact:class:Organization', {})
  const knownId = '9a46b248f6aace5482fb6be4'
  const matches = orgs.filter(
    (o) =>
      o._id === knownId ||
      String(o.name ?? '')
        .toUpperCase()
        .includes('HORECA')
  )
  if (matches.length === 0) {
    console.log('Verify: no HORECA organization found')
    return
  }
  for (const org of matches) {
    const projects = await huly.findAll('tracker:class:Project', { company: org._id })
    console.log(`Verify org=${org._id} name=${org.name} projects=${projects.length}`)
    for (const p of projects) {
      const issues = await huly.findAll('tracker:class:Issue', { space: p._id })
      const inMembers = Array.isArray(p.members) && p.members.includes(meUuid)
      console.log(
        `  project ${p.name} members=${(p.members ?? []).length} includesMe=${inMembers} autoJoin=${p.autoJoin === true} issues=${issues.length} titles=${issues.map((i) => i.title).join(' | ') || '(none)'}`
      )
    }
  }
}

async function main () {
  const session = await hulyLogin()
  const huly = hulyClient(session)
  const acc = await huly.account()
  const accountId = acc.primarySocialId ?? acc.socialIds?.[0] ?? 'core:account:System'
  const memberUuid = acc.uuid
  const memberUuids = await workspaceMemberUuids(huly, memberUuid)
  if (memberUuids.length === 0) {
    throw new Error('No workspace member uuids found to attach to imported projects')
  }

  if (backfillMembersOnly) {
    console.log('Backfilling members on existing company/imported projects...')
    await backfillCompanyProjectMembers(huly, accountId, memberUuids)
    await verifyHoreca1(huly, memberUuid)
    return
  }

  console.log('Loading AneeRequest clients/requests/tasks...')
  const allClients = await sbAll('clients', '?select=*&order=created_at.asc')
  const byStatus = {}
  for (const c of allClients) {
    const s = c.status || 'Ongoing'
    byStatus[s] = (byStatus[s] || 0) + 1
  }
  console.log('AneeRequest client statuses:', byStatus)
  let clients = allClients
  if (statusFilter !== 'all') {
    clients = allClients.filter((c) => String(c.status || 'Ongoing').toLowerCase() === statusFilter)
  }
  if (limit) clients = clients.slice(0, limit)
  const keepIds = new Set(clients.map((c) => c.id))
  const allRequests = await sbAll('requests', '?select=*&order=created_at.asc')
  const requests = allRequests.filter((r) => keepIds.has(r.client_id))
  const tasks = await sbAll('tasks', '?select=*')
  let links = []
  try {
    links = await sbAll('task_request_links', '?select=*')
  } catch (e) {
    console.warn('task_request_links missing, using tasks.request_id if present')
  }
  console.log(
    `Importing status=${statusFilter}: clients=${clients.length}/${allClients.length} requests=${requests.length} tasks=${tasks.length} links=${links.length}`
  )

  const funnels = await huly.findAll('tracker:class:ClientFunnel', { archived: false })
  const ecom = funnels.find((f) => String(f.name).toUpperCase() === 'ECOM') ?? funnels[0]
  if (ecom === undefined) throw new Error('No Client funnel found')

  const allTaskTypes = await huly.findAll('task:class:TaskType', {})
  const clientTaskTypes = allTaskTypes.filter((t) => t.ofClass === 'tracker:class:Client')
  const clientKind = clientTaskTypes.find((t) => t.parent === ecom.type) ?? clientTaskTypes[0]
  let clientStatuses = []
  if (clientKind?.statuses?.length) {
    clientStatuses = await huly.findAll('core:class:Status', { _id: { $in: clientKind.statuses } })
  }
  if (clientStatuses.length === 0) {
    clientStatuses = await huly.findAll('core:class:Status', { space: ecom.type })
  }
  const clientStatus = clientStatuses[0]?._id
  let clientSeq = await huly.findOne('core:class:Sequence', { attachedTo: 'tracker:class:Client' })
  if (clientSeq === undefined) {
    const seqId = genId()
    await huly.tx(
      createTx(
        accountId,
        'core:class:Sequence',
        'core:space:Workspace',
        { attachedTo: 'tracker:class:Client', sequence: 0 },
        seqId
      )
    )
    clientSeq = { _id: seqId, space: 'core:space:Workspace', sequence: 0 }
  }

  const projectTypes = await huly.findAll('task:class:ProjectType', {})
  const classic =
    projectTypes.find((t) => t._id === 'tracker:ids:ClassingProjectType') ??
    projectTypes.find((t) => t.descriptor === 'tracker:descriptors:ProjectType') ??
    projectTypes[0]
  if (classic === undefined) throw new Error('No tracker ProjectType found')
  const issueTaskTypes = allTaskTypes.filter((t) => t.ofClass === 'tracker:class:Issue')
  const issueKind = issueTaskTypes.find((t) => t.parent === classic._id) ?? issueTaskTypes[0]
  let issueStatuses = []
  const statusIds = issueKind?.statuses ?? classic.statuses ?? []
  if (statusIds.length > 0) {
    issueStatuses = await huly.findAll('core:class:Status', { _id: { $in: statusIds } })
  }
  if (issueStatuses.length === 0) {
    issueStatuses = await huly.findAll('core:class:Status', { space: classic._id })
  }
  if (issueStatuses.length === 0) {
    issueStatuses = await huly.findAll('tracker:class:IssueStatus', {})
  }
  console.log(
    `Huly: funnel=${ecom.name} type=${classic._id} issueKind=${issueKind?._id} statuses=${issueStatuses.length} statusNames=${issueStatuses.map((s) => s.name).join('|')}`
  )
  if (issueKind === undefined || issueStatuses.length === 0) {
    throw new Error(
      'Missing issue task type/statuses (taskTypes=' +
        allTaskTypes.length +
        ' issueTypes=' +
        issueTaskTypes.length +
        ' projectTypes=' +
        projectTypes.length +
        ')'
    )
  }

  async function nextSequence (seqDoc) {
    if (seqDoc === undefined) return 1
    const inc = await huly.tx(
      updateTx(
        accountId,
        'core:class:Sequence',
        seqDoc.space ?? 'core:space:Workspace',
        seqDoc._id,
        { $inc: { sequence: 1 } },
        true
      )
    )
    if (inc?.object?.sequence != null) return inc.object.sequence
    const again = await huly.findOne('core:class:Sequence', { _id: seqDoc._id })
    return again?.sequence ?? 1
  }

  async function nextProjectNumber (project) {
    const inc = await huly.tx(
      updateTx(
        accountId,
        'tracker:class:Project',
        'core:space:Space',
        project._id,
        { $inc: { sequence: 1 } },
        true
      )
    )
    if (inc?.object?.sequence != null) {
      project.sequence = inc.object.sequence
      return inc.object.sequence
    }
    const again = await huly.findOne('tracker:class:Project', { _id: project._id })
    project.sequence = again?.sequence ?? (project.sequence ?? 0) + 1
    return project.sequence
  }

  const summary = { companies: 0, clients: 0, projects: 0, issues: 0, skipped: 0 }

  for (const c of clients) {
    const orgName = (c.organization || c.name || 'Company').trim()
    let org = await huly.findOne('contact:class:Organization', { aneerequestId: c.id })
    if (org === undefined) {
      org = (await huly.findAll('contact:class:Organization', { name: orgName }, { limit: 5 })).find(
        (o) => o.name === orgName
      )
    }
    if (org === undefined) {
      const orgId = genId()
      await huly.tx(
        createTx(
          accountId,
          'contact:class:Organization',
          'contact:space:Contacts',
          {
            name: orgName,
            city: '',
            avatarType: 'color',
            description: null,
            aneerequestId: c.id
          },
          orgId
        )
      )
      if (c.email) {
        await huly.tx(
          createTx(
            accountId,
            'contact:class:Channel',
            'contact:space:Contacts',
            { value: c.email, provider: 'contact:channelProvider:Email' },
            genId(),
            { attachedTo: orgId, attachedToClass: 'contact:class:Organization', collection: 'channels' }
          )
        )
      }
      if (c.phone) {
        await huly.tx(
          createTx(
            accountId,
            'contact:class:Channel',
            'contact:space:Contacts',
            { value: String(c.phone), provider: 'contact:channelProvider:Phone' },
            genId(),
            { attachedTo: orgId, attachedToClass: 'contact:class:Organization', collection: 'channels' }
          )
        )
      }
      org = { _id: orgId, name: orgName }
      summary.companies++
      console.log('org+', orgName)
    } else {
      if (org.aneerequestId !== c.id) {
        await huly.tx(
          updateTx(
            accountId,
            'contact:class:Organization',
            'contact:space:Contacts',
            org._id,
            { aneerequestId: c.id }
          )
        )
      }
      summary.skipped++
    }

    const existingClient = (
      await huly.findAll('tracker:class:Client', { attachedTo: org._id, space: ecom._id }, { limit: 1 })
    )[0]
    if (existingClient === undefined && clientKind !== undefined && clientStatus !== undefined) {
      const number = await nextSequence(clientSeq)
      await huly.tx(
        createTx(
          accountId,
          'tracker:class:Client',
          ecom._id,
          {
            status: clientStatus,
            number,
            identifier: `CLIENT-${number}`,
            title: orgName,
            kind: clientKind._id,
            rank: '',
            assignee: null,
            startDate: null,
            dueDate: null
          },
          genId(),
          { attachedTo: org._id, attachedToClass: 'contact:class:Organization', collection: 'clients' }
        )
      )
      summary.clients++
    }

    const orgRequests = requests.filter((r) => r.client_id === c.id)
    for (const r of orgRequests) {
      let project = await huly.findOne('tracker:class:Project', { aneerequestId: r.id })
      if (project === undefined) {
        const identifier = slugId(r.title, r.id)
        const taken = await huly.findOne('tracker:class:Project', { identifier })
        const ident = taken ? `${identifier}${String(r.id).slice(0, 3).toUpperCase()}` : identifier
        const projectId = genId()
        await huly.tx(
          createTx(
            accountId,
            'tracker:class:Project',
            'core:space:Space',
            {
              name: r.title || ident,
              description: r.description ?? '',
              private: false,
              archived: false,
              members: memberUuids,
              owners: memberUuids,
              autoJoin: true,
              identifier: ident,
              sequence: 0,
              icon: 'tracker:icon:Home',
              defaultIssueStatus: pickStatus(issueStatuses, r.status),
              defaultTimeReportDay: 1,
              type: classic._id,
              company: org._id,
              aneerequestId: r.id
            },
            projectId
          )
        )
        if (classic.targetClass) {
          await huly.tx({
            _id: genId(),
            _class: 'core:class:TxMixin',
            space: 'core:space:Tx',
            objectId: projectId,
            objectClass: 'tracker:class:Project',
            objectSpace: 'core:space:Space',
            mixin: classic.targetClass,
            attributes: {},
            modifiedOn: Date.now(),
            modifiedBy: accountId,
            createdBy: accountId
          })
        }
        project = { _id: projectId, identifier: ident, sequence: 0 }
        summary.projects++
        console.log('project+', ident, r.title)
      } else {
        await ensureProjectMembers(huly, accountId, project, memberUuids)
        summary.skipped++
      }

      const requestTaskIds = new Set(
        links.filter((l) => l.request_id === r.id).map((l) => l.task_id)
      )
      const linkedTasks = tasks.filter(
        (t) => requestTaskIds.has(t.id) || t.request_id === r.id
      )
      for (const t of linkedTasks) {
        const existingIssue = (
          await huly.findAll(
            'tracker:class:Issue',
            { space: project._id, title: t.title },
            { limit: 1 }
          )
        )[0]
        if (existingIssue !== undefined) {
          summary.skipped++
          continue
        }
        const number = await nextProjectNumber(project)
        const identifier = `${project.identifier}-${number}`
        await huly.tx(
          createTx(
            accountId,
            'tracker:class:Issue',
            project._id,
            {
              title: t.title,
              description: null,
              assignee: null,
              component: null,
              milestone: null,
              number,
              status: pickStatus(issueStatuses, t.status),
              priority: mapPriority(t.priority),
              rank: '',
              comments: 0,
              subIssues: 0,
              startDate: null,
              dueDate: t.due_date ? Date.parse(t.due_date) : null,
              parents: [],
              reportedTime: 0,
              remainingTime: 0,
              estimation: 0,
              reports: 0,
              relations: [],
              childInfo: [],
              kind: issueKind._id,
              identifier
            },
            genId(),
            {
              attachedTo: 'tracker:ids:NoParent',
              attachedToClass: 'tracker:class:Issue',
              collection: 'subIssues'
            }
          )
        )
        summary.issues++
      }
    }
  }

  console.log('\nImport complete:', summary)
  await backfillCompanyProjectMembers(huly, accountId, memberUuids)

  if (statusFilter !== 'all') {
    const extra = allClients.filter((c) => !keepIds.has(c.id))
    let removed = { orgs: 0, clients: 0, projects: 0, issues: 0 }
    for (const c of extra) {
      const org = await huly.findOne('contact:class:Organization', { aneerequestId: c.id })
      if (org === undefined) continue
      const extraReqs = allRequests.filter((r) => r.client_id === c.id)
      const byCompany = await huly.findAll('tracker:class:Project', { company: org._id })
      const byReq = []
      for (const r of extraReqs) {
        const p = await huly.findOne('tracker:class:Project', { aneerequestId: r.id })
        if (p !== undefined) byReq.push(p)
      }
      const seen = new Set()
      const projects = [...byCompany, ...byReq].filter((p) => {
        if (seen.has(p._id)) return false
        seen.add(p._id)
        return true
      })
      for (const project of projects) {
        const projectIssues = await huly.findAll('tracker:class:Issue', { space: project._id })
        for (const issue of projectIssues) {
          await huly.tx(
            removeTx(accountId, 'tracker:class:Issue', project._id, issue._id, {
              attachedTo: issue.attachedTo ?? 'tracker:ids:NoParent',
              attachedToClass: 'tracker:class:Issue',
              collection: 'subIssues'
            })
          )
          removed.issues++
        }
        await huly.tx(removeTx(accountId, 'tracker:class:Project', 'core:space:Space', project._id))
        removed.projects++
      }
      const funnelClients = await huly.findAll('tracker:class:Client', { attachedTo: org._id })
      for (const cl of funnelClients) {
        await huly.tx(
          removeTx(accountId, 'tracker:class:Client', cl.space, cl._id, {
            attachedTo: org._id,
            attachedToClass: 'contact:class:Organization',
            collection: 'clients'
          })
        )
        removed.clients++
      }
      const channels = await huly.findAll('contact:class:Channel', { attachedTo: org._id })
      for (const ch of channels) {
        await huly.tx(
          removeTx(accountId, 'contact:class:Channel', ch.space ?? 'contact:space:Contacts', ch._id, {
            attachedTo: org._id,
            attachedToClass: 'contact:class:Organization',
            collection: 'channels'
          })
        )
      }
      await huly.tx(removeTx(accountId, 'contact:class:Organization', 'contact:space:Contacts', org._id))
      removed.orgs++
      console.log('removed extra', c.status, org.name)
    }
    console.log('Cleanup non-Ongoing import:', removed)
  }

  console.log('\n=== Huly vs AneeRequest (imported set) ===')
  for (const c of clients) {
    const org = await huly.findOne('contact:class:Organization', { aneerequestId: c.id })
    const orgName = (c.organization || c.name || '').trim()
    const reqs = requests.filter((r) => r.client_id === c.id)
    if (org === undefined) {
      console.log(`MISSING ${orgName}`)
      continue
    }
    const hulyProjects = await huly.findAll('tracker:class:Project', { company: org._id })
    const issueParts = []
    for (const p of hulyProjects) {
      const iss = await huly.findAll('tracker:class:Issue', { space: p._id })
      issueParts.push(`${p.name} (${iss.length}: ${iss.map((i) => i.title).join('; ')})`)
    }
    console.log(
      `${orgName}: AR requests=${reqs.length} Huly projects=${hulyProjects.length} | ${issueParts.join(' || ') || '(none)'}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
