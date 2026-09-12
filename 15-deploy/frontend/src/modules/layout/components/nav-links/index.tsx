"use client"

import React, { useState, useRef } from "react"
import { usePathname, useParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"

const NavLinks = ({ countryCode: propCountryCode }: { countryCode?: string }) => {
  const pathname = usePathname() || ""
  const params = useParams()
  const routeCountryCode = params?.countryCode as string
  
  const [activeCode, setActiveCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/i)
      if (match) return match[1].toLowerCase()
    }
    return (propCountryCode || routeCountryCode || "us").toLowerCase()
  })

  React.useEffect(() => {
    let code = (propCountryCode || routeCountryCode || "").toLowerCase()
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
    setActiveCode(code || "us")
  }, [propCountryCode, routeCountryCode, pathname])

  const isIndia = activeCode === "in"

  const priceItems = isIndia
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

  const [collectionOpen, setCollectionOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const collectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const priceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isActive = (href: string) => {
    const path = pathname ? pathname.split("/").slice(2).join("/") || "/" : "/"
    const linkPath = href === "/" ? "/" : href.replace(/^\//, "")
    if (href === "/") return path === "" || path === "/"
    return path === linkPath || path.startsWith(linkPath + "/")
  }

  const linkClass = (href: string) => {
    const active = isActive(href)
    return `text-sm xl:text-base transition-colors whitespace-nowrap ${
      active ? "text-gold-accent font-semibold" : "text-gray-700 hover:text-gold-accent"
    }`
  }

  // Handle Collection hover
  const handleCollectionMouseEnter = () => {
    if (collectionTimeoutRef.current) clearTimeout(collectionTimeoutRef.current)
    setCollectionOpen(true)
  }
  const handleCollectionMouseLeave = () => {
    collectionTimeoutRef.current = setTimeout(() => {
      setCollectionOpen(false)
    }, 150)
  }

  // Handle Price hover
  const handlePriceMouseEnter = () => {
    if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current)
    setPriceOpen(true)
  }
  const handlePriceMouseLeave = () => {
    priceTimeoutRef.current = setTimeout(() => {
      setPriceOpen(false)
    }, 150)
  }

  return (
    <>
      <LocalizedClientLink
        href="/"
        className={linkClass("/")}
        data-testid="nav-home-link"
      >
        Home
      </LocalizedClientLink>

      <LocalizedClientLink
        href="/store"
        className={linkClass("/store")}
        data-testid="nav-shop-link"
      >
        Shop
      </LocalizedClientLink>

      {/* Shop by Collection Dropdown */}
      <div
        className="relative group py-2"
        onMouseEnter={handleCollectionMouseEnter}
        onMouseLeave={handleCollectionMouseLeave}
      >
        <button
          type="button"
          className={`flex items-center gap-1.5 text-sm xl:text-base transition-colors whitespace-nowrap ${
            collectionOpen ? "text-gold-accent font-semibold" : "text-gray-700 hover:text-gold-accent"
          }`}
        >
          <span>Shop by Collection</span>
          <div className={`transition-transform duration-200 ${collectionOpen ? "rotate-180 text-gold-accent" : "opacity-70"}`}>
            <ChevronDown size={14} />
          </div>
        </button>

        {/* Dropdown Menu Panel */}
        {collectionOpen && (
          <div className="nav-dropdown-panel absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in duration-200 backdrop-blur-xl">
            <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest px-3 py-1.5 border-b border-gray-100 mb-1.5 font-sans">
              COLLECTIONS
            </div>
            <div className="space-y-1">
              {[
                { name: "Luxury Collection", href: "/store?collection=luxury" },
                { name: "Essentials Collection", href: "/store?collection=essentials" },
                { name: "Punkzster", href: "/store?collection=punkzster" },
                { name: "Strapt", href: "/store?collection=strapt" },
                { name: "Celestique", href: "/store?collection=celestique" },
                { name: "View All Collections", href: "/store" },
              ].map((item) => (
                <LocalizedClientLink
                  key={item.name}
                  href={item.href}
                  onClick={() => setCollectionOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold transition-all font-sans hover:bg-gray-100"
                >
                  <span>{item.name}</span>
                </LocalizedClientLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Shop by Price Dropdown */}
      <div
        className="relative group py-2"
        onMouseEnter={handlePriceMouseEnter}
        onMouseLeave={handlePriceMouseLeave}
      >
        <button
          type="button"
          className={`flex items-center gap-1.5 text-sm xl:text-base transition-colors whitespace-nowrap ${
            priceOpen ? "text-gold-accent font-semibold" : "text-gray-700 hover:text-gold-accent"
          }`}
        >
          <span>Shop by Price</span>
          <div className={`transition-transform duration-200 ${priceOpen ? "rotate-180 text-gold-accent" : "opacity-70"}`}>
            <ChevronDown size={14} />
          </div>
        </button>

        {/* Dropdown Menu Panel */}
        {priceOpen && (
          <div className="nav-dropdown-panel absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in duration-200 backdrop-blur-xl">
            <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest px-3 py-1.5 border-b border-gray-100 mb-1.5 font-sans">
              SHOP BY PRICE
            </div>
            <div className="space-y-1">
              {priceItems.map((item) => (
                <LocalizedClientLink
                  key={item.name}
                  href={item.href}
                  onClick={() => setPriceOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold transition-all font-sans hover:bg-gray-100"
                >
                  <span>{item.name}</span>
                </LocalizedClientLink>
              ))}
            </div>
          </div>
        )}
      </div>

      <LocalizedClientLink
        href="/custom-order"
        className={linkClass("/custom-order")}
        data-testid="nav-custom-order-link"
      >
        Custom Order
      </LocalizedClientLink>

      <LocalizedClientLink
        href="/about"
        className={linkClass("/about")}
        data-testid="nav-about-link"
      >
        About
      </LocalizedClientLink>

      <LocalizedClientLink
        href="/contact"
        className={linkClass("/contact")}
        data-testid="nav-contact-link"
      >
        Contact Us
      </LocalizedClientLink>
    </>
  )
}

export default NavLinks

