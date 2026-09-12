'use client'

import React, { useState, useEffect } from "react"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "../product-preview"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const [region, setRegion] = useState<HttpTypes.StoreRegion | null>(null)
  const [allProducts, setAllProducts] = useState<HttpTypes.StoreProduct[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  // Fetch data on client side
  useEffect(() => {
    async function fetchData() {
      const fetchedRegion = await getRegion(countryCode)
      if (!fetchedRegion) {
        return
      }
      setRegion(fetchedRegion)

      const queryParams: HttpTypes.StoreProductListParams = {
        limit: 20, // Fetch more products for carousel
        is_giftcard: false,
      }

      if (fetchedRegion?.id) {
        queryParams.region_id = fetchedRegion.id
      }
      if (product.collection_id) {
        queryParams.collection_id = [product.collection_id]
      }
      if (product.tags) {
        queryParams.tag_id = product.tags
          .map((t) => t.id)
          .filter(Boolean) as string[]
      }

      const result = await listProducts({
        queryParams,
        countryCode,
      })

      if (result && result.response) {
        setAllProducts(
          result.response.products.filter(
            (responseProduct) => responseProduct.id !== product.id
          )
        )
      } else {
        setAllProducts([])
      }
    }
    fetchData()
  }, [product, countryCode])

  // Get current 4 products to display
  const currentProducts = allProducts.slice(currentIndex, currentIndex + 4)
  const maxIndex = Math.max(0, allProducts.length - 4)

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 4))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 4))
  }

  if (!region || !allProducts.length) {
    return null
  }

  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < maxIndex

  return (
    <>
      <div className="mt-16 pt-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            You May Also Like
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={!canGoPrevious}
              className={`w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center transition-colors ${canGoPrevious
                ? 'hover:bg-gray-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
                }`}
              aria-label="Previous products"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className={`w-10 h-10 rounded-full bg-royal-blue flex items-center justify-center transition-colors ${canGoNext
                ? 'hover:bg-gold-accent cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
                }`}
              aria-label="Next products"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <div className="related-products-container">
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 justify-items-center">
            {currentProducts.map((product) => (
              <li key={product.id} className="w-full flex justify-center">
                <ProductPreview region={region} product={product} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
