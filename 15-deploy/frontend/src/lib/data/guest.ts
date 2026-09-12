"use server"

import { cookies, headers } from "next/headers"
import { getGuestAuthHeaders } from "./cookies"
import { sdk } from "@lib/config"
import { useSecureCookies } from "@lib/util/env"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

/**
 * Compatibility wrapper for sendOTP
 */
export async function sendOTP(email: string, type: string = "email_verification") {
    const res = await requestGuestOTP(email)
    // The previous project expected a token or success. 
    // We return a dummy token if successful because the UI checks for it.
    if (res.success) {
        return { success: true, token: "otp_sent_successfully" }
    }
    return res
}

/**
 * Compatibility wrapper for verifyOTP
 */
export async function verifyOTP(email: string, token: string, otp: string) {
    // The previous implementation used 3 args, but guest.ts uses 2.
    // We ignore the mid 'token' as per user's working code.
    return await verifyGuestOTP(email, otp)
}

import { retrieveOrder } from "./orders"

/**
 * Compatibility wrapper for listGuestOrders
 */
export async function listGuestOrders(token: string) {
    const res = await getGuestOrders(token)
    if (!res.success) {
        throw new Error(res.error || "Failed to fetch orders")
    }

    // Fetch full details for each order to ensure latest fulfillment_status is available
    // because the custom list endpoint might not return all fields correctly.
    const fullOrders = await Promise.all(
        (res.orders || []).map(async (order: any) => {
            try {
                return await retrieveOrder(order.id)
            } catch (e) {
                return order
            }
        })
    )

    return { orders: fullOrders, count: fullOrders.length }
}

export async function requestGuestOTP(email: string) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }
    if (PUBLISHABLE_KEY) headers["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const res = await fetch(`${BACKEND_URL}/store/otp/request`, {
            method: "POST",
            headers,
            body: JSON.stringify({ email }),
            cache: "no-store",
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}))
            throw new Error(errorData.message || "Failed to send OTP")
        }
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function verifyGuestOTP(email: string, otp: string) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }
    if (PUBLISHABLE_KEY) headers["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const res = await fetch(`${BACKEND_URL}/store/otp/verify`, {
            method: "POST",
            headers,
            body: JSON.stringify({ email, otp }),
            cache: "no-store",
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}))
            throw new Error(errorData.message || "Failed to verify OTP")
        }

        const data = await res.json()

        if (data.token) {
            const cookieStore = await cookies()
            cookieStore.set("_medusa_guest_jwt", data.token, {
                httpOnly: true,
                secure: useSecureCookies(),
                maxAge: 60 * 60 * 24, // 1 day
                path: "/",
                sameSite: "lax",
            })
        } else {
            throw new Error("No token returned")
        }

        return { success: true, token: data.token }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function logoutGuest() {
    const cookieStore = await cookies()
    cookieStore.set("_medusa_guest_jwt", "", {
        maxAge: -1,
        path: "/",
    })
    return { success: true }
}

export async function getGuestOrders(token?: string) {
    const cookieStore = await cookies()
    const headersStore = await headers()
    const authHeader = headersStore.get("authorization")
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined

    const authToken = token || headerToken || cookieStore.get("_medusa_guest_jwt")?.value
    if (!authToken) return { success: false, error: "Unauthorized" }

    const requestHeaders: Record<string, string> = {
        "Authorization": `Bearer ${authToken}`
    }
    if (PUBLISHABLE_KEY) requestHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const response = await sdk.client.fetch<any>(`/store/guest-orders`, {
            method: "GET",
            headers: requestHeaders,
            query: {
                fields: "id,display_id,status,fulfillment_status,payment_status,created_at,currency_code,total,subtotal,tax_total,shipping_total,discount_total,metadata,email,*items,*items.variant,*items.variant.product"
            },
            cache: "no-store",
        })

        return { success: true, orders: response.orders || [] }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getGuestOrder(id: string, token?: string) {
    const cookieStore = await cookies()
    const headersStore = await headers()
    const authHeader = headersStore.get("authorization")
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined

    const authToken = token || headerToken || cookieStore.get("_medusa_guest_jwt")?.value
    if (!authToken) return { success: false, error: "Unauthorized" }

    const requestHeaders: Record<string, string> = {
        "Authorization": `Bearer ${authToken}`
    }
    if (PUBLISHABLE_KEY) requestHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const response = await sdk.client.fetch<any>(`/store/orders/${id}`, {
            method: "GET",
            headers: requestHeaders,
            query: {
                fields: "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.variant.images,*items.variant.product,*items.variant.product.thumbnail,*items.variant.product.images,*items.product,*items.product.thumbnail,*items.product.images,*fulfillments,*fulfillments.items,*fulfillments.location_id,*returns,*returns.items,*cart,*shipping_address,*billing_address,*region,*shipping_methods"
            },
            cache: "no-store"
        })

        if (response.order) {
            return { success: true, order: response.order }
        } else {
            return { success: false, error: "Order not found" }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function cancelGuestOrder(orderId: string, token?: string) {
    const authHeaders = await getGuestAuthHeaders()
    const authToken = token || (authHeaders as any).authorization?.split(" ")[1]

    if (!authToken) return { success: false, error: "Unauthorized" }

    const requestHeaders: Record<string, string> = {
        "Authorization": `Bearer ${authToken}`
    }
    if (PUBLISHABLE_KEY) requestHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const response = await fetch(`${BACKEND_URL}/store/guest-orders/${orderId}/cancel`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...requestHeaders
            },
            cache: "no-store",
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || "Failed to cancel order")
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getGuestOrderInvoice(orderId: string, token?: string) {
    const authHeaders = await getGuestAuthHeaders()
    const authToken = token || (authHeaders as any).authorization?.split(" ")[1]

    if (!authToken) return { success: false, error: "Unauthorized" }

    const requestHeaders: Record<string, string> = {
        "Authorization": `Bearer ${authToken}`
    }
    if (PUBLISHABLE_KEY) requestHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const response = await fetch(`${BACKEND_URL}/store/guest/invoice/download/${orderId}`, {
            method: "GET",
            headers: requestHeaders,
            cache: "no-store",
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || "Failed to get invoice")
        }

        const contentType = response.headers.get("content-type")
        if (contentType && contentType.includes("application/pdf")) {
            const arrayBuffer = await response.arrayBuffer()
            const base64 = Buffer.from(arrayBuffer).toString('base64')
            return { success: true, type: 'pdf', data: base64 }
        } else {
            const data = await response.json()
            return { success: true, type: 'json', data }
        }

    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function guestReorder(orderId: string, token?: string) {
    const authHeaders = await getGuestAuthHeaders()
    const authToken = token || (authHeaders as any).authorization?.split(" ")[1]

    if (!authToken) return { success: false, error: "Unauthorized" }

    const requestHeaders: Record<string, string> = {
        "Authorization": `Bearer ${authToken}`
    }
    if (PUBLISHABLE_KEY) requestHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const response = await fetch(`${BACKEND_URL}/store/guest-orders/${orderId}/reorder`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...requestHeaders
            },
            cache: "no-store",
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || "Failed to reorder")
        }

        const data = await response.json()
        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createGuestReturn(orderId: string, items: { id: string, quantity: number }[], reason_id?: string, note?: string, token?: string) {
    const authHeaders = await getGuestAuthHeaders()
    const authToken = token || (authHeaders as any).authorization?.split(" ")[1]

    if (!authToken) return { success: false, error: "Unauthorized" }

    const requestHeaders: Record<string, string> = {
        "Authorization": `Bearer ${authToken}`
    }
    if (PUBLISHABLE_KEY) requestHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY

    try {
        const response = await fetch(`${BACKEND_URL}/store/guest-orders/${orderId}/returns`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...requestHeaders
            },
            body: JSON.stringify({
                items,
                reason_id,
                note
            }),
            cache: "no-store",
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || "Failed to create return request")
        }

        const data = await response.json()
        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
