import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Returns shop-by-stone shapes from dynamic config.
 * Bypasses the plugin store serializer bug where an empty default
 * for an array field prevents indexed keys from nesting correctly.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dynamicConfig = req.scope.resolve("dynamic_config") as {
      listValues: () => Promise<Record<string, unknown>>
    }
    const values = await dynamicConfig.listValues()
    const prefix = "homepage-config.shop-by-stone-array["
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

    const shapes = [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => ({
        name: row["shop-by-stone-name"] || "",
        label: row["shop-by-stone-label"] || "",
        vibe: row["shop-by-stone-vibe"] || "",
        image: row["shop-by-stone-image"] || "",
        link: row["shop-by-stone-link"] || "",
      }))
      .filter((s) => s.name)

    res.json({ shapes })
  } catch (e: any) {
    res.status(500).json({
      shapes: [],
      error: e?.message || "Failed to load stone shapes",
    })
  }
}
