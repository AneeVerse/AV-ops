import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function seedJewelryData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const productModuleService = container.resolve(Modules.PRODUCT)

  logger.info("Initializing Moissanite Jewelry Database Seeding...")

  // 1. Resolve Shipping Profile
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new Error("No default shipping profile found. Please run the base seed script first.")
  }

  // 2. Resolve Sales Channel
  const defaultSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  const defaultSalesChannel = defaultSalesChannels[0]
  if (!defaultSalesChannel) {
    throw new Error("Default Sales Channel not found. Please run the base seed script first.")
  }

  // 3. Find or Create Categories
  const categoryNames = ["Rings", "Earrings", "Pendants", "Bracelets", "Necklaces", "Silver Jewellery"]
  const existingCategories = await productModuleService.listProductCategories({
    name: categoryNames,
  })

  const categoriesToCreate = []
  for (const name of categoryNames) {
    if (!existingCategories.some((c) => c.name === name)) {
      categoriesToCreate.push({
        name,
        is_active: true,
      })
    }
  }

  let finalCategories = [...existingCategories]
  if (categoriesToCreate.length > 0) {
    logger.info(`Creating ${categoriesToCreate.length} jewelry categories...`)
    const { result: createdCategories } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: categoriesToCreate,
      },
    })
    finalCategories.push(...createdCategories)
  }

  const getCategoryId = (name: string) => {
    return finalCategories.find((c) => c.name === name)?.id
  }

  // 4. Seeding Products
  logger.info("Seeding custom Moissanite products...")

  const productsData = [
    {
      title: "Classic Round Solitaire Moissanite Ring",
      category_ids: [getCategoryId("Rings")].filter(Boolean) as string[],
      description: "A timeless masterpiece. Handcrafted in pure 925 sterling silver, this ring features a brilliant 1-carat round-cut Moissanite stone set in an elegant 6-prong layout. Comes with a GRA certification card.",
      handle: "classic-round-solitaire-moissanite-ring",
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        { url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800" },
        { url: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=800" }
      ],
      options: [
        { title: "Ring Size", values: ["US 6", "US 7", "US 8"] },
        { title: "Metal Finish", values: ["White Gold Plated", "18K Gold Plated"] }
      ],
      variants: [
        {
          title: "US 6 / White Gold Plated",
          sku: "RING-ROUND-US6-WG",
          options: { "Ring Size": "US 6", "Metal Finish": "White Gold Plated" },
          prices: [
            { amount: 199, currency_code: "usd" },
            { amount: 185, currency_code: "eur" }
          ]
        },
        {
          title: "US 6 / 18K Gold Plated",
          sku: "RING-ROUND-US6-YG",
          options: { "Ring Size": "US 6", "Metal Finish": "18K Gold Plated" },
          prices: [
            { amount: 209, currency_code: "usd" },
            { amount: 195, currency_code: "eur" }
          ]
        },
        {
          title: "US 7 / White Gold Plated",
          sku: "RING-ROUND-US7-WG",
          options: { "Ring Size": "US 7", "Metal Finish": "White Gold Plated" },
          prices: [
            { amount: 199, currency_code: "usd" },
            { amount: 185, currency_code: "eur" }
          ]
        },
        {
          title: "US 7 / 18K Gold Plated",
          sku: "RING-ROUND-US7-YG",
          options: { "Ring Size": "US 7", "Metal Finish": "18K Gold Plated" },
          prices: [
            { amount: 209, currency_code: "usd" },
            { amount: 195, currency_code: "eur" }
          ]
        },
        {
          title: "US 8 / White Gold Plated",
          sku: "RING-ROUND-US8-WG",
          options: { "Ring Size": "US 8", "Metal Finish": "White Gold Plated" },
          prices: [
            { amount: 199, currency_code: "usd" },
            { amount: 185, currency_code: "eur" }
          ]
        },
        {
          title: "US 8 / 18K Gold Plated",
          sku: "RING-ROUND-US8-YG",
          options: { "Ring Size": "US 8", "Metal Finish": "18K Gold Plated" },
          prices: [
            { amount: 209, currency_code: "usd" },
            { amount: 195, currency_code: "eur" }
          ]
        }
      ],
      sales_channels: [{ id: defaultSalesChannel.id }]
    },
    {
      title: "Princess Cut Moissanite Eternity Band",
      category_ids: [getCategoryId("Rings")].filter(Boolean) as string[],
      description: "Modern geometric sophistication. A continuous band of princess-cut Moissanite gemstones channel-set in anti-tarnish rhodium plated 925 silver. Ideal for stacking or as a wedding band.",
      handle: "princess-cut-moissanite-eternity-band",
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        { url: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=800" }
      ],
      options: [
        { title: "Ring Size", values: ["US 6", "US 7", "US 8"] }
      ],
      variants: [
        {
          title: "US 6",
          sku: "BAND-PRIN-US6",
          options: { "Ring Size": "US 6" },
          prices: [
            { amount: 249, currency_code: "usd" },
            { amount: 230, currency_code: "eur" }
          ]
        },
        {
          title: "US 7",
          sku: "BAND-PRIN-US7",
          options: { "Ring Size": "US 7" },
          prices: [
            { amount: 249, currency_code: "usd" },
            { amount: 230, currency_code: "eur" }
          ]
        },
        {
          title: "US 8",
          sku: "BAND-PRIN-US8",
          options: { "Ring Size": "US 8" },
          prices: [
            { amount: 249, currency_code: "usd" },
            { amount: 230, currency_code: "eur" }
          ]
        }
      ],
      sales_channels: [{ id: defaultSalesChannel.id }]
    },
    {
      title: "Royal Halo Cushion Cut Pendant",
      category_ids: [getCategoryId("Pendants"), getCategoryId("Necklaces")].filter(Boolean) as string[],
      description: "Unmatched vintage glamour. A stunning 2-carat cushion-cut Moissanite center stone surrounded by a brilliant halo of micro-pave accents. Suspended from an 18-inch adjustable 925 silver chain.",
      handle: "royal-halo-cushion-cut-pendant",
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        { url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800" }
      ],
      options: [
        { title: "Metal Finish", values: ["White Gold Plated", "18K Gold Plated"] }
      ],
      variants: [
        {
          title: "White Gold Plated",
          sku: "PEND-CUSH-WG",
          options: { "Metal Finish": "White Gold Plated" },
          prices: [
            { amount: 299, currency_code: "usd" },
            { amount: 275, currency_code: "eur" }
          ]
        },
        {
          title: "18K Gold Plated",
          sku: "PEND-CUSH-YG",
          options: { "Metal Finish": "18K Gold Plated" },
          prices: [
            { amount: 309, currency_code: "usd" },
            { amount: 285, currency_code: "eur" }
          ]
        }
      ],
      sales_channels: [{ id: defaultSalesChannel.id }]
    },
    {
      title: "Moissanite Drop Earrings",
      category_ids: [getCategoryId("Earrings")].filter(Boolean) as string[],
      description: "Elegant grace that moves with you. Exquisite pear-cut Moissanite droplets suspended from gold-plated leverbacks. GRA-certified and designed for premium comfort.",
      handle: "moissanite-drop-earrings",
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        { url: "https://images.unsplash.com/photo-1635767798638-3e25273a8236?q=80&w=800" }
      ],
      options: [
        { title: "Metal Finish", values: ["White Gold Plated", "18K Gold Plated"] }
      ],
      variants: [
        {
          title: "White Gold Plated",
          sku: "EAR-DROP-WG",
          options: { "Metal Finish": "White Gold Plated" },
          prices: [
            { amount: 179, currency_code: "usd" },
            { amount: 165, currency_code: "eur" }
          ]
        },
        {
          title: "18K Gold Plated",
          sku: "EAR-DROP-YG",
          options: { "Metal Finish": "18K Gold Plated" },
          prices: [
            { amount: 189, currency_code: "usd" },
            { amount: 175, currency_code: "eur" }
          ]
        }
      ],
      sales_channels: [{ id: defaultSalesChannel.id }]
    },
    {
      title: "Modern Silver Tennis Bracelet",
      category_ids: [getCategoryId("Bracelets")].filter(Boolean) as string[],
      description: "A shimmering line of brilliance. Classic tennis design featuring 3mm round-cut Moissanite stones individually claw-set in heavy 18K white gold plated sterling silver.",
      handle: "modern-silver-tennis-bracelet",
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        { url: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800" }
      ],
      options: [
        { title: "Length", values: ["6.5 inch", "7.0 inch", "7.5 inch"] }
      ],
      variants: [
        {
          title: "6.5 inch",
          sku: "BRAC-TEN-65",
          options: { Length: "6.5 inch" },
          prices: [
            { amount: 349, currency_code: "usd" },
            { amount: 320, currency_code: "eur" }
          ]
        },
        {
          title: "7.0 inch",
          sku: "BRAC-TEN-70",
          options: { Length: "7.0 inch" },
          prices: [
            { amount: 349, currency_code: "usd" },
            { amount: 320, currency_code: "eur" }
          ]
        },
        {
          title: "7.5 inch",
          sku: "BRAC-TEN-75",
          options: { Length: "7.5 inch" },
          prices: [
            { amount: 369, currency_code: "usd" },
            { amount: 340, currency_code: "eur" }
          ]
        }
      ],
      sales_channels: [{ id: defaultSalesChannel.id }]
    },
    {
      title: "Handcrafted 925 Sterling Silver Necklace",
      category_ids: [getCategoryId("Necklaces"), getCategoryId("Silver Jewellery")].filter(Boolean) as string[],
      description: "Delicate silver elegance. Sleek modern link chain with a minimal infinity charm set with sparkling Moissanite pavé stones.",
      handle: "handcrafted-925-sterling-silver-necklace",
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        { url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=800" }
      ],
      options: [
        { title: "Length", values: ["16 inch", "18 inch"] }
      ],
      variants: [
        {
          title: "16 inch",
          sku: "NECK-SILV-16",
          options: { Length: "16 inch" },
          prices: [
            { amount: 129, currency_code: "usd" },
            { amount: 119, currency_code: "eur" }
          ]
        },
        {
          title: "18 inch",
          sku: "NECK-SILV-18",
          options: { Length: "18 inch" },
          prices: [
            { amount: 139, currency_code: "usd" },
            { amount: 129, currency_code: "eur" }
          ]
        }
      ],
      sales_channels: [{ id: defaultSalesChannel.id }]
    }
  ]

  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: {
      products: productsData,
    },
  })

  logger.info(`Successfully seeded ${createdProducts.length} premium Moissanite products.`)
}
