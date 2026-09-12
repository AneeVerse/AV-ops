const fs = require('fs')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).trim()]
    })
)

const N8N_API = (env.N8N_API_URL || 'https://n8n.aneeverse.com').replace(/\/$/, '')
const N8N_KEY = env.N8N_API_KEY
const WF_ID = 'mSlCsDvjkPivv4cz'
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const CLOUD = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'aprhnzmk'
const CLOUD_KEY = env.CLOUDINARY_API_KEY || '296324118191888'
const OLD_SB = 'dhmjgwwqlttndjamrisv.supabase.co'
const NEW_SB_HOST = SB_URL.replace(/^https?:\/\//, '')

function sbHeaders() {
  return {
    parameters: [
      { name: 'apikey', value: SB_KEY },
      { name: 'Authorization', value: `Bearer ${SB_KEY}` },
    ],
  }
}

function replaceOldHost(str) {
  if (typeof str !== 'string') return str
  return str
    .split(OLD_SB).join(NEW_SB_HOST)
    .split('dfhqnoe6h').join(CLOUD)
    .split('dfhqnoc6h').join(CLOUD)
}

async function main() {
  const res = await fetch(`${N8N_API}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY },
  })
  if (!res.ok) throw new Error(`GET workflow failed: ${res.status} ${await res.text()}`)
  const wf = await res.json()

  const nodes = wf.nodes || []
  console.log('Loaded workflow:', wf.name, 'nodes:', nodes.length)

  for (const node of nodes) {
    const p = node.parameters || {}

    if (node.name === 'Fetch Brand Profile') {
      p.url = `=https://${NEW_SB_HOST}/rest/v1/brand_profiles?brand_id=eq.{{ $('Webhook').first().json.body.brandId }}&select=*&limit=1`
      p.headerParameters = sbHeaders()
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Fetch Reference Layouts') {
      p.url = `=https://${NEW_SB_HOST}/rest/v1/reference_layouts?category_id=eq.{{ $('Webhook').first().json.body.referenceCategoryId }}&select=*`
      p.headerParameters = sbHeaders()
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Extract and Prepare Image' && p.jsCode) {
      p.jsCode = replaceOldHost(p.jsCode)
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Upload Base To Cloudinary') {
      p.url = `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`
      if (p.bodyParameters?.parameters) {
        for (const bp of p.bodyParameters.parameters) {
          if (bp.name === 'api_key') bp.value = CLOUD_KEY
          if (bp.name === 'upload_preset') bp.value = 'n8n_generated_posts'
        }
      }
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Upload Logo To Cloudinary') {
      p.url = `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`
      if (p.bodyParameters?.parameters) {
        for (const bp of p.bodyParameters.parameters) {
          if (bp.name === 'api_key') bp.value = CLOUD_KEY
          if (bp.name === 'upload_preset') bp.value = 'n8n_generated_posts'
        }
      }
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Build Cloudinary Overlay URL' && p.jsCode) {
      p.jsCode = replaceOldHost(p.jsCode)
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Upload to Supabase Storage') {
      p.url = `=https://${NEW_SB_HOST}/storage/v1/object/generated-posts/{{ $('Extract and Prepare Image').first().json.storagePath }}`
      p.headerParameters = {
        parameters: [
          { name: 'apikey', value: SB_KEY },
          { name: 'Authorization', value: `Bearer ${SB_KEY}` },
          { name: 'Content-Type', value: 'image/png' },
          { name: 'x-upsert', value: 'true' },
        ],
      }
      console.log('Fixed:', node.name)
    }

    if (node.name === 'Save Generated Post') {
      p.url = `https://${NEW_SB_HOST}/rest/v1/generated_posts`
      p.headerParameters = {
        parameters: [
          { name: 'apikey', value: SB_KEY },
          { name: 'Authorization', value: `Bearer ${SB_KEY}` },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' },
        ],
      }
      console.log('Fixed:', node.name)
    }

    // catch-all old host leftovers
    if (typeof p.url === 'string') p.url = replaceOldHost(p.url)
    if (typeof p.jsCode === 'string') p.jsCode = replaceOldHost(p.jsCode)
    if (p.headerParameters?.parameters) {
      for (const h of p.headerParameters.parameters) {
        if (typeof h.value === 'string' && h.value.includes(OLD_SB.split('.')[0])) {
          if (h.name === 'apikey') h.value = SB_KEY
          if (h.name === 'Authorization') h.value = `Bearer ${SB_KEY}`
        }
      }
    }
  }

  // n8n PUT expects specific fields — keep settings minimal
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: {
      executionOrder: wf.settings?.executionOrder || 'v1',
    },
    staticData: wf.staticData ?? null,
  }

  const put = await fetch(`${N8N_API}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const putText = await put.text()
  console.log('PUT_STATUS', put.status)
  if (!put.ok) {
    console.log(putText.slice(0, 1000))
    process.exit(1)
  }

  // verify
  const verify = await fetch(`${N8N_API}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY },
  }).then((r) => r.json())

  for (const n of verify.nodes || []) {
    const raw = JSON.stringify(n.parameters || {})
    const bad =
      raw.includes('dhmjgwwqlttndjamrisv') ||
      raw.includes('dfhqnoe6h') ||
      raw.includes('dfhqnoc6h')
    const wrongFetch =
      n.name === 'Fetch Reference Layouts' && !raw.includes('/rest/v1/reference_layouts')
    const wrongSave =
      n.name === 'Save Generated Post' && !raw.includes('/rest/v1/generated_posts')
    console.log(
      (bad || wrongFetch || wrongSave ? 'BAD ' : 'OK  ') + n.name,
      n.parameters?.url ? String(n.parameters.url).slice(0, 100) : ''
    )
  }

  // activate if needed
  if (!verify.active) {
    const act = await fetch(`${N8N_API}/api/v1/workflows/${WF_ID}/activate`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': N8N_KEY },
    })
    console.log('ACTIVATE', act.status, await act.text())
  } else {
    console.log('Already active')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
