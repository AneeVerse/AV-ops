import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

const N8N_WEBHOOK = n8nWebhook('blog-images', process.env.N8N_BLOG_IMAGES_WEBHOOK)

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const body = await req.json()
    if (!body.brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    if (!body.pdfUrl) return NextResponse.json({ error: 'pdfUrl is required' }, { status: 400 })
    if (!body.layoutGroupId) return NextResponse.json({ error: 'No JSON layout selected' }, { status: 400 })

    let r: Response
    try {
      r = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (fetchErr) {
      return NextResponse.json({ error: 'Could not reach workflow: ' + String(fetchErr) }, { status: 502 })
    }

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      const isHtml = (r.headers.get('content-type') || '').includes('text/html')
      const message = isHtml
        ? `Workflow gateway error (${r.status}). Please try again.`
        : `Workflow error (${r.status}): ${text.slice(0, 200)}`
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return NextResponse.json({ status: 'processing' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
