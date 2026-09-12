"use client"

import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useParams } from "next/navigation"

type ShareButtonProps = {
    productTitle: string
    productHandle: string
}

export default function ShareButton({ productTitle, productHandle }: ShareButtonProps) {
    const { countryCode } = useParams() as { countryCode: string }
    const [isOpen, setIsOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const productUrl = typeof window !== "undefined"
        ? `${window.location.origin}/${countryCode}/products/${productHandle}`
        : ""

    const handleShare = async () => {
        if (typeof window !== "undefined" && navigator.share) {
            try {
                await navigator.share({
                    title: productTitle,
                    url: productUrl,
                })
                return
            } catch (err) {
                if ((err as Error).name === "AbortError") return
            }
        }
        setIsOpen(true)
    }

    const socialLinks = [
        {
            name: "WhatsApp",
            icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.553 4.189 1.606 6.06L0 24l6.104-1.599a11.82 11.82 0 005.94 1.59h.005c6.634 0 12.032-5.396 12.035-12.03.001-3.213-1.252-6.234-3.528-8.511z" />
                </svg>
            ),
            url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check this out: ${productTitle}\n\n${productUrl}`)}`,
            color: "#25D366"
        },
        {
            name: "Facebook",
            icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
            ),
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`,
            color: "#1877F2"
        },
        {
            name: "Instagram",
            icon: (
                <img
                    src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg"
                    alt="Instagram"
                    className="w-7 h-7 object-contain"
                />
            ),
            url: `https://www.instagram.com/`,
            color: "#E4405F",
            gradient: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
        },
        {
            name: "Twitter",
            icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
            ),
            url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(`Check out ${productTitle}`)}`,
            color: "#000000"
        },
        {
            name: "Telegram",
            icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-0.5">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.26.26-.53.26l.213-3.05 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
                </svg>
            ),
            url: `https://t.me/share/url?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(`Check out ${productTitle}`)}`,
            color: "#26A5E4"
        }
    ]

    const copyToClipboard = () => {
        navigator.clipboard.writeText(productUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Prevent scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    return (
        <>
            {/* Share Trigger Button - Refined Compact UI */}
            <button
                onClick={handleShare}
                data-ga-event="product_share_open"
                data-ga-label={productTitle}
                className="flex items-center gap-1 text-gray-700 hover:text-gold-accent hover:bg-gold-accent/10 transition-all duration-200 py-1 px-1.5 rounded-full flex-shrink-0 group bg-transparent active:scale-95 cursor-pointer"
                title="Share"
            >
                <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110"
                >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span className="text-[11px] sm:text-[12px] font-semibold tracking-tight leading-none">Share</span>
            </button>

            {/* Modern Center Popup Modal - Rendered outside stacking context via Portal */}
            {isOpen && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4">
                    {/* Dark Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative w-full max-w-[420px] bg-white rounded-[24px] sm:rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 pb-2 sm:pb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-none mb-1">Spread the Joy</h3>
                                <p className="text-[10px] sm:text-xs text-gray-400 font-medium tracking-tight">Tell your friends about Cultura Jewels</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all active:scale-90"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>

                        {/* Social Sharing Grid */}
                        <div className="px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-5 gap-2 sm:gap-4">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.name}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-ga-event="product_share_click"
                                    data-ga-label={`${social.name} - ${productTitle}`}
                                    className="flex flex-col items-center gap-1.5 group outline-none"
                                >
                                    <div
                                        className="w-10 h-10 min-[360px]:w-11 min-[360px]:h-11 sm:w-14 sm:h-14 rounded-[12px] min-[360px]:rounded-[16px] sm:rounded-[20px] flex items-center justify-center text-white transition-all duration-300 group-hover:scale-110 group-active:scale-95 shadow-lg"
                                        style={{
                                            background: (social as any).gradient || social.color,
                                            boxShadow: `0 8px 16px -4px ${social.color}40`
                                        }}
                                    >
                                        <div className="scale-75 sm:scale-100 flex items-center justify-center">
                                            {social.icon}
                                        </div>
                                    </div>
                                    <span className="text-[9px] sm:text-[11px] font-bold text-gray-500 group-hover:text-gold-accent transition-colors truncate w-full text-center">{social.name}</span>
                                </a>
                            ))}
                        </div>

                        {/* Link Copy Section */}
                        <div className="px-6 pb-6">
                            <div className="bg-gray-50/80 rounded-[24px] p-3.5 border border-gray-100 group transition-all hover:bg-white hover:shadow-inner">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shareable Link</span>
                                    {copied && (
                                        <span className="text-[10px] font-bold text-green-500 animate-in fade-in slide-in-from-right-2">Link Copied!</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-gray-600 truncate font-semibold">{productUrl}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            copyToClipboard();
                                            // Handle manual event push for clipboard
                                            if (typeof window !== 'undefined' && (window as any).gtag) {
                                                (window as any).gtag('event', 'product_share_click', {
                                                    event_category: 'engagement',
                                                    event_label: `Copy Link - ${productTitle}`
                                                });
                                            }
                                        }}
                                        className={`h-9 px-4 rounded-[14px] text-xs font-bold transition-all active:scale-95 shadow-md ${copied
                                            ? 'bg-green-500 text-white shadow-green-100'
                                            : 'bg-royal-blue text-white hover:bg-gold-accent shadow-gold-accent/10'
                                            }`}
                                    >
                                        {copied ? "Done" : "Copy"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Brand Footer Decoration */}
                        <div className="h-2 w-full flex">
                            <div className="flex-1 bg-pink-400"></div>
                            <div className="flex-1 bg-yellow-400"></div>
                            <div className="flex-1 bg-blue-400"></div>
                            <div className="flex-1 bg-gold-accent/100"></div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
