import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 60

const WEBHOOK = n8nWebhook('carousel-images', process.env.N8N_CAROUSEL_IMAGES_WEBHOOK)

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const payload = await req.json()
    const n8nRes = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null)
    if (!n8nRes || !n8nRes.ok) {
      return NextResponse.json({ status: 'accepted' })
    }
    return NextResponse.json({ status: 'processing' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
