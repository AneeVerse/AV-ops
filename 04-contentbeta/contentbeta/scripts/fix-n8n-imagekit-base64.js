/**
 * Fix n8n ImageKit uploads: formBinaryData aborts from this host;
 * switch to multipart form field with data-URL / base64 (ImageKit accepts both).
 *
 * Updates live workflows via API + repo JSON under n8n-workflows/.
 * Run: node scripts/fix-n8n-imagekit-base64.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

function loadEnv(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

const FILE_EXPR =
  "={{ 'data:' + ($binary.data.mimeType || 'image/png') + ';base64,' + $binary.data.data }}"

function patchBodyParams(params) {
  if (!Array.isArray(params)) return { changed: false, params }
  let changed = false
  const next = params.map((p) => {
    if (
      p &&
      p.name === 'file' &&
      (p.parameterType === 'formBinaryData' || p.inputDataFieldName)
    ) {
      changed = true
      return { name: 'file', value: FILE_EXPR }
    }
    return p
  })
  return { changed, params: next }
}

function patchWorkflowObject(wf) {
  let changed = false
  for (const node of wf.nodes || []) {
    const url = String(node.parameters?.url || '')
    if (!url.includes('upload.imagekit.io')) continue
    const body = node.parameters?.bodyParameters?.parameters
    const { changed: c, params } = patchBodyParams(body)
    if (c) {
      node.parameters.bodyParameters.parameters = params
      // Give ImageKit uploads a generous timeout
      node.parameters.options = {
        ...(node.parameters.options || {}),
        timeout: 120000,
      }
      changed = true
    }
  }
  return changed
}

function walkJson(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walkJson(p, out)
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

async function main() {
  const env = { ...loadEnv(path.join(ROOT, '.env.local')), ...process.env }
  const api = (env.N8N_API_URL || env.N8N_BASE_URL || '').replace(/\/$/, '')
  const key = env.N8N_API_KEY
  if (!api || !key) throw new Error('Missing N8N_API_URL / N8N_API_KEY')

  // 1) Repo JSON
  const files = walkJson(path.join(ROOT, 'n8n-workflows'))
  for (const file of files) {
    const wf = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!patchWorkflowObject(wf)) continue
    fs.writeFileSync(file, JSON.stringify(wf, null, 2) + '\n')
    console.log('REPO', path.relative(ROOT, file))
  }

  // Rewrite helper
  const rewritePath = path.join(ROOT, 'scripts', 'rewrite-n8n-workflows-imagekit.js')
  let rewrite = fs.readFileSync(rewritePath, 'utf8')
  const oldSnippet = `{ name: 'file', parameterType: 'formBinaryData', inputDataFieldName: binaryField },`
  const newSnippet = `{ name: 'file', value: "={{ 'data:' + ($binary.\" + binaryField + \".mimeType || 'image/png') + ';base64,' + $binary.\" + binaryField + \".data }}" },`
  // Simpler: always use data field (all workflows use binaryField 'data')
  const newSnippetFixed = `{ name: 'file', value: "={{ 'data:' + ($binary.data.mimeType || 'image/png') + ';base64,' + $binary.data.data }}" },`
  if (rewrite.includes(oldSnippet)) {
    rewrite = rewrite.replace(oldSnippet, newSnippetFixed)
    fs.writeFileSync(rewritePath, rewrite)
    console.log('REPO scripts/rewrite-n8n-workflows-imagekit.js')
  }

  // 2) Live n8n workflows
  const list = await fetch(`${api}/api/v1/workflows?limit=250`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json())
  const workflows = list.data || list

  for (const meta of workflows) {
    const full = await fetch(`${api}/api/v1/workflows/${meta.id}`, {
      headers: { 'X-N8N-API-KEY': key },
    }).then((r) => r.json())
    if (!patchWorkflowObject(full)) continue

    const payload = {
      name: full.name,
      nodes: full.nodes,
      connections: full.connections,
      // n8n Public API rejects unknown settings keys (e.g. binaryMode, availableInMCP)
      settings: { executionOrder: full.settings?.executionOrder || 'v1' },
    }
    const res = await fetch(`${api}/api/v1/workflows/${meta.id}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`PUT ${meta.name}: ${res.status} ${text.slice(0, 300)}`)

    // keep active state
    if (meta.active) {
      await fetch(`${api}/api/v1/workflows/${meta.id}/activate`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': key },
      })
    }
    console.log('LIVE', meta.active ? 'ON ' : 'OFF', meta.id, meta.name)
  }

  console.log('FIX_IMAGEKIT_BASE64_DONE')
}

main().catch((e) => {
  console.error('FIX_FAIL', e.message || e)
  process.exit(1)
})
