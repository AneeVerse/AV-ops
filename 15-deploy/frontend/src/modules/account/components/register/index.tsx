"use client"

import { useActionState, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import Envelope from "@modules/common/icons/envelope"
import Lock from "@modules/common/icons/lock"
import User from "@modules/common/icons/user"
import PhoneIcon from "@modules/common/icons/phone"
import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"
import { initiateGoogleAuth } from "@lib/data/customer"
import { GoogleLoginButton } from "@pradip1995/commerce-auth/components/google-login"
import { registerCustomer, sendCustomerOTP, verifyCustomerOTP } from "@lib/data/customer-registration"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Input, Button, Heading, Text, clx } from "@medusajs/ui"
import Modal from "@modules/common/components/modal"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import { SHOP_NAME } from "@lib/util/brand"
import Spinner from "@modules/common/icons/spinner"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

type RegistrationStep = "form" | "otp" | "success"

const Register = ({ setCurrentView }: Props) => {
  const params = useParams()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Multi-step registration state
  const [step, setStep] = useState<RegistrationStep>("form")
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  })
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [otpToken, setOtpToken] = useState<string | null>(null)
  const [otp, setOtp] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [verificationMethod, setVerificationMethod] = useState<"email_verification" | "phone_verification">("email_verification")

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // Step 1: Submit registration form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const [first_name, ...last_name_parts] = formData.full_name.split(" ")
      const last_name = last_name_parts.join(" ") || "."

      // Validation
      if (verificationMethod === "phone_verification" && !formData.phone) {
        setError("Please enter your phone number for mobile verification")
        setIsSubmitting(false)
        return
      }

      // Register customer
      const result = await registerCustomer({
        email: formData.email,
        first_name: first_name || "",
        last_name: last_name,
        phone: formData.phone || undefined,
        password: formData.password,
      })

      if (!result.success) {
        setError(result.error || "Registration failed")
        setIsSubmitting(false)
        return
      }

      // Store customer ID
      setCustomerId(result.customer?.id)

      // Send OTP based on selected verification method
      const otpResult = await sendCustomerOTP(result.customer?.id, verificationMethod)

      if (!otpResult.success) {
        const hint =
          verificationMethod === "phone_verification"
            ? " SMS is not configured yet. Please use Email Registration instead."
            : ""
        setError((otpResult.error || "Failed to send verification code") + hint)
        setIsSubmitting(false)
        return
      }

      // Store OTP token and show OTP modal
      setOtpToken(otpResult.token)
      setShowOtpModal(true)
      setStep("otp")
    } catch (err: any) {
      setError(err.message || "An error occurred during registration")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) return
    setOtpLoading(true)
    setError(null)

    try {
      const result = await verifyCustomerOTP(otpToken || "", otp)

      if (!result.success) {
        setError(result.error || "Invalid verification code")
        setOtpLoading(false)
        return
      }

      // Success!
      setStep("success")

      // Redirect to login after a short delay
      setTimeout(() => {
        setShowOtpModal(false)
        setCurrentView(LOGIN_VIEW.SIGN_IN)
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Verification failed")
    } finally {
      setOtpLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (!customerId) return
    setOtpLoading(true)
    setError(null)

    try {
      const result = await sendCustomerOTP(customerId, verificationMethod)

      if (!result.success) {
        setError(result.error || "Failed to resend code")
      } else {
        setOtpToken(result.token)
        setError(null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  const closeOtpModal = () => {
    setShowOtpModal(false)
    setOtp("")
    setError(null)
  }

  return (
    <div
      className="w-full flex flex-col"
      data-testid="register-page"
    >
      {/* Register Title */}
      <h1 className="text-xl min-[340px]:text-2xl min-[550px]:text-3xl font-bold text-gray-800 mb-1 min-[340px]:mb-2">Register to {SHOP_NAME}</h1>
      <p className="text-sm min-[340px]:text-base text-gray-500 mb-6 text-center min-[550px]:text-left">
        Create an account! Please enter your details
      </p>

      {/* Google Signup at Top */}
      <div className="mb-6">
        <GoogleLoginButton
          countryCode={params?.countryCode as string | undefined}
          initiateAuth={initiateGoogleAuth}
        />

        {/* Quick Link at Top */}
        <div className="mt-4 text-center">
          <span className="text-gray-700 text-xs min-[340px]:text-sm">
            Already have an account?{" "}
            <button
              onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
              className="text-gold-accent font-bold hover:underline"
            >
              Login
            </button>
          </span>
        </div>
      </div>

      {/* Registration Toggle */}
      <div className="flex justify-center mb-8">
        <div className="flex bg-[#F3F4F6] p-1.5 rounded-full w-full max-w-[420px] border border-gray-100 shadow-inner">
          <button
            type="button"
            onClick={() => setVerificationMethod("phone_verification")}
            className={clx(
              "flex-1 py-2.5 text-sm font-bold rounded-full transition-all duration-300",
              verificationMethod === "phone_verification" 
                ? "bg-white text-gold-accent shadow-md border-2 border-black" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            Mobile Registration
          </button>
          <button
            type="button"
            onClick={() => setVerificationMethod("email_verification")}
            className={clx(
              "flex-1 py-2.5 text-sm font-bold rounded-full transition-all duration-300",
              verificationMethod === "email_verification" 
                ? "bg-white text-gold-accent shadow-md border-2 border-black" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            Email Registration
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span className="px-3 bg-ivory-bg text-gray-400 font-bold">Or sign up with</span>
        </div>
      </div>


      <form className="w-full" onSubmit={handleFormSubmit}>
        {/* Full Name Input */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 min-[340px]:pl-4 flex items-center pointer-events-none">
              <User size="20" color="#9CA3AF" />
            </div>
            <input
              type="text"
              name="full_name"
              placeholder="Full name"
              autoComplete="name"
              required
              value={formData.full_name}
              onChange={handleInputChange}
              className="w-full pl-10 min-[340px]:pl-12 pr-3 min-[340px]:pr-4 py-2 min-[340px]:py-2.5 min-[550px]:py-3 text-sm min-[340px]:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent"
              style={{ borderRadius: '30px' }}
              data-testid="full-name-input"
            />
          </div>
        </div>

        {/* Email Input */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 min-[340px]:pl-4 flex items-center pointer-events-none">
              <Envelope size="20" color="#9CA3AF" />
            </div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="w-full pl-10 min-[340px]:pl-12 pr-3 min-[340px]:pr-4 py-2 min-[340px]:py-2.5 min-[550px]:py-3 text-sm min-[340px]:text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold-accent/20 focus:border-gold-accent transition-all"
              style={{ borderRadius: '30px' }}
              data-testid="email-input"
            />
          </div>
        </div>

        {/* Phone Input */}
        <div className="mb-4 phone-input-register">
          <PhoneInput
            country={"in"}
            value={formData.phone}
            onChange={(value) => {
              setFormData(prev => ({ ...prev, phone: value.startsWith('+') ? value : `+${value}` }))
            }}
            inputProps={{
              name: "phone",
              required: verificationMethod === "phone_verification",
              autoComplete: "tel"
            }}
            placeholder="Mobile Number"
            containerStyle={{
              width: "100%",
            }}
            inputStyle={{
              width: "100%",
              height: "46px",
              fontSize: "15px",
              paddingLeft: "55px",
              borderRadius: "30px",
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              transition: "all 0.2s",
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
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              zIndex: 50
            }}
          />
          <style jsx global>{`
            .phone-input-register .react-tel-input .form-control:focus {
              outline: none !important;
              ring: 2px !important;
              border-color: #D4AF37 !important;
              box-shadow: 0 0 0 2px #f3e8ff !important;
            }
          `}</style>
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
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleInputChange}
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

        {/* Error Message */}
        {error && !showOtpModal && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Terms and Conditions */}
        <div className="mb-4 min-[340px]:mb-5 min-[550px]:mb-6">
          <span className="text-center text-gray-700 text-xs min-[340px]:text-sm">
            By creating an account, you agree to {SHOP_NAME}&apos;s{" "}
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

        {/* Register Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 min-[340px]:py-3 px-3 min-[340px]:px-4 bg-royal-blue text-sm min-[340px]:text-base text-white font-bold hover:bg-gold-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4 min-[340px]:mb-5 min-[550px]:mb-6"
          style={{ borderRadius: '30px' }}
          data-testid="register-button"
        >
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </form>



      {/* OTP Verification Modal */}

      {/* OTP Verification Modal */}
      <Modal isOpen={showOtpModal} close={closeOtpModal} size="small">
        <Modal.Title>
          <Heading className="text-xl font-bold text-center">
            {step === "success" 
              ? "Account Verified! 🎉" 
              : verificationMethod === "email_verification" 
                ? "Verify Your Email" 
                : "Verify Your Mobile"}
          </Heading>
        </Modal.Title>
        <Modal.Body>
          <div className="flex flex-col gap-4 py-4">
            {step === "success" ? (
              <div className="flex flex-col items-center text-center py-6 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <Heading level="h2" className="text-2xl font-bold text-gray-900 mb-2">Account Verified! 🎉</Heading>
                <Text className="text-gray-600">
                  Your account has been verified successfully!
                </Text>
                <div className="flex items-center gap-3 mt-8 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                  <Spinner className="animate-spin text-gold-accent" />
                  <Text className="text-gray-500 text-sm font-medium">Redirecting to login...</Text>
                </div>
              </div>
            ) : (
              <>
                <Text className="text-gray-500 text-center text-sm">
                  We&apos;ve sent a 6-digit verification code to{" "}
                  <strong>{verificationMethod === "email_verification" ? formData.email : formData.phone}</strong>
                </Text>

                <div className="relative flex justify-center gap-x-2.5 mt-8">
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

                {error && (
                  <Text className="text-red-500 text-sm text-center">{error}</Text>
                )}

                <Button
                  className="w-full bg-royal-blue hover:bg-gold-accent text-white"
                  onClick={handleVerifyOtp}
                  isLoading={otpLoading}
                  disabled={otp.length < 6}
                >
                  Verify & Continue
                </Button>

                <div className="text-center">
                  <button
                    onClick={handleResendOtp}
                    disabled={otpLoading}
                    className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
                  >
                    Didn&apos;t receive code? Resend
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default Register
