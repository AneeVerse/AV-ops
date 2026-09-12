"use client"

import { useEffect } from "react"
import { trackPurchase } from "@lib/analytics/ga4-ecommerce"

type OrderPurchaseTrackerProps = {
  order: {
    id: string
    total?: number
    currency_code?: string
    items?: Array<{
      id: string
      variant_id?: string
      title?: string
      quantity: number
      unit_price?: number
      total?: number
    }>
  }
}

export default function OrderPurchaseTracker({ order }: OrderPurchaseTrackerProps) {
  useEffect(() => {
    if (!order?.id) return

    const currency = order.currency_code?.toUpperCase() ?? "USD"
    const value = (order.total ?? 0) / 100
    const items = (order.items ?? []).map((item, index) => {
      const unitPrice = item.unit_price ?? (item.total && item.quantity ? item.total / item.quantity : 0)
      return {
        item_id: item.variant_id ?? item.id,
        item_name: item.title ?? "",
        price: unitPrice / 100,
        quantity: item.quantity,
        index,
      }
    })

    trackPurchase({
      transaction_id: order.id,
      currency,
      value,
      items,
    })
  }, [order?.id])

  return null
}
