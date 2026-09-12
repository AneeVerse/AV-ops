import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { normalizeFolder, uploadBuffer } from '@/lib/imagekit'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req)
  if (error) return error

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const folderRaw = String(form.get('folder') || req.nextUrl.searchParams.get('folder') || 'generated-posts')
    const folder = normalizeFolder(folderRaw)
    const explicitName = String(form.get('fileName') || file.name || `upload-${Date.now()}`)
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadBuffer({
      buffer,
      fileName: explicitName,
      folder,
      contentType: file.type || undefined,
    })

    return NextResponse.json({
      url: uploaded.url,
      publicUrl: uploaded.url,
      fileId: uploaded.fileId,
      filePath: uploaded.filePath,
      storagePath: uploaded.filePath.replace(/^\//, ''),
      name: uploaded.name,
      thumbnailUrl: uploaded.thumbnailUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
