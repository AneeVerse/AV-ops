import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/** Inverse of add-india-region usdToInr (~₹85 ≈ $1) */
function inrToUsd(inrAmount: number): number {
  return Math.max(1, Math.round(Number(inrAmount) / 85))
}

export default async function addUsdPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pricingModuleService = container.resolve(Modules.PRICING)

  logger.info("Ensuring USD prices on all variants that have INR...")

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

  let usdAdded = 0
  let skipped = 0

  for (const variant of variants || []) {
    const priceSet = variant.price_set
    if (!priceSet?.id) {
      skipped++
      continue
    }

    const hasUsd = priceSet.prices?.some(
      (p: any) => p.currency_code?.toLowerCase() === "usd"
    )
    if (hasUsd) {
      skipped++
      continue
    }

    const inr = priceSet.prices?.find(
      (p: any) => p.currency_code?.toLowerCase() === "inr"
    )
    if (!inr?.amount) {
      skipped++
      continue
    }

    const amount = inrToUsd(Number(inr.amount))

    try {
      await (pricingModuleService as any).createPrices({
        price_set_id: priceSet.id,
        prices: [{ amount, currency_code: "usd" }],
      })
      usdAdded++
      logger.info(`USD $${amount} added for variant ${variant.sku || variant.id}`)
    } catch {
      try {
        await (pricingModuleService as any).addPrices({
          priceSetId: priceSet.id,
          prices: [{ amount, currency_code: "usd" }],
        })
        usdAdded++
        logger.info(`USD $${amount} added (addPrices) for variant ${variant.sku || variant.id}`)
      } catch (e2) {
        logger.warn(`Could not add USD for variant ${variant.sku || variant.id}: ${e2}`)
      }
    }
  }

  logger.info(`Done. Added USD to ${usdAdded} variants. Skipped ${skipped}.`)
}
