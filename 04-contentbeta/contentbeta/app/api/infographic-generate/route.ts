import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

const N8N_WEBHOOK = n8nWebhook('infographic', process.env.N8N_INFOGRAPHIC_WEBHOOK)

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const body = await req.json()
    if (!body.brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    if (!body.adCopy) return NextResponse.json({ error: 'adCopy is required' }, { status: 400 })

    let n8nRes: Response
    try {
      n8nRes = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (fetchErr) {
      return NextResponse.json({ error: 'Could not reach workflow: ' + String(fetchErr) }, { status: 502 })
    }

    if (!n8nRes.ok) {
      const text = await n8nRes.text().catch(() => '')
      const isHtml = (n8nRes.headers.get('content-type') || '').includes('text/html')
      const message = isHtml
        ? `Workflow gateway error (${n8nRes.status}). Please try again.`
        : `Workflow error: ${text.slice(0, 200) || n8nRes.status}`
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return NextResponse.json({ status: 'processing' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
