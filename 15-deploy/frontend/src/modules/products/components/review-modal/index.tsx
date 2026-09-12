"use client"

import { useState, useRef } from "react"
import { retrieveCustomer, uploadFiles } from "@lib/data/customer"
import { submitReview, updateReview } from "@lib/data/reviews"

type ReviewModalProps = {
    productId: string
    productTitle: string
    isOpen: boolean
    close: () => void
    existingReview?: any // Optional
    onSuccess?: () => void // Optional callback for refetching
}

export default function ReviewModal({
    productId,
    productTitle,
    isOpen,
    close,
    existingReview,
    onSuccess,
}: ReviewModalProps) {
    const [rating, setRating] = useState(existingReview?.rating || 0)
    const [title, setTitle] = useState(existingReview?.title || "")
    const [description, setDescription] = useState(existingReview?.description || "")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [images, setImages] = useState<string[]>(existingReview?.images || [])
    const [isUploading, setIsUploading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const modalRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Close on outside click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            handleClose()
        }
    }

    const handleClose = () => {
        close()
        // Reset state after a tiny delay to allow exit animation if needed
        setTimeout(() => {
            setIsSubmitted(false)
            setError(null)
        }, 300)
    }

    if (!isOpen) return null

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        setError(null)
        try {
            const formData = new FormData()
            for (let i = 0; i < files.length; i++) {
                if (files[i].size > 5 * 1024 * 1024) {
                    setError("Please upload images smaller than 5MB.")
                    setIsUploading(false)
                    return
                }
                formData.append("files", files[i])
            }

            const result = await uploadFiles(formData)
            if (result.success && result.files) {
                const newImageUrls = result.files.map((f: any) => f.url)
                setImages((prev) => [...prev, ...newImageUrls].slice(0, 4)) // Limit to 4 images
            } else {
                setError(result.error || "Failed to upload images")
            }
        } catch (error) {
            setError("An error occurred during upload")
        } finally {
            setIsUploading(false)
        }
    }

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)
        
        if (rating === 0) {
            setError("Please select a rating before submitting.")
            setIsSubmitting(false)
            return
        }

        try {
            const customer = await retrieveCustomer()

            if (!customer) {
                setError("Please login to submit a review.")
                setIsSubmitting(false)
                return
            }

            let result;

            if (existingReview?.id) {
                // Update existing review
                result = await updateReview({
                    id: existingReview.id,
                    rating,
                    title,
                    description,
                    images: images,
                })
            } else {
                // Submit new review
                result = await submitReview({
                    product_id: productId,
                    rating,
                    title,
                    description,
                    images: images,
                })
            }

            if (result.success) {
                // Track form submission in Google Analytics
                if (typeof window !== 'undefined') {
                    (window as any).dataLayer = (window as any).dataLayer || [];
                    (window as any).dataLayer.push({
                        event: 'form_submit',
                        form_type: existingReview ? 'product_review_update' : 'product_review_submit'
                    });
                }

                setIsSubmitted(true)
                setTitle("")
                setDescription("")
                setRating(0)
                setImages([])

                // Auto close modal after 1.5 seconds
                setTimeout(() => {
                    handleClose()
                    if (onSuccess) onSuccess()
                }, 1500)
            } else {
                setError(result.error || "Failed to submit review")
            }
        } catch (error) {
            setError("An error occurred. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
            >
                <div className="bg-royal-blue p-4 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold">
                        {isSubmitted ? (existingReview ? "Update Successful" : "Review Submitted") : existingReview ? "Edit Review" : "Write a Review"}
                    </h2>
                    <button onClick={handleClose} className="text-white hover:text-gray-200">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {isSubmitted ? (
                    <div className="p-8 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-center">
                            <div className="bg-green-100 rounded-full p-4 text-green-600">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
                            <p className="text-gray-600">
                                Your review for <span className="font-semibold">{productTitle}</span> has been {existingReview ? "updated" : "submitted"} successfully.
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-full bg-royal-blue text-white font-bold py-3 px-4 rounded-lg hover:bg-gold-accent active:bg-[#693e84] transition-colors shadow-md hover:shadow-lg transform active:scale-[0.98]"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                            <p className="text-gray-900 font-medium">{productTitle}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className="focus:outline-none transition-transform hover:scale-110"
                                    >
                                        <svg
                                            width="32"
                                            height="32"
                                            viewBox="0 0 24 24"
                                            fill={star <= rating ? "#FFD700" : "none"}
                                            stroke={star <= rating ? "#FFD700" : "#D1D5DB"}
                                            strokeWidth="2"
                                        >
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-accent focus:border-transparent outline-none transition-all"
                                placeholder="Great product!"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Review</label>
                            <textarea
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-accent focus:border-transparent outline-none transition-all resize-none"
                                placeholder="Share your experience..."
                            />
                        </div>

                        {/* Image Upload Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Images (Max 4)</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {images.map((url, index) => (
                                    <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                                        <img src={url} alt="Review" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {images.length < 4 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gold-accent hover:text-gold-accent transition-all"
                                    >
                                        {isUploading ? (
                                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                </svg>
                                                <span className="text-[10px] mt-1 font-medium">Add Photo</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">Please upload images smaller than 5MB.</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || isUploading}
                            data-ga-event={existingReview ? "review_update" : "review_submit"}
                            data-ga-label={existingReview ? "Update Review" : "Submit Review"}
                            className="w-full bg-royal-blue text-white font-bold py-3 px-4 rounded-lg hover:bg-gold-accent active:bg-[#693e84] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform active:scale-[0.98]"
                        >
                            <span className="pointer-events-none block">
                                {isSubmitting ? "Submitting..." : existingReview ? "Update Review" : "Submit Review"}
                            </span>
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
