import "server-only"
import { cookies as nextCookies, headers } from "next/headers"
import { useSecureCookies } from "@lib/util/env"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const getGuestAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_guest_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies()
    const cacheId = cookies.get("_medusa_cache_id")?.value

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch (error) {
    return ""
  }
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {}
  }

  const cacheTag = await getCacheTag(tag)

  if (!cacheTag) {
    return {}
  }

  return { tags: [`${cacheTag}`] }
}

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
  })
}

export const removeAuthToken = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  const cookies = await nextCookies()
  const headerList = await headers()

  // 1. Prioritize buy_now_cart_id if it exists (for instant single-product Buy Now checkout)
  const buyNowId = cookies.get("buy_now_cart_id")?.value
  if (buyNowId) {
    return buyNowId
  }

  // 2. Check for x-cart-id header from middleware
  const headerId = headerList.get("x-cart-id")
  if (headerId) {
    return headerId
  }

  // 3. Fallback to regular cart cookies
  const id = cookies.get("_medusa_cart_id")?.value || 
             cookies.get("cart_id")?.value || 
             cookies.get("medusa_cart_id")?.value
             
  return id
}

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
  })
}

export const removeCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", "", {
    maxAge: -1,
  })
}

export const removeSyncLock = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_synced", "", {
    maxAge: -1,
  })
}

export const setHoldCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_hold_cart_id", cartId, {
    maxAge: 60 * 60 * 24,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
  })
}

export const getHoldCartId = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_hold_cart_id")?.value
}

export const removeHoldCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_hold_cart_id", "", {
    maxAge: -1,
  })
}

export const setBuyNowCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("buy_now_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
  })
}

export const removeBuyNowCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("buy_now_cart_id", "", {
    maxAge: -1,
  })
}
