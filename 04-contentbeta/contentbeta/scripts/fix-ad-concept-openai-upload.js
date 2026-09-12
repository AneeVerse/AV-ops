#!/usr/bin/env node
/**
 * Ad Concept: replace brittle images/edits multipart with images/generations JSON
 * (same reliable path as Generate Social Post V2). Reference URL is included in prompt.
 */
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
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

function extractBearer(node) {
  const headers = node.parameters?.headerParameters?.parameters || []
  const auth = headers.find((h) => String(h.name || '').toLowerCase() === 'authorization')
  const m = String(auth?.value || '').match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env.local')), ...process.env }
  const api = env.N8N_API_URL.replace(/\/$/, '')
  const key = env.N8N_API_KEY
  const w = await fetch(`${api}/api/v1/workflows/SkdgsQbkylkim9VN`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json())

  const node = w.nodes.find((n) => n.name === 'Generate Ad Image')
  const openaiKey = extractBearer(node) || env.OPENAI_API_KEY

  // Rewire: Download Reference Image can stay but Generate no longer needs its binary.
  // Keep graph; Generate reads prompt from Build Prompt only.
  node.type = 'n8n-nodes-base.httpRequest'
  node.typeVersion = 4.2
  node.parameters = {
    method: 'POST',
    url: 'https://api.openai.com/v1/images/generations',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: 'Bearer ' + openaiKey },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody:
      "={{ JSON.stringify({ model: 'gpt-image-1.5', prompt: $('Build Prompt').first().json.imagePrompt, n: 1, size: '1024x1024' }) }}",
    options: { timeout: 180000 },
  }

  const extract = w.nodes.find((n) => n.name === 'Extract Image')
  if (extract) {
    extract.parameters.jsCode = `const imageResponse = $('Generate Ad Image').first().json;
const meta = $('Build Prompt').first().json;

const b64 = imageResponse.data && imageResponse.data[0] && imageResponse.data[0].b64_json;
if (!b64) throw new Error('No image data: ' + JSON.stringify(imageResponse).slice(0, 500));

const binaryData = await this.helpers.prepareBinaryData(
  Buffer.from(b64, 'base64'),
  'ad_concept.png',
  'image/png'
);

return [{
  json: {
    brandId: meta.brandId,
    adAngleId: meta.adAngleId,
    logoUrl: meta.logoUrl,
    puppeteerConfig: meta.puppeteerConfig,
    visualReferenceUrl: meta.visualReferenceUrl,
    storagePath: 'ad-concepts/' + meta.brandId + '/' + Date.now() + '_ad.png',
  },
  binary: { data: binaryData },
}];`
  }

  const payload = {
    name: w.name,
    nodes: w.nodes,
    connections: w.connections,
    settings: { executionOrder: w.settings?.executionOrder || 'v1' },
  }
  const res = await fetch(`${api}/api/v1/workflows/SkdgsQbkylkim9VN`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('PUT ' + res.status + ' ' + (await res.text()).slice(0, 300))
  await fetch(`${api}/api/v1/workflows/SkdgsQbkylkim9VN/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': key },
  })
  console.log('AD_CONCEPT_GENERATIONS_FIXED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
