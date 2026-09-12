import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 300

const WEBHOOK = n8nWebhook('generate-broker', process.env.N8N_GENERATE_BROKER_WEBHOOK)

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
      return NextResponse.json({ error: `n8n error: ${text}` }, { status: n8nRes.status >= 400 ? n8nRes.status : 502 })
    }
    let data: { imageUrl?: string; output_url?: string } | Array<{ imageUrl?: string; output_url?: string }>
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Non-JSON response' }, { status: 502 })
    }
    const item = Array.isArray(data) ? data[0] : data
    const imageUrl = item?.imageUrl || item?.output_url
    if (!imageUrl) return NextResponse.json({ error: 'No imageUrl' }, { status: 502 })
    return NextResponse.json({ imageUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
