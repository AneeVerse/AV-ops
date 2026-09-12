/**
 * Smoke-test ImageKit upload + delete using env from .env.local
 * Run: node scripts/smoke-imagekit.js
 */
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

async function main() {
  const env = { ...process.env, ...loadEnv(path.join(__dirname, '..', '.env.local')) }
  const privateKey = env.IMAGEKIT_PRIVATE_KEY
  const endpoint = (env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '')
  if (!privateKey || !endpoint) throw new Error('Missing ImageKit env')

  // 1x1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )

  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png')
  form.append('fileName', `smoke-${Date.now()}.png`)
  form.append('folder', '/generated-posts')
  form.append('useUniqueFileName', 'true')

  const auth = Buffer.from(privateKey + ':').toString('base64')
  const upRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  })
  const upText = await upRes.text()
  if (!upRes.ok) throw new Error('Upload failed: ' + upText)
  const uploaded = JSON.parse(upText)
  console.log('UPLOAD_OK', uploaded.url)
  if (!String(uploaded.url).startsWith(endpoint)) {
    throw new Error('URL does not match endpoint: ' + uploaded.url)
  }

  // data-url finalize simulation
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const form2 = new FormData()
  form2.append('file', dataUrl)
  form2.append('fileName', `smoke-data-${Date.now()}.png`)
  form2.append('folder', '/brand-logos')
  form2.append('useUniqueFileName', 'true')
  const up2 = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form2,
  })
  const up2Json = JSON.parse(await up2.text())
  if (!up2.ok) throw new Error('Data URL upload failed')
  console.log('DATAURL_UPLOAD_OK', up2Json.url)

  for (const fileId of [uploaded.fileId, up2Json.fileId].filter(Boolean)) {
    const del = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}` },
    })
    console.log('DELETE', fileId, del.status)
  }

  console.log('SMOKE_PASS')
}

main().catch((e) => {
  console.error('SMOKE_FAIL', e.message || e)
  process.exit(1)
})
