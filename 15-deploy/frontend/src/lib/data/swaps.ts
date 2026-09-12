
"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { cookies } from "next/headers"
import { getAuthHeaders } from "./cookies"
import { revalidateTag } from "next/cache"

/**
 * Create an exchange (swap) request.
 * Supports both authenticated customers and guest users.
 */
export const createSwapRequest = async (
    prevState: any,
    formData: FormData
): Promise<{
    success: boolean
    error: string | null
    swap: any | null
}> => {
    const orderId = formData.get("order_id") as string
    const returnItemsJson = formData.get("return_items") as string
    const newItemsJson = formData.get("new_items") as string
    const reason = formData.get("reason") as string
    const note = formData.get("note") as string

    if (!orderId) return { success: false, error: "Order ID is required", swap: null }
    if (!returnItemsJson) return { success: false, error: "Items to return are required", swap: null }
    if (!newItemsJson) return { success: false, error: "New items are required", swap: null }

    let returnItems: any[] = []
    let newItems: any[] = []
    try {
        returnItems = JSON.parse(returnItemsJson)
        newItems = JSON.parse(newItemsJson)
    } catch (e) {
        return { success: false, error: "Invalid items data format", swap: null }
    }

    if (returnItems.length === 0) {
        return { success: false, error: "At least one item must be selected for return", swap: null }
    }

    const headers = {
        ...(await getAuthHeaders()),
    }

    try {
        const payload = {
            order_id: orderId,
            return_items: returnItems,
            new_items: newItems,
            reason: reason || "Size exchange",
            note: note || "Exchange requested from storefront",
        }

        const cookieStore = await cookies()
        const guestToken = cookieStore.get("_medusa_guest_jwt")?.value || cookieStore.get("_medusa_guest_token")?.value
        const token = cookieStore.get("_medusa_jwt")?.value

        let swapData: any

        // Check if we should use the guest endpoint
        if (guestToken && !token) {

            const response = await sdk.client.fetch<any>(
                `/store/guest-orders/${orderId}/swaps`,
                {
                    method: "POST",
                    body: {
                        return_items: payload.return_items,
                        new_items: payload.new_items,
                        reason: payload.reason,
                        note: payload.note,
                    },
                    headers: {
                        ...headers,
                        "Authorization": `Bearer ${guestToken}`
                    },
                    cache: "no-store",
                }
            )
            swapData = response.swap || response
        } else {

            const response = await sdk.client.fetch<any>(
                `/store/swaps`,
                {
                    method: "POST",
                    body: payload,
                    headers,
                    cache: "no-store",
                }
            )
            swapData = response.swap || response
        }

        revalidateTag("orders")

        return { success: true, error: null, swap: swapData }
    } catch (error: any) {
        // Extract error message from response if possible
        let errorMsg = "Failed to create exchange request"
        if (error.response?.data?.message) {
            errorMsg = error.response.data.message
        } else if (error.message) {
            errorMsg = error.message
        }

        return { success: false, error: errorMsg, swap: null }
    }
}

/**
 * List swaps for an order or customer
 */
export const listSwaps = async (orderId?: string) => {
    const headers = {
        ...(await getAuthHeaders()),
    }

    // Authenticated flow
    if ((headers as any).authorization) {
        return sdk.client.fetch<any>(`/store/swaps`, {
            method: "GET",
            query: orderId ? { order_id: orderId } : {},
            headers,
            cache: "no-store",
        })
    }

    // Guest flow
    if (orderId) {
        const cookieStore = await cookies()
        const guestToken = cookieStore.get("_medusa_guest_jwt")?.value || cookieStore.get("_medusa_guest_token")?.value
        if (guestToken) {
            return sdk.client.fetch<any>(`/store/guest-orders/${orderId}/swaps`, {
                method: "GET",
                headers: {
                    ...headers,
                    "Authorization": `Bearer ${guestToken}`
                },
                cache: "no-store",
            })
        }
    }

    return { swaps: [], count: 0 }
}
