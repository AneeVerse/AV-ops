"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { cache } from "react"

export const listCartShippingMethods = cache(async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null
    })
})

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  const body = { cart_id: cartId, data }

  if (data) {
    body.data = data
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: "POST",
        body,
        headers,
        next,
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch((e) => {
      return null
    })
}

export const getShiprocketServiceability = cache(async (pincode: string, variant_id: string, cod: number = 0) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<any>(
      `/store/shiprocket/serviceability`,
      {
        method: "GET",
        query: {
          pincode,
          variant_id,
          cod: cod.toString(),
        },
        headers,
        cache: "no-store",
      }
    )
    .then((data) => data)
    .catch(async (e) => {
      // Missing variant weight/dimensions etc. — don't crash checkout; ETD falls back in UI
      if (e.response) {
        try {
          const errorData = await e.response.json()
          console.warn(
            "[shiprocket/serviceability]",
            errorData.message || "serviceability check failed"
          )
        } catch {
          console.warn("[shiprocket/serviceability] request failed")
        }
        return null
      }
      return null
    })
})
