"use server"

import { getAuthHeaders } from "./cookies"
import { HttpTypes } from "@medusajs/types"

const getBaseUrl = () => {
  return process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
}

const getPublishableKey = () => {
  return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
}

/**
 * Add a product to wishlist
 */
export async function addToWishlist(productId: string) {
  try {
    const authHeaders = await getAuthHeaders()
    const publishableKey = getPublishableKey()
    const baseUrl = getBaseUrl()

    if (!publishableKey) {
      return {
        success: false,
        error: "Configuration error: Publishable API key is missing.",
      }
    }

    if (!authHeaders || !("authorization" in authHeaders)) {
      return {
        success: false,
        error: "Please login to add items to wishlist.",
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
      ...authHeaders,
    }

    const response = await fetch(`${baseUrl}/store/wishlist`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        product_id: productId,
      }),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: "Login required",
        }
      }
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to add to wishlist`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred while adding to wishlist",
    }
  }
}

/**
 * Remove a product from wishlist
 */
export async function removeFromWishlist(productId: string) {
  try {
    const authHeaders = await getAuthHeaders()
    const publishableKey = getPublishableKey()
    const baseUrl = getBaseUrl()

    if (!publishableKey) {
      return {
        success: false,
        error: "Configuration error: Publishable API key is missing.",
      }
    }

    if (!authHeaders || !("authorization" in authHeaders)) {
      return {
        success: false,
        error: "Please login to remove items from wishlist.",
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
      ...authHeaders,
    }

    const response = await fetch(`${baseUrl}/store/wishlist/${productId}`, {
      method: "DELETE",
      headers,
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: "Login required",
        }
      }
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to remove from wishlist`,
      }
    }

    return {
      success: true,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred while removing from wishlist",
    }
  }
}

/**
 * Get wishlist items with full product details
 */
export async function getWishlist(includeDetails: boolean = true, countryCode?: string) {
  try {
    const authHeaders = await getAuthHeaders()
    const publishableKey = getPublishableKey()
    const baseUrl = getBaseUrl()

    if (!publishableKey) {
      return {
        success: false,
        error: "Configuration error: Publishable API key is missing.",
        data: [],
      }
    }

    if (!authHeaders || !("authorization" in authHeaders)) {
      // Return empty array if not logged in
      return {
        success: true,
        data: [],
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
      ...authHeaders,
    }

    const url = new URL(`${baseUrl}/store/wishlist`)
    if (includeDetails) {
      url.searchParams.set("include_details", "true")
      // Using the same aggressive expansion style that worked for the cart
      url.searchParams.set("fields", "id,product_id,*product,product.thumbnail,product.images")
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    })

    if (!response.ok) {
      // If 401 or 403, user is not authenticated, return empty array
      if (response.status === 401 || response.status === 403) {
        return {
          success: true,
          data: [],
        }
      }

      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to fetch wishlist`,
        data: [],
      }
    }

    const data = await response.json()
    let wishlistItems = data.wishlist || (Array.isArray(data) ? data : [])

    // If we have items and details are requested, fetch full product details separately
    if (includeDetails && wishlistItems.length > 0) {
      const productIds = wishlistItems.map((item: any) => item.product_id || item.id).filter(Boolean)

      try {
        const { sdk } = await import("@lib/config")
        
        let regionId: string | undefined = undefined
        if (countryCode) {
          const { getRegion } = await import("./regions")
          const region = await getRegion(countryCode)
          regionId = region?.id
        }

        const productsResponse = await sdk.store.product.list(
          // Fetch comprehensive product details including variants, options and inventory for availability checks
          {
            id: productIds,
            fields: "*thumbnail,*images,*variants,*variants.options,*options,*options.values,*variants.calculated_price,*variants.inventory_quantity,*variants.manage_inventory,*variants.allow_backorder",
            ...(regionId ? { region_id: regionId } : {}),
          },
          { next: { tags: ["products"] } }
        )

        const fullProducts = productsResponse.products as unknown as HttpTypes.StoreProduct[]

        // Merge full product data back into wishlist items
        wishlistItems = wishlistItems.map((item: any) => {
          const itemId = item.product_id || item.id
          const fullProduct = fullProducts.find((p: any) => p.id === itemId)

          if (fullProduct) {
            // Prefer the full product data from the SDK as it has the relations we need
            return {
              ...item,
              product: fullProduct
            }
          }
          return item
        })
      } catch (e) {
        // Handle error silently
      }
    }

    return {
      success: true,
      data: wishlistItems,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred while fetching wishlist",
      data: [],
    }
  }
}

/**
 * Get wishlist product IDs only (for checking if product is in wishlist)
 */
export async function getWishlistProductIds(): Promise<string[]> {
  try {
    const result = await getWishlist(false)
    if (result.success && Array.isArray(result.data)) {
      const ids = result.data.map((item: any) => {
        if (typeof item === "string") return item
        if (item.product_id) return item.product_id
        if (item.id) return item.id
        if (item.product?.id) return item.product.id
        return null
      }).filter((id: string | null): id is string => id !== null)
      return ids
    }
    return []
  } catch (error) {
    return []
  }
}
