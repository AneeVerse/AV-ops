/**
 * Additional smoke: ensureImageKit finalize path via @imagekit/nodejs (same as app).
 * Run: node --experimental-strip-types scripts/smoke-imagekit-lib.mts
 * Fallback uses dynamic import through next isn't available — use REST finalize check instead.
 */
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

async function main() {
  const env = { ...process.env, ...loadEnv(path.join(__dirname, '..', '.env.local')) }
  Object.assign(process.env, env)

  // Use the ImageKit REST path equivalent to ensureImageKitUrl(dataUrl)
  const privateKey = env.IMAGEKIT_PRIVATE_KEY
  const endpoint = env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '')
  const auth = Buffer.from(privateKey + ':').toString('base64')
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  // Simulate generate-bg finalize: upload data URL → expect ik.imagekit.io URL
  const form = new FormData()
  form.append('file', dataUrl)
  form.append('fileName', `finalize-smoke-${Date.now()}.png`)
  form.append('folder', '/generated-posts')
  form.append('useUniqueFileName', 'true')
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  })
  const json = JSON.parse(await res.text())
  if (!res.ok) throw new Error(JSON.stringify(json))
  if (!json.url.startsWith(endpoint)) throw new Error('bad url ' + json.url)
  console.log('FINALIZE_OK', json.url)

  await fetch(`https://api.imagekit.io/v1/files/${json.fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${auth}` },
  })

  // Brand logo folder
  const form2 = new FormData()
  form2.append('file', dataUrl)
  form2.append('fileName', `logo-smoke-${Date.now()}.png`)
  form2.append('folder', '/brand-logos')
  form2.append('useUniqueFileName', 'true')
  const res2 = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form2,
  })
  const json2 = JSON.parse(await res2.text())
  if (!res2.ok) throw new Error(JSON.stringify(json2))
  console.log('BRAND_LOGO_OK', json2.url)
  await fetch(`https://api.imagekit.io/v1/files/${json2.fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${auth}` },
  })

  // brand-setup-inputs folder
  const form3 = new FormData()
  form3.append('file', dataUrl)
  form3.append('fileName', `setup-smoke-${Date.now()}.png`)
  form3.append('folder', '/brand-setup-inputs/demo')
  form3.append('useUniqueFileName', 'true')
  const res3 = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form3,
  })
  const json3 = JSON.parse(await res3.text())
  if (!res3.ok) throw new Error(JSON.stringify(json3))
  console.log('BRAND_SETUP_OK', json3.url)
  await fetch(`https://api.imagekit.io/v1/files/${json3.fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${auth}` },
  })

  console.log('FEATURE_SMOKE_PASS')
}

main().catch((e) => {
  console.error('FEATURE_SMOKE_FAIL', e.message || e)
  process.exit(1)
})
