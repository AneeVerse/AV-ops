"use client"

import { useState, useMemo, useEffect } from "react"
import { HttpTypes } from "@medusajs/types"
import { updateLineItem, deleteLineItem, addToCart, retrieveCart } from "@lib/data/cart"
import { getProductByHandle } from "@lib/data/products"
import { trackAddToCart, trackRemoveFromCart } from "@lib/analytics/ga4-ecommerce"
import { useParams } from "next/navigation"
import { isEqual } from "lodash"
import Thumbnail from "@modules/products/components/thumbnail"
import DeleteButton from "@modules/common/components/delete-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import ErrorMessage from "@modules/checkout/components/error-message"
import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"

type CartItemCardProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

const CartItemCard = ({ item, currencyCode }: CartItemCardProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [freshVariant, setFreshVariant] = useState<any>(null)
  const countryCode = useParams().countryCode as string

  // Get product from cart item - it should be available since we updated cart retrieval
  // Check both item.product and item.variant?.product
  const product = (item as any).product || item.variant?.product

  // Initialize options from current variant
  useEffect(() => {
    if (item.variant?.options) {
      const variantOptions = optionsAsKeymap(item.variant.options)
      setOptions(variantOptions ?? {})
    }
  }, [item.variant?.options])

  // Fetch fresh variant data to get accurate inventory
  useEffect(() => {
    const fetchFreshData = async () => {
      if (item.product_handle) {
        const productData = await getProductByHandle(item.product_handle)
        if (productData?.variants) {
          const v = productData.variants.find((v: any) => v.id === item.variant_id)
          if (v) {
            setFreshVariant(v)
          }
        }
      }
    }
    fetchFreshData()
  }, [item.product_handle, item.variant_id])

  // Find selected variant based on options
  const selectedVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) {
      return item.variant
    }

    return product.variants.find((v: HttpTypes.StoreProductVariant) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product?.variants, options, item.variant])

  // Get available option values
  const getOptionValues = (optionId: string) => {
    if (!product?.variants) return []

    const values = new Set<string>()
    product.variants.forEach((variant: HttpTypes.StoreProductVariant) => {
      variant.options?.forEach((opt: any) => {
        if (opt.option_id === optionId) {
          values.add(opt.value)
        }
      })
    })
    return Array.from(values)
  }

  // Get product options
  const productOptions = (product?.options || []) as HttpTypes.StoreProductOption[]

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  const handleOptionChange = async (optionId: string, value: string) => {
    const newOptions = {
      ...options,
      [optionId]: value,
    }
    setOptions(newOptions)

    // Find variant with new options
    const newVariant = product?.variants?.find((v: HttpTypes.StoreProductVariant) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, newOptions)
    })

    if (newVariant && newVariant.id !== item.variant_id) {
      setError(null)
      setUpdating(true)

      try {
        const unitTotal = item.total ? item.total / item.quantity : 0
        trackRemoveFromCart({
          currency: currencyCode,
          value: (item.total ?? 0) / 100,
          items: [
            {
              item_id: item.variant_id ?? item.id,
              item_name: item.title ?? "",
              price: unitTotal / 100,
              quantity: item.quantity,
            },
          ],
        })
        await deleteLineItem(item.id)

        await addToCart({
          variantId: newVariant.id,
          quantity: item.quantity,
          countryCode,
        })
        const newUnitPrice = (newVariant as any).calculated_price?.calculated_amount ?? 0
        trackAddToCart({
          currency: currencyCode,
          value: (newUnitPrice * item.quantity) / 100,
          items: [
            {
              item_id: newVariant.id,
              item_name: product?.title ?? item.title ?? "",
              price: newUnitPrice / 100,
              quantity: item.quantity,
              item_variant: newVariant.title ?? undefined,
            },
          ],
        })
      } catch (err: any) {
        setError(err.message)
        // Revert options on error
        const currentOptions = item.variant?.options
        setOptions(currentOptions ? (optionsAsKeymap(currentOptions) ?? {}) : {})
      } finally {
        setUpdating(false)
      }
    }
  }

  const maxQuantity = useMemo(() => {
    const variant = freshVariant || selectedVariant || item.variant
    if (!variant) return 10

    // If inventory management is off or backorders are allowed, allow a high quantity
    if (variant.manage_inventory === false || (variant as any).allow_backorder) {
      return 100
    }

    // Otherwise use actual inventory quantity if available
    const stock = (variant as any).inventory_quantity
    if (stock === undefined || stock === null) {
      return 100 // Fallback if still unknown
    }

    return stock
  }, [freshVariant, selectedVariant, item.variant])

  const isAtMax = item.quantity >= maxQuantity

  // Get price information from cart item
  // item.total is the total for the line item (quantity * unit_price)
  // So we divide by quantity to get unit price
  const unitTotal = item.total ? item.total / item.quantity : 0
  const unitOriginalTotal = item.original_total ? item.original_total / item.quantity : 0

  // Use variant price if available, otherwise use item total
  const displayVariant = selectedVariant || item.variant
  const variantPrice = displayVariant?.calculated_price?.calculated_amount
  const variantOriginalPrice = displayVariant?.calculated_price?.original_amount

  // Prefer variant price, fallback to item total
  // Note: variant prices are already in smallest currency unit (e.g., paise for INR)
  // item.total is also in smallest currency unit
  const currentPriceAmount = variantPrice || unitTotal
  const originalPriceAmount = variantOriginalPrice || unitOriginalTotal

  const discountPercentage = originalPriceAmount && currentPriceAmount && originalPriceAmount > currentPriceAmount
    ? Math.round(((originalPriceAmount - currentPriceAmount) / originalPriceAmount) * 100)
    : 0

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 min-[340px]:p-3.5 min-[550px]:p-4 sm:p-4 min-[1023px]:p-3 min-[1150px]:p-4 min-[1360px]:p-4 mb-3 min-[340px]:mb-3.5 min-[550px]:mb-4 sm:mb-4 min-[1023px]:mb-3 min-[1150px]:mb-4 min-[1360px]:mb-4 relative">
      {/* Remove button */}
      <div className="absolute top-2.5 min-[340px]:top-3 min-[550px]:top-3 right-2.5 min-[340px]:right-3 min-[550px]:right-3 sm:top-3 sm:right-3 min-[1023px]:top-2 min-[1023px]:right-2 min-[1150px]:top-3 min-[1150px]:right-3 min-[1360px]:top-3 min-[1360px]:right-3 z-10">
        <DeleteButton
          id={item.id}
          productId={item.product_id || ""}
          thumbnail={item.thumbnail}
          data-testid="product-delete-button"
          onAfterDelete={() => {
            const unitTotal = item.total ? item.total / item.quantity : 0
            trackRemoveFromCart({
              currency: currencyCode,
              value: (item.total ?? 0) / 100,
              items: [
                {
                  item_id: item.variant_id ?? item.id,
                  item_name: item.title ?? "",
                  price: unitTotal / 100,
                  quantity: item.quantity,
                },
              ],
            })
          }}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 min-[340px]:gap-3.5 min-[550px]:gap-4 sm:gap-4 min-[1023px]:gap-3 min-[1150px]:gap-4 min-[1360px]:gap-4">
        {/* Product Image */}
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className="flex-shrink-0 self-start"
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            variantImages={item.variant?.images}
            size="square"
            className="w-20 h-20 min-[340px]:w-22 min-[340px]:h-22 min-[550px]:w-24 min-[550px]:h-24 sm:w-24 sm:h-24 min-[1023px]:w-20 min-[1023px]:h-20 min-[1150px]:w-24 min-[1150px]:h-24 min-[1360px]:w-24 min-[1360px]:h-24 rounded-lg object-cover"
          />
        </LocalizedClientLink>

        {/* Product Details */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5 min-[340px]:gap-3 min-[550px]:gap-3 sm:gap-3 min-[1023px]:gap-2 min-[1150px]:gap-3 min-[1360px]:gap-3 pr-6 min-[340px]:pr-7 min-[550px]:pr-8 sm:pr-8 min-[1023px]:pr-6 min-[1150px]:pr-8 min-[1360px]:pr-8">
          {/* Brand */}
          {product?.metadata?.brand && (
            <p className="text-xs min-[340px]:text-xs min-[550px]:text-xs text-gray-500">{product.metadata.brand}</p>
          )}

          {/* Product Title */}
          <h3 className="font-bold text-sm min-[340px]:text-sm min-[550px]:text-base sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base text-gray-900 truncate pr-10 min-[340px]:pr-12 min-[550px]:pr-8 sm:pr-8 min-[1023px]:pr-8 min-[1150px]:pr-8 min-[1360px]:pr-8">
            {item.product_title}
          </h3>

          {/* Variant Dropdowns */}
          {!product ? (
            <div className="flex gap-2.5 min-[340px]:gap-3 flex-wrap">
              <div className="h-9 min-[340px]:h-9.5 min-[550px]:h-10 sm:h-10 min-[1023px]:h-9 min-[1150px]:h-10 min-[1360px]:h-10 w-full sm:w-32 min-[1023px]:w-28 min-[1150px]:w-32 min-[1360px]:w-32 bg-gray-100 animate-pulse rounded" />
              <div className="h-9 min-[340px]:h-9.5 min-[550px]:h-10 sm:h-10 min-[1023px]:h-9 min-[1150px]:h-10 min-[1360px]:h-10 w-full sm:w-32 min-[1023px]:w-28 min-[1150px]:w-32 min-[1360px]:w-32 bg-gray-100 animate-pulse rounded" />
              <div className="h-9 min-[340px]:h-9.5 min-[550px]:h-10 sm:h-10 min-[1023px]:h-9 min-[1150px]:h-10 min-[1360px]:h-10 w-full sm:w-24 min-[1023px]:w-20 min-[1150px]:w-24 min-[1360px]:w-24 bg-gray-100 animate-pulse rounded" />
            </div>
          ) : (
            <div className="flex flex-col min-[340px]:flex-col min-[640px]:flex-row gap-2.5 min-[340px]:gap-3 min-[550px]:gap-3 sm:gap-2 min-[1023px]:gap-1.5 min-[1150px]:gap-2 min-[1360px]:gap-2 items-stretch min-[640px]:items-center">
              {productOptions.map((option: HttpTypes.StoreProductOption) => {
                const currentValue = options[option.id]
                const availableValues = getOptionValues(option.id)

                return (
                  <div key={option.id} className="relative">
                    <select
                      value={currentValue || ""}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      disabled={updating}
                      className="appearance-none bg-white border border-gray-300 rounded px-3 min-[340px]:px-3.5 min-[550px]:px-4 py-2 min-[340px]:py-2.5 min-[550px]:py-2.5 pr-8 min-[340px]:pr-9 min-[550px]:pr-9 text-xs min-[340px]:text-xs min-[550px]:text-sm sm:text-sm min-[1023px]:text-xs min-[1150px]:text-sm min-[1360px]:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent cursor-pointer disabled:opacity-50 w-full min-[640px]:min-w-[140px] min-[1023px]:min-w-[120px] min-[1150px]:min-w-[140px] min-[1360px]:min-w-[140px] h-9 min-[340px]:h-9.5 min-[550px]:h-10 sm:h-10 min-[1023px]:h-9 min-[1150px]:h-10 min-[1360px]:h-10"
                    >
                      {!currentValue && (
                        <option value="" disabled>
                          {option.title}: Select
                        </option>
                      )}
                      {availableValues.map((value) => (
                        <option key={value} value={value}>
                          {option.title}: {value}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                      <svg
                        className="fill-current h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                      >
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                )
              })}

              {/* Quantity Selector Container with Absolute Messages */}
              <div className="hidden min-[640px]:flex relative h-fit">
                <div className="flex items-center border border-gray-300 rounded-[5px] overflow-hidden bg-white h-8 min-[550px]:h-9 sm:h-10 min-[1023px]:h-9 min-[1150px]:h-10 min-[1360px]:h-10 w-[96px] min-[550px]:w-[108px] sm:w-[120px] relative z-0 shadow-sm">
                  <button
                    onClick={() => changeQuantity(Math.max(1, item.quantity - 1))}
                    disabled={updating || item.quantity <= 1}
                    className="w-8 min-[550px]:w-9 sm:w-10 h-full flex items-center justify-center text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-base min-[550px]:text-lg sm:text-xl transition-colors duration-200"
                    type="button"
                  >
                    −
                  </button>
                  <span className="w-8 min-[550px]:w-9 sm:w-10 text-center font-semibold text-gray-900 border-x border-gray-300 h-full flex items-center justify-center text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base bg-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => changeQuantity(Math.min(maxQuantity, item.quantity + 1))}
                    disabled={updating || item.quantity >= maxQuantity}
                    className="w-8 min-[550px]:w-9 sm:w-10 h-full flex items-center justify-center text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-base min-[550px]:text-lg sm:text-xl transition-colors duration-200"
                    type="button"
                  >
                    +
                  </button>
                  {updating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                      <Spinner />
                    </div>
                  )}
                </div>
                {isAtMax && maxQuantity > 0 && (
                  <p className="absolute top-[105%] left-0 text-[10px] min-[1150px]:text-[11px] text-red-500 font-bold animate-pulse whitespace-nowrap">
                    Maximum available stock reached
                  </p>
                )}
                {!isAtMax && maxQuantity < 6 && maxQuantity > 0 && (
                  <p className="absolute top-[105%] left-0 text-[10px] min-[1150px]:text-[11px] text-orange-500 font-bold whitespace-nowrap">
                    Only {maxQuantity - item.quantity} left in stock
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Quantity Selector and Price - Side by side at 340px-639px, aligned to left */}
          <div className="flex flex-col min-[640px]:hidden gap-2 w-full mt-3 min-[340px]:mt-3.5">
            <div className="flex flex-row gap-3 items-center justify-start w-full">
              {/* Quantity Selector */}
              <div className="flex items-center border border-gray-300 rounded-[5px] overflow-hidden bg-white h-9 min-[340px]:h-9.5 min-[550px]:h-10 w-[108px] min-[340px]:w-[114px] min-[550px]:w-[120px] flex-shrink-0 relative z-0 shadow-sm">
                <button
                  onClick={() => changeQuantity(Math.max(1, item.quantity - 1))}
                  disabled={updating || item.quantity <= 1}
                  className="w-9 min-[340px]:w-9.5 min-[550px]:w-10 h-full flex items-center justify-center text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-lg min-[340px]:text-xl min-[550px]:text-xl transition-colors duration-200"
                  type="button"
                >
                  −
                </button>
                <span className="w-9 min-[340px]:w-9.5 min-[550px]:w-10 text-center font-semibold text-gray-900 border-x border-gray-300 h-full flex items-center justify-center text-sm min-[340px]:text-sm min-[550px]:text-base bg-white">
                  {item.quantity}
                </span>
                <button
                  onClick={() => changeQuantity(Math.min(maxQuantity, item.quantity + 1))}
                  disabled={updating || item.quantity >= maxQuantity}
                  className="w-9 min-[340px]:w-9.5 min-[550px]:w-10 h-full flex items-center justify-center text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-lg min-[340px]:text-xl min-[550px]:text-xl transition-colors duration-200"
                  type="button"
                >
                  +
                </button>
                {updating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                    <Spinner />
                  </div>
                )}
              </div>

              {/* Price Information */}
              {currentPriceAmount > 0 && (
                <div className="flex items-center gap-2 min-[340px]:gap-2.5 flex-wrap flex-shrink-0">
                  <span className="font-bold text-base min-[340px]:text-lg min-[550px]:text-xl text-gray-900 whitespace-nowrap">
                    {convertToLocale({
                      amount: currentPriceAmount,
                      currency_code: currencyCode,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  {originalPriceAmount && originalPriceAmount > currentPriceAmount && (
                    <>
                      <span className="text-sm min-[340px]:text-base min-[550px]:text-lg text-gray-500 line-through whitespace-nowrap">
                        {convertToLocale({
                          amount: originalPriceAmount,
                          currency_code: currencyCode,
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      {discountPercentage > 0 && (
                        <span className="text-xs min-[340px]:text-xs min-[550px]:text-sm text-gold-accent font-medium whitespace-nowrap">
                          ({discountPercentage}% OFF)
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Stock Warning - Below Selector */}
            <div className="flex flex-col gap-1.5 px-1 mt-3">
              {isAtMax && maxQuantity > 0 && (
                <p className="text-[10px] text-red-500 font-bold animate-pulse">
                  Maximum stock reached
                </p>
              )}
              {!isAtMax && maxQuantity < 6 && maxQuantity > 0 && (
                <p className="text-[10px] text-orange-500 font-bold">
                  Only {maxQuantity - item.quantity} left
                </p>
              )}
            </div>
          </div>

          {/* Price Information - Only visible at 640px+ (same as 650px view) */}
          {currentPriceAmount > 0 && (
            <div className="hidden min-[640px]:flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base min-[550px]:text-[0.9375rem] sm:text-lg min-[1023px]:text-base min-[1150px]:text-lg min-[1360px]:text-lg text-gray-900">
                {convertToLocale({
                  amount: currentPriceAmount,
                  currency_code: currencyCode,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
              {originalPriceAmount && originalPriceAmount > currentPriceAmount && (
                <>
                  <span className="text-sm min-[550px]:text-[0.8125rem] sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base text-gray-500 line-through">
                    {convertToLocale({
                      amount: originalPriceAmount,
                      currency_code: currencyCode,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  {discountPercentage > 0 && (
                    <span className="text-xs min-[550px]:text-[0.6875rem] sm:text-sm min-[1023px]:text-xs min-[1150px]:text-sm min-[1360px]:text-sm text-gold-accent font-medium">
                      ({discountPercentage}% OFF)
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Error Message */}
          <ErrorMessage error={error} data-testid="product-error-message" />
        </div>
      </div>
    </div>
  )
}

export default CartItemCard

