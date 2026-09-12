import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 300

const N8N_BANNER_WEBHOOK = n8nWebhook(
  'generate-banner',
  process.env.N8N_GENERATE_BANNER_WEBHOOK
)

/** Thin auth proxy: n8n returns ImageKit CDN URLs — no re-upload. */
export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const body = await req.json()
    const { brandId, copy, bgPrompt } = body

    if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    if (!copy?.heading) return NextResponse.json({ error: 'heading is required' }, { status: 400 })

    const n8nRes = await fetch(N8N_BANNER_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, copy, bgPrompt: bgPrompt || '' }),
      signal: AbortSignal.timeout(280_000),
    })

    if (!n8nRes.ok) {
      const text = await n8nRes.text().catch(() => '')
      return NextResponse.json({ error: `Workflow error: ${text || n8nRes.status}` }, { status: 502 })
    }

    const data = await n8nRes.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
