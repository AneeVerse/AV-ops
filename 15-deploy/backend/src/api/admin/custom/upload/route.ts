import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ImageKitFileProviderService } from "../../../../providers/file-imagekit/service"

function resolveFileProvider(req: MedusaRequest): any {
  try {
    return req.scope.resolve("file_provider_imagekit")
  } catch {
    try {
      return req.scope.resolve("fileProvider")
    } catch {
      return new ImageKitFileProviderService({}, {
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/klyonjb5v",
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "public_lKCn/W0POQ1k/Dyg3MJbWyxsz6k=",
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_XY6DpjDB+kMVEetdkY4S0J4J1Ls=",
        folder: process.env.IMAGEKIT_FOLDER || "/cultura-jewels",
      })
    }
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body || {}) as any
    const { filename, content, mimeType, category, productName, folder } = body

    if (!filename || !content) {
      return res.status(400).json({
        message: "Missing required fields: filename and content are required.",
      })
    }

    const fileProvider = resolveFileProvider(req)

    const uploadPayload: any = {
      filename,
      content,
      mimeType,
      category,
      productName,
      folder,
    }

    const result = await fileProvider.upload(uploadPayload)

    return res.json({
      url: result.url,
      key: result.key,
      file: result,
    })
  } catch (error: any) {
    console.error("Admin upload error:", error)
    return res.status(500).json({
      message: error?.message || "Failed to upload file to ImageKit",
    })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const url = (req.query.url as string) || (req.query.fileKey as string) || (req.body as any)?.url || (req.body as any)?.fileKey
    if (!url) {
      return res.status(400).json({ message: "Missing file url or fileKey parameter to delete." })
    }

    const fileProvider = resolveFileProvider(req)
    await fileProvider.deleteFileByUrlOrKey(url)

    return res.json({
      success: true,
      message: "File successfully deleted from ImageKit CDN.",
    })
  } catch (error: any) {
    console.error("Admin file delete error:", error)
    return res.status(500).json({
      message: error?.message || "Failed to delete file from ImageKit",
    })
  }
}
