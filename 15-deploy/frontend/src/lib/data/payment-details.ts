"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

export const listPaymentDetails = async () => {
    const authHeaders = await getAuthHeaders()

    // If no auth headers (guest user), don't even try to fetch
    if (!authHeaders || Object.keys(authHeaders).length === 0) {
        return []
    }

    const headers = {
        ...authHeaders,
    }

    const next = {
        ...(await getCacheOptions("payment_details")),
    }

    return sdk.client
        .fetch<any>(`/store/payment-details`, {
            method: "GET",
            headers,
            next,
            cache: "no-store",
        })
        .then((res: any) => res.payment_details || [])
        .catch(() => [])
}

export const createPaymentDetail = async (
    type: "upi" | "bank" | "card",
    detail_json: Record<string, string>
) => {
    const headers = {
        ...(await getAuthHeaders()),
    }

    return sdk.client.fetch<any>(`/store/payment-details`, {
        method: "POST",
        headers,
        body: { type, detail_json },
    })
}

export const makeDefaultPaymentDetail = async (id: string) => {
    const headers = {
        ...(await getAuthHeaders()),
    }

    return sdk.client.fetch<any>(`/store/payment-details/${id}/make-default`, {
        method: "POST",
        headers,
    })
}

export const deletePaymentDetail = async (id: string) => {
    const headers = {
        ...(await getAuthHeaders()),
    }

    return sdk.client.fetch<any>(`/store/payment-details/${id}`, {
        method: "DELETE",
        headers,
    })
}

