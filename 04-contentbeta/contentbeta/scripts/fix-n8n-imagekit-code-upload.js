/**
 * Replace ALL ImageKit HTTP Request upload nodes with Code nodes that
 * POST via this.helpers.httpRequest (avoids n8n multipart bugs).
 *
 * Run: node scripts/fix-n8n-imagekit-code-upload.js
 * Optional: node scripts/fix-n8n-imagekit-code-upload.js --only=0GdXvUqe4gLBdOvQ
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

function uploadCode(basicAuth, folder = '/generated-posts') {
  return `const item = $input.first();
const meta = item.json;
const mime = (item.binary && item.binary.data && item.binary.data.mimeType) || 'image/png';
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const fileName = (meta.storagePath || meta.fileName || ('upload-' + Date.now() + '.png')).toString().split('/').pop();
const dataUrl = 'data:' + mime + ';base64,' + buffer.toString('base64');

const boundary = '----n8nIkBoundary' + Date.now().toString(36);
const parts = [];
function addField(name, value) {
  parts.push(
    '--' + boundary + '\\r\\n' +
    'Content-Disposition: form-data; name=\"' + name + '\"\\r\\n\\r\\n' +
    value + '\\r\\n'
  );
}
addField('file', dataUrl);
addField('fileName', fileName);
addField('folder', '${folder}');
addField('useUniqueFileName', 'true');
parts.push('--' + boundary + '--\\r\\n');
const body = parts.join('');

let uploaded;
try {
  uploaded = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://upload.imagekit.io/api/v1/files/upload',
    headers: {
      Authorization: 'Basic ${basicAuth}',
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    },
    body,
    timeout: 120000,
  });
} catch (err) {
  throw new Error('ImageKit httpRequest failed: ' + (err.message || String(err)));
}

if (typeof uploaded === 'string') {
  try { uploaded = JSON.parse(uploaded); } catch (_) {}
}
if (!uploaded || !uploaded.url) {
  throw new Error('ImageKit upload failed: ' + JSON.stringify(uploaded));
}

return [{ json: Object.assign({}, meta, uploaded) }];`
}

const CONTENT_WORKFLOW_IDS = [
  'mSlCsDvjkPivv4cz', // Social V2
  'KBdS1q6xq5gzbbvF', // BG
  'R4msbvfEQlVfBlrX', // Broker
  'me2tVL5tt5Fdsje6', // Banner
  'ttm0h71vBjvpmqT0', // Illustrations
  '0GdXvUqe4gLBdOvQ', // Blog to Carousel
  'Se9fHwTFmBvLRLFS', // Carousel Images
  'SkdgsQbkylkim9VN', // Ad Concept
]

function extractBasicAuth(node) {
  const headers = node.parameters?.headerParameters?.parameters || []
  const auth = headers.find((h) => String(h.name || '').toLowerCase() === 'authorization')
  if (!auth?.value) return null
  const m = String(auth.value).match(/^Basic\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function isImageKitHttpUpload(node) {
  if (node.type !== 'n8n-nodes-base.httpRequest') return false
  return String(node.parameters?.url || '').includes('upload.imagekit.io')
}

function patchWorkflow(full, basicAuthFallback) {
  let changed = 0
  for (const node of full.nodes || []) {
    if (!isImageKitHttpUpload(node)) continue
    const basicAuth = extractBasicAuth(node) || basicAuthFallback
    if (!basicAuth) throw new Error('No ImageKit Basic auth for ' + node.name + ' in ' + full.name)
    const folder =
      (node.parameters?.bodyParameters?.parameters || []).find((p) => p.name === 'folder')?.value ||
      '/generated-posts'
    node.type = 'n8n-nodes-base.code'
    node.typeVersion = 2
    node.parameters = { jsCode: uploadCode(basicAuth, String(folder)) }
    delete node.credentials
    delete node.continueOnFail
    changed++
    console.log('  convert', node.name)
  }

  // Remove obsolete Prepare ImageKit File node if present
  const prepIdx = (full.nodes || []).findIndex((n) => n.name === 'Prepare ImageKit File')
  if (prepIdx >= 0) {
    const uploadTarget =
      findParentsThenChild(full.connections, 'Prepare ImageKit File') || 'Upload to ImageKit'
    full.nodes.splice(prepIdx, 1)
    for (const [src, outputs] of Object.entries(full.connections || {})) {
      for (const chain of outputs.main || []) {
        for (const link of chain || []) {
          if (link.node === 'Prepare ImageKit File') link.node = uploadTarget
        }
      }
    }
    delete full.connections['Prepare ImageKit File']
    changed++
  }
  return changed
}

function findParentsThenChild(connections, parentName) {
  const outs = connections?.[parentName]?.main?.[0]
  return outs?.[0]?.node || null
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env.local')), ...process.env }
  const api = (env.N8N_API_URL || '').replace(/\/$/, '')
  const key = env.N8N_API_KEY
  const ikPrivate = env.IMAGEKIT_PRIVATE_KEY
  if (!api || !key) throw new Error('Missing n8n env')
  const basicFallback = Buffer.from((ikPrivate || '') + ':').toString('base64')

  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
  const ids = only ? [only] : CONTENT_WORKFLOW_IDS

  for (const id of ids) {
    const full = await fetch(`${api}/api/v1/workflows/${id}`, {
      headers: { 'X-N8N-API-KEY': key },
    }).then((r) => r.json())
    if (!full?.name) {
      console.log('MISSING', id)
      continue
    }
    const wasActive = !!full.active
    const changed = patchWorkflow(full, basicFallback)
    if (!changed) {
      console.log('SKIP (already code)', full.name)
      continue
    }

    const payload = {
      name: full.name,
      nodes: full.nodes,
      connections: full.connections,
      settings: { executionOrder: full.settings?.executionOrder || 'v1' },
    }
    const res = await fetch(`${api}/api/v1/workflows/${id}`, {
      method: 'PUT',
      headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`PUT ${full.name}: ${res.status} ${text.slice(0, 400)}`)
    if (wasActive) {
      await fetch(`${api}/api/v1/workflows/${id}/activate`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': key },
      })
    }
    console.log('PATCHED', wasActive ? 'ON' : 'OFF', full.name, 'nodes=', changed)
  }
  console.log('FIX_CODE_UPLOAD_DONE')
}

main().catch((e) => {
  console.error('FIX_FAIL', e.message || e)
  process.exit(1)
})
