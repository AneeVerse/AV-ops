"use server"


import { cookies } from "next/headers"
import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders, getCacheOptions, getCacheTag, setCartId, setBuyNowCartId, removeBuyNowCartId } from "./cookies"
import { listReturnReasons } from "./returns"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"

export const retrieveOrder = async (id: string) => {


  const cookieStore = await cookies()
  const token = cookieStore.get("_medusa_jwt")?.value
  // Check for guest token if regular token is missing
  const guestToken = !token
    ? (cookieStore.get("_medusa_guest_jwt")?.value || cookieStore.get("_medusa_guest_token")?.value)
    : null



  // Log token details for debugging (only first 20 chars for security)


  const next = {
    ...(await getCacheOptions("orders")),
  }



  // If guest user, use the main orders endpoint with guest token to get full details
  if (guestToken && !token) {
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    const requestHeaders: Record<string, string> = {
      "Authorization": `Bearer ${guestToken}`
    }
    if (publishableKey) requestHeaders["x-publishable-api-key"] = publishableKey



    const response = await sdk.client.fetch<any>(`/store/orders/${id}`, {
      method: "GET",
      headers: requestHeaders,
      query: {
        fields: "id,display_id,customer_id,email,created_at,status,fulfillment_status,payment_status,currency_code,subtotal,shipping_total,tax_total,discount_total,metadata,total,*payment_collections.payments,*items,*items.metadata,*items.variant,*items.variant.images,*items.variant.product,*items.variant.product.thumbnail,*items.variant.product.images,*items.variant.product.variants,*items.product,*items.product.thumbnail,*items.product.images,*items.product.variants,*fulfillments,*fulfillments.items,*fulfillments.location_id,*returns,*returns.items,*cart,*shipping_address,*billing_address,*region,*shipping_methods"
      },
      cache: "no-store"
    })

    if (!response || !response.order) {
      throw new Error("Order not found or access denied")
    }


    return response.order
  }

  // Regular logged-in user flow
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "id,display_id,customer_id,email,created_at,status,fulfillment_status,payment_status,currency_code,subtotal,shipping_total,tax_total,discount_total,metadata,total,*payment_collections.payments,*items,*items.metadata,*items.variant,*items.variant.images,*items.variant.product,*items.variant.product.variants,*items.product,*items.product.variants,*returns,*shipping_address,*billing_address,*region,*shipping_methods",
      },
      headers,
      next,
      cache: "no-store", // Changed from "force-cache" to "no-store" to always fetch fresh data
    })
    .then(({ order }) => {

      return order
    })
    .catch((err) => {
      return medusaError(err)
    })
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "id,display_id,created_at,total,currency_code,status,fulfillment_status,payment_status,*items,+items.metadata,*items.variant,*items.variant.images,*items.product,*returns",
        ...filters,
      },
      headers,
      next,
      cache: "no-store",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

export const createTransferRequest = async (
  state: {
    success: boolean
    error: string | null
    order: HttpTypes.StoreOrder | null
  },
  formData: FormData
): Promise<{
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}> => {
  const id = formData.get("order_id") as string

  if (!id) {
    return { success: false, error: "Order ID is required", order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const downloadInvoice = async (orderId: string) => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("_medusa_jwt")?.value
    // Check for guest token if regular token is missing
    const guestToken = !token
      ? (cookieStore.get("_medusa_guest_jwt")?.value || cookieStore.get("_medusa_guest_token")?.value)
      : null



    const headers: HeadersInit = {
      "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
    }

    let url = `/store/invoice/download/${orderId}`

    if (token) {
      headers["Cookie"] = `_medusa_jwt=${token}`
      headers["Authorization"] = `Bearer ${token}`
    } else if (guestToken) {
      // Use guest endpoint and token
      url = `/store/guest/invoice/download/${orderId}`
      headers["Cookie"] = `_medusa_guest_jwt=${guestToken}`
      headers["Authorization"] = `Bearer ${guestToken}`
    }

    const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
    const response = await fetch(`${backendUrl}${url}`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Failed to download invoice: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/pdf")) {
      throw new Error("Server returned non-PDF content")
    }

    const arrayBuffer = await response.arrayBuffer()

    if (arrayBuffer.byteLength === 0) {
      throw new Error("Generated PDF is empty")
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64")

    return { success: true, data: base64 }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Cancel an order
 */
export const cancelOrder = async (orderId: string, reasonId?: string) => {
  try {
    const authHeaders = await getAuthHeaders()
    const cookiesStore = await cookies()
    const guestToken = cookiesStore.get("_medusa_guest_jwt")?.value || cookiesStore.get("_medusa_guest_token")?.value
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

    // 1. Regular logged-in user flow ALWAYS takes priority
    const token = cookiesStore.get("_medusa_jwt")?.value
    
    if (token) {
      let finalReasonId = reasonId
      if (!finalReasonId) {
        const reasons = await listReturnReasons()
        finalReasonId = reasons.find(r => r.value === "other")?.id || reasons[0]?.id || "other"
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey!,
        "Authorization": `Bearer ${token}`
      }

      // Try the primary endpoint
      let response = await fetch(`${backendUrl}/store/orders/cancel/${orderId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason_id: finalReasonId }),
        cache: "no-store",
      })

      // If the first endpoint fails with 404 or a resolution error, try the alternative format
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 404 || (errorData.message && errorData.message.includes("resolve"))) {
          const altResponse = await fetch(`${backendUrl}/store/orders/${orderId}/cancel`, {
            method: "POST",
            headers,
            body: JSON.stringify({ reason_id: finalReasonId }),
            cache: "no-store",
          })
          
          if (altResponse.ok) return { success: true }
          
          // If both fail, return the error from the second attempt
          const altError = await altResponse.json().catch(() => ({ message: "Failed to cancel order" }))
          return { success: false, error: altError.message || "Failed to cancel order" }
        }

        return { success: false, error: errorData.message || "Failed to cancel order" }
      }
      
      return { success: true }
    }

    // 2. Only if NOT logged in, check for guest user token
    if (guestToken) {
      let finalReasonId = reasonId
      if (!finalReasonId) {
        const reasons = await listReturnReasons()
        finalReasonId = reasons.find(r => r.value === "other")?.id || reasons[0]?.id || "other"
      }

      // Try guest endpoint
      const response = await fetch(`${backendUrl}/store/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey!,
          "Authorization": `Bearer ${guestToken}`
        },
        body: JSON.stringify({ reason_id: finalReasonId }),
        cache: "no-store",
      })

      if (!response.ok) {
        // Fallback for guest as well
        const altResponse = await fetch(`${backendUrl}/store/guest/orders/${orderId}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key": publishableKey!,
            "Authorization": `Bearer ${guestToken}`
          },
          body: JSON.stringify({ reason_id: finalReasonId }),
          cache: "no-store",
        })

        if (altResponse.ok) return { success: true }
        return { success: false, error: "Failed to cancel order" }
      }
      return { success: true }
    }

    // 3. Neither token found
    return { success: false, error: "Unauthorized: No valid session found" }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Reorder an order (supports both logged-in and guest users)
 */
export const reorderOrder = async (orderId: string, skipVariantIds?: string[], forceReorder: boolean = false) => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("_medusa_jwt")?.value
    // Check for guest token if regular token is missing
    const guestToken = !token
      ? (cookieStore.get("_medusa_guest_jwt")?.value || cookieStore.get("_medusa_guest_token")?.value)
      : null

    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey!,
    }

    // Determine the correct endpoint based on user type
    let url = `${backendUrl}/store/orders/reorder/${orderId}`

    if (token) {
      // IMPORTANT: The Order Management plugin requires an explicit Bearer token
      // in the Authorization header to identify actor_id. Using getAuthHeaders()
      // alone (which is cookie-based) is not enough for this custom endpoint.
      headers["Authorization"] = `Bearer ${token}`
    } else if (guestToken) {
      // Use guest reorder endpoint
      url = `${backendUrl}/store/guest-orders/${orderId}/reorder`
      headers["Authorization"] = `Bearer ${guestToken}`
    } else {
      return { success: false, error: "Unauthorized: Please log in to reorder." }
    }

    // Add force_reorder query param if requested
    if (forceReorder) {
      url += `?force_reorder=true`
    }

    // Call the plugin's reorder endpoint (adds all items)
    const response = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      
      // Handle 409 Conflict - Inventory Issues
      if (response.status === 409 && errorBody?.inventory_issues) {
        return { 
          success: false, 
          error: "Inventory issues found", 
          inventory_issues: errorBody.inventory_issues 
        }
      }

      const errorMsg = errorBody?.message || "Failed to reorder"
      return { success: false, error: errorMsg }
    }

    const data = await response.json()

    // Support multiple response formats: data.cart.id, data.id, or data.cart_id
    const newCartId = data.cart?.id || data.id || data.cart_id || (data.reorder?.cart_id)

    // Set the cart ID in cookies and revalidate
    if (newCartId) {
      // 1. Tag the cart as Buy Now to prevent merging and allow auto-restore, 
      // and add is_reorder flag to distinguish it
      try {
        await sdk.store.cart.update(newCartId, {
          metadata: { 
            is_reorder: true 
          }
        }, {}, {
          ...headers,
          cache: "no-store",
        } as any)

        // 2. Ensure this new cart is not merged with existing ones (CRITICAL for Buy Now flow)
        await sdk.client.fetch(`/store/carts/merge/skip`, {
          method: "POST",
          body: { cart_id: newCartId },
          headers: headers as Record<string, string>,
        })
      } catch (updateErr) {
        console.error("[Reorder] Error updating cart metadata or skipping merge:", updateErr)
      }

      // FALLBACK: If skipVariantIds were provided but the plugin added everything,
      // we manually remove the unwanted items from the new cart.
      if (skipVariantIds && skipVariantIds.length > 0) {
        try {
          // Fetch the new cart to find line item IDs
          const { cart } = await sdk.store.cart.retrieve(newCartId, {}, {
            ...headers,
          } as any)
          
          if (cart && cart.items) {
            const itemsToRemove = cart.items.filter(item => 
              item.variant_id && skipVariantIds.includes(item.variant_id)
            )
            
            // Delete unwanted items one by one
            for (const item of itemsToRemove) {
              await sdk.store.cart.deleteLineItem(newCartId, item.id, {}, {
                ...headers,
              } as any)
            }
          }
        } catch (removeErr) {
          console.error("[Reorder] Error removing skipped items:", removeErr)
          // We continue anyway since the cart is created
        }
      }

      // Use buy_now_cart_id instead of overwriting main cart
      await removeBuyNowCartId()
      await setBuyNowCartId(newCartId)

      // Revalidate standard carts tag
      revalidateTag("carts")

      // Also revalidate specific cache tag if available
      const cartCacheTag = await getCacheTag("carts")
      if (cartCacheTag) revalidateTag(cartCacheTag)
    }

    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
