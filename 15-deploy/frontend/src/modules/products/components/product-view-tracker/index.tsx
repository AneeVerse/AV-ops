"use client"

import { useEffect } from "react"
import { trackViewItem } from "@lib/analytics/ga4-ecommerce"

type ProductViewTrackerProps = {
  product: {
    id: string
    title?: string
    variants?: Array<{
      id: string
      title?: string
      calculated_price?: { calculated_amount?: number; currency_code?: string }
    }>
  }
  region?: { currency_code?: string }
  selectedVariantId?: string | null
}

export default function ProductViewTracker({
  product,
  region,
  selectedVariantId,
}: ProductViewTrackerProps) {
  useEffect(() => {
    if (!product?.id) return

    const variant = selectedVariantId
      ? product.variants?.find((v) => v.id === selectedVariantId)
      : product.variants?.[0]
    const currency = (variant as any)?.calculated_price?.currency_code?.toUpperCase()
      ?? region?.currency_code?.toUpperCase()
      ?? "USD"
    const unitPrice = (variant as any)?.calculated_price?.calculated_amount ?? 0
    const value = unitPrice / 100

    trackViewItem({
      currency,
      value,
      items: [
        {
          item_id: variant?.id ?? product.id,
          item_name: product.title ?? "",
          price: unitPrice / 100,
          quantity: 1,
          item_variant: variant?.title ?? undefined,
        },
      ],
    })
  }, [product?.id, product?.title, product?.variants, region?.currency_code, selectedVariantId])

  return null
}
