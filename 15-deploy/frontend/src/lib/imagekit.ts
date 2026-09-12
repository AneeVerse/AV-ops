import ImageKit from "imagekit"

/**
 * Uploads a file buffer to ImageKit and returns the public image URL.
 * Server-side only: credentials are kept safe via environment variables.
 */
export async function uploadToImageKit(
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("Missing ImageKit credentials in environment variables (IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT).")
  }

  const imagekit = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  })

  const response = await imagekit.upload({
    file: fileBuffer,
    fileName: fileName || `custom-work-${Date.now()}`,
    folder: "/custom-work",
  })

  return response.url
}
