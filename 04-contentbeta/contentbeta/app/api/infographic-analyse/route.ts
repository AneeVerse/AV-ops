import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 60

const N8N_WEBHOOK = n8nWebhook('infographic-analyse', process.env.N8N_INFOGRAPHIC_ANALYSE_WEBHOOK)

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const body = await req.json()
    if (!body.adCopy) return NextResponse.json({ error: 'adCopy is required' }, { status: 400 })

    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    })

    if (!n8nRes.ok) {
      const text = await n8nRes.text().catch(() => '')
      const isHtml = (n8nRes.headers.get('content-type') || '').includes('text/html')
      const message = isHtml
        ? `Workflow gateway error (${n8nRes.status}). Please try again.`
        : `Workflow error: ${text.slice(0, 200) || n8nRes.status}`
      return NextResponse.json({ error: message }, { status: 502 })
    }

    const data = await n8nRes.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
