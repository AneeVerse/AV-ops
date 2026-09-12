"use client"

import { useState, useEffect, useMemo } from "react"
import { HttpTypes } from "@medusajs/types"
import ReviewModal from "../review-modal"
import { fetchReviewsForProduct, fetchRatingForProduct } from "@lib/data/reviews"

import { retrieveCustomer } from "@lib/data/customer"
import LoginPopup from "@modules/common/components/login-popup"
import { useParams } from "next/navigation"

type ProductRatingProps = {
    product: HttpTypes.StoreProduct & {
        average_rating?: number | null
        total_rating_count?: number | null
    }
    showButton?: boolean
    buttonText?: string
    showStars?: boolean
}

export default function ProductRating({
    product,
    showButton = true,
    buttonText = "Rate this",
    showStars = true
}: ProductRatingProps) {
    const [isReviewOpen, setIsReviewOpen] = useState(false)
    const [reviews, setReviews] = useState<any[]>([])
    const [ratingSummary, setRatingSummary] = useState<{ average_rating: number, total_reviews: number } | null>(null)
    const [showLoginPopup, setShowLoginPopup] = useState(false)
    const [isCheckingAuth, setIsCheckingAuth] = useState(false)
    const { countryCode } = useParams() as { countryCode: string }

    const fetchReviewsAndStatus = async () => {
        try {
            const [fetchedReviews, fetchedSummary] = await Promise.all([
                fetchReviewsForProduct(product.id),
                fetchRatingForProduct(product.id)
            ])
            setReviews(fetchedReviews)
            setRatingSummary(fetchedSummary)
        } catch (error) {
            // Silence error
        }
    }

    useEffect(() => {
        fetchReviewsAndStatus()
    }, [product.id])

    // Use pre-calculated summary from backend
    const averageRating = useMemo(() => {
        return ratingSummary?.average_rating ?? product.average_rating ?? 0
    }, [ratingSummary, product.average_rating])

    const totalReviews = ratingSummary?.total_reviews ?? (product.total_rating_count || 0)

    const handleRateClick = async () => {
        setIsCheckingAuth(true)
        try {
            const customer = await retrieveCustomer()
            if (customer) {
                setIsReviewOpen(true)
            } else {
                setShowLoginPopup(true)
            }
        } catch (error) {
            // Fallback to showing login popup on error
            setShowLoginPopup(true)
        } finally {
            setIsCheckingAuth(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-2">
                {showStars && totalReviews > 0 && (
                    <div className="flex items-center gap-1 cursor-pointer" onClick={handleRateClick}>
                        <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => {
                                const isFilled = star <= averageRating
                                const isHalfFilled = star > averageRating && star - 0.5 <= averageRating

                                return (
                                    <div key={star} className="relative" style={{ width: '20px', height: '20px' }}>
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke={isFilled || isHalfFilled ? (averageRating >= 4 ? "#22c55e" : averageRating >= 3 ? "#FFD700" : "#ef4444") : "#D1D5DB"}
                                            strokeWidth="2"
                                        >
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                        </svg>
                                        {isFilled && (
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill={averageRating >= 4 ? "#22c55e" : averageRating >= 3 ? "#FFD700" : "#ef4444"}
                                                stroke={averageRating >= 4 ? "#22c55e" : averageRating >= 3 ? "#FFD700" : "#ef4444"}
                                                strokeWidth="2"
                                                className="absolute top-0 left-0"
                                            >
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                            </svg>
                                        )}
                                        {isHalfFilled && (
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill={averageRating >= 4 ? "#22c55e" : averageRating >= 3 ? "#FFD700" : "#ef4444"}
                                                stroke={averageRating >= 4 ? "#22c55e" : averageRating >= 3 ? "#FFD700" : "#ef4444"}
                                                strokeWidth="2"
                                                className="absolute top-0 left-0"
                                                style={{ clipPath: 'inset(0 50% 0 0)' }}
                                            >
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                            </svg>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {averageRating > 0 && (
                            <span className="text-sm text-gray-700 font-medium">
                                ({averageRating.toFixed(1)})
                            </span>
                        )}
                    </div>
                )}
                {showButton && (
                    <div className="relative group/ratingbtn">
                        <button
                            onClick={handleRateClick}
                            disabled={isCheckingAuth}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-bold transition-all duration-200 border-gold-accent/20 bg-royal-blue/5 text-gold-accent hover:bg-royal-blue hover:text-white hover:shadow-md hover:shadow-gold-accent/10 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isCheckingAuth ? (
                                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                            )}
                            {buttonText}
                        </button>
                    </div>
                )}
            </div>

            <ReviewModal
                productId={product.id}
                productTitle={product.title || "Product"}
                isOpen={isReviewOpen}
                close={() => setIsReviewOpen(false)}
                onSuccess={fetchReviewsAndStatus}
            />

            <LoginPopup
                isOpen={showLoginPopup}
                onClose={() => setShowLoginPopup(false)}
                countryCode={countryCode}
                message="Please login to submit a review for this product."
            />
        </>
    )
}
