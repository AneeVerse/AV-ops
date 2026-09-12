"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Modal from "@modules/common/components/modal"

export default function CheckoutLeaveGuard() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [targetUrl, setTargetUrl] = useState<string | null>(null)

  const isNavigatingRef = useRef(false)

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNavigatingRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest("a")

      if (link && link.href) {
        // If it's a link within checkout, an anchor, or the same page, do nothing
        if (
          link.href === window.location.href || 
          link.href.startsWith(window.location.pathname + "#") ||
          link.pathname.includes('/checkout') ||
          link.pathname.includes('/order/confirmed')
        ) {
          return
        }

        e.preventDefault()
        setTargetUrl(link.href)
        setShowModal(true)
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleClick, { capture: true })

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleClick, { capture: true })
    }
  }, [])

  const handleConfirm = () => {
    if (targetUrl) {
      isNavigatingRef.current = true
      window.location.href = targetUrl
    }
    setShowModal(false)
  }

  const handleCancel = () => {
    setShowModal(false)
    setTargetUrl(null)
  }

  return (
    <Modal isOpen={showModal} close={handleCancel} size="xsmall">
      <div className="flex flex-col items-center px-6 py-10 sm:px-10 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-[32px] w-full relative">
        {/* Icon */}
        <div className="w-14 h-14 bg-[#FCF5FC] rounded-full flex items-center justify-center mb-5">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8F549B"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        {/* Text content */}
        <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111827] mb-2 tracking-tight">Leave Checkout?</h2>
        <p className="text-[#8B919C] text-[15px] leading-[1.6] mb-8 w-[95%] text-center">
          Your order details and progress will be lost if you leave now. Are you sure you want to go back?
        </p>

        {/* Buttons */}
        <div className="flex flex-col w-full gap-3.5">
          <button
            onClick={handleCancel}
            className="w-full py-3.5 px-4 rounded-full border border-[#8F549B] text-[#8F549B] font-medium text-[15px] hover:bg-[#FCF5FC] transition-colors"
          >
            Stay in Checkout
          </button>
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 px-4 rounded-full bg-[#8F549B] text-white font-medium text-[15px] hover:bg-[#7D4288] transition-colors shadow-sm"
          >
            Yes, Leave
          </button>
        </div>
      </div>
    </Modal>
  )
}
