import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkSalesChannelsToStockLocationWorkflow } from "@medusajs/medusa/core-flows"

export default async function fixSalesChannelStock({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const [salesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!salesChannel) throw new Error("No sales channel")

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.*"],
  })

  const indiaLocation = locations?.find(
    (l: any) => l.address?.country_code?.toLowerCase() === "in"
  )
  const europeLocation = locations?.find(
    (l: any) => l.address?.country_code?.toLowerCase() === "dk" ||
      l.name?.includes("European")
  )

  const toLink = [indiaLocation?.id, europeLocation?.id].filter(Boolean) as string[]
  logger.info(`Linking sales channel to locations: ${toLink.join(", ")}`)

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: salesChannel.id, add: toLink },
  })

  logger.info("Sales channel stock locations fixed.")
}
