import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { deleteMedia } from '@/lib/imagekit'

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req)
  if (error) return error

  try {
    const body = await req.json()
    const fileId = body.fileId as string | undefined
    const url = body.url as string | undefined
    const filePath = (body.filePath || body.storagePath) as string | undefined
    if (!fileId && !url && !filePath) {
      return NextResponse.json({ error: 'fileId, url, or filePath required' }, { status: 400 })
    }
    await deleteMedia({ fileId, url, filePath })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
