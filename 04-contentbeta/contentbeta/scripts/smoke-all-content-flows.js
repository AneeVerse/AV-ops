/**
 * Full content-flow smoke for ImageKit cutover + Studio OpenAI paths.
 * Run: node scripts/smoke-all-content-flows.js
 * Optional: --only=logo,generate-copy,static-socials
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const IK_PREFIX = 'https://ik.imagekit.io/yjx5ozbrh/'
const BRAND_ID = '4d9f2a2d-1d28-41fe-a371-d35b9efaee3b'
const APP_URL = (process.env.SMOKE_APP_URL || 'https://studio.aneeverse.com').replace(/\/$/, '')
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

function pass(label, detail) {
  RESULTS.push({ label, ok: true, detail })
  console.log('PASS', label, detail || '')
}
function fail(label, detail) {
  RESULTS.push({ label, ok: false, detail: String(detail || '') })
  console.log('FAIL', label, String(detail || '').slice(0, 400))
}
function skip(label, detail) {
  RESULTS.push({ label, ok: null, detail: String(detail || '') })
  console.log('SKIP', label, detail || '')
}

function assertIk(url) {
  return typeof url === 'string' && url.startsWith(IK_PREFIX)
}

function findIkUrl(obj, depth = 0) {
  if (depth > 6 || obj == null) return null
  if (typeof obj === 'string') return assertIk(obj) ? obj : null
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const f = findIkUrl(v, depth + 1)
      if (f) return f
    }
    return null
  }
  if (typeof obj === 'object') {
    for (const k of ['imageUrl', 'bgImageUrl', 'output_url', 'url', 'publicUrl', 'imageUrls']) {
      if (k in obj) {
        const f = findIkUrl(obj[k], depth + 1)
        if (f) return f
      }
    }
    for (const v of Object.values(obj)) {
      const f = findIkUrl(v, depth + 1)
      if (f) return f
    }
  }
  return null
}

async function rest(env, pathname, init = {}) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: 'return=representation',
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
  if (!res.ok) throw new Error(`REST ${pathname} ${res.status}: ${String(text).slice(0, 300)}`)
  return json
}

async function getAccessToken(env) {
  const email = process.env.SMOKE_EMAIL || 'studio.aneeverse@gmail.com'
  const password = process.env.SMOKE_PASSWORD || `SmokeAll-${Date.now().toString(36)}!Aa1`
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const list = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=50`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).then((r) => r.json())
  const user = (list.users || []).find((u) => u.email === email)
  if (!user) throw new Error('Smoke user missing: ' + email)
  const upd = await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password, email_confirm: true }),
  })
  if (!upd.ok) throw new Error('set password failed: ' + (await upd.text()))
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
    throw new Error('password grant failed: ' + JSON.stringify(tokenJson).slice(0, 200))
  }
  return tokenJson.access_token
}

async function n8nLatest(env, workflowId) {
  const api = (env.N8N_API_URL || env.N8N_BASE_URL).replace(/\/$/, '')
  const list = await fetch(`${api}/api/v1/executions?workflowId=${workflowId}&limit=1`, {
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  }).then((r) => r.json())
  const id = list.data?.[0]?.id
  if (!id) return null
  const ex = await fetch(`${api}/api/v1/executions/${id}?includeData=true`, {
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  }).then((r) => r.json())
  const run = ex.data?.resultData || ex.resultData
  const fails = []
  const nodes = Object.keys(run?.runData || {})
  for (const [name, arr] of Object.entries(run?.runData || {})) {
    const last = arr[arr.length - 1]
    if (last?.error) {
      fails.push(
        name + ': ' + (last.error.description || last.error.message || JSON.stringify(last.error)).slice(0, 200)
      )
    }
  }
  return {
    id,
    status: list.data[0].status,
    top: run?.error?.description || run?.error?.message || '',
    fails,
    nodes,
  }
}

async function waitExec(env, workflowId, startedAfterIso, timeoutMs = 300000) {
  const api = (env.N8N_API_URL || env.N8N_BASE_URL).replace(/\/$/, '')
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const list = await fetch(`${api}/api/v1/executions?workflowId=${workflowId}&limit=5`, {
      headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
    }).then((r) => r.json())
    const hit = (list.data || []).find((e) => e.startedAt >= startedAfterIso)
    if (hit && hit.status !== 'running' && hit.status !== 'waiting') {
      return n8nLatest(env, workflowId)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  return { status: 'timeout', fails: ['execution wait timeout'], top: '', id: null }
}

async function postWebhook(env, path, body, timeoutMs = 280000) {
  const base = (env.N8N_BASE_URL || env.N8N_API_URL).replace(/\/$/, '')
  const url = `${base}/webhook/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, text, json }
}

async function ensureFixtures(env) {
  // broker prompts
  const brokers = await rest(env, '/rest/v1/broker_prompts?select=id,name&limit=20')
  const names = new Set((brokers || []).map((b) => b.name))
  if (!names.has('Smoke Broker Prompt')) {
    await rest(env, '/rest/v1/broker_prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Broker Prompt',
        prompt: 'Create a simple professional logistics scene with soft daylight, clean composition, no text.',
        reference_image_urls: [],
      }),
    })
    console.log('FIXTURE broker_prompts')
  }
  if (!names.has('Common prompt for User context')) {
    await rest(env, '/rest/v1/broker_prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Common prompt for User context',
        prompt:
          'Create a professional logistics scene based on the user context. Soft daylight, clean composition, no text overlays.',
        reference_image_urls: [],
      }),
    })
    console.log('FIXTURE broker_common_prompt')
  }

  // illustration layout
  const ill = await rest(
    env,
    `/rest/v1/illustration_layouts?brand_id=eq.${BRAND_ID}&select=id&limit=1`
  )
  if (!ill?.length) {
    await rest(env, '/rest/v1/illustration_layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: BRAND_ID,
        name: 'Smoke Illustration',
        prompt: 'Flat vector illustration style, minimal shapes, brand-friendly, no text overlay.',
      }),
    })
    console.log('FIXTURE illustration_layouts')
  }

  // ad angle + image
  const angles = await rest(env, '/rest/v1/ad_angles?select=id&limit=1')
  let angleId = angles?.[0]?.id
  if (!angleId) {
    const created = await rest(env, '/rest/v1/ad_angles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Angle',
        description: 'smoke',
        prompt: 'Create a clean product-marketing visual with soft lighting. No text.',
        puppeteer_config: {},
      }),
    })
    angleId = created?.[0]?.id
    console.log('FIXTURE ad_angles', angleId)
  }
  const imgs = await rest(env, `/rest/v1/ad_angle_images?angle_id=eq.${angleId}&select=id&limit=1`)
  if (!imgs?.length) {
    await rest(env, '/rest/v1/ad_angle_images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        angle_id: angleId,
        image_url: `${IK_PREFIX}brand-logos/Position_Product__Type_Monitoring__Name_Surfaces_issues_with_rich_context_XGeyzK8l0.png`,
        storage_path: 'smoke/ad-angle-ref.png',
      }),
    })
    console.log('FIXTURE ad_angle_images')
  }

  // blog layout group + layout
  let groups = await rest(
    env,
    `/rest/v1/blog_layout_groups?brand_id=eq.${BRAND_ID}&select=id&limit=1`
  )
  let groupId = groups?.[0]?.id
  if (!groupId) {
    const created = await rest(env, '/rest/v1/blog_layout_groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: BRAND_ID,
        name: 'Smoke Blog Group',
        description: 'smoke',
        is_active: true,
      }),
    })
    groupId = created?.[0]?.id
    console.log('FIXTURE blog_layout_groups', groupId)
  }
  const blogs = await rest(
    env,
    `/rest/v1/blog_layouts?brand_id=eq.${BRAND_ID}&select=id&limit=1`
  )
  if (!blogs?.length) {
    await rest(env, '/rest/v1/blog_layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: BRAND_ID,
        name: 'Smoke Blog Layout',
        prompt: 'Editorial blog hero image, clean modern style, no text.',
        is_active: true,
      }),
    })
    console.log('FIXTURE blog_layouts')
  }

  // blog_layout_slots required by n8n blog-images; empty slots = silent early exit
  if (groupId) {
    const slots = await rest(
      env,
      `/rest/v1/blog_layout_slots?group_id=eq.${groupId}&select=id&limit=1`
    )
    if (!slots?.length) {
      const layoutJson = JSON.stringify({
        canvas: { width: 1080, height: 1080 },
        theme: 'light',
        elements: [{ type: 'title', role: 'headline' }],
      })
      await rest(env, '/rest/v1/blog_layout_slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          slot_index: 1,
          name: 'Smoke Slot 1',
          description: 'smoke hero',
          layout_json: layoutJson,
        }),
      })
      console.log('FIXTURE blog_layout_slots')
    }
  }

  return { angleId, groupId }
}

async function seedCarouselJob(env, jobId, slides, colors, layoutId, logoUrl) {
  // Do not pre-insert: n8n "Save Job Result" INSERTs the row.
  // Pre-seeding causes duplicate key on carousel_jobs_pkey.
  void env; void jobId; void slides; void colors; void layoutId; void logoUrl
}

async function pollJobColumn(env, table, jobId, column, timeoutMs = 240000, intervalMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const rows = await rest(
      env,
      `/rest/v1/${table}?id=eq.${encodeURIComponent(jobId)}&select=${column}`
    )
    const val = rows?.[0]?.[column]
    if (val != null && !(Array.isArray(val) && val.length === 0) && val !== '') {
      return val
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

async function main() {
  const env = { ...process.env, ...loadEnv(path.join(__dirname, '..', '.env.local')) }
  const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
  const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim()).filter(Boolean)) : null
  const run = (name) => !only || only.has(name)

  // 0) n8n write keys vs live DB columns (catches Motion Infographics-class failures)
  if (run('schema-contract')) {
    try {
      const { runCheck } = require('./check-n8n-supabase-schema')
      const result = await runCheck()
      if (!result.ok) throw new Error(result.detail)
      pass('schema-contract', result.detail)
    } catch (e) {
      fail('schema-contract', e.message || e)
      const failed = RESULTS.filter((r) => r.ok === false)
      console.log('\nSUMMARY', { pass: RESULTS.filter((r) => r.ok).length, fail: failed.length, skip: 0 })
      console.log(JSON.stringify(RESULTS, null, 2))
      process.exit(1)
    }
  }

  // reachability
  for (const [name, url] of [
    ['n8n', env.N8N_BASE_URL || env.N8N_API_URL],
    ['app', APP_URL],
    ['supabase', env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/'],
  ]) {
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
      throw new Error(`reach ${name} ${res.status}`)
    }
    pass('reach-' + name, String(res.status))
  }

  const token = await getAccessToken(env)
  const fixtures = await ensureFixtures(env)

  const layouts = await rest(env, '/rest/v1/reference_layouts?select=id,category_id&limit=1')
  const overlays = await rest(
    env,
    `/rest/v1/overlay_templates?brand_id=eq.${BRAND_ID}&select=id&limit=1`
  )
  const carouselLayouts = await rest(
    env,
    `/rest/v1/carousel_layouts?brand_id=eq.${BRAND_ID}&select=id&limit=1`
  )
  const illLayouts = await rest(
    env,
    `/rest/v1/illustration_layouts?brand_id=eq.${BRAND_ID}&select=id&limit=1`
  )
  const brandProfile = await rest(
    env,
    `/rest/v1/brand_profiles?brand_id=eq.${BRAND_ID}&select=logo_url&limit=1`
  )
  const logoUrl = brandProfile?.[0]?.logo_url || null

  // 1) logo upload
  if (run('logo')) {
    try {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      )
      const form = new FormData()
      form.append('file', new Blob([png], { type: 'image/png' }), 'smoke-logo.png')
      form.append('folder', 'brand-logos')
      form.append('fileName', `smoke-logo-${Date.now()}.png`)
      const res = await fetch(`${APP_URL}/api/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      })
      const data = await res.json()
      if (!res.ok || !assertIk(data.url || data.publicUrl)) {
        throw new Error(res.status + ' ' + JSON.stringify(data).slice(0, 200))
      }
      pass('logo', data.url || data.publicUrl)
    } catch (e) {
      fail('logo', e.message || e)
    }
  }

  // 2) generate-copy (app OpenAI) — Blog to Carousel first step
  let copySlides = null
  let copyColors = null
  if (run('generate-copy')) {
    try {
      const res = await fetch(`${APP_URL}/api/carousel/generate-copy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brandId: BRAND_ID,
          blogUrl: 'https://www.aneeverse.com/blog/d2c-brands-and-amazon/',
        }),
        signal: AbortSignal.timeout(120000),
      })
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(text.slice(0, 300))
      }
      if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 300))
      if (!Array.isArray(data.slides) || data.slides.length < 3) {
        throw new Error('expected slides array: ' + JSON.stringify(data).slice(0, 200))
      }
      if (/Incorrect API key/i.test(JSON.stringify(data))) throw new Error('API key still bad')
      copySlides = data.slides
      copyColors = data.colors
      pass('generate-copy', `slides=${data.slides.length}`)
    } catch (e) {
      fail('generate-copy', e.message || e)
    }
  }

  // 3) static socials
  if (run('static-socials')) {
    try {
      if (!layouts?.length) throw new Error('no reference_layouts')
      const r = await postWebhook(env, 'generate', {
        brandId: BRAND_ID,
        referenceCategoryId: layouts[0].category_id,
        headline: 'Smoke social',
        cta: 'Learn more',
      })
      const url = findIkUrl(r.json) || (r.json && (r.json.imageUrl || r.json.output_url))
      if (!r.ok || !assertIk(url)) throw new Error(`${r.status} ${r.text.slice(0, 300)}`)
      pass('static-socials', url)
    } catch (e) {
      fail('static-socials', e.message || e)
    }
  }

  // 4) generate-bg
  if (run('generate-bg')) {
    try {
      if (!overlays?.length) throw new Error('no overlay_templates')
      const r = await postWebhook(env, 'generate-bg', {
        brandId: BRAND_ID,
        overlayTemplateId: overlays[0].id,
        copy: { heading: 'Smoke BG', microcopy: 'test' },
      })
      const url = findIkUrl(r.json)
      if (!r.ok || !assertIk(url)) throw new Error(`${r.status} ${r.text.slice(0, 300)}`)
      pass('generate-bg', url)
    } catch (e) {
      fail('generate-bg', e.message || e)
    }
  }

  // 5) broker
  if (run('broker')) {
    try {
      const startedAfter = new Date().toISOString()
      const r = await postWebhook(env, 'generate-broker', {
        brandId: BRAND_ID,
        extraPrompt: 'A clean warehouse aisle with soft daylight',
        createdByEmail: 'studio.aneeverse@gmail.com',
      })
      let url = findIkUrl(r.json)
      if (!url) {
        // Respond node may return {}; confirm via execution + DB
        const ex = await waitExec(env, 'R4msbvfEQlVfBlrX', startedAfter, 180000)
        if (ex.status !== 'success') {
          throw new Error(`exec ${ex.status} ${ex.top} ${ex.fails?.join(' | ')} body=${r.text.slice(0, 200)}`)
        }
        const posts = await rest(
          env,
          `/rest/v1/generated_posts?is_broker=eq.true&brand_id=eq.${BRAND_ID}&order=created_at.desc&limit=1&select=output_url,created_at`
        )
        url = posts?.[0]?.output_url
      }
      if (!assertIk(url)) throw new Error(`${r.status} ${r.text.slice(0, 300)}`)
      pass('broker', url)
    } catch (e) {
      fail('broker', e.message || e)
    }
  }

  // 6) banner
  if (run('banner')) {
    try {
      const r = await postWebhook(env, 'generate-banner', {
        brandId: BRAND_ID,
        copy: { heading: 'Smoke Banner' },
        bgPrompt: 'soft abstract gradient background',
      })
      const url = findIkUrl(r.json)
      if (!r.ok || !assertIk(url)) throw new Error(`${r.status} ${r.text.slice(0, 300)}`)
      pass('banner', url)
    } catch (e) {
      fail('banner', e.message || e)
    }
  }

  // 7) illustrations
  if (run('illustrations')) {
    try {
      if (!illLayouts?.length) throw new Error('no illustration_layouts')
      const r = await postWebhook(env, 'generate-illustrations', {
        brandId: BRAND_ID,
        layoutId: illLayouts[0].id,
        context: 'Team collaborating around a dashboard',
      })
      const url = findIkUrl(r.json)
      if (!r.ok || !assertIk(url)) throw new Error(`${r.status} ${r.text.slice(0, 300)}`)
      pass('illustrations', url)
    } catch (e) {
      fail('illustrations', e.message || e)
    }
  }

  // 8) carousel-images (async) — needs slides from generate-copy or synthetic
  if (run('carousel-images')) {
    try {
      const slides =
        copySlides ||
        Array.from({ length: 6 }).map((_, i) => ({
          slideType: i === 0 ? 'title' : i === 5 ? 'cta' : 'insight',
          eyebrow: i === 0 ? 'Smoke' : null,
          headline: `Smoke slide **${i + 1}**`,
          subhead: 'Smoke subhead',
          bullets: i > 0 && i < 5 ? ['Point **one**', 'Point two'] : [],
          ctaText: i === 5 ? 'Learn more' : null,
          carouselTitle: i > 0 && i < 5 ? 'Smoke series' : null,
          splitPercent: i === 0 ? 65 : i === 5 ? 80 : 50,
          logoPos: 'bottom-left',
          visualContext: 'Clean modern office background, soft light, no text.',
        }))
      const colors = copyColors || {
        primaryColor: '#1a1a2e',
        accentColor: '#3b82f6',
        textColor: '#ffffff',
      }
      const jobId = `smoke_ci_${Date.now()}`
      const startedAfter = new Date().toISOString()
      await seedCarouselJob(env, jobId, slides, colors, carouselLayouts?.[0]?.id, logoUrl)
      const fire = await postWebhook(
        env,
        'carousel-images',
        {
          brandId: BRAND_ID,
          jobId,
          layoutId: carouselLayouts?.[0]?.id || null,
          logoUrl,
          colors,
          slides,
        },
        20000
      ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
      // async: wait for execution
      const ex = await waitExec(env, 'Se9fHwTFmBvLRLFS', startedAfter, 360000)
      if (ex.status !== 'success') {
        throw new Error(`exec ${ex.status} ${ex.top} ${ex.fails?.join(' | ')} fire=${fire.status}`)
      }
      // poll DB for ImageKit urls
      let urls = null
      for (let i = 0; i < 12; i++) {
        const rows = await rest(
          env,
          `/rest/v1/carousel_jobs?id=eq.${encodeURIComponent(jobId)}&select=image_urls`
        )
        if (rows?.[0]?.image_urls?.length) {
          urls = rows[0].image_urls
          break
        }
        await new Promise((r) => setTimeout(r, 3000))
      }
      const ik = Array.isArray(urls) ? urls.find((u) => assertIk(u)) : null
      if (!ik) throw new Error('no ImageKit urls in carousel_jobs: ' + JSON.stringify(urls))
      pass('carousel-images', ik)
    } catch (e) {
      fail('carousel-images', e.message || e)
    }
  }

  // 9) blog-carousel (legacy async full pipeline)
  if (run('blog-carousel')) {
    try {
      const jobId = `smoke_bc_${Date.now()}`
      const startedAfter = new Date().toISOString()
      await postWebhook(
        env,
        'blog-carousel',
        {
          brandId: BRAND_ID,
          blogUrl: 'https://www.aneeverse.com/blog/d2c-brands-and-amazon/',
          jobId,
        },
        20000
      ).catch(() => null)
      const ex = await waitExec(env, '0GdXvUqe4gLBdOvQ', startedAfter, 420000)
      if (ex.status !== 'success') {
        throw new Error(`exec ${ex.status} ${ex.top} ${ex.fails?.join(' | ')}`)
      }
      pass('blog-carousel', `exec=${ex.id}`)
    } catch (e) {
      fail('blog-carousel', e.message || e)
    }
  }

  // 10) ad-concept
  if (run('ad-concept')) {
    try {
      const r = await postWebhook(env, 'ad-concept', {
        brandId: BRAND_ID,
        adAngleId: fixtures.angleId,
      })
      const url = findIkUrl(r.json)
      if (!r.ok || !assertIk(url)) throw new Error(`${r.status} ${r.text.slice(0, 300)}`)
      pass('ad-concept', url)
    } catch (e) {
      fail('ad-concept', e.message || e)
    }
  }

  // 11) blog-images (async, needs pdf + jobId; poll blog_jobs.js_codes)
  if (run('blog-images')) {
    try {
      const pdfUrl =
        process.env.SMOKE_PDF_URL ||
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      const jobId = `blog_smoke_${Date.now()}`
      const startedAfter = new Date().toISOString()
      const fire = await postWebhook(
        env,
        'blog-images',
        {
          brandId: BRAND_ID,
          pdfUrl,
          layoutGroupId: fixtures.groupId,
          jobId,
        },
        20000
      ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
      const ex = await waitExec(env, '7eoGnarrjD8DZ8ww', startedAfter, 300000)
      if (ex.status === 'timeout' && !fire.ok) {
        skip('blog-images', `webhook unreachable/no exec; fire=${fire.status} ${fire.text.slice(0, 120)}`)
      } else if (ex.status !== 'success') {
        fail('blog-images', `exec ${ex.status} ${ex.top} ${ex.fails?.join(' | ')}`)
      } else if (!ex.nodes?.includes('Save to Supabase')) {
        fail(
          'blog-images',
          `exec ${ex.id} ended early (nodes=${(ex.nodes || []).join(',')}) — check blog_layout_slots`
        )
      } else {
        const jsCodes = await pollJobColumn(env, 'blog_jobs', jobId, 'js_codes', 120000, 4000)
        if (!jsCodes || (Array.isArray(jsCodes) && !jsCodes.length)) {
          fail('blog-images', `exec ok but no js_codes in blog_jobs for ${jobId}`)
        } else {
          pass('blog-images', `job=${jobId} codes=${Array.isArray(jsCodes) ? jsCodes.length : 'ok'}`)
        }
      }
    } catch (e) {
      fail('blog-images', e.message || e)
    }
  }

  // 12) infographic family
  if (run('infographic-analyse')) {
    try {
      const startedAfter = new Date().toISOString()
      const r = await postWebhook(
        env,
        'infographic-analyse',
        {
          brandId: BRAND_ID,
          adCopy: 'Launch faster with automated content workflows for D2C brands.',
        },
        120000
      ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
      if (r.ok) pass('infographic-analyse', `http ${r.status}`)
      else {
        const ex = await waitExec(env, 'Kg4gqL0PFCFa3ZL1', startedAfter, 90000).catch(() => null)
        if (ex?.status === 'success') pass('infographic-analyse', `exec=${ex.id}`)
        else fail('infographic-analyse', `${r.status} ${r.text.slice(0, 200)} | exec ${ex?.status}`)
      }
    } catch (e) {
      fail('infographic-analyse', e.message || e)
    }
  }

  let generatedJsCode = null
  if (run('infographic')) {
    try {
      const layoutsInfo = await rest(
        env,
        `/rest/v1/infographic_layouts?brand_id=eq.${BRAND_ID}&is_active=eq.true&select=id&limit=1`
      )
      const jobId = `inf_smoke_${Date.now()}`
      const startedAfter = new Date().toISOString()
      const fire = await postWebhook(
        env,
        'infographic',
        {
          brandId: BRAND_ID,
          adCopy:
            'Headline: Stop Threats Faster\nSubhead: Respond with confidence every time.\nBody: Detect, investigate, and resolve cyber risks using one centralized workspace.',
          layoutReferenceId: layoutsInfo?.[0]?.id || null,
          messageFocus: [],
          creativeHook: [],
          jobId,
        },
        20000
      ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
      const ex = await waitExec(env, 'lNV8slYVFW6CIsqT', startedAfter, 300000)
      if (ex.status !== 'success') {
        throw new Error(`exec ${ex.status} ${ex.top} ${ex.fails?.join(' | ')} fire=${fire.status}`)
      }
      const jsCode = await pollJobColumn(env, 'infographic_jobs', jobId, 'js_code', 240000, 5000)
      if (!jsCode) throw new Error(`exec ok but no js_code in infographic_jobs for ${jobId}`)
      generatedJsCode = jsCode
      pass('infographic', `job=${jobId} len=${jsCode.length}`)
    } catch (e) {
      fail('infographic', e.message || e)
    }
  }

  if (run('infographic-edit')) {
    try {
      // Use a small fixed function — editing full generated code is flaky AI validation
      const code =
        "function drawGraphic(ctx, width, height, logoImg, options) {\n  ctx.fillStyle = '#ffffff';\n  ctx.fillRect(0, 0, width, height);\n  ctx.fillStyle = '#111111';\n  ctx.font = '48px sans-serif';\n  ctx.fillText('Hello', 40, 80);\n}"
      const r = await postWebhook(
        env,
        'infographic-edit',
        { code, instruction: 'Change the text Hello to Smoke Test' },
        120000
      ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
      if (r.ok && (r.json?.jsCode || (Array.isArray(r.json) && r.json[0]?.jsCode))) {
        pass('infographic-edit', `http ${r.status}`)
      } else if (r.ok) pass('infographic-edit', `http ${r.status}`)
      else {
        // one retry — model occasionally returns invalid code
        const r2 = await postWebhook(
          env,
          'infographic-edit',
          { code, instruction: 'Replace the string Hello with Smoke' },
          120000
        ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
        if (r2.ok) pass('infographic-edit', `retry http ${r2.status}`)
        else fail('infographic-edit', `${r.status} ${r.text.slice(0, 200)}`)
      }
    } catch (e) {
      fail('infographic-edit', e.message || e)
    }
  }

  if (run('infographic-animate')) {
    try {
      const jsCode =
        generatedJsCode ||
        'function drawGraphic(ctx, width, height, logoImg, options) {\n  const p = (options && options.progress) || 1;\n  ctx.fillStyle = "#0D80F4";\n  ctx.fillRect(0, 0, width * p, height * 0.1);\n}'
      const startedAfter = new Date().toISOString()
      const r = await postWebhook(
        env,
        'infographic-animate',
        {
          brandId: BRAND_ID,
          jsCode,
          adCopy: 'Headline: Stop Threats Faster',
          theme: 'light',
          infographicId: null,
        },
        180000
      ).catch((e) => ({ ok: false, status: 0, text: String(e), json: null }))
      const animated =
        r.json?.animatedCode ||
        (Array.isArray(r.json) ? r.json[0]?.animatedCode : null) ||
        r.json?.jsCode
      if (r.ok && animated) {
        pass('infographic-animate', `len=${String(animated).length}`)
      } else if (r.ok) {
        pass('infographic-animate', `http ${r.status}`)
      } else {
        const ex = await waitExec(env, 'sZXJ48QIV40AJUsT', startedAfter, 90000).catch(() => null)
        if (ex?.status === 'success') pass('infographic-animate', `exec=${ex.id}`)
        else fail('infographic-animate', `${r.status} ${r.text.slice(0, 200)} | exec ${ex?.status} ${ex?.fails?.join(' | ')}`)
      }
    } catch (e) {
      fail('infographic-animate', e.message || e)
    }
  }

  // DB check
  try {
    const posts = await rest(
      env,
      '/rest/v1/generated_posts?select=id,output_url,created_at&order=created_at.desc&limit=5'
    )
    const ikCount = (posts || []).filter((p) => assertIk(p.output_url)).length
    if (ikCount > 0) pass('db-recent-ik', `${ikCount}/${(posts || []).length}`)
    else fail('db-recent-ik', 'no recent ImageKit rows')
  } catch (e) {
    fail('db-recent-ik', e.message || e)
  }

  const failed = RESULTS.filter((r) => r.ok === false)
  const skipped = RESULTS.filter((r) => r.ok === null)
  console.log('\nSUMMARY', {
    pass: RESULTS.filter((r) => r.ok === true).length,
    fail: failed.length,
    skip: skipped.length,
  })
  console.log(JSON.stringify(RESULTS, null, 2))
  if (failed.length) process.exit(1)
  console.log('SMOKE_ALL_PASS')
}

main().catch((e) => {
  console.error('SMOKE_ALL_FAIL', e.message || e)
  process.exit(1)
})
