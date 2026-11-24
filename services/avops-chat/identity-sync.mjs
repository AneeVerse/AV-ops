import fs from 'node:fs'

const root = '/opt/av_ops/docker/avops-chat'
const oauth = JSON.parse(fs.readFileSync(root + '/oauth.json', 'utf8'))
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: oauth.client_id,
    client_secret: oauth.client_secret,
    refresh_token: oauth.refresh_token,
    grant_type: 'refresh_token'
  })
})
const tokenBody = await tokenRes.json()
if (!tokenBody.access_token) throw new Error('refresh failed')
const peoplePath = root + '/people.json'
const people = JSON.parse(fs.readFileSync(peoplePath, 'utf8'))
const operate = JSON.parse(fs.readFileSync(root + '/operate.json', 'utf8'))
const spaces = Array.isArray(operate.spaces) ? operate.spaces : operate
const found = new Map()
let spacesRead = 0
let spacesFailed = 0
for (const space of spaces) {
  let pageToken = ''
  let ok = false
  let tries = 0
  do {
    const url = new URL(`https://chat.googleapis.com/v1/${space}/members`)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + tokenBody.access_token } })
    if (res.status === 429 || res.status >= 500) {
      tries += 1
      if (tries > 4) break
      await new Promise((resolve) => setTimeout(resolve, 800 * tries))
      continue
    }
    const body = await res.json()
    if (!res.ok) break
    ok = true
    tries = 0
    for (const row of body.memberships || []) {
      const member = row.member || {}
      if (member.type !== 'HUMAN' || !member.email || !member.name) continue
      const email = member.email.toLowerCase()
      if (!found.has(email)) found.set(email, { email, user: member.name, name: member.displayName || '' })
    }
    pageToken = body.nextPageToken || ''
  } while (pageToken)
  if (ok) spacesRead += 1
  else spacesFailed += 1
  await new Promise((resolve) => setTimeout(resolve, 60))
}
let mapped = 0
for (const row of found.values()) {
  if (!people[row.email] || typeof people[row.email] !== 'object') continue
  people[row.email].chat_user = row.user
  people[row.email].chat_names = [...new Set([...(people[row.email].chat_names || []), row.name].filter(Boolean))]
  mapped += 1
}
fs.writeFileSync(peoplePath, JSON.stringify(people, null, 2) + '\n')
const known = new Set(Object.keys(people).filter((key) => key.includes('@')))
const unmapped = [...found.values()].filter((row) => !known.has(row.email))
fs.writeFileSync(root + '/identity-map.json', JSON.stringify({
  at: new Date().toISOString(),
  spaces_read: spacesRead,
  spaces_failed: spacesFailed,
  humans: found.size,
  mapped_records: mapped,
  unmapped_count: unmapped.length,
  unmapped: unmapped.map((row) => ({ email: row.email, user: row.user, name: row.name }))
}, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ spaces_read: spacesRead, spaces_failed: spacesFailed, humans: found.size, mapped, unmapped: unmapped.length }))
