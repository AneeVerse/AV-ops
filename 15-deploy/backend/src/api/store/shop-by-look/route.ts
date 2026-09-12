import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

async function getStoredLooks(dynamicConfig: any): Promise<any[]> {
  try {
    const values = await dynamicConfig.listValues()

    const prefix = "homepage-config.shop-by-look-array["
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

    const looks = [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => ({
        id: row["id"] || "",
        lookName: row["look-name"] || row["lookName"] || "",
        image: row["image"] || "",
        gridSpan: row["grid-span"] || row["gridSpan"] || "col-span-1 row-span-1",
        isFeatured: row["grid-span"]?.includes("col-span-2") || false,
        productId: row["product-id"] || row["productId"] || "",
      }))
      .filter((l) => l.image || l.lookName)

    if (looks.length > 0) return looks

    const rawJson = values["homepage-config.shop-by-look-json"]
    if (typeof rawJson === "string" && rawJson.trim().length > 0) {
      const parsed = JSON.parse(rawJson)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error("Error reading shop-by-look:", e)
  }
  return []
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const looks = await getStoredLooks(dynamicConfig)

    if (looks.length === 0) {
      return res.json({ looks: [] })
    }

    const productIdsOrHandles = looks
      .map((l) => l.productId || l.product_id || l.handle)
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
        console.error("Failed to populate products for shop-by-look:", e)
      }
    }

    const enrichedLooks = looks.map((look) => {
      const targetId = look.productId || look.product_id || look.handle
      const matchedProd = targetId ? productsMap[targetId] : null
      return {
        ...look,
        product: matchedProd || look.product || null,
      }
    })

    return res.json({ looks: enrichedLooks })
  } catch (error: any) {
    return res.status(500).json({
      looks: [],
      error: error?.message || "Failed to load shop-by-look items",
    })
  }
}
