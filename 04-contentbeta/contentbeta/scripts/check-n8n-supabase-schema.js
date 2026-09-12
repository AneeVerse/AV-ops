#!/usr/bin/env node
/**
 * Diff n8n Supabase write keys (active workflows) against live Postgres columns.
 * Exit 1 if any POST/PATCH body key is missing from information_schema.
 *
 * Run: node scripts/check-n8n-supabase-schema.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const WORKFLOWS_DIR = path.join(ROOT, 'n8n-workflows')

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

function listWorkflowFiles(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'inactive-workflows') continue
      out.push(...listWorkflowFiles(full))
    } else if (name.endsWith('.json')) {
      out.push(full)
    }
  }
  return out
}

/** Extract object keys from `JSON.stringify({ a: ..., b: ... })` style strings. */
function extractJsonStringifyKeys(bodyExpr) {
  if (!bodyExpr || typeof bodyExpr !== 'string') return []
  const keys = new Set()
  // Prefer the object literal inside JSON.stringify({ ... })
  const m = bodyExpr.match(/JSON\.stringify\(\s*\{([\s\S]*?)\}\s*\)/)
  const slice = m ? m[1] : bodyExpr
  // Match bare identifiers used as object keys: key: or "key":
  const re = /(?:^|[,{\s])(?:([A-Za-z_][A-Za-z0-9_]*)|"([A-Za-z_][A-Za-z0-9_]*)")\s*:/g
  let hit
  while ((hit = re.exec(slice))) {
    keys.add(hit[1] || hit[2])
  }
  return [...keys]
}

function extractTableFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/\/rest\/v1\/([A-Za-z_][A-Za-z0-9_]*)/)
  return m ? m[1] : null
}

function isWriteMethod(method) {
  const m = String(method || '').toUpperCase()
  return m === 'POST' || m === 'PATCH' || m === 'PUT'
}

function collectWrites(workflowPath) {
  const raw = JSON.parse(fs.readFileSync(workflowPath, 'utf8'))
  const nodes = raw.nodes || []
  const writes = []
  for (const node of nodes) {
    const params = node.parameters || {}
    const method = params.requestMethod || params.method || ''
    const url = params.url || params.requestUrl || ''
    if (!isWriteMethod(method)) continue
    const table = extractTableFromUrl(url)
    if (!table) continue
    // Skip non-Supabase hosts if absolute URL without placeholder
    if (/^https?:\/\//i.test(url) && !/supabase|__SUPABASE_URL__/i.test(url)) continue

    let bodyExpr =
      params.jsonBody ||
      params.body ||
      (params.bodyParameters?.parameters
        ? JSON.stringify(Object.fromEntries(params.bodyParameters.parameters.map((p) => [p.name, true])))
        : null)

    // n8n HTTP Request v4 often stores body under specifyBody + jsonBody
    if (!bodyExpr && params.specifyBody === 'json') {
      bodyExpr = params.jsonBody
    }

    // Some nodes use body: "={{ JSON.stringify(...) }}"
    if (typeof bodyExpr === 'object' && bodyExpr !== null) {
      writes.push({
        file: path.relative(ROOT, workflowPath),
        node: node.name,
        table,
        method: String(method).toUpperCase(),
        keys: Object.keys(bodyExpr),
      })
      continue
    }

    const keys = extractJsonStringifyKeys(String(bodyExpr || ''))
    if (!keys.length) continue
    writes.push({
      file: path.relative(ROOT, workflowPath),
      node: node.name,
      table,
      method: String(method).toUpperCase(),
      keys,
    })
  }
  return writes
}

async function fetchColumnsViaSql(env, tables) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/openapi+json',
  }
  const res = await fetch(`${base}/rest/v1/`, { headers })
  const text = await res.text()
  let openapi
  try {
    openapi = JSON.parse(text)
  } catch {
    throw new Error('Could not load PostgREST OpenAPI: ' + text.slice(0, 200))
  }
  const defs = openapi.definitions || {}
  const map = {}
  for (const table of tables) {
    const props = defs[table]?.properties
    map[table] = props ? new Set(Object.keys(props)) : null
  }
  return map
}

// Keep fetchColumns alias unused helper removed — OpenAPI path only.

async function runCheck() {
  const env = {
    ...loadEnv(path.join(ROOT, '.env.local')),
    ...process.env,
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const files = listWorkflowFiles(WORKFLOWS_DIR)
  const writes = files.flatMap(collectWrites)
  if (!writes.length) {
    throw new Error('No Supabase write bodies found in active n8n workflows')
  }

  const tables = [...new Set(writes.map((w) => w.table))]
  const colMap = await fetchColumnsViaSql(env, tables)

  const missing = []
  for (const w of writes) {
    const cols = colMap[w.table]
    if (!cols) {
      missing.push({ ...w, missingKeys: ['<table missing from OpenAPI>'] })
      continue
    }
    const bad = w.keys.filter((k) => !cols.has(k))
    if (bad.length) missing.push({ ...w, missingKeys: bad })
  }

  console.log('Checked writes:', writes.length, 'tables:', tables.join(', '))
  for (const w of writes) {
    console.log(`  ${w.method} ${w.table} ← ${w.keys.join(', ')} (${w.file} / ${w.node})`)
  }

  if (missing.length) {
    const lines = missing.map(
      (m) => `  ${m.table} missing [${m.missingKeys.join(', ')}] from ${m.file} node "${m.node}"`
    )
    return { ok: false, detail: lines.join('\n'), writes, missing }
  }
  return { ok: true, detail: `writes=${writes.length}`, writes, missing: [] }
}

async function main() {
  const result = await runCheck()
  if (!result.ok) {
    console.error('\nSCHEMA_CONTRACT_FAIL')
    console.error(result.detail)
    process.exit(1)
  }
  console.log('SCHEMA_CONTRACT_PASS')
}

module.exports = {
  collectWrites,
  extractJsonStringifyKeys,
  extractTableFromUrl,
  runCheck,
  main,
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
