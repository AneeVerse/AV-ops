"use client"

import React, { useEffect, useState } from "react"
import { registerNotificationToken } from "@lib/data/notifications"
import { Button, IconButton } from "@medusajs/ui"
import { XMark } from "@medusajs/icons"

interface PushNotificationManagerProps {
    customerId?: string
}

const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ customerId }) => {
    const [showPrompt, setShowPrompt] = useState(false)
    const [status, setStatus] = useState<"idle" | "requesting" | "registered" | "denied">("idle")

    useEffect(() => {


        const checkStatus = async () => {
            if (typeof window === "undefined") return

            const permission = Notification.permission
            const storageKey = customerId ? `fcm_reg_${customerId}` : "fcm_reg_guest"
            const alreadyRegistered = localStorage.getItem(storageKey)

            console.log("DEBUG: PushNotification Status", {
                customerId,
                permission,
                alreadyRegistered,
                isDismissed: localStorage.getItem("push_notification_dismissed")
            })

            if (permission === "default") {
                const isDismissed = localStorage.getItem("push_notification_dismissed")
                if (isDismissed === "true") return
                setShowPrompt(true)
            } else if (permission === "granted") {
                if (!alreadyRegistered) {
                    handleAllow(true)
                } else {
                    setStatus("registered")
                }
            } else if (permission === "denied") {
                setStatus("denied")
            }
        }

        setTimeout(checkStatus, 1000)

        // Listen for foreground messages
        const setupListener = async () => {
            try {
                const { onMessageListener } = await import("@lib/firebase")
                onMessageListener().then((payload: any) => {

                    if (Notification.permission === "granted") {
                        new Notification(payload.notification.title, {
                            body: payload.notification.body,
                            icon: "/Logo.png"
                        })
                    }
                })
            } catch (err) {
                // Listener setup error
            }
        }
        setupListener()
    }, [customerId])

    const handleAllow = async (isBackground = false) => {
        if (!isBackground) setStatus("requesting")
        try {
            const { requestNotificationPermission } = await import("@lib/firebase")
            const token = await requestNotificationPermission()
            if (token) {
                const deviceInfo = {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                }
                const success = await registerNotificationToken(token, deviceInfo)
                if (success) {
                    const storageKey = customerId ? `fcm_reg_${customerId}` : "fcm_reg_guest"
                    localStorage.setItem(storageKey, "true")
                    setStatus("registered")
                    setShowPrompt(false)
                    if (!isBackground) alert("Notifications enabled successfully!")
                } else {
                    setStatus("idle")
                    if (!isBackground) alert("Failed to register token with backend.")
                }
            } else {
                setStatus("denied")
            }
        } catch (error) {
            setStatus("idle")
            if (!isBackground) alert("Failed to enable notifications. Please check your browser's settings.")
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem("push_notification_dismissed", "true")
    }

    if (!customerId || !showPrompt || status === "registered") return null

    return (
        <div
            id="push-notification-prompt"
            className="fixed inset-0 z-[999999] flex items-center justify-center p-6"
        >
            {/* Backdrop with elegant blur */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-500"
                onClick={handleDismiss}
            />

            <div className="bg-white dark:bg-neutral-900 w-full max-w-[440px] rounded-[32px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] border border-neutral-100 dark:border-neutral-800 relative overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-20 duration-500">
                {/* Subtle Brand Background Blobs */}
                <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-royal-blue/10 rounded-full blur-[60px]" />

                <div className="relative z-10 p-10">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-gradient-to-br from-royal-blue to-royal-blue w-16 h-16 rounded-[24px] shadow-xl grid place-items-center flex-shrink-0 border border-white/20 relative group">
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[24px]" />
                            <svg
                                width="34"
                                height="34"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="drop-shadow-sm"
                            >
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                            </svg>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all group active:scale-90"
                        >
                            <XMark className="w-6 h-6 text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white" />
                        </button>
                    </div>

                    <div className="text-left">
                        <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white mb-3 tracking-tight">
                            {status === "denied" ? "Notifications Blocked" : "Enable Notifications?"}
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 text-base sm:text-lg mb-10 leading-relaxed">
                            {status === "denied"
                                ? "Please enable notifications in your browser settings to stay updated."
                                : "Don't miss out! Get real-time updates for your order status and exclusive member-only offers."}
                        </p>
                    </div>

                    {status !== "denied" && (
                        <div className="flex flex-col gap-4">
                            <button
                                className="w-full rounded-[20px] h-14 bg-gradient-to-r from-royal-blue to-royal-blue hover:bg-gold-accent text-white font-bold text-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-75"
                                onClick={() => handleAllow()}
                                disabled={status === "requesting"}
                            >
                                {status === "requesting" ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Connecting...</span>
                                    </>
                                ) : (
                                    "Yes, Notify Me"
                                )}
                            </button>
                            <button
                                className="w-full rounded-[20px] h-14 bg-white dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-800 text-neutral-500 dark:text-neutral-300 font-bold text-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:text-neutral-900 dark:hover:text-white transition-all active:scale-[0.98]"
                                onClick={handleDismiss}
                            >
                                Maybe Later
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PushNotificationManager
