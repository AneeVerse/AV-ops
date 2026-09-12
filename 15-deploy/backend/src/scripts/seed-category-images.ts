import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"

const PUBLIC_BASE =
  process.env.STOREFRONT_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "https://culturajewels.com"

const CATEGORIES: {
  name: string
  handle: string
  description: string
  file: string
}[] = [
  {
    name: "Earrings",
    handle: "earrings",
    description: "Multi-gemstone luxury studs & drops",
    file: "earrings.png",
  },
  {
    name: "Rings",
    handle: "rings",
    description: "Luxury stackable gold & diamond rings",
    file: "rings.png",
  },
  {
    name: "Necklaces",
    handle: "necklaces",
    description: "Stunning gemstone collar necklaces",
    file: "necklaces.png",
  },
  {
    name: "Bracelets",
    handle: "bracelets",
    description: "Elegant gold chain & gemstone cuffs",
    file: "bracelets.png",
  },
  {
    name: "Pendants",
    handle: "pendants",
    description: "Pink quartz & flower pendant necklaces",
    file: "pendants.png",
  },
  {
    name: "Piercing",
    handle: "piercings",
    description: "Dainty barbell piercing jewelry",
    file: "piercings.png",
  },
  {
    name: "Mangalsutras",
    handle: "mangalsutras",
    description: "Sacred threads in modern gold designs",
    file: "mangalsutras.png",
  },
  {
    name: "Silver Jewelry",
    handle: "silver-jewelry",
    description: "Everyday sterling silver brilliant items",
    file: "silver-jewelry.png",
  },
]

function resolveAssetDirs(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, "category-assets"),
    path.join(cwd, "static", "category"),
    path.join(cwd, ".medusa", "server", "static", "category"),
    "/root/deploy/backend/category-assets",
    "/root/deploy/frontend/public/category",
  ]
}

function findAsset(file: string): string | null {
  for (const dir of resolveAssetDirs()) {
    const full = path.join(dir, file)
    if (fs.existsSync(full)) return full
  }
  return null
}

function ensureStaticCopy(src: string, file: string): string {
  const targets = [
    path.join(process.cwd(), "static", "category"),
    path.join(process.cwd(), ".medusa", "server", "static", "category"),
  ]
  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true })
    fs.copyFileSync(src, path.join(dir, file))
  }
  return `${PUBLIC_BASE.replace(/\/$/, "")}/static/category/${file}`
}

export default async function seedCategoryImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(Modules.PRODUCT)

  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "description", "metadata"],
  })

  for (const cat of CATEGORIES) {
    const assetPath = findAsset(cat.file)
    if (!assetPath) {
      logger.warn(`Missing asset for ${cat.handle}: ${cat.file}`)
      continue
    }
    const imageUrl = ensureStaticCopy(assetPath, cat.file)

    let match = (existing || []).find(
      (c: any) => c.handle === cat.handle || c.name === cat.name
    )

    if (!match) {
      logger.info(`Creating category ${cat.name} (${cat.handle})`)
      try {
        const { result } = await createProductCategoriesWorkflow(container).run({
          input: {
            product_categories: [
              {
                name: cat.name,
                handle: cat.handle,
                description: cat.description,
                is_active: true,
                is_internal: false,
                metadata: {
                  category_image: imageUrl,
                  category_background_color: "#F5F5F5",
                },
              },
            ],
          },
        })
        match = result?.[0]
        if (match) (existing as any[]).push(match)
        logger.info(`Created ${cat.handle} → ${imageUrl}`)
        continue
      } catch (e: any) {
        logger.warn(`Create failed for ${cat.handle}: ${e?.message || e}`)
        const { data: again } = await query.graph({
          entity: "product_category",
          fields: ["id", "name", "handle", "description", "metadata"],
        })
        match = (again || []).find((c: any) => c.handle === cat.handle)
        if (!match) continue
      }
    }

    const prevMeta = (match.metadata || {}) as Record<string, unknown>
    const metadata = {
      ...prevMeta,
      category_image: imageUrl,
      category_background_color:
        prevMeta.category_background_color || "#F5F5F5",
    }

    await productModuleService.updateProductCategories(match.id, {
      name: cat.name,
      description: cat.description || match.description,
      is_active: true,
      metadata,
    })
    logger.info(`Updated category ${cat.handle} → ${imageUrl}`)
  }

  logger.info("Category images seeded.")
}
