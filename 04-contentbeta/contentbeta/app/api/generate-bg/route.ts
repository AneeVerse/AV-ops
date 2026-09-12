import { NextRequest, NextResponse } from 'next/server'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 300

const N8N_GENERATE_BG_WEBHOOK = n8nWebhook(
  'generate-bg',
  process.env.N8N_GENERATE_BG_WEBHOOK
)

/** Thin proxy: n8n returns ImageKit CDN URLs — no re-upload. */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const n8nRes = await fetch(N8N_GENERATE_BG_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await n8nRes.text()
    if (!n8nRes.ok) {
      return NextResponse.json(
        { error: `n8n error: ${text}` },
        { status: n8nRes.status >= 400 ? n8nRes.status : 502 }
      )
    }
    let data: { bgImageUrl?: string; logoUrl?: string; puppeteerConfig?: unknown; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Non-JSON response: ' + text }, { status: 502 })
    }
    if (!data.bgImageUrl) {
      return NextResponse.json({ error: 'No bgImageUrl in: ' + text }, { status: 502 })
    }
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generate-bg failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
