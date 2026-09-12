"use client"

import { initiateGoogleAuth, login } from "@lib/data/customer"
import { GoogleLoginButton } from "@pradip1995/commerce-auth/components/google-login"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import Envelope from "@modules/common/icons/envelope"
import Lock from "@modules/common/icons/lock"
import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"
import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { sendOTP, verifyOTP, listGuestOrders } from "@lib/data/guest"
import { Button, Input, Heading, Text, clx } from "@medusajs/ui"
import Modal from "@modules/common/components/modal"
import { signout } from "@lib/data/customer"
import DeletionPendingModal from "@modules/account/components/deletion-pending-modal"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import Spinner from "@modules/common/icons/spinner"
import { SHOP_NAME } from "@lib/util/brand"

const Login = ({ setCurrentView }: Props) => {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const [message, formAction, isPending] = useActionState(login, null)
  const [showPassword, setShowPassword] = useState(false)
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email")
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [checkingGuest, setCheckingGuest] = useState(false)
  const [showDeletionModal, setShowDeletionModal] = useState(false)
  const [emailForCancellation, setEmailForCancellation] = useState("")
  const emailRef = useRef<HTMLInputElement>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState("")

  useEffect(() => {
    // Check if there's a stored redirect URL
    const storedRedirect = localStorage.getItem("loginRedirectUrl")
    if (storedRedirect) {
      setRedirectUrl(storedRedirect)
    }
  }, [])

  useEffect(() => {
    // Handle account deletion pending error
    if (message === "ACCOUNT_DELETION_PENDING") {
      setEmailForCancellation(emailRef.current?.value || "")
      setShowDeletionModal(true)
    }
  }, [message, params, router])

  useEffect(() => {
    const view = searchParams.get("view")
    const email = searchParams.get("email")

    if (view === "guest" && email && email !== "undefined") {
      setShowGuestModal(true)
    }
  }, [searchParams])

  const handleTrackGuestOrder = async () => {
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }

    const token = getCookie("_medusa_guest_token")

    if (token) {
      setCheckingGuest(true)
      try {
        // Verify token by trying to list orders
        await listGuestOrders(token)

        // If successful, redirect
        const countryCode = (params?.countryCode as string) || "in"
        router.push(`/${countryCode}/guest-orders`)
        return
      } catch (e) {
        // Token invalid, clear it and show modal
        document.cookie = "_medusa_guest_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
      } finally {
        setCheckingGuest(false)
      }
    }

    setShowGuestModal(true)
  }

  return (
    <div
      className="w-full flex flex-col"
      data-testid="login-page"
    >
      <h1 className="text-xl min-[340px]:text-2xl min-[550px]:text-3xl font-bold text-gray-800 mb-1 min-[340px]:mb-2 text-center min-[550px]:text-left">Welcome Back</h1>
      <p className="text-sm min-[340px]:text-base text-gray-500 mb-6 text-center min-[550px]:text-left">
        Log in to your account to continue
      </p>

      {/* Google Login at Top */}
      <div className="mb-6">
        <GoogleLoginButton
          countryCode={params?.countryCode as string | undefined}
          initiateAuth={initiateGoogleAuth}
        />

        {/* Quick Link at Top */}
        <div className="mt-4 text-center">
          <span className="text-gray-700 text-xs min-[340px]:text-sm">
            New to {SHOP_NAME}?{" "}
            <button
              onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
              className="text-gold-accent font-bold hover:underline"
            >
              Register
            </button>
          </span>
        </div>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span className="px-3 bg-ivory-bg text-gray-400 font-bold">Or login with</span>
        </div>
      </div>
      <form className="w-full" action={formAction}>
        <input type="hidden" name="country_code" value={params?.countryCode as string || "in"} />
        {redirectUrl && <input type="hidden" name="redirect_url" value={redirectUrl} />}
        
        {/* Smart Identifier Input */}
        <div className="mb-4">
          {loginMethod === "email" ? (
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-gold-accent">
                <Envelope size="20" />
              </div>
              <input
                type="text"
                name="email_or_phone"
                ref={emailRef}
                value={identifier}
                placeholder="Email or Mobile Number"
                required
                autoFocus={loginMethod === "email"}
                onChange={(e) => {
                  const value = e.target.value
                  setIdentifier(value)
                  const hasLetter = /[a-zA-Z]/.test(value)
                  const isNumeric = /^\+?[\d\s\-()]*$/.test(value) && value.length > 0
                  
                  if (hasLetter) setLoginMethod("email")
                  else if (isNumeric) setLoginMethod("phone")
                }}
                className="w-full pl-12 pr-4 py-3 min-[550px]:py-3.5 text-sm min-[340px]:text-base border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/20 focus:border-gold-accent transition-all shadow-sm"
                style={{ borderRadius: '30px' }}
              />
            </div>
          ) : (
            <div className="phone-input-login relative group">
              <PhoneInput
                country={"in"}
                value={identifier}
                onChange={(value) => {
                  setIdentifier(value)
                  const hasLetter = /[a-zA-Z]/.test(value)
                  if (hasLetter || value === "") setLoginMethod("email")
                }}
                inputProps={{
                  name: "email_or_phone",
                  required: true,
                  autoFocus: true
                }}
                placeholder="Mobile Number"
                containerStyle={{ width: "100%" }}
                inputStyle={{
                  width: "100%",
                  height: "52px",
                  fontSize: "16px",
                  paddingLeft: "55px",
                  borderRadius: "30px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "white"
                }}
                buttonStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "30px 0 0 30px",
                  paddingLeft: "12px"
                }}
                dropdownStyle={{
                  width: "280px",
                  borderRadius: "15px",
                  zIndex: 50
                }}
              />
              <style jsx global>{`
                .phone-input-login .react-tel-input .form-control:focus {
                  outline: none !important;
                  border-color: #D4AF37 !important;
                  box-shadow: 0 0 0 2px #f3e8ff !important;
                }
              `}</style>
            </div>
          )}
        </div>

        {/* Password Input */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 min-[340px]:pl-4 flex items-center pointer-events-none">
              <Lock size="20" color="#9CA3AF" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full pl-10 min-[340px]:pl-12 pr-10 min-[340px]:pr-12 py-2 min-[340px]:py-2.5 min-[550px]:py-3 text-sm min-[340px]:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent"
              style={{ borderRadius: '30px' }}
              data-testid="password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 min-[340px]:pr-4 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size="20" /> : <Eye size="20" />}
            </button>
          </div>
        </div>

        {/* Forgot Password Link */}
        <div className="flex justify-end mb-4 min-[340px]:mb-5 min-[550px]:mb-6">
          <button
            type="button"
            onClick={() => setCurrentView(LOGIN_VIEW.FORGOT_PASSWORD)}
            className="text-xs min-[340px]:text-sm text-gray-700 hover:text-gold-accent"
          >
            Forgot password?
          </button>
        </div>

        <ErrorMessage
          error={message === "ACCOUNT_DELETION_PENDING" ? "" : message}
          data-testid="login-error-message"
        />

        {/* Terms and Conditions */}
        <div className="mb-4 min-[340px]:mb-5 min-[550px]:mb-6">
          <span className="text-center text-gray-700 text-xs min-[340px]:text-sm">
            By logging in, you agree to {SHOP_NAME}&apos;s{" "}
            <LocalizedClientLink
              href="/privacy-policy"
              className="text-gold-accent font-semibold hover:underline"
            >
              Privacy Policy
            </LocalizedClientLink>{" "}
            and{" "}
            <LocalizedClientLink
              href="/terms-of-use"
              className="text-gold-accent font-semibold hover:underline"
            >
              Terms of Use
            </LocalizedClientLink>
            .
          </span>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 min-[340px]:py-3 px-3 min-[340px]:px-4 bg-royal-blue text-sm min-[340px]:text-base text-white font-bold hover:bg-gold-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4 min-[340px]:mb-5 min-[550px]:mb-6"
          style={{ borderRadius: '30px' }}
          onClick={() => {
            if (typeof window !== "undefined") {
              // Wait slightly to make sure the form value is captured, 
              // though React state is already set.
              setTimeout(() => {
                localStorage.removeItem("loginRedirectUrl")
              }, 100)
            }
          }}
          data-testid="sign-in-button"
        >
          {isPending ? "Logging in..." : "Login"}
        </button>
      </form>



      {/* Guest Order Tracking Button */}

      {/* Guest Order Tracking Button */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={handleTrackGuestOrder}
          disabled={checkingGuest}
          className="w-full py-2.5 px-4 rounded-full border border-gold-accent text-gold-accent text-sm font-bold hover:bg-[#f8f4fc] transition-colors flex items-center justify-center gap-2"
        >
          {checkingGuest ? (
            <Spinner className="animate-spin" />
          ) : (
            <span>📦</span>
          )}
          {checkingGuest ? "Checking..." : "Track Guest Order"}
        </button>
      </div>

      <DeletionPendingModal
        isOpen={showDeletionModal}
        close={() => setShowDeletionModal(false)}
        email={emailForCancellation}
        countryCode={params.countryCode as string}
      />

      <GuestOrderModal
        isOpen={showGuestModal}
        close={() => setShowGuestModal(false)}
        router={router}
        params={params}
        initialEmail={searchParams.get("email") || ""}
        autoStart={searchParams.get("view") === "guest" && !!searchParams.get("email")}
      />
    </div>
  )
}

const GuestOrderModal = ({
  isOpen,
  close,
  router,
  params,
  initialEmail = "",
  autoStart = false
}: {
  isOpen: boolean
  close: () => void
  router: any
  params: any
  initialEmail?: string
  autoStart?: boolean
}) => {
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationToken, setVerificationToken] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail)
  }, [initialEmail])

  useEffect(() => {
    // If autoStart is true and we have an email, trigger OTP send immediately
    if (isOpen && autoStart && initialEmail && !autoStartedRef.current) {
      autoStartedRef.current = true
      setIsLoading(true)
      handleSendOtp(initialEmail)
    }
  }, [isOpen, autoStart, initialEmail])

  const handleSendOtp = async (emailToSend = email) => {
    if (!emailToSend) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await sendOTP(emailToSend, "email_verification") as any
      if (res.token || res.success !== false) {
        setVerificationToken(res.token || "temp-token")
        setStep("otp")
      } else {
        setError((res as any).error || "Failed to send OTP")
        setStep("email")
      }
    } catch (e: any) {
      setError(e.message)
      setStep("email")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp) return
    setIsLoading(true)
    setError(null)

    try {
      // Pass email as customerId since it's a guest flow
      const res = await verifyOTP(email, verificationToken || "", otp) as any
      if (res.success !== false) { // Assuming success if no explicit error field
        setSuccess(true)

        // Store token in cookie
        // Note: For a real app, use a server action to set httpOnly cookie.
        // Here we simulate for client-side usage or basic auth header.
        const token = res.token || "guest_access_token"
        document.cookie = `_medusa_guest_token=${token}; path=/; max-age=3600; SameSite=Lax`

        // Redirect to guest order view
        const countryCode = params?.countryCode as string || "in"
        router.push(`/${countryCode}/guest-orders`)
      } else {
        setError(res.error || "Invalid OTP")
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setEmail("")
    setOtp("")
    setStep("email")
    setError(null)
    setSuccess(false)
    close()
  }

  return (
    <Modal isOpen={isOpen} close={reset} size="small">
      <Modal.Body>
        <div className="flex flex-col gap-6 py-4 px-2">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {step === "email" ? "Track Your Order" : "Verify OTP"}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-[300px] mx-auto">
              {step === "email"
                ? "Enter your email address to track your guest orders. We will send you a One-Time Password (OTP)."
                : `Enter the 6-digit code sent to ${email}`
              }
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-gold-accent animate-pulse font-bold">Verification Successful!</div>
              <Spinner />
            </div>
          ) : step === "email" ? (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Envelope size="20" />
                </div>
                <input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  type="email"
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gold-accent transition-all text-sm"
                  style={{ borderRadius: '30px' }}
                />
              </div>

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}

              <button
                className="w-full py-3 bg-royal-blue text-white font-bold hover:bg-gold-accent transition-colors flex justify-center items-center gap-2"
                style={{ borderRadius: '30px' }}
                onClick={() => handleSendOtp()}
                disabled={isLoading || !email}
              >
                {isLoading ? <Spinner size={16} /> : "Send OTP"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative flex justify-center gap-x-2.5 mt-6">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className={`w-10 h-12 flex items-center justify-center border-2 rounded-lg text-xl font-bold transition-all duration-200 ${otp.length === index
                      ? "border-gold-accent ring-2 ring-gold-accent/10 bg-ivory-bg"
                      : otp.length > index
                        ? "border-gray-400 bg-ivory-bg shadow-sm"
                        : "border-gray-200 bg-gray-50/50"
                      }`}
                  >
                    {otp[index] || ""}
                  </div>
                ))}
                <input
                  type="text"
                  maxLength={6}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
              </div>

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}

              <div className="space-y-3">
                <button
                  className="w-full py-3 bg-royal-blue text-white font-bold hover:bg-gold-accent transition-colors flex justify-center items-center gap-2"
                  style={{ borderRadius: '30px' }}
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length < 6}
                >
                  {isLoading ? <Spinner size={16} /> : "Verify & View Orders"}
                </button>

                <button
                  onClick={() => setStep("email")}
                  className="text-xs text-gray-500 hover:text-gold-accent w-full text-center underline font-medium"
                >
                  Change Email
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  )
}

export default Login
