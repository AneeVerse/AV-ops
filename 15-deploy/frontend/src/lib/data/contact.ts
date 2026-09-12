"use server"

const getBaseUrl = () => {
  return process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
}

const getPublishableKey = () => {
  return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
}

/**
 * Submit a contact request
 */
export async function submitContactRequest({
  email,
  payload,
  metadata,
  source = "storefront",
}: {
  email: string
  payload: {
    full_name?: string
    phone?: string
    topic?: string
    subject?: string
    message: string
  }
  metadata?: Record<string, any>
  source?: string
}) {
  try {
    const publishableKey = getPublishableKey()
    const baseUrl = getBaseUrl()

    if (!publishableKey) {
      return {
        success: false,
        error: "Configuration error: Publishable API key is missing.",
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
    }

    const requestBody: any = {
      email,
      payload,
      source,
    }

    if (metadata) {
      requestBody.metadata = metadata
    }

    const response = await fetch(`${baseUrl}/store/contact-requests`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to submit contact request`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred while submitting the contact request",
    }
  }
}

/**
 * Subscribe to email newsletter
 */
export async function subscribeToNewsletter({
  email,
  status = "subscribed",
  source = "footer",
}: {
  email: string
  status?: "subscribed" | "unsubscribed"
  source?: string
}) {
  try {
    const publishableKey = getPublishableKey()
    const baseUrl = getBaseUrl()

    if (!publishableKey) {
      return {
        success: false,
        error: "Configuration error: Publishable API key is missing.",
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
    }

    const response = await fetch(`${baseUrl}/store/contact-email-subscriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        status,
        source,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to subscribe to newsletter`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred while subscribing to newsletter",
    }
  }
}

