import fs from 'node:fs'

const oauth = JSON.parse(fs.readFileSync('/opt/av_ops/docker/avops-chat/oauth.json', 'utf8'))
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
if (!tokenBody.access_token) {
  console.log(JSON.stringify({ refresh: false, error: tokenBody.error || tokenRes.status }))
  process.exit(1)
}
const infoRes = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(tokenBody.access_token))
const info = await infoRes.json()
console.log(JSON.stringify({
  refresh: true,
  email: info.email || null,
  scopes: String(info.scope || '').split(' ').filter(Boolean),
  audience_tail: String(info.aud || '').slice(-12),
  expires_in: info.expires_in || null
}, null, 2))
console.log('CLIENT_ID=' + oauth.client_id)
