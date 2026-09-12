"use server"

export async function subscribeToNewsletter(email: string) {
    const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    try {
        if (!publishableKey) {
            return { success: false, message: "Server configuration error (missing key)" }
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-publishable-api-key": publishableKey,
        }

        const response = await fetch(`${backendUrl}/store/contact-email-subscriptions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                email: email,
                status: "subscribed",
                source: "footer",
            }),
            cache: "no-store",
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Failed to subscribe" }))
            return { success: false, message: errorData.message || `Failed to subscribe` }
        }

        const data = await response.json()

        return { success: true, message: "Thank you for subscribing!", data }

    } catch (error: any) {
        return { success: false, message: error.message || "Something went wrong" }
    }
}
