"use client"

import { useState } from "react"
import { subscribeToNewsletter } from "@lib/data/newsletter"

const FooterNewsletter = () => {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid email address" })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const result = await subscribeToNewsletter(email)

      if (result.success) {
        // Track form submission in Google Analytics
        if (typeof window !== 'undefined') {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'form_submit',
            form_type: 'footer_newsletter_subscribe'
          });
        }

        setMessage({ type: "success", text: result.message })
        setEmail("")
        // Clear message after 3 seconds
        setTimeout(() => {
          setMessage(null)
        }, 3000)
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: "Something went wrong. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full sm:w-[560px] flex-1 sm:flex-initial">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          required
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          data-ga-event="newsletter_subscribe"
          data-ga-label="Footer Newsletter"
          className="px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg font-semibold text-[#0c1810] bg-[#D4AF37] hover:bg-white hover:text-[#0c1810] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span className="pointer-events-none block">
            {isSubmitting ? "..." : "Subscribe"}
          </span>
        </button>
      </form>
      {message && (
        <p className={`text-xs sm:text-sm mt-2 ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}

export default FooterNewsletter
