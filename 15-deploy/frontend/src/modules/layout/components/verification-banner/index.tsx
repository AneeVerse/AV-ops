"use client"

import React, { useState } from "react"
import { usePathname } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { sendCustomerOTP, verifyCustomerOTP } from "@lib/data/customer-registration"
import { updateCustomer } from "@lib/data/customer"
import { XMark } from "@medusajs/icons"

interface VerificationBannerProps {
  customer: HttpTypes.StoreCustomer
}

const VerificationBanner: React.FC<VerificationBannerProps> = ({ customer }) => {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [otpToken, setOtpToken] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const [otpError, setOtpError] = useState<string | null>(null)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Logic to hide on specific pages
  const countryCode = pathname.split('/')[1]
  const isHomePage = pathname === `/${countryCode}` || pathname === `/${countryCode}/` || pathname === "/"
  const isProductListing = pathname.includes(`/${countryCode}/store`) || pathname.includes(`/${countryCode}/collections`) || pathname.includes(`/${countryCode}/categories`)
  const isProductDetails = pathname.includes(`/${countryCode}/products`)

  // Check if verified
  const isVerified = 
    (customer as any).email_verified === true || 
    (customer as any).email_verified === "true" ||
    customer.metadata?.email_verified === true || 
    customer.metadata?.email_verified === "true"

  if (!isVisible || (isVerified && !isSuccess) || isHomePage || isProductListing || isProductDetails) return null

  const handleSendOtp = async () => {
    setIsSendingOtp(true)
    setOtpError(null)
    try {
      const res = await sendCustomerOTP(customer.id, "email_verification")
      if (res.success) {
        setOtpToken(res.token)
        setIsVerifying(true)
      } else {
        setOtpError(res.error || "Failed to send OTP")
      }
    } catch (err: any) {
      setOtpError(err.message || "An error occurred")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpToken || !otpCode) return

    setIsSubmittingOtp(true)
    setOtpError(null)
    try {
      const res = await verifyCustomerOTP(otpToken, otpCode)
      if (res.success) {
        setIsSuccess(true)
        setIsVerifying(false)
        
        // Persist verification status in metadata
        const newMetadata = {
          ...(customer.metadata as Record<string, any> || {}),
          email_verified: true
        }
        await updateCustomer({ metadata: newMetadata })
        
        // Hide banner after success
        setTimeout(() => setIsVisible(false), 3000)
      } else {
        setOtpError(res.error || "Invalid OTP")
      }
    } catch (err: any) {
      setOtpError(err.message || "An error occurred")
    } finally {
      setIsSubmittingOtp(false)
    }
  }

  return (
    <>
      {/* Banner */}
      <div className="bg-[#FFF9F2] border-b border-amber-100/50 py-2 px-4 sticky top-0 z-[40]">
        <div className="max-w-[1440px] mx-auto flex items-center justify-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="flex w-6 h-6 bg-amber-100 rounded-full items-center justify-center text-amber-600 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <p className="text-[13px] sm:text-[14px] font-medium text-amber-900/80 tracking-tight text-center">
              Verify your email to enjoy shopping at Cultura Jewels. <span className="font-bold text-amber-900">{customer.email}</span>
              <button 
                onClick={handleSendOtp}
                disabled={isSendingOtp}
                className="ml-4 text-amber-700 hover:text-amber-900 font-bold disabled:opacity-50 inline-flex items-center gap-1 border-b border-amber-200 hover:border-amber-900"
              >
                {isSendingOtp ? "..." : "Verify Now"}
              </button>
            </p>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="absolute right-0 text-amber-300 hover:text-amber-600 p-1"
          >
            <XMark size={18} />
          </button>
        </div>
      </div>

      {/* OTP Modal */}
      {isVerifying && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">
            <div className="bg-white p-6 text-center relative border-b border-gray-50">
              <button 
                onClick={() => setIsVerifying(false)}
                className="absolute right-3 top-3 p-1.5 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <XMark size={16} />
              </button>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border" style={{ backgroundColor: 'rgba(139, 90, 177, 0.1)', borderColor: 'rgba(139, 90, 177, 0.2)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-gray-900">Verify Email</h3>
              <p className="text-gray-500 text-[11px] mt-1.5 leading-relaxed px-4">
                We've sent a 6-digit code to <br/>
                <span className="font-bold text-gold-accent">{customer.email}</span>
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-6 text-center">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center text-3xl font-black tracking-[0.3em] py-3 border-b-2 border-gray-100 focus:border-gold-accent focus:outline-none placeholder:text-gray-100 bg-transparent"
                    placeholder="000000"
                    autoFocus
                  />
                </div>

                {otpError && (
                  <div className="text-red-500 text-[11px] font-bold flex items-center justify-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                    {otpError}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isSubmittingOtp || otpCode.length < 6}
                    className="w-full py-3 text-white rounded-xl font-bold text-sm flex items-center justify-center bg-royal-blue"
                  >
                    {isSubmittingOtp ? "Verifying..." : "Verify & Continue"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-[11px] font-bold uppercase tracking-wider text-gold-accent"
                  >
                    Resend Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification - Premium Static Modal */}
      {isSuccess && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          {/* Plain Overlay */}
          <div className="absolute inset-0 bg-gray-900/40" />
          
          {/* High-End Card */}
          <div className="relative bg-white p-10 rounded-[40px] flex flex-col items-center text-center max-w-sm w-full border-4 border-gray-50 shadow-sm">
            <div className="w-40 h-40 flex items-center justify-center mb-4">
              <img 
                src="/uploads/profile-images/t-shirt.gif" 
                alt="Success" 
                className="w-36 h-36 object-contain"
              />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none mb-2">Email Verified</h3>
              <div className="h-1 w-10 bg-royal-blue mx-auto rounded-full mb-4" />
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3">Welcome to the family</p>
              <p className="text-gray-600 text-[13px] font-medium leading-relaxed px-2">
                Your email is successfully verified.<br/>
                Now you can enjoy shopping at <span className="text-gray-900 font-bold">Cultura Jewels</span>.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default VerificationBanner
