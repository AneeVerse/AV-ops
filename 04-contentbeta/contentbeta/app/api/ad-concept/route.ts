import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 300

const WEBHOOK = n8nWebhook('ad-concept', process.env.N8N_AD_CONCEPT_WEBHOOK)

/** Thin auth proxy: n8n returns ImageKit CDN URLs — no re-upload. */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const payload = await req.json()
    const n8nRes = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await n8nRes.text()
    if (!n8nRes.ok) {
      return NextResponse.json({ error: `HTTP ${n8nRes.status}: ${text}` }, { status: n8nRes.status >= 400 ? n8nRes.status : 502 })
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Non-JSON: ' + text }, { status: 502 })
    }
    const data = (Array.isArray(parsed) ? parsed[0] : parsed) as {
      imageUrl?: string
      visualReferenceUrl?: string
      puppeteerConfig?: unknown
      logoUrl?: string
    }
    if (!data?.imageUrl) {
      return NextResponse.json({ error: 'No imageUrl in response: ' + text }, { status: 502 })
    }
    return NextResponse.json({
      imageUrl: data.imageUrl,
      visualReferenceUrl: data.visualReferenceUrl || '',
      puppeteerConfig: data.puppeteerConfig || null,
      logoUrl: data.logoUrl || null,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
