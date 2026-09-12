"use client"

import React, { useMemo, useState, useEffect } from "react"
import type { HttpTypes } from "@medusajs/types"
import { Heading } from "@medusajs/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { useProductContext } from "@modules/products/context/product-context"
import { fetchRatingForProduct } from "@lib/data/reviews"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
}

const ProductInfo = ({ product, region }: ProductInfoProps) => {
  const { selectedVariantId } = useProductContext()
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: selectedVariantId,
  })

  const price = selectedVariantId ? (variantPrice || cheapestPrice) : cheapestPrice

  // Get brand from metadata or collection
  const metadataBrand = product.metadata?.brand as string | undefined
  const brand = metadataBrand || product.collection?.title || "Cultura Jewels"

  // Fetch rating summary from backend API
  const [apiRating, setApiRating] = useState<{ average_rating: number; total_reviews: number } | null>(null)

  useEffect(() => {
    if (product.id) {
      fetchRatingForProduct(product.id).then((res) => {
        if (res) {
          setApiRating({
            average_rating: Number(res.average_rating || 0),
            total_reviews: Number(res.total_reviews || 0),
          })
        }
      })
    }
  }, [product.id])

  // Resolve dynamic rating & review count (Metadata > Backend API > Default 0)
  const ratingSummary = useMemo(() => {
    // 1. Read Medusa product metadata set in Medusa Admin / Backend
    const metaRating = product.metadata?.rating ?? product.metadata?.review_rating ?? product.metadata?.average_rating
    const metaCount = product.metadata?.review_count ?? product.metadata?.reviews_count ?? product.metadata?.total_reviews

    if (metaRating !== undefined && metaCount !== undefined && metaCount !== null) {
      const parsedRating = parseFloat(String(metaRating))
      const parsedCount = parseInt(String(metaCount), 10)
      if (!isNaN(parsedRating) && !isNaN(parsedCount)) {
        return { rating: parsedRating, total_reviews: parsedCount }
      }
    }

    // 2. Read live backend rating response if available
    if (apiRating && apiRating.total_reviews >= 0) {
      return { rating: apiRating.average_rating, total_reviews: apiRating.total_reviews }
    }

    return { rating: 0, total_reviews: 0 }
  }, [product.metadata, apiRating])

  const isSilver = useMemo(() => {
    const title = product.title?.toLowerCase() || ""
    const desc = product.description?.toLowerCase() || ""
    const handle = product.handle?.toLowerCase() || ""

    // Exclude default Medusa clothing items
    const isClothing = ["shorts", "sweatshirt", "sweatpants", "t-shirt", "cap", "hoodie"].some(item => handle.includes(item))
    if (isClothing) return false

    // Identify jewelry or items containing silver references
    const jewelryKeywords = [
      "moissanite", "band", "ring", "pendant", "earring", "necklace", "bracelet", 
      "jewelry", "jewellery", "silver", "gold", "925", "plated", "vermeil", 
      "sterling", "stone", "carat", "solitaire"
    ]
    
    return jewelryKeywords.some(keyword => title.includes(keyword) || desc.includes(keyword))
  }, [product])

  return (
    <div id="product-info" className="flex flex-col gap-3 sm:gap-4 w-full">
      {/* Brand */}
      <div className="text-xs sm:text-sm font-semibold text-gray-800 uppercase tracking-wider">
        {brand}
      </div>

      {/* Price Above Title */}
      {price && (
        <div className="flex flex-col gap-0.5 -mt-1">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="text-xl sm:text-2xl lg:text-[27px] min-[1360px]:text-[28px] font-bold text-gray-900" data-testid="product-price-top">
              {price.calculated_price}
            </span>
            {price.price_type === "sale" && (
              <>
                <span className="text-sm sm:text-base text-gray-500 line-through">
                  {price.original_price}
                </span>
                <span className="text-sm sm:text-base font-semibold text-gold-accent">
                  ({price.percentage_diff}% OFF)
                </span>
              </>
            )}
          </div>
          <p className="text-xs sm:text-sm" style={{ color: '#156229', fontWeight: 500 }}>
            inclusive of all taxes
          </p>
        </div>
      )}

      {/* Product Title, Rating & Silver Badge Block */}
      <div className="flex flex-col gap-2.5 w-full">
        <div className="flex items-start justify-between gap-4 w-full">
          <Heading
            level="h1"
            className="text-lg sm:text-xl md:text-xl lg:text-2xl min-[1360px]:text-[25px] font-semibold text-gray-900 leading-snug flex-1"
            data-testid="product-title"
          >
            {product.title}
          </Heading>
        </div>

        {/* Dynamic Rating & Reviews Count */}
        <div className="flex items-center gap-2 mt-0.5">
          {ratingSummary.total_reviews > 0 ? (
            <>
              <div className="flex gap-0.5 text-black text-base leading-none">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={star <= Math.round(ratingSummary.rating) ? "text-black" : "text-gray-300"}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm text-gray-700 font-medium leading-none relative top-[0.5px]">
                {ratingSummary.rating.toFixed(1)} Reviews ({ratingSummary.total_reviews}+ Customers)
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400 italic font-medium leading-none relative top-[0.5px]">
              No reviews yet
            </span>
          )}
        </div>

        {/* Made with pure 925 silver badge */}
        {isSilver && (
          <div className="text-[15px] sm:text-base font-bold text-black tracking-wide mt-2">
            Made with pure 925 silver
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductInfo
