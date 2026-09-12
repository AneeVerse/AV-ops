"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
  getHoldCartId,
  setHoldCartId,
  removeHoldCartId,
  setBuyNowCartId,
  removeBuyNowCartId,
} from "./cookies"
import { getRegion } from "./regions"
import { getLocale } from "@lib/data/locale-actions"
import { retrieveCustomer, transferCart } from "@lib/data/customer"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"

import { cache } from "react"

const CALCULATED_SHIPPING_PRICE_TYPE = "calculated"

/**
 * Shiprocket (and other providers) use price_type "calculated".
 * Medusa requires POST /shipping-options/{id}/calculate before addShippingMethod.
 */
async function addShippingMethodWithPricing(
  cartId: string,
  shippingMethodId: string,
  shippingOption?: HttpTypes.StoreCartShippingOption
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  let priceType = shippingOption?.price_type

  if (!priceType) {
    const { shipping_options } = await sdk.client.fetch<{
      shipping_options: HttpTypes.StoreCartShippingOption[]
    }>("/store/shipping-options", {
      query: { cart_id: cartId },
      headers,
      cache: "no-store",
    })
    priceType = shipping_options?.find((o) => o.id === shippingMethodId)?.price_type
  }

  if (priceType === CALCULATED_SHIPPING_PRICE_TYPE) {
    const calculated = await calculatePriceForShippingOption(shippingMethodId, cartId)
    if (!calculated) {
      throw new Error("Failed to calculate shipping price")
    }
  }

  await sdk.store.cart.addShippingMethod(
    cartId,
    { option_id: shippingMethodId },
    {},
    headers
  )
}

export async function assignDefaultShippingMethod(cartId: string) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const { shipping_options } = await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    headers,
    cache: "no-store",
  })

  if (!shipping_options?.length) {
    return { success: false as const }
  }

  const option = shipping_options[0]
  await addShippingMethodWithPricing(cartId, option.id, option)
  return { success: true as const }
}

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export const retrieveCart = cache(
  async (cartId?: string, fields?: string) => {
    let id = cartId || (await getCartId())
    const heldId = await getHoldCartId()

    // AUTO-RESTORE LOGIC:
    // If we're not explicitly asking for a specific cartId and we have an active cart
    if (!cartId && id) {
      try {
        const headerList = await headers()
        const pathname = headerList.get("x-pathname") || headerList.get("referer") || ""
        
        // Skip metadata check if we are clearly in checkout to avoid extra API call
        if (!pathname.includes("/checkout")) {
          const currentCart = await sdk.client
            .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
              method: "GET",
              query: { fields: "metadata" },
              headers: await getAuthHeaders(),
              cache: "no-store",
            })
            .then(({ cart }) => cart)
            .catch(() => null)

          if (currentCart?.metadata?.is_buy_now || currentCart?.metadata?.is_reorder) {
            await removeBuyNowCartId()
            id = await getCartId() // Re-fetch ID which will now fall back to the real main cart
            revalidateTag("carts")
          }
        }
      } catch (e) {
        // Silent fail
      }
    }

    fields ??=
      "*items, *region, *items.product, *items.product.thumbnail, *items.product.images, *items.product.options, *items.product.variants, +items.product.variants.inventory_quantity, +items.product.variants.manage_inventory, +items.product.variants.allow_backorder, *items.product.variants.options, *items.variant, +items.variant.inventory_quantity, +items.variant.manage_inventory, +items.variant.allow_backorder, *items.variant.images, *items.variant.product, *items.variant.product.thumbnail, *items.variant.product.images, *items.variant.options, *items.thumbnail, *items.metadata, +items.total, +items.adjustments, *promotions, +shipping_methods.name, +shipping_methods.adjustments, +shipping_total, +shipping_subtotal, +total, +subtotal, +tax_total, +discount_total"

    if (!id) {
      return null
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    const next = {
      ...(await getCacheOptions("carts")),
    }

    return await sdk.client
      .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
        method: "GET",
        query: {
          fields,
        },
        headers,
        next,
        cache: "no-store",
      })
      .then(({ cart }: { cart: HttpTypes.StoreCart }) => {
        return cart
      })
      .catch(() => null)
  }
)


export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id")

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers
    )
    cart = cartResp.cart

    await setCartId(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  metadata,
}: {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, any>
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
        metadata,
      },
      {},
      headers
    )
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function buyNow({
  variantId,
  quantity,
  countryCode,
  metadata,
}: {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, any>
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const locale = await getLocale()
  
  // 1. Create a NEW cart regardless of existing one
  const cartResp = await sdk.store.cart.create(
    { 
      region_id: region.id, 
      locale: locale || undefined,
      metadata: { is_buy_now: true } 
    },
    {},
    headers
  )
  const cart = cartResp.cart

  // Save the new cart id in "buy_now_cart_id" cookie
  await removeBuyNowCartId()
  await setBuyNowCartId(cart.id)

  // Ensure this new cart is not merged with existing ones
  try {
    await sdk.client.fetch(`/store/carts/merge/skip`, {
      method: "POST",
      body: { cart_id: cart.id },
      headers,
    })
  } catch (e) {
    console.error("Failed to skip cart merge for buy now cart:", e)
  }

  // 2. Add the item to this new cart
  await sdk.store.cart.createLineItem(
    cart.id,
    {
      variant_id: variantId,
      quantity,
      metadata,
    },
    {},
    headers
  )

  // 3. (REMOVED: No longer overwriting the main cart ID, because getCartId handles buy_now_cart_id priority)


  // 4. OPTIMIZATION: If user is logged in and has addresses, auto-fill and skip to payment
  const customer = await retrieveCustomer().catch(() => null)
  const defaultAddress = customer?.addresses?.find(a => a.is_default_shipping || a.metadata?.is_default === "true" || a.metadata?.is_default === true) || customer?.addresses?.[0]

  let skipToPayment = false

  if (defaultAddress) {
    try {
      // Set addresses
      await sdk.store.cart.update(cart.id, {
        shipping_address: {
          first_name: defaultAddress.first_name,
          last_name: defaultAddress.last_name,
          address_1: defaultAddress.address_1,
          address_2: defaultAddress.address_2,
          city: defaultAddress.city,
          country_code: defaultAddress.country_code,
          postal_code: defaultAddress.postal_code,
          province: defaultAddress.province,
          phone: defaultAddress.phone,
          company: defaultAddress.company,
        },
        billing_address: {
          first_name: defaultAddress.first_name,
          last_name: defaultAddress.last_name,
          address_1: defaultAddress.address_1,
          address_2: defaultAddress.address_2,
          city: defaultAddress.city,
          country_code: defaultAddress.country_code,
          postal_code: defaultAddress.postal_code,
          province: defaultAddress.province,
          phone: defaultAddress.phone,
          company: defaultAddress.company,
        },
        email: customer.email
      }, {}, headers)

      // Fetch and set first shipping method
      const { shipping_options } = await sdk.client.fetch<{
        shipping_options: HttpTypes.StoreCartShippingOption[]
      }>("/store/shipping-options", {
        query: { cart_id: cart.id },
        headers,
        cache: "no-store",
      })

      if (shipping_options?.length > 0) {
        await addShippingMethodWithPricing(cart.id, shipping_options[0].id, shipping_options[0])
        skipToPayment = true
      }
    } catch (e) {
      // Fallback to normal checkout if anything fails
      console.error("Failed to auto-fill address and shipping:", e)
    }
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
  revalidatePath(`/${countryCode}/checkout`, "page")

  // 5. Redirect to checkout (default or skipped to payment)
  if (skipToPayment) {
    redirect(`/${countryCode}/checkout?step=payment&cart_id=${cart.id}`)
  } else {
    redirect(`/${countryCode}/checkout?cart_id=${cart.id}`)
  }
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItemVariant({
  lineId,
  variantId,
  quantity,
  countryCode,
}: {
  lineId: string
  variantId: string
  quantity: number
  countryCode: string
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating variant")
  }

  if (!variantId) {
    throw new Error("Missing variant ID when updating variant")
  }

  // Delete the old line item
  await deleteLineItem(lineId)

  // Add new line item with the new variant
  await addToCart({
    variantId,
    quantity,
    countryCode,
  })
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
  shippingOption,
}: {
  cartId: string
  shippingMethodId: string
  shippingOption?: HttpTypes.StoreCartShippingOption
}) {
  return addShippingMethodWithPricing(cartId, shippingMethodId, shippingOption)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

/**
 * Sets a shipping method silently without triggering a full page revalidation.
 */
export async function setShippingMethodSilently({
  cartId,
  shippingMethodId,
  shippingOption,
}: {
  cartId: string
  shippingMethodId: string
  shippingOption?: HttpTypes.StoreCartShippingOption
}) {
  try {
    await addShippingMethodWithPricing(cartId, shippingMethodId, shippingOption)
    return { success: true }
  } catch (e) {
    return { success: false }
  }
}


export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartResponse = await sdk.store.cart.retrieve(
    cart.id,
    {
      fields:
        "*shipping_address,*billing_address,*payment_collection,*payment_collection.payment_sessions",
    },
    headers
  )
  const latestCart = cartResponse.cart
  if (!latestCart) throw new Error("Cart not found")

  const existingSession = latestCart.payment_collection?.payment_sessions?.find(
    (session) =>
      session.provider_id === data.provider_id &&
      (session.status === "pending" || session.status === "requires_more")
  )

  if (existingSession) {
    return latestCart
  }

  // Helper to normalize phone numbers for Razorpay (requires +91 for India if 10 digits)
  const normalize = (p?: string) => {
    if (!p) return undefined
    const cleaned = String(p).replace(/\D/g, "")
    // India specific optimization (+91)
    if (cleaned.length === 10) return `+91${cleaned}`
    if (cleaned.length > 10 && !String(p).startsWith("+")) return `+${cleaned}`
    return p
  }

  const rawPhone = latestCart.shipping_address?.phone || latestCart.billing_address?.phone
  const phone = normalize(rawPhone)

  // 2. Critical Fix for Razorpay: Ensure normalized phone is in BOTH shipping and billing addresses
  if (phone) {
    const addressUpdates: any = {}

    // Clean address helper to ensure we pass a clean object to the update API
    const cleanAddress = (addr: any) => {
      if (!addr) return null
      return {
        first_name: addr.first_name,
        last_name: addr.last_name,
        address_1: addr.address_1,
        address_2: addr.address_2 || "",
        city: addr.city,
        country_code: addr.country_code,
        postal_code: addr.postal_code,
        province: addr.province,
        company: addr.company,
        phone: phone
      }
    }

    // Update if phone is missing in DB
    if (latestCart.shipping_address && !latestCart.shipping_address.phone) {
      addressUpdates.shipping_address = cleanAddress(latestCart.shipping_address)
    }

    if (latestCart.billing_address && !latestCart.billing_address.phone) {
      addressUpdates.billing_address = cleanAddress(latestCart.billing_address) || cleanAddress(latestCart.shipping_address)
    }

    if (Object.keys(addressUpdates).length > 0) {
      await sdk.store.cart.update(latestCart.id, addressUpdates, {}, headers)
    }
  }

  // Final re-fetch after any address patch
  const refreshedCartResponse = await sdk.store.cart.retrieve(
    cart.id,
    {
      fields:
        "*shipping_address,*billing_address,*payment_collection,*payment_collection.payment_sessions",
    },
    headers
  )
  const finalCart = refreshedCartResponse.cart

  // 4. PRE-FLIGHT VALIDATION: Only strictly block for Razorpay, be more lenient for COD
  const isRazorpayProvider = data.provider_id.includes("razorpay")
  const displayPhone = finalCart.shipping_address?.phone || finalCart.billing_address?.phone || phone
  
  if (isRazorpayProvider && !displayPhone) {
    throw new Error(`CRITICAL Error: Phone number is missing from your address. Razorpay requires a contact number for verification. Please enter your phone number.`)
  }

  if (isRazorpayProvider && !finalCart.email) {
    throw new Error(`CRITICAL Error: Email is missing from your cart. Razorpay requires an email address. Please enter your email.`)
  }

  // 5. ENHANCED DATA FOR RAZORPAY:
  const enhancedData = {
    ...data,
    data: {
      ...(data.data || {}),
      billing_address: finalCart.billing_address || finalCart.shipping_address,
      customer: {
        email: finalCart.email,
        phone: displayPhone,
        first_name: finalCart.billing_address?.first_name || finalCart.shipping_address?.first_name,
        last_name: finalCart.billing_address?.last_name || finalCart.shipping_address?.last_name,
      }
    }
  }

  const initiate = () =>
    sdk.store.payment.initiatePaymentSession(finalCart, enhancedData, {}, headers)

  return initiate()
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(async (e) => {
      const errorMsg = e.message || e.response?.data?.message || "Unknown error"
      if (errorMsg.includes("conflicted with another request")) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        return initiate().then(async (resp) => {
          const cartCacheTag = await getCacheTag("carts")
          revalidateTag(cartCacheTag)
          return resp
        })
      }
      const label = isRazorpayProvider ? "Razorpay" : "Payment"
      throw new Error(`${label} initialization failed: ${errorMsg}`)
    })
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
      
      return cart
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    return e.message
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const shippingCountryCode = (formData.get("shipping_address.country_code") as string)?.toLowerCase() || "in"

    const normalize = (p: any) => {
      if (!p) return undefined
      const cleaned = String(p).replace(/\D/g, "")
      if (cleaned.length === 10) return `+91${cleaned}`
      if (cleaned.length > 10 && !String(p).startsWith("+")) return `+${cleaned}`
      return String(p)
    }

    const rawPhone = formData.get("shipping_address.phone") as string
    const phone = normalize(rawPhone)

    const shippingAddress = {
      first_name: formData.get("shipping_address.first_name") as string,
      last_name: formData.get("shipping_address.last_name") as string,
      address_1: formData.get("shipping_address.address_1") as string,
      address_2: (formData.get("shipping_address.address_2") as string) || "",
      company: formData.get("shipping_address.company") as string,
      postal_code: formData.get("shipping_address.postal_code") as string,
      city: formData.get("shipping_address.city") as string,
      country_code: shippingCountryCode,
      province: formData.get("shipping_address.province") as string,
      phone: phone as string,
    }

    const data = {
      shipping_address: shippingAddress,
      email: formData.get("email"),
    } as any



    // Save address to customer profile if logged in
    const authHeaders = await getAuthHeaders()
    if (authHeaders && "authorization" in authHeaders) {
      try {
        // Fetch current customer to check if address already exists
        const { customer } = await sdk.client.fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
          method: "GET",
          query: { fields: "*addresses" },
          headers: authHeaders as Record<string, string>,
          cache: "no-store",
        })

        const addressExists = customer?.addresses?.some((a: any) =>
          a.address_1 === shippingAddress.address_1 &&
          a.postal_code === shippingAddress.postal_code &&
          a.city === shippingAddress.city &&
          a.first_name === shippingAddress.first_name &&
          a.last_name === shippingAddress.last_name
        )

        if (!addressExists) {
          await sdk.store.customer.createAddress(shippingAddress, {}, authHeaders as Record<string, string>)
          const customerCacheTag = await getCacheTag("customers")
          revalidateTag(customerCacheTag)
        }
      } catch (e) {
        // Silently fail when saving address to customer profile
      }
    }

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") {
      data.billing_address = { ...data.shipping_address }
    }

    if (sameAsBilling !== "on") {
      const bPhone = normalize(formData.get("billing_address.phone")) || phone
      data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: formData.get("billing_address.address_2") || "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: shippingCountryCode,
        province: formData.get("billing_address.province"),
        phone: bPhone,
      }
    }
    await updateCart(data)
  } catch (e: any) {
    return e.message
  }
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  // Ensure email is on cart before order creation — Medusa copies cart.email → order.email
  const freshCart = await retrieveCart(id)
  if (!freshCart?.email?.trim()) {
    throw new Error(
      "Email is required to place your order. Please enter your email in the delivery address form."
    )
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(async (error) => {
      const message = error?.message || ""
      if (message.includes("conflicted with another request")) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        return sdk.store.cart.complete(id, {}, headers)
      }
      return medusaError(error)
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    // NEW LOGIC: Check if we just completed a Buy Now cart
    const { cookies: nextCookies } = await import("next/headers")
    const cookiesStore = await nextCookies()
    const buyNowId = cookiesStore.get("buy_now_cart_id")?.value

    if (buyNowId) {
      // If a Buy Now cart was completed, remove its cookie ONLY.
      // Do NOT touch _medusa_cart_id, so the main cart is preserved!
      await removeBuyNowCartId()
    } else {
      // Regular checkout: clear the main cart
      await removeCartId()
    }
    
    redirect(`/${countryCode}/order/${cartRes?.order.id}/confirmed`)
  }

  return cartRes.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    headers,
    cache: "no-store",
  })
}

export async function addCustomerAddressToCart(currentState: unknown, formData: FormData) {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }

    const shippingCountryCode = (formData.get("shipping_address.country_code") as string)?.toLowerCase() || "in"

    // Parse address data from formData (which uses shipping_address. prefix)
    const addressData = {
      first_name: formData.get("shipping_address.first_name") as string,
      last_name: formData.get("shipping_address.last_name") as string,
      company: formData.get("shipping_address.company") as string,
      address_1: formData.get("shipping_address.address_1") as string,
      address_2: formData.get("shipping_address.address_2") as string,
      city: formData.get("shipping_address.city") as string,
      postal_code: formData.get("shipping_address.postal_code") as string,
      province: formData.get("shipping_address.province") as string,
      country_code: shippingCountryCode,
      phone: formData.get("shipping_address.phone") as string,
      metadata: {
        is_default: formData.get("is_default") === "true",
        address_type: formData.get("address_type"),
      },
    }

    const addressId = formData.get("address_id") as string

    // 1. Add/Update Customer Address Book
    // We try/catch this separately so if it fails (e.g. user not logged in), we still try to proceed with checkout
    try {
      if (addressId) {
        await sdk.store.customer.updateAddress(addressId, addressData, {}, headers)
      } else {
        await sdk.store.customer.createAddress(addressData, {}, headers)
      }
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
    } catch (e) {

      // verify if it is an auth error, maybe we shouldn't fail silently? 
      // But for checkout flow, the priority is to proceed.
    }

    // 2. Set as Cart Shipping Address
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const cartData = {
      shipping_address: {
        first_name: addressData.first_name,
        last_name: addressData.last_name,
        company: addressData.company,
        address_1: addressData.address_1,
        address_2: addressData.address_2,
        city: addressData.city,
        postal_code: addressData.postal_code,
        province: addressData.province,
        country_code: addressData.country_code,
        phone: addressData.phone,
      },
      email: formData.get("email"),
    } as any

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") {
      cartData.billing_address = cartData.shipping_address
    } else {
      // If not same as billing, we should ideally handle billing address too, 
      // but AddAddressModal usually forces same_as_billing="on" (Line 52 in AddAddressModal).
      // If we ever change that, we'll need logic here. For now, AddAddressModal is strictly for "Add New Shippping Address".
    }

    await updateCart(cartData)

  } catch (e: any) {
    return e.message
  }

  revalidateTag("carts")
  // No redirect if we are already in checkout to prevent disrupting the user
}

/**
 * Updates address in the background without redirecting.
 * Used for real-time shipping calculation when pincode is entered.
 */
export async function updateAddressSilently(data: {
  email?: string | null
  shipping_address?: Record<string, unknown>
  same_as_billing?: boolean
  /** When false, skips shipping-options fetch + method assign (contact/address-only updates). */
  assignShipping?: boolean
}) {
  const cartId = await getCartId()
  if (!cartId) return { success: false as const }

  try {
    const headers = {
      ...(await getAuthHeaders()),
    }

    const normalize = (p?: string | null) => {
      if (!p) return undefined
      const cleaned = String(p).replace(/\D/g, "")
      if (cleaned.length === 10) return `+91${cleaned}`
      if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`
      if (cleaned.length > 10 && !String(p).startsWith("+")) return `+${cleaned}`
      return String(p)
    }

    const isValidEmail = (email?: string | null) => {
      if (!email?.trim()) return false
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    }

    const payload: Record<string, unknown> = {}

    // Never send empty/invalid email — Medusa returns 400 and breaks shipping sync
    if (isValidEmail(data.email)) {
      payload.email = data.email!.trim()
    }

    if (data.shipping_address) {
      const addr = { ...data.shipping_address }
      if (addr.phone) {
        addr.phone = normalize(addr.phone as string)
      }
      // Drop empty optional fields so partial pincode-only updates succeed
      for (const key of Object.keys(addr)) {
        if (addr[key] === "" || addr[key] === undefined || addr[key] === null) {
          delete addr[key]
        }
      }
      if (Object.keys(addr).length > 0) {
        payload.shipping_address = addr
        if (data.same_as_billing !== false) {
          payload.billing_address = addr
        }
      }
    }

    if (Object.keys(payload).length === 0) {
      return { success: false as const }
    }

    await sdk.store.cart.update(cartId, payload, {}, headers)

    if (data.assignShipping !== false) {
      // Auto-assign first available shipping option so totals update immediately
      try {
        await assignDefaultShippingMethod(cartId)
      } catch {
        // Shipping options may not be ready yet; client-side autoSetShipping will retry
      }
    }
    
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
    
    const fulfillmentCacheTag = await getCacheTag("fulfillment")
    revalidateTag(fulfillmentCacheTag)
    
    return { success: true as const }
  } catch (e) {
    return { success: false as const }
  }
}
/**
 * Updates cart metadata silently without triggering a full page revalidation.
 */
export async function updateCartMetadataSilently(metadata: any) {
  const cartId = await getCartId()
  if (!cartId) return

  try {
    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.store.cart.update(cartId, { metadata }, {}, headers)
    // We intentionally DO NOT call revalidateTag here to prevent page refresh loops
    return { success: true }
  } catch (e) {
    return { success: false }
  }
}

export async function getAbandonedCarts() {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // If no authorization, return empty arrays
  if (!headers["authorization"]) {
    return { buyNowCarts: [], reorderCarts: [] }
  }

  try {
    // Just fetch all carts for the customer and filter locally
    const res = await sdk.client.fetch<{ carts: HttpTypes.StoreCart[] }>(`/store/carts`, {
      method: "GET",
      query: {
        fields: "*items, *items.product, *items.product.thumbnail, *items.variant, *items.metadata, +total",
      },
      headers,
      cache: "no-store",
    }).catch(() => null)

    let buyNowCarts: HttpTypes.StoreCart[] = []
    let reorderCarts: HttpTypes.StoreCart[] = []

    if (res && res.carts) {
      // Filter out the main active cart
      const currentCartId = await getCartId()
      const filteredCarts = res.carts.filter(c => c.id !== currentCartId)
      
      buyNowCarts = filteredCarts.filter(c => c.metadata?.is_buy_now === true)
      reorderCarts = filteredCarts.filter(c => c.metadata?.is_reorder === true)
    }

    return { buyNowCarts, reorderCarts }
  } catch (e) {
    console.error("Failed to fetch abandoned carts:", e)
    return { buyNowCarts: [], reorderCarts: [] }
  }
}

export async function resumeAbandonedCart(cartId: string, countryCode: string) {
  // Set as buy now cart so it temporarily overrides the main cart
  // without deleting the main cart cookie (_medusa_cart_id)
  await setBuyNowCartId(cartId)
  
  redirect(`/${countryCode}/checkout?cart_id=${cartId}`)
}

export async function deleteCart(cartId: string) {
  const headers = await getAuthHeaders()

  try {
    await sdk.client.fetch(`/store/carts/${cartId}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    })
    
    revalidateTag("carts")
    return { success: true }
  } catch (e: any) {
    console.error("Failed to delete cart:", e)
    return { success: false, error: e.message }
  }
}
