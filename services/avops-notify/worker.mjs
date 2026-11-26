/**
 * Staff Chat worker. Polls Huly and posts through services/avops-chat.
 * The in-app "assigned to you" notice is AssigneeNotification in models/tracker.
 * This worker does not know whether the notification pod is running, so it does not claim the inbox delivered.
 * It never uses the Novino gateway or the Calendar OAuth token.
 * If Anees has not approved the Chat app, space creation logs SKIP and creates nothing.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { assignText, reminderDue, rollupBody, rollupDue, staffEmail } from './rules.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const chatDir = path.resolve(root, '../avops-chat')
const orgSpacesFile = path.join(chatDir, 'org-spaces.json')
const cursorFile = path.join(root, 'cursor.json')
const WON = 'task:statusCategory:Won'
const LOST = 'task:statusCategory:Lost'
const require = createRequire(fileURLToPath(new URL('../avops-mcp/package.json', import.meta.url)))
const WebSocket = require('ws')
const { Packr } = require('msgpackr')
const packr = new Packr({ structuredClone: true, bundleStrings: true, copyBuffers: false })

function log (event, extra = {}) {
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), event, ...extra }) + '\n')
}

function loadEnv () {
  for (const file of [path.join(root, '.env'), path.join(chatDir, '.env')]) {
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (process.env[key] == null || process.env[key] === '') process.env[key] = value
    }
  }
}

function generateId () {
  return ((Date.now() / 1000) | 0).toString(16).padStart(8, '0') + crypto.randomBytes(8).toString('hex')
}

class Huly {
  constructor () {
    this.ws = null
    this.binary = false
    this.seq = 1
    this.pending = new Map()
    this.actor = null
  }

  async connect () {
    const token = process.env.AVOPS_NOTIFY_TOKEN || process.env.HULY_READ_TOKEN
    const endpoint = (process.env.HULY_TRANSACTOR_URL || 'ws://127.0.0.1:8087').replace(/\/$/, '')
    if (!token) throw new Error('AVOPS_NOTIFY_TOKEN is not configured')
    this.ws = new WebSocket(`${endpoint}/${token}?sessionId=${crypto.randomUUID()}`)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('transactor connect timeout')), 8000)
      this.ws.once('open', () => { clearTimeout(timer); resolve() })
      this.ws.once('error', () => { clearTimeout(timer); reject(new Error('transactor websocket failed')) })
    })
    this.ws.on('message', (data) => this.onMessage(data))
    const hello = await this.requestRaw(-1, { method: 'hello', params: [], id: -1, binary: false, compression: false, time: Date.now() })
    this.binary = hello?.binary === true
  }

  onMessage (data) {
    let message
    try {
      message = this.binary ? packr.unpack(data) : JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : String(data))
    } catch { return }
    const waiter = message?.id != null ? this.pending.get(message.id) : undefined
    if (!waiter) return
    clearTimeout(waiter.timer)
    this.pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message || 'transactor request failed'))
    else waiter.resolve(message.id === -1 ? message : message.result)
  }

  requestRaw (id, body) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('transactor timeout')) }, 20000)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify(body))
    })
  }

  request (method, params) {
    const id = this.seq++
    const body = { method, params, id, time: Date.now() }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('transactor timeout')) }, 20000)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(this.binary ? packr.pack(body) : JSON.stringify(body))
    })
  }

  async findAll (className, query = {}) {
    const rows = []
    const seen = new Set()
    let before = null
    for (let page = 0; page < 40; page++) {
      const next = { ...query }
      if (before != null) next.modifiedOn = { $lt: before }
      const result = await this.request('findAll', [className, next, { limit: 200, sort: { modifiedOn: -1 } }])
      const batch = Array.isArray(result?.value) ? result.value : Array.isArray(result) ? result : []
      if (batch.length === 0) break
      for (const row of batch) {
        if (row?._id && !seen.has(row._id)) {
          seen.add(row._id)
          rows.push(row)
        }
      }
      const oldest = batch[batch.length - 1]?.modifiedOn
      if (batch.length < 200 || oldest == null || oldest === before) break
      before = oldest
    }
    return rows
  }

  async actorOf () {
    if (this.actor) return this.actor
    const token = process.env.AVOPS_NOTIFY_TOKEN || process.env.HULY_READ_TOKEN
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    const people = await this.findAll('contact:class:Person', { personUuid: claims.account })
    const person = people[0]
    if (!person?._id) throw new Error('token person was not found')
    const socials = await this.findAll('contact:class:SocialIdentity', { attachedTo: person._id })
    const social = socials.find((row) => row?._id)
    if (!social) throw new Error('token social identity was not found')
    this.actor = { social_id: social._id, person_id: person._id }
    return this.actor
  }

  async update (objectId, objectClass, objectSpace, operations) {
    const actor = await this.actorOf()
    const now = Date.now()
    await this.request('tx', [{
      _id: generateId(),
      _class: 'core:class:TxUpdateDoc',
      space: 'core:space:Tx',
      modifiedOn: now,
      modifiedBy: actor.social_id,
      createdBy: actor.social_id,
      objectId,
      objectClass,
      objectSpace,
      operations
    }])
  }

  close () {
    this.ws?.close()
  }
}

class Chat {
  constructor () {
    this.child = spawn(process.execPath, [path.join(chatDir, 'server.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.buf = ''
    this.waiters = []
    this.seq = 1
    this.child.stdout.on('data', (chunk) => {
      this.buf += chunk.toString('utf8')
      let nl = this.buf.indexOf('\n')
      while (nl >= 0) {
        const line = this.buf.slice(0, nl).trim()
        this.buf = this.buf.slice(nl + 1)
        if (line) {
          const waiter = this.waiters.shift()
          if (waiter) waiter.resolve(JSON.parse(line))
        }
        nl = this.buf.indexOf('\n')
      }
    })
  }

  request (method, params) {
    const id = this.seq++
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('chat helper timeout')), 20000)
      this.waiters.push({
        resolve: (message) => { clearTimeout(timer); resolve(message) },
        reject
      })
    })
  }

  async call (name, args) {
    if (this.seq === 1) await this.request('initialize', {})
    const response = await this.request('tools/call', { name, arguments: args })
    const text = response?.result?.content?.[0]?.text || ''
    if (response?.result?.isError) throw new Error(text || 'chat helper failed')
    return text ? JSON.parse(text) : {}
  }

  close () {
    this.child.kill()
  }
}

function emailOf (person, channels) {
  const values = channels.filter((channel) => channel.attachedTo === person._id).map((channel) => channel.value)
  return values.map(staffEmail).find(Boolean) || ''
}

function isGuest (person) {
  const mixin = person?.['contact:mixin:Employee']
  return person?.role === 'GUEST' || mixin?.role === 'GUEST'
}

function doneStatus (status) {
  return status?.category === WON || status?.category === LOST || /won|lost|done|cancel/i.test(status?.name || '')
}

async function run () {
  loadEnv()
  const huly = new Huly()
  const chat = new Chat()
  const now = Date.now()
  try {
    await huly.connect()
    const orgs = await huly.findAll('contact:class:Organization')
    const projects = await huly.findAll('tracker:class:Project')
    const issues = await huly.findAll('tracker:class:Issue')
    const people = await huly.findAll('contact:class:Person')
    const channels = await huly.findAll('contact:class:Channel')
    const socials = await huly.findAll('contact:class:SocialIdentity')
    const statuses = await huly.findAll('tracker:class:IssueStatus')
    const personById = new Map(people.map((person) => [person._id, person]))
    const personByUuid = new Map(people.filter((person) => person.personUuid).map((person) => [person.personUuid, person]))
    const socialsByPerson = new Map()
    for (const social of socials) {
      const list = socialsByPerson.get(social.attachedTo) || []
      list.push(social._id)
      socialsByPerson.set(social.attachedTo, list)
    }
    const statusById = new Map(statuses.map((status) => [status._id, status]))
    const projectById = new Map(projects.map((project) => [project._id, project]))
    const orgById = new Map(orgs.map((org) => [org._id, org]))

    const owner = (process.env.AVOPS_NOTIFY_OWNER || 'anees@aneeverse.com').toLowerCase()
    for (const org of orgs) {
      if (!org.chatSpaceRequested || org.chatSpace) continue
      const related = projects.filter((project) => project.company === org._id)
      const emails = new Set([owner])
      for (const project of related) {
        for (const uuid of project.members || []) {
          const person = personByUuid.get(uuid)
          if (!person || isGuest(person)) continue
          const email = emailOf(person, channels)
          if (email) emails.add(email)
        }
      }
      const members = [owner, ...[...emails].filter((email) => email !== owner)].slice(0, 8)
      try {
        const created = await chat.call('create_space', {
          requester: owner,
          display_name: org.name,
          members
        })
        if (created.collision) {
          log('SKIP', { org: org._id, reason: 'name collision', matches: (created.matches || []).map((row) => row.display_name || row.name) })
          continue
        }
        if (!created.space) {
          log('SKIP', { org: org._id, reason: 'space was not created' })
          continue
        }
        await huly.update(org._id, 'contact:class:Organization', org.space || 'contact:space:Contacts', {
          chatSpace: created.space,
          chatSpaceName: created.display_name || org.name,
          chatSpaceRequested: false
        })
        org.chatSpace = created.space
        org.chatSpaceName = created.display_name || org.name
        log('space-created', { org: org._id, space: created.space })
      } catch (error) {
        log('SKIP', { org: org._id, reason: String(error.message || error).slice(0, 240) })
      }
    }

    const spaces = [...new Set(orgs.map((org) => org.chatSpace).filter((id) => typeof id === 'string' && id.startsWith('spaces/')))]
    fs.writeFileSync(orgSpacesFile, JSON.stringify(spaces, null, 2) + '\n')

    const skips = new Map()
    for (const issue of issues) {
      if (!issue.assignee || issue.chatAssignMessage) continue
      const project = projectById.get(issue.space)
      const org = project ? orgById.get(project.company) : undefined
      if (!org?.chatSpace) {
        skips.set('no staff chat space', (skips.get('no staff chat space') || 0) + 1)
        continue
      }
      const person = personById.get(issue.assignee)
      if (!person || isGuest(person)) {
        skips.set('guest is not mentioned', (skips.get('guest is not mentioned') || 0) + 1)
        continue
      }
      const email = emailOf(person, channels)
      if (!email) {
        skips.set('assignee has no aneeverse email', (skips.get('assignee has no aneeverse email') || 0) + 1)
        continue
      }
      try {
        const sent = await chat.call('send_message', {
          space: org.chatSpace,
          text: assignText({ ...issue, title: issue.title, dueDate: issue.dueDate, identifier: issue.identifier }),
          mention: email
        })
        await huly.update(issue._id, 'tracker:class:Issue', issue.space, { chatAssignMessage: sent.message_id || 'sent' })
        issue.chatAssignMessage = sent.message_id || 'sent'
        log('assigned', { issue: issue._id, space: org.chatSpace })
      } catch (error) {
        log('SKIP', { issue: issue._id, reason: String(error.message || error).slice(0, 240) })
      }
    }
    for (const [reason, count] of skips) log('SKIP', { reason, count })

    const comments = await huly.findAll('chunter:class:ChatMessage')
    for (const issue of issues) {
      if (!issue.assignee || !issue.assignedAt) continue
      const assigneeSocials = new Set(socialsByPerson.get(issue.assignee) || [])
      const own = comments.filter((comment) => comment.attachedTo === issue._id && comment.createdOn > issue.assignedAt)
      const updated = own.some((comment) => assigneeSocials.has(comment.createdBy) && comment.reminder !== true && !String(comment.message || '').startsWith('<p>Reminder:'))
      if (updated && (issue.assigneeUpdatedOn == null || issue.assigneeUpdatedOn < issue.assignedAt)) {
        const stamp = now
        await huly.update(issue._id, 'tracker:class:Issue', issue.space, { assigneeUpdatedOn: stamp })
        issue.assigneeUpdatedOn = stamp
      }
      const view = {
        estimation: issue.estimation,
        assignee: issue.assignee,
        assignedAt: issue.assignedAt,
        assigneeUpdatedOn: issue.assigneeUpdatedOn,
        lastRemindedOn: issue.lastRemindedOn,
        reminderDay: issue.reminderDay,
        reminderCount: issue.reminderCount,
        done: issue.isDone === true || doneStatus(statusById.get(issue.status))
      }
      if (!reminderDue(view, now)) continue
      const project = projectById.get(issue.space)
      const org = project ? orgById.get(project.company) : undefined
      const person = personById.get(issue.assignee)
      const email = person && !isGuest(person) ? emailOf(person, channels) : ''
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
      const count = issue.reminderDay === day ? Number(issue.reminderCount) || 0 : 0
      if (org?.chatSpace && email) {
        try {
          await chat.call('send_message', {
            space: org.chatSpace,
            text: `Reminder: ${issue.identifier || issue._id} ${issue.title || ''} still needs a status update.`,
            mention: email
          })
        } catch (error) {
          log('SKIP', { issue: issue._id, reason: String(error.message || error).slice(0, 240) })
          continue
        }
      }
      const actor = await huly.actorOf()
      const commentId = generateId()
      await huly.request('tx', [{
        _id: commentId,
        _class: 'core:class:TxCreateDoc',
        space: 'core:space:Tx',
        modifiedOn: now,
        modifiedBy: actor.social_id,
        createdBy: actor.social_id,
        objectId: commentId,
        objectClass: 'chunter:class:ChatMessage',
        objectSpace: issue.space,
        collection: 'comments',
        attachedTo: issue._id,
        attachedToClass: 'tracker:class:Issue',
        attributes: { message: `<p>Reminder: ${issue.identifier || ''} still needs a status update.</p>`, attachments: 0, reminder: true }
      }])
      await huly.update(issue._id, 'tracker:class:Issue', issue.space, {
        lastRemindedOn: now,
        reminderDay: day,
        reminderCount: count + 1,
        comments: (Number(issue.comments) || 0) + 1
      })
      log('reminded', { issue: issue._id })
    }

    for (const org of orgs) {
      if (!org.chatSpace || !rollupDue(now, org.lastRollupOn)) continue
      const projectIds = new Set(projects.filter((project) => project.company === org._id).map((project) => project._id))
      const rows = issues.filter((issue) => projectIds.has(issue.space)).map((issue) => {
        const person = personById.get(issue.assignee)
        return {
          done: issue.isDone === true || doneStatus(statusById.get(issue.status)),
          dueDate: issue.dueDate,
          modifiedOn: issue.modifiedOn,
          identifier: issue.identifier,
          title: issue.title,
          assigneeEmail: person && !isGuest(person) ? emailOf(person, channels) : ''
        }
      })
      const open = rows.filter((row) => !row.done)
      if (open.length === 0) {
        log('SKIP', { org: org._id, reason: 'no open work' })
        continue
      }
      const mentions = [...new Set(open.map((row) => row.assigneeEmail).filter(Boolean))]
      try {
        await chat.call('send_message', {
          space: org.chatSpace,
          text: rollupBody(org.name, rows, now),
          mentions
        })
        await huly.update(org._id, 'contact:class:Organization', org.space || 'contact:space:Contacts', { lastRollupOn: now })
        log('rollup', { org: org._id })
      } catch (error) {
        log('SKIP', { org: org._id, reason: String(error.message || error).slice(0, 240) })
      }
    }
    fs.writeFileSync(cursorFile, JSON.stringify({ at: now }) + '\n')
  } finally {
    chat.close()
    huly.close()
  }
}

run().catch((error) => {
  log('SKIP', { reason: String(error.message || error).slice(0, 240) })
  process.exitCode = 0
})
