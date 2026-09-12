"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { cookies } from "next/headers"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { revalidateTag } from "next/cache"

export const listReturnReasons = async () => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("return_reasons")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreReturnReasonListResponse>(`/store/return-reasons`, {
      method: "GET",
      headers,
      next,
      cache: "force-cache", // Reasons change rarely
    })
    .then(({ return_reasons }) => return_reasons)
    .catch(() => [])
}

export const listReturnShippingOptions = async (
  cartId: string,
  regionId?: string,
  productIds?: string[]
): Promise<HttpTypes.StoreShippingOption[]> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  // Strategy 1: Try with cart_id (preferred as it has context)
  if (cartId) {
    try {
      const { shipping_options } = await sdk.client.fetch<HttpTypes.StoreShippingOptionListResponse>(
        `/store/shipping-options`,
        {
          method: "GET",
          query: {
            cart_id: cartId,
            is_return: true,
          },
          headers,
          next,
          cache: "no-store",
        }
      )

      if (shipping_options.length > 0) {
        return shipping_options as unknown as HttpTypes.StoreShippingOption[]
      }
    } catch (e) {
      // Fallback strategy
    }
  }

  // Strategy 2: Fallback - Create ephemeral cart if region_id is available
  // This is required because /store/shipping-options STRICTLY requires a cart_id for return options
  if (regionId) {
    try {
      // Create a temporary cart for this region to get valid shipping options
      const { cart } = await sdk.store.cart.create(
        { region_id: regionId },
        {},
        headers
      )

      if (cart?.id) {
        const { shipping_options } = await sdk.client.fetch<HttpTypes.StoreShippingOptionListResponse>(
          `/store/shipping-options`,
          {
            method: "GET",
            query: {
              cart_id: cart.id,
              is_return: true,
            },
            headers,
            next,
            cache: "no-store",
          }
        )
        return shipping_options as unknown as HttpTypes.StoreShippingOption[]
      }
    } catch (e) {
      // Silence error
    }
  }

  return []
}

export const createReturnRequest = async (
  state: {
    success: boolean
    error: string | null
    return: HttpTypes.StoreReturn | null
  },
  formData: FormData
): Promise<{
  success: boolean
  error: string | null
  return: HttpTypes.StoreReturn | null
}> => {
  const orderId = formData.get("order_id") as string
  const returnShippingOptionId = formData.get("return_shipping_option_id") as string
  const itemsJson = formData.get("items") as string
  const note = formData.get("note") as string
  const locationId = formData.get("location_id") as string

  if (!orderId) return { success: false, error: "Order ID is required", return: null }
  if (!itemsJson) return { success: false, error: "Items are required", return: null }

  let items: any[] = []
  try {
    items = JSON.parse(itemsJson)
  } catch (e) {
    return { success: false, error: "Invalid items data", return: null }
  }

  if (items.length === 0) {
    return { success: false, error: "At least one item must be selected", return: null }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    // Standard Medusa v2 payload
    const payload: any = {
      order_id: orderId,
      items: items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        reason_id: item.return_reason_id || undefined,
        note: (note && note.trim().length > 0) ? note : undefined,
      })),
      ...(returnShippingOptionId ? {
        return_shipping: {
          option_id: returnShippingOptionId,
          location_id: locationId || (items[0] as any).location_id || "default_location"
        }
      } : {}),
      // Optional: keep global note if supported
      note: (note && note.trim().length > 0) ? note : "Return request",
    }

    // Double check location_id is NOT nested incorrectly if already set above
    // The plugin expects return_shipping.location_id

    // Check for any available guest tokens
    const cookieStore = await cookies()
    const guestToken = cookieStore.get("_medusa_guest_jwt")?.value
      || cookieStore.get("_medusa_guest_token")?.value
      || cookieStore.get("guest_id")?.value

    const token = cookieStore.get("_medusa_jwt")?.value

    let returnData: HttpTypes.StoreReturn

    // If we have a guest token, try the guest specific endpoint
    if (guestToken && !token) {
      try {
        const response = await sdk.client.fetch<any>(
          `/store/guest-orders/${orderId}/returns`,
          {
            method: "POST",
            body: payload,
            headers: {
              ...headers,
              "Authorization": `Bearer ${guestToken}`
            },
            cache: "no-store",
          }
        )
        returnData = response.return || response
      } catch (e) {
        // Fallback to standard if guest endpoint fails
        const response = await sdk.client.fetch<{ return: HttpTypes.StoreReturn }>(
          `/store/returns`,
          {
            method: "POST",
            body: payload,
            headers,
            cache: "no-store",
          }
        )
        returnData = response.return
      }
    } else {
      // Standard flow
      const response = await sdk.client.fetch<{ return: HttpTypes.StoreReturn }>(
        `/store/returns`,
        {
          method: "POST",
          body: payload,
          headers,
          cache: "no-store",
        }
      )
      returnData = response.return
    }

    revalidateTag("orders")

    return { success: true, error: null, return: returnData }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create return request", return: null }
  }
}

/**
 * Link a payment method to a return (for Refund Destination)
 */
export const updateReturnPayment = async (returnId: string, paymentId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    const response = await sdk.client.fetch<any>(
      `/store/refund-payment-mapping/${returnId}`,
      {
        method: "PUT",
        body: { payment_id: paymentId },
        headers,
        cache: "no-store",
      }
    )
    return { success: true, data: response }
  } catch (error: any) {
    console.error("Update return payment fail:", error)
    return { success: false, error: error.message }
  }
}

/**
 * List returns for an order or customer
 */
export const listReturns = async (orderId?: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // Authenticated flow
  const authHeaders = headers as any
  if (authHeaders.authorization || authHeaders.Authorization) {
    try {
      const response = await sdk.client.fetch<any>(`/store/returns`, {
        method: "GET",
        query: orderId ? { order_id: orderId } : {},
        headers,
        cache: "no-store",
      })
      return response
    } catch (e) {
      return { returns: [], count: 0 }
    }
  }

  // Guest flow
  if (orderId) {
    const cookieStore = await cookies()
    const guestToken = cookieStore.get("_medusa_guest_jwt")?.value || cookieStore.get("_medusa_guest_token")?.value

    if (guestToken) {
      try {
        const response = await sdk.client.fetch<any>(`/store/guest-orders/${orderId}/returns`, {
          method: "GET",
          headers: {
            ...headers,
            "Authorization": `Bearer ${guestToken}`
          },
          cache: "no-store",
        })
        return response
      } catch (e) {
        return { returns: [], count: 0 }
      }
    }
  }

  return { returns: [], count: 0 }
}
