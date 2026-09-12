"use client"

import { useEffect } from "react"
import { trackBeginCheckout } from "@lib/analytics/ga4-ecommerce"

type CheckoutBeginTrackerProps = {
  cart: {
    items?: Array<{
      id: string
      variant_id?: string
      title?: string
      quantity: number
      total?: number
    }>
    total?: number
    currency_code?: string
    region?: { currency_code?: string }
  } | null
}

export default function CheckoutBeginTracker({ cart }: CheckoutBeginTrackerProps) {
  useEffect(() => {
    if (!cart?.items?.length) return

    const currency =
      cart.currency_code?.toUpperCase() ??
      (cart as any).region?.currency_code?.toUpperCase() ??
      "USD"
    const value = (cart.total ?? 0) / 100
    const items = cart.items.map((item, index) => {
      const unitTotal = item.total && item.quantity ? item.total / item.quantity : 0
      return {
        item_id: item.variant_id ?? item.id,
        item_name: item.title ?? "",
        price: unitTotal / 100,
        quantity: item.quantity,
        index,
      }
    })

    trackBeginCheckout({ currency, value, items })
  }, [cart])

  return null
}
