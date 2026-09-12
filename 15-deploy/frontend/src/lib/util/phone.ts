/**
 * Normalize a phone value for Indian checkout (+91).
 * PhoneInput stores digits without "+" (e.g. "919812345678" or "9812345678").
 */
export const normalizeIndianPhone = (phone?: string | null): string => {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`
  if (digits.length > 10 && !String(phone).startsWith("+")) return `+${digits}`
  return String(phone)
}

/** Valid when user entered a 10-digit Indian mobile or full +91 number. */
export const isValidIndianPhone = (phone?: string | null): boolean => {
  if (!phone) return false
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return true
  if (digits.length === 12 && digits.startsWith("91")) return true
  return false
}

export const getIndianPhoneDigits = (phone?: string | null): string => {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  return digits
}

export type PhoneCountry = {
  iso2: string
  name: string
  dialCode: string
  flag: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso2: "in", name: "India", dialCode: "91", flag: "🇮🇳" },
]

export const parsePhoneParts = (
  phone?: string | null,
  defaultDialCode = "91"
): { dialCode: string; localNumber: string } => {
  const digits = (phone || "").replace(/\D/g, "")

  if (!digits) {
    return { dialCode: defaultDialCode, localNumber: "" }
  }

  // Full number: 91 + 10 digit mobile = 12 digits
  if (digits.length >= 12 && digits.startsWith("91")) {
    return { dialCode: "91", localNumber: digits.slice(2, 12) }
  }

  // Country code only — show in left box, keep right box empty
  if (digits === "91") {
    return { dialCode: "91", localNumber: "" }
  }

  // Partial entry with country prefix (e.g. user pasted or old combined value)
  if (digits.startsWith("91") && digits.length > 2 && digits.length < 12) {
    return { dialCode: "91", localNumber: digits.slice(2) }
  }

  // Plain local number (10 digits or partial while typing)
  if (digits.length <= 10) {
    return { dialCode: defaultDialCode, localNumber: digits }
  }

  return { dialCode: defaultDialCode, localNumber: digits.slice(-10) }
}

/** Combined value stored in forms (e.g. "919812345678"). Empty when no local digits. */
export const combinePhoneParts = (dialCode: string, localNumber: string): string => {
  const dial = dialCode.replace(/\D/g, "")
  const local = localNumber.replace(/\D/g, "").slice(0, 10)
  if (!local) return ""
  return `${dial}${local}`
}

export const isValidPhoneParts = (dialCode: string, localNumber: string): boolean => {
  const dial = dialCode.replace(/\D/g, "")
  const local = localNumber.replace(/\D/g, "")
  if (dial === "91") return local.length === 10
  return local.length >= 6
}

export const isValidEmail = (email?: string | null): boolean => {
  if (!email?.trim()) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
