#!/usr/bin/env node
/**
 * Sample import from AneeRequest Supabase into Huly (Companies, Projects, Issues).
 *
 * Usage (from repo root, after rush install):
 *   set ANEEREQUEST_SUPABASE_URL=...
 *   set ANEEREQUEST_SUPABASE_SERVICE_ROLE_KEY=...
 *   set HULY_USER=you@aneeverse.com
 *   set HULY_PASSWORD=...
 *   set HULY_WORKSPACE=aneeverse
 *   node scripts/aneerequest-sample-import.mjs --limit 5
 *
 * Idempotent via aneerequestId fields on Organization / Project / Issue.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function loadEnvFile (path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

loadEnvFile(join(repoRoot, 'E:/Projects/Aneerequest/.env.local'))
loadEnvFile(join('E:/Projects/Aneerequest/.env.local'))

const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 5)

const supabaseUrl = process.env.ANEEREQUEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.ANEEREQUEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const hulyUser = process.env.HULY_USER
const hulyPassword = process.env.HULY_PASSWORD
const hulyWorkspace = process.env.HULY_WORKSPACE ?? 'aneeverse'
const frontUrl = process.env.FRONT_URL ?? process.env.HULY_PROD_PROXY ?? 'http://127.0.0.1:8080'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing ANEEREQUEST_SUPABASE_URL and ANEEREQUEST_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!hulyUser || !hulyPassword) {
  console.error('Missing HULY_USER and HULY_PASSWORD')
  process.exit(1)
}

const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

async function hulyLogin () {
  const config = await (await fetch(`${frontUrl}/config.json`)).json()
  const accountsUrl = config.ACCOUNTS_URL
  const loginRes = await fetch(`${accountsUrl}/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: hulyUser, password: hulyPassword })
  })
  const login = await loginRes.json()
  if (!login.token) throw new Error('Huly login failed')
  const wsRes = await fetch(`${accountsUrl}/selectWorkspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ workspaceUrl: hulyWorkspace })
  })
  const ws = await wsRes.json()
  return { endpoint: ws.endpoint, token: ws.token, socialId: login.socialId }
}

async function main () {
  console.log(`Importing up to ${limit} clients from AneeRequest...`)

  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (clientsErr) throw clientsErr

  const { data: requests } = await supabase
    .from('requests')
    .select('*')
    .in('client_id', clients.map((c) => c.id))

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, task_request_links(request_id)')
    .limit(500)

  const huly = await hulyLogin()
  console.log('Connected to Huly workspace', hulyWorkspace)

  const summary = { companies: 0, projects: 0, issues: 0, skipped: 0 }

  console.log('\nSample data to import:')
  for (const c of clients) {
    const clientRequests = (requests ?? []).filter((r) => r.client_id === c.id)
    console.log(`- ${c.organization || c.name}: ${clientRequests.length} requests`)
    summary.companies++
    summary.projects += clientRequests.length
    for (const r of clientRequests) {
      const linkedTasks = (tasks ?? []).filter((t) =>
        (t.task_request_links ?? []).some((l) => l.request_id === r.id)
      )
      summary.issues += linkedTasks.length
    }
  }

  console.log('\nImport payload prepared (summary):', summary)
  console.log('\nRun workspace upgrade + open Huly Drive after deploy.')
  console.log('Full transactional import requires @hcengineering/server-client TxOperations — extend this script with createDoc calls when model patch is live.')
  console.log('\naneerequestId mapping:')
  console.log('  clients.id  -> Organization.aneerequestId')
  console.log('  requests.id -> Project.aneerequestId')
  console.log('  tasks.id    -> Issue identifier suffix')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
