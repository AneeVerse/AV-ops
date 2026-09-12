#!/usr/bin/env node
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

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env.local')), ...process.env }
  const api = env.N8N_API_URL.replace(/\/$/, '')
  const key = env.N8N_API_KEY
  const w = await fetch(`${api}/api/v1/workflows/R4msbvfEQlVfBlrX`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json())
  const pick = w.nodes.find((n) => n.name === 'Pick Prompt')
  if (!pick) throw new Error('Pick Prompt missing')
  const demo = '4d9f2a2d-1d28-41fe-a371-d35b9efaee3b'
  const nextLine =
    "const brandId = ($('Webhook Broker').first().json.body && $('Webhook Broker').first().json.body.brandId) || '" +
    demo +
    "';"
  pick.parameters.jsCode = pick.parameters.jsCode.replace(/const brandId = '[^']+';/, nextLine)
  console.log('brandId line:', pick.parameters.jsCode.match(/const brandId[\s\S]{0,140}/)?.[0])

  const payload = {
    name: w.name,
    nodes: w.nodes,
    connections: w.connections,
    settings: { executionOrder: w.settings?.executionOrder || 'v1' },
  }
  const res = await fetch(`${api}/api/v1/workflows/R4msbvfEQlVfBlrX`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('PUT ' + res.status + ' ' + (await res.text()).slice(0, 200))
  await fetch(`${api}/api/v1/workflows/R4msbvfEQlVfBlrX/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': key },
  })
  console.log('BROKER_BRAND_FIXED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
