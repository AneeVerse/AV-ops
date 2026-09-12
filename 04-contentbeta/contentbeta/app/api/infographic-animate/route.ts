import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 180

const WEBHOOK = n8nWebhook('infographic-animate', process.env.N8N_INFOGRAPHIC_ANIMATE_WEBHOOK)

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const payload = await req.json()
    const n8nRes = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(170_000),
    })
    if (!n8nRes.ok) {
      const text = await n8nRes.text().catch(() => '')
      return NextResponse.json({ error: text || 'Workflow error' }, { status: 502 })
    }
    const data = await n8nRes.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
