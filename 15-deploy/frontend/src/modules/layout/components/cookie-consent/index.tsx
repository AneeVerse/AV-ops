"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false)
 
    useEffect(() => {
        const consent = localStorage.getItem("cookie_consent")
        if (!consent) {
            setIsVisible(true)
        }
    }, [])

    const acceptConsent = () => {
        localStorage.setItem("cookie_consent", "granted")

        // GTM Consent Update
        if (typeof window !== "undefined") {
            // @ts-ignore
            if (typeof window.gtag === "function") {
                // @ts-ignore
                window.gtag("consent", "update", {
                    ad_storage: "granted",
                    analytics_storage: "granted",
                    ad_user_data: "granted",
                    ad_personalization: "granted",
                })
                // @ts-ignore
                window.gtag("event", "page_view")
            }

            // @ts-ignore
            window.dataLayer = window.dataLayer || []
            // @ts-ignore
            window.dataLayer.push({
                event: "cookie_accept",
            })
        }

        setIsVisible(false)
    }

    const rejectConsent = () => {
        localStorage.setItem("cookie_consent", "denied")

        if (typeof window !== "undefined") {
            // @ts-ignore
            window.dataLayer = window.dataLayer || []
            // @ts-ignore
            window.dataLayer.push({
                event: "cookie_consent_update",
                ad_storage: "denied",
                analytics_storage: "denied",
            })
        }

        setIsVisible(false)
    }

    if (!isVisible) return null

    return (
        <div
            id="cookie-banner"
            className="fixed bottom-0 left-0 right-0 w-full bg-[#132519]/90 backdrop-blur-lg border-t border-white/10 shadow-lg z-[9999] px-3 py-3 md:px-6 md:py-6"
        >
            <div id="cookie-content" className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
                    {/* Text */}
                    <div className="flex-1 text-center md:text-left min-w-0">
                        <p className="text-white font-serif font-medium text-sm md:text-lg mb-0 md:mb-1">
                            We use cookies to enhance your experience.{" "}
                            <Link
                                href="/privacy-policy"
                                className="text-[#D4AF37] hover:underline hover:text-[#E6C280] font-medium md:hidden transition-colors"
                            >
                                Read our Privacy Policy
                            </Link>
                        </p>
 
                        <p className="text-white/80 text-xs md:text-sm hidden md:block">
                            By clicking "Accept", you consent to our use of cookies.{" "}
                            <Link
                                href="/privacy-policy"
                                className="text-[#D4AF37] hover:underline hover:text-[#E6C280] font-medium transition-colors"
                            >
                                Read our Privacy Policy
                            </Link>
                        </p>
                    </div>
 
                    {/* Buttons */}
                    <div className="flex items-center justify-center gap-3 w-full md:w-auto">
                        <button
                            onClick={rejectConsent}
                            className="flex-1 px-4 py-2 md:px-6 md:py-2.5 font-semibold text-xs md:text-sm text-white/90 bg-transparent border border-white/20 rounded-md hover:bg-white/5 hover:text-white transition-all duration-300 uppercase tracking-wider"
                        >
                            Reject
                        </button>
 
                        <button
                            onClick={acceptConsent}
                            className="flex-1 px-4 py-2 md:px-6 md:py-2.5 font-semibold text-xs md:text-sm text-[#132519] bg-[#D4AF37] border border-transparent rounded-md hover:bg-[#E6C280] transition-all duration-300 uppercase tracking-wider"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CookieConsent
