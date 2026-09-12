import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const videos = await getStoredVideos(dynamicConfig)

    if (videos.length === 0) {
      return res.json({ videos: [] })
    }

    const productIdsOrHandles = videos
      .map((v) => v.productId || v.product_id || v.handle)
      .filter(Boolean)

    let productsMap: Record<string, any> = {}

    if (productIdsOrHandles.length > 0) {
      try {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data } = await query.graph({
          entity: "product",
          fields: [
            "id",
            "title",
            "handle",
            "thumbnail",
            "description",
            "images.url",
            "variants.id",
            "variants.title",
            "variants.calculated_price.*",
            "options.id",
            "options.title",
            "options.values",
          ],
          filters: {
            $or: [
              { id: productIdsOrHandles },
              { handle: productIdsOrHandles },
            ],
          },
        })

        if (Array.isArray(data)) {
          data.forEach((p: any) => {
            if (p.id) productsMap[p.id] = p
            if (p.handle) productsMap[p.handle] = p
          })
        }
      } catch (e) {
        console.error("Failed to populate products for shop-by-video:", e)
      }
    }

    const enrichedVideos = videos.map((video) => {
      const targetId = video.productId || video.product_id || video.handle
      const matchedProd = targetId ? productsMap[targetId] : null
      return {
        ...video,
        product: matchedProd || video.product || null,
      }
    })

    return res.json({ videos: enrichedVideos })
  } catch (error: any) {
    return res.status(500).json({
      videos: [],
      error: error?.message || "Failed to load shop-by-video items",
    })
  }
}
