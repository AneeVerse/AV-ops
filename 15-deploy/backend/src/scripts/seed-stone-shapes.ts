import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as fs from "fs"
import * as path from "path"

const PUBLIC_BASE =
  process.env.STOREFRONT_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "https://culturajewels.com"

const SHAPES = [
  { name: "Round", label: "ROUND", vibe: "Brilliant & Classic", file: "round.svg" },
  { name: "Princess", label: "PRINCESS", vibe: "Modern & Geometric", file: "princess.svg" },
  { name: "Cushion", label: "CUSHION", vibe: "Vintage & Soft", file: "cushion.svg" },
  { name: "Oval", label: "OVAL", vibe: "Elongated & Elegant", file: "oval.svg" },
  { name: "Emerald", label: "EMERALD", vibe: "Clean & Sophisticated", file: "emerald.svg" },
  { name: "Pear", label: "PEAR", vibe: "Unique & Teardrop", file: "pear.svg" },
  { name: "Marquise", label: "MARQUISE", vibe: "Striking & Distinct", file: "marquise.svg" },
  { name: "Heart", label: "HEART", vibe: "Romantic & Bold", file: "heart.svg" },
]

function findAsset(file: string): string | null {
  const dirs = [
    path.join(process.cwd(), "shape-assets"),
    path.join(process.cwd(), "static", "shapes"),
    "/root/deploy/backend/shape-assets",
    "/root/deploy/frontend/public/shapes",
  ]
  for (const dir of dirs) {
    const full = path.join(dir, file)
    if (fs.existsSync(full)) return full
  }
  return null
}

function ensureStaticCopy(src: string, file: string): string {
  const targets = [
    path.join(process.cwd(), "static", "shapes"),
    path.join(process.cwd(), ".medusa", "server", "static", "shapes"),
  ]
  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true })
    fs.copyFileSync(src, path.join(dir, file))
  }
  return `${PUBLIC_BASE.replace(/\/$/, "")}/static/shapes/${file}`
}

export default async function seedStoneShapes({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const dynamicConfig = container.resolve("dynamic_config") as {
    listValues: () => Promise<Record<string, unknown>>
    saveValues: (values: Record<string, unknown>) => Promise<void>
  }

  const existing = await dynamicConfig.listValues()
  const values: Record<string, unknown> = { ...existing }

  // Drop prior stone entries so we rewrite a clean 0..n set
  for (const key of Object.keys(values)) {
    if (key.includes("shop-by-stone-array")) {
      delete values[key]
    }
  }

  let written = 0
  for (let i = 0; i < SHAPES.length; i++) {
    const shape = SHAPES[i]
    const asset = findAsset(shape.file)
    if (!asset) {
      logger.warn(`Missing shape asset: ${shape.file}`)
      continue
    }
    const imageUrl = ensureStaticCopy(asset, shape.file)
    const base = `homepage-config.shop-by-stone-array[${i}].shop-by-stone`
    values[`${base}.shop-by-stone-image`] = imageUrl
    values[`${base}.shop-by-stone-name`] = shape.name
    values[`${base}.shop-by-stone-label`] = shape.label
    values[`${base}.shop-by-stone-vibe`] = shape.vibe
    values[`${base}.shop-by-stone-link`] = `/store?q=${shape.name}`
    written++
    logger.info(`Stone shape ${shape.name} → ${imageUrl}`)
  }

  await dynamicConfig.saveValues(values)
  logger.info(`Seeded ${written} stone shapes into homepage-config.`)
}
