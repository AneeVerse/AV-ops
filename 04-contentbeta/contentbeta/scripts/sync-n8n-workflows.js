/**
 * Sync repo n8n-workflows/*.json to the n8n instance via Public API.
 *
 * 1. Load each workflow JSON (active dir by default; skip inactive-workflows/)
 * 2. Substitute placeholders from .env.local / process.env
 * 3. GET /api/v1/workflows → match by name or id → PUT update or POST create → activate
 *
 * Placeholders (from rewrite-n8n-workflows-imagekit.js):
 *   __SUPABASE_URL__
 *   __SUPABASE_SERVICE_ROLE_KEY__
 *   __IMAGEKIT_BASIC_AUTH__       base64(privateKey + ':')
 *   __IMAGEKIT_URL_ENDPOINT__
 *   __OPENAI_API_KEY__
 *   __OPENROUTER_API_KEY__
 *   __REPLICATE_API_TOKEN__
 *
 * Usage:
 *   node scripts/sync-n8n-workflows.js
 *   node scripts/sync-n8n-workflows.js --dry-run
 *   node scripts/sync-n8n-workflows.js --include-inactive
 *   node scripts/sync-n8n-workflows.js --only=n8n_banner_workflow.json
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const WF_DIR = path.join(ROOT, 'n8n-workflows')

/** Fallback names when JSON has no `name` field */
const DEFAULT_NAMES = {
  'n8n_generate_bg_workflow.json': 'Generate Background Image (Overlay Workflow)',
  'n8n_blog_images_workflow.json': 'Blog Images',
  'n8n_infographic_analyse_workflow.json': 'Infographic Analyse',
  'n8n_infographic_workflow.json': 'Infographic',
  'n8n_infographic_edit_workflow.json': 'Infographic Edit',
  'n8n_infographic_animate_workflow.json': 'Infographic Animate',
  'n8n_ad_concept_workflow.json': 'Ad Concept Generator',
  'n8n_banner_workflow.json': 'Banner Generator',
  'n8n_broker_workflow.json': 'Generate Broker Image',
  'n8n_carousel_images_workflow.json': 'Carousel Images (from pre-generated copy)',
  'n8n_blog_carousel_workflow.json': 'Blog to Carousel',
  'n8n_generate_workflow.json': 'Generate Social Post',
  'n8n_generate_workflow_v2.json': 'Generate Social Post V2',
  'generate-illustrations.json': 'Generate Illustrations',
}

/**
 * When two workflows share a webhook path, only activate the preferred file.
 * Others are still created/updated but left inactive.
 */
const WEBHOOK_ACTIVATE_PREFERENCE = {
  generate: 'n8n_generate_workflow_v2.json',
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const INCLUDE_INACTIVE = args.includes('--include-inactive')
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

function mergeEnv() {
  return {
    ...loadEnvFile(path.join(ROOT, '.env')),
    ...loadEnvFile(path.join(ROOT, '.env.local')),
    ...process.env,
  }
}

function walkJsonFiles(dir, { includeInactive }) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'inactive-workflows' && !includeInactive) continue
      out.push(...walkJsonFiles(p, { includeInactive }))
    } else if (name.endsWith('.json')) {
      out.push(p)
    }
  }
  return out
}

function webhookPaths(wf) {
  const paths = []
  for (const node of wf.nodes || []) {
    if (!String(node.type || '').includes('webhook')) continue
    const p = node.parameters?.path
    if (p) paths.push(String(p).replace(/^\/+/, '').replace(/^webhook\//, ''))
  }
  return paths
}

function isInactivePath(filePath) {
  return filePath.replace(/\\/g, '/').includes('/inactive-workflows/')
}

function substitutePlaceholders(raw, env) {
  const sbUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '')
  const sbKey = env.SUPABASE_SERVICE_ROLE_KEY || ''
  const ikPrivate = env.IMAGEKIT_PRIVATE_KEY || ''
  const ikEndpoint = (env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '')
  const openai = env.OPENAI_API_KEY || ''
  const openrouter = env.OPENROUTER_API_KEY || ''
  const replicate = env.REPLICATE_API_TOKEN || env.REPLICATE_API_KEY || ''

  const missing = []
  if (!sbUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!sbKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!ikPrivate) missing.push('IMAGEKIT_PRIVATE_KEY')
  if (!ikEndpoint) missing.push('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT')
  if (!openai) missing.push('OPENAI_API_KEY')
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`)
  }

  const ikBasic = Buffer.from(`${ikPrivate}:`, 'utf8').toString('base64')

  const map = {
    __SUPABASE_URL__: sbUrl,
    __SUPABASE_SERVICE_ROLE_KEY__: sbKey,
    __IMAGEKIT_BASIC_AUTH__: ikBasic,
    __IMAGEKIT_URL_ENDPOINT__: ikEndpoint,
    __OPENAI_API_KEY__: openai,
    __OPENROUTER_API_KEY__: openrouter,
    __REPLICATE_API_TOKEN__: replicate,
  }

  let out = raw
  for (const [placeholder, value] of Object.entries(map)) {
    if (!value) continue
    out = out.split(placeholder).join(value)
  }
  return out
}

function leftoverPlaceholders(text) {
  const found = new Set()
  const re = /__[A-Z0-9_]+__/g
  let m
  while ((m = re.exec(text))) found.add(m[0])
  return [...found]
}

function toApiPayload(wf, name) {
  return {
    name,
    nodes: wf.nodes,
    connections: wf.connections || {},
    settings: {
      executionOrder: wf.settings?.executionOrder || 'v1',
    },
    staticData: wf.staticData ?? null,
  }
}

async function n8nFetch(api, key, pathname, opts = {}) {
  const res = await fetch(`${api}${pathname}`, {
    ...opts,
    headers: {
      'X-N8N-API-KEY': key,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
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

async function listAllWorkflows(api, key) {
  const all = []
  let cursor
  for (;;) {
    const qs = new URLSearchParams({ limit: '100' })
    if (cursor) qs.set('cursor', cursor)
    const { ok, status, text, json } = await n8nFetch(api, key, `/api/v1/workflows?${qs}`)
    if (!ok) throw new Error(`List workflows failed: ${status} ${text.slice(0, 400)}`)
    const data = Array.isArray(json) ? json : json?.data || []
    all.push(...data)
    cursor = json?.nextCursor || json?.meta?.nextCursor
    if (!cursor || data.length === 0) break
  }
  return all
}

function findMatch(remoteList, { name, id }) {
  if (id) {
    const byId = remoteList.find((w) => w.id === id)
    if (byId) return byId
  }
  return remoteList.find((w) => w.name === name) || null
}

async function activateWorkflow(api, key, id) {
  return n8nFetch(api, key, `/api/v1/workflows/${id}/activate`, { method: 'POST' })
}

async function main() {
  const env = mergeEnv()
  const api = (env.N8N_API_URL || env.N8N_BASE_URL || 'https://n8n.aneeverse.com').replace(
    /\/$/,
    ''
  )
  const key = env.N8N_API_KEY
  if (!key) throw new Error('Missing N8N_API_KEY')

  let files = walkJsonFiles(WF_DIR, { includeInactive: INCLUDE_INACTIVE })
  if (ONLY) {
    files = files.filter(
      (f) => path.basename(f) === ONLY || f.replace(/\\/g, '/').endsWith(ONLY)
    )
    if (!files.length) throw new Error(`No workflow matched --only=${ONLY}`)
  }

  // Prefer V2 for shared `generate` webhook; skip activating losers
  const activatePreferred = new Map(Object.entries(WEBHOOK_ACTIVATE_PREFERENCE))

  console.log(`n8n API: ${api}`)
  console.log(`Workflows to sync: ${files.length}${DRY_RUN ? ' (dry-run)' : ''}`)

  const remoteList = await listAllWorkflows(api, key)
  console.log(`Remote workflows: ${remoteList.length}`)

  const results = []
  const CRITICAL = new Set([
    '__SUPABASE_URL__',
    '__SUPABASE_SERVICE_ROLE_KEY__',
    '__IMAGEKIT_BASIC_AUTH__',
    '__IMAGEKIT_URL_ENDPOINT__',
    '__OPENAI_API_KEY__',
  ])

  for (const file of files) {
    const basen = path.basename(file)
    const rel = path.relative(ROOT, file)

    let substituted
    try {
      substituted = substitutePlaceholders(fs.readFileSync(file, 'utf8'), env)
    } catch (e) {
      console.error(`FAIL ${rel}: ${e.message}`)
      results.push({ file: rel, error: e.message })
      continue
    }

    const leftovers = leftoverPlaceholders(substituted)
    const criticalLeft = leftovers.filter((p) => CRITICAL.has(p))
    if (criticalLeft.length) {
      const msg = `Unresolved placeholders: ${criticalLeft.join(', ')}`
      console.error(`FAIL ${rel}: ${msg}`)
      results.push({ file: rel, error: msg })
      continue
    }
    if (leftovers.includes('__OPENROUTER_API_KEY__')) {
      console.warn(`WARN ${rel}: OPENROUTER_API_KEY not set`)
    }
    if (leftovers.includes('__REPLICATE_API_TOKEN__')) {
      console.warn(`WARN ${rel}: REPLICATE_API_KEY not set`)
    }

    const wf = JSON.parse(substituted)
    const name = wf.name || DEFAULT_NAMES[basen] || basen.replace(/\.json$/, '')
    const paths = webhookPaths(wf)
    const match = findMatch(remoteList, { name, id: wf.id })
    const payload = toApiPayload(wf, name)

    const shouldActivate =
      !isInactivePath(file) &&
      paths.every((p) => {
        const preferred = activatePreferred.get(p)
        return !preferred || preferred === basen
      })

    if (DRY_RUN) {
      console.log(
        `DRY ${match ? 'UPDATE' : 'CREATE'} ${name} ← ${rel}` +
          ` paths=[${paths.join(',')}] activate=${shouldActivate}` +
          (match ? ` id=${match.id}` : '')
      )
      results.push({
        file: rel,
        name,
        action: match ? 'update' : 'create',
        id: match?.id,
        activate: shouldActivate,
        paths,
        dryRun: true,
      })
      continue
    }

    let id = match?.id
    let action

    if (id) {
      const put = await n8nFetch(api, key, `/api/v1/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!put.ok) {
        console.error(`FAIL PUT ${rel}: ${put.status} ${put.text.slice(0, 500)}`)
        results.push({ file: rel, name, error: `PUT ${put.status}` })
        continue
      }
      action = 'updated'
      console.log(`OK  UPDATE ${name} (${id})`)
    } else {
      const create = await n8nFetch(api, key, '/api/v1/workflows', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!create.ok) {
        console.error(`FAIL CREATE ${rel}: ${create.status} ${create.text.slice(0, 500)}`)
        results.push({ file: rel, name, error: `CREATE ${create.status}` })
        continue
      }
      id = create.json?.id
      action = 'created'
      remoteList.push({ id, name, active: false })
      console.log(`OK  CREATE ${name} (${id})`)
    }

    let activated = false
    if (shouldActivate && id) {
      const act = await activateWorkflow(api, key, id)
      if (!act.ok) {
        console.warn(`WARN activate ${name}: ${act.status} ${act.text.slice(0, 200)}`)
      } else {
        activated = true
        console.log(`OK  ACTIVATE ${name}`)
      }
    } else if (!shouldActivate) {
      console.log(`SKIP activate ${name} (webhook preference or inactive folder)`)
    }

    results.push({ file: rel, name, id, action, activated, paths })
  }

  console.log('\n--- summary ---')
  const failed = results.filter((r) => r.error)
  const ok = results.filter((r) => !r.error)
  console.log(`ok=${ok.length} failed=${failed.length}`)
  for (const r of failed) console.log('FAIL', r.file, r.error)

  const expected = [
    'generate',
    'generate-bg',
    'generate-banner',
    'generate-broker',
    'generate-illustrations',
    'ad-concept',
    'carousel-images',
    'blog-carousel',
    'blog-images',
    'infographic',
    'infographic-edit',
    'infographic-animate',
    'infographic-analyse',
  ]
  const syncedPaths = new Set(ok.flatMap((r) => r.paths || []))
  const missingExpected = expected.filter((p) => !syncedPaths.has(p))
  if (missingExpected.length) {
    console.warn('WARN missing expected webhook paths:', missingExpected.join(', '))
  } else {
    console.log('All Next.js webhook paths covered by synced workflows')
  }

  if (failed.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
