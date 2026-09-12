"use client"

import { useWishlist } from "@lib/context/wishlist-context"

const WishlistCounter = () => {
    const { count } = useWishlist()

    if (count === 0) return null

    return (
        <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 flex items-center justify-center bg-royal-blue text-white text-[8px] sm:text-[10px] rounded-full font-bold shadow-sm">
            {count}
        </div>
    )
}

export default WishlistCounter
