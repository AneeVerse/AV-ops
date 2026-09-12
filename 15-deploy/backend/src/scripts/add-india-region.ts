import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateStoresStep } from "@medusajs/medusa/core-flows"

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies-india",
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

/** Rough USD → INR for catalog (₹1 ≈ $0.012) */
function usdToInr(usdAmount: number): number {
  const inr = Math.round(usdAmount * 85)
  return Math.max(999, Math.round(inr / 100) * 100 - 1) // e.g. 14999
}

export default async function addIndiaRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const storeModuleService = container.resolve(Modules.STORE)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const pricingModuleService = container.resolve(Modules.PRICING)

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "countries.iso_2"],
  })

  const indiaExists = existingRegions?.some((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "in")
  )

  if (indiaExists) {
    logger.info("India (in) is already configured in a region. Skipping region creation.")
  } else {
    logger.info("Creating India region with INR...")
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: "inr",
            countries: ["in"],
            payment_providers: ["pp_razorpay_razorpay", "pp_system_default"],
          },
        ],
      },
    })
    const indiaRegion = regionResult[0]
    logger.info(`Created India region: ${indiaRegion.id}`)

    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "in", provider_id: "tp_system" }],
    }).catch(() => {
      logger.info("Tax region for IN already exists — skipping.")
    })
  }

  const { data: regionsAfter } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  const indiaRegion = regionsAfter?.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "in")
  )

  if (!indiaRegion) {
    throw new Error("Failed to resolve India region after creation.")
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

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_locales: [{ locale_code: "en-IN" }],
      },
    },
  })

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new Error("No default shipping profile found.")
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.*"],
  })

  let indiaLocation = locations?.find((l: any) =>
    l.address?.country_code?.toLowerCase() === "in"
  )

  if (!indiaLocation) {
    logger.info("Creating Surat stock location...")
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
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
    indiaLocation = stockLocationResult[0]

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: indiaLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })

    const defaultSalesChannels = await salesChannelModuleService.listSalesChannels({
      name: "Default Sales Channel",
    })
    if (defaultSalesChannels[0]) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: defaultSalesChannels[0].id,
          add: [indiaLocation.id],
        },
      })
    }
  }

  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    type: "shipping",
  })
  let indiaFulfillmentSet = fulfillmentSets.find((fs: any) =>
    fs.service_zones?.some((sz: any) =>
      sz.geo_zones?.some((gz: any) => gz.country_code === "in")
    )
  )

  if (!indiaFulfillmentSet) {
    logger.info("Creating India fulfillment set...")
    indiaFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "India delivery",
      type: "shipping",
      service_zones: [
        {
          name: "India",
          geo_zones: [{ country_code: "in", type: "country" }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: indiaLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: indiaFulfillmentSet.id },
    })

    const serviceZoneId = indiaFulfillmentSet.service_zones[0].id

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Delivered in 3–7 business days across India.",
            code: "standard",
          },
          prices: [
            { currency_code: "inr", amount: 99 },
            { region_id: indiaRegion.id, amount: 99 },
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
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Express",
            description: "Delivered in 1–3 business days.",
            code: "express",
          },
          prices: [
            { currency_code: "inr", amount: 199 },
            { region_id: indiaRegion.id, amount: 199 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
  }

  logger.info("Adding INR prices to product variants...")
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

  let pricesAdded = 0
  for (const variant of variants || []) {
    const priceSet = variant.price_set
    if (!priceSet?.id) continue

    const hasInr = priceSet.prices?.some(
      (p: any) => p.currency_code?.toLowerCase() === "inr"
    )
    if (hasInr) continue

    const usdPrice = priceSet.prices?.find(
      (p: any) => p.currency_code?.toLowerCase() === "usd"
    )
    const eurPrice = priceSet.prices?.find(
      (p: any) => p.currency_code?.toLowerCase() === "eur"
    )
    const baseAmount = usdPrice?.amount ?? eurPrice?.amount
    if (!baseAmount) continue

    const inrAmount = usdPrice
      ? usdToInr(Number(usdPrice.amount))
      : usdToInr(Number(eurPrice!.amount) * 1.08)

    await pricingModuleService.createPrices({
      price_set_id: priceSet.id,
      amount: inrAmount,
      currency_code: "inr",
      rules: {},
    })
    pricesAdded++
  }

  logger.info(`Added INR prices to ${pricesAdded} variants.`)
  logger.info("India region setup complete. Set NEXT_PUBLIC_DEFAULT_REGION=in in storefront .env.local")
}
