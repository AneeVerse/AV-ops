"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  removeSyncLock,
  setAuthToken,
  setCartId,
} from "./cookies"

import { cache } from "react"
import { getGoogleOAuthCallbackUrl } from "@lib/util/google-oauth"

export const retrieveCustomer = cache(
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    try {
      const { customer } = await sdk.client.fetch<{ customer: HttpTypes.StoreCustomer }>(
        `/store/customers/me`,
        {
          method: "GET",
          query: { fields: "*addresses" },
          headers: headers as Record<string, string>,
          cache: "no-store",
        }
      )
      return customer
    } catch (error: any) {
      const errStr = error.toString().toLowerCase()
      // If the error indicates a pending deletion, return a special object
      if (errStr.includes("active account deletion request") ||
        (error.message && error.message.toLowerCase().includes("active account deletion request"))) {
        const cookieStore = await cookies()
        const cookieEmail = cookieStore.get("_medusa_customer_email")?.value
        return { id: "pending_deletion", email: cookieEmail || "pending" } as any
      }
      return null
    }
  }
)

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string)?.replace(/[^\d+]/g, ""),
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password: password,
    })

    await setAuthToken(token as string)

    const headers = {
      ...(await getAuthHeaders()),
    }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      headers
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    await transferCart(loginToken as string)

    return createdCustomer
  } catch (error: any) {
    return error.toString()
  }
}

export async function login(_currentState: unknown, formData: FormData) {
  let email = formData.get("email_or_phone") as string
  const password = formData.get("password") as string

  // Sanitize phone number: remove spaces, dashes, etc if it looks like a phone number
  // If it doesn't have '@', we treat it as a potential phone number and clean it
  if (email && !email.includes("@")) {
    email = email.replace(/[^\d+]/g, "")
  }

  let shouldRedirect = false
  let countryCode = "in"

  try {
    const token = await sdk.auth.login("customer", "emailpass", { email_or_phone: email, password })
    await setAuthToken(token as string)

    // Store email in cookie for deletion flow (needed for cancellation modal)
    const cookieStore = await cookies()
    cookieStore.set("_medusa_customer_email", email, { maxAge: 60 * 60 * 24 * 7, path: "/" })

    // Force a check to see if we are blocked
    try {
      await sdk.store.customer.retrieve({}, {
        authorization: `Bearer ${token}`
      })
    } catch (err: any) {
      const errStr = err.toString().toLowerCase()
      if (errStr.includes("active account deletion request")) {
        return "ACCOUNT_DELETION_PENDING"
      }
      // If it's another error, we might still want to know, but deletion is our priority
      throw err
    }

    // Transfer cart after login success - Moved here to ensure execution
    try {
      await transferCart(token as string)
    } catch (e) {
      console.error("Transfer cart failed in login:", e)
    }

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    countryCode = formData.get("country_code") as string || "in"
    shouldRedirect = true
  } catch (error: any) {
    const errorStr = error.toString().toLowerCase()

    if (errorStr.includes("active account deletion request") ||
      (error.message && error.message.toLowerCase().includes("active account deletion request"))) {
      // Still set email cookie even if blocked
      const cookieStore = await cookies()
      cookieStore.set("_medusa_customer_email", email, { maxAge: 60 * 60 * 24 * 7, path: "/" })
      return "ACCOUNT_DELETION_PENDING"
    }

    if (errorStr.includes("email not verified") || errorStr.includes("not verified")) {
      return "Please verify your email first. Use Email Registration and enter the code sent to your inbox."
    }

    if (errorStr.includes("invalid") || errorStr.includes("401") || errorStr.includes("not found")) {
      return "Invalid credentials. Please try again."
    }
    return error.message || error.toString()
  }

  if (shouldRedirect) {
    const redirectUrl = formData.get("redirect_url") as string

    // Check if it's a "keep-me-here" context (Wishlist or Review Popups)
    const hasKeepContext = redirectUrl?.includes("login_context=keep")

    // Security + Context check
    if (redirectUrl && redirectUrl.startsWith("/") && hasKeepContext) {
      redirect(redirectUrl)
    } else {
      // DEFAULT: Always Home Page
      redirect(`/${countryCode}`)
    }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()
  await removeCartId()
  await removeSyncLock()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}`)
}

export async function transferCart(token?: string) {
  const cartId = await getCartId()
  const authHeaders = token
    ? { authorization: `Bearer ${token}` }
    : await getAuthHeaders()

  console.log("--- TransferCart Debug ---")
  console.log("Token provided:", !!token)
  console.log("Guest Cart ID:", cartId)

  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

  try {
    console.log("Calling merge API (always)...")
    
    const response = await fetch(`${backendUrl}/store/carts/merge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey || "",
        ...(authHeaders as any),
      },
      // Only include body if cartId exists
      ...(cartId ? { body: JSON.stringify({ cart_id: cartId }) } : {}),
      cache: "no-store",
    })

    if (response.ok) {
      const data = await response.json()
      console.log("--- Login Merge Response (JSON) ---")
      console.log(JSON.stringify(data, null, 2))
      console.log("-----------------------------------")
      
      const activeCartId = data.cart?.id || data.id || data.cart_id
      
      if (activeCartId) {
        console.log("Storing Cart ID in cookie:", activeCartId)
        await setCartId(activeCartId)
      }
    } else if (response.status === 404) {
      // 404 is fine - it just means the customer has no active cart yet
      console.log("No active cart found for this customer (expected).")
    } else {
      const errorText = await response.text()
      console.log(`Merge API Info (${response.status}):`, errorText)
      if (cartId) {
        await sdk.store.cart.transferCart(cartId, {}, authHeaders).catch(() => { })
      }
    }
  } catch (error: any) {
    console.error("Merge API error:", error.message)
    if (cartId) {
      await sdk.store.cart.transferCart(cartId, {}, authHeaders).catch(() => { })
    }
  }

  console.log("--------------------------")
  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address: any = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
    metadata: {
      address_type: (formData.get("address_type") as string) || "HOME",
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    metadata: {
      address_type: (formData.get("address_type") as string) || "HOME",
    }
  } as any

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const setDefaultAddress = async (addressId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, { is_default_shipping: true }, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export async function initiateGoogleAuth(countryCode?: string) {
  try {
    const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

    if (!backendUrl) {
      return { error: "Backend URL not configured" }
    }

    const callbackUrl = getGoogleOAuthCallbackUrl(countryCode)

    const response = await fetch(`${backendUrl}/auth/customer/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ callback_url: callbackUrl }),
      cache: "no-store",
    })

    if (!response.ok) {
      return { error: "Google auth failed" }
    }

    const result = await response.json()
    const redirectUrl =
      typeof result === "string" ? result : (result as { location?: string })?.location

    if (!redirectUrl) {
      return { error: "No redirect URL received from Google OAuth" }
    }

    return { redirectUrl }
  } catch (error: any) {
    return { error: error.message || "Internal server error" }
  }
}

export async function authenticateGoogleCredential(credential: string) {
  try {
    if (!credential?.trim()) {
      return { error: "Missing Google credential" }
    }

    const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

    if (!backendUrl) {
      return { error: "Backend URL not configured" }
    }

    const response = await fetch(`${backendUrl}/auth/customer/google/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credential }),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : "Authentication failed"
      return { error: message }
    }
    const token = data.token || data

    if (!token || typeof token !== "string") {
      return { error: "No token received" }
    }

    return { token }
  } catch (error: any) {
    return { error: error.message || "Internal server error" }
  }
}

export async function handleGoogleAuthCallback(params: Record<string, string>) {
  try {
    if (!params.code || !params.state) {
      return { error: "Missing authentication parameters" }
    }

    const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

    if (!backendUrl) {
      return { error: "Backend URL not configured" }
    }

    const query = new URLSearchParams({
      code: params.code,
      state: params.state,
    })

    const response = await fetch(
      `${backendUrl}/auth/customer/google/callback?${query.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    )

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : "Authentication failed"
      return { error: message }
    }
    const token = data.token || data

    if (!token || typeof token !== "string") {
      return { error: "No token received" }
    }

    return { token }
  } catch (error: any) {
    return { error: error.message || "Internal server error" }
  }
}

export async function handleGoogleCallback(token: string, email?: string, first_name?: string, last_name?: string) {
  try {
    if (!token || typeof token !== "string") {
      return { error: "Token is required" }
    }

    await setAuthToken(token)
    await transferCart(token).catch(() => { })

    if (email && typeof email === "string") {
      const cookieStore = await cookies()
      cookieStore.set("_medusa_customer_email", email, { maxAge: 60 * 60 * 24 * 7, path: "/" })

      const headers = await getAuthHeaders()
      if (headers && "authorization" in headers) {
        try {
          await sdk.store.customer.create(
            { email, ...(first_name && { first_name }), ...(last_name && { last_name }) },
            {},
            headers
          )
        } catch (err: any) {
          if (!err.message?.includes("already exists") && !err.message?.includes("duplicate")) {

          }
        }
      }
    }

    const customerCacheTag = await getCacheTag("customers")
    if (customerCacheTag) revalidateTag(customerCacheTag)

    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Internal server error" }
  }
}

export async function uploadFiles(formData: FormData) {
  try {
    const authHeaders = await getAuthHeaders()
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

    const response = await fetch(`${backendUrl}/store/upload`, {
      method: "POST",
      headers: {
        ...(authHeaders as Record<string, string>),
        "x-publishable-api-key": publishableKey || "",
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || "Failed to upload to server")
    }

    const data = await response.json()
    // Medusa usually returns { files: [{ url: '...' }] }
    const files = data.files || []
    return { success: true, files }
  } catch (error: any) {

    return { success: false, error: error.message || "Failed to upload" }
  }
}

export async function uploadProfileImage(formData: FormData) {
  try {
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return { error: "No image file provided" }
    }

    // Create new FormData with 'files' field as expected by the backend
    const uploadFormData = new FormData()
    uploadFormData.append("files", imageFile)

    const uploadResult = await uploadFiles(uploadFormData)
    if (!uploadResult.success) {
      return { error: uploadResult.error }
    }

    const imageUrl = uploadResult.files?.[0]?.url

    if (!imageUrl) {
      throw new Error("No image URL returned from server")
    }

    // Fetch current customer to preserve existing metadata
    const currentCustomer = await retrieveCustomer()
    const existingMetadata = (currentCustomer?.metadata as Record<string, any>) || {}
    const newMetadata = {
      ...existingMetadata,
      profile_image_url: imageUrl,
    }

    // Update customer metadata
    await updateCustomer({ metadata: newMetadata })

    const customerCacheTag = await getCacheTag("customers")
    if (customerCacheTag) {
      revalidateTag(customerCacheTag)
    }

    return { success: true, imageUrl }
  } catch (error: any) {

    return { error: error.message || "Failed to upload image" }
  }
}
