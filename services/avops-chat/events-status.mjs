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
const res = await fetch('https://workspaceevents.googleapis.com/v1/subscriptions', {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + tokenBody.access_token,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    targetResource: '//chat.googleapis.com/spaces/AAQAiYhvg_U',
    eventTypes: ['google.workspace.chat.message.v1.created'],
    notificationEndpoint: { pubsubTopic: 'projects/hermes-avops/topics/hermes-chat-events' },
    payloadOptions: { includeResource: false }
  })
})
const body = await res.json().catch(() => ({}))
const message = body.error?.message || body.error?.status || ''
console.log(JSON.stringify({
  status: res.status,
  created: Boolean(body.name),
  reason: String(message).slice(0, 400)
}))
