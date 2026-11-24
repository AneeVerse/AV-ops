import fs from 'node:fs'

const root = '/opt/av_ops/docker/avops-chat'
const oauth = JSON.parse(fs.readFileSync(root + '/oauth.json', 'utf8'))
const operate = JSON.parse(fs.readFileSync(root + '/operate.json', 'utf8'))
const checkpointFile = JSON.parse(fs.readFileSync('/opt/av_ops/docker/obsidian/obsidian/Chat/Spaces/checkpoints.json', 'utf8'))
const ids = Array.isArray(operate) ? operate : (operate.spaces || [])
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

async function getJson (url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + tokenBody.access_token } })
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
      continue
    }
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  }
  return { status: 0, body: {} }
}

const failed = []
let bot = 0
let history = 0
let checkpoint = 0
for (const id of ids) {
  const members = await getJson(`https://chat.googleapis.com/v1/${id}/members?pageSize=100`)
  const botPresent = (members.body.memberships || []).some((row) => row.member?.type === 'BOT')
  if (members.status === 200 && botPresent) bot += 1
  else failed.push({ space: id, step: 'membership', status: members.status, bot: botPresent })
  const messages = await getJson(`https://chat.googleapis.com/v1/${id}/messages?pageSize=1`)
  if (messages.status === 200) history += 1
  else failed.push({ space: id, step: 'history', status: messages.status })
  if (checkpointFile.spaces?.[id]?.complete === true) checkpoint += 1
  else failed.push({ space: id, step: 'checkpoint', status: 0 })
  await new Promise((resolve) => setTimeout(resolve, 80))
}

console.log(JSON.stringify({
  operate: ids.length,
  bot_membership: bot,
  history_ok: history,
  checkpoint_complete: checkpoint,
  failed_count: failed.length,
  failed
}, null, 2))
