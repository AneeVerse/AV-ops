"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const CelestiqueCollection = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const [relativeScrollY, setRelativeScrollY] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (sectionRef.current) {
            const rect = sectionRef.current.getBoundingClientRect()
            // Starts increasing from 0 as soon as the top of the section enters the bottom of the viewport
            const val = window.innerHeight - rect.top
            setRelativeScrollY(Math.max(0, val))
          }
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Clamp the scroll progress to a max of 900px of scrolling after entry
  const clampedScroll = Math.min(900, relativeScrollY)
  // Mobile: stays anchored at the bottom and zooms up in scale on scroll (hero-style).
  // Desktop: unchanged.
  const handScale = isMobile
    ? 1.0 + clampedScroll * 0.0009
    : 1.0 + clampedScroll * 0.0003
  // Mobile: pinned near the bottom (no upward slide). Desktop: original parallax rise.
  const handTranslateY = isMobile
    ? 0
    : 250 - clampedScroll * 0.33

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden select-none"
      style={{
        backgroundColor: "#d1c7bd",
        height: isMobile ? "40rem" : "100svh",
        minHeight: isMobile ? "36rem" : "42rem",
        maxHeight: isMobile ? "44rem" : "750px",
      }}
    >
      {/* Mobile readability scrim so white text stays legible over the light backdrop */}
      <div className="md:hidden absolute inset-0 z-[15] pointer-events-none bg-gradient-to-b from-black/35 via-black/5 to-black/30" />
      {/* ── CENTERED ARTWORK CONTAINER (Aligns hand and logo text perfectly without overlap) ── */}
      <div className="absolute inset-0 mx-auto w-full max-w-[960px] pointer-events-none select-none z-10">
        {/* ── BACKGROUND LOGO TEXT "CULTURA" (Z-Index: 5, Shifted Up & Scaled) ── */}
        <div 
          className="absolute inset-0 z-5 hidden md:block"
          style={{ transform: "translate3d(0, -17%, 0) scale(1.30)", willChange: "transform" }}
        >
          <Image
            src="/collection/culturajewels-text.png"
            alt="Cultura Title Logo"
            fill
            priority
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 960px"
          />
        </div>

        {/* ── FOREGROUND MODEL HAND (Z-Index: 10, Overlaps Logo, Shifted Down & Scaled) ── */}
        <div 
          className="absolute inset-0 z-10"
          style={{ 
            transform: `translate3d(0, ${handTranslateY}px, 0) scale(${handScale})`, 
            transformOrigin: isMobile ? "bottom center" : "center",
            willChange: "transform" 
          }}
        >
          <Image
            src="/collection/celestique-hand.png"
            alt="Cultura Hand Model"
            fill
            priority
            className="object-contain object-bottom md:object-center"
            sizes="(max-width: 1024px) 100vw, 960px"
          />
        </div>
      </div>

      {/* ── EDITORIAL FLANKING PANELS (Z-Index: 20) ── */}
      <div className="relative max-w-[1440px] mx-auto h-full px-6 sm:px-12 lg:px-20 pt-10 pb-[10%] md:pt-0 md:pb-[8%] flex flex-col md:flex-row md:items-end justify-between z-20 pointer-events-none">
        
        {/* Left Column: Description Card */}
        <div className="w-full md:w-[280px] lg:w-[320px] flex flex-col items-start gap-4 text-left pointer-events-auto mt-0 md:mt-0">
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium uppercase leading-none tracking-wider">
            Collection<br />
            <span className="text-white mt-1 inline-block">2026</span>
          </h2>
          <p className="text-white/85 font-sans text-xs lg:text-sm leading-relaxed font-light">
            Discover exquisite jewelry inspired by the beauty of the heavens. Each piece is crafted to bring elegance and grace to your most cherished occasions.
          </p>
          <LocalizedClientLink
            href="/store"
            className="group inline-flex items-center gap-3 bg-[#1c1b18] text-white hover:bg-[#D4AF37] hover:text-[#1c1b18] transition-all duration-300 rounded-full px-6 py-2.5 text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase mt-2 shadow-sm"
          >
            Discover
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
          </LocalizedClientLink>
        </div>

        {/* Right Column: Menu Options */}
        <div className="w-full md:w-[280px] lg:w-[340px] flex flex-col gap-6 md:gap-8 text-right pointer-events-auto mt-8 md:mt-0">
          <div className="flex flex-col gap-1.5 pr-2 md:pr-0 mb-28 md:mb-0">
            <p className="text-white/95 font-serif text-[11px] lg:text-[13px] tracking-[0.22em] uppercase font-normal leading-relaxed">
              A celestial touch
            </p>
            <p className="text-white/95 font-serif text-[11px] lg:text-[13px] tracking-[0.22em] uppercase font-normal leading-relaxed">
              for timeless moments
            </p>
          </div>

          <ul className="flex flex-col w-full text-left font-sans">
            {[
              { name: "Rings", path: "/store?category=rings" },
              { name: "Earrings", path: "/store?category=earrings" },
              { name: "Necklaces", path: "/store?category=necklaces" },
              { name: "Bracelets", path: "/store?category=bracelets" }
            ].map((item) => (
              <li key={item.name} className="border-t border-white/20 last:border-b py-3">
                <LocalizedClientLink
                  href={item.path}
                  className="group flex items-center justify-between text-white hover:text-[#D4AF37] transition-colors font-medium text-xs lg:text-sm uppercase tracking-[0.2em]"
                >
                  <span>{item.name}</span>
                  <span className="transform group-hover:translate-x-1.5 transition-transform duration-300 text-white/50 group-hover:text-[#D4AF37]">&rarr;</span>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </section>
  )
}

export default CelestiqueCollection
