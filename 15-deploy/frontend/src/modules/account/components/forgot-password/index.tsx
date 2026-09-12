"use client"

import { useState } from "react"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import Envelope from "@modules/common/icons/envelope"
import ArrowLeft from "@modules/common/icons/arrow-left"
import { requestPasswordReset, checkEmailRegistered } from "@lib/data/customer-registration"

type Props = {
    setCurrentView: (view: LOGIN_VIEW) => void
}

const ForgotPassword = ({ setCurrentView }: Props) => {
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setIsSubmitting(true)
        setError(null)

        try {
            // First check if the email is registered
            const checkResult = await checkEmailRegistered(email)
            if (!checkResult.exists) {
                setError("This email address is not registered with us. Please sign up to create a new account.")
                setIsSubmitting(false)
                return
            }

            const result = await requestPasswordReset(email)

            if (result.success) {
                setSuccess(true)
            } else {
                setError(result.error || "Failed to send reset link")
            }
        } catch (err: any) {
            setError(err.message || "An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className="w-full flex flex-col" data-testid="forgot-password-success">
                {/* Success Icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-xl min-[340px]:text-2xl min-[550px]:text-3xl font-bold text-gray-800 mb-2 text-center">
                    Check Your Email
                </h1>
                <p className="text-sm min-[340px]:text-base text-gray-500 mb-6 text-center">
                    We've sent a password reset link to <strong>{email}</strong>.
                    Please check your email and click the link to reset your password.
                </p>

                <button
                    onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
                    className="w-full py-2.5 min-[340px]:py-3 px-3 min-[340px]:px-4 bg-royal-blue text-sm min-[340px]:text-base text-white font-bold hover:bg-gold-accent transition-colors"
                    style={{ borderRadius: '30px' }}
                >
                    Back to Login
                </button>

                <p className="text-xs text-gray-500 mt-4 text-center">
                    Didn't receive the email?{" "}
                    <button
                        onClick={() => setSuccess(false)}
                        className="text-gold-accent font-semibold hover:underline"
                    >
                        Try again
                    </button>
                </p>
            </div>
        )
    }

    return (
        <div className="w-full flex flex-col" data-testid="forgot-password-page">
            {/* Back Button */}
            <button
                type="button"
                onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
            >
                <ArrowLeft size={20} />
                <span className="text-sm">Back to Login</span>
            </button>

            {/* Title */}
            <h1 className="text-xl min-[340px]:text-2xl min-[550px]:text-3xl font-bold text-gray-800 mb-1 min-[340px]:mb-2">
                Forgot Password
            </h1>
            <p className="text-sm min-[340px]:text-base text-gray-500 mb-4 min-[340px]:mb-5 min-[550px]:mb-6">
                Enter your email address and we'll send you a link to reset your password.
            </p>

            <form className="w-full" onSubmit={handleSubmit}>
                {/* Email Input */}
                <div className="mb-4 min-[340px]:mb-5 min-[550px]:mb-6">
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
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 min-[340px]:pl-12 pr-3 min-[340px]:pr-4 py-2 min-[340px]:py-2.5 min-[550px]:py-3 text-sm min-[340px]:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent"
                            style={{ borderRadius: '30px' }}
                            data-testid="forgot-password-email-input"
                        />
                    </div>
                </div>

                {/* Error Message */}
                <ErrorMessage error={error} data-testid="forgot-password-error-message" />

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting || !email}
                    className="w-full py-2.5 min-[340px]:py-3 px-3 min-[340px]:px-4 bg-royal-blue text-sm min-[340px]:text-base text-white font-bold hover:bg-gold-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderRadius: '30px' }}
                    data-testid="send-reset-link-button"
                >
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
            </form>

            {/* Login Link */}
            <div className="text-center mt-6">
                <span className="text-gray-700 text-xs min-[340px]:text-sm">
                    Remember your password?{" "}
                    <button
                        onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
                        className="text-gold-accent font-semibold hover:underline"
                    >
                        Login
                    </button>
                </span>
            </div>
        </div>
    )
}

export default ForgotPassword
