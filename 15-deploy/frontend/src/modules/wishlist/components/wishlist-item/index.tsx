"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice, getPricesForVariant } from "@lib/util/get-product-price"
import { addToCart } from "@lib/data/cart"
import { trackAddToCart } from "@lib/analytics/ga4-ecommerce"
import { useParams, useRouter } from "next/navigation"
import { isEqual } from "lodash"
import { clx } from "@medusajs/ui"
import { addToWishlist, removeFromWishlist } from "@lib/data/wishlist"
import LoginPopup from "@modules/common/components/login-popup"
import Modal from "@modules/common/components/modal"

// Sub-component for Quick Add content to avoid duplication
const QuickAddContent = ({
  product,
  selectedOptions,
  setOptionValue,
  handleAddToCart,
  isAdding,
  showError,
  onClose,
  isMobile,
  selectedVariantPrice,
  quantity,
  setQuantity,
  cart,
}: {
  product: HttpTypes.StoreProduct,
  selectedOptions: Record<string, string>,
  setOptionValue: (o: string, v: string) => void,
  handleAddToCart: (e?: React.MouseEvent) => void,
  isAdding: boolean,
  showError: boolean,
  onClose: () => void,
  isMobile: boolean,
  selectedVariantPrice?: {
    calculated_price: string
    original_price: string
    percentage_diff: string
  } | null,
  quantity: number,
  setQuantity: (q: number) => void,
  cart: HttpTypes.StoreCart | null,
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
    
    // Subtract what's already in the cart
    const inCartQuantity = cart?.items?.find(item => item.variant_id === selectedVariant.id)?.quantity || 0
    const availableStock = (selectedVariant.inventory_quantity || 0) - inCartQuantity
    
    return availableStock > 0
  }, [selectedVariant, cart])

  // Auto-adjust quantity if it exceeds available stock for the selected variant
  useEffect(() => {
    if (selectedVariant && selectedVariant.manage_inventory && !selectedVariant.allow_backorder) {
      const inCartQuantity = cart?.items?.find(item => item.variant_id === selectedVariant.id)?.quantity || 0
      const stock = (selectedVariant.inventory_quantity || 0) - inCartQuantity
      
      if (quantity > stock && stock > 0) {
        setQuantity(stock)
      } else if (stock <= 0) {
        setQuantity(1)
      }
    }
  }, [selectedVariant, quantity, setQuantity, cart])

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
            <div className={`flex items-center bg-gray-50/80 rounded-full p-1 border transition-colors shadow-sm shrink-0 ${(() => {
              const inCartQuantity = cart?.items?.find(item => item.variant_id === selectedVariant?.id)?.quantity || 0
              const maxQuantity = !selectedVariant?.manage_inventory || selectedVariant?.allow_backorder ? 100 : ((selectedVariant?.inventory_quantity || 0) - inCartQuantity)
              return quantity >= maxQuantity ? "border-orange-200" : "border-gold-accent/30"
            })()}`}>
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
                  const inCartQuantity = cart?.items?.find(item => item.variant_id === selectedVariant?.id)?.quantity || 0
                  const maxQuantity = !selectedVariant?.manage_inventory || selectedVariant?.allow_backorder 
                    ? 100 
                    : ((selectedVariant?.inventory_quantity || 0) - inCartQuantity)
                  if (quantity < maxQuantity) {
                    setQuantity(quantity + 1)
                  }
                }}
                disabled={(() => {
                  const inCartQuantity = cart?.items?.find(item => item.variant_id === selectedVariant?.id)?.quantity || 0
                  const maxQuantity = !selectedVariant?.manage_inventory || selectedVariant?.allow_backorder 
                    ? 100 
                    : ((selectedVariant?.inventory_quantity || 0) - inCartQuantity)
                  return quantity >= maxQuantity
                })()}
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
            {(() => {
              const inCartQuantity = cart?.items?.find(item => item.variant_id === selectedVariant?.id)?.quantity || 0
              const maxQuantity = !selectedVariant?.manage_inventory || selectedVariant?.allow_backorder ? 100 : ((selectedVariant?.inventory_quantity || 0) - inCartQuantity)
              if (quantity >= maxQuantity && maxQuantity < 100) {
                return (
                  <span className="text-[9px] font-bold text-orange-500 animate-pulse px-1">
                    {maxQuantity <= 0 ? "Already in bag (Max reached)" : `Only ${maxQuantity} more available`}
                  </span>
                )
              }
              return null
            })()}
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
          onClick={(e) => handleAddToCart(e)}
          disabled={isAdding || (!isAdding && !showError && (!selectedVariant || !inStock))}
          className={clx(
            "w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all shadow-lg active:scale-[0.97] flex items-center justify-center",
            showError ? "bg-red-500 animate-shake text-white" : "bg-royal-blue hover:bg-gold-accent text-white",
            // Disable style if not available or out of stock
            (!isAdding && !showError && (!selectedVariant || !inStock)) ? "opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400 shadow-none" : ""
          )}
        >
          {isAdding
            ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )
            : showError
              ? "Select All Options"
              : !selectedVariant
                ? "Not Available"
                : !inStock
                  ? "Out of Stock"
                  : `Move to Bag${quantity > 1 ? ` (${quantity})` : ''}`}
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


interface WishlistItemProps {
  product: HttpTypes.StoreProduct
  countryCode: string
  cart: HttpTypes.StoreCart | null
  onRemove: () => void
}

const WishlistItem = ({ product, countryCode, cart, onRemove }: WishlistItemProps) => {
  const [isAdding, setIsAdding] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { countryCode: paramCountryCode } = useParams() as { countryCode: string }
  const finalCountryCode = countryCode || paramCountryCode
  const router = useRouter()

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [showError, setShowError] = useState(false)
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false)
  const [showAsModal, setShowAsModal] = useState(false)

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

  const { cheapestPrice } = getProductPrice({
    product,
  })

  // Compute selected variant price from already-loaded data (no API call)
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

  const productImage = product.thumbnail || product.images?.[0]?.url

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
  }, [showQuickAdd, product.id])

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

  const handleMoveToCart = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (!product.variants || product.variants.length === 0) {
      alert("This product has no variants available")
      return
    }

    // Case 1: Only one variant exists - add it immediately if in stock
    if (product.variants.length === 1) {
      const firstVariant = product.variants[0]
      if (!firstVariant.id) {
        alert("Product variant is not available")
        return
      }

      const inStock = !firstVariant.manage_inventory || firstVariant.allow_backorder || (firstVariant.inventory_quantity || 0) > 0
      
      if (!inStock) {
        // If out of stock, show the prompt so user sees the message
        window.dispatchEvent(new CustomEvent("close-other-quick-adds", { detail: product.id }))
        setShowQuickAdd(true)
        return
      }

      setIsAdding(true)
      setSuccessMessage(null)

      try {
        await addToCart({
          variantId: firstVariant.id,
          quantity: quantity,
          countryCode: finalCountryCode,
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
        setSuccessMessage("Added to bag!")
        router.refresh()
        setTimeout(() => {
          setSuccessMessage(null)
        }, 2000)
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to add product to cart. Please try again."
        alert(errorMessage)
      } finally {
        setIsAdding(false)
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
      setIsAdding(true)
      setSuccessMessage(null)
      try {
        await addToCart({
          variantId: selectedVariant.id,
          quantity: quantity,
          countryCode: finalCountryCode,
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
        setShowQuickAdd(false)
        setSelectedOptions({})
        setQuantity(1)
        setSuccessMessage("Added to bag!")
        router.refresh()
        setTimeout(() => {
          setSuccessMessage(null)
        }, 2000)
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to add product to cart. Please try again."
        alert(errorMessage)
      } finally {
        setIsAdding(false)
      }
    } else {
      // Shaker effect or error if they try to add without selecting
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

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media (min-width: 340px) and (max-width: 460px) {
            .wishlist-card {
              min-height: 240px !important;
              height: auto !important;
            }
            .wishlist-image-container {
              padding-top: 0.75rem !important;
              padding-left: 0.75rem !important;
              padding-right: 0.75rem !important;
            }
            .wishlist-info {
              padding: 0.5rem 0.75rem 0.75rem 0.75rem !important;
            }
            .wishlist-title {
              font-size: 0.875rem !important;
              margin-bottom: 0.5rem !important;
            }
            .wishlist-price {
              font-size: 0.9375rem !important;
              margin-bottom: 0.75rem !important;
            }
            .wishlist-button {
              padding: 0.5rem 1rem !important;
              font-size: 0.875rem !important;
            }
          }
          /* Custom shake animation */
           @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
              }
            .animate-shake {
               animation: shake 0.2s ease-in-out 0s 2;
            }
        `
      }} />
      <div
        className={clx(
          "bg-white rounded-[14px] sm:rounded-[16px] shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group wishlist-card w-full max-w-[280px] sm:max-w-[290px]",
          product.deleted_at && "grayscale-[0.5] opacity-80"
        )}
        style={{ height: 'auto', minHeight: 'auto' }}
        data-product-id={product.id}
      >
        {/* Product Image */}
        <div className="relative flex items-center justify-center pt-2 sm:pt-3 px-2 sm:px-3 wishlist-image-container">
          <LocalizedClientLink href={`/products/${product.handle}`} className="block w-full">
            <div
              className="relative rounded-[8px] sm:rounded-[10px]"
              style={{
                width: '100%',
                aspectRatio: '1',
                maxWidth: '100%',
                margin: '0 auto',
                overflow: 'hidden'
              }}
            >
              {productImage ? (
                <Image
                  src={productImage}
                  alt={product.title || "Product"}
                  width={280}
                  height={280}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-xs sm:text-sm">No Image</span>
                </div>
              )}
              {(() => {
                const percentage = cheapestPrice?.percentage_diff
                if (percentage && parseInt(percentage) > 0) {
                  return (
                    <div className="absolute top-2 left-2 z-10 animate-in fade-in duration-300 transform-gpu">
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

          {/* Remove Button (X) - Top Right */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemove()
            }}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 w-6 h-6 sm:w-7 sm:h-7 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:bg-gray-50 transition-all z-10"
            aria-label="Remove from wishlist"
          >
            <svg
              width="14"
              height="14"
              className="sm:w-4 sm:h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#000' }}
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Product Info */}
        <div className="px-2 sm:px-3 pb-2 sm:pb-3 pt-2 md:p-3 wishlist-info">
          <LocalizedClientLink href={`/products/${product.handle}`}>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 sm:mb-1.5 truncate hover:text-gold-accent transition-colors wishlist-title">
              {product.title}
            </h3>
          </LocalizedClientLink>

          {cheapestPrice && (
            <div className="flex items-baseline gap-1.5 overflow-hidden mb-2 sm:mb-2.5 wishlist-price">
              <p className="text-sm sm:text-base font-semibold whitespace-nowrap text-gold-accent">
                {cheapestPrice.calculated_price}
              </p>
              {cheapestPrice.calculated_price !== cheapestPrice.original_price && (
                <p className="text-[11px] sm:text-[12px] text-gray-500 line-through whitespace-nowrap font-semibold">
                  {cheapestPrice.original_price}
                </p>
              )}
            </div>
          )}

          {/* Move to Cart or No longer available Button */}
          {product.deleted_at ? (
            <button
              disabled
              className="w-full py-2 sm:py-2.5 md:py-3 px-4 sm:px-5 md:px-6 rounded-[10px] sm:rounded-full text-sm sm:text-base font-semibold text-white bg-gray-400 cursor-not-allowed opacity-75 relative wishlist-button"
            >
              <span className="text-xs sm:text-sm md:text-base">No longer available</span>
            </button>
          ) : (
            <button
              onClick={handleMoveToCart}
              disabled={isAdding || !!successMessage}
              className="w-full py-2 sm:py-2.5 md:py-3 px-4 sm:px-5 md:px-6 rounded-[10px] sm:rounded-full text-sm sm:text-base font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md relative wishlist-button"
              style={{ backgroundColor: successMessage ? '#10b981' : '#0A1D37' }}
              data-ga-event="wishlist_move_to_bag_click"
              data-ga-label={product.title || "Product"}
              onMouseEnter={(e) => {
                if (!isAdding && !successMessage) {
                  e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isAdding && !successMessage) {
                  e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              <span className="pointer-events-none flex items-center justify-center">
                {isAdding ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-3 w-3 sm:h-4 sm:w-4"
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
                    <span className="text-xs sm:text-sm">Adding...</span>
                  </span>
                ) : successMessage ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="w-3 h-3 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-xs sm:text-sm">{successMessage}</span>
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm md:text-base">Move to Bag</span>
                )}
              </span>
            </button>
          )}
        </div>

        {/* Quick Add Overlay/Modal */}
        {showQuickAdd && (
          showAsModal ? (
            <Modal isOpen={showQuickAdd} close={() => { setShowQuickAdd(false); setSelectedOptions({}); }} size="xsmall">
              <Modal.Body>
                <div className="py-2 text-left">
                  <QuickAddContent
                    product={product}
                    selectedOptions={selectedOptions}
                    setOptionValue={setOptionValue}
                    handleAddToCart={handleMoveToCart}
                    isAdding={isAdding}
                    showError={showError}
                    onClose={() => { setShowQuickAdd(false); setSelectedOptions({}); setQuantity(1); }}
                    isMobile={true}
                    selectedVariantPrice={selectedVariantPrice}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    cart={cart}
                  />
                </div>
              </Modal.Body>
            </Modal>
          ) : (
            <div
              className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-md z-[25] border-t border-gray-100 p-4 transition-all duration-300 animate-in slide-in-from-bottom shadow-2xl rounded-t-[20px] text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <QuickAddContent
                product={product}
                selectedOptions={selectedOptions}
                setOptionValue={setOptionValue}
                handleAddToCart={handleMoveToCart}
                isAdding={isAdding}
                showError={showError}
                onClose={() => { setShowQuickAdd(false); setSelectedOptions({}); setQuantity(1); }}
                isMobile={false}
                selectedVariantPrice={selectedVariantPrice}
                quantity={quantity}
                setQuantity={setQuantity}
                cart={cart}
              />
            </div>
          )
        )}
      </div>
    </>
  )
}

export default WishlistItem
