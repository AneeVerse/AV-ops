"use client"

import { useState, useEffect } from "react"
import WishlistItem from "../components/wishlist-item"
import { HttpTypes } from "@medusajs/types"
import { getWishlist, removeFromWishlist } from "@lib/data/wishlist"
import { useWishlist } from "@lib/context/wishlist-context"
import { retrieveCart } from "@lib/data/cart"

interface WishlistProduct {
  id: string
  product: HttpTypes.StoreProduct
}

const WishlistTemplate = ({ countryCode }: { countryCode: string }) => {
  const { refreshWishlist, count } = useWishlist()
  const [wishlistItems, setWishlistItems] = useState<WishlistProduct[]>([])
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(null)
  const [loading, setLoading] = useState(true)

  const loadWishlist = async () => {
    try {
      const [wishlistResult, cartResult] = await Promise.all([
        getWishlist(true, countryCode),
        retrieveCart().catch(() => null)
      ])
      
      setCart(cartResult)

      if (wishlistResult.success) {
        // Transform the API response to match our WishlistProduct interface
        const items: WishlistProduct[] = wishlistResult.data.map((item: any) => {
          // Handle different response formats
          if (item.product) {
            // If item has a product property
            return {
              id: item.id || item.product.id,
              product: item.product,
            }
          } else if (item.id && item.title) {
            // If item is a product object directly
            return {
              id: item.id,
              product: item as HttpTypes.StoreProduct,
            }
          } else {
            // If it's just a product ID, we need to fetch product details
            // For now, skip it or handle separately
            return null
          }
        }).filter((item: WishlistProduct | null): item is WishlistProduct => item !== null)

        setWishlistItems(items)
      }
    } catch (error) {
      // Error silently handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWishlist()
  }, [])

  const handleRemoveItem = async (productId: string) => {
    try {
      const result = await removeFromWishlist(productId)
      if (result.success) {
        // Remove from local state
        const updated = wishlistItems.filter((item) => item.product.id !== productId)
        setWishlistItems(updated)
        refreshWishlist()
      } else {
        // Still remove from UI for better UX, but show error
        const updated = wishlistItems.filter((item) => item.product.id !== productId)
        setWishlistItems(updated)
        refreshWishlist()
      }
    } catch (error) {
      // Error silently handled
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#FCFBF7" }}>
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-8 sm:py-12 md:py-14 lg:py-16">
          <div className="mx-auto" style={{ maxWidth: '1360px' }}>
            <div className="text-center text-sm sm:text-base">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media (min-width: 340px) and (max-width: 638px) {
            .wishlist-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (min-width: 639px) and (max-width: 767px) {
            .wishlist-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (min-width: 768px) and (max-width: 1023px) {
            .wishlist-grid {
              grid-template-columns: repeat(3, 1fr) !important;
            }
          }
          @media (min-width: 1024px) {
            .wishlist-grid {
              grid-template-columns: repeat(4, 1fr) !important;
            }
          }
        `
      }} />
      <div className="min-h-screen" style={{ background: "#FCFBF7" }}>
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-8 sm:py-12 md:py-14 lg:py-16">
          <div className="mx-auto" style={{ maxWidth: '1360px' }}>
            {/* Header */}
            <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 pl-2 sm:pl-4 md:pl-6">My Wishlist</h1>
              <p className="text-sm sm:text-base text-gray-500 pl-2 sm:pl-4 md:pl-6">
                ({count} {count === 1 ? "Item" : "Items"})
              </p>
            </div>

            {/* Wishlist Grid */}
            {wishlistItems.length > 0 ? (
              <div className="grid grid-cols-1 wishlist-grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 justify-items-center">
                {wishlistItems.map((item) => (
                  <WishlistItem
                    key={item.id}
                    product={item.product}
                    countryCode={countryCode}
                    cart={cart}
                    onRemove={() => handleRemoveItem(item.product.id || "")}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 sm:py-16 md:py-20">
                <div className="mb-4 sm:mb-6">
                  <svg
                    className="mx-auto w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-2 font-semibold">Your wishlist is empty</p>
                <p className="text-sm sm:text-base text-gray-500">Start adding items to your wishlist!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default WishlistTemplate

