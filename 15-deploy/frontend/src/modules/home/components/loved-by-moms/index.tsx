"use client"

import { useState } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { addToCart } from "@lib/data/cart"
import { trackAddToCart } from "@lib/analytics/ga4-ecommerce"
import { useParams } from "next/navigation"
import PlaceholderImage from "@modules/common/icons/placeholder-image"
import { fetchReviewsForProduct } from "@lib/data/reviews"
import { useEffect, useMemo } from "react"

type LovedByMomsProps = {
  products: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
  ratings?: any[]
}

const ProductCardRating = ({ product, rating }: { product?: HttpTypes.StoreProduct; rating?: any }) => {
  const metaRating = product?.metadata?.rating ?? product?.metadata?.review_rating ?? product?.metadata?.average_rating
  const metaCount = product?.metadata?.review_count ?? product?.metadata?.reviews_count ?? product?.metadata?.total_reviews

  let averageRating = rating?.average_rating ?? 0
  let totalReviews = rating?.total_reviews ?? 0

  if (metaRating !== undefined && metaCount !== undefined && metaCount !== null) {
    const pRating = parseFloat(String(metaRating))
    const pCount = parseInt(String(metaCount), 10)
    if (!isNaN(pRating) && !isNaN(pCount)) {
      averageRating = pRating
      totalReviews = pCount
    }
  }

  if (averageRating === 0 || totalReviews === 0) {
    return (
      <div className="flex items-center gap-0.5 sm:gap-1 mb-1.5 sm:mb-2 min-h-[16px]">
        <span className="text-[10px] sm:text-xs text-gray-400 italic">No reviews yet</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mb-1.5 sm:mb-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= averageRating
          const isHalfFilled = !isFilled && star - 0.5 <= averageRating

          return (
            <div key={star} className="relative w-3 h-3 sm:w-4 sm:h-4">
              <svg
                className="w-full h-full"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isFilled || isHalfFilled ? "#FFD700" : "#D1D5DB"}
                strokeWidth="2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              {isFilled && (
                <svg
                  className="w-full h-full absolute top-0 left-0"
                  viewBox="0 0 24 24"
                  fill="#FFD700"
                  stroke="#FFD700"
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              )}
              {isHalfFilled && (
                <svg
                  className="w-full h-full absolute top-0 left-0"
                  viewBox="0 0 24 24"
                  fill="#FFD700"
                  stroke="#FFD700"
                  strokeWidth="2"
                  style={{ clipPath: 'inset(0 50% 0 0)' }}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              )}
            </div>
          )
        })}
      </div>
      <span className="text-[10px] sm:text-xs text-gray-700 font-bold ml-1">
        {averageRating.toFixed(1)}
      </span>
      {totalReviews > 0 && (
        <span className="text-[10px] sm:text-xs text-gray-500 font-medium ml-0.5">
          ({totalReviews})
        </span>
      )}
    </div>
  )
}

const LovedByMoms = ({ products, region, ratings }: LovedByMomsProps) => {
  const [isAdding, setIsAdding] = useState<string | null>(null)
  const { countryCode } = useParams() as { countryCode: string }

  const safeProducts = products || []

  if (safeProducts.length === 0) {
    return null
  }

  const handleAddToCart = async (product: HttpTypes.StoreProduct) => {
    if (!product.variants || product.variants.length === 0) return

    const firstVariant = product.variants[0]
    if (!firstVariant.id) return

    setIsAdding(product.id || null)
    try {
      await addToCart({
        variantId: firstVariant.id,
        quantity: 1,
        countryCode,
      })
      const currency = (firstVariant as any).calculated_price?.currency_code?.toUpperCase() ?? region?.currency_code ?? "USD"
      const unitPrice = (firstVariant as any).calculated_price?.calculated_amount ?? 0
      trackAddToCart({
        currency,
        value: unitPrice / 100,
        items: [
          {
            item_id: firstVariant.id,
            item_name: product.title ?? "",
            price: unitPrice / 100,
            quantity: 1,
            item_variant: firstVariant.title ?? undefined,
          },
        ],
      })
    } catch (error) {
      // Silence error
    } finally {
      setIsAdding(null)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media (min-width: 340px) and (max-width: 419px) {
            .loved-by-moms-banner {
              padding: 1rem !important;
              min-height: auto !important;
              border-radius: 1rem !important;
            }
            .loved-by-moms-left-section {
              width: 100% !important;
              margin-bottom: 1rem !important;
            }
            .loved-by-moms-title {
              font-size: 1.25rem !important;
              margin-bottom: 0.5rem !important;
            }
            .loved-by-moms-text {
              font-size: 0.75rem !important;
              margin-bottom: 0.375rem !important;
            }
            .loved-by-moms-button {
              padding: 0.5rem 1rem !important;
              font-size: 0.75rem !important;
            }
            .loved-by-moms-cards-container {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch !important;
              scrollbar-width: thin !important;
              scrollbar-color: rgba(139, 90, 177, 0.3) transparent !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar {
              height: 4px !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar-track {
              background: transparent !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar-thumb {
              background-color: rgba(139, 90, 177, 0.3) !important;
              border-radius: 2px !important;
            }
            .loved-by-moms-cards-flex {
              gap: 0.75rem !important;
              padding-left: 0.5rem !important;
              padding-right: 0.5rem !important;
            }
            .loved-by-moms-card {
              width: 140px !important;
              min-width: 140px !important;
              max-width: 140px !important;
              height: auto !important;
              min-height: 200px !important;
            }
            .loved-by-moms-image {
              width: 120px !important;
              height: 120px !important;
            }
            .loved-by-moms-star {
              width: 0.625rem !important;
              height: 0.625rem !important;
            }
            .loved-by-moms-card-title {
              font-size: 0.75rem !important;
              margin-bottom: 0.375rem !important;
            }
            .loved-by-moms-price {
              font-size: 0.8125rem !important;
            }
          }
          @media (min-width: 420px) and (max-width: 549px) {
            .loved-by-moms-banner {
              padding: 1.25rem !important;
              min-height: auto !important;
              border-radius: 1.125rem !important;
            }
            .loved-by-moms-left-section {
              width: 100% !important;
              margin-bottom: 1.25rem !important;
            }
            .loved-by-moms-title {
              font-size: 1.375rem !important;
              margin-bottom: 0.625rem !important;
            }
            .loved-by-moms-text {
              font-size: 0.8125rem !important;
              margin-bottom: 0.5rem !important;
            }
            .loved-by-moms-button {
              padding: 0.5625rem 1.125rem !important;
              font-size: 0.8125rem !important;
            }
            .loved-by-moms-cards-container {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch !important;
              scrollbar-width: thin !important;
              scrollbar-color: rgba(139, 90, 177, 0.3) transparent !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar {
              height: 4px !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar-track {
              background: transparent !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar-thumb {
              background-color: rgba(139, 90, 177, 0.3) !important;
              border-radius: 2px !important;
            }
            .loved-by-moms-cards-flex {
              gap: 0.875rem !important;
              padding-left: 0.75rem !important;
              padding-right: 0.75rem !important;
            }
            .loved-by-moms-card {
              width: 150px !important;
              min-width: 150px !important;
              max-width: 150px !important;
              height: auto !important;
              min-height: 210px !important;
            }
            .loved-by-moms-image {
              width: 130px !important;
              height: 130px !important;
            }
            .loved-by-moms-star {
              width: 0.6875rem !important;
              height: 0.6875rem !important;
            }
            .loved-by-moms-card-title {
              font-size: 0.78125rem !important;
              margin-bottom: 0.4375rem !important;
            }
            .loved-by-moms-price {
              font-size: 0.84375rem !important;
            }
          }
          @media (min-width: 550px) and (max-width: 767px) {
            .loved-by-moms-banner-inner {
              flex-direction: row !important;
              align-items: center !important;
            }
            .loved-by-moms-banner {
              padding: 1.25rem !important;
              min-height: auto !important;
              max-width: 100% !important;
            }
            .loved-by-moms-left-section {
              width: 280px !important;
              flex-shrink: 0 !important;
              text-align: left !important;
              margin-bottom: 0 !important;
            }
            .loved-by-moms-title {
              font-size: 1.375rem !important;
              text-align: left !important;
              margin-bottom: 0.625rem !important;
            }
            .loved-by-moms-text {
              font-size: 0.8125rem !important;
              text-align: left !important;
              margin-bottom: 0.375rem !important;
            }
            .loved-by-moms-button {
              padding: 0.5rem 1.25rem !important;
              font-size: 0.8125rem !important;
            }
            .loved-by-moms-cards-wrapper {
              flex: 1 !important;
              min-width: 0 !important;
            }
            .loved-by-moms-cards-container {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch !important;
            }
            .loved-by-moms-cards-flex {
              gap: 0.625rem !important;
              justify-content: flex-start !important;
            }
            .loved-by-moms-card {
              width: 165px !important;
              min-width: 165px !important;
              max-width: 165px !important;
              height: auto !important;
              min-height: 230px !important;
            }
            .loved-by-moms-image {
              width: 150px !important;
              height: 150px !important;
            }
            .loved-by-moms-star {
              width: 0.8125rem !important;
              height: 0.8125rem !important;
            }
            .loved-by-moms-card-title {
              font-size: 0.8125rem !important;
              text-align: left !important;
              margin-bottom: 0.375rem !important;
            }
            .loved-by-moms-price {
              font-size: 0.9375rem !important;
              text-align: left !important;
            }
          }
          @media (min-width: 768px) and (max-width: 1440px) {
            .loved-by-moms-banner {
              padding: 2rem !important;
              min-height: auto !important;
              max-width: 100% !important;
            }
            .loved-by-moms-left-section {
              width: 350px !important;
              flex-shrink: 0 !important;
              text-align: left !important;
            }
            .loved-by-moms-title {
              font-size: 2rem !important;
              text-align: left !important;
              margin-bottom: 1rem !important;
            }
            .loved-by-moms-text {
              font-size: 1rem !important;
              text-align: left !important;
              margin-bottom: 0.5rem !important;
            }
            .loved-by-moms-button {
              padding: 0.75rem 2rem !important;
              font-size: 1rem !important;
            }
            .loved-by-moms-cards-wrapper {
              flex: 1 !important;
              min-width: 0 !important;
            }
            .loved-by-moms-cards-container {
              width: 100% !important;
              max-width: 723px !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch !important;
              scrollbar-width: thin !important;
              scrollbar-color: rgba(139, 90, 177, 0.3) transparent !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar {
              height: 4px !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar-track {
              background: transparent !important;
            }
            .loved-by-moms-cards-container::-webkit-scrollbar-thumb {
              background-color: rgba(139, 90, 177, 0.3) !important;
              border-radius: 2px !important;
            }
            .loved-by-moms-card {
              width: 220px !important;
              min-width: 220px !important;
              height: 282px !important;
            }
            .loved-by-moms-image {
              width: 200px !important;
              height: 200px !important;
            }
            .loved-by-moms-star {
              width: 1rem !important;
              height: 1rem !important;
            }
            .loved-by-moms-card-title {
              font-size: 1rem !important;
              text-align: left !important;
              margin-bottom: 0.5rem !important;
            }
            .loved-by-moms-price {
              font-size: 1.125rem !important;
              text-align: left !important;
            }
          }
          @media (min-width: 1441px) {
            .loved-by-moms-banner {
              max-width: 1360px !important;
            }
            .loved-by-moms-left-section {
              width: 400px !important;
              flex-shrink: 0 !important;
            }
            .loved-by-moms-cards-wrapper {
              flex: 1 !important;
              min-width: 0 !important;
            }
            .loved-by-moms-cards-container {
              width: 100% !important;
              max-width: 723px !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch !important;
            }
            .loved-by-moms-card {
              width: 220px !important;
              min-width: 220px !important;
              height: 282px !important;
            }
            .loved-by-moms-image {
              width: 200px !important;
              height: 200px !important;
            }
          }
        `
      }} />
      <div className="w-full py-8 sm:py-12 md:py-14 lg:py-16 bg-ivory-bg">
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <div className="w-full flex justify-center">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#16261b] via-[#122019] to-[#0d1a11] border border-[#D4AF37]/25 rounded-[24px] shadow-[0_20px_50px_rgba(13,26,17,0.25)] p-6 sm:p-8 md:p-10 lg:p-12 w-full loved-by-moms-banner" style={{ maxWidth: '1360px' }}>
              {/* Ambient gold glow */}
              <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 bg-[#D4AF37]/[0.08] rounded-full blur-3xl" />
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 md:gap-8 lg:gap-10 h-full loved-by-moms-banner-inner relative z-10">
                {/* Left Section - Text Content */}
                <div className="w-full md:w-[400px] flex-shrink-0 loved-by-moms-left-section text-center md:text-left">
                  <span className="text-[#D4AF37] font-semibold tracking-[0.25em] text-[10px] sm:text-xs uppercase block mb-3 font-sans">
                    Bestsellers
                  </span>
                  <h2 className="h2-serif mb-3 sm:mb-4 loved-by-moms-title" style={{ color: '#F7F3EA' }}>
                    Customer Favorites
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-white/60 mb-2 loved-by-moms-text">
                    Our most-loved moissanite pieces, chosen by discerning customers.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg text-white/60 mb-4 sm:mb-6 loved-by-moms-text">
                    GRA-certified brilliance in every design.
                  </p>
                  <LocalizedClientLink
                    href="/store?sortBy=bestsellers"
                    data-ga-event="shop_bestsellers_click"
                    data-ga-label="Shop Bestsellers Banner"
                    className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] text-[#0d1a11] hover:bg-white transition-colors duration-300 font-semibold uppercase tracking-wide px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base loved-by-moms-button"
                  >
                    Shop Bestsellers
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </LocalizedClientLink>
                </div>

                {/* Right Section - Product Cards */}
                <div className="w-full md:flex-1 min-w-0 loved-by-moms-cards-wrapper">
                  <div className="loved-by-moms-cards-container overflow-x-auto no-scrollbar">
                    <div className="flex gap-4 pb-2 sm:pb-4 justify-start loved-by-moms-cards-flex">
                      {safeProducts.map((product) => {
                        const productImage = product.thumbnail || product.images?.[0]?.url

                        // Get price - try getProductPrice first, then fallback to variant
                        let displayPrice = null
                        try {
                          const { cheapestPrice } = getProductPrice({ product })
                          if (cheapestPrice && cheapestPrice.calculated_price) {
                            displayPrice = cheapestPrice.calculated_price
                          }
                        } catch (error) {
                          // If getProductPrice fails, try direct variant access
                        }

                        // Fallback: get price directly from variant
                        if (!displayPrice && product.variants && product.variants.length > 0) {
                          const firstVariant = product.variants[0] as any
                          if (firstVariant?.calculated_price?.calculated_amount) {
                            displayPrice = convertToLocale({
                              amount: firstVariant.calculated_price.calculated_amount,
                              currency_code: firstVariant.calculated_price.currency_code || 'INR',
                            })
                          }
                        }

                        return (
                          <div
                            key={product.id}
                            className="bg-white rounded-[16px] sm:rounded-[20px] border border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative group flex-shrink-0 loved-by-moms-card"
                          >
                            <LocalizedClientLink
                              href={`/products/${product.handle}`}
                              data-ga-event="bestseller_item_click"
                              data-ga-label={product.title || "Product"}
                              className="block"
                            >
                              <div className="flex items-center justify-center pt-3 sm:pt-4 px-3 sm:px-4">
                                <div
                                  className="relative loved-by-moms-image rounded-[8px] sm:rounded-[10px]"
                                  style={{ overflow: 'hidden', margin: '0 auto' }}
                                >
                                  {productImage ? (
                                    <Image
                                      src={productImage}
                                      alt={product.title || "Product"}
                                      width={200}
                                      height={200}
                                      className="object-cover w-full h-full"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                      <PlaceholderImage size={60} />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
                                <ProductCardRating product={product} rating={ratings?.find((r) => r.product_id === product.id)} />
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2 truncate loved-by-moms-card-title">
                                  {product.title}
                                </h3>
                                {displayPrice && (
                                  <p className="text-sm sm:text-base lg:text-lg font-semibold text-gold-accent loved-by-moms-price">
                                    {displayPrice}
                                  </p>
                                )}
                              </div>
                            </LocalizedClientLink>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default LovedByMoms

