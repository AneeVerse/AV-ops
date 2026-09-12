import { AbstractFileProviderService } from "@medusajs/framework/utils"
import { FileTypes } from "@medusajs/types"
import ImageKit from "imagekit"

type ImageKitOptions = {
  urlEndpoint: string
  publicKey: string
  privateKey: string
  folder?: string
}

export class ImageKitFileProviderService extends AbstractFileProviderService {
  static identifier = "imagekit"
  protected imagekit_: ImageKit
  protected options_: ImageKitOptions

  constructor(container: any, options: ImageKitOptions) {
    super()
    this.options_ = options
    this.imagekit_ = new ImageKit({
      urlEndpoint: options.urlEndpoint,
      publicKey: options.publicKey,
      privateKey: options.privateKey,
    })
  }

  static validateOptions(options: Record<string, any>): void {
    if (!options.urlEndpoint) {
      throw new Error("ImageKit provider requires 'urlEndpoint' in options")
    }
    if (!options.publicKey) {
      throw new Error("ImageKit provider requires 'publicKey' in options")
    }
    if (!options.privateKey) {
      throw new Error("ImageKit provider requires 'privateKey' in options")
    }
  }

  async upload(file: FileTypes.ProviderUploadFileDTO): Promise<FileTypes.ProviderFileResultDTO> {
    let filePayload: Buffer | string

    if (Buffer.isBuffer(file.content)) {
      filePayload = file.content
    } else if (typeof file.content === "string") {
      if (file.content.startsWith("data:")) {
        const cleanContent = file.content.replace(/^data:[^;]+;base64,/, "").trim()
        filePayload = Buffer.from(cleanContent, "base64")
      } else {
        try {
          filePayload = Buffer.from(file.content.trim(), "base64")
        } catch {
          filePayload = Buffer.from(file.content, "utf8")
        }
      }
    } else {
      filePayload = file.content
    }

    let targetFolder = this.options_.folder || "/culturajewels/products"
    let targetFileName = file.filename

    const fileAny = file as any
    const isVideo = (fileAny.mimeType || "").includes("video") || (file.filename || "").endsWith(".mp4") || (file.filename || "").endsWith(".webm")

    // 1. Check for encoded folder in filename (e.g. folder___culturajewels___shop-by-look___image.jpg)
    if (typeof targetFileName === "string" && targetFileName.startsWith("folder___")) {
      const parts = targetFileName.split("___")
      if (parts.length >= 3) {
        const encodedFolder = parts[1].replace(/__/g, "/")
        targetFolder = encodedFolder.startsWith("/") ? encodedFolder : `/${encodedFolder}`
        targetFileName = parts.slice(2).join("___")
      }
    } else if (fileAny.folder && typeof fileAny.folder === "string") {
      // 2. Explicit folder property
      targetFolder = fileAny.folder.startsWith("/") ? fileAny.folder : `/${fileAny.folder}`
    } else if (fileAny.category === "shop-by-look" || fileAny.type === "shop-by-look") {
      // 3. Category Shop by Look
      targetFolder = "/culturajewels/shop-by-look"
    } else if (fileAny.category === "shop-by-video" || fileAny.type === "shop-by-video") {
      // 4. Category Shop by Video
      targetFolder = "/culturajewels/shop-by-video"
    } else if (fileAny.productName && typeof fileAny.productName === "string") {
      // 5. Product name specified -> /culturajewels/products/productName/images or /videos
      const sanitized = fileAny.productName
        .trim()
        .replace(/[^a-zA-Z0-9\s_-]/g, "")
        .replace(/\s+/g, "-") || "general"
      const mediaSubfolder = isVideo ? "videos" : "images"
      targetFolder = `/culturajewels/products/${sanitized}/${mediaSubfolder}`
    }

    const res = await this.imagekit_.upload({
      file: filePayload,
      fileName: targetFileName,
      folder: targetFolder,
      useUniqueFileName: true,
    })

    return {
      url: res.url,
      key: res.fileId,
    }
  }

  async deleteFileByUrlOrKey(fileKeyOrUrl: string): Promise<void> {
    if (!fileKeyOrUrl) return
    try {
      const cleanInput = String(fileKeyOrUrl).trim()

      // 1. Direct file ID check (ImageKit file IDs don't contain slashes or protocol)
      if (!cleanInput.includes("/") && !cleanInput.includes("http")) {
        await this.imagekit_.deleteFile(cleanInput)
        return
      }

      // 2. Extract pathname and filename from URL/Path
      let targetPath = ""
      let filename = ""
      try {
        const urlObj = new URL(cleanInput.startsWith("http") ? cleanInput : `https://${cleanInput}`)
        targetPath = decodeURIComponent(urlObj.pathname)
        filename = targetPath.split("/").pop() || ""
      } catch {
        targetPath = cleanInput
        filename = cleanInput.split("/").pop() || ""
      }

      if (filename) {
        // Query ImageKit files by filename
        const files = await this.imagekit_.listFiles({
          searchQuery: `name = "${filename}"`,
        })

        if (files && Array.isArray(files) && files.length > 0) {
          const targetPathClean = targetPath.toLowerCase().trim()
          const cleanInputClean = cleanInput.toLowerCase().trim()

          // STRICT FILTER: Match the exact filePath or URL
          const exactMatch = files.find((item: any) => {
            const fPath = String(item.filePath || "").toLowerCase().trim()
            const fUrl = String(item.url || "").toLowerCase().trim()

            return (
              fPath === targetPathClean ||
              fUrl === cleanInputClean ||
              (fPath && targetPathClean.endsWith(fPath)) ||
              (fUrl && fUrl.endsWith(cleanInputClean))
            )
          })

          if (exactMatch && (exactMatch as any).fileId) {
            await this.imagekit_.deleteFile((exactMatch as any).fileId)
          } else if (files.length === 1 && (files[0] as any).fileId) {
            // Only delete if exactly 1 single file across all folders matches this filename
            await this.imagekit_.deleteFile((files[0] as any).fileId)
          } else {
            console.warn("Skipping deletion: multiple files matched filename but none matched exact path:", targetPath)
          }
        }
      }
    } catch (e: any) {
      console.warn("Failed to delete file from ImageKit:", e?.message || e)
    }
  }

  async delete(files: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files]
    for (const f of fileList) {
      const keyOrUrl = f.fileKey || (f as any).url || ""
      if (keyOrUrl) {
        await this.deleteFileByUrlOrKey(keyOrUrl)
      }
    }
  }

  async getPresignedDownloadUrl(fileData: FileTypes.ProviderGetFileDTO): Promise<string> {
    if (typeof fileData.url === "string" && fileData.url.length > 0) {
      return fileData.url
    }
    const key = typeof fileData.fileKey === "string" ? fileData.fileKey : String(fileData.fileKey || "")
    return `${this.options_.urlEndpoint.replace(/\/$/, "")}/${key}`
  }
}

export default ImageKitFileProviderService
