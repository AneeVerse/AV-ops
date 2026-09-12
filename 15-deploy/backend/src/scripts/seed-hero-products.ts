import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const HERO_HANDLES = ["auric-flow", "infinite-glow"] as const

function storefrontImage(path: string) {
  const base =
    process.env.STOREFRONT_URL ||
    process.env.MEDUSA_STOREFRONT_URL ||
    "https://culturajewels.com"
  return `${base.replace(/\/$/, "")}${path}`
}

export default async function seedHeroProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const productModuleService = container.resolve(Modules.PRODUCT)

  logger.info("=== Seeding hero carousel products ===")

  const [shippingProfile] = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile) {
    throw new Error("No default shipping profile found.")
  }

  const [salesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!salesChannel) {
    throw new Error("Default Sales Channel not found.")
  }

  const earringsCategory = (
    await productModuleService.listProductCategories({ name: ["Earrings"] })
  )[0]

  const existing = await productModuleService.listProducts(
    { handle: [...HERO_HANDLES] },
    { select: ["id", "handle", "title"] }
  )
  const existingHandles = new Set(existing.map((p) => p.handle))

  const catalog = [
    {
      title: "Auric Flow",
      handle: "auric-flow",
      description:
        "Ornate gold-toned drop earrings with intricate filigree and brilliant moissanite stones. Handcrafted in 925 sterling silver with anti-tarnish finish.",
      image: storefrontImage("/hero/auric_flow.png"),
      priceInr: 14999,
      sku: "HERO-AURIC-FLOW",
    },
    {
      title: "Infinite Glow",
      handle: "infinite-glow",
      description:
        "Polished gold hoop earrings with a luminous moissanite accent. A timeless everyday luxury piece in pure 925 sterling silver.",
      image: storefrontImage("/hero/infinite_glow.png"),
      priceInr: 12999,
      sku: "HERO-INFINITE-GLOW",
    },
  ]

  const productsToCreate = catalog
    .filter((item) => !existingHandles.has(item.handle))
    .map((item) => ({
      title: item.title,
      handle: item.handle,
      description: item.description,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      category_ids: earringsCategory ? [earringsCategory.id] : [],
      images: [{ url: item.image }],
      thumbnail: item.image,
      options: [{ title: "Style", values: ["Standard"] }],
      variants: [
        {
          title: "Standard",
          sku: item.sku,
          options: { Style: "Standard" },
          prices: [{ amount: item.priceInr, currency_code: "inr" }],
          manage_inventory: true,
        },
      ],
      sales_channels: [{ id: salesChannel.id }],
      metadata: { hero_featured: true },
    }))

  if (productsToCreate.length) {
    logger.info(`Creating ${productsToCreate.length} hero product(s)...`)
    await createProductsWorkflow(container).run({
      input: { products: productsToCreate },
    })
  } else {
    logger.info("Hero products already exist — skipping creation.")
  }

  // Ensure hero images always use current storefront URL
  for (const item of catalog) {
    const [product] = await productModuleService.listProducts(
      { handle: item.handle },
      { select: ["id", "handle", "thumbnail"] }
    )
    if (!product) continue
    const imageUrl = item.image
    await productModuleService.updateProducts(product.id, {
      thumbnail: imageUrl,
      images: [{ url: imageUrl }],
    })
    logger.info(`Updated images for ${item.handle}`)
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.*"],
  })
  const indiaLocation = locations?.find(
    (l: any) => l.address?.country_code?.toLowerCase() === "in"
  )
  const stockLocation = indiaLocation || locations?.[0]

  if (stockLocation) {
    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
    })
    const heroSkus = new Set(catalog.map((c) => c.sku))
    const heroItems = (inventoryItems || []).filter((i: any) =>
      heroSkus.has(i.sku)
    )

    const { data: existingLevels } = await query.graph({
      entity: "inventory_level",
      fields: ["id", "inventory_item_id", "location_id", "stocked_quantity"],
    })
    const levelsByItemLoc = new Set(
      (existingLevels || []).map(
        (l: any) => `${l.inventory_item_id}:${l.location_id}`
      )
    )

    const newLevels: CreateInventoryLevelInput[] = []
    for (const item of heroItems) {
      const key = `${item.id}:${stockLocation.id}`
      if (!levelsByItemLoc.has(key)) {
        newLevels.push({
          location_id: stockLocation.id,
          inventory_item_id: item.id,
          stocked_quantity: 100,
        })
      }
    }

    if (newLevels.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: newLevels },
      })
      logger.info(`Stocked ${newLevels.length} hero inventory level(s).`)
    }
  }

  logger.info("=== Hero product seed complete ===")
}
