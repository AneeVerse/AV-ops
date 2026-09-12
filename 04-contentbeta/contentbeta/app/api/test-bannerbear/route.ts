import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

const BB_API_KEY = process.env.BANNERBEAR_API_KEY || 'bb_pr_a406db42e5135de42f7cad3d6fb469'
const BB_BASE = 'https://api.bannerbear.com/v2'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const { templateUid, modifications } = await req.json()

  if (!templateUid) {
    return NextResponse.json({ error: 'Template UID is required' }, { status: 400 })
  }

  const headers = {
    'Authorization': `Bearer ${BB_API_KEY}`,
    'Content-Type': 'application/json',
  }

  // Create image job
  const createRes = await fetch(`${BB_BASE}/images`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template: templateUid, modifications: modifications || [] }),
  })

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.message || `BannerBear error ${createRes.status}` }, { status: createRes.status })
  }

  const job = await createRes.json()

  // Poll until status is "completed" (max 30s)
  const uid: string = job.uid
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))
    const pollRes = await fetch(`${BB_BASE}/images/${uid}`, { headers })
    if (!pollRes.ok) continue
    const data = await pollRes.json()
    if (data.status === 'completed') return NextResponse.json(data)
    if (data.status === 'failed') return NextResponse.json({ error: 'BannerBear render failed' }, { status: 500 })
  }

  return NextResponse.json({ error: 'Timed out waiting for BannerBear render' }, { status: 504 })
}

// Fetch templates list
export async function GET() {
  const res = await fetch(`${BB_BASE}/templates`, {
    headers: { 'Authorization': `Bearer ${BB_API_KEY}` },
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: err.message || 'Failed to fetch templates' }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
