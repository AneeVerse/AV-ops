/**
 * Phase 5 cutover smoke:
 * 1) Static Socials (Generate Social Post V2 webhook) → ik.imagekit.io URL
 * 2) Brand logo via Next /api/media/upload → ik.imagekit.io URL
 * 3) One other generator (generate-bg) → ik.imagekit.io URL
 *
 * Run: node scripts/smoke-cutover.js
 */
const fs = require('fs')
const path = require('path')

const IK_PREFIX = 'https://ik.imagekit.io/yjx5ozbrh/'
const RESULTS = []

function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function assertIk(label, url) {
  if (!url || typeof url !== 'string') throw new Error(`${label}: missing url`)
  if (!url.startsWith(IK_PREFIX)) {
    throw new Error(`${label}: expected ${IK_PREFIX}* got ${url}`)
  }
  RESULTS.push({ label, url, ok: true })
  console.log('OK', label, url)
}

async function rest(env, pathname, init = {}) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...(init.headers || {}),
  }
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}${pathname}`, {
    ...init,
    headers,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) throw new Error(`REST ${pathname} ${res.status}: ${text.slice(0, 400)}`)
  return json
}

async function getAccessToken(env) {
  const email = process.env.SMOKE_EMAIL || 'studio.aneeverse@gmail.com'
  const password =
    process.env.SMOKE_PASSWORD || `SmokeCutover-${Date.now().toString(36)}!Aa1`
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')

  const listRes = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=50`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  const list = await listRes.json()
  const user = (list.users || []).find((u) => u.email === email)
  if (!user) throw new Error(`Smoke user not found: ${email}`)

  const upd = await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password, email_confirm: true }),
  })
  if (!upd.ok) throw new Error('Failed to set smoke password: ' + (await upd.text()))

  const tokenRes = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error('Password grant failed: ' + JSON.stringify(tokenJson).slice(0, 300))
  }
  return tokenJson.access_token
}

async function smokeReachability(env) {
  const checks = [
    ['n8n', env.N8N_BASE_URL || env.N8N_API_URL],
    ['app', process.env.SMOKE_APP_URL || 'https://studio.aneeverse.com'],
    ['supabase', env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/'],
  ]
  for (const [name, url] of checks) {
    const res = await fetch(url, {
      headers:
        name === 'supabase'
          ? {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            }
          : undefined,
    })
    if (!res.ok && !(name === 'n8n' && res.status < 500)) {
      // n8n root 200 expected; supabase rest root 200
      if (name === 'supabase' && res.status === 200) continue
      if (!(name === 'n8n' && res.status === 200)) {
        throw new Error(`Reachability ${name} ${url} → ${res.status}`)
      }
    }
    console.log('OK reach', name, res.status)
  }
}

async function smokeStaticSocials(env) {
  const brandId = '4d9f2a2d-1d28-41fe-a371-d35b9efaee3b'
  const layouts = await rest(
    env,
    `/rest/v1/reference_layouts?select=id,category_id&limit=1`
  )
  if (!layouts?.length) throw new Error('No reference_layouts for Static Socials')
  const referenceCategoryId = layouts[0].category_id

  const webhook =
    env.N8N_GENERATE_WEBHOOK ||
    `${(env.N8N_BASE_URL || env.N8N_API_URL).replace(/\/$/, '')}/webhook/generate`

  console.log('CALL Static Socials', webhook)
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandId,
      referenceCategoryId,
      headline: 'Smoke test social',
      cta: 'Learn more',
    }),
    signal: AbortSignal.timeout(280_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Static Socials ${res.status}: ${text.slice(0, 500)}`)
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Static Socials non-JSON: ' + text.slice(0, 300))
  }
  const imageUrl = data.imageUrl || data.output_url
  assertIk('static-socials', imageUrl)
  return imageUrl
}

async function smokeLogoUpload(env, accessToken) {
  const appUrl = (process.env.SMOKE_APP_URL || 'https://studio.aneeverse.com').replace(/\/$/, '')
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'smoke-logo.png')
  form.append('folder', 'brand-logos')
  form.append('fileName', `smoke-logo-${Date.now()}.png`)

  console.log('CALL logo upload', `${appUrl}/api/media/upload`)
  const res = await fetch(`${appUrl}/api/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`logo upload ${res.status}: ${text.slice(0, 400)}`)
  const data = JSON.parse(text)
  assertIk('logo-upload', data.url || data.publicUrl)
  return data
}

async function smokeGenerateBg(env) {
  const brandId = '4d9f2a2d-1d28-41fe-a371-d35b9efaee3b'
  const overlays = await rest(
    env,
    `/rest/v1/overlay_templates?select=id,brand_id&brand_id=eq.${brandId}&limit=1`
  )
  if (!overlays?.length) throw new Error('No overlay_templates for generate-bg')

  const webhook =
    env.N8N_GENERATE_BG_WEBHOOK ||
    `${(env.N8N_BASE_URL || env.N8N_API_URL).replace(/\/$/, '')}/webhook/generate-bg`

  console.log('CALL generate-bg', webhook)
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandId,
      overlayTemplateId: overlays[0].id,
      copy: { heading: 'Smoke BG', microcopy: 'Cutover check' },
    }),
    signal: AbortSignal.timeout(280_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`generate-bg ${res.status}: ${text.slice(0, 500)}`)
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('generate-bg non-JSON: ' + text.slice(0, 300))
  }
  assertIk('generate-bg', data.bgImageUrl || data.imageUrl || data.output_url)
  return data
}

async function confirmDbWrites(env) {
  const posts = await rest(
    env,
    `/rest/v1/generated_posts?select=id,output_url,created_at&order=created_at.desc&limit=3`
  )
  const ik = (posts || []).filter((p) => String(p.output_url || '').startsWith(IK_PREFIX))
  console.log('OK db-recent-ik', ik.length, 'of', (posts || []).length)
  if (!ik.length) {
    console.warn('WARN no recent ImageKit rows in generated_posts (may be expected if workflow skipped insert)')
  }
}

async function main() {
  const env = { ...process.env, ...loadEnv(path.join(__dirname, '..', '.env.local')) }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env')
  }

  await smokeReachability(env)
  const token = await getAccessToken(env)

  // Logo first (fast), then generators (slow AI)
  await smokeLogoUpload(env, token)
  await smokeStaticSocials(env)
  await smokeGenerateBg(env)
  await confirmDbWrites(env)

  console.log('SMOKE_CUTOVER_PASS', JSON.stringify(RESULTS, null, 2))
}

main().catch((e) => {
  console.error('SMOKE_CUTOVER_FAIL', e.message || e)
  process.exit(1)
})
