import { ImageKit, toFile } from '@imagekit/nodejs'

export type ImageKitUploadResult = {
  url: string
  fileId: string
  filePath: string
  name: string
  thumbnailUrl?: string
}

const ALLOWED_FOLDERS = new Set([
  'generated-posts',
  'brand-logos',
  'ad-angle-images',
  'broker-reference-images',
  'brand-setup-inputs',
])

export function normalizeFolder(folder?: string | null): string {
  const raw = (folder || 'generated-posts').replace(/^\/+|\/+$/g, '')
  const root = raw.split('/')[0]
  if (!ALLOWED_FOLDERS.has(root)) {
    throw new Error(`Invalid media folder: ${root}`)
  }
  return raw
}

function getClient() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  if (!privateKey) throw new Error('IMAGEKIT_PRIVATE_KEY is not set')
  return new ImageKit({ privateKey })
}

export function isImageKitUrl(url: string): boolean {
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || ''
  return Boolean(endpoint && url.startsWith(endpoint))
}

export function filePathFromImageKitUrl(url: string): string | null {
  const endpoint = (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '')
  if (!endpoint || !url.startsWith(endpoint + '/')) return null
  let path = url.slice(endpoint.length)
  path = path.replace(/^\/tr:[^/]+/, '')
  path = path.split('?')[0]
  return path.startsWith('/') ? path : `/${path}`
}

/** Build a public CDN URL from an ImageKit filePath, or pass through absolute URLs. */
export function publicUrlFromFilePath(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:')) return pathOrUrl
  const endpoint = (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '')
  if (!endpoint) throw new Error('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not set')
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${endpoint}${path}`
}

export async function uploadBuffer(opts: {
  buffer: Buffer
  fileName: string
  folder?: string
  contentType?: string
}): Promise<ImageKitUploadResult> {
  const folder = normalizeFolder(opts.folder)
  const ik = getClient()
  const file = await toFile(opts.buffer, opts.fileName, {
    type: opts.contentType || undefined,
  })
  const result = await ik.files.upload({
    file,
    fileName: opts.fileName,
    folder: `/${folder}`,
    useUniqueFileName: true,
  })
  return {
    url: result.url!,
    fileId: result.fileId!,
    filePath: result.filePath!,
    name: result.name!,
    thumbnailUrl: result.thumbnailUrl || undefined,
  }
}

export async function uploadFromDataUrl(
  dataUrl: string,
  fileName: string,
  folder?: string
): Promise<ImageKitUploadResult> {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!match) throw new Error('Invalid data URL')
  const contentType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : contentType.includes('pdf')
            ? 'pdf'
            : contentType.includes('ttf')
              ? 'ttf'
              : contentType.includes('otf')
                ? 'otf'
                : contentType.includes('woff')
                  ? 'woff'
                  : 'bin'
  const name = fileName.includes('.') ? fileName : `${fileName}.${ext}`
  return uploadBuffer({ buffer, fileName: name, folder, contentType })
}

export async function uploadFromRemoteUrl(
  url: string,
  fileName: string,
  folder?: string
): Promise<ImageKitUploadResult> {
  if (url.startsWith('data:')) return uploadFromDataUrl(url, fileName, folder)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download media (${res.status})`)
  const contentType = res.headers.get('content-type') || undefined
  const buffer = Buffer.from(await res.arrayBuffer())
  return uploadBuffer({ buffer, fileName, folder, contentType })
}

/**
 * Upload a data URL / non-ImageKit remote URL to ImageKit.
 * Not used by n8n generate proxies (those pass through CDN URLs from n8n).
 * Kept for rare fallbacks and scripts.
 */
export async function ensureImageKitUrl(
  value: string,
  fileName: string,
  folder = 'generated-posts'
): Promise<string> {
  if (!value) return value
  if (isImageKitUrl(value)) return value
  if (value.startsWith('data:') || /^https?:\/\//i.test(value)) {
    const uploaded = await uploadFromRemoteUrl(value, fileName, folder)
    return uploaded.url
  }
  return value
}

export async function deleteByFileId(fileId: string): Promise<void> {
  const ik = getClient()
  await ik.files.delete(fileId)
}

async function findFileIdByPath(filePath: string): Promise<string | null> {
  const ik = getClient()
  const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`
  const folder = normalized.replace(/\/[^/]+$/, '') || '/'
  const name = normalized.split('/').pop()
  if (!name) return null
  const listed = (await ik.assets.list({ path: folder })) as Array<{
    type?: string
    fileId?: string
    filePath?: string
    name?: string
  }>
  const match = listed.find(
    (f) => f.type === 'file' && (f.filePath === normalized || f.name === name)
  )
  return match?.fileId || null
}

export async function deleteMedia(opts: {
  fileId?: string | null
  url?: string | null
  filePath?: string | null
}): Promise<void> {
  if (opts.fileId) {
    await deleteByFileId(opts.fileId)
    return
  }
  const path = opts.filePath || (opts.url ? filePathFromImageKitUrl(opts.url) : null)
  if (path) {
    const fileId = await findFileIdByPath(path)
    if (fileId) {
      await deleteByFileId(fileId)
      return
    }
  }
  // Legacy Supabase/Cloudinary URLs: no-op
}
