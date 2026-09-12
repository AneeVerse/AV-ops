"use client"

import { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"
import LineItemOptions from "@modules/common/components/line-item-options"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React, { useEffect, useState } from "react"
import { listSwaps } from "@lib/data/swaps"
import { listReturns } from "@lib/data/returns"
import { sdk } from "@lib/config"
import { XMark, Spinner } from "@medusajs/icons"
import Image from "next/image"

type OrderRedesignProps = {
    order: HttpTypes.StoreOrder
    handleDownloadInvoice: () => Promise<void>
    isDownloading: boolean
    handleCancelOrder: () => Promise<void>
    isCancelling: boolean
    handleReorder: (skipVariantIds?: string[], forceReorder?: boolean) => Promise<void>
    isReordering: boolean
    canCancel: boolean
    isCancelled: boolean
    hasReturnableItems: boolean
    inventoryIssues: any[] | null
    setInventoryIssues: (issues: any[] | null) => void
}

const OrderRedesign: React.FC<OrderRedesignProps> = ({
    order,
    handleDownloadInvoice,
    isDownloading,
    handleCancelOrder,
    isCancelling,
    handleReorder,
    isReordering,
    canCancel,
    isCancelled,
    hasReturnableItems,
    inventoryIssues,
    setInventoryIssues
}) => {
    const [paddingClass, setPaddingClass] = useState("px-0")
    const [hasActiveExchange, setHasActiveExchange] = useState(false)
    const [hasActiveReturn, setHasActiveReturn] = useState(false)
    const [isGuestUser, setIsGuestUser] = useState<boolean | null>(null)
    const [isCheckingStock, setIsCheckingStock] = useState(false)
    const [fetchedReturns, setFetchedReturns] = useState<any[]>([])
    const [fetchedSwaps, setFetchedSwaps] = useState<any[]>([])
    const [showReorderConfirmModal, setShowReorderConfirmModal] = useState(false)

    useEffect(() => {
        setPaddingClass("px-0")

        // Check login status on mount
        const isLoggedIn = document.cookie.includes("_medusa_jwt")

        // Safely determine guest status after mount
        const guestStatus = !order.customer_id || !isLoggedIn
        setIsGuestUser(guestStatus)
        const checkSwaps = async () => {
            try {
                const result = await listSwaps(order.id)
                const activeSwaps = (result?.swaps || []).filter((s: any) =>
                    s.status !== "canceled" && s.status !== "rejected"
                )
                if (activeSwaps.length > 0) {
                    setHasActiveExchange(true)
                    setFetchedSwaps(activeSwaps)
                }
            } catch (err) {
                // Silence error
            }
        }

        // Check for active returns
        const checkReturns = async () => {
            try {
                const result = await listReturns(order.id)
                const activeReturns = (result?.returns || result?.return_orders || []).filter((r: any) =>
                    r.status !== "canceled" && r.status !== "rejected"
                )
                if (activeReturns.length > 0) {
                    setHasActiveReturn(true)
                    setFetchedReturns(activeReturns)
                }
            } catch (err) {
                // Silence error
            }
        }

        checkSwaps()
        checkReturns()
    }, [order.id])

    // Lock body scroll when inventory issues modal is open
    useEffect(() => {
        if (inventoryIssues) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [inventoryIssues])

    const getAmount = (amount?: number | null) => {
        if (amount === undefined || amount === null) {
            return convertToLocale({
                amount: 0,
                currency_code: order.currency_code,
            })
        }
        return convertToLocale({
            amount,
            currency_code: order.currency_code,
        })
    }

    const formatDate = (date: string | Date) => {
        try {
            const d = new Date(date)
            if (isNaN(d.getTime())) return "N/A"
            return new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            }).format(d)
        } catch (e) {
            return "N/A"
        }
    }

    const formatStepDate = (date: string | Date) => {
        try {
            if (!date) return ""
            const d = new Date(date)
            if (isNaN(d.getTime())) return ""
            return new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
            }).format(d)
        } catch (e) {
            return ""
        }
    }

    const fromMetadataDate = order.metadata?.estimated_delivery || (order as any).shipping_methods?.[0]?.metadata?.etd
    const calcDays = fromMetadataDate ? Math.max(1, Math.ceil((new Date(fromMetadataDate as string).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))) : 7

    const estimatedDays = 
        order.metadata?.estimated_delivery_days || 
        order.metadata?.delivery_days || 
        order.metadata?.days || 
        (order as any).shipping_methods?.[0]?.metadata?.estimated_delivery_days ||
        (order as any).shipping_methods?.[0]?.metadata?.delivery_days ||
        (order as any).shipping_methods?.[0]?.metadata?.days ||
        calcDays;

    const deliveryText = (estimatedDays === 7 || estimatedDays === "7") ? "1 week" : `${estimatedDays} days`

    const steps = [
        { title: "Order Confirmed", status: "confirmed", date: order.created_at },
        { title: "Shipped", status: "shipped", date: null },
        { title: "Out For Delivery", status: "out_for_delivery", date: null },
        { title: "Delivered", status: "delivered", date: null },
    ]

    const getStatusIndex = (status: string) => {
        switch (status) {
            case "not_fulfilled":
                return 0
            case "partially_fulfilled":
            case "fulfilled":
                return 1
            case "partially_shipped":
            case "shipped":
                return 2
            case "delivered":
                return 3
            default:
                return 0
        }
    }

    const currentStatusIndex = getStatusIndex(order.fulfillment_status)

    return (
        <>
        <div className={"w-full max-w-[1360px] mx-auto overflow-x-hidden " + paddingClass + " py-6 sm:py-8 font-sans"}>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0D1B3E] mb-6 sm:mb-8 text-center">
                Track Your Little One's Order
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                    {/* Main Order Card */}
                    <div className="bg-ivory-bg rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 overflow-visible">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4 sm:mb-6">
                            <div>

                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                    <h2 className="text-lg sm:text-xl font-bold text-[#0D1B3E] flex items-center gap-2">
                                        Order ID: {order.display_id}
                                    </h2>
                                    {/* Order Status Badges */}
                                    <div className="flex items-center gap-2">
                                        {/* Fulfillment Status */}
                                        {(() => {
                                            const returns = (order as any).returns || (order as any).return_orders || []
                                            const isReviewed = returns.some((r: any) => r.status === "received" || r.status === "partially_received")
                                            const isRequested = returns.some((r: any) => r.status === "requested")

                                            if (isReviewed) {
                                                return (
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-100">
                                                        Returned
                                                    </span>
                                                )
                                            }

                                            if (isRequested) {
                                                return (
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100 italic">
                                                        Return Requested
                                                    </span>
                                                )
                                            }

                                            return (
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${(order.fulfillment_status === 'fulfilled' || order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered')
                                                    ? 'bg-green-100 text-green-700'
                                                    : order.fulfillment_status === 'canceled'
                                                        ? 'bg-red-100 text-red-700'
                                                        : order.fulfillment_status === 'partially_fulfilled'
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {(order.fulfillment_status || 'pending').split('_').map(word =>
                                                        word.charAt(0).toUpperCase() + word.slice(1)
                                                    ).join(' ')}
                                                </span>
                                            )
                                        })()}

                                        {/* Refund Status */}
                                        {(order.payment_status === "refunded" || order.payment_status === "partially_refunded") && (
                                            <span className="px-3 py-1 bg-green-50 text-[#008A5D] rounded-full text-[10px] font-bold italic border border-green-100 shadow-sm animate-pulse">
                                                Amount Refunded ✨
                                            </span>
                                        )}

                                        {/* Payment Status */}
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${(order.payment_status === 'captured' || order.payment_status === 'partially_captured')
                                            ? 'bg-green-100 text-green-700'
                                            : (order.payment_status === 'awaiting' || order.payment_status === 'authorized' || order.payment_status === 'partially_authorized')
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : (order.payment_status === 'canceled' || order.payment_status === 'refunded' || order.payment_status === 'partially_refunded')
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            Payment: {(order.payment_status || 'pending').split('_').map(word =>
                                                word.charAt(0).toUpperCase() + word.slice(1)
                                            ).join(' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        <span>Order date: <span className="text-black font-semibold">{formatDate(order.created_at)}</span></span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#008A5D] text-sm">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                        <span className="font-semibold">Estimated delivery: After {deliveryText}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 w-full md:w-auto">
                                {/* First Row: Invoice & Reorder */}
                                {(order.fulfillment_status === "delivered" || isCancelled) && (
                                    <div className={`grid gap-2 sm:gap-3 ${order.fulfillment_status === "delivered" && !isCancelled ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
                                        {order.fulfillment_status === "delivered" && !isCancelled && (
                                            <button
                                                onClick={handleDownloadInvoice}
                                                disabled={isDownloading}
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-ivory-bg border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all text-sm font-medium whitespace-nowrap min-w-[120px] shadow-sm"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h8" /><path d="M8 17h8" /><path d="M8 9h1" /></svg>
                                                {isDownloading ? "..." : "Invoice"}
                                            </button>
                                        )}

                                        <div className="relative group w-full min-w-[120px]">
                                            <button
                                                onClick={() => handleReorder()}
                                                disabled={isReordering}
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-royal-blue border border-transparent text-white rounded-xl hover:bg-[#764a97] hover:shadow-md transition-all text-sm font-bold disabled:opacity-50 shadow-sm transform active:scale-95 disabled:bg-gray-400 disabled:shadow-none"
                                                data-ga-event="order_reorder_click"
                                                data-ga-label={`Order ${order.display_id}`}
                                            >
                                                {isReordering ? (
                                                    <Spinner className="animate-spin" />
                                                ) : (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                                                )}
                                                {isReordering ? "Processing..." : "Reorder"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Second Row: Return & Exchange & Cancel */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 items-start">
                                    {order.fulfillment_status === "delivered" && (
                                        <>
                                            {(() => {
                                                const returns = (order as any).returns || (order as any).return_orders || []
                                                const hasActiveReturns = returns.filter((r: any) => r.status !== "canceled" && r.status !== "rejected").length > 0
                                                const isReturnDisabled = hasActiveReturns || hasActiveReturn || !hasReturnableItems
                                                // Default to guest path if not yet determined to avoid mismatch
                                                const returnHref = isGuestUser === false ? `/account/orders/return/${order.id}` : `/order/return/${order.id}`

                                                return (
                                                    <div className="w-full">
                                                        {isReturnDisabled ? (
                                                            <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-100 bg-gray-50 rounded-xl text-gray-300 cursor-not-allowed text-sm font-medium whitespace-nowrap" data-ga-event="order_return_disabled" data-ga-label={`Order ${order.display_id}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                                                Return
                                                            </button>
                                                        ) : (
                                                            <LocalizedClientLink href={returnHref} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 bg-ivory-bg rounded-xl text-gray-700 hover:border-gray-400 hover:text-black hover:bg-gray-50 transition-all text-sm font-medium whitespace-nowrap shadow-sm" data-ga-event="order_return_click" data-ga-label={`Order ${order.display_id}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                                                Return
                                                            </LocalizedClientLink>
                                                        )}
                                                    </div>
                                                )
                                            })()}

                                            {(() => {
                                                const swaps = (order as any).swaps || []
                                                const hasActiveSwaps = swaps.filter((s: any) => s.status !== "canceled" && s.status !== "rejected").length > 0
                                                const isExchangeDisabled = hasActiveSwaps || hasActiveExchange || !hasReturnableItems
                                                const exchangeHref = isGuestUser === false ? `/account/orders/exchange/${order.id}` : `/order/exchange/${order.id}`

                                                return (
                                                    <div className="w-full">
                                                        {isExchangeDisabled ? (
                                                            <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-100 bg-gray-50 rounded-xl text-gray-300 cursor-not-allowed text-sm font-medium whitespace-nowrap" data-ga-event="order_exchange_disabled" data-ga-label={`Order ${order.display_id}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
                                                                Exchange
                                                            </button>
                                                        ) : (
                                                            <LocalizedClientLink href={exchangeHref} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gold-accent bg-gold-accent/10 rounded-xl text-gold-accent hover:bg-royal-blue hover:text-white transition-all text-sm font-medium whitespace-nowrap shadow-sm" data-ga-event="order_exchange_click" data-ga-label={`Order ${order.display_id}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
                                                                Exchange
                                                            </LocalizedClientLink>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </>
                                    )}

                                    {/* Cancel Order Button */}
                                    {(() => {
                                        const hasFulfillment = order.fulfillment_status !== 'not_fulfilled'
                                        const isDisabled = isCancelling || isCancelled || !canCancel || hasFulfillment

                                        return (
                                            <div className="relative group w-full">
                                                <button
                                                    onClick={handleCancelOrder}
                                                    disabled={isDisabled}
                                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-xl transition-all text-sm font-medium disabled:opacity-50 whitespace-nowrap shadow-sm ${isCancelled
                                                        ? "border-gray-200 bg-gray-50 text-gray-400"
                                                        : "border-red-200 bg-ivory-bg text-red-500 hover:bg-red-50 hover:border-red-300 hover:text-red-700 hover:shadow-red-50"
                                                        }`}
                                                    data-ga-event="order_cancel_click"
                                                    data-ga-label={`Order ${order.display_id}`}
                                                >
                                                    {isCancelling ? (
                                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                    )}
                                                    {isCancelling ? "..." : isCancelled ? "Cancelled" : "Cancel Order"}
                                                </button>

                                                {hasFulfillment && !isCancelled && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] px-3 py-2 bg-gray-900 text-white text-[10px] leading-tight rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] text-center">
                                                        Cannot cancel after shipping.
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-gray-900"></div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100 mb-6 sm:mb-8" />

                        {/* Stepper */}
                        <div className="relative mb-8 sm:mb-12 px-2 sm:px-4">
                            <div className="flex justify-between items-start">
                                {(isCancelled ? [
                                    { title: "Order Confirmed", status: "confirmed", date: order.created_at },
                                    { title: "Order Cancelled", status: "canceled", date: (order as any).canceled_at || new Date() }
                                ] : steps).map((step, index, arr) => {
                                    const isActive = isCancelled ? true : index <= currentStatusIndex
                                    const isCancelledStep = isCancelled && index === 1

                                    // Dynamic color based on status
                                    const activeColor = isCancelledStep ? "bg-red-600" : "bg-[#008A5D]"
                                    const ringColor = isCancelledStep ? "ring-red-600" : "ring-[#008A5D]"
                                    const textColor = isCancelledStep ? "text-red-600" : "text-[#008A5D]"
                                    const widthClass = isCancelled ? "w-1/2" : "w-1/4"

                                    // Helper to get icon based on status
                                    const getIcon = () => {
                                        if (isCancelledStep) return (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        )

                                        if (step.status === 'confirmed') return (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        )
                                        if (step.status === 'shipped') return (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                        )
                                        if (step.status === 'out_for_delivery') return (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                                        )
                                        if (step.status === 'delivered') return (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        )

                                        // Default fallback
                                        return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                                    }

                                    return (
                                        <div key={index} className={`flex flex-col items-center relative z-10 ${widthClass}`}>
                                            {/* Line - Adjusted top spacing for larger icon */}
                                            {index < arr.length - 1 && (
                                                <div
                                                    className={`absolute left-[50%] top-4 sm:top-5 w-full h-0.5 sm:h-1 -z-10 ${isActive ? (isCancelled ? "bg-red-600" : "bg-[#008A5D]") : "bg-gray-200"
                                                        }`}
                                                />
                                            )}

                                            {/* Circle - Increased size */}
                                            <div
                                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 sm:border-4 flex items-center justify-center transition-all ${isActive
                                                    ? `${activeColor} border-white ring-1 ${ringColor} text-white`
                                                    : "bg-ivory-bg border-gray-200 text-gray-300"
                                                    }`}
                                            >
                                                {getIcon()}
                                            </div>

                                            {/* Text */}
                                            <div className="mt-2 sm:mt-3 text-center px-1">
                                                <p className={`text-[10px] sm:text-xs font-bold leading-tight ${isActive ? textColor : "text-gray-400"}`}>
                                                    {step.title}
                                                </p>
                                                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1">
                                                    {step.date ? formatStepDate(step.date) : ""}
                                                    {!isCancelled && !isActive && index === 3 ? `After ${deliveryText}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Product List */}
                        <div className="space-y-4 sm:space-y-6">
                            {order.items?.map((item) => (
                                <LocalizedClientLink 
                                    key={item.id} 
                                    href={`/products/${item.variant?.product?.handle}`}
                                    className="flex flex-row gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-50 bg-ivory-bg group transition-all hover:shadow-sm"
                                >
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-ivory-bg rounded-lg overflow-hidden flex items-center justify-center border border-gray-100 group-hover:opacity-80 transition-opacity">
                                        <Thumbnail
                                            thumbnail={item.thumbnail}
                                            variantImages={item.variant?.images}
                                            images={item.variant?.product?.images}
                                            size="square"
                                            className="object-contain w-full h-full"
                                        />
                                    </div>
                                    <div className="flex-grow flex flex-col justify-between min-w-0">
                                        <div>
                                            <h3 className="text-[#0D1B3E] font-bold text-sm sm:text-lg leading-tight line-clamp-2 group-hover:text-gold-accent transition-colors">
                                                {item.title}
                                            </h3>
                                            <div className="mt-0.5 sm:mt-1 text-gray-500 text-xs sm:text-sm">
                                                <LineItemOptions variant={item.variant} metadata={item.metadata} />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end mt-1 sm:mt-0">
                                            <div className="text-[#0D1B3E] font-bold text-base sm:text-xl">
                                                {convertToLocale({
                                                    amount: (item.unit_price ?? 0) * item.quantity,
                                                    currency_code: order.currency_code,
                                                })}
                                            </div>
                                            <div className="text-gray-500 text-xs sm:text-sm">
                                                Qty: {item.quantity}
                                            </div>
                                        </div>
                                    </div>
                                </LocalizedClientLink>
                            ))}
                        </div>
                    </div>

                    {/* Returns & Exchanges Details */}
                    {(fetchedReturns.length > 0 || fetchedSwaps.length > 0) && (
                        <div className="bg-ivory-bg rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6 mt-4">
                            <h3 className="text-base sm:text-lg font-bold text-[#0D1B3E] mb-4">Return & Exchange Details</h3>
                            <div className="space-y-4">
                                {fetchedReturns.map((r: any, idx: number) => (
                                    <div key={r.id || idx} className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-orange-800">Return Request</h4>
                                            <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded uppercase tracking-wider">{r.status}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {r.items?.map((item: any, i: number) => {
                                                const itemName = order.items?.find((oItem: any) => oItem.id === item.item_id)?.title || 'Returned Item'
                                                return (
                                                    <div key={i} className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                                                        <h5 className="font-bold text-sm text-gray-900 mb-2 pb-2 border-b border-gray-50 flex items-center gap-2">
                                                            📦 <span className="truncate" title={itemName}>{itemName}</span>
                                                        </h5>
                                                        <div className="mb-2">
                                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Reason</span>
                                                            <p className="text-sm font-semibold text-gray-900 capitalize">{item.return_reason?.value || item.reason?.value || 'N/A'}</p>
                                                        </div>
                                                        {item.note && (
                                                            <div className="mt-2 pt-2 border-t border-gray-50">
                                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Additional Note</span>
                                                                <p className="text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg mt-1 font-medium border border-gray-100 italic">"{item.note}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {r.note && (
                                            <div className="mt-3 bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Request Note</span>
                                                <p className="text-sm text-gray-700 mt-1 font-medium italic mb-0">"{r.note}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {fetchedSwaps.map((s: any, idx: number) => (
                                    <div key={s.id || idx} className="bg-gold-accent/10 rounded-xl p-4 border border-gold-accent/10">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-royal-blue">Exchange Request</h4>
                                            <span className="text-[10px] font-bold bg-gold-accent/20 text-royal-blue px-2 py-0.5 rounded uppercase tracking-wider">{s.status}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {s.return_order?.items?.map((item: any, i: number) => {
                                                const itemName = order.items?.find((oItem: any) => oItem.id === item.item_id)?.title || 'Exchanged Item'
                                                return (
                                                    <div key={i} className="bg-white p-3 rounded-lg border border-gold-accent/10 shadow-sm">
                                                        <h5 className="font-bold text-sm text-gray-900 mb-2 pb-2 border-b border-gray-50 flex items-center gap-2">
                                                            🔄 <span className="truncate" title={itemName}>{itemName}</span>
                                                        </h5>
                                                        <div className="mb-2">
                                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Reason</span>
                                                            <p className="text-sm font-semibold text-gray-900 capitalize">{item.return_reason?.value || item.reason?.value || 'N/A'}</p>
                                                        </div>
                                                        {item.note && (
                                                            <div className="mt-2 pt-2 border-t border-gray-50">
                                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Additional Note</span>
                                                                <p className="text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg mt-1 font-medium border border-gray-100 italic">"{item.note}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {s.return_order?.note && (
                                            <div className="mt-3 bg-white p-3 rounded-lg border border-gold-accent/10 shadow-sm">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Exchange Note</span>
                                                <p className="text-sm text-gray-700 mt-1 font-medium italic mb-0">"{s.return_order.note}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment & Delivery Bottom Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Payment Card */}
                        <div className="bg-ivory-bg rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-bold text-[#0D1B3E] mb-3 sm:mb-4">Payment</h3>
                            {(() => {
                                const payment = (order as any).payments?.[0] || order.payment_collections?.[0]?.payments?.[0]
                                const providerId = payment?.provider_id || ""
                                const isManual = providerId.includes("manual") || providerId.includes("system_default") || providerId === "cod"

                                if (isManual) {
                                    return (
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center gap-2 text-gray-900 font-medium text-sm">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>
                                                Cash on Delivery (Cash/UPI)
                                            </span>
                                        </div>
                                    )
                                }

                                const brand = (payment?.data?.card_brand as string)?.toUpperCase()
                                const last4 = payment?.data?.card_last4 as string

                                if (brand || last4) {
                                    return (
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-600 text-sm font-medium">
                                                **{last4 || "0000"}
                                            </span>
                                            {brand && (
                                                <div className="px-2 py-0.5 border border-blue-100 rounded text-[10px] font-bold text-blue-600 bg-blue-50">
                                                    {brand}
                                                </div>
                                            )}
                                        </div>
                                    )
                                }

                                return (
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-600 text-sm capitalize">
                                            {providerId ? providerId.replace(/_/g, " ") : "Payment details not available"}
                                        </span>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Delivery Card */}
                        <div className="bg-ivory-bg rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-bold text-[#0D1B3E] mb-2 sm:mb-3">Delivery</h3>
                            <div className="space-y-1">
                                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Address</p>
                                <div className="text-gray-600 text-sm leading-relaxed">
                                    <p className="font-semibold text-gray-900 mb-1">
                                        {order.shipping_address?.first_name} {order.shipping_address?.last_name}
                                    </p>
                                    <p>{order.shipping_address?.address_1}</p>
                                    {order.shipping_address?.address_2 && <p>{order.shipping_address.address_2}</p>}
                                    <p>
                                        {order.shipping_address?.city}
                                        {order.shipping_address?.province && `, ${order.shipping_address.province}`}
                                        {order.shipping_address?.postal_code && ` - ${order.shipping_address.postal_code}`}
                                    </p>
                                    <p className="text-gray-400 text-[10px] uppercase mt-0.5">{order.shipping_address?.country_code}</p>
                                    <p className="mt-2 text-gray-900 font-medium">
                                        Phone: {order.shipping_address?.phone ? (order.shipping_address.phone.startsWith("+") ? order.shipping_address.phone : `+${order.shipping_address.phone}`) : "N/A"}
                                    </p>
                                    {order.email && (
                                        <p className="mt-1 text-gray-900 font-medium" data-testid="order-detail-email">
                                            Email: {order.email}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Help / Issues Section */}
                    <div className="bg-ivory-bg rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                            <div>
                                <h3 className="text-lg font-bold text-[#0D1B3E]">Having an issue with this order?</h3>
                                <p className="text-gray-500 text-sm mt-1">Check our frequently asked questions or contact our support team for help.</p>
                            </div>
                            <LocalizedClientLink
                                href="/help"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ivory-bg border-2 border-gold-accent text-gold-accent rounded-xl hover:bg-royal-blue hover:text-white transition-all text-sm font-bold shadow-sm whitespace-nowrap min-w-[140px]"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                Help & FAQ
                            </LocalizedClientLink>
                        </div>
                    </div>
                </div>

                {/* Right Column - Price Summary */}
                <div className="lg:col-span-1">
                    <div className="bg-ivory-bg rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 sticky top-4 sm:top-8">
                        <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 sm:mb-6">
                            PRICE SUMMARY ({order.items?.length} {order.items?.length === 1 ? "ITEM" : "ITEMS"})
                        </h3>

                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex justify-between items-center text-gray-600 text-sm sm:text-base">
                                <span>Total MRP</span>
                                <span className="font-medium">
                                    {getAmount(order.items?.reduce((acc, item) => {
                                        return acc + ((item as any).original_total ?? (item.unit_price * item.quantity))
                                    }, 0))}
                                </span>
                            </div>

                            {order.discount_total > 0 && (
                                <div className="flex justify-between items-center text-[#008A5D] text-sm sm:text-base">
                                    <span>Discount</span>
                                    <span className="font-medium">-{getAmount(order.discount_total)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center text-gray-600 text-sm sm:text-base">
                                <span>GST</span>
                                <span className="font-medium">{getAmount(order.tax_total)}</span>
                            </div>

                            <div className="flex justify-between items-center text-gray-600 text-sm sm:text-base">
                                <span>Shipping</span>
                                <span className="font-medium">{getAmount(order.shipping_total)}</span>
                            </div>

                            <hr className="border-gray-100 my-3 sm:my-4" />

                            <div className="flex justify-between items-center text-[#0D1B3E] text-lg sm:text-xl font-bold">
                                <span>Subtotal</span>
                                <span>{getAmount(order.subtotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
                    {inventoryIssues && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setInventoryIssues(null)}>
                    <div 
                        className="w-full max-w-[480px] bg-white rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.1)] overflow-hidden relative animate-in zoom-in-95 duration-200" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 sm:p-6 relative">
                            {/* Close Icon */}
                            <button 
                                onClick={() => setInventoryIssues(null)}
                                className="absolute top-5 right-5 p-1 text-gray-300 hover:text-gray-900 transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>

                            {/* Centered Icon */}
                            <div className="flex justify-center mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                </div>
                            </div>

                            <div className="text-center mb-5 px-2">
                                <h2 className="text-[17px] font-bold text-gray-900 leading-snug px-2 whitespace-nowrap">
                                    {inventoryIssues.every(i => (i.available_quantity ?? 0) === 0) && inventoryIssues.length === (order.items?.length ?? 0) ? (
                                        <>Sorry! This product is currently out of stock 😔</>
                                    ) : (
                                        "Inventory Update"
                                    )}
                                </h2>
                                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                                    {inventoryIssues.every(i => (i.available_quantity ?? 0) === 0) && inventoryIssues.length === (order.items?.length ?? 0)
                                        ? "You can explore and purchase similar products instead 🛍️✨"
                                        : "Some items in your order are currently unavailable or have limited stock. Would you like to proceed with the remaining items?"}
                                </p>
                            </div>

                            {/* Comprehensive Item List */}
                            <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar mb-8">
                                {order.items?.map((item, idx) => {
                                    const issue = inventoryIssues.find(i => i.variant_id === item.variant_id)
                                    const isOutOfStock = issue?.available_quantity === 0
                                    const isLimited = issue && (issue.available_quantity ?? 0) > 0
                                    const isFullyAvailable = !issue

                                    return (
                                        <div key={idx} className={`p-3 rounded-2xl flex items-center gap-4 border transition-all ${
                                            isOutOfStock ? "bg-red-50/50 border-red-100" : 
                                            isLimited ? "bg-orange-50/50 border-orange-100" : 
                                            "bg-green-50/50 border-green-100"
                                        }`}>
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0 shadow-sm">
                                                {item.thumbnail ? (
                                                    <Image 
                                                        src={item.thumbnail} 
                                                        alt={item.title || "Product"} 
                                                        width={48} 
                                                        height={48} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-300 font-bold">N/A</div>
                                                )}
                                            </div>
                                            
                                            <div className="flex-grow min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h4 className="font-bold text-xs text-gray-900 truncate">
                                                        {item.title}
                                                    </h4>
                                                    <span className="text-[8px] font-black uppercase tracking-tighter text-gray-400 whitespace-nowrap">
                                                        Qty: {item.quantity}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                    {isOutOfStock ? (
                                                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-red-500" />
                                                            Out of Stock
                                                        </span>
                                                    ) : isLimited ? (
                                                        <span className="text-[9px] font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-orange-500" />
                                                            Only {issue.available_quantity} available
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-green-500" />
                                                            Fully Available
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="flex gap-3 mt-2">
                                {(inventoryIssues.length < (order.items?.length ?? 0) || inventoryIssues.some(i => (i.available_quantity ?? 0) > 0)) ? (
                                    <>
                                        <button 
                                            onClick={() => setInventoryIssues(null)}
                                            className="flex-1 h-11 rounded-xl font-bold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setInventoryIssues(null)
                                                handleReorder([], true)
                                            }}
                                            disabled={isReordering}
                                            className="flex-1 h-11 rounded-xl font-bold text-sm bg-royal-blue text-white hover:bg-[#764a97] transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                                        >
                                            {isReordering ? <Spinner className="animate-spin" /> : "Reorder"}
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex gap-3 w-full">
                                        <button 
                                            onClick={() => setInventoryIssues(null)}
                                            className="flex-1 h-11 rounded-xl font-bold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all active:scale-95"
                                        >
                                            Got It
                                        </button>
                                        <LocalizedClientLink 
                                            href="/store"
                                            className="flex-1 h-11 rounded-xl font-bold text-sm bg-royal-blue text-white hover:bg-[#764a97] transition-all active:scale-95 shadow-sm flex items-center justify-center"
                                            onClick={() => setInventoryIssues(null)}
                                        >
                                            SHOP NOW
                                        </LocalizedClientLink>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default OrderRedesign
