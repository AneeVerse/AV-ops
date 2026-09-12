"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter, usePathname } from "next/navigation"

interface LoginPopupProps {
  isOpen: boolean
  onClose: () => void
  countryCode?: string
  message?: string
}

export default function LoginPopup({ isOpen, onClose, countryCode = "us", message = "Please login to add products to your wishlist." }: LoginPopupProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLoginClick = () => {
    // Store current URL in localStorage for redirect after login
    if (typeof window !== "undefined") {
      const currentPath = pathname || window.location.pathname
      // Add a special marker so the login component knows to keep the user on this page
      const redirectWithContext = currentPath.includes('?')
        ? `${currentPath}&login_context=keep`
        : `${currentPath}?login_context=keep`

      localStorage.setItem("loginRedirectUrl", redirectWithContext)
    }
    router.push(`/${countryCode}/account`)
  }

  if (!isOpen || !mounted) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-ivory-bg rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-auto border border-gray-100 transform transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gold-accent/10 mb-4">
            <svg className="h-6 w-6 text-gold-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Login Required
          </h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            {message}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleLoginClick}
              className="px-4 py-2.5 rounded-xl font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-gold-accent/10 active:scale-95 bg-royal-blue"
              onMouseEnter={(e) => {
                e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
              }}
              onMouseLeave={(e) => {
                e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
              }}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
