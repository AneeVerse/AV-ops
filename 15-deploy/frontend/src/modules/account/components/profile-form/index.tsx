"use client"

import React, { useActionState, useEffect, useState, useRef } from "react"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer, uploadProfileImage } from "@lib/data/customer"
import { PencilSquare } from "@medusajs/icons"
import { sendCustomerOTP, verifyCustomerOTP } from "@lib/data/customer-registration"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import AccountDeletion from "../account-deletion"

type ProfileFormProps = {
    customer: HttpTypes.StoreCustomer
}

// Helper function to get profile image URL from metadata
const getProfileImageUrl = (customer: HttpTypes.StoreCustomer): string => {
    const metadata = customer.metadata as Record<string, any> | undefined
    if (metadata?.profile_image_url) {
        return metadata.profile_image_url
    }
    // Fallback to avatar generator
    return `https://ui-avatars.com/api/?name=${customer.first_name || "J"}+${customer.last_name || "W"}&background=D195FF&color=fff&size=256&bold=true`
}

const ProfileForm: React.FC<ProfileFormProps> = ({ customer }) => {
    const [successState, setSuccessState] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [imagePreview, setImagePreview] = useState<string>(getProfileImageUrl(customer))
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // OTP related states
    const [isSendingOtp, setIsSendingOtp] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [otpToken, setOtpToken] = useState<string | null>(null)
    const [otpCode, setOtpCode] = useState("")
    const [showOtpInput, setShowOtpInput] = useState(false)
    const [otpType, setOtpType] = useState<"email_verification" | "phone_verification">("phone_verification")
    const [otpError, setOtpError] = useState<string | null>(null)
    const [imageError, setImageError] = useState<string | null>(null)
    const [phoneVerified, setPhoneVerified] = useState((customer as any).phone_verified === true || (customer as any).phone_verified === "true" || customer.metadata?.phone_verified === true || customer.metadata?.phone_verified === "true")
    const [emailVerified, setEmailVerified] = useState((customer as any).email_verified === true || (customer as any).email_verified === "true" || customer.metadata?.email_verified === true || customer.metadata?.email_verified === "true")

    const updateProfile = async (
        _currentState: Record<string, unknown>,
        formData: FormData
    ) => {
        setIsSubmitting(true)
        const fullName = formData.get("full_name") as string
        const phone = formData.get("phone") as string

        try {
            // Only include fields supported by Medusa 2.0 Store API
            const payload: any = {
                first_name: fullName.split(" ")[0],
                last_name: fullName.split(" ").slice(1).join(" ") || ".",
                phone: phone,
            }

            await updateCustomer(payload)
            setIsSubmitting(false)
            // If phone is changed, it's no longer verified
            if (phone !== customer.phone) {
                setPhoneVerified(false)
            }
            return { success: true, error: null }
        } catch (error: any) {
            setIsSubmitting(false)
            return { success: false, error: error.toString() }
        }
    }

    const [state, formAction] = useActionState(updateProfile, {
        error: null,
        success: false,
    })

    useEffect(() => {
        if (state.success) {
            setSuccessState(true)
            const timer = setTimeout(() => setSuccessState(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [state.success])

    const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim()

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImageError(null)
        if (!file.type.startsWith("image/")) {
            setImageError("Please select an image file")
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setImageError("Please upload an image smaller than 5MB")
            return
        }

        setIsUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append("image", file)
            const result = await uploadProfileImage(formData)
            if (result.success) {
                window.location.reload()
            } else {
                throw new Error(result.error)
            }
        } catch (error: any) {
            alert(error.message || "Failed to upload image")
            setImagePreview(getProfileImageUrl(customer))
        } finally {
            setIsUploadingImage(false)
        }
    }

    const handleSendOtp = async (type: "email_verification" | "phone_verification" = "phone_verification") => {
        const target = type === "email_verification" ? customer.email : customer.phone
        if (!target) {
            setOtpError(`Please save a ${type === "email_verification" ? "email" : "phone number"} first.`)
            return
        }

        setIsSendingOtp(true)
        setOtpError(null)
        setOtpType(type)
        try {
            const result = await sendCustomerOTP(customer.id, type)
            if (result.success && result.token) {
                setOtpToken(result.token)
                setShowOtpInput(true)
            } else {
                setOtpError(result.error || "Failed to send OTP")
            }
        } catch (err: any) {
            setOtpError(err.message || "An error occurred")
        } finally {
            setIsSendingOtp(false)
        }
    }

    const handleVerifyOtp = async () => {
        if (!otpToken || !otpCode) return

        setIsVerifying(true)
        setOtpError(null)
        try {
            const result = await verifyCustomerOTP(otpToken, otpCode)
            if (result.success) {
                // Update local state
                if (otpType === "phone_verification") {
                    setPhoneVerified(true)
                } else {
                    setEmailVerified(true)
                }

                // Persist verification status in metadata
                const newMetadata = {
                    ...(customer.metadata as Record<string, any> || {}),
                    [otpType === "phone_verification" ? "phone_verified" : "email_verified"]: true
                }
                await updateCustomer({ metadata: newMetadata })

                setShowOtpInput(false)
                setSuccessState(true)
                // Reload to fetch updated metadata and ensure consistency
                window.location.reload()
            } else {
                setOtpError(result.error || "Invalid OTP")
            }
        } catch (err: any) {
            setOtpError(err.message || "An error occurred")
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            <form action={formAction} className="w-full">
                <div className="flex flex-col gap-y-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center mb-2">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-gold-accent/20 to-ivory-bg shadow-lg ring-4 ring-white">
                                <img
                                    src={imagePreview}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingImage}
                                className="absolute bottom-1 right-1 bg-white rounded-full p-2.5 shadow-lg border-2 border-white cursor-pointer hover:bg-gray-50 transition-all group-hover:scale-110 disabled:opacity-50"
                            >
                                {isUploadingImage ? (
                                    <div className="w-5 h-5 border-2 border-gold-accent border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <PencilSquare className="w-5 h-5 text-gold-accent" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 font-medium">Please upload an image smaller than 5MB.</p>
                        {imageError && (
                            <p className="text-[10px] text-red-600 mt-1 font-bold animate-in fade-in slide-in-from-top-1">
                                {imageError}
                            </p>
                        )}
                    </div>

                    {/* Main Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Full Name<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="full_name"
                                required
                                defaultValue={fullName}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/30 focus:border-transparent transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Mobile Number<span className="text-red-500">*</span>
                            </label>
                            <div className="relative phone-input-container">
                                <PhoneInput
                                    country={"in"}
                                    value={customer.phone || ""}
                                    onChange={(value) => {
                                        const cleanedValue = value.replace(/\D/g, "")
                                        const cleanedCustomerPhone = (customer.phone || "").replace(/\D/g, "")
                                        if (cleanedValue && cleanedValue !== cleanedCustomerPhone) {
                                            setPhoneVerified(false)
                                        }
                                    }}
                                    inputProps={{
                                        name: "phone",
                                        required: true
                                    }}
                                    inputStyle={{
                                        width: "100%",
                                        height: "46px",
                                        fontSize: "14px",
                                        paddingLeft: "52px",
                                        paddingRight: "80px",
                                        borderRadius: "8px",
                                        border: "1px solid #e5e7eb",
                                        backgroundColor: "#f9fafb99",
                                        transition: "all 0.2s",
                                        color: "#111827"
                                    }}
                                    buttonStyle={{
                                        backgroundColor: "transparent",
                                        border: "none",
                                        borderRadius: "8px 0 0 8px",
                                        paddingLeft: "8px"
                                    }}
                                    containerStyle={{
                                        width: "100%",
                                        height: "46px"
                                    }}
                                    dropdownStyle={{
                                        width: "280px",
                                        borderRadius: "8px",
                                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                                    }}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                    {phoneVerified ? (
                                        <div className="bg-green-50 px-2 py-1.5 rounded-md flex items-center gap-1">
                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Verified</span>
                                        </div>
                                    ) : customer.phone ? (
                                        <button
                                            type="button"
                                            onClick={() => handleSendOtp("phone_verification")}
                                            disabled={isSendingOtp}
                                            className="bg-[#F3E8FF] text-gold-accent px-3 h-8 rounded-lg text-[11px] font-bold hover:bg-royal-blue hover:text-white transition-all disabled:opacity-50"
                                        >
                                            {isSendingOtp && otpType === "phone_verification" ? "..." : "Verify"}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <style jsx global>{`
                                .phone-input-container .react-tel-input .form-control:focus {
                                    background-color: white !important;
                                    outline: none !important;
                                    ring: 2px !important;
                                    border-color: #D4AF37 !important;
                                    box-shadow: 0 0 0 2px #f3e8ff !important;
                                }
                            `}</style>
                        </div>
                    </div>

                    {/* OTP Input Section */}
                    {showOtpInput && (
                        <div className="p-4 rounded-xl bg-gold-accent/10 border border-gold-accent/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-royal-blue">Confirm {otpType === "email_verification" ? "Email" : "Phone"} OTP</span>
                                <button type="button" onClick={() => setShowOtpInput(false)} className="text-xs text-gold-accent/70 hover:text-gold-accent">Cancel</button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="Enter 6-digit code"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gold-accent/20 focus:outline-none focus:ring-2 focus:ring-gold-accent text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleVerifyOtp}
                                    disabled={isVerifying || otpCode.length < 4}
                                    className="shrink-0 px-4 py-2 bg-royal-blue text-white rounded-lg font-bold hover:bg-gold-accent disabled:opacity-50 text-sm whitespace-nowrap"
                                >
                                    {isVerifying ? "..." : "Verify"}
                                </button>
                            </div>
                            {otpError && <p className="text-xs text-red-600">{otpError}</p>}
                        </div>
                    )}

                    <div className="flex flex-col gap-y-2">
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <div className="relative">
                            <input
                                type="email"
                                name="email"
                                defaultValue={customer.email}
                                readOnly
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none pr-24"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                {emailVerified ? (
                                    <div className="bg-green-50 px-2 py-1.5 rounded-md flex items-center gap-1">
                                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Verified</span>
                                    </div>
                                ) : customer.email ? (
                                    <button
                                        type="button"
                                        onClick={() => handleSendOtp("email_verification")}
                                        disabled={isSendingOtp}
                                        className="bg-[#F3E8FF] text-gold-accent px-3 h-8 rounded-lg text-[11px] font-bold hover:bg-royal-blue hover:text-white transition-all disabled:opacity-50"
                                    >
                                        {isSendingOtp && otpType === "email_verification" ? "..." : "Verify"}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:flex-1 h-11 bg-royal-blue text-white rounded-[30px] font-bold hover:bg-gold-accent transition-all shadow-lg shadow-gold-accent/10 disabled:opacity-50 text-sm"
                        >
                            {isSubmitting ? "Saving..." : "Save Profile Details"}
                        </button>
                        <div className="w-full sm:flex-1">
                            <AccountDeletion customerEmail={customer.email} hideHeader={true} />
                        </div>
                    </div>

                    {/* Status Messages */}
                    {state.error && <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm"><strong>Error:</strong> {state.error}</div>}
                    {successState && <div className="p-4 rounded-lg bg-green-50 text-green-700 text-sm"><strong>Success!</strong> Profile updated.</div>}
                </div>
            </form>
        </div>
    )
}

export default ProfileForm
