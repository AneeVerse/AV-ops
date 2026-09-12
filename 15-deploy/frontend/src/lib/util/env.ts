export const getBaseURL = () => {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:8000"
}

/** Razorpay checkout is enabled only when a public key is configured. */
export const isRazorpayEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY?.trim())

/** Secure cookies only when the storefront is served over HTTPS. */
export const useSecureCookies = () => {
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.STOREFRONT_URL || ""
  if (base.startsWith("https://")) return true
  if (base.startsWith("http://")) return false
  return process.env.COOKIE_SECURE === "true"
}
