"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

type SubmitReviewParams = {
  product_id: string
  rating: number
  title: string
  description: string
  images?: string[]
}

export async function submitReview(params: SubmitReviewParams) {
  try {
    // Server actions kabhi–kabhi stringified JSON bhi receive kar sakte hain.
    // Defensive: agar string mile to pehle parse karke proper object bana lo.
    const normalizedParams: SubmitReviewParams =
      typeof params === "string"
        ? JSON.parse(params)
        : params

    const authHeaders = await getAuthHeaders()
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    if (!publishableKey) {
      return {
        success: false,
        error: "Configuration error: Publishable API key is missing.",
      }
    }

    if (!authHeaders || !("authorization" in authHeaders)) {
      return {
        success: false,
        error: "Please login to submit a review.",
      }
    }

    // Get base URL from environment
    const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
      ...authHeaders,
    }

    const response = await fetch(`${baseUrl}/store/reviews`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        product_id: normalizedParams.product_id,
        rating: normalizedParams.rating,
        title: normalizedParams.title,
        description: normalizedParams.description,
        images: normalizedParams.images || [],
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to submit review`,
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
      error: error.message || error.error?.message || "An error occurred while submitting the review",
    }
  }
}

type UpdateReviewParams = {
  id: string
  rating?: number
  title?: string
  description?: string
  images?: string[]
}

export async function updateReview(params: UpdateReviewParams) {
  try {
    const normalizedParams: UpdateReviewParams =
      typeof params === "string"
        ? JSON.parse(params)
        : params

    const authHeaders = await getAuthHeaders()
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    if (!publishableKey) {
      return { success: false, error: "Configuration error: Publishable API key is missing." }
    }

    if (!authHeaders || !("authorization" in authHeaders)) {
      return { success: false, error: "Please login to update your review." }
    }

    const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
      ...authHeaders,
    }

    const response = await fetch(`${baseUrl}/store/reviews/${normalizedParams.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        rating: normalizedParams.rating,
        title: normalizedParams.title,
        description: normalizedParams.description,
        images: normalizedParams.images,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        success: false,
        error: error.message || `HTTP ${response.status}: Failed to update review`,
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
      error: error.message || error.error?.message || "An error occurred while updating the review",
    }
  }
}

// SERVER ACTION: Fetch Reviews on the Server (Logs will appear in Terminal)
export async function fetchReviewsForProduct(productId: string) {
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    if (!publishableKey) return []

    const url = new URL(`${backendUrl}/store/products/${productId}/reviews`)
    url.searchParams.set("status", "approved")
    url.searchParams.set("limit", "50")

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    })

    if (response.ok) {
      const data = await response.json()
      return data.reviews || []
    }
    return []
  } catch (error) {
    return []
  }
}

// Check if current authenticated customer has already reviewed the product
export async function checkCustomerReviewStatus(productId: string) {
  try {
    const authHeaders = await getAuthHeaders()
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

    if (!publishableKey || !authHeaders || !("authorization" in authHeaders)) {
      return { hasReviewed: false }
    }

    const response = await fetch(`${backendUrl}/store/products/${productId}/reviews/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
        ...authHeaders,
      },
      cache: "no-store",
    })

    if (response.ok) {
      const data = await response.json()
      return {
        hasReviewed: data.hasReviewed || (data.summary && data.summary.total_reviews > 0),
        reviews: data.reviews || [],
        canAddReview: data.canAddReview
      }
    }

    return { hasReviewed: false }
  } catch (error) {
    return { hasReviewed: false }
  }
}

export async function fetchRatings() {
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    if (!publishableKey) return []

    const response = await fetch(`${backendUrl}/store/ratings`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    })

    if (response.ok) {
      const data = await response.json()
      return data.rating || []
    }
    return []
  } catch (error) {
    return []
  }
}
export async function fetchRatingForProduct(productId: string) {
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    if (!publishableKey) return null

    const response = await fetch(`${backendUrl}/store/ratings?product_id=${productId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    })

    if (response.ok) {
      const data = await response.json()
      // The API returns { rating: [...] }
      if (data.rating && data.rating.length > 0) {
        return data.rating[0]
      }
    }
    return null
  } catch (error) {
    return null
  }
}
