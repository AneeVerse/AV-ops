'use client'
import { authedFetch } from '@/lib/authed-fetch'

export type MediaUploadResult = {
  url: string
  publicUrl: string
  fileId: string
  filePath: string
  storagePath: string
  name: string
  thumbnailUrl?: string
}

export async function uploadMedia(
  file: Blob | File,
  opts?: { folder?: string; fileName?: string }
): Promise<MediaUploadResult> {
  const form = new FormData()
  const fileName =
    opts?.fileName ||
    (file instanceof File && file.name ? file.name : `upload-${Date.now()}.bin`)
  form.append('file', file, fileName)
  if (opts?.folder) form.append('folder', opts.folder)
  form.append('fileName', fileName)

  const res = await authedFetch('/api/media/upload', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data as MediaUploadResult
}

export async function deleteMediaClient(opts: {
  fileId?: string | null
  url?: string | null
  filePath?: string | null
  storagePath?: string | null
}): Promise<void> {
  const res = await authedFetch('/api/media/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileId: opts.fileId || undefined,
      url: opts.url || undefined,
      filePath: opts.filePath || opts.storagePath || undefined,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Delete failed')
  }
}
