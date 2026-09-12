"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { getWishlistProductIds, addToWishlist as addToWishlistApi, removeFromWishlist as removeFromWishlistApi } from "@lib/data/wishlist"

interface WishlistContextType {
    wishlistIds: string[]
    count: number
    isWishlisted: (productId: string) => boolean
    toggleWishlist: (productId: string) => Promise<{ success: boolean; error?: string }>
    refreshWishlist: () => Promise<void>
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [wishlistIds, setWishlistIds] = useState<string[]>([])

    const refreshWishlist = useCallback(async () => {
        try {
            const ids = await getWishlistProductIds()
            setWishlistIds(ids)
        } catch (error) {
            // Error silently ignored for production
        }
    }, [])

    useEffect(() => {
        refreshWishlist()
    }, [refreshWishlist])

    const isWishlisted = useCallback((productId: string) => {
        return wishlistIds.includes(productId)
    }, [wishlistIds])

    const toggleWishlist = async (productId: string) => {
        const currentlyWishlisted = isWishlisted(productId)

        try {
            if (currentlyWishlisted) {
                const result = await removeFromWishlistApi(productId)
                if (result.success) {
                    setWishlistIds(prev => prev.filter(id => id !== productId))
                    return { success: true }
                }
                return { success: false, error: result.error }
            } else {
                const result = await addToWishlistApi(productId)
                if (result.success) {
                    setWishlistIds(prev => [...prev, productId])
                    return { success: true }
                }
                return { success: false, error: result.error }
            }
        } catch (error: any) {
            return { success: false, error: error.message || "An error occurred" }
        }
    }

    return (
        <WishlistContext.Provider
            value={{
                wishlistIds,
                count: wishlistIds.length,
                isWishlisted,
                toggleWishlist,
                refreshWishlist,
            }}
        >
            {children}
        </WishlistContext.Provider>
    )
}

export const useWishlist = () => {
    const context = useContext(WishlistContext)
    if (context === undefined) {
        throw new Error("useWishlist must be used within a WishlistProvider")
    }
    return context
}
