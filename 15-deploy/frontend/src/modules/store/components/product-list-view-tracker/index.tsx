"use client"

import { useEffect } from "react"
import { trackViewItemList } from "@lib/analytics/ga4-ecommerce"

type ProductListViewTrackerProps = {
  products: Array<{
    id: string
    title?: string
    variants?: Array<{
      id: string
      calculated_price?: { calculated_amount?: number; currency_code?: string }
    }>
  }>
  listId?: string
  listName?: string
}

export default function ProductListViewTracker({
  products,
  listId,
  listName,
}: ProductListViewTrackerProps) {
  useEffect(() => {
    if (!products?.length) return

    const items = products.map((p, index) => {
      const variant = p.variants?.[0]
      const unitPrice = (variant as any)?.calculated_price?.calculated_amount ?? 0
      return {
        item_id: variant?.id ?? p.id,
        item_name: p.title ?? "",
        price: unitPrice / 100,
        quantity: 1,
        index,
      }
    })

    trackViewItemList({ list_id: listId, list_name: listName, items })
  }, [products, listId, listName])

  return null
}
