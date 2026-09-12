"use client"

import React, { useState, useEffect } from "react"

const ProcessingOverlay = ({ 
  isOpen, 
  title,
  subtitle = "Please do not refresh or close this window",
  variant = "payment"
}: { 
  isOpen: boolean
  title?: string
  subtitle?: string
  variant?: "payment" | "order"
}) => {
  const [messageIndex, setMessageIndex] = useState(0)
  
  const paymentMessages = [
    "Securing your transaction...",
    "Verifying with payment provider...",
    "Finalizing your order...",
    "Almost there...",
    "Finishing up..."
  ]
  
  const orderMessages = [
    "Placing your order...",
    "Preparing your confirmation...",
    "Almost there...",
    "Finalizing details...",
    "Finishing up..."
  ]
  
  const messages = variant === "payment" ? paymentMessages : orderMessages
  const displayTitle = title || (variant === "payment" ? "Processing Payment" : "Placing Order")

  useEffect(() => {
    if (!isOpen) {
      setMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [isOpen, messages.length])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gold-accent/10 flex flex-col items-center max-w-xs w-full mx-4 transform animate-in zoom-in-95 duration-300">
        <div className="relative mb-2">
          <img 
            src="/uploads/profile-images/t-shirt.gif" 
            alt="Placing order..."
            className="w-32 h-32 object-contain mx-auto"
          />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-1 text-center">{displayTitle}</h3>
        
        <div className="h-6 flex items-center justify-center mb-2 text-center px-4">
          <p key={messageIndex} className="text-gold-accent font-semibold text-sm animate-in slide-in-from-bottom-2 fade-in duration-500">
            {messages[messageIndex]}
          </p>
        </div>

        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-royal-blue rounded-full animate-progress transition-all duration-500 ease-out"></div>
        </div>

        <p className="text-xs text-gray-400 text-center italic leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  )
}

export default ProcessingOverlay
