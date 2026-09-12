"use client"

import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import HeroProductCarousel from "./hero-product-carousel"
import { useState, useEffect } from "react"

type MockupHeroProps = {
  carouselProducts?: HttpTypes.StoreProduct[]
}

const MockupHero = ({ carouselProducts = [] }: MockupHeroProps) => {
  const [scrollY, setScrollY] = useState(0)
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
          setScrollY(window.scrollY)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Mobile zooms the model in more on scroll; desktop keeps its original feel.
  const modelScale = isMobile
    ? 1 + scrollY * 0.0009
    : 1 + scrollY * 0.00035

  return (
    <section
      className="relative w-full overflow-hidden select-none"
      style={{
        backgroundImage: "radial-gradient(circle at center, #1b3523 0%, #0d1a11 100%)",
        marginTop: "calc(-1 * var(--site-header-h, 3.5rem))",
        paddingTop: "var(--site-header-h, 3.5rem)",
        height: "100svh",
        minHeight: "35rem"
      }}
    >
      {/* ── BACKGROUND LOGO TEXT "SYMBOL OF LOVE" (Parallax: Sinks and fades out) ── */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-1"
        style={{
          transform: `translate3d(0, 0, 0) scale(${1 + scrollY * 0.00028})`,
          opacity: Math.max(0.1, 0.85 - scrollY / 500),
          willChange: "transform, opacity",
        }}
      >
        <div className="relative w-[82%] md:w-[86%] lg:w-[80%] max-w-[1300px] aspect-[1.5] translate-y-[4%] md:-translate-y-[8%] sm:-translate-y-[12%]">
          <Image
            src="/hero/hero-symbol-of-love.png"
            alt="SYMBOL OF LOVE"
            fill
            priority
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 85vw"
          />
        </div>
      </div>

      {/* ── FOREGROUND MODEL IMAGE (Parallax: Rises up and scales forward) ── */}
      <div 
        className="absolute inset-x-0 bottom-[92px] md:bottom-0 flex justify-center pointer-events-none z-10"
        style={{
          transform: `translate3d(0, -${scrollY * 0.1}px, 0) scale(${modelScale})`,
          transformOrigin: isMobile ? "bottom center" : "center",
          willChange: "transform",
        }}
      >
        <div className="relative w-full max-w-[1440px] h-[58svh] md:h-[78svh] lg:h-[90svh] min-h-[19rem] md:min-h-[22rem] max-h-[720px]">
          <Image
            src="/hero/hero-model.png"
            alt="Atelier Model"
            fill
            priority
            className="object-contain object-bottom pointer-events-none select-none scale-90 md:scale-100 translate-y-[2px]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 50vw"
          />
        </div>
      </div>

      {/* ── DESKTOP/TABLET SIDE PANELS ── */}
      <div className="absolute inset-0 z-20 hidden md:flex items-end justify-between pointer-events-none max-w-[1440px] mx-auto px-10 lg:px-16 xl:px-20 pb-[8%] lg:pb-[10%]">
        <div className="w-[280px] lg:w-[320px] flex flex-col items-start gap-5 pointer-events-auto text-left">
          <p className="text-white/80 font-sans text-xs lg:text-sm leading-relaxed tracking-wide font-light">
            Personalized service that goes beyond expectations: together, we&apos;ll craft the ring of your dreams
          </p>
          <LocalizedClientLink
            href="/store"
            className="group flex items-center gap-3 text-gold-accent hover:text-white text-xs font-semibold uppercase tracking-[0.25em] transition-all duration-300 border-b border-gold-accent/40 pb-1.5 hover:border-white"
          >
            Choose Your Ring
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
          </LocalizedClientLink>
        </div>

        <HeroProductCarousel products={carouselProducts} />
      </div>

      {/* ── MOBILE VIEW PANEL (clean gradient fade + tagline + CTA) ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 md:hidden pointer-events-none">
        {/* Gradient scrim so the model fades softly into the dark and text stays legible */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#0d1a11] via-[#0d1a11]/75 to-transparent" />
        <div className="relative px-6 pb-9 pt-4 flex flex-col items-center gap-5 text-center pointer-events-auto">
          <p className="text-white/85 font-sans text-[12.5px] leading-relaxed max-w-[300px]">
            Personalized service that goes beyond expectations together, we&apos;ll craft the ring of your dreams.
          </p>
          <LocalizedClientLink
            href="/store"
            className="inline-flex items-center gap-2 rounded-full bg-gold-accent text-[#0d1a11] px-8 py-3 text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
          >
            Choose Your Ring
            <span>&rarr;</span>
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}

export default MockupHero
