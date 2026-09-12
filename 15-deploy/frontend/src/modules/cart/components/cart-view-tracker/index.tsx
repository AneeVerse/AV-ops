"use client"

import { useEffect } from "react"
import { trackViewCart } from "@lib/analytics/ga4-ecommerce"

type CartViewTrackerProps = {
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

export default function CartViewTracker({ cart }: CartViewTrackerProps) {
  useEffect(() => {
    const currency =
      cart?.currency_code ?? (cart as any)?.region?.currency_code
    if (!cart?.items?.length || !currency) return

    const currencyUpper = currency.toUpperCase()
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

    trackViewCart({ currency: currencyUpper, value, items })
  }, [cart])

  return null
}
