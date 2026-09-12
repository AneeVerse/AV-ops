const fs = require('fs')
const path = require('path')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).trim()]
    })
)

const api = env.N8N_API_URL.replace(/\/$/, '')
const key = env.N8N_API_KEY
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI = env.OPENAI_API_KEY
const OLD = 'dhmjgwwqlttndjamrisv.supabase.co'
const NEW_HOST = SB_URL.replace(/^https?:\/\//, '')

function replaceAll(str) {
  if (typeof str !== 'string') return str
  let out = str.split(OLD).join(NEW_HOST)
  // replace old service role JWTs in headers with new key when present
  return out
}

;(async () => {
  const raw = JSON.parse(
    fs.readFileSync(path.join('n8n-workflows', 'n8n_generate_bg_workflow.json'), 'utf8')
  )

  // Fix hosts + keys on all nodes
  for (const node of raw.nodes) {
    const p = node.parameters || {}
    if (typeof p.url === 'string') p.url = replaceAll(p.url)
    if (typeof p.jsCode === 'string') p.jsCode = replaceAll(p.jsCode)
    if (typeof p.body === 'string') p.body = replaceAll(p.body)
    if (p.headerParameters?.parameters) {
      for (const h of p.headerParameters.parameters) {
        if (h.name === 'apikey') h.value = SB_KEY
        if (h.name === 'Authorization' && String(h.value).startsWith('Bearer eyJ')) {
          h.value = `Bearer ${SB_KEY}`
        }
        if (h.name === 'Authorization' && String(h.value).startsWith('Bearer sk-')) {
          h.value = `Bearer ${OPENAI}`
        }
      }
    }
  }

  // Bypass Cloudinary: Extract BG Image -> Build Response with data URL
  const extract = raw.nodes.find((n) => n.name === 'Extract BG Image')
  const build = raw.nodes.find((n) => n.name === 'Build Response')
  if (extract) {
    extract.parameters.jsCode = `const imageResp = $input.first().json;
const meta = $('Build BG Prompt').first().json;

const imageData = imageResp.data && imageResp.data[0];
if (!imageData || !imageData.b64_json) throw new Error('No image data in response: ' + JSON.stringify(imageResp));

const bgImageUrl = 'data:image/png;base64,' + imageData.b64_json;

return [{
  json: {
    brandId: meta.brandId,
    logoUrl: meta.logoUrl,
    puppeteerConfig: meta.puppeteerConfig,
    storagePath: meta.storagePath,
    bgImageUrl
  }
}];`
  }
  if (build) {
    build.parameters.jsCode = `const meta = $('Extract BG Image').first().json;
if (!meta.bgImageUrl) throw new Error('Missing bgImageUrl');
return [{
  json: {
    bgImageUrl: meta.bgImageUrl,
    logoUrl: meta.logoUrl || '',
    puppeteerConfig: meta.puppeteerConfig
  }
}];`
  }

  raw.connections['Extract BG Image'] = {
    main: [[{ node: 'Build Response', type: 'main', index: 0 }]],
  }
  // leave Cloudinary node orphaned (unused)

  // Webhook should use responseMode responseNode for Respond to Webhook
  const webhook = raw.nodes.find((n) => n.name === 'Webhook')
  if (webhook) {
    webhook.parameters.responseMode = 'responseNode'
  }

  const create = await fetch(`${api}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Generate Background Image (Overlay Workflow)',
      nodes: raw.nodes,
      connections: raw.connections,
      settings: { executionOrder: 'v1' },
    }),
  })
  const createdText = await create.text()
  console.log('CREATE', create.status)
  if (!create.ok) {
    console.log(createdText.slice(0, 800))
    process.exit(1)
  }
  const created = JSON.parse(createdText)
  console.log('ID', created.id)

  const act = await fetch(`${api}/api/v1/workflows/${created.id}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': key },
  })
  console.log('ACTIVATE', act.status, (await act.text()).slice(0, 200))

  // quick webhook ping
  const ping = await fetch(`${api}/webhook/generate-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId: 'x' }),
  })
  console.log('WEBHOOK_PING', ping.status, (await ping.text()).slice(0, 200))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
