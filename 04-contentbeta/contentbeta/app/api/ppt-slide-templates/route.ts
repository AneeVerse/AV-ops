import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/ppt-slide-templates?brandId=xxx
export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('ppt_slide_templates')
    .select('template_name,prompt_text,layout_config')
    .eq('brand_id', brandId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/ppt-slide-templates — upsert a row
export async function POST(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const body = await req.json() as {
    brandId: string
    templateName: string
    promptText?: string | null
    layoutConfig?: string | null
  }

  const { brandId, templateName, promptText, layoutConfig } = body
  if (!brandId || !templateName) {
    return NextResponse.json({ error: 'brandId and templateName required' }, { status: 400 })
  }
  if (layoutConfig !== undefined && layoutConfig !== null) {
    let parsed: unknown
    try {
      parsed = typeof layoutConfig === 'string' ? JSON.parse(layoutConfig) : layoutConfig
    } catch (error) {
      return NextResponse.json({ error: `Invalid layout JSON: ${(error as Error).message}` }, { status: 400 })
    }
    if (
      !parsed
      || typeof parsed !== 'object'
      || typeof (parsed as { background?: unknown }).background !== 'string'
      || !Array.isArray((parsed as { elements?: unknown }).elements)
    ) {
      return NextResponse.json(
        { error: 'Layout must contain a "background" string and an "elements" array.' },
        { status: 400 }
      )
    }
  }

  // Check if a row already exists so we can UPDATE only the columns being changed
  // (upsert would null out prompt_text when saving layout-only if no row exists yet)
  const { data: existing } = await supabase
    .from('ppt_slide_templates')
    .select('template_name')
    .eq('brand_id', brandId)
    .eq('template_name', templateName)
    .maybeSingle()

  if (existing) {
    const updates: Record<string, unknown> = {}
    if (promptText !== undefined) updates.prompt_text = promptText
    if (layoutConfig !== undefined) updates.layout_config = layoutConfig
    const { error } = await supabase
      .from('ppt_slide_templates')
      .update(updates)
      .eq('brand_id', brandId)
      .eq('template_name', templateName)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('ppt_slide_templates')
      .insert({
        brand_id: brandId,
        template_name: templateName,
        prompt_text: promptText || null,
        layout_config: layoutConfig ?? null,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/ppt-slide-templates?brandId=xxx&templateName=yyy
export async function DELETE(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const templateName = searchParams.get('templateName')
  if (!brandId || !templateName) {
    return NextResponse.json({ error: 'brandId and templateName required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ppt_slide_templates')
    .delete()
    .eq('brand_id', brandId)
    .eq('template_name', templateName)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
