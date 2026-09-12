"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import Image from "next/image"

import Menu from "@modules/common/icons/menu"
import X from "@modules/common/icons/x"
import User from "@modules/common/icons/user"
import Package from "@modules/common/icons/package"
import MapPin from "@modules/common/icons/map-pin"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import { Suspense } from "react"
import WishlistCounter from "@modules/layout/components/wishlist-counter"

import { signout } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"

// Helper function to get profile image URL from metadata
const getProfileImageUrl = (customer: HttpTypes.StoreCustomer | null): string | null => {
  if (!customer) {
    return null
  }
  const metadata = customer.metadata as Record<string, any> | undefined
  if (metadata?.profile_image_url) {
    return metadata.profile_image_url
  }
  return null
}

const MobileMenu = ({ customer, countryCode }: { customer: HttpTypes.StoreCustomer | null, countryCode: string }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [mobileCollectionOpen, setMobileCollectionOpen] = useState(false)
  const [mobilePriceOpen, setMobilePriceOpen] = useState(false)
  const pathname = usePathname()
  const scrollYRef = useRef(0)

  const [activeCountry, setActiveCountry] = useState<string>(countryCode || "us")

  useEffect(() => {
    let code = countryCode || ""
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/i)
      if (match) {
        code = match[1].toLowerCase()
      } else {
        const cookieMatch = document.cookie.match(/_medusa_region_pref=([a-z]{2})/i) || document.cookie.match(/_medusa_country_code=([a-z]{2})/i)
        if (cookieMatch) {
          code = cookieMatch[1].toLowerCase()
        }
      }
    }
    setActiveCountry(code || "us")
  }, [countryCode, pathname])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isActive = (href: string) => {
    const path = pathname.split("/").slice(2).join("/") || "/"
    const linkPath = href === "/" ? "/" : href.replace(/^\//, "")

    if (href === "/") {
      return path === "" || path === "/"
    }

    return path === linkPath || path.startsWith(linkPath + "/")
  }

  const linkClass = (href: string) => {
    const active = isActive(href)
    return `flex items-center gap-3 py-3 px-4 text-base transition-colors ${active
      ? "text-gold-accent font-semibold bg-gold-accent/10"
      : "text-gray-700 hover:text-gold-accent hover:bg-gray-50"
      }`
  }

  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      scrollYRef.current = window.scrollY || document.documentElement.scrollTop || 0

      // Lock scroll on both html and body
      const body = document.body
      const html = document.documentElement

      // Apply styles to prevent scrolling
      body.style.position = "fixed"
      body.style.top = `-${scrollYRef.current}px`
      body.style.left = "0"
      body.style.right = "0"
      body.style.overflow = "hidden"
      body.style.width = "100%"

      html.style.overflow = "hidden"
      html.style.height = "100%"

      // Prevent touch scrolling on backdrop (but allow in menu panel)
      const preventScroll = (e: TouchEvent | WheelEvent) => {
        const target = e.target as Element
        // Allow scrolling inside the menu panel
        if (target.closest('[data-menu-panel]')) {
          return
        }
        e.preventDefault()
      }

      // Add event listeners
      document.addEventListener("touchmove", preventScroll as EventListener, { passive: false })
      document.addEventListener("wheel", preventScroll as EventListener, { passive: false })

      return () => {
        document.removeEventListener("touchmove", preventScroll as EventListener)
        document.removeEventListener("wheel", preventScroll as EventListener)
      }
    } else {
      // Restore scrolling
      const body = document.body
      const html = document.documentElement

      body.style.position = ""
      body.style.top = ""
      body.style.left = ""
      body.style.right = ""
      body.style.overflow = ""
      body.style.width = ""

      html.style.overflow = ""
      html.style.height = ""

      // Restore scroll position
      const savedScroll = scrollYRef.current
      if (savedScroll !== undefined && savedScroll !== null) {
        window.scrollTo({
          top: savedScroll,
          behavior: "auto"
        })
      }
    }
  }, [isOpen])

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={toggleMenu}
        className="lg:hidden p-2 hover:opacity-80 transition-opacity"
        aria-label="Toggle menu"
        data-testid="mobile-menu-button"
        type="button"
      >
        <Menu size={20} color="#374151" className="w-5 h-5" />
      </button>

      {/* Mobile Menu Overlay — rendered via portal to document.body so it escapes the
          homepage nav's `home-theme-nav` styles (which force white text) and any
          containing block created by the header's backdrop-filter. */}
      {isMounted && createPortal(
      <div
        className={`fixed inset-0 z-[100] lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMenu}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Menu Panel */}
        <div
          className={`absolute left-0 top-0 h-full w-64 min-[350px]:w-72 min-[450px]:w-80 max-w-[85vw] bg-ivory-bg shadow-xl overflow-y-auto transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
          data-menu-panel
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-none">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <button
              onClick={closeMenu}
              className="p-2 hover:opacity-80 transition-opacity"
              aria-label="Close menu"
              type="button"
            >
              <X size={24} color="#374151" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="py-2 flex-1">
            <LocalizedClientLink
              href="/"
              className={linkClass("/")}
              onClick={closeMenu}
              data-testid="mobile-nav-home-link"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 16.6667V11.6667H12.5V16.6667H16.6667V10H19.1667L10 2.5L0.833336 10H3.33334V16.6667H7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Home</span>
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/store"
              className={linkClass("/store")}
              onClick={closeMenu}
              data-testid="mobile-nav-shop-link"
            >
              <Package size={20} />
              <span>Shop</span>
            </LocalizedClientLink>

            {/* Shop by Collection Submenu */}
            <div className="border-b border-gray-100 my-1 pb-1">
              <button
                type="button"
                onClick={() => setMobileCollectionOpen(!mobileCollectionOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-[#102a43] font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  <span>Shop by Collection</span>
                </div>
                <span className={`text-xs text-[#D4AF37] transition-transform duration-200 ${mobileCollectionOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>

              {mobileCollectionOpen && (
                <div className="pl-11 pr-4 py-1 space-y-1 bg-gray-50/70 rounded-xl my-1">
                  {[
                    { name: "Luxury Collection", href: "/store?collection=luxury" },
                    { name: "Essentials Collection", href: "/store?collection=essentials" },
                    { name: "Punkzster", href: "/store?collection=punkzster" },
                    { name: "Strapt", href: "/store?collection=strapt" },
                    { name: "Celestique", href: "/store?collection=celestique" },
                    { name: "View All Collections", href: "/store" },
                  ].map((col) => (
                    <LocalizedClientLink
                      key={col.name}
                      href={col.href}
                      onClick={closeMenu}
                      className="block py-2 text-xs text-gray-700 hover:text-[#D4AF37] font-medium"
                    >
                      {col.name}
                    </LocalizedClientLink>
                  ))}
                </div>
              )}
            </div>

            {/* Shop by Price Submenu */}
            <div className="border-b border-gray-100 my-1 pb-1">
              <button
                type="button"
                onClick={() => setMobilePriceOpen(!mobilePriceOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-[#102a43] font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {activeCountry?.toLowerCase() === "in" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-9H6" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  )}
                  <span>Shop by Price</span>
                </div>
                <span className={`text-xs text-[#D4AF37] transition-transform duration-200 ${mobilePriceOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>

              {mobilePriceOpen && (
                <div className="pl-11 pr-4 py-1 space-y-1 bg-gray-50/70 rounded-xl my-1">
                  {(activeCountry?.toLowerCase() === "in"
                    ? [
                        { name: "Under ₹15,000", href: "/store?price_max=15000" },
                        { name: "Under ₹25,000", href: "/store?price_max=25000" },
                        { name: "Under ₹50,000", href: "/store?price_max=50000" },
                        { name: "Above ₹50,000", href: "/store?price_min=50000" },
                      ]
                    : [
                        { name: "Under $200", href: "/store?price_max=200" },
                        { name: "Under $400", href: "/store?price_max=400" },
                        { name: "Under $800", href: "/store?price_max=800" },
                        { name: "Above $800", href: "/store?price_min=800" },
                      ]
                  ).map((p) => (
                    <LocalizedClientLink
                      key={p.name}
                      href={p.href}
                      onClick={closeMenu}
                      className="block py-2 text-xs text-gray-700 hover:text-[#D4AF37] font-medium"
                    >
                      {p.name}
                    </LocalizedClientLink>
                  ))}
                </div>
              )}
            </div>

            <LocalizedClientLink
              href="/custom-order"
              className={linkClass("/custom-order")}
              onClick={closeMenu}
              data-testid="mobile-nav-custom-order-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              <span>Custom Order</span>
            </LocalizedClientLink>

            {customer && (
              <LocalizedClientLink
                href="/wishlist"
                className={linkClass("/wishlist")}
                onClick={closeMenu}
                data-testid="mobile-nav-wishlist-link"
              >
                <div className="relative">
                  <Image
                    src="/Wishlist.svg"
                    alt="Wishlist"
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                  <WishlistCounter />
                </div>
                <span>Wishlist</span>
              </LocalizedClientLink>
            )}

            <LocalizedClientLink
              href="/about"
              className={linkClass("/about")}
              onClick={closeMenu}
              data-testid="mobile-nav-about-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>About</span>
            </LocalizedClientLink>

            <LocalizedClientLink
              href="/contact"
              className={linkClass("/contact")}
              onClick={closeMenu}
              data-testid="mobile-nav-contact-link"
            >
              <MapPin size={20} />
              <span>Contact Us</span>
            </LocalizedClientLink>

            <LocalizedClientLink
              href="/help"
              className={linkClass("/help")}
              onClick={closeMenu}
              data-testid="mobile-nav-help-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>Help</span>
            </LocalizedClientLink>
            {customer && (
              <LocalizedClientLink
                href="/account"
                className={linkClass("/account")}
                onClick={closeMenu}
                data-testid="mobile-nav-account-link"
              >
                {getProfileImageUrl(customer) ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                    <Image
                      src={getProfileImageUrl(customer)!}
                      alt="Account"
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <User size={20} />
                )}
                <span>Account</span>
              </LocalizedClientLink>
            )}
          </nav>

          <div className="mt-auto border-t border-gray-200 flex-none bg-ivory-bg">
            {!customer ? (
              <LocalizedClientLink
                href="/account"
                className={linkClass("/account")}
                onClick={closeMenu}
                data-testid="mobile-nav-login-link"
              >
                <User size={20} />
                <span>Login</span>
              </LocalizedClientLink>
            ) : (
              <button
                onClick={async () => {
                  closeMenu()
                  await signout(countryCode)
                }}
                className="flex items-center gap-3 w-full py-4 px-4 text-base text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>,
      document.body
      )}
    </>
  )
}

export default MobileMenu

