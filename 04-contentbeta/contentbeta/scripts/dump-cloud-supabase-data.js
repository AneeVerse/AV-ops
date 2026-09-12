#!/usr/bin/env node
/**
 * Dump public schema data from cloud Supabase as INSERT SQL.
 * Usage: node scripts/dump-cloud-supabase-data.js > /tmp/data.sql
 */
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return out
}

const env = { ...loadEnv(path.join(process.cwd(), '.env.local')), ...process.env }
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const TABLES = [
  'brands',
  'admins',
  'users',
  'brand_profiles',
  'brand_page_access',
  'reference_categories',
  'reference_layouts',
  'overlay_templates',
  'banner_templates',
  'broker_prompts',
  'ad_angles',
  'ad_angle_images',
  'ad_concepts',
  'carousel_layouts',
  'carousel_slide_prompts',
  'infographic_layouts',
  'illustration_layouts',
  'blog_layouts',
  'blog_layout_groups',
  'blog_layout_slots',
  'ppt_layouts',
  'ppt_slide_templates',
  'ppt_system_prompts',
  'generated_posts',
  'brand_system_jobs',
  'blog_jobs',
  'carousel_jobs',
  'infographic_jobs',
  'ppt_jobs',
  'ui_walkthrough_jobs',
  'infographics',
]

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'object') {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  }
  return `'${String(v).replace(/'/g, "''")}'`
}

async function fetchAll(table) {
  const rows = []
  let from = 0
  const page = 1000
  for (;;) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=${page}&offset=${from}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
      },
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`${table}: ${res.status} ${t}`)
    }
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < page) break
    from += page
  }
  return rows
}

;(async () => {
  console.log('-- Cloud data dump for ContentBeta public schema')
  console.log('BEGIN;')
  console.log('SET session_replication_role = replica;')
  for (const table of TABLES) {
    const rows = await fetchAll(table)
    console.error(`${table}: ${rows.length}`)
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    for (const row of rows) {
      const vals = cols.map((c) => sqlLiteral(row[c]))
      console.log(
        `INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;`
      )
    }
  }
  console.log('SET session_replication_role = DEFAULT;')
  console.log('COMMIT;')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
