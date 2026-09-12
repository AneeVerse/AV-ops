"use client"

import { usePathname } from "next/navigation"
import React, { useState, useEffect } from "react"

export default function NavHeaderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const [isScrolled, setIsScrolled] = useState(false)
  
  // Homepage matcher: matches "/" or "/[countryCode]" (e.g. "/in", "/us") with optional trailing slash
  const isHomepage = pathname === "/" || /^\/[a-z]{2}(\/)?$/i.test(pathname)

  useEffect(() => {
    if (!isHomepage) {
      setIsScrolled(false)
      return
    }

    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    // Initial check
    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [isHomepage])
  
  return (
    <header className={`relative border-b duration-300 transition-all ${
      isHomepage 
        ? isScrolled
          ? "bg-[#132519]/95 border-white/10 text-white home-theme-nav home-theme-nav-scrolled shadow-md"
          : "bg-transparent border-transparent text-white home-theme-nav home-theme-nav-top"
        : "bg-white border-ui-border-base text-ui-fg-subtle"
    }`}>
      {children}
    </header>
  )
}
