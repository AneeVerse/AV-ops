"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import Image from "next/image"
import { XMark } from "@medusajs/icons"
import { useRouter, useSearchParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import NavLinks from "@modules/layout/components/nav-links"

type SearchContextType = {
  isSearchOpen: boolean
  setIsSearchOpen: (isOpen: boolean) => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export const useSearchContext = () => {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error("useSearchContext must be used within DesktopSearch")
  }
  return context
}

type DesktopSearchProps = {
  countryCode: string
  children?: React.ReactNode
}

const DesktopSearch = ({ countryCode, children }: DesktopSearchProps) => {
  const searchParams = useSearchParams()
  const q = searchParams.get("q") || ""
  const [isSearchOpen, setIsSearchOpen] = useState(!!q)
  const [searchQuery, setSearchQuery] = useState(q)
  const prevOpenRef = useRef(!!q)
  const router = useRouter()

  useEffect(() => {
    setSearchQuery(q)
  }, [q])

  // Lock body scroll when search is open
  useEffect(() => {
    if (isSearchOpen !== prevOpenRef.current) {
      prevOpenRef.current = isSearchOpen
      if (isSearchOpen) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = "unset"
      }
    }
  }, [isSearchOpen])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [])

  const handleCloseSearch = () => {
    setIsSearchOpen(false)
    // Don't clear searchQuery so it stays if user reopens
  }

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      const query = searchQuery.trim()
      // Navigate to search page
      router.push(`/store?q=${encodeURIComponent(query)}`)
      setIsSearchOpen(false)
    }
  }

  return (
    <SearchContext.Provider value={{ isSearchOpen, setIsSearchOpen }}>
      {/* Navigation Links - centered between logo and actions */}
      <div
        className={`hidden sm:flex flex-1 items-center justify-center min-w-0 self-stretch transition-all duration-300 ${
          isSearchOpen ? "opacity-0 pointer-events-none w-0 overflow-hidden flex-none" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-x-6 xl:gap-x-8">
          <NavLinks countryCode={countryCode} />
        </div>
      </div>

      {/* Search Bar - ONLY shows on Desktop (1024px+) */}
      <div className={`hidden lg:flex items-center gap-x-6 xl:gap-x-8 h-full transition-all duration-300 ${isSearchOpen ? "opacity-100 w-auto" : "opacity-0 pointer-events-none w-0 overflow-hidden"
        }`}>
        <div className="flex items-center gap-3 w-[650px]">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search for products, brands and more"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit()
                }
              }}
              className="w-full h-11 pl-12 pr-4 border border-gray-200 rounded-full bg-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent"
            />
            <Image
              src="/Search.svg"
              alt="Search"
              width={20}
              height={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60"
            />
          </div>

          <button
            onClick={handleCloseSearch}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
          >
            <XMark className="w-4 h-5 text-gray-600" />
          </button>
        </div>

      </div>
      {children}
    </SearchContext.Provider>
  )
}

// Search Icon Component - to be used in action icons area
export const DesktopSearchIcon = () => {
  const { isSearchOpen, setIsSearchOpen } = useSearchContext()

  return (
    <button
      onClick={() => setIsSearchOpen(true)}
      className={`hidden lg:flex items-center hover:opacity-80 transition-all duration-300 ${isSearchOpen ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100 w-auto"
        }`}
      data-testid="nav-search-button"
    >
      <Image
        src="/Search.svg"
        alt="Search"
        width={26}
        height={26}
        className="w-5 h-5"
      />
    </button>
  )
}

export default DesktopSearch
