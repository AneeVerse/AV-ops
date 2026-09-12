import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { stitchWalkthrough } from '@/lib/ui-walkthrough/stitch-engine'
import type { WalkthroughScene } from '@/lib/ui-walkthrough/types'

export const maxDuration = 60

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Final step after the user has reviewed (and optionally regenerated) each screen's
 * recreation/elements via /api/ui-walkthrough/analyze-screens. Purely deterministic —
 * no AI call here, just lib/ui-walkthrough/stitch-engine's template assembly — so it's
 * fast and cheap to run once the user is happy with the review.
 */
export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  let jobIdForError: string | undefined
  let brandIdForError: string | undefined

  try {
    const body = await req.json() as { brandId?: string; jobId?: string; scenes?: WalkthroughScene[] }
    const { brandId, jobId, scenes } = body
    jobIdForError = jobId
    brandIdForError = brandId

    if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'At least one scene is required' }, { status: 400 })
    }

    const { code } = stitchWalkthrough(scenes)

    // screens here is a record-keeping snapshot, not something playback depends on —
    // the stitched code is fully self-contained (embeds the recreated HTML itself).
    await supabase.from('ui_walkthrough_jobs').upsert({
      id: jobId,
      brand_id: brandId,
      screens: scenes,
      stitched_code: code,
      status: 'done',
    })

    return NextResponse.json({ jobId, code })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (jobIdForError && brandIdForError) {
      await supabase.from('ui_walkthrough_jobs').upsert({
        id: jobIdForError,
        brand_id: brandIdForError,
        status: 'error',
        error_message: msg,
      }).then(() => {}, () => {})
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
