"use client"

import { HttpTypes } from "@medusajs/types"
import { useState, useEffect } from "react"
import CartTotals from "@modules/common/components/cart-totals"
import DiscountCode from "@modules/checkout/components/discount-code"
import Divider from "@modules/common/components/divider"
import { useModal } from "@lib/context/modal-context"
import { getShiprocketServiceability } from "@lib/data/fulfillment"
import { updateCart, updateCartMetadataSilently } from "@lib/data/cart"

interface ShiprocketCourier {
  id: number
  courier_name: string
  rate: string
  etd: string
  estimated_delivery_days: number
}

interface DeliveryEstimate {
  etd: string | null
  estimatedDays: number | null
  courierName: string | null
  isLoading: boolean
  error: string | null
}

function getCheckoutStep(cart: HttpTypes.StoreCart, customer: HttpTypes.StoreCustomer | null) {
  return "payment"
}

const CheckoutSummary = ({ cart, customer }: { cart: HttpTypes.StoreCart | null, customer: HttpTypes.StoreCustomer | null }) => {
  if (!cart) return null
  
  const { isModalOpen } = useModal()

  // State for Shiprocket delivery estimate
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate>({
    etd: null,
    estimatedDays: null,
    courierName: null,
    isLoading: false,
    error: null,
  })

  // State to track if we've already synced this ETD to avoid loops
  const [syncedEtd, setSyncedEtd] = useState<string | null>(null)

  // State to track last fetched parameters to avoid redundant calls
  const [lastFetchedParams, setLastFetchedParams] = useState({ postalCode: "", variantId: "" })

  // Get postal code from cart's shipping address
  const postalCode = cart?.shipping_address?.postal_code

  // Always pick a single variant ID from the first cart item for delivery estimation
  const firstItem = cart?.items?.[0]
  const singleVariantId = firstItem?.variant_id || null


  // Fetch delivery estimate from Shiprocket when postal code changes
  useEffect(() => {
    const resetParams = () => {
      setLastFetchedParams({ postalCode: "", variantId: "" })
    }
    window.addEventListener("address-updated-silent", resetParams)
    return () => window.removeEventListener("address-updated-silent", resetParams)
  }, [])

  useEffect(() => {
    const fetchDeliveryEstimate = async () => {
      // Stop if invalid pincode or no single variant ID
      if (!postalCode || postalCode.length < 6 || !singleVariantId) {
        setDeliveryEstimate(prev => ({
          ...prev, etd: null, estimatedDays: null, courierName: null, isLoading: false, error: null,
        }))
        return
      }

      // Stop if parameters haven't changed to avoid loops and flickering
      if (postalCode === lastFetchedParams.postalCode && singleVariantId === lastFetchedParams.variantId) {
        return
      }

      // Only show loading if we don't have a result yet for this pincode
      setDeliveryEstimate(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        // Pass only the single variant ID (from the first cart item) — never all variant IDs
        const data = await getShiprocketServiceability(postalCode, singleVariantId, 0)

        if (!data) {
          throw new Error("Failed to fetch delivery estimates")
        }

        // Handle both wrapped list response and direct response format
        let bestCourier = null
        if (data.etd) {
          bestCourier = data
        } else if (data.data?.etd) {
          bestCourier = data.data
        } else if (data.data?.available_courier_companies?.length > 0) {
          bestCourier = data.data.available_courier_companies[0]
        }

        if (bestCourier) {
          setDeliveryEstimate({
            etd: bestCourier.etd,
            estimatedDays: bestCourier.estimated_delivery_days,
            courierName: bestCourier.courier_name || null,
            isLoading: false,
            error: null,
          })
          setLastFetchedParams({ postalCode, variantId: singleVariantId })

          // Immediate silent sync to cart metadata for order persistence
          updateCartMetadataSilently({
            ...cart.metadata,
            estimated_delivery_days: bestCourier.estimated_delivery_days,
            etd: bestCourier.etd,
            estimated_delivery: bestCourier.etd
          })
        } else {
          setDeliveryEstimate({
            etd: null, estimatedDays: null, courierName: null, isLoading: false,
            error: "Delivery not available to this pincode",
          })
          setLastFetchedParams({ postalCode, variantId: singleVariantId })
        }
      } catch (error: any) {
        setDeliveryEstimate({
          etd: null, estimatedDays: null, courierName: null, isLoading: false,
          error: error.message || "Unable to fetch delivery estimate",
        })
      }
    }

    fetchDeliveryEstimate()
  }, [postalCode, singleVariantId, lastFetchedParams, cart?.metadata?.etd])



  // Format ETD date for display
  const formatDeliveryDate = (etd: string | null) => {
    if (!etd) {
      // Fallback to 7 days from now
      const date = new Date()
      date.setDate(date.getDate() + 7)
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    // Parse the ETD (format: YYYY-MM-DD)
    const date = new Date(etd)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Fallback estimated delivery date (7 days from now)
  const getEstimatedDeliveryDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Get first item image for delivery estimates - prioritize variant images

  // Filter variant images to get first variant-specific image
  const getVariantImage = () => {
    if (!firstItem?.variant?.images || firstItem.variant.images.length === 0) {
      return null
    }

    const variantImages = firstItem.variant.images
    const productThumbnail = firstItem.thumbnail || firstItem.variant?.product?.thumbnail
    const productImages = (firstItem.variant?.product as any)?.images || []

    // Create a set of product image URLs for comparison
    const productImageUrls = new Set<string>()

    if (productThumbnail) {
      const cleanThumbnailUrl = productThumbnail.split('?')[0].toLowerCase().trim()
      productImageUrls.add(cleanThumbnailUrl)
      const thumbnailPath = cleanThumbnailUrl.split('/').pop() || ''
      if (thumbnailPath) {
        productImageUrls.add(thumbnailPath.toLowerCase())
      }
    }

    productImages.forEach((img: any) => {
      if (img.url) {
        const cleanUrl = img.url.split('?')[0].toLowerCase().trim()
        productImageUrls.add(cleanUrl)
        const urlPath = cleanUrl.split('/').pop() || ''
        if (urlPath) {
          productImageUrls.add(urlPath.toLowerCase())
        }
      }
    })

    // Filter out variant images that match product images/thumbnail
    const filteredVariantImages = variantImages.filter((img: any) => {
      if (!img.url) return false
      const cleanImgUrl = img.url.split('?')[0].toLowerCase().trim()
      const imgPath = cleanImgUrl.split('/').pop() || ''
      const urlMatches = productImageUrls.has(cleanImgUrl) || (imgPath && productImageUrls.has(imgPath.toLowerCase()))
      return !urlMatches
    })

    return filteredVariantImages.length > 0
      ? filteredVariantImages[0]?.url
      : variantImages[0]?.url || null
  }

  const productImage = getVariantImage() || firstItem?.thumbnail || firstItem?.variant?.product?.thumbnail

  if (isModalOpen) {
    return null
  }

  return (
    <div
      className="sticky top-0 flex flex-col-reverse min-[1024px]:flex-col gap-y-6 min-[550px]:gap-y-8 py-4 min-[550px]:py-6 min-[1024px]:py-0"
    >
      <div className="w-full bg-ivory-bg flex flex-col">
        <Divider className="my-4 min-[550px]:my-6 min-[1024px]:hidden" />

        {/* DELIVERY ESTIMATES Section */}
        {firstItem && (
          <div className="bg-ivory-bg rounded-lg p-4 min-[550px]:p-5 sm:p-6 border shadow-sm mb-4 min-[550px]:mb-5 sm:mb-6" style={{ borderColor: '#C0C0C0' }}>
            <h3 className="text-base min-[550px]:text-lg font-bold text-gray-900 mb-3 min-[550px]:mb-4 uppercase">
              DELIVERY ESTIMATES
            </h3>
            <div className="flex items-center gap-3 min-[550px]:gap-4">
              {productImage && (
                <img
                  src={productImage}
                  alt={firstItem.title || "Product"}
                  className="w-12 h-12 min-[550px]:w-14 min-[550px]:h-14 sm:w-16 sm:h-16 object-cover rounded flex-shrink-0"
                />
              )}
              <div>
                {!postalCode || postalCode.length < 6 ? (
                  <p className="text-sm min-[550px]:text-base text-gray-500">
                    Please enter delivery address to see estimates
                  </p>
                ) : deliveryEstimate.isLoading ? (
                  <p className="text-sm min-[550px]:text-base text-gray-500 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calculating delivery estimate...
                  </p>
                ) : deliveryEstimate.error ? (
                  <p className="text-sm min-[550px]:text-base text-gray-900">
                    Estimated delivery by <strong>{getEstimatedDeliveryDate()}</strong>
                  </p>
                ) : deliveryEstimate.etd ? (
                  <p className="text-sm min-[550px]:text-base text-gray-900">
                    Estimated delivery by <strong>{formatDeliveryDate(deliveryEstimate.etd)}</strong>
                  </p>
                ) : (
                  <p className="text-sm min-[550px]:text-base text-gray-900">
                    Estimated delivery by <strong>{getEstimatedDeliveryDate()}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COUPONS Section */}
        <div className="mb-4 min-[550px]:mb-5 sm:mb-6">
          <DiscountCode cart={cart} />
        </div>

        {/* PRICE SUMMARY Section */}
        <CartTotals totals={cart || {} as any} items={cart?.items || []} checkoutStep={getCheckoutStep(cart, customer)} customer={customer} />
      </div>
    </div>
  )
}

export default CheckoutSummary
