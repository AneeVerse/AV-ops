import { NextRequest, NextResponse } from 'next/server'
import { n8nWebhook } from '@/lib/n8n'

export const maxDuration = 300

const N8N_GENERATE_WEBHOOK = n8nWebhook(
  'generate',
  process.env.N8N_GENERATE_WEBHOOK
)

/** Thin proxy: auth/CORS only. n8n returns ImageKit CDN URLs — no re-upload. */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const n8nRes = await fetch(N8N_GENERATE_WEBHOOK, {
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
    let data: { imageUrl?: string; output_url?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Non-JSON response: ' + text }, { status: 502 })
    }
    const imageUrl = data.imageUrl || data.output_url
    if (!imageUrl) {
      return NextResponse.json({ error: 'No imageUrl in: ' + text }, { status: 502 })
    }
    return NextResponse.json({ imageUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
