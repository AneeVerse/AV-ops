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
const api = env.N8N_API_URL.replace(/\/$/, '')
const key = env.N8N_API_KEY
const WF_ID = 'mSlCsDvjkPivv4cz'

;(async () => {
  const wf = await fetch(`${api}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json())

  // Bypass Cloudinary for reliability: Extract -> Supabase Storage -> Save -> Respond
  wf.connections = {
    Webhook: { main: [[{ node: 'Fetch Brand Profile', type: 'main', index: 0 }]] },
    'Fetch Brand Profile': { main: [[{ node: 'Fetch Reference Layouts', type: 'main', index: 0 }]] },
    'Fetch Reference Layouts': { main: [[{ node: 'Build Prompt', type: 'main', index: 0 }]] },
    'Build Prompt': { main: [[{ node: 'Generate Image', type: 'main', index: 0 }]] },
    'Generate Image': { main: [[{ node: 'Extract and Prepare Image', type: 'main', index: 0 }]] },
    'Extract and Prepare Image': { main: [[{ node: 'Upload to Supabase Storage', type: 'main', index: 0 }]] },
    'Upload to Supabase Storage': { main: [[{ node: 'Save Generated Post', type: 'main', index: 0 }]] },
    'Save Generated Post': { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] },
  }

  const put = await fetch(`${api}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: { executionOrder: 'v1' },
      staticData: wf.staticData ?? null,
    }),
  })
  console.log('PUT', put.status)
  if (!put.ok) console.log(await put.text())
  else console.log('Bypassed Cloudinary — direct Supabase upload path active')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
