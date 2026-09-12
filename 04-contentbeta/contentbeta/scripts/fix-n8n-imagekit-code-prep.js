/**
 * Insert "Prepare ImageKit File" Code node before ImageKit HTTP uploads
 * so multipart `file` is a data-URL (works with binaryMode=separate).
 *
 * Run: node scripts/fix-n8n-imagekit-code-prep.js
 */
const fs = require('fs')
const path = require('path')

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

const PREP_CODE = `const item = $input.first();
const meta = item.json;
const mime = (item.binary && item.binary.data && item.binary.data.mimeType) || 'image/png';
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const imageKitDataUrl = 'data:' + mime + ';base64,' + buffer.toString('base64');
return [{ json: { ...meta, imageKitDataUrl }, binary: item.binary }];`

const FILE_VALUE = "={{ $json.imageKitDataUrl }}"
const PREP_NAME = 'Prepare ImageKit File'

/** uploadNodeName -> preferred upstream name (optional) */
const TARGETS = [
  { id: 'mSlCsDvjkPivv4cz', uploadName: 'Upload to ImageKit', preferFrom: 'Extract and Prepare Image' },
  { id: 'KBdS1q6xq5gzbbvF', uploadName: 'Upload BG to ImageKit', preferFrom: 'Extract BG Image' },
  { id: 'R4msbvfEQlVfBlrX', uploadName: 'Upload to ImageKit' },
  { id: 'me2tVL5tt5Fdsje6', uploadName: 'Upload to ImageKit' },
  { id: 'ttm0h71vBjvpmqT0', uploadName: 'Upload to ImageKit' },
]

function findParents(connections, childName) {
  const parents = []
  for (const [src, outputs] of Object.entries(connections || {})) {
    for (const chain of outputs.main || []) {
      for (const link of chain || []) {
        if (link.node === childName) parents.push(src)
      }
    }
  }
  return parents
}

function replaceChildLinks(connections, parent, fromChild, toChild) {
  const outputs = connections[parent]
  if (!outputs?.main) return
  for (const chain of outputs.main) {
    for (const link of chain || []) {
      if (link.node === fromChild) link.node = toChild
    }
  }
}

function setMainConnection(connections, from, to) {
  connections[from] = { main: [[{ node: to, type: 'main', index: 0 }]] }
}

function patchWorkflow(full, { uploadName, preferFrom }) {
  const upload = (full.nodes || []).find((n) => n.name === uploadName)
  if (!upload) return false
  if (!String(upload.parameters?.url || '').includes('upload.imagekit.io')) return false

  const params = upload.parameters?.bodyParameters?.parameters
  if (!Array.isArray(params)) return false
  const fileParam = params.find((p) => p.name === 'file')
  if (!fileParam) return false
  Object.keys(fileParam).forEach((k) => delete fileParam[k])
  fileParam.name = 'file'
  fileParam.value = FILE_VALUE
  upload.parameters.options = { ...(upload.parameters.options || {}), timeout: 120000 }

  let prep = (full.nodes || []).find((n) => n.name === PREP_NAME)
  if (!prep) {
    const pos = upload.position || [1400, 0]
    prep = {
      parameters: { jsCode: PREP_CODE },
      id: 'prep-imagekit-' + Math.random().toString(36).slice(2, 10),
      name: PREP_NAME,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [pos[0] - 220, pos[1]],
    }
    full.nodes.push(prep)
  } else {
    prep.parameters = { jsCode: PREP_CODE }
  }

  full.connections = full.connections || {}

  // Parents that currently point at Upload (or already at Prep)
  let parents = findParents(full.connections, uploadName)
  if (!parents.length) parents = findParents(full.connections, PREP_NAME)
  if (preferFrom && (full.nodes || []).some((n) => n.name === preferFrom)) {
    parents = [preferFrom]
  }
  if (!parents.length) throw new Error(`No parent found for ${uploadName} in ${full.name}`)

  for (const parent of parents) {
    if (parent === PREP_NAME) continue
    replaceChildLinks(full.connections, parent, uploadName, PREP_NAME)
    // Also ensure preferFrom connects to prep even if it was pointing elsewhere
    if (preferFrom && parent === preferFrom) {
      setMainConnection(full.connections, preferFrom, PREP_NAME)
    }
  }
  setMainConnection(full.connections, PREP_NAME, uploadName)

  return true
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env.local')), ...process.env }
  const api = (env.N8N_API_URL || '').replace(/\/$/, '')
  const key = env.N8N_API_KEY
  if (!api || !key) throw new Error('Missing n8n env')

  for (const t of TARGETS) {
    const full = await fetch(`${api}/api/v1/workflows/${t.id}`, {
      headers: { 'X-N8N-API-KEY': key },
    }).then((r) => r.json())
    if (!full?.id && !full?.name) {
      console.log('MISSING', t.id)
      continue
    }
    const wasActive = !!full.active
    patchWorkflow(full, t)

    const payload = {
      name: full.name,
      nodes: full.nodes,
      connections: full.connections,
      settings: { executionOrder: full.settings?.executionOrder || 'v1' },
    }
    const res = await fetch(`${api}/api/v1/workflows/${t.id}`, {
      method: 'PUT',
      headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`PUT ${full.name}: ${res.status} ${text.slice(0, 400)}`)
    if (wasActive) {
      const act = await fetch(`${api}/api/v1/workflows/${t.id}/activate`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': key },
      })
      if (!act.ok) console.warn('activate warn', full.name, await act.text())
    }
    console.log('PATCHED', wasActive ? 'ON' : 'OFF', full.name)
  }
  console.log('FIX_CODE_PREP_DONE')
}

main().catch((e) => {
  console.error('FIX_FAIL', e.message || e)
  process.exit(1)
})
