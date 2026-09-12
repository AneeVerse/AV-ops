"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export async function registerNotificationToken(token: string, deviceInfo?: any) {
    const headers = (await getAuthHeaders()) as Record<string, string>

    try {
        const result = await sdk.client.fetch<any>(`/store/notification-tokens`, {
            method: "POST",
            body: {
                token,
                device_info: deviceInfo,
            },
            headers,
        })
        return result
    } catch (error: any) {
        return null
    }
}
