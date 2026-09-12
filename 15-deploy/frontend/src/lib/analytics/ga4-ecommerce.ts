/**
 * GA4 E-commerce event helpers for dataLayer.
 * Use these to power GA4 "Drive sales" reports: Ecommerce purchases,
 * Purchase journey, Checkout journey, Transactions, Promotions.
 */

export type GA4Item = {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
  index?: number
  item_variant?: string
}

function pushToDataLayer(obj: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const w = window as Window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(obj)
}

export function trackAddToCart(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "add_to_cart", ecommerce: payload })
}

export function trackRemoveFromCart(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "remove_from_cart", ecommerce: payload })
}

export function trackViewCart(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "view_cart", ecommerce: payload })
}

export function trackViewItem(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "view_item", ecommerce: payload })
}

export function trackViewItemList(payload: {
  list_id?: string
  list_name?: string
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "view_item_list", ecommerce: payload })
}

export function trackBeginCheckout(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "begin_checkout", ecommerce: payload })
}

export function trackAddShippingInfo(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "add_shipping_info", ecommerce: payload })
}

export function trackAddPaymentInfo(payload: {
  currency: string
  value: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "add_payment_info", ecommerce: payload })
}

export function trackPurchase(payload: {
  transaction_id: string
  currency: string
  value: number
  tax?: number
  shipping?: number
  items: GA4Item[]
}) {
  pushToDataLayer({ event: "purchase", ecommerce: payload })
}
