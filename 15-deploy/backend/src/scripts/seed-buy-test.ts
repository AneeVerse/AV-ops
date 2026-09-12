import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateStoresStep } from "@medusajs/medusa/core-flows"

const STOCK_QTY = 500

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies-buy-test",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[]
    store_id: string
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((currency) => ({
          currency_code: currency.currency_code,
          is_default: currency.is_default ?? false,
        })),
      },
    }))
    const stores = updateStoresStep(normalizedInput)
    return new WorkflowResponse(stores)
  }
)

function inr(amount: number) {
  return Math.max(999, Math.round(amount / 100) * 100 - 1)
}

export default async function seedBuyTest({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const storeModuleService = container.resolve(Modules.STORE)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const pricingModuleService = container.resolve(Modules.PRICING)

  logger.info("=== One Carat buy-test seed (India + INR + stock + Razorpay) ===")

  // --- India region ---
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "countries.iso_2", "payment_providers.id"],
  })

  let indiaRegion = existingRegions?.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "in")
  )

  if (!indiaRegion) {
    logger.info("Creating India region...")
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: "inr",
            countries: ["in"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    indiaRegion = result[0]
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "in", provider_id: "tp_system" }],
    }).catch(() => logger.info("Tax region IN already exists"))
  } else {
    logger.info("India region exists — ensuring COD payment provider...")
    const hasCod = indiaRegion.payment_providers?.some(
      (p: any) => p.id === "pp_system_default"
    )
    if (!hasCod) {
      await updateRegionsWorkflow(container).run({
        input: {
          selector: { id: indiaRegion.id },
          update: {
            payment_providers: ["pp_system_default"],
          },
        },
      }).catch(() => {
        logger.warn("Could not update region payment providers — verify in admin.")
      })
    }
  }

  const [store] = await storeModuleService.listStores()
  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "inr", is_default: true },
        { currency_code: "usd" },
        { currency_code: "eur" },
      ],
    },
  })

  const defaultSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  const salesChannel = defaultSalesChannels[0]
  if (!salesChannel) throw new Error("Default Sales Channel not found")

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: salesChannel.id,
        supported_locales: [{ locale_code: "en-IN" }],
      },
    },
  })

  // --- Stock location (India) ---
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) throw new Error("No default shipping profile")

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.*"],
  })

  let indiaLocation = locations?.find(
    (l: any) => l.address?.country_code?.toLowerCase() === "in"
  )

  if (!indiaLocation) {
    logger.info("Creating India stock location...")
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "One Carat Surat",
            address: {
              city: "Surat",
              country_code: "IN",
              address_1: "312, Silver trade center, Mota Varachha",
              postal_code: "394101",
            },
          },
        ],
      },
    })
    indiaLocation = result[0]
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: indiaLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: salesChannel.id, add: [indiaLocation.id] },
    })
  }

  // Ensure sales channel can fulfill from both warehouses
  const europeLocation = locations?.find(
    (l: any) => l.name?.includes("European") || l.address?.country_code?.toLowerCase() === "dk"
  )
  const linkIds = [indiaLocation.id, europeLocation?.id].filter(Boolean) as string[]
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: salesChannel.id, add: linkIds },
  })

  logger.info("Sales channel stock locations linked.")
}

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: indiaLocation.id },
    },
  })

  // --- India shipping ---
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({ type: "shipping" })
  let indiaFulfillmentSet = fulfillmentSets.find((fs: any) =>
    fs.service_zones?.some((sz: any) =>
      sz.geo_zones?.some((gz: any) => gz.country_code === "in")
    )
  )

  if (!indiaFulfillmentSet) {
    logger.info("Creating India fulfillment + shipping options...")
    indiaFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "India delivery",
      type: "shipping",
      service_zones: [{ name: "India", geo_zones: [{ country_code: "in", type: "country" }] }],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: indiaLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: indiaFulfillmentSet.id },
    })
    const zoneId = indiaFulfillmentSet.service_zones[0].id
    const regionId = indiaRegion!.id
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: zoneId,
          shipping_profile_id: shippingProfile.id,
          type: { label: "Standard", description: "3–7 business days", code: "standard" },
          prices: [
            { currency_code: "inr", amount: 99 },
            { region_id: regionId, amount: 99 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
        {
          name: "Express Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: zoneId,
          shipping_profile_id: shippingProfile.id,
          type: { label: "Express", description: "1–3 business days", code: "express" },
          prices: [
            { currency_code: "inr", amount: 199 },
            { region_id: regionId, amount: 199 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
  }

  // --- Categories ---
  const categoryNames = ["Rings", "Earrings", "Pendants", "Bracelets", "Necklaces"]
  const existingCategories = await productModuleService.listProductCategories({ name: categoryNames })
  const toCreate: { name: string; is_active: boolean }[] = []
  for (const name of categoryNames) {
    if (!existingCategories.some((c) => c.name === name)) {
      toCreate.push({ name, is_active: true })
    }
  }
  let categories = [...existingCategories]
  if (toCreate.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: toCreate },
    })
    categories.push(...result)
  }
  const cat = (name: string) => categories.find((c) => c.name === name)?.id

  // --- Jewelry products (INR prices, skip existing handles) ---
  const catalog = [
    {
      title: "Round Solitaire Moissanite Ring",
      handle: "buy-test-round-solitaire-ring",
      category: "Rings",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800",
      baseInr: 16999,
      options: [{ title: "Ring Size", values: ["US 6", "US 7", "US 8"] }],
    },
    {
      title: "Oval Halo Moissanite Ring",
      handle: "buy-test-oval-halo-ring",
      category: "Rings",
      image: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=800",
      baseInr: 18999,
      options: [{ title: "Ring Size", values: ["US 6", "US 7"] }],
    },
    {
      title: "Pear Drop Moissanite Earrings",
      handle: "buy-test-pear-drop-earrings",
      category: "Earrings",
      image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=800",
      baseInr: 12999,
      options: [{ title: "Metal", values: ["Silver", "Gold Plated"] }],
    },
    {
      title: "Stud Moissanite Earrings",
      handle: "buy-test-stud-earrings",
      category: "Earrings",
      image: "https://images.unsplash.com/photo-1588444837495-c7cfebfc32b2?q=80&w=800",
      baseInr: 9999,
      options: [{ title: "Carat", values: ["0.5 ct", "1 ct"] }],
    },
    {
      title: "Heart Pendant Necklace",
      handle: "buy-test-heart-pendant",
      category: "Pendants",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800",
      baseInr: 14999,
      options: [{ title: "Chain Length", values: ["16 inch", "18 inch"] }],
    },
    {
      title: "Tennis Bracelet",
      handle: "buy-test-tennis-bracelet",
      category: "Bracelets",
      image: "https://images.unsplash.com/photo-1611591437281-460bfbeff0d5?q=80&w=800",
      baseInr: 21999,
      options: [{ title: "Size", values: ["Small", "Medium"] }],
    },
    {
      title: "Silver Chain Necklace",
      handle: "buy-test-silver-chain-necklace",
      category: "Necklaces",
      image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=800",
      baseInr: 11999,
      options: [{ title: "Length", values: ["18 inch", "20 inch"] }],
    },
    {
      title: "Emerald Cut Moissanite Ring",
      handle: "buy-test-emerald-cut-ring",
      category: "Rings",
      image: "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=800",
      baseInr: 19999,
      options: [
        { title: "Ring Size", values: ["US 6", "US 7", "US 8"] },
        { title: "Band", values: ["Silver", "Rose Gold"] },
      ],
    },
  ]

  const existingProducts = await productModuleService.listProducts(
    { handle: catalog.map((p) => p.handle) },
    { select: ["id", "handle"] }
  )
  const existingHandles = new Set(existingProducts.map((p) => p.handle))

  const productsToCreate = catalog
    .filter((p) => !existingHandles.has(p.handle))
    .map((item) => {
      const opt = item.options
      const variants: any[] = []

      if (opt.length === 1) {
        for (const val of opt[0].values) {
          const price = inr(item.baseInr + opt[0].values.indexOf(val) * 500)
          variants.push({
            title: val,
            sku: `${item.handle}-${val.replace(/\s+/g, "-").toUpperCase()}`.slice(0, 40),
            options: { [opt[0].title]: val },
            prices: [{ amount: price, currency_code: "inr" }],
            manage_inventory: true,
          })
        }
      } else {
        let i = 0
        for (const v1 of opt[0].values) {
          for (const v2 of opt[1].values) {
            variants.push({
              title: `${v1} / ${v2}`,
              sku: `BT-${item.handle.slice(-8)}-${i++}`,
              options: { [opt[0].title]: v1, [opt[1].title]: v2 },
              prices: [{ amount: inr(item.baseInr + i * 300), currency_code: "inr" }],
              manage_inventory: true,
            })
          }
        }
      }

      const categoryId = cat(item.category)
      return {
        title: item.title,
        handle: item.handle,
        description: `${item.title}. Premium moissanite jewellery — 925 sterling silver, GRA certified. Perfect for buy-test checkout.`,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        category_ids: categoryId ? [categoryId] : [],
        images: [{ url: item.image }],
        options: opt,
        variants,
        sales_channels: [{ id: salesChannel.id }],
      }
    })

  if (productsToCreate.length) {
    logger.info(`Creating ${productsToCreate.length} buy-test products...`)
    await createProductsWorkflow(container).run({ input: { products: productsToCreate } })
  } else {
    logger.info("All buy-test products already exist — skipping product creation.")
  }

  // --- INR prices on ALL variants missing INR ---
  logger.info("Ensuring INR prices on all variants...")
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "price_set.id",
      "price_set.prices.amount",
      "price_set.prices.currency_code",
    ],
  })

  let inrAdded = 0
  for (const variant of variants || []) {
    const priceSet = variant.price_set
    if (!priceSet?.id) continue
    const hasInr = priceSet.prices?.some(
      (p: any) => p.currency_code?.toLowerCase() === "inr"
    )
    if (hasInr) continue

    const usd = priceSet.prices?.find((p: any) => p.currency_code?.toLowerCase() === "usd")
    const eur = priceSet.prices?.find((p: any) => p.currency_code?.toLowerCase() === "eur")
    const base = Number(usd?.amount ?? eur?.amount ?? 150)
    const amount = usd ? inr(base * 85) : inr(base * 92)

    try {
      await (pricingModuleService as any).createPrices({
        price_set_id: priceSet.id,
        prices: [{ amount, currency_code: "inr" }],
      })
      inrAdded++
    } catch {
      try {
        await (pricingModuleService as any).addPrices({
          priceSetId: priceSet.id,
          prices: [{ amount, currency_code: "inr" }],
        })
        inrAdded++
      } catch (e2) {
        logger.warn(`Could not add INR for variant ${variant.sku}: ${e2}`)
      }
    }
  }
  logger.info(`Added INR to ${inrAdded} variants.`)

  // --- Inventory at India warehouse ---
  logger.info(`Setting inventory (${STOCK_QTY} units) at India location...`)
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
  })

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
  for (const item of inventoryItems || []) {
    const key = `${item.id}:${indiaLocation.id}`
    if (!levelsByItemLoc.has(key)) {
      newLevels.push({
        location_id: indiaLocation.id,
        inventory_item_id: item.id,
        stocked_quantity: STOCK_QTY,
      })
    }
  }

  if (newLevels.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: newLevels },
    })
    logger.info(`Created ${newLevels.length} inventory levels.`)
  }

  // Top up low stock at India location
  const lowLevels = (existingLevels || []).filter(
    (l: any) =>
      l.location_id === indiaLocation.id && (l.stocked_quantity ?? 0) < 10
  )
  if (lowLevels.length) {
    const inventoryModule = container.resolve(Modules.INVENTORY)
    for (const level of lowLevels) {
      await inventoryModule.updateInventoryLevels({
        inventory_item_id: level.inventory_item_id,
        location_id: indiaLocation.id,
        stocked_quantity: STOCK_QTY,
      })
    }
    logger.info(`Replenished ${lowLevels.length} low-stock items.`)
  }

  logger.info("=== Buy-test seed complete ===")
  logger.info("Store: /in/store — add to cart → checkout → Razorpay test payment")
  logger.info("Razorpay test card: use Razorpay dashboard test mode credentials")
}
