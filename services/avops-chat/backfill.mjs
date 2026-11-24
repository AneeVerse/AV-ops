import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const vault = '/opt/av_ops/docker/obsidian/obsidian/Chat/Spaces'
const operate = 'spaces/AAQAOk6L6k8'

function mcp (name, args) {
  const child = spawn('node', ['/opt/av_ops/docker/avops-mcp/server.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] })
  const id = 1
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mcp timeout')), 30000)
    let buf = ''
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      for (const line of buf.split('\n')) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (msg.id !== id) continue
          clearTimeout(timer)
          child.kill()
          const text = msg.result?.content?.[0]?.text || '{}'
          resolve(JSON.parse(text))
        } catch { /* wait */ }
      }
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) + '\n')
  })
}

async function userHeaders () {
  const oauth = JSON.parse(fs.readFileSync('/opt/av_ops/docker/avops-chat/oauth.json', 'utf8'))
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
  if (!body.access_token) throw new Error('chat read token refresh failed')
  return { authorization: `Bearer ${body.access_token}` }
}

async function countMessages (headers, space) {
  let pageToken = ''
  let count = 0
  let latest = null
  let pages = 0
  while (pages < 8) {
    const url = new URL(`https://chat.googleapis.com/v1/${space}/messages`)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { count, pages, latest, complete: false, error: String(body.error?.message || res.status).slice(0, 180) }
    }
    const messages = body.messages || []
    count += messages.length
    if (!latest && messages[0]?.createTime) latest = messages[0].createTime
    pageToken = body.nextPageToken || ''
    pages += 1
    if (!pageToken) return { count, pages, latest, complete: true, error: null }
  }
  return { count, pages, latest, complete: false, error: 'stopped at page cap' }
}

const child = spawn('node', ['/opt/av_ops/docker/avops-chat/server.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] })
const spacesMsg = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('chat timeout')), 30000)
  child.stdout.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (!line.trim()) continue
      const msg = JSON.parse(line)
      if (msg.id !== 7) continue
      clearTimeout(timer)
      child.kill()
      resolve(JSON.parse(msg.result.content[0].text))
    }
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_app_spaces', arguments: {} } }) + '\n')
})

const headers = await userHeaders()
const rows = []
for (const space of spacesMsg.spaces || []) {
  const counted = await countMessages(headers, space.name)
  rows.push({ ...space, ...counted })
}
const people = await mcp('search_people', { query: 'Anees', limit: 5 }).catch((error) => ({ error: error.message, items: [] }))
fs.mkdirSync(vault, { recursive: true })
const checkpoint = {
  at: new Date().toISOString(),
  account_note: 'Refresh token is the existing anees@aneeverse.com Chat read grant. userinfo is unauthorized because that grant has chat.messages.readonly only.',
  spaces: rows.map((row) => ({
    name: row.name,
    display_name: row.display_name || row.type,
    type: row.type,
    operate: row.operate === true,
    message_count: row.count,
    pages: row.pages,
    complete: row.complete,
    latest: row.latest,
    error: row.error,
    tickets: row.name === operate ? 'new requests in this space may become tickets' : 'not creating tickets from this space'
  }))
}
fs.writeFileSync(path.join(vault, 'checkpoints.json'), JSON.stringify(checkpoint, null, 2) + '\n')
const lines = [
  '# Google Chat spaces Hermes can see',
  '',
  `Checked: ${checkpoint.at}`,
  '',
  'The Chat app is a member of the spaces below. spaces.list on the user token is blocked because the granted scope is chat.messages.readonly, so this is not a full company directory.',
  '',
  '| Space | Type | Messages scanned | Complete | Latest | Tickets |',
  '|---|---|---:|---|---|---|',
  ...rows.map((row) => `| ${row.display_name || row.name} | ${row.type} | ${row.count} | ${row.complete} | ${row.latest || ''} | ${row.name === operate ? 'yes, new work only' : 'no'} |`),
  '',
  '## People',
  '',
  '- Mayur Karve in the Hermes test space maps to Huly person 6a83ff1cfcafa62b1a4854b7. That link was confirmed by the private Chat viewer name and get_person_work. The Huly display name is k,Mayur. Do not match other Mayur names to this id.',
  `- Anees search returned_count: ${people.returned_count ?? people.items?.length ?? 0}.`,
  ...((people.items || []).map((item) => `- Huly person ${item.id} name ${item.name}`)),
  '',
  'Member emails from the Chat bot are often blank. Do not invent an email.',
  ''
]
fs.writeFileSync(path.join(vault, 'registry.md'), lines.join('\n'))
console.log(JSON.stringify({
  space_count: rows.length,
  spaces: rows.map((row) => ({
    name: row.display_name || row.type,
    id: row.name,
    count: row.count,
    complete: row.complete,
    operate: row.operate === true,
    error: row.error
  })),
  anees_matches: (people.items || []).map((item) => item.name)
}, null, 2))
