"use client"

import { addToCart } from "@lib/data/cart"
import { trackAddToCart } from "@lib/analytics/ga4-ecommerce"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
// import { Button } from "@medusajs/ui" // Removed - unused import causing badge issue
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import React, { useEffect, useMemo, useRef, useState } from "react"
import Color from "color"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { getProductPrice, getPricesForVariant } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import RatingsTab from "../product-tabs/ratings-tab"
import PincodeChecker from "@modules/cart/components/pincode-checker"
import { addToWishlist, removeFromWishlist, getWishlistProductIds } from "@lib/data/wishlist"
import LoginPopup from "@modules/common/components/login-popup"
import { updateLineItem, deleteLineItem, buyNow } from "@lib/data/cart"
import { getSizeChartForProduct } from "@lib/util/size-chart-resolver"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region?: HttpTypes.StoreRegion
  disabled?: boolean
  cart?: HttpTypes.StoreCart | null
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

function getIsVirtualSizeOption(product: any) {
  const defaultSizesStr = product.categories?.find(
    (c: any) => c.metadata?.default_sizes
  )?.metadata?.default_sizes
  
  const hasOnlyDefaultOption = product.options?.length === 1 && 
    (product.options[0].title?.toLowerCase().includes('default') || product.options[0].title === 'Default Option')
  
  if (!hasOnlyDefaultOption) return false
  if (defaultSizesStr) return true

  // Fallback for local testing
  const title = product.title?.toLowerCase() || ""
  const handle = product.handle?.toLowerCase() || ""
  const isRing = title.includes("ring") || handle.includes("ring")
  const isBracelet = title.includes("bracelet") || handle.includes("bracelet") || title.includes("bangle") || handle.includes("bangle")
  return isRing || isBracelet
}

import SidePanel from "@modules/common/components/side-panel"

import { useProductContext } from "@modules/products/context/product-context"
import { useWishlist } from "@lib/context/wishlist-context"

// ... existing imports ...

export default function ProductActions({
  product,
  region,
  disabled,
  cart,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setSelectedVariantId, setSelectedOptions } = useProductContext()

  const dynamicSizeChart = useMemo(() => {
    return getSizeChartForProduct(product)
  }, [product])

  // Find first category metadata default_sizes
  const defaultSizesStr = useMemo(() => {
    return product.categories?.find(
      (c) => c.metadata?.default_sizes
    )?.metadata?.default_sizes as string | undefined
  }, [product.categories])

  const defaultSizes = useMemo(() => {
    if (defaultSizesStr) {
      return defaultSizesStr.split(",").map((s) => s.trim())
    }
    // Fallback for local testing if no metadata exists
    const title = product.title?.toLowerCase() || ""
    const handle = product.handle?.toLowerCase() || ""
    if (title.includes("ring") || handle.includes("ring")) {
      return ["4", "5", "6", "7", "8", "10", "11", "12", "13", "14"]
    }
    if (title.includes("bracelet") || handle.includes("bracelet") || title.includes("bangle") || handle.includes("bangle")) {
      return ["6.0", "6.5", "7.0", "7.5", "8.0"]
    }
    return []
  }, [defaultSizesStr, product.title, product.handle])

  const isVirtualSizeOption = useMemo(() => {
    return getIsVirtualSizeOption(product) && defaultSizes.length > 0
  }, [product, defaultSizes])

  const virtualSizeOption = useMemo(() => {
    if (!isVirtualSizeOption) return null
    return {
      id: "virtual-size-option",
      title: "Size",
      values: defaultSizes.map((val) => ({
        id: `virtual-val-${val}`,
        value: val,
      })),
    }
  }, [isVirtualSizeOption, defaultSizes])

  const [options, setOptions] = useState<Record<string, string | undefined>>(() => {
    const isVirtual = getIsVirtualSizeOption(product)
    if (isVirtual) {
      return {}
    }

    const variantIdFromUrl = searchParams.get("v_id")

    // If there's a variant ID in URL, find and set its options
    if (variantIdFromUrl && product.variants) {
      const variantFromUrl = product.variants.find((v) => v.id === variantIdFromUrl)
      if (variantFromUrl) {
        return optionsAsKeymap(variantFromUrl.options) ?? {}
      }
    }

    // If there is only 1 variant, preselect the options
    if (product.variants?.length === 1) {
      return optionsAsKeymap(product.variants[0].options) ?? {}
    }

    // If there are multiple variants, check if any option has only one possible value
    // and auto-select it (e.g., if only one color is available)
    if (product.options) {
      const partialOptions: Record<string, string> = {}

      product.options.forEach((option) => {
        // Check unique values from option definition (what is shown to user)
        const uniqueValues = new Set(option.values?.map(v => v.value))

        if (uniqueValues.size === 1) {
          const uniqueValue = Array.from(uniqueValues)[0]
          if (uniqueValue) {
            partialOptions[option.id] = uniqueValue
          }
        }
      })

      if (Object.keys(partialOptions).length > 0) {
        return partialOptions
      }
    }
    
    return {}
  })
  const [isAdding, setIsAdding] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
  const [isMoissaniteOpen, setIsMoissaniteOpen] = useState(false)
  const [isVermeilOpen, setIsVermeilOpen] = useState(false)
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [isChooseOneOpen, setIsChooseOneOpen] = useState(false)
  const [isMaterialOpen, setIsMaterialOpen] = useState(false)
  const [isCareGuideOpen, setIsCareGuideOpen] = useState(false)
  const [isProductTypeOpen, setIsProductTypeOpen] = useState(false)
  const [activeFeature, setActiveFeature] = useState<string | null>(null)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({})
  const [showNotifyMessage, setShowNotifyMessage] = useState(false)
  const countryCode = useParams().countryCode as string

  // Keep effect to sync if URL params change externally
  useEffect(() => {
    const variantIdFromUrl = searchParams.get("v_id")
    if (variantIdFromUrl && product.variants) {
      const variantFromUrl = product.variants.find((v) => v.id === variantIdFromUrl)
      if (variantFromUrl) {
        const variantOptions = optionsAsKeymap(variantFromUrl.options) ?? {}
        setOptions((prev) => {
          const updated = { ...variantOptions }
          if (isVirtualSizeOption && prev["virtual-size-option"]) {
            updated["virtual-size-option"] = prev["virtual-size-option"]
          }
          if (isEqual(prev, updated)) return prev
          return updated
        })
        return
      }
    }
  }, [product.variants, searchParams, isVirtualSizeOption])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    if (isVirtualSizeOption) {
      return product.variants[0]
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options, isVirtualSizeOption])

  useEffect(() => {
    setSelectedOptions(options)
  }, [options, setSelectedOptions])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
    // Clear error for this option
    setValidationErrors((prev) => ({
      ...prev,
      [optionId]: false,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    if (isVirtualSizeOption) {
      return !!options["virtual-size-option"]
    }
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options, isVirtualSizeOption])

  const variantInCart = useMemo(() => {
    if (!cart || !selectedVariant) {
      return null
    }

    const item = cart.items?.find((i) => i.variant_id === selectedVariant.id)
    return item || null
  }, [cart, selectedVariant])

  const quantityInCart = useMemo(() => {
    return variantInCart?.quantity || 0
  }, [variantInCart])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If no variant selected, check if product has any variants
    if (!selectedVariant) {
      return product.variants && product.variants.length > 0
    }

    // If we don't manage inventory, we can always add to cart
    if (!selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant.allow_backorder) {
      return true
    }

    // If there is inventory available AND it is >= the selected quantity
    // We treat the inventory as total - quantity already in cart
    const totalInventory = selectedVariant.inventory_quantity || 0
    const availableQuantity = totalInventory - quantityInCart
    
    if (availableQuantity >= quantity) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant, product.variants, quantity, quantityInCart])

  // Get current inventory limit for display
  const inventoryLimit = useMemo(() => {
    if (!selectedVariant || !selectedVariant.manage_inventory || selectedVariant.allow_backorder) {
      return null
    }
    const totalInventory = selectedVariant.inventory_quantity || 0
    return totalInventory - quantityInCart
  }, [selectedVariant, quantityInCart])

  const allOptionsSelected = useMemo(() => {
    if (isVirtualSizeOption) {
      return !!options["virtual-size-option"]
    }
    return product.options
      ? product.options.every(opt => {
          const isDefault = opt.title?.toLowerCase().includes("default") || opt.title === "Default Option"
          return isDefault || !!options[opt.id]
        })
      : true
  }, [product.options, options, isVirtualSizeOption])

  const isMobileDisabled = useMemo(() => {
    if (!!disabled || isAdding || isBuyingNow) return true
    return false
  }, [disabled, isAdding, isBuyingNow])

  // Reset notification message when options change
  useEffect(() => {
    setShowNotifyMessage(false)
  }, [options])
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : undefined

    // Update Context
    setSelectedVariantId(value)

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    // Update URL silently without triggering RSC navigation
    // Use replaceState to avoid adding to history stack for variant selections
    const newUrl = pathname + "?" + params.toString()
    window.history.replaceState(null, "", newUrl)
  }, [selectedVariant, isValidVariant, pathname, searchParams, setSelectedVariantId])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  const scrollToSizeSection = () => {
    if (typeof window === "undefined") return

    requestAnimationFrame(() => {
      setTimeout(() => {
        const sizeEl =
          document.getElementById("size-selection-section") ||
          document.querySelector('[id="size-selection-section"]') ||
          document.querySelector('[data-testid="product-options"]') ||
          document.getElementById("product-options-container")

        if (sizeEl) {
          const rect = sizeEl.getBoundingClientRect()
          const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
          const absoluteElementTop = rect.top + currentScrollTop
          const elementHeight = rect.height || sizeEl.offsetHeight || 120
          const viewportHeight = window.innerHeight || 600

          // Calculate target scrollTop so size section midpoint is dead-centered in vertical viewport
          const targetTop = absoluteElementTop + (elementHeight / 2) - (viewportHeight / 2)

          window.scrollTo({
            top: Math.max(0, targetTop),
            behavior: "smooth",
          })
        }
      }, 50)
    })
  }

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    // Check for missing options
    const missingOptions: Record<string, boolean> = {}
    if (isVirtualSizeOption) {
      if (!options["virtual-size-option"]) {
        missingOptions["virtual-size-option"] = true
      }
    } else {
      product.options?.forEach(option => {
        const isDefault = option.title?.toLowerCase().includes("default") || option.title === "Default Option"
        if (!isDefault && !options[option.id]) {
          missingOptions[option.id] = true
        }
      })
    }

    if (Object.keys(missingOptions).length > 0) {
      setValidationErrors(missingOptions)
      scrollToSizeSection()
      return null
    }

    // Clear validation errors since options are valid
    setValidationErrors({})

    if (!selectedVariant?.id || !inStock || !isValidVariant) {
      scrollToSizeSection()
      return null
    }

    setIsAdding(true)

    await addToCart({
      variantId: selectedVariant.id,
      quantity: quantity,
      countryCode,
      metadata: isVirtualSizeOption ? {
        selected_size: options["virtual-size-option"]
      } : undefined
    })

    const currency = region?.currency_code?.toUpperCase() ?? "USD"
    const unitPrice = displayPrice?.calculated_price_number ?? 0
    const value = (unitPrice * quantity) / 100
    trackAddToCart({
      currency,
      value,
      items: [
        {
          item_id: selectedVariant.id,
          item_name: product.title ?? "",
          price: unitPrice / 100,
          quantity,
          item_variant: isVirtualSizeOption ? `Size: ${options["virtual-size-option"]}` : (selectedVariant.title ?? undefined),
        },
      ],
    })

    setIsAdding(false)
  }

  const handleBuyNow = async () => {
    // Check for missing options
    const missingOptions: Record<string, boolean> = {}
    if (isVirtualSizeOption) {
      if (!options["virtual-size-option"]) {
        missingOptions["virtual-size-option"] = true
      }
    } else {
      product.options?.forEach(option => {
        const isDefault = option.title?.toLowerCase().includes("default") || option.title === "Default Option"
        if (!isDefault && !options[option.id]) {
          missingOptions[option.id] = true
        }
      })
    }

    if (Object.keys(missingOptions).length > 0) {
      setValidationErrors(missingOptions)
      scrollToSizeSection()
      return null
    }

    // Clear validation errors since options are valid
    setValidationErrors({})

    if (!selectedVariant?.id || !inStock || !isValidVariant) {
      scrollToSizeSection()
      return null
    }
    
    setIsBuyingNow(true)

    try {
      await buyNow({
        variantId: selectedVariant.id,
        quantity: quantity,
        countryCode,
        metadata: isVirtualSizeOption ? {
          selected_size: options["virtual-size-option"]
        } : undefined
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsBuyingNow(false)
    }
  }

  const handleIncreaseQuantity = async () => {
    if (!variantInCart || isAdding) return
    setIsAdding(true)
    try {
      await updateLineItem({
        lineId: variantInCart.id,
        quantity: variantInCart.quantity + 1,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsAdding(false)
    }
  }

  const handleDecreaseQuantity = async () => {
    if (!variantInCart || isAdding) return
    setIsAdding(true)
    try {
      if (variantInCart.quantity > 1) {
        await updateLineItem({
          lineId: variantInCart.id,
          quantity: variantInCart.quantity - 1,
        })
      } else {
        await deleteLineItem(variantInCart.id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsAdding(false)
    }
  }

  // Get color option
  const colorOption = useMemo(() => {
    return product.options?.find(opt =>
      opt.title?.toLowerCase().includes('color') ||
      opt.title?.toLowerCase().includes('colour')
    )
  }, [product.options])

  // Get color variants for MORE COLORS section
  const colorVariants = useMemo(() => {
    if (!product.variants || !colorOption) return []

    const uniqueColors = new Map()
    product.variants.forEach(variant => {
      const colorValue = variant.options?.find(opt => opt.option_id === colorOption.id)?.value
      if (colorValue && !uniqueColors.has(colorValue)) {
        uniqueColors.set(colorValue, variant)
      }
    })
    return Array.from(uniqueColors.values())
  }, [product.variants, colorOption])

  // Get currently selected color value
  const selectedColorValue = useMemo(() => {
    if (!colorOption) return null
    return options[colorOption.id]
  }, [options, colorOption])

  // Get size option
  const sizeOption = useMemo(() => {
    if (isVirtualSizeOption) return virtualSizeOption
    return product.options?.find(opt =>
      opt.title?.toLowerCase().includes('size')
    )
  }, [isVirtualSizeOption, virtualSizeOption, product.options])

  // Get price for selected variant - updates when variant changes
  const displayPrice = useMemo(() => {
    // If a variant is selected, use its price
    if (selectedVariant) {
      const variantPrice = getPricesForVariant(selectedVariant)
      if (variantPrice) {
        return variantPrice
      }
    }

    // Fallback to getProductPrice for cheapest price
    const { cheapestPrice } = getProductPrice({ product })
    return cheapestPrice
  }, [selectedVariant, product])

  // Calculate discount if original price exists
  const originalPrice = displayPrice?.original_price_number
  const currentPrice = displayPrice?.calculated_price_number
  const discountPercentage = originalPrice && currentPrice && originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : null

  return (
    <>
      <div id="product-options-container" className="flex flex-col gap-4 sm:gap-5 min-[768px]:gap-4 min-[1023px]:gap-4 min-[1024px]:gap-6 min-[1200px]:gap-6 min-[1360px]:gap-6 w-full" ref={actionsRef}>
        {/* In-Cart Status (Price is displayed above title) */}
        {quantityInCart > 0 && (
          <div className="flex items-center justify-end pt-2 border-t border-gray-200">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-[11px] font-black rounded-full border border-green-100 shadow-sm animate-in fade-in zoom-in-95 duration-500 uppercase tracking-tighter">
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span>{quantityInCart} <span className="hidden sm:inline">ITEM{quantityInCart > 1 ? 'S' : ''}</span> IN BAG</span>
            </div>
          </div>
        )}
        {/* COLOR Section */}
        {colorOption && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm min-[768px]:text-sm font-semibold text-gray-900 uppercase">
                {colorVariants.length > 0 ? "More Colors" : `Select ${colorOption.title}`}
              </h3>
              {validationErrors[colorOption.id] && (
                <span className="text-[10px] text-red-600 font-black uppercase tracking-wider animate-pulse border-l-2 border-red-600 pl-2">
                  Please Select {String(colorOption.title || "")}
                </span>
              )}
            </div>
            {colorVariants.length > 0 ? (
              <div className="flex gap-2 sm:gap-3 min-[768px]:gap-3 overflow-x-auto pb-2 transition-all duration-300">
                {colorVariants.map((variant) => {
                  const variantImage =
                    (variant.metadata?.image as string) ||
                    (variant.metadata?.thumbnail as string) ||
                    (variant.metadata?.color_image as string) ||
                    (variant.metadata?.variant_image as string) ||
                    variant.thumbnail ||
                    variant.images?.[0]?.url ||
                    product.thumbnail
                  const variantColorValue = variant.options?.find((opt: any) => opt.option_id === colorOption.id)?.value
                  const isSelected = variantColorValue === selectedColorValue

                  // Get color for the bottom strip using metadata or library
                  let stripColor = (variant.metadata?.color_hex as string) || null
                  if (!stripColor && variantColorValue) {
                    try {
                      // Try parsing the original color name (handles things like "darkgreen")
                      stripColor = Color(variantColorValue.toLowerCase().replace(/\s+/g, '')).hex()
                    } catch (e) {
                      try {
                        // Try parsing without modification
                        stripColor = Color(variantColorValue).hex()
                      } catch (e2) {
                        stripColor = null
                      }
                    }
                  }

                  return (
                    <button
                      key={variant.id}
                      className={`w-12 h-14 sm:w-16 sm:h-[4.5rem] rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 flex flex-col ${isSelected
                        ? 'border-gold-accent ring-2 ring-gold-accent/30'
                        : 'border-gray-200 hover:border-gold-accent/50'
                        }`}
                      onClick={() => {
                        if (colorOption && variantColorValue) {
                          setOptions((prev) => ({
                            ...prev,
                            [colorOption.id]: variantColorValue,
                          }))
                          setValidationErrors((prev) => ({
                            ...prev,
                            [colorOption.id]: false,
                          }))
                        }
                      }}
                    >
                      <div className="flex-1 w-full relative overflow-hidden">
                        {variantImage && (
                          <Image
                            src={variantImage}
                            alt={`Color variant: ${variantColorValue || 'Unknown'}`}
                            fill
                            sizes="(max-width: 768px) 48px, 64px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      {stripColor && (
                        <div
                          className="h-2 w-full border-t border-gray-100"
                          style={{ backgroundColor: stripColor }}
                          title={variantColorValue}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <OptionSelect
                option={colorOption}
                current={options[colorOption.id]}
                updateOption={setOptionValue}
                title={colorOption.title ?? ""}
                data-testid="product-options"
                disabled={!!disabled || isAdding}
                error={validationErrors[colorOption.id]}
              />
            )}
          </div>
        )}

        {/* SIZE Section */}
        {sizeOption && (
          <div id="size-selection-section" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm min-[768px]:text-sm font-semibold text-gray-900 uppercase">Select Size</h3>
                {validationErrors[sizeOption.id] && (
                  <span className="text-[10px] text-red-600 font-black uppercase tracking-wider animate-pulse border-l-2 border-red-600 pl-2">
                    Please Select {String(sizeOption.title || "")}
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveFeature('size_chart')}
                className="flex items-center gap-1.5 text-xs sm:text-sm min-[768px]:text-sm font-medium hover:opacity-80 transition-opacity text-gold-accent"
              >
                <Image src="/Size Chart.svg" alt="Size Chart" width={16} height={16} />
                Size Chart
              </button>
            </div>
            <OptionSelect
              option={sizeOption}
              current={options[sizeOption.id]}
              updateOption={setOptionValue}
              title={sizeOption.title ?? ""}
              data-testid="product-options"
              disabled={!!disabled || isAdding}
              error={validationErrors[sizeOption.id]}
            />
          </div>
        )}

        {/* Other Options (if any) */}
        {(product.options || []).filter(opt => {
          const isColor = opt.title?.toLowerCase().includes('color') || opt.title?.toLowerCase().includes('colour')
          const isSize = opt.title?.toLowerCase().includes('size')
          const isDefault = opt.title?.toLowerCase().includes('default') || opt.title === 'Default Option'
          return !isColor && !isSize && !isDefault
        })
          .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
          .map((option) => {
            return (
              <div key={option.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm min-[768px]:text-sm font-semibold text-gray-900 uppercase">Select {String(option.title || "")}</h3>
                  {validationErrors[option.id] && (
                    <span className="text-[10px] text-red-600 font-black uppercase tracking-wider animate-pulse border-l-2 border-red-600 pl-2">
                      Please Select {String(option.title || "")}
                    </span>
                  )}
                </div>
                <OptionSelect
                  option={option}
                  current={options[option.id]}
                  updateOption={setOptionValue}
                  title={option.title ?? ""}
                  data-testid="product-options"
                  disabled={!!disabled || isAdding}
                  error={validationErrors[option.id]}
                />
              </div>
            )
          })}

        {/* QUANTITY Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm min-[768px]:text-sm font-semibold text-gray-900 uppercase">Quantity</h3>
            {inventoryLimit !== null && inventoryLimit > 0 && inventoryLimit <= 5 && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2h4"></path>
                  <path d="M12 14v-4"></path>
                  <path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-8 7z"></path>
                  <path d="M2 9h3"></path>
                  <path d="M2 12h2"></path>
                  <path d="M2 15h3"></path>
                </svg>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-orange-600">
                  Hurry! Only {inventoryLimit} left in stock
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center border border-gray-300 rounded-[30px] overflow-hidden bg-white w-[141px]">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <span className="flex-1 text-center font-semibold text-gray-900 py-2">{quantity}</span>
            <button
              onClick={() => {
                if (inventoryLimit === null || inventoryLimit <= 0 || quantity < inventoryLimit) {
                  setQuantity(quantity + 1)
                }
              }}
              disabled={inventoryLimit !== null && inventoryLimit > 0 && quantity >= inventoryLimit}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          {inventoryLimit !== null && inventoryLimit > 0 && quantity >= inventoryLimit && (
            <p className="text-[10px] text-red-600 font-medium">Maximum available stock reached</p>
          )}
        </div>


        {/* Action Buttons (Desktop Only - Mobile uses fixed sticky bottom bar) */}
        <div className="hidden lg:flex flex-col gap-3 w-full max-w-full">
          {!inStock && selectedVariant ? (
            <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* Out of Stock Status Indicator */}
              <div className="flex items-center gap-3 text-gold-accent bg-[#FAF5FF] px-4 py-3 rounded-2xl border border-gold-accent/10 shadow-sm">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-accent/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest leading-none mb-0.5">Out of Stock</span>
                  <span className="text-[11px] text-gold-accent/70 font-medium leading-none">Restocking soon — check back shortly!</span>
                </div>
              </div>

              {showNotifyMessage ? (
                /* Premium Success Box */
                <div className="bg-[#FAF5FF] p-6 rounded-2xl border-2 border-dashed border-gold-accent/20 flex flex-col gap-4 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-royal-blue flex items-center justify-center text-white shadow-lg shadow-gold-accent/10">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-royal-blue leading-none mb-1">Request Received!</h4>
                      <p className="text-[11px] text-gold-accent/70 font-medium uppercase tracking-wider">Back-in-stock alert active</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: '#4B2A6B' }}>
                    This piece is currently out of stock. We&apos;ll notify you the moment it&apos;s available again.
                  </p>
                  <button
                    onClick={() => {
                      const relatedSection = document.getElementById('related-products')
                      if (relatedSection) {
                        relatedSection.scrollIntoView({ behavior: 'smooth' })
                      } else {
                        router.push('/store')
                      }
                    }}
                    className="w-full sm:w-fit py-2.5 px-6 rounded-full bg-white border border-gold-accent/20 text-sm font-bold text-gold-accent shadow-sm hover:shadow-md hover:bg-gold-accent/10 transition-all flex items-center justify-center gap-2 group"
                  >
                    <span>Find Similar Favorites</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-1 transition-transform">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-row gap-2.5 sm:gap-3 w-full">
                  <button
                    onClick={() => setShowNotifyMessage(true)}
                    className="h-12 rounded-[30px] font-bold text-white flex items-center justify-center gap-1.5 sm:gap-2 transition-all w-full shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transform px-2 sm:px-4 bg-royal-blue"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 sm:w-5 sm:h-5">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span className="text-[12px] sm:text-base leading-tight truncate">
                      <span className="hidden sm:inline">Notify Me When Available</span>
                      <span className="inline sm:hidden">Notify Me</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-row gap-3 w-full items-end">
              {variantInCart ? (
                /* Flipkart Style Quantity Manager Button Container */
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="text-[11px] font-black text-gold-accent uppercase tracking-[0.1em] px-1 flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-royal-blue"></div>
                    Manage Quantity
                  </div>
                  <div 
                    className="h-12 rounded-[30px] font-semibold text-white flex items-center justify-between transition-all w-full overflow-hidden shadow-md bg-royal-blue"
                  >
                    <button
                      onClick={handleDecreaseQuantity}
                      disabled={isAdding}
                      className="w-12 h-full flex items-center justify-center hover:bg-black/10 active:bg-black/20 transition-colors disabled:opacity-50"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    
                    <div className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 min-w-0">
                       <Image src="/cart.svg" alt="Cart" width={16} height={16} className="brightness-0 invert flex-shrink-0" />
                       <span className="text-[14px] sm:text-[16px] font-black tracking-tighter sm:tracking-tight truncate">
                         <span className="inline sm:hidden">{variantInCart.quantity} IN BAG</span>
                         <span className="hidden sm:inline">{variantInCart.quantity} {variantInCart.quantity > 1 ? 'ITEMS' : 'ITEM'} IN BAG</span>
                       </span>
                    </div>

                    <button
                      onClick={handleIncreaseQuantity}
                      disabled={isAdding || !inStock}
                      className="w-12 h-full flex items-center justify-center hover:bg-black/10 active:bg-black/20 transition-colors disabled:opacity-50"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={
                    !!disabled ||
                    isAdding ||
                    isBuyingNow
                  }
                  className="h-12 rounded-[30px] font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 min-w-0 bg-royal-blue"
                  onMouseEnter={(e) => {
                    if (!disabled && !isAdding && !isBuyingNow && inStock && (isValidVariant || !product.options?.every(opt => options[opt.id]))) {
                      e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!disabled && !isAdding && !isBuyingNow && inStock) {
                      e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
                    }
                  }}
                  data-testid="add-product-button"
                  data-ga-event="add_to_bag_click"
                  data-ga-label={product.title || "Product"}
                >
                  {isAdding ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <>
                      <Image src="/cart.svg" alt="Cart" width={20} height={20} className="brightness-0 invert" />
                      {!selectedVariant || !isValidVariant
                        ? product.options?.every(opt => options[opt.id]) ? "Not Available" : "Select variant"
                        : !inStock
                          ? (inventoryLimit !== null && (inventoryLimit + quantityInCart) > 0 && quantity > inventoryLimit) 
                            ? (inventoryLimit <= 0 ? "Out of stock" : "No More Stock") 
                            : "Out of stock"
                          : `Add to Bag${quantity > 1 ? ` (${quantity})` : ''}`}
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleBuyNow}
                disabled={
                  !!disabled ||
                  isAdding ||
                  isBuyingNow
                }
                className="h-12 flex-1 rounded-[30px] font-semibold text-gray-900 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] text-base group min-w-0 border border-gold-accent"
                style={{
                  backgroundColor: '#FAF5FF',
                  opacity: (!inStock || !!disabled || isAdding || isBuyingNow) ? 0.6 : 1
                }}
              >
                {isBuyingNow ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <div className="bg-gold-accent/10 p-1.5 rounded-full group-hover:scale-110 transition-transform border border-gold-accent/10">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1.5"></circle>
                        <circle cx="20" cy="21" r="1.5"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                      </svg>
                    </div>
                    <span>Buy Now</span>
                  </>
                )}
              </button>
            </div>
            </>
          )}
        </div>

        {/* Guarantee Safe Checkout */}
        <div className="relative border border-gray-200 rounded-2xl p-4 bg-white mt-6 mb-4">
          <div className="absolute left-1/2 -top-3 transform -translate-x-1/2 bg-ivory-bg px-3 text-xs sm:text-sm font-bold text-gray-700 whitespace-nowrap">
            Guarantee safe checkout
          </div>
          <div className="w-full flex justify-center mt-1">
            <img 
              src="/product-page/guarantee-safe-checkout.avif" 
              alt="Guarantee safe checkout" 
              className="w-full max-w-full h-auto object-contain px-1 sm:px-2" 
            />
          </div>
        </div>

        {/* Pincode Checker Section */}
        <div className="mt-0.5 sm:-mt-1.5 mb-0">
          <PincodeChecker variantId={selectedVariant?.id} />
        </div>

        {/* Service Features Section */}
        <div className="flex flex-row overflow-x-auto no-scrollbar py-4 border-t border-gray-200 gap-4 min-[500px]:gap-0 min-[500px]:justify-between min-[500px]:overflow-visible">
          {/* 7 Days Easy Return */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[120px] min-[500px]:flex-1 min-[500px]:min-w-0 group">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/Return.svg" alt="Return" width={28} height={26} />
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveFeature('return')}>
              <span className="text-xs text-gray-800 font-medium text-center whitespace-nowrap leading-none">7 Days Easy Return</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-gray-600 group-hover:text-gold-accent transition-colors relative top-[-0.5px]">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>

          {/* Separator */}
          <div className="hidden min-[500px]:block w-px h-12 bg-gray-200 flex-shrink-0"></div>

          {/* Fast Delivery */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[120px] min-[500px]:flex-1 min-[500px]:min-w-0 group">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/delivery.svg" alt="Delivery" width={30} height={18} />
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveFeature('delivery')}>
              <span className="text-xs text-gray-800 font-medium text-center whitespace-nowrap leading-none">Fast Delivery</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-gray-600 group-hover:text-gold-accent transition-colors relative top-[-0.5px]">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>

          {/* Separator */}
          <div className="hidden min-[500px]:block w-px h-12 bg-gray-200 flex-shrink-0"></div>

          {/* Cash On Delivery Available */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[120px] min-[500px]:flex-1 min-[500px]:min-w-0 group">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/Cod.svg" alt="COD" width={30} height={18} />
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveFeature('cod')}>
              <span className="text-xs text-gray-800 font-medium text-center whitespace-nowrap leading-none">Cash On Delivery Available</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-gray-600 group-hover:text-gold-accent transition-colors relative top-[-0.5px]">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Product Highlights Section - Refined Design */}
        <div className="flex flex-col gap-6 py-10 border-t border-gray-100/80 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-royal-blue to-gold-accent"></div>
            <h3 className="text-sm sm:text-base font-black text-gray-800 uppercase tracking-[0.2em]">Product highlights</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-2">
            {(() => {
              // Extract unique colors from variants/options instead of metadata
              const colorOpt = product.options?.find(opt => 
                opt.title?.toLowerCase().includes('color') || 
                opt.title?.toLowerCase().includes('colour')
              )
              const variantColors = colorOpt?.values?.map(v => v.value).filter(Boolean) || []
              const uniqueColors = Array.from(new Set(variantColors))
              const colorValue = uniqueColors.length > 0 ? uniqueColors.join(', ') : null

              const highlights = [
                { id: 'type', label: "Type", value: product.metadata?.product_type, icon: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z' },
                { id: 'occasion', label: "Occasion", value: product.metadata?.occasion, icon: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z' },
                { id: 'material', label: "Material", value: product.metadata?.material, icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
                { id: 'gender', label: "Gender", value: product.metadata?.gender, icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
                { id: 'color', label: "Available Colors", value: colorValue, icon: 'M12 2.25l-7.5 12.13a6.75 6.75 0 1015 0L12 2.25z' },
              ].filter(h => h.value)

              return highlights.map((highlight) => (
                <div 
                  key={highlight.id} 
                  className={clx(
                    "group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(139,90,177,0.15)] hover:border-gold-accent/10 hover:-translate-y-1 transition-all duration-300",
                    highlight.id === 'color' && "col-span-2"
                  )}
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FAF5FF] flex items-center justify-center group-hover:bg-gold-accent/10 transition-all duration-300 shadow-inner overflow-hidden">
                    {highlight.id === 'color' ? (
                      <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="transform group-hover:scale-110 transition-transform duration-300">
                        {/* Palette Body */}
                        <path d="M75 55c0 15-12 27-27 27S21 70 21 55s12-27 27-27 27 12 27 27z" fill="#E8B088" stroke="#333" strokeWidth="3" />
                        
                        {/* Color Dots */}
                        <circle cx="40" cy="45" r="5" fill="#FF4D4D" stroke="#333" strokeWidth="1.5" /> {/* Red */}
                        <circle cx="56" cy="46" r="5" fill="#2ECC71" stroke="#333" strokeWidth="1.5" /> {/* Green */}
                        <circle cx="42" cy="62" r="5" fill="#3498DB" stroke="#333" strokeWidth="1.5" /> {/* Blue */}
                        <circle cx="58" cy="64" r="5" fill="#F06292" stroke="#333" strokeWidth="1.5" /> {/* Pink */}
                        
                        {/* Brush */}
                        <g transform="rotate(25 70 40)">
                          <rect x="68" y="15" width="6" height="35" rx="3" fill="#F39C12" stroke="#333" strokeWidth="2" /> {/* Handle */}
                          <path d="M68 12c0-4 3-8 3-8s3 4 3 8H68z" fill="#AED6F1" stroke="#333" strokeWidth="2" /> {/* Tip */}
                          <rect x="68" y="45" width="6" height="4" fill="#BDC3C7" stroke="#333" strokeWidth="1.5" /> {/* Ferrule */}
                        </g>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-gold-accent">
                        <path d={highlight.icon} />
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-800 uppercase tracking-widest mb-0.5 sm:mb-1">{highlight.label}</span>
                    <div className="flex items-center gap-2">
                      {highlight.id === 'color' ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {String(highlight.value || '').split(/[,\s]+/).map((color, i) => {
                            const trimmedColor = color.trim().toLowerCase()
                            if (!trimmedColor) return null
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <div 
                                  className="w-3.5 h-3.5 rounded-full border border-gray-100 shadow-sm"
                                  style={{ backgroundColor: trimmedColor }}
                                />
                                <span className="text-sm text-gray-800 font-semibold capitalize leading-none tracking-tight">{trimmedColor}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-gray-800 font-semibold capitalize tracking-tight truncate">
                          {String(highlight.value || '').replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* Feature Modal / Drawer */}
        <SidePanel
          isOpen={!!activeFeature}
          onClose={() => setActiveFeature(null)}
          title={
            activeFeature === 'return' ? '7 Days Easy Return' :
              activeFeature === 'delivery' ? 'Fast Delivery' :
                activeFeature === 'cod' ? 'Cash On Delivery' :
                  activeFeature === 'size_chart' ? (dynamicSizeChart?.title || 'Size Guide') : ''
          }
        >
          {activeFeature === 'return' && (
            <div className="space-y-6">
              <div className="bg-gold-accent/10 p-4 rounded-xl border border-gold-accent/10">
                <p className="text-sm text-royal-blue leading-relaxed font-medium">
                  We offer a hassle-free 7-day return policy for all our customers. If you're not satisfied with your purchase, we're here to help!
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-gray-700">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Unused Conditions</h4>
                    <p className="text-sm text-gray-600">Items must be returned in their original condition, unused, and with all tags intact.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-gray-700">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Easy Process</h4>
                    <p className="text-sm text-gray-600">Raise a return request from your account or contact our support team directly.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-gray-700">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Quick Refund</h4>
                    <p className="text-sm text-gray-600">Once the quality check is completed, your refund will be processed within 24–48 hours. The amount may take a few business days to reflect in your account depending on your bank.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFeature === 'delivery' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-900 leading-relaxed font-medium">
                  We prioritize your excitement! Our fast delivery network ensures your order reaches you as soon as possible.
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                      <path d="M12 2v20m10-10H2"></path>
                    </svg>
                    Order Processing
                  </h4>
                  <p className="text-sm text-gray-600 pl-7">Most orders are processed and dispatched within 24 hours of placement.</p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Average Timelines
                  </h4>
                  <ul className="text-sm text-gray-600 pl-7 space-y-2 list-disc">
                    <li>Metro Cities: 2-3 business days</li>
                    <li>Tier 2 Cities: 4-5 business days</li>
                    <li>Rest of India: 5-7 business days</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    Live Tracking
                  </h4>
                  <p className="text-sm text-gray-600 pl-7">You will receive a real-time tracking link via Email & WhatsApp once your order is shipped.</p>
                </div>
              </div>
            </div>
          )}

          {activeFeature === 'cod' && (
            <div className="space-y-6">
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-sm text-green-900 leading-relaxed font-medium">
                  Shop with confidence! Pay only when you receive your package at your doorstep.
                </p>
              </div>
              <div className="space-y-5">
                <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 flex items-center justify-center bg-ivory-bg rounded-lg shadow-sm flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                      <line x1="2" y1="10" x2="22" y2="10"></line>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Zero Upfront Cost</h4>
                    <p className="text-xs text-gray-500">No need for credit cards or online payments to place your order.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 flex items-center justify-center bg-ivory-bg rounded-lg shadow-sm flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Safe & Secure</h4>
                    <p className="text-xs text-gray-500">Verify your package and then pay our delivery partner directly.</p>
                  </div>
                </div>
                <ul className="text-xs text-gray-500 italic space-y-1 pl-4 list-disc">
                  <li>
                    Available for orders up to{" "}
                    {convertToLocale({
                      amount: 10000,
                      currency_code:
                        region?.currency_code ||
                        displayPrice?.currency_code ||
                        "inr",
                    })}
                    .
                  </li>
                  <li>Please keep the exact change ready for a smoother experience.</li>
                  <li>Only cash payments are accepted for COD.</li>
                </ul>
              </div>
            </div>
          )}

          {activeFeature === 'size_chart' && (
            <div className="flex flex-col h-full space-y-6">
              {/* Tip Section */}
              {dynamicSizeChart?.tip && (
                <div className="bg-gradient-to-r from-ivory-bg to-ivory-bg p-4 rounded-xl border border-gold-accent/20 flex gap-3 shadow-sm">
                  <div className="text-xl flex-shrink-0">💡</div>
                  <div className="flex-1">
                    <h4 className="text-royal-blue font-bold text-xs uppercase tracking-wider mb-1">Pro Tip</h4>
                    <p className="text-xs text-royal-blue leading-relaxed font-medium">
                      {dynamicSizeChart.tip}
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic Section Tables */}
              <div className="space-y-8">
                {dynamicSizeChart?.sections?.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-3">
                    {section.title && (
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gold-accent flex-shrink-0" />
                        <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                          {section.title}
                        </h4>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white shadow-xs">
                      <table className="w-full text-xs sm:text-sm text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/90 border-b border-gray-200/80">
                            {section.headers?.map((head, hIdx) => (
                              <th
                                key={hIdx}
                                className={clx(
                                  "p-3.5 font-bold text-gray-900 text-xs uppercase tracking-wider",
                                  hIdx > 0 && "text-center"
                                )}
                              >
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-ivory-bg">
                          {section.rows?.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-gold-accent/10 transition-colors">
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={clx(
                                    "p-3.5 font-medium text-gray-800",
                                    cIdx === 0 ? "font-semibold text-gray-900 whitespace-nowrap" : "text-center text-gray-600"
                                  )}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SidePanel>



        {/* Accordions Section */}
        
        {/* Why choose Moissanite ? */}
        <div className="flex flex-col gap-3 py-4 border-b border-gray-200">
          <button
            onClick={() => setIsMoissaniteOpen(!isMoissaniteOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-base sm:text-lg font-medium text-gray-900">Why choose Moissanite ?</span>
            {isMoissaniteOpen ? (
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M0 1H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
          {isMoissaniteOpen && (
            <div className="text-sm text-gray-800 space-y-4 pt-2">
              <ul className="space-y-3">
                <li>
                  <strong className="text-gray-900 font-semibold">Durability:</strong> Has a hardness ranking of 9.50 on Mohs&apos; scale. They last forever like a diamond.
                </li>
                <li>
                  <strong className="text-gray-900 font-semibold">Brilliance:</strong> Very high brilliance with a refractive index of 2.65. Shines and sparkle just like a diamond.
                </li>
                <li>
                  <strong className="text-gray-900 font-semibold">Clarity & colour:</strong> All Cultura Jewels Moissanite are in VVS. Excellent clarity and no visible flaws and are DEF Colour (Colourless).
                </li>
                <li>
                  <strong className="text-gray-900 font-semibold">Appearance:</strong> Even a professional jeweller can&apos;t tell the difference with an earth-mined diamond.
                </li>
                <li>
                  <strong className="text-gray-900 font-semibold">Affordability:</strong> Affordable. Can cost up to 90% less than diamond.
                </li>
              </ul>
              <div className="bg-[#FAF5FF] p-3 rounded-xl border border-gold-accent/15 text-xs text-[#5D3A7A] leading-relaxed">
                <span className="font-bold uppercase tracking-wider block mb-1">Note:</span>
                We authenticate and verify the quality of each Moissanite that we sell. GRA graded stones have been very reliable & GRA Certificate only comes with Big pieces (More than 0.6 carat).
              </div>
            </div>
          )}
        </div>

        {/* What is Gold Vermeil? */}
        <div className="flex flex-col gap-3 py-4 border-b border-gray-200">
          <button
            onClick={() => setIsVermeilOpen(!isVermeilOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-base sm:text-lg font-medium text-gray-900">What is Gold Vermeil?</span>
            {isVermeilOpen ? (
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M0 1H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
          {isVermeilOpen && (
            <div className="w-full my-2">
              <img 
                src="/product-page/gold-vermeil.avif" 
                alt="What is Gold Vermeil?" 
                className="w-full h-auto rounded-2xl"
              />
            </div>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <div className="flex flex-col gap-3 py-4 border-b border-gray-200">
            <button
              onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-base sm:text-lg font-medium text-gray-900">Description</span>
              {isDescriptionOpen ? (
                <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                  <path d="M0 1H14" stroke="currentColor" strokeWidth="2"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                  <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )}
            </button>
            {isDescriptionOpen && (
              <div className="text-sm text-gray-800 leading-relaxed pt-2 space-y-6">
                <div
                  className="mb-4 whitespace-pre-line font-medium"
                  dangerouslySetInnerHTML={{
                    __html: product.description || ""
                    /* 
                    Fallback description kept as comment:
                    || "Embrace a touch of vintage charm with this engagement ring featuring graceful curves. A Princess moissanite takes center stage in four prongs, while accents flow elegantly. Set in luxurious 14K gold, these beautiful lines are crafted for a woman of undeniable beauty. Available in yellow gold with a total weight of 1.03 ctw."
                    */
                  }}
                />
                
                
                {/* 
                Static tables commented out as requested:

                // ITEM DETAILS
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-[13px] uppercase tracking-wider">Item Details</h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500 w-1/2">SKU</td>
                          <td className="p-3 text-gray-900 w-1/2 font-medium">product.variants?.[0]?.sku || "SSRL-0001"</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Style ID</td>
                          <td className="p-3 text-gray-900 font-medium">SSRL-0001</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Count</td>
                          <td className="p-3 text-gray-900 font-medium">21</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Metal Type & Color</td>
                          <td className="p-3 text-gray-900 font-medium">14K Yellow Gold Plated</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Average Band Width</td>
                          <td className="p-3 text-gray-900 font-medium">2.32mm</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Setting Height</td>
                          <td className="p-3 text-gray-900 font-medium">6.93mm</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                // MAIN STONE
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-[13px] uppercase tracking-wider">Main Stone</h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500 w-1/2">Stone Shape</td>
                          <td className="p-3 text-gray-900 w-1/2 font-medium">Square</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut</td>
                          <td className="p-3 text-gray-900 font-medium">Princess</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Clarity</td>
                          <td className="p-3 text-gray-900 font-medium">IF - VS1</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Dimension</td>
                          <td className="p-3 text-gray-900 font-medium">5.5mm</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.90 CTW DEW</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Count</td>
                          <td className="p-3 text-gray-900 font-medium">1</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Carat Total Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.90 CTW DEW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                // STONE 2
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-[13px] uppercase tracking-wider">Stone 2</h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500 w-1/2">Stone Shape</td>
                          <td className="p-3 text-gray-900 w-1/2 font-medium">Round</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut</td>
                          <td className="p-3 text-gray-900 font-medium">Modified Brilliant</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut Grade</td>
                          <td className="p-3 text-gray-900 font-medium">Excellent</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Clarity</td>
                          <td className="p-3 text-gray-900 font-medium">IF - VS1</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Dimension</td>
                          <td className="p-3 text-gray-900 font-medium">1.3mm</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.01 CTW DEW</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Count</td>
                          <td className="p-3 text-gray-900 font-medium">4</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Carat Total Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.04 CTW DEW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                // STONE 3
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-[13px] uppercase tracking-wider">Stone 3</h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500 w-1/2">Stone Shape</td>
                          <td className="p-3 text-gray-900 w-1/2 font-medium">Round</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut</td>
                          <td className="p-3 text-gray-900 font-medium">Modified Brilliant</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut Grade</td>
                          <td className="p-3 text-gray-900 font-medium">Excellent</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Clarity</td>
                          <td className="p-3 text-gray-900 font-medium">IF - VS1</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Dimension</td>
                          <td className="p-3 text-gray-900 font-medium">1.2mm</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.008 CTW DEW</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Count</td>
                          <td className="p-3 text-gray-900 font-medium">2</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Carat Total Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.02 CTW DEW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                // STONE 4
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-[13px] uppercase tracking-wider">Stone 4</h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500 w-1/2">Stone Shape</td>
                          <td className="p-3 text-gray-900 w-1/2 font-medium">Round</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut</td>
                          <td className="p-3 text-gray-900 font-medium">Modified Brilliant</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut Grade</td>
                          <td className="p-3 text-gray-900 font-medium">Excellent</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Clarity</td>
                          <td className="p-3 text-gray-900 font-medium">IF - VS1</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Dimension</td>
                          <td className="p-3 text-gray-900 font-medium">1.1mm</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.007 CTW DEW</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Count</td>
                          <td className="p-3 text-gray-900 font-medium">4</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Carat Total Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.03 CTW DEW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                // STONE 5
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-[13px] uppercase tracking-wider">Stone 5</h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500 w-1/2">Stone Shape</td>
                          <td className="p-3 text-gray-900 w-1/2 font-medium">Round</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut</td>
                          <td className="p-3 text-gray-900 font-medium">Modified Brilliant</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Cut Grade</td>
                          <td className="p-3 text-gray-900 font-medium">Excellent</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Clarity</td>
                          <td className="p-3 text-gray-900 font-medium">IF - VS1</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Dimension</td>
                          <td className="p-3 text-gray-900 font-medium">1.0mm</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.005 CTW DEW</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Stone Count</td>
                          <td className="p-3 text-gray-900 font-medium">10</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">Carat Total Weight**</td>
                          <td className="p-3 text-gray-900 font-medium">0.05 CTW DEW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                // FOOTNOTE
                <p className="text-xs text-gray-500 italic mt-4 leading-relaxed border-t border-gray-100 pt-3">
                  **Carats are the traditional measuring unit of a gemstone’s weight. Moissanite weighs approximately 10% less than a diamond of the same diameter. When describing our moissanite gems, we use a Diamond Equivalent Weight (DEW) to give customers a comparative estimate of gemstone size.
                </p>
                */}
              </div>
            )}
          </div>
        )}

        {/* Return & Exchange Policies */}
        <div className="flex flex-col gap-3 py-4 border-b border-gray-200">
          <button
            onClick={() => setIsReturnOpen(!isReturnOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-base sm:text-lg font-medium text-gray-900">Return & Exchange Policies</span>
            {isReturnOpen ? (
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M0 1H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
          {isReturnOpen && (
            <div className="text-sm text-gray-800 space-y-6 pt-2">
              {/* Silver Policy */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1 text-base">Silver Policy:</h4>
                <p>We have a 7 days return policy, which means you have 7 days after receiving your item to request a return.</p>
                <p>To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging. You’ll also need the receipt or proof of purchase.</p>
                <p>
                  To start a return, you can contact us at <a href="mailto:team.aneeverse@gmail.com" className="text-royal-blue hover:underline">team.aneeverse@gmail.com</a>. Please note that returns will need to be sent to the following address:
                </p>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200/60 font-medium text-xs w-full max-w-sm">
                  Cultura Jewels<br />
                  Office No. 03, Plot No. 45, near HP Petrol Pump, Seawoods West, Sector 44, Seawoods, Navi Mumbai, Maharashtra 400706
                </div>
                <p>If your return is accepted, we’ll send you a return shipping label, as well as instructions on how and where to send your package. Items sent back to us without first requesting a return will not be accepted.</p>
                <p>You can always contact us for any return question at <a href="mailto:team.aneeverse@gmail.com" className="text-royal-blue hover:underline">team.aneeverse@gmail.com</a>.</p>
              </div>

              {/* Damages and issues */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1 text-base">Damages and issues</h4>
                <p>Please inspect your order upon reception and contact us immediately if the item is defective, damaged or if you receive the wrong item, so that we can evaluate the issue and make it right.</p>
              </div>

              {/* Exchanges */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1 text-base">Exchanges</h4>
                <p>The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.</p>
              </div>

              {/* Refunds */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1 text-base">Refunds</h4>
                <p>We will notify you once we’ve received and inspected your return, and let you know if the refund was approved or not. If approved, you’ll be automatically refunded on your original payment method within 7 business days. Please remember it can take some time for your bank or credit card company to process and post the refund too.</p>
                <p>If more than 10 business days have passed since we’ve approved your return, please contact us at <a href="mailto:team.aneeverse@gmail.com" className="text-royal-blue hover:underline">team.aneeverse@gmail.com</a>.</p>
              </div>

              {/* Customised Product Policy */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1 text-base">Customised Product Return & Exchange Policy</h4>
                
                <div className="space-y-1">
                  <h5 className="font-bold text-gray-900 text-sm">1. Customised Orders Are Non-Refundable</h5>
                  <p>All products that are customised, personalised, or specially made as per the customer’s specific requirements are not eligible for cancellation or refund under any circumstances. Once the order is confirmed and production has begun, Cultura Jewels is not responsible for issuing any refunds for customised items.</p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-gray-900 text-sm">2. Exchange Allowed Only on Same Invoice Value</h5>
                  <p>Customers may request an exchange only for another product of equal invoice value. Price differences will not be refunded or adjusted.</p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-gray-900 text-sm">3. Exchange Eligibility Conditions</h5>
                  <p>An exchange request for customised items will be processed only if the following conditions are met:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                    <li>The product must be returned to Cultura Jewels in its original, unused, and undamaged condition.</li>
                    <li>Original tags, authenticity cards, invoices, packaging box, and accessories must be intact and included.</li>
                    <li>The product must be returned only after it is physically received by Cultura Jewels and verified by our quality check team.</li>
                    <li>Any signs of wear, damage, alteration, or modification will result in rejection of the exchange request.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-gray-900 text-sm">4. Shipping & Handling</h5>
                  <p>Return shipping for customised products, including courier charges and insurance, must be handled and borne by the customer. Cultura Jewels will process the exchange only after the returned product has successfully passed quality inspection.</p>
                </div>
              </div>

              {/* Gold with Lab Policy */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1 text-base">Gold With Lab</h4>
                <p>Our 15 Day Return Policy gives you the time to be sure that your purchase is perfect. If you need to return the product for any reason, you can opt for easy return within 15 days of the delivery of the product. We will provide you with full refund after retaining Rs.1000/- towards delivery and processing for each product returned.</p>
                
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">15 Day Return Policy is not applicable in the following instances -</p>
                  <ul className="list-decimal pl-5 space-y-1 text-xs">
                    <li>On orders that have been exchanged earlier under the 15 Day Return Policy - You can exchange your design within 15 days for the full value only once. If you wish to exchange the product the second time, it will be considered under Lifetime Exchange Policy.</li>
                    <li>On products that have been engraved or personalized or customized.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Conditions for 15 Day Return Policy -</p>
                  <p>Product must be returned in original packaging in saleable condition with no scratches, damage, wear or alteration. The stickers and tags must be intact. If the product tag or the packaging is tampered with, the return will be covered under Buyback Policy.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Process for refund under 15 Day Return Policy -</p>
                  <p className="mb-2">When a product is returned under our 15 Day Return Policy, a Quality Check is done. After Quality Check, the refund is made within 10 business days.</p>
                  <ul className="list-decimal pl-5 space-y-1 text-xs">
                    <li>For cash on delivery orders, the refund will be processed to your bank account.</li>
                    <li>For prepaid orders, the amount will be credited to the payment source (Credit Card/Debit Card /Net Banking/UPI).</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">How to return the product to Cultura Jewels within 15 days -</p>
                  <ul className="list-decimal pl-5 space-y-1 text-xs">
                    <li>Place a return request on your account on the website or write an email to <a href="mailto:team.aneeverse@gmail.com" className="text-royal-blue hover:underline">team.aneeverse@gmail.com</a> within 15 days of delivery to schedule a return pick up.</li>
                    <li>Cultura Jewels will send reverse pick up details and instructions.</li>
                    <li>Pack your jewellery in the original packaging material along with the certificate and hand it over to the logistics executive.</li>
                    <li>The product should be accompanied by the original product certificate and the invoice. Loss of certificate will result in additional charges of Rs. 2,000 or Rs. 800 per carat – whichever is higher.</li>
                    <li>Please collect an acknowledgement for the item being picked up (pickup receipt on paper/ photo of tracking number/ SMS confirmation).</li>
                    <li>Once the product is received, we conduct a quality check to check for any signs of damage or wear and tear. Once the quality check is cleared, refund will be processed to your bank account in 10 business days. Any item that shows signs of wear or that has been altered, resized (by a jeweller other than the company) or damaged cannot be accepted for 15 Day Return Policy.</li>
                    <li>In case the product was earlier purchased through EMI system, we will deduct an amount equivalent to 1% of the Grand Total Amount at the time of refund of initial installment.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">How to return the products -</p>
                  <p>You can return the products at any of our physical stores. Cultura Jewels will schedule a reverse pick up for customers who cannot return their products at any of our stores.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Changes in Policies -</p>
                  <p>Cultura Jewels reserves the right to modify these policies at any time so it is advisable to review the policies frequently. Changes will take effect immediately upon publishing on the website. Any material changes made to the policies will be made along with a notification here that the policies have been updated.</p>
                </div>
              </div>

              {/* Customer Helpline */}
              <div className="bg-[#FAF5FF] p-4 rounded-xl border border-gold-accent/15 space-y-2">
                <h4 className="font-bold text-royal-blue text-base">Customer Helpline</h4>
                <p className="text-xs">Need help? Think we could have done something better?</p>
                <p className="text-xs">We are listening and happy to do what we can to improve. Please let us know.</p>
                <p className="text-xs font-semibold text-gray-900 leading-relaxed">
                  We can be reached at <a href="mailto:team.aneeverse@gmail.com" className="text-royal-blue hover:underline">team.aneeverse@gmail.com</a> or at <a href="tel:+919152755529" className="text-royal-blue hover:underline">+91 91527 55529</a> between 11am-5pm (Monday to Saturday).
                </p>
                <p className="text-xs text-gray-600 mt-2 font-medium">
                  Our registered office address is:<br />
                  Cultura Jewels<br />
                  Office No. 03, Plot No. 45, near HP Petrol Pump, Seawoods West, Sector 44, Seawoods, Navi Mumbai, Maharashtra 400706
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Why Choose Cultura Jewels */}
        <div className="flex flex-col gap-3 py-4 border-b border-gray-200">
          <button
            onClick={() => setIsChooseOneOpen(!isChooseOneOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-base sm:text-lg font-medium text-gray-900">Why Choose Cultura Jewels</span>
            {isChooseOneOpen ? (
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M0 1H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900 flex-shrink-0">
                <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
          {isChooseOneOpen && (
            <div className="text-sm text-gray-800 space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1">Premium Metal & Materials:</h4>
                  <p className="text-xs text-gray-600">We prioritize your comfort and safety by crafting jewellery with nickel-free, hypoallergenic materials, ensuring an irritation-free experience for daily wear.</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1">International Designs:</h4>
                  <p className="text-xs text-gray-600">Discover a world of style with our diverse collection. From timeless classics to contemporary masterpieces, our designs reflect global trends and cultural inspiration.</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1">Fair Pricing:</h4>
                  <p className="text-xs text-gray-600">Enjoy transparent pricing with zero hidden markups. by eliminating middlemen, we bring you exceptional quality jewellery at affordable rates accessible to everyone.</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1">Safe and Secure Payment:</h4>
                  <p className="text-xs text-gray-600">Shop with confidence using our industry-leading encryption technology. We ensure your payment details are protected for a completely worry-free transaction.</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1">Easy EMI Facility:</h4>
                  <p className="text-xs text-gray-600">Shop now and pay at your own pace. We offer flexible EMI options to make your favorite luxury pieces accessible without straining your budget.</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1">5-Star Customer Service:</h4>
                  <p className="text-xs text-gray-600">Our dedicated support team is here to provide personalized assistance at every step, ensuring your satisfaction with prompt and reliable solutions.</p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Mobile Fixed Sticky CTA Bar (Add to Bag & Buy Now) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200/80 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            handleAddToCart()
          }}
          disabled={isMobileDisabled}
          className="flex-1 h-12 rounded-xl font-bold uppercase text-xs tracking-wider border-2 border-royal-blue bg-white text-royal-blue lg:hover:bg-royal-blue/5 active:bg-royal-blue/5 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          data-ga-event="add_to_bag_mobile_sticky_click"
          data-ga-label={product.title || "Product"}
        >
          {isAdding ? (
            <svg className="animate-spin h-4 w-4 text-royal-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              <Image src="/cart.svg" alt="Cart" width={16} height={16} className="brightness-0" />
              <span>
                {!allOptionsSelected
                  ? "Add to Bag"
                  : !isValidVariant
                    ? "Not Available"
                    : !inStock
                      ? (inventoryLimit !== null && (inventoryLimit + quantityInCart) > 0 && quantity > inventoryLimit)
                        ? (inventoryLimit <= 0 ? "Out of Stock" : "No More Stock")
                        : "Out of Stock"
                      : `Add to Bag${quantity > 1 ? ` (${quantity})` : ''}`}
              </span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            handleBuyNow()
          }}
          disabled={isMobileDisabled}
          className="flex-1 h-12 rounded-xl font-bold uppercase text-xs tracking-wider bg-royal-blue text-white lg:hover:bg-gold-accent active:bg-gold-accent active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          data-ga-event="buy_now_mobile_sticky_click"
          data-ga-label={product.title || "Product"}
        >
          {isBuyingNow ? (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1.5"></circle>
                <circle cx="20" cy="21" r="1.5"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span>
                {!allOptionsSelected
                  ? "Buy Now"
                  : !isValidVariant
                    ? "Not Available"
                    : !inStock
                      ? "Out of Stock"
                      : "Buy Now"}
              </span>
            </>
          )}
        </button>
      </div>

      <LoginPopup
        isOpen={showLoginPopup}
        onClose={() => setShowLoginPopup(false)}
        countryCode={countryCode}
      />
    </>
  )
}
