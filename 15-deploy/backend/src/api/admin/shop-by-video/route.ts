import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ImageKitFileProviderService } from "../../../providers/file-imagekit/service"

async function getStoredVideos(dynamicConfig: any): Promise<any[]> {
  try {
    const values = await dynamicConfig.listValues()

    const prefix = "homepage-config.shop-by-video-array["
    const byIndex = new Map<number, Record<string, string>>()

    for (const [key, raw] of Object.entries(values)) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      const close = rest.indexOf("]")
      if (close < 0) continue
      const idx = Number(rest.slice(0, close))
      if (Number.isNaN(idx)) continue
      const fieldPath = rest.slice(close + 1)
      const field = fieldPath.split(".").filter(Boolean).pop()
      if (!field) continue
      if (!byIndex.has(idx)) byIndex.set(idx, {})
      byIndex.get(idx)![field] = String(raw ?? "")
    }

    const videos = [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => ({
        id: row["id"] || "",
        title: row["title"] || "",
        views: row["views"] || "10K",
        videoUrl: row["video-url"] || row["videoUrl"] || "",
        productId: row["product-id"] || row["productId"] || "",
      }))
      .filter((v) => v.videoUrl || v.title)

    if (videos.length > 0) return videos

    const rawJson = values["homepage-config.shop-by-video-json"]
    if (typeof rawJson === "string" && rawJson.trim().length > 0) {
      const parsed = JSON.parse(rawJson)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error("Error reading shop-by-video:", e)
  }
  return []
}

async function saveStoredVideos(dynamicConfig: any, videos: any[]): Promise<void> {
  const values = await dynamicConfig.listValues()

  for (const key of Object.keys(values)) {
    if (key.includes("shop-by-video-array") || key.includes("shop-by-video-json")) {
      delete values[key]
    }
  }

  videos.forEach((item, i) => {
    const base = `homepage-config.shop-by-video-array[${i}].shop-by-video`
    const prodId = item.productId || item.product_id || item.product?.id || ""
    values[`${base}.id`] = item.id || `video-${i}`
    values[`${base}.title`] = item.title || ""
    values[`${base}.views`] = item.views || "10K"
    values[`${base}.video-url`] = item.videoUrl || item["video-url"] || ""
    values[`${base}.product-id`] = prodId
    values[`${base}.productId`] = prodId
  })

  values["homepage-config.shop-by-video-json"] = JSON.stringify(videos)
  await dynamicConfig.saveValues(values)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const videos = await getStoredVideos(dynamicConfig)

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
    let products: any[] = []
    try {
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "title", "handle", "thumbnail", "images.url", "variants.id", "variants.title"],
      })
      products = data || []
    } catch {
      products = []
    }

    return res.json({
      videos,
      products,
    })
  } catch (error: any) {
    return res.status(500).json({
      videos: [],
      error: error?.message || "Failed to load shop-by-video items",
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const body = (req.body || {}) as any
    let currentVideos = await getStoredVideos(dynamicConfig)

    if (Array.isArray(body.videos)) {
      currentVideos = body.videos
    } else if (body.video && typeof body.video === "object") {
      const newVideo = body.video
      if (!newVideo.id) {
        newVideo.id = `video-${Date.now()}`
      }
      const existingIdx = currentVideos.findIndex((v) => v.id === newVideo.id)
      if (existingIdx >= 0) {
        currentVideos[existingIdx] = { ...currentVideos[existingIdx], ...newVideo }
      } else {
        currentVideos.unshift(newVideo)
      }
    } else {
      return res.status(400).json({
        message: "Invalid payload. Provide 'videos' array or 'video' object.",
      })
    }

    await saveStoredVideos(dynamicConfig, currentVideos)

    return res.json({
      success: true,
      videos: currentVideos,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message || "Failed to save shop-by-video items",
    })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const id = (req.query.id as string) || (req.body as any)?.id
    if (!id) {
      return res.status(400).json({ message: "Missing item ID to delete." })
    }

    let currentVideos = await getStoredVideos(dynamicConfig)
    const targetVideo = currentVideos.find((v) => v.id === id)

    if (targetVideo && (targetVideo.videoUrl || targetVideo["video-url"])) {
      const url = targetVideo.videoUrl || targetVideo["video-url"]
      try {
        let fileProvider: any
        try {
          fileProvider = req.scope.resolve("file_provider_imagekit")
        } catch {
          try {
            fileProvider = req.scope.resolve("fileProvider")
          } catch {
            fileProvider = new ImageKitFileProviderService({}, {
              urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/klyonjb5v",
              publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "public_lKCn/W0POQ1k/Dyg3MJbWyxsz6k=",
              privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_XY6DpjDB+kMVEetdkY4S0J4J1Ls=",
              folder: process.env.IMAGEKIT_FOLDER || "/cultura-jewels",
            })
          }
        }
        await fileProvider.deleteFileByUrlOrKey(url)
      } catch (e: any) {
        console.warn("Failed to delete ImageKit video file:", e?.message || e)
      }
    }

    currentVideos = currentVideos.filter((v) => v.id !== id)
    await saveStoredVideos(dynamicConfig, currentVideos)

    return res.json({
      success: true,
      videos: currentVideos,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message || "Failed to delete video item",
    })
  }
}
