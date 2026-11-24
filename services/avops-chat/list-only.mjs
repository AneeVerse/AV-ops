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
const token = (await tokenRes.json()).access_token
async function list (admin) {
  const spaces = []
  let pageToken = ''
  let error = null
  let pages = 0
  while (pages < 20) {
    const url = new URL('https://chat.googleapis.com/v1/spaces')
    url.searchParams.set('pageSize', '100')
    if (admin) url.searchParams.set('useAdminAccess', 'true')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + token } })
    const body = await res.json()
    if (!res.ok) {
      error = String(body.error?.message || res.status).slice(0, 240)
      break
    }
    spaces.push(...(body.spaces || []))
    pageToken = body.nextPageToken || ''
    pages += 1
    if (!pageToken) break
  }
  return { count: spaces.length, pages, complete: !pageToken && !error, error, spaces }
}
const user = await list(false)
const admin = await list(true)
const view = (row) => ({
  id: row.name,
  name: row.displayName || row.spaceType || row.type || '',
  type: row.spaceType || row.type || '',
  external: row.externalUserAllowed === true
})
console.log(JSON.stringify({
  user_count: user.count,
  user_complete: user.complete,
  user_error: user.error,
  admin_count: admin.count,
  admin_complete: admin.complete,
  admin_error: admin.error,
  user_spaces: user.spaces.map(view),
  admin_only: admin.spaces.filter((row) => !user.spaces.some((item) => item.name === row.name)).map(view)
}, null, 2))
