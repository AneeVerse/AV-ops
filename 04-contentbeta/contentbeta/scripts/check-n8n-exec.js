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
const key = env.N8N_API_KEY
const api = env.N8N_API_URL.replace(/\/$/, '')

;(async () => {
  const list = await fetch(`${api}/api/v1/executions?workflowId=mSlCsDvjkPivv4cz&limit=3`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json())
  const id = list.data?.[0]?.id
  console.log('latest', id, list.data?.[0]?.status, list.data?.[0]?.startedAt)
  const ex = await fetch(`${api}/api/v1/executions/${id}?includeData=true`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json())
  const run = ex.data?.resultData || ex.resultData
  console.log('top', run?.error?.description || run?.error?.message || '')
  for (const [name, arr] of Object.entries(run?.runData || {})) {
    const last = arr[arr.length - 1]
    if (last?.error) {
      console.log('FAIL', name)
      console.log(' ', last.error.description || last.error.message || JSON.stringify(last.error).slice(0, 400))
    } else {
      console.log('OK  ', name)
    }
  }
})()
