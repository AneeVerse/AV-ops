"use client"

import { HttpTypes } from "@medusajs/types"
import { useMemo, useEffect, useState, useRef } from "react"
import ProductRating from "../product-rating"
import { fetchReviewsForProduct } from "@lib/data/reviews"
import { retrieveCustomer } from "@lib/data/customer"
import ReviewModal from "../review-modal"

type Review = {
    id: string
    product_id: string
    customer_id: string
    rating: number
    title: string
    description: string
    images: string[]
    verified_purchase: boolean
    status: string
    created_at: string
    updated_at: string
}

type RatingsTabProps = {
    product: HttpTypes.StoreProduct & {
        average_rating?: number | null
        total_rating_count?: number | null
    }
}

const RatingsTab = ({ product }: RatingsTabProps) => {
    const [reviews, setReviews] = useState<Review[]>([])

    // Collect all images from all reviews for Moments of Love section
    const allReviewImages = useMemo(() => {
        const images: string[] = []
        reviews.forEach((review) => {
            if (review.images && review.images.length > 0) {
                images.push(...review.images)
            }
        })
        return images
    }, [reviews])
    const [isLoading, setIsLoading] = useState(false)
    const [isViewAllOpen, setIsViewAllOpen] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(true)
    const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null)
    const [expandedReviews, setExpandedReviews] = useState<string[]>([])
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [editingReview, setEditingReview] = useState<Review | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    useEffect(() => {
        retrieveCustomer().then((customer) => {
            if (customer) setCurrentUser(customer)
        })
    }, [])

    // Lock body scroll when any modal is open
    useEffect(() => {
        const isAnyModalOpen = isViewAllOpen || isEditModalOpen || activeImageIndex !== null
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isViewAllOpen, isEditModalOpen, activeImageIndex])

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
            setCanScrollLeft(scrollLeft > 0)
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
        }
    }

    useEffect(() => {
        const container = scrollContainerRef.current
        if (container) {
            container.addEventListener("scroll", checkScroll)
            // Initial check
            checkScroll()
        }
        return () => container?.removeEventListener("scroll", checkScroll)
    }, [reviews])

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300
            scrollContainerRef.current.scrollBy({
                left: direction === "right" ? scrollAmount : -scrollAmount,
                behavior: "smooth",
            })
        }
    }

    const nextImage = () => {
        if (activeImageIndex !== null) {
            setActiveImageIndex((prev) => (prev! + 1) % allReviewImages.length)
        }
    }

    const prevImage = () => {
        if (activeImageIndex !== null) {
            setActiveImageIndex((prev) => (prev! - 1 + allReviewImages.length) % allReviewImages.length)
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (activeImageIndex === null) return
            if (e.key === "ArrowRight") nextImage()
            if (e.key === "ArrowLeft") prevImage()
            if (e.key === "Escape") setActiveImageIndex(null)
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [activeImageIndex, allReviewImages.length])

    // Calculate average rating from reviews
    const calculatedRating = useMemo(() => {
        if (reviews.length === 0) return product.average_rating || 0
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
        return sum / reviews.length
    }, [reviews, product.average_rating])

    const rating = calculatedRating
    const total = reviews.length > 0 ? reviews.length : (product.total_rating_count || 0)



    const fetchReviews = async () => {
        setIsLoading(true)
        try {
            // Call Server Action to get logs in Terminal
            const fetchedReviews = await fetchReviewsForProduct(product.id)
            setReviews(fetchedReviews)
        } catch (error) {
            setReviews([])
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchReviews()
    }, [product.id])

    // Calculate real distribution from actual reviews
    const distribution = useMemo(() => {
        if (reviews.length === 0) return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        reviews.forEach((review) => {
            const star = review.rating as 1 | 2 | 3 | 4 | 5
            if (star >= 1 && star <= 5) {
                dist[star] = (dist[star] || 0) + 1
            }
        })
        return dist
    }, [reviews])

    const getRatingColor = (rating: number) => {
        if (rating >= 4) return "bg-green-500"
        if (rating >= 3) return "bg-yellow-400"
        return "bg-red-500"
    }

    const getProgressBarColor = (star: number) => {
        if (star >= 4) return "from-green-400 to-green-600 shadow-[0_0_10px_rgba(34,197,94,0.3)] text-green-500"
        if (star >= 3) return "from-yellow-300 to-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.3)] text-yellow-500"
        return "from-red-400 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.3)] text-red-500"
    }

    return (
        <div className="py-2 sm:py-4 overflow-x-hidden">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8 sm:mb-10">
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-[0.2em]">Product Ratings</h3>
                    <div className="h-1 w-12 bg-royal-blue rounded-full"></div>
                </div>
                <ProductRating product={product} buttonText="Submit Review" showStars={false} />
            </div>

            {/* Content Section: Score & Bars */}
            {total > 0 && (
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start py-6 sm:py-8">

                    {/* Left: Big Score Card */}
                    <div className="flex flex-col items-center gap-2 min-w-[150px]">
                        <div className="flex items-center gap-2">
                            <span className="text-5xl sm:text-6xl font-bold text-gray-900 tracking-tight">
                                {rating.toFixed(1)}
                            </span>
                            <svg
                                width="36"
                                height="36"
                                viewBox="0 0 24 24"
                                fill={rating >= 4 ? "#22c55e" : rating >= 3 ? "#FFD700" : "#ef4444"}
                            >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        </div>

                        <div className="flex flex-col items-center gap-1.5 mt-2">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <svg
                                        key={s}
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill={s <= Math.round(rating) ? (rating >= 4 ? "#22c55e" : rating >= 3 ? "#FFD700" : "#ef4444") : "#E5E7EB"}
                                    >
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                ))}
                            </div>
                            <p className="text-gray-800 text-sm font-bold mt-2">
                                {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total} Verified Buyers
                            </p>
                        </div>
                    </div>

                    {/* Vertical Separator (Desktop) */}
                    <div className="hidden lg:block w-px self-stretch bg-gradient-to-b from-transparent via-gray-200 to-transparent"></div>

                    {/* Right: Progress Bars Table */}
                    <div className="flex-1 w-full max-w-lg flex flex-col gap-4">
                        {[5, 4, 3, 2, 1].map((star) => {
                            const count = distribution[star as keyof typeof distribution]
                            const percentage = total > 0 ? (count / total) * 100 : 0

                            return (
                                <div key={star} className="grid grid-cols-[40px_1fr_45px] items-center gap-4 group">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-bold transition-colors ${star >= 4 ? "group-hover:text-green-700 text-gray-800" : star === 3 ? "group-hover:text-yellow-700 text-gray-800" : "group-hover:text-red-700 text-gray-800"}`}>{star}</span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#9CA3AF" className={`transition-colors ${star >= 4 ? "group-hover:fill-green-500" : star === 3 ? "group-hover:fill-yellow-400" : "group-hover:fill-red-500"}`}>
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                    </div>

                                    <div className="h-2.5 bg-white rounded-full overflow-hidden border border-gray-100 shadow-inner">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(star).split(' text-')[0]} transition-all duration-1000 ease-out flex justify-end`}
                                            style={{ width: `${percentage}%` }}
                                        >
                                            <div className="w-1.5 h-full bg-white/30 animate-pulse"></div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-black transition-colors">
                                            {count}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}


            {/* Moments of Love Section */}
            {allReviewImages.length > 0 && (
                <div className="mt-8 border-t pt-6">
                    <h4 className="font-semibold text-lg mb-4 text-gray-900">
                        Moments Of Love ({allReviewImages.length})
                    </h4>
                    <div className="relative group/scroll">
                        <div
                            ref={scrollContainerRef}
                            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
                        >
                            {allReviewImages.map((imageUrl, idx) => (
                                <img
                                    key={idx}
                                    src={imageUrl}
                                    alt={`Moment ${idx + 1}`}
                                    className="w-32 h-32 object-cover rounded-lg border border-gray-200 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setActiveImageIndex(idx)}
                                />
                            ))}
                        </div>

                        {/* Left Scroll Arrow */}
                        <button
                            onClick={() => scroll("left")}
                            className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm border border-gray-200 p-2 rounded-full shadow-lg text-gold-accent hover:bg-white transition-all z-10 hidden sm:flex ${canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            aria-label="Scroll left"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>

                        {/* Right Scroll Arrow */}
                        <button
                            onClick={() => scroll("right")}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm border border-gray-200 p-2 rounded-full shadow-lg text-gold-accent hover:bg-white transition-all z-10 hidden sm:flex ${canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            aria-label="Scroll right"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    <style jsx>{`
                        .scrollbar-hide {
                            -ms-overflow-style: none;  /* IE and Edge */
                            scrollbar-width: none;  /* Firefox */
                        }
                        .scrollbar-hide::-webkit-scrollbar {
                            display: none;  /* Chrome, Safari and Opera */
                        }
                    `}</style>
                </div>
            )}

            {/* Reviews List - Show only 2 latest */}
            <div className="mt-8 border-t pt-6">
                <h4 className="font-semibold text-lg mb-6 text-gray-900">Customer Reviews</h4>
                {isLoading ? (
                    <p className="text-gray-500 text-sm">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                    <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this product!</p>
                ) : (
                    <>
                        <div className="space-y-6">
                            {reviews.slice(0, 2).map((review) => (
                                <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative group">
                                    {/* Edit Button */}
                                    {currentUser && currentUser.id === review.customer_id && (
                                        <button
                                            onClick={() => {
                                                setEditingReview(review)
                                                setIsEditModalOpen(true)
                                            }}
                                            className="absolute top-4 right-4 text-gold-accent hover:bg-royal-blue hover:text-white transition-colors flex items-center gap-1.5 bg-royal-blue/10 px-3 py-1.5 rounded-full border border-gold-accent/20 text-xs sm:text-sm font-semibold shadow-sm"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                            <span className="inline">Edit</span>
                                        </button>
                                    )}

                                    {/* Review Title */}
                                    <h5 className="font-bold text-base text-gray-900 mb-3 pr-16">{review.title}</h5>

                                    {/* Rating Badge and Review Text */}
                                    <div className="flex items-start gap-4 mb-4">
                                        {/* Styled Star Rating Badge */}
                                        <div className={`${getRatingColor(review.rating)} rounded-md px-3 py-1.5 flex items-center justify-center min-w-[50px] shadow-sm`}>
                                            <span className="text-white font-semibold text-sm">{review.rating}★</span>
                                        </div>

                                        {/* Review Description */}
                                        <p className="text-gray-900 text-sm leading-relaxed flex-1 font-medium">{review.description}</p>
                                    </div>

                                    {/* Review Images - Side by Side */}
                                    {review.images && review.images.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4 w-full items-center">
                                            {(expandedReviews.includes(review.id) ? review.images : review.images.slice(0, 2)).map((imageUrl, idx) => (
                                                <div key={idx} className="relative w-24 h-24">
                                                    <img
                                                        src={imageUrl}
                                                        alt={`Review image ${idx + 1}`}
                                                        className="w-full h-full object-cover rounded border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => {
                                                            const globalIdx = allReviewImages.indexOf(imageUrl);
                                                            if (globalIdx !== -1) setActiveImageIndex(globalIdx);
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            {!expandedReviews.includes(review.id) && review.images.length > 2 && (
                                                <button
                                                    className="w-24 h-24 flex flex-col items-center justify-center rounded border border-dashed border-gold-accent/30 bg-royal-blue/5 hover:bg-royal-blue/10 transition-colors text-gold-accent"
                                                    onClick={() => setExpandedReviews(prev => [...prev, review.id])}
                                                >
                                                    <span className="font-bold text-sm">+{review.images.length - 2} more</span>
                                                    <span className="text-[10px] font-medium uppercase tracking-tighter">Images</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Customer Info and Date */}
                                    <div className="flex items-center gap-2 text-sm text-gray-700 font-medium border-t border-gray-100 pt-3">
                                        <span className="font-bold">Cultura Jewels Customer</span>
                                        <span className="text-gray-400">|</span>
                                        <span>{new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* View All Button */}
                        {reviews.length > 2 && (
                            <div className="mt-6 text-left">
                                <button
                                    onClick={() => setIsViewAllOpen(true)}
                                    className="text-gold-accent font-semibold text-sm hover:underline"
                                >
                                    View all {reviews.length} reviews
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* View All Reviews Modal */}
            {isViewAllOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsViewAllOpen(false)
                    }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-royal-blue p-4 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">All Reviews ({reviews.length})</h2>
                            <button
                                onClick={() => setIsViewAllOpen(false)}
                                className="text-white hover:text-gray-200"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="overflow-y-auto flex-1 p-6">
                            <div className="space-y-6">
                                {reviews.map((review) => (
                                    <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative group">
                                        {/* Edit Button */}
                                        {currentUser && currentUser.id === review.customer_id && (
                                            <button
                                                onClick={() => {
                                                    setEditingReview(review)
                                                    setIsEditModalOpen(true)
                                                }}
                                                className="absolute top-4 right-4 text-gold-accent hover:bg-royal-blue hover:text-white transition-colors flex items-center gap-1.5 bg-royal-blue/10 px-3 py-1.5 rounded-full border border-gold-accent/20 text-xs sm:text-sm font-semibold shadow-sm"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                                <span className="inline">Edit</span>
                                            </button>
                                        )}

                                        {/* Review Title */}
                                        <h5 className="font-bold text-base text-gray-900 mb-3 pr-16">{review.title}</h5>

                                        {/* Rating Badge and Review Text */}
                                        <div className="flex items-start gap-4 mb-4">
                                            {/* Styled Star Rating Badge */}
                                            <div className={`${getRatingColor(review.rating)} rounded-md px-3 py-1.5 flex items-center justify-center min-w-[50px] shadow-sm`}>
                                                <span className="text-white font-semibold text-sm">{review.rating}★</span>
                                            </div>

                                            {/* Review Description */}
                                            <p className="text-gray-900 text-sm leading-relaxed flex-1 font-medium">{review.description}</p>
                                        </div>

                                        {/* Review Images - Mobile Grid (Small) / Desktop Side by Side */}
                                        {review.images && review.images.length > 0 && (
                                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 mb-4 w-fit">
                                                {review.images.map((imageUrl, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={imageUrl}
                                                        alt={`Review image ${idx + 1}`}
                                                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                                                        onClick={() => {
                                                            const globalIdx = allReviewImages.indexOf(imageUrl);
                                                            if (globalIdx !== -1) setActiveImageIndex(globalIdx);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Customer Info and Date */}
                                        <div className="flex items-center gap-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                                            <span className="font-medium">Cultura Jewels Customer</span>
                                            <span className="text-gray-300">|</span>
                                            <span>{new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Lightbox / Popup */}
            {activeImageIndex !== null && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xl p-4 sm:p-8"
                    onClick={() => setActiveImageIndex(null)}
                >
                    {/* Close Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex(null);
                        }}
                        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors z-20"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    {/* Navigation Buttons */}
                    {allReviewImages.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    prevImage();
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all z-20"
                            >
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    nextImage();
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all z-20"
                            >
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </>
                    )}

                    {/* Image Display */}
                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center">
                        <img
                            src={allReviewImages[activeImageIndex]}
                            alt={`Moment ${activeImageIndex + 1}`}
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Image Counter */}
                        <div className="mt-6 px-4 py-1.5 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm text-white/90 text-sm font-bold tracking-widest uppercase">
                            {activeImageIndex + 1} / {allReviewImages.length}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Review Modal */}
            {isEditModalOpen && (
                <ReviewModal
                    productId={product.id}
                    productTitle={product.title || "Product"}
                    isOpen={isEditModalOpen}
                    close={() => {
                        setIsEditModalOpen(false)
                        setEditingReview(null)
                    }}
                    existingReview={editingReview}
                    onSuccess={fetchReviews}
                />
            )}

        </div>
    )
}

export default RatingsTab
