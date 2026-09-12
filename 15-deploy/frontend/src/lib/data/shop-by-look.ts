"use server"

import { cache } from "react"
import { getAuthHeaders } from "./cookies"

export interface DynamicLookItem {
  id: string
  lookName: string
  image: string
  gridSpan?: string
  isFeatured?: boolean
  productId?: string
  product?: any
}

export const getShopByLooksFromApi = cache(async (): Promise<DynamicLookItem[] | null> => {
  try {
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    }

    if (publishableKey) {
      headers["x-publishable-api-key"] = publishableKey
    }

    const authHeaders = await getAuthHeaders()
    if (authHeaders && "authorization" in authHeaders) {
      headers["authorization"] = authHeaders.authorization
    }

    const response = await fetch(`${baseUrl}/store/shop-by-look`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    if (!response.ok) return null

    const data = await response.json()
    if (Array.isArray(data?.looks) && data.looks.length > 0) {
      return data.looks
    }
    return null
  } catch (error) {
    console.error("Error fetching shop-by-look items:", error)
    return null
  }
})
