import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json() as {
      jobId: string
      brandId: string
      brandName: string
      title: string
      theme: Record<string, string>
      slides: unknown[]
      slideCount: number
      userEmail?: string | null
    }

    const { jobId, brandId, brandName, title, theme, slides, slideCount, userEmail } = body

    if (!jobId || !brandId || !slides?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: adminRow } = await supabase.from('admins').select('id').eq('email', user!.email).maybeSingle()
    if (!adminRow) {
      const { data: userRow } = await supabase.from('users').select('brand_id').eq('email', user!.email).maybeSingle()
      if (!userRow || userRow.brand_id !== brandId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { error: pptErr } = await supabase.from('ppt_jobs').insert({
      id: jobId,
      brand_id: brandId,
      brand_name: brandName,
      presentation_title: title,
      theme,
      slides,
      slide_count: slideCount,
    })

    if (pptErr) {
      console.error('[ppt-jobs] ppt_jobs insert error:', pptErr)
      return NextResponse.json({ error: pptErr.message }, { status: 500 })
    }

    const { error: histErr } = await supabase.from('generated_posts').insert({
      brand_id: brandId,
      is_ppt: true,
      headline: title,
      output_url: '',
      render_params: { job_id: jobId },
      created_by_email: userEmail ?? null,
    })

    if (histErr) {
      console.error('[ppt-jobs] generated_posts insert error:', histErr)
      // Non-fatal — job was saved; history entry just won't appear
    }

    return NextResponse.json({ jobId })
  } catch (err) {
    console.error('[ppt-jobs] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
