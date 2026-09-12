import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const maxDuration = 60

const PREDICTION_TIMEOUT_MS = 55_000
const POLL_INTERVAL_MS = 2_000

function resolveOutputUrl(output: unknown) {
  if (Array.isArray(output)) return output[0]
  if (typeof output === 'string') return output
  return null
}

async function waitForPrediction(apiKey: string, prediction: any) {
  const start = Date.now()
  let current = prediction

  while (current?.status && current.status !== 'succeeded') {
    if (current.status === 'failed' || current.status === 'canceled') {
      throw new Error(`Prediction ${current.status}: ${current.error || 'unknown error'}`)
    }

    if (Date.now() - start > PREDICTION_TIMEOUT_MS) {
      throw new Error('Prediction timed out')
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const getUrl = current?.urls?.get || `https://api.replicate.com/v1/predictions/${current.id}`
    const pollRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!pollRes.ok) {
      const err = await pollRes.text()
      throw new Error(`Replicate poll error: ${err}`)
    }

    current = await pollRes.json()
  }

  return current
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

    const apiKey = process.env.REPLICATE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'REPLICATE_API_KEY not set' }, { status: 500 })

    // Start prediction using specific version
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        version: 'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc',
        input: { image: imageUrl },
      }),
    })

    if (!startRes.ok) {
      const err = await startRes.text()
      console.error('Replicate error:', err)
      return NextResponse.json({ error: err }, { status: 500 })
    }

    const prediction = await startRes.json()
    const completed = await waitForPrediction(apiKey, prediction)
    const outputUrl = resolveOutputUrl(completed.output)

    if (!outputUrl) {
      console.error('No output from Replicate:', completed)
      return NextResponse.json({ error: 'No output returned' }, { status: 500 })
    }

    // Fetch the transparent PNG and stream it back
    const imgRes = await fetch(outputUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'Failed to fetch result' }, { status: 500 })
    const buffer = Buffer.from(await imgRes.arrayBuffer())

    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(buffer.length) },
    })
  } catch (err) {
    console.error('remove-bg error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
