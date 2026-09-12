import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/ppt-prompts — return all rows as { name, content }[]
export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const { data, error } = await supabase
    .from('ppt_system_prompts')
    .select('name,content')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/ppt-prompts — upsert { name, content }
export async function POST(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const { name, content } = await req.json() as { name: string; content: string }
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { error } = await supabase
    .from('ppt_system_prompts')
    .upsert({ name, content }, { onConflict: 'name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/ppt-prompts?name=xxx — delete one row
export async function DELETE(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const name = new URL(req.url).searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { error } = await supabase
    .from('ppt_system_prompts')
    .delete()
    .eq('name', name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
