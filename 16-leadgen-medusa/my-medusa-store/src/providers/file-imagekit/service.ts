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
      try {
        const cleanContent = file.content.replace(/^data:image\/\w+;base64,/, "").trim()
        const decoded = Buffer.from(cleanContent, "base64")
        if (decoded.toString("base64") === cleanContent) {
          filePayload = decoded
        } else {
          filePayload = Buffer.from(file.content, "utf8")
        }
      } catch {
        filePayload = Buffer.from(file.content, "binary")
      }
    } else {
      filePayload = file.content
    }

    const res = await this.imagekit_.upload({
      file: filePayload,
      fileName: file.filename,
      folder: this.options_.folder || "/cultura-jewels",
      useUniqueFileName: true,
    })

    return {
      url: res.url,
      key: res.fileId,
    }
  }

  async delete(files: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files]
    for (const f of fileList) {
      if (f.fileKey) {
        try {
          await this.imagekit_.deleteFile(f.fileKey)
        } catch {
          // File may already be deleted or not exist in ImageKit
        }
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
