"use client"
import { useState } from "react"
import { useWishlist } from "@lib/context/wishlist-context"
import LoginPopup from "@modules/common/components/login-popup"

const WishlistIcon = ({ productId }: { productId: string }) => {
  const { isWishlisted, toggleWishlist } = useWishlist()
  const [isToggling, setIsToggling] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  
  const wishlisted = isWishlisted(productId)

  const handleToggle = async () => {
    setIsToggling(true)
    const res = await toggleWishlist(productId)
    if (!res.success && res.error?.toLowerCase().includes("login")) {
      setShowLogin(true)
    }
    setIsToggling(false)
  }

  return (
    <>
      <button 
        onClick={handleToggle} 
        disabled={isToggling}
        className="p-1 rounded-full text-gray-700 hover:text-gold-accent hover:bg-gold-accent/10 transition-all duration-200 flex items-center justify-center group/wishlist cursor-pointer active:scale-95"
        aria-label="Wishlist"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={wishlisted ? "#ef4444" : "none"}
          stroke={wishlisted ? "#ef4444" : "currentColor"}
          strokeWidth="2"
          className={isToggling ? "animate-pulse" : "w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/wishlist:scale-110 transition-transform"}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      {showLogin && <LoginPopup isOpen={showLogin} onClose={() => setShowLogin(false)} />}
    </>
  )
}
export default WishlistIcon
