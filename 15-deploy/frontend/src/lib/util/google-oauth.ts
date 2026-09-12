/**
 * OAuth redirect_uri must exactly match a URI registered in Google Cloud Console.
 * That is the storefront callback path (often includes country code), NOT the backend API path.
 *
 * Set NEXT_PUBLIC_GOOGLE_OAUTH_CALLBACK_URL to override (must match Console exactly).
 */
export function getGoogleOAuthCallbackUrl(countryCode?: string): string {
  const explicit = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CALLBACK_URL?.trim()
  if (explicit) {
    return explicit
  }

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.STOREFRONT_URL ||
    "http://localhost:8000"
  const normalized = base.replace(/\/$/, "")
  const region =
    countryCode?.trim().toLowerCase() ||
    process.env.NEXT_PUBLIC_DEFAULT_REGION?.trim().toLowerCase() ||
    ""

  if (region && /^[a-z]{2,3}$/i.test(region)) {
    return `${normalized}/${region}/auth/customer/google/callback`
  }

  return `${normalized}/auth/customer/google/callback`
}
