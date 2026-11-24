import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const force = process.argv.includes('--force')
const stateFile = '/opt/av_ops/docker/avops-ops/state.json'
const vaultDir = '/opt/av_ops/docker/obsidian/obsidian/Chat/Reports'
const REPORT_SPACE = 'spaces/AAQAiYhvg_U'

function tool (script, name, args) {
  const child = spawn('node', [script], { stdio: ['pipe', 'pipe', 'pipe'] })
  const id = 1
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('timeout ' + name))
    }, 40000)
    let buf = ''
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.id !== id) continue
        clearTimeout(timer)
        child.kill()
        const text = msg.result?.content?.[0]?.text
        if (msg.result?.isError) reject(new Error(String(text || name + ' failed').slice(0, 240)))
        else resolve(JSON.parse(text))
      }
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) + '\n')
  })
}

const avops = (name, args) => tool('/opt/av_ops/docker/avops-mcp/server.mjs', name, args)
const chat = (name, args) => tool('/opt/av_ops/docker/avops-chat/server.mjs', name, args)

const day = new Date().toISOString().slice(0, 10)
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {}
const overdue = await avops('get_overdue_issues', { limit: 20 })
const unassigned = await avops('get_unassigned_issues', { limit: 20 })
const blocked = await avops('get_blocked_issues', { limit: 20 })
const open = await avops('list_issues', { open_only: true, limit: 20 })
const recent = await avops('list_issues', { open_only: false, limit: 20 })
const now = Date.now()
const week = now + 7 * 24 * 60 * 60 * 1000
const staleBefore = now - 7 * 24 * 60 * 60 * 1000
const soon = (open.items || []).filter((item) => item.due_date && item.due_date >= now && item.due_date <= week)
const stale = (open.items || []).filter((item) => !item.modified_on || item.modified_on < staleBefore)
const done = (recent.items || []).filter((item) => item.is_done === true)
const ids = (rows) => rows.map((item) => item.identifier).filter(Boolean)
const lines = [
  `# AV OPS daily ${day}`,
  '',
  'FACT counts come from the AV OPS MCP in this run. Overdue, unassigned, and blocked counts are returned_count from those tools. Deadline, stale, and completed lines are from the newest 20 issues in that scan, not a full census.',
  '',
  `## Overdue (${overdue.returned_count})`,
  ...(overdue.items || []).map((item) => `- ${item.identifier} — ${item.title} — ${item.status_name}`),
  '',
  `## Unassigned (${unassigned.returned_count})`,
  ...(unassigned.items || []).map((item) => `- ${item.identifier} — ${item.title} — ${item.status_name}`),
  '',
  `## Blocked (${blocked.returned_count})`,
  (blocked.items || []).length ? (blocked.items || []).map((item) => `- ${item.identifier} — ${item.title}`) : ['- None in the newest open issues scanned.'],
  '',
  `## Due within 7 days (${soon.length} of ${open.returned_count} newest open)`,
  soon.length ? soon.map((item) => `- ${item.identifier} — ${item.title}`) : ['- None in that scan.'],
  '',
  `## No update in 7 days (${stale.length} of ${open.returned_count} newest open)`,
  stale.length ? stale.map((item) => `- ${item.identifier} — ${item.title} — ${item.status_name}`) : ['- None in that scan.'],
  '',
  `## Completed in the newest 20 (${done.length})`,
  done.length ? done.map((item) => `- ${item.identifier} — ${item.title}`) : ['- None in that scan.'],
  '',
  '## Recommended actions',
  ...(overdue.items || []).slice(0, 8).map((item) => `- Ask the owner of ${item.identifier} for status.`),
  ...(unassigned.items || []).slice(0, 8).map((item) => `- Assign ${item.identifier}.`),
  (blocked.items || []).length ? (blocked.items || []).slice(0, 5).map((item) => `- Review the blocker on ${item.identifier}.`) : ['- No blocked issue was returned.'],
  '',
  'This report is posted only in AV-OPS. hermes test and ANEEVERSE were not used.',
  ''
].flat()
fs.mkdirSync(vaultDir, { recursive: true })
const note = path.join(vaultDir, `daily-${day}.md`)
fs.writeFileSync(note, lines.join('\n'))
const readBack = fs.readFileSync(note, 'utf8')
if (!readBack.includes(`Overdue (${overdue.returned_count})`)) throw new Error('report note was not saved')

const joined = await chat('list_app_spaces', {})
const reportSpace = (joined.spaces || []).find((item) => item.name === REPORT_SPACE)
if (!reportSpace) throw new Error('AV-OPS is not a Chat app space')
let chatResult = { skipped: true }
const alreadyPosted = state.last_chat_day === day && state.last_report_space === REPORT_SPACE
if (force || !alreadyPosted) {
  const clip = (list) => list.slice(0, 12).join(', ') || 'none'
  const text = [
    `AV OPS daily ${day}. Destination: AV-OPS.`,
    `Overdue ${overdue.returned_count}: ${clip(ids(overdue.items || []))}.`,
    `Unassigned ${unassigned.returned_count}: ${clip(ids(unassigned.items || []))}.`,
    `Blocked ${blocked.returned_count}: ${clip(ids(blocked.items || []))}.`,
    `Due within 7 days, from the newest ${open.returned_count} open: ${soon.length}.`,
    `No update in 7 days, from that same scan: ${stale.length}.`,
    `Completed in the newest 20: ${done.length}.`,
    'Next: assign unassigned work and ask owners of overdue items for status.',
    'hermes test and ANEEVERSE were not messaged.'
  ].join('\n')
  chatResult = await chat('send_message', { space: REPORT_SPACE, text: text.length > 1100 ? text.slice(0, 1100) : text })
  if (!chatResult.message_id || chatResult.space !== REPORT_SPACE) throw new Error('daily report was not sent to AV-OPS')
  state.last_chat_day = day
  state.last_report_space = REPORT_SPACE
  state.last_message_id = chatResult.message_id
}

let n8n = { skipped: true }
const hookFile = '/opt/av_ops/docker/avops-ops/webhook.url'
if (fs.existsSync(hookFile)) {
  const url = fs.readFileSync(hookFile, 'utf8').trim()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source_key: `daily:${day}`,
      overdue: overdue.returned_count,
      unassigned: unassigned.returned_count,
      blocked: blocked.returned_count
    }),
    signal: AbortSignal.timeout(20000)
  })
  const payload = await response.json().catch(() => null)
  n8n = { status: response.status, ok: payload?.ok === true, result: payload?.result || null }
  if (!n8n.ok) throw new Error('n8n report journal did not confirm')
}
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n')
console.log(JSON.stringify({
  day,
  note,
  overdue: overdue.returned_count,
  unassigned: unassigned.returned_count,
  blocked: blocked.returned_count,
  report_space: REPORT_SPACE,
  soon: soon.length,
  stale: stale.length,
  completed_in_newest_20: done.length,
  overdue_ids: ids(overdue.items || []),
  unassigned_ids: ids(unassigned.items || []),
  blocked_ids: ids(blocked.items || []),
  chat_space: chatResult.space || null,
  chat_message_id: chatResult.message_id || null,
  chat_skipped: Boolean(chatResult.skipped),
  n8n_ok: n8n.ok === true,
  n8n_result: n8n.result || null
}, null, 2))
