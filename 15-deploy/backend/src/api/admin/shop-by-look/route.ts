import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ImageKitFileProviderService } from "../../../providers/file-imagekit/service"

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

async function saveStoredLooks(dynamicConfig: any, looks: any[]): Promise<void> {
  const values = await dynamicConfig.listValues()

  for (const key of Object.keys(values)) {
    if (key.includes("shop-by-look-array") || key.includes("shop-by-look-json")) {
      delete values[key]
    }
  }

  looks.forEach((item, i) => {
    const base = `homepage-config.shop-by-look-array[${i}].shop-by-look`
    const prodId = item.productId || item.product_id || item.product?.id || ""
    values[`${base}.id`] = item.id || `look-${i}`
    values[`${base}.look-name`] = item.lookName || ""
    values[`${base}.image`] = item.image || ""
    values[`${base}.grid-span`] = item.gridSpan || "col-span-1 row-span-1"
    values[`${base}.product-id`] = prodId
    values[`${base}.productId`] = prodId
  })

  values["homepage-config.shop-by-look-json"] = JSON.stringify(looks)
  await dynamicConfig.saveValues(values)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const looks = await getStoredLooks(dynamicConfig)

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
      looks,
      products,
    })
  } catch (error: any) {
    return res.status(500).json({
      looks: [],
      error: error?.message || "Failed to load shop-by-look items",
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as any
    const body = (req.body || {}) as any
    let currentLooks = await getStoredLooks(dynamicConfig)

    if (Array.isArray(body.looks)) {
      currentLooks = body.looks
    } else if (body.look && typeof body.look === "object") {
      const newLook = body.look
      if (!newLook.id) {
        newLook.id = `look-${Date.now()}`
      }
      const existingIdx = currentLooks.findIndex((l) => l.id === newLook.id)
      if (existingIdx >= 0) {
        currentLooks[existingIdx] = { ...currentLooks[existingIdx], ...newLook }
      } else {
        currentLooks.unshift(newLook)
      }
    } else {
      return res.status(400).json({
        message: "Invalid payload. Provide 'looks' array or 'look' object.",
      })
    }

    await saveStoredLooks(dynamicConfig, currentLooks)

    return res.json({
      success: true,
      looks: currentLooks,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message || "Failed to save shop-by-look items",
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

    let currentLooks = await getStoredLooks(dynamicConfig)
    const targetLook = currentLooks.find((l) => l.id === id)

    if (targetLook && targetLook.image) {
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
        await fileProvider.deleteFileByUrlOrKey(targetLook.image)
      } catch (e: any) {
        console.warn("Failed to delete ImageKit image for look:", e?.message || e)
      }
    }

    currentLooks = currentLooks.filter((l) => l.id !== id)
    await saveStoredLooks(dynamicConfig, currentLooks)

    return res.json({
      success: true,
      looks: currentLooks,
    })
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message || "Failed to delete look item",
    })
  }
}
