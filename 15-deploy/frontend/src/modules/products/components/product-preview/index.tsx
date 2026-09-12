"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice, getPricesForVariant } from "@lib/util/get-product-price"
import { addToCart } from "@lib/data/cart"
import { trackAddToCart } from "@lib/analytics/ga4-ecommerce"
import { addToWishlist, removeFromWishlist, getWishlistProductIds } from "@lib/data/wishlist"
import { useParams } from "next/navigation"
import LoginPopup from "@modules/common/components/login-popup"
import { isEqual } from "lodash"
import { clx } from "@medusajs/ui"
import Modal from "@modules/common/components/modal"
import { useWishlist } from "@lib/context/wishlist-context"
import { useMemo } from "react"

// Sub-component for Quick Add content to avoid duplication
const QuickAddContent = ({
  product,
  selectedOptions,
  setOptionValue,
  handleAddToCart,
  isAdding,
  showError,
  inventoryError,
  cartQuantities,
  onClose,
  isMobile,
  selectedVariantPrice,
  quantity,
  setQuantity,
}: {
  product: HttpTypes.StoreProduct,
  selectedOptions: Record<string, string>,
  setOptionValue: (o: string, v: string) => void,
  handleAddToCart: () => void,
  isAdding: string | null,
  showError: boolean,
  inventoryError: boolean,
  cartQuantities: Record<string, number>,
  onClose: () => void,
  isMobile: boolean,
  selectedVariantPrice?: {
    calculated_price: string
    original_price: string
    percentage_diff: string
  } | null,
  quantity: number,
  setQuantity: (q: number) => void,
}) => {
  // Find selected variant for inventory check
  const selectedVariant = useMemo(() => {
    if (!product.variants || Object.keys(selectedOptions).length === 0) return null
    return product.variants.find((v) => {
      const vOptions = v.options?.reduce((acc: Record<string, string>, o: any) => {
        acc[o.option_id] = o.value
        return acc
      }, {})
      return isEqual(vOptions, selectedOptions)
    })
  }, [selectedOptions, product.variants])

  const inStock = useMemo(() => {
    if (!selectedVariant) return false
    if (!selectedVariant.manage_inventory) return true
    if (selectedVariant.allow_backorder) return true
    
    const inCart = (selectedVariant.id ? cartQuantities[selectedVariant.id] : 0) || 0
    const available = (selectedVariant.inventory_quantity || 0) - inCart
    return available > 0
  }, [selectedVariant, cartQuantities])

  // Calculate the actual available quantity considering what's already in the cart
  const maxAvailable = useMemo(() => {
    if (!selectedVariant || !selectedVariant.manage_inventory || selectedVariant.allow_backorder) return 100
    const inCart = (selectedVariant.id ? cartQuantities[selectedVariant.id] : 0) || 0
    return Math.max(0, (selectedVariant.inventory_quantity || 0) - inCart)
  }, [selectedVariant, cartQuantities])

  // Check if adding the requested quantity would exceed stock
  const isLimitReached = useMemo(() => {
    if (!selectedVariant || !selectedVariant.manage_inventory || selectedVariant.allow_backorder) return false
    return quantity > maxAvailable
  }, [maxAvailable, quantity])

  // Auto-adjust quantity if it exceeds available stock for the selected variant
  useEffect(() => {
    if (selectedVariant && selectedVariant.manage_inventory && !selectedVariant.allow_backorder) {
      if (quantity > maxAvailable && maxAvailable > 0) {
        setQuantity(maxAvailable)
      } else if (maxAvailable === 0) {
        setQuantity(1)
      }
    }
  }, [selectedVariant, quantity, setQuantity, maxAvailable])

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.1em]">Configure Product</h4>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Selected Variant Price Row with Quantity Selector or Out of Stock Badge */}
      <div className="mb-4 flex items-center justify-between gap-4">
        {selectedVariantPrice ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-[18px] sm:text-[20px] font-black text-gold-accent">
                  {selectedVariantPrice.calculated_price}
                </span>
                {selectedVariantPrice.calculated_price !== selectedVariantPrice.original_price && (
                  <span className="text-[12px] sm:text-[13px] text-gray-500 line-through font-semibold">
                    {selectedVariantPrice.original_price}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-7" /> // Spacer
        )}

        {selectedVariant && !inStock ? (
          <span className="text-[10px] font-bold bg-red-50 text-red-500 px-3 py-1.5 rounded-full border border-red-100 uppercase tracking-wider shrink-0 shadow-sm">
            Out of Stock
          </span>
        ) : (
          /* Quantity Selection Area */
          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center bg-gray-50/80 rounded-full p-1 border transition-colors shadow-sm shrink-0 ${
              quantity >= maxAvailable ? "border-orange-200" : "border-gold-accent/30"
            }`}>
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-full text-gray-500 transition-all active:scale-90 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Decrease quantity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <div className="min-w-[28px] px-1 text-center text-[12px] font-black text-gold-accent">
                {quantity}
              </div>
              <button 
                onClick={() => {
                  if (quantity < maxAvailable) {
                    setQuantity(quantity + 1)
                  }
                }}
                disabled={quantity >= maxAvailable}
                className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-full text-gray-500 transition-all active:scale-90 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Increase quantity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
            
            {/* Limit Reached Legend */}
            {quantity >= maxAvailable && maxAvailable < 100 && (
              <span className="text-[9px] font-bold text-orange-500 animate-pulse px-1">
                Only {maxAvailable} left in stock
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="max-h-[160px] overflow-y-auto pr-1 custom-scrollbar space-y-3">
          {(product.options || []).slice().sort((a, b) => {
            const getOrder = (title: string) => {
              const t = title.toLowerCase()
              if (t.includes('color') || t.includes('colour')) return 1
              if (t.includes('size')) return 2
              return 3
            }
            return getOrder(a.title || "") - getOrder(b.title || "")
          }).map((option) => (
            <div key={option.id} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{option.title}</span>
              <div className="flex flex-wrap gap-1.5 px-0.5">
                {option.values?.map((v: any) => {
                  const isSelected = selectedOptions[option.id] === v.value
                  return (
                    <button
                      key={v.id}
                      onClick={() => setOptionValue(option.id, v.value)}
                      className={clx(
                        "min-w-[42px] h-[28px] px-2 rounded-lg text-[11px] font-black transition-all border-2",
                        isSelected
                          ? "bg-royal-blue border-gold-accent text-white shadow-md"
                          : "bg-white border-gray-100 text-gray-600 hover:border-gold-accent/30 hover:bg-gray-50"
                      )}
                    >
                      {v.value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => handleAddToCart()}
          disabled={isAdding === product.id || (!isAdding && !showError && !inventoryError && (!selectedVariant || !inStock || isLimitReached))}
          className={clx(
            "w-full h-11 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all shadow-lg active:scale-[0.97] flex items-center justify-center",
            (showError || inventoryError) ? "bg-red-500 animate-shake text-white" : "bg-royal-blue hover:bg-gold-accent text-white",
            // Disable style if not available, out of stock, or limit reached
            (!isAdding && !showError && !inventoryError && (!selectedVariant || !inStock || isLimitReached)) ? "opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400 shadow-none" : ""
          )}
        >
          {isAdding === product.id
            ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )
            : showError
              ? "Select All Options"
              : (inventoryError || isLimitReached)
                ? "Out of Stock"
                : !selectedVariant
                  ? "Not Available"
                  : !inStock
                    ? "Out of Stock"
                    : `Add to Bag${quantity > 1 ? ` (${quantity})` : ''}`}
        </button>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #0A1D37;
          border-radius: 10px;
        }
      `}</style>
    </>
  )
}

export default function ProductPreview({
  product,
  isFeatured,
  region,
  wishlistProductIds,
  rating,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
  wishlistProductIds?: string[] | null
  rating?: {
    product_id: string
    average_rating: number
    total_reviews: number
  }
}) {
  const [isAdding, setIsAdding] = useState<string | null>(null)
  const { isWishlisted: checkIsWishlisted, toggleWishlist } = useWishlist()
  const isWishlisted = useMemo(() => checkIsWishlisted(product.id || ""), [checkIsWishlisted, product.id])
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [showError, setShowError] = useState(false)
  const [inventoryError, setInventoryError] = useState(false)
  const [showAsModal, setShowAsModal] = useState(false)
  const { countryCode } = useParams() as { countryCode: string }

  // Detect when to use Modal vs in-card overlay
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      // Use Modal for mobile (< 500px) and the specific range where clipping happens (1023px-1100px)
      setShowAsModal(width < 500 || (width >= 1023 && width <= 1100))
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Resolve dynamic rating & review count (Rating Prop > Medusa Product Metadata)
  const effectiveRating = useMemo(() => {
    if (rating && typeof rating.total_reviews === "number") {
      return rating
    }
    const metaRating = product.metadata?.rating ?? product.metadata?.review_rating ?? product.metadata?.average_rating
    const metaCount = product.metadata?.review_count ?? product.metadata?.reviews_count ?? product.metadata?.total_reviews

    if (metaRating !== undefined && metaCount !== undefined && metaCount !== null) {
      const parsedRating = parseFloat(String(metaRating))
      const parsedCount = parseInt(String(metaCount), 10)
      if (!isNaN(parsedRating) && !isNaN(parsedCount) && parsedCount >= 0) {
        return {
          product_id: product.id || "",
          average_rating: parsedRating,
          total_reviews: parsedCount,
        }
      }
    }
    return null
  }, [rating, product.metadata, product.id])

  // Logic to ensure only one Quick Add is open at a time
  useEffect(() => {
    const handleCloseOthers = (e: any) => {
      if (e.detail !== product.id) {
        setShowQuickAdd(false)
        setSelectedOptions({})
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (showQuickAdd) {
        const target = e.target as HTMLElement
        if (!target.closest(`[data-product-id="${product.id}"]`)) {
          setShowQuickAdd(false)
          setSelectedOptions({})
          setQuantity(1)
        }
      }
    }

    if (showQuickAdd) {
      window.addEventListener("close-other-quick-adds", handleCloseOthers)
      // Only close on click-outside if NOT in modal mode
      if (!showAsModal) {
        document.addEventListener("mousedown", handleClickOutside)
      }
    }
    return () => {
      window.removeEventListener("close-other-quick-adds", handleCloseOthers)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showQuickAdd, product.id, showAsModal])

  // Fetch cart quantities to check against stock
  useEffect(() => {
    // Only fetch cart quantities when Quick Add is actually shown
    // This prevents 50+ simultaneous server calls on the listing page
    if (!showQuickAdd) return

    const fetchCart = async () => {
      try {
        const { retrieveCart } = await import("@lib/data/cart")
        const cart = await retrieveCart()
        if (cart?.items) {
          const quantities: Record<string, number> = {}
          cart.items.forEach((item: any) => {
            if (item.variant_id) {
              quantities[item.variant_id] = (quantities[item.variant_id] || 0) + item.quantity
            }
          })
          setCartQuantities(quantities)
        }
      } catch (e) {
        console.error("Error fetching cart quantities:", e)
      }
    }

    fetchCart()
    window.addEventListener("cart-updated", fetchCart)
    return () => window.removeEventListener("cart-updated", fetchCart)
  }, [showQuickAdd])

  // Auto-select first options when Quick Add is shown
  useEffect(() => {
    if (showQuickAdd && product.options) {
      const partialOptions: Record<string, string> = { ...selectedOptions }
      let hasChanges = false

      product.options.forEach((option) => {
        // If no value is selected for this option, pick the first one
        if (!partialOptions[option.id]) {
          const firstValue = option.values?.[0]?.value
          if (firstValue) {
            partialOptions[option.id] = firstValue
            hasChanges = true
          }
        }
      })

      if (hasChanges) {
        setSelectedOptions(partialOptions)
      }
    }
  }, [showQuickAdd, product.options])

  const { cheapestPrice } = getProductPrice({
    product,
  })

  // Compute the selected variant's price based on current option selections
  const selectedVariantPrice = useMemo(() => {
    if (!product.variants || Object.keys(selectedOptions).length === 0) return null
    const matchedVariant = product.variants.find((v) => {
      const vOptions = v.options?.reduce((acc: Record<string, string>, o: any) => {
        acc[o.option_id] = o.value
        return acc
      }, {})
      return isEqual(vOptions, selectedOptions)
    })
    if (!matchedVariant) return null
    return getPricesForVariant(matchedVariant)
  }, [selectedOptions, product.variants])

  const handleAddToCart = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (!product.variants || product.variants.length === 0) return

    // Case 1: Only one variant exists - add it immediately if in stock
    if (product.variants.length === 1) {
      const firstVariant = product.variants[0]
      if (!firstVariant.id) return

      const inStock = !firstVariant.manage_inventory || firstVariant.allow_backorder || (firstVariant.inventory_quantity || 0) > 0
      
      if (!inStock) {
        // If out of stock, show the prompt so user sees the message
        window.dispatchEvent(new CustomEvent("close-other-quick-adds", { detail: product.id }))
        setShowQuickAdd(true)
        return
      }

      setIsAdding(product.id || null)
      try {
        await addToCart({
          variantId: firstVariant.id,
          quantity: quantity,
          countryCode,
        })
        const currency = (firstVariant as any).calculated_price?.currency_code?.toUpperCase() ?? "USD"
        const unitPrice = (firstVariant as any).calculated_price?.calculated_amount ?? 0
        trackAddToCart({
          currency,
          value: unitPrice / 100,
          items: [
            {
              item_id: firstVariant.id,
              item_name: product.title ?? "",
              price: unitPrice / 100,
              quantity: quantity,
              item_variant: firstVariant.title ?? undefined,
            },
          ],
        })
      } catch (error) {
        // Silence error
      } finally {
        setIsAdding(null)
        window.dispatchEvent(new CustomEvent("cart-updated"))
      }
      return
    }

    // Case 2: Multiple variants - show prompt first if not open
    if (!showQuickAdd) {
      // Dispatch event to close other overlays
      window.dispatchEvent(new CustomEvent("close-other-quick-adds", { detail: product.id }))
      setShowQuickAdd(true)
      // Defaults will be selected by the useEffect when showQuickAdd becomes true
      return
    }

    // Case 3: Multiple variants and prompt is already open - verify selection and add
    const selectedVariant = product.variants.find((v) => {
      const vOptions = v.options?.reduce((acc: Record<string, string>, o: any) => {
        acc[o.option_id] = o.value
        return acc
      }, {})
      return isEqual(vOptions, selectedOptions)
    })

    if (selectedVariant) {
      setIsAdding(product.id || null)
      try {
        await addToCart({
          variantId: selectedVariant.id,
          quantity: quantity,
          countryCode,
        })
        const currency = (selectedVariant as any).calculated_price?.currency_code?.toUpperCase() ?? "USD"
        const unitPrice = (selectedVariant as any).calculated_price?.calculated_amount ?? 0
        trackAddToCart({
          currency,
          value: unitPrice / 100,
          items: [
            {
              item_id: selectedVariant.id,
              item_name: product.title ?? "",
              price: unitPrice / 100,
              quantity: quantity,
              item_variant: selectedVariant.title ?? undefined,
            },
          ],
        })
      } catch (error: any) {
        // Handle specific inventory error to prevent red screen
        const msg = error.message?.toLowerCase() || ""
        if (msg.includes("inventory") || msg.includes("stock") || msg.includes("quantity")) {
          setInventoryError(true)
          setTimeout(() => setInventoryError(false), 3000)
        }
        console.error("Add to bag error:", error)
      } finally {
        setIsAdding(null)
        window.dispatchEvent(new CustomEvent("cart-updated"))
        // If there's an inventory error, don't close immediately so user can see it
        // Or we can close and just show the error. Let's close if successful.
      }
      
      // If we made it here without returning, and no error was set
      if (!inventoryError) {
        setShowQuickAdd(false)
        setSelectedOptions({})
        setQuantity(1)
      }
    } else {
      setShowError(true)
      setTimeout(() => setShowError(false), 2000)
    }
  }

  const setOptionValue = (optionId: string, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
    setShowError(false)
  }

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!product.id) return

    setIsTogglingWishlist(true)
    const result = await toggleWishlist(product.id)
    if (!result.success && result.error?.toLowerCase().includes("login")) {
      setShowLoginPopup(true)
    }
    setIsTogglingWishlist(false)
  }

  const productImage = product.thumbnail || product.images?.[0]?.url

  return (
    <div
      className="bg-transparent rounded-[14px] sm:rounded-[20px] transition-all duration-300 [@media(hover:hover)]:hover:-translate-y-1 relative group w-full mx-auto flex flex-col"
      data-testid="product-wrapper"
      data-product-id={product.id}
    >
      <div className="relative flex items-center justify-center pt-2 sm:pt-4 px-2 sm:px-4 product-image-container">
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          className="block w-full"
        >
          <div
            className="relative w-full rounded-[12px] sm:rounded-[16px] ring-1 ring-royal-blue/[0.06] shadow-[0_4px_14px_rgba(10,29,55,0.08)] [@media(hover:hover)]:group-hover:shadow-[0_16px_36px_rgba(10,29,55,0.18)] transition-shadow duration-300"
            style={{ aspectRatio: '1', maxWidth: '100%', margin: '0 auto', overflow: 'hidden' }}
          >
            {productImage ? (
              <Image
                src={productImage}
                alt={product.title || "Product"}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover w-full h-full transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400 text-xs sm:text-sm">No Image</span>
              </div>
            )}
            
            {/* Discount Badge - Dynamic based on selection */}
            {(() => {
              const activePrice = (showQuickAdd && selectedVariantPrice) ? selectedVariantPrice : cheapestPrice
              const percentage = activePrice?.percentage_diff
              if (percentage && parseInt(percentage) > 0) {
                return (
                  <div className="absolute top-0 left-0 sm:top-2 sm:left-2 z-10 animate-in fade-in duration-300 transform-gpu">
                    <span className="bg-[#D4AF37] text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                      {percentage}% OFF
                    </span>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </LocalizedClientLink>
        {/* Wishlist button is a sibling of the link (not nested inside the anchor)
            to avoid invalid <button> inside <a> and mobile ghost-tap navigation. */}
        <button
          type="button"
          className={`absolute top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 [@media(hover:hover)]:hover:bg-gray-50 transition-all z-10 ${isWishlisted ? "bg-red-50" : "bg-white"
            }`}
          onClick={handleToggleWishlist}
          disabled={isTogglingWishlist}
          data-ga-event="listing_wishlist_click"
          data-ga-label={product.title || "Product"}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <span className="pointer-events-none flex items-center justify-center">
            {isTogglingWishlist ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
                viewBox="0 0 24 24"
                fill={isWishlisted ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: isWishlisted ? "#ef4444" : "currentColor" }}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </span>
        </button>
      </div>
 
      <div className="px-2.5 sm:px-4 pb-2 sm:pb-3 pt-1.5 product-info flex flex-col flex-1">
        <h3 className="text-[13px] sm:text-[15px] font-semibold text-gray-900 mb-1 truncate product-title block max-w-[170px] min-[400px]:max-w-[200px] sm:max-w-[230px] h-[22px] sm:h-[26px] leading-[22px] sm:leading-[26px]" data-testid="product-title">
          {product.title}
        </h3>
        
        {/* Rating Display - Fixed height to prevent layout shift */}
        <div className="h-[18px] sm:h-[22px] mb-0.5 flex items-center">
          {effectiveRating && effectiveRating.total_reviews > 0 ? (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-500">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= Math.round(effectiveRating.average_rating)
                  return (
                    <svg
                      key={star}
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill={isFilled ? "#FFD700" : "none"}
                      stroke={isFilled ? "#FFD700" : "#D1D5DB"}
                      strokeWidth="2.5"
                      className="sm:w-[14px] sm:h-[14px]"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  )
                })}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 mt-0.5">
                {Number(effectiveRating.average_rating).toFixed(1)}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 mt-0.5">
                ({effectiveRating.total_reviews})
              </span>
            </div>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 italic">
              No reviews yet
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1.5 product-price-container">
          {cheapestPrice && (
            <div className="flex items-baseline gap-1.5 overflow-hidden">
              <p className="text-[15px] sm:text-[17px] font-bold product-price whitespace-nowrap text-gold-accent" data-testid="product-price">
                {cheapestPrice.calculated_price}
              </p>
              {cheapestPrice.calculated_price !== cheapestPrice.original_price && (
                <p className="text-[11px] sm:text-[12px] text-gray-500 line-through whitespace-nowrap font-semibold">
                  {cheapestPrice.original_price}
                </p>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleAddToCart()
            }}
            disabled={isAdding === product.id}
            data-ga-event="listing_add_to_bag_click"
            data-ga-label={product.title || "Product"}
            className="w-8 h-8 min-[400px]:w-9 min-[400px]:h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 disabled:opacity-50 border-2 border-white product-cart-btn shrink-0 bg-[#132519]"
            aria-label="Add to bag"
            onMouseEnter={(e) => {
              if (!isAdding) {
                e.currentTarget.classList.remove('bg-[#132519]'); e.currentTarget.classList.add('bg-gold-accent')
              }
            }}
            onMouseLeave={(e) => {
              if (!isAdding) {
                e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-[#132519]')
              }
            }}
          >
            {isAdding === product.id ? (
              <svg
                className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <span className="pointer-events-none flex items-center justify-center">
                <Image
                  src="/cart.svg"
                  alt="Add to bag"
                  width={20}
                  height={20}
                  className="brightness-0 invert w-4 h-4 min-[400px]:w-[18px] min-[400px]:h-[18px] sm:w-[22px] sm:h-[22px]"
                />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Add Overlay/Modal */}
      {showQuickAdd && (
        showAsModal ? (
          <Modal isOpen={showQuickAdd} close={() => { setShowQuickAdd(false); setSelectedOptions({}); setQuantity(1); }} size="xsmall">
            <Modal.Body>
              <div className="py-2">
                <QuickAddContent
                  product={product}
                  selectedOptions={selectedOptions}
                  setOptionValue={setOptionValue}
                  handleAddToCart={handleAddToCart}
                  isAdding={isAdding}
                  showError={showError}
                  inventoryError={inventoryError}
                  cartQuantities={cartQuantities}
                  onClose={() => { setShowQuickAdd(false); setSelectedOptions({}); setQuantity(1); }}
                  isMobile={true}
                  selectedVariantPrice={selectedVariantPrice}
                  quantity={quantity}
                  setQuantity={setQuantity}
                />
              </div>
            </Modal.Body>
          </Modal>
        ) : (
          <div
            className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-md z-[25] border-t border-gray-100 p-4 transition-all duration-300 animate-in slide-in-from-bottom shadow-2xl rounded-t-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <QuickAddContent
              product={product}
              selectedOptions={selectedOptions}
              setOptionValue={setOptionValue}
              handleAddToCart={handleAddToCart}
              isAdding={isAdding}
              showError={showError}
              inventoryError={inventoryError}
              cartQuantities={cartQuantities}
              onClose={() => { setShowQuickAdd(false); setSelectedOptions({}); setQuantity(1); }}
              isMobile={false}
              selectedVariantPrice={selectedVariantPrice}
              quantity={quantity}
              setQuantity={setQuantity}
            />
          </div>
        )
      )}

      {/* Login Popup */}
      <LoginPopup
        isOpen={showLoginPopup}
        onClose={() => setShowLoginPopup(false)}
        countryCode={countryCode}
      />
    </div>
  )
}
