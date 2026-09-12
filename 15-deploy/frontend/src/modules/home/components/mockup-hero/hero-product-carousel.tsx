"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type HeroProductCarouselProps = {
  products: HttpTypes.StoreProduct[]
}

function productImage(product: HttpTypes.StoreProduct) {
  return (
    product.thumbnail ||
    product.images?.[0]?.url ||
    "/hero/placeholder.png"
  )
}

const HeroProductCarousel = ({ products }: HeroProductCarouselProps) => {
  const items = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        handle: product.handle || "",
        title: product.title || "Product",
        image: productImage(product),
      })),
    [products]
  )

  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateScrollState = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setCanScrollPrev(track.scrollLeft > 4)
    setCanScrollNext(
      track.scrollLeft + track.clientWidth < track.scrollWidth - 4
    )
  }, [])

  useEffect(() => {
    updateScrollState()
    const track = trackRef.current
    if (!track) return

    track.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)

    return () => {
      track.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [items, updateScrollState])

  const scrollByCard = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector<HTMLElement>("[data-hero-card]")
    if (!card) return
    const gap = 16
    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: "smooth",
    })
  }

  const genderCards = [
    {
      id: "men",
      title: "Men",
      href: "/store?category=men",
      image: "/category/rings.png",
    },
    {
      id: "women",
      title: "Women",
      href: "/store?category=women",
      image: "/category/earrings.png",
    },
  ]

  return (
    <div className="flex items-center gap-4 pointer-events-auto py-1">
      {/* --- PREVIOUS SLIDER ARROW BUTTON (COMMENTED OUT AS REQUESTED) --- */}
      {/* 
      <button
        type="button"
        aria-label="Previous products"
        onClick={() => scrollByCard(-1)}
        disabled={!canScrollPrev}
        className="w-8 h-8 rounded-full border border-white/20 hover:border-gold-accent text-white/50 hover:text-gold-accent flex items-center justify-center text-xs backdrop-blur-sm transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0"
      >
        <span>&larr;</span>
      </button>
      */}

      {/* --- 2 CARDS: MEN & WOMEN --- */}
      <div className="flex gap-4 px-1 py-1">
        {genderCards.map((card) => (
          <LocalizedClientLink
            key={card.id}
            href={card.href}
            data-hero-card
            className="w-[120px] lg:w-[132px] shrink-0 aspect-[0.7] border border-white/10 hover:border-gold-accent rounded-2xl p-3 bg-black/15 hover:bg-black/25 backdrop-blur-md flex flex-col justify-between items-center transition-[border-color,background-color,box-shadow] duration-300 group hover:shadow-[0_0_24px_rgba(212,175,55,0.22)]"
          >
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
              <Image
                src={card.image}
                alt={card.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="150px"
              />
            </div>
            <div className="text-center mt-2">
              <p className="text-xs lg:text-sm font-semibold tracking-wider text-white/90 group-hover:text-gold-accent transition-colors">
                {card.title}
              </p>
            </div>
          </LocalizedClientLink>
        ))}
      </div>

      {/* --- DYNAMIC PRODUCT ITEMS CAROUSEL MAP (COMMENTED OUT AS REQUESTED) --- */}
      {/* 
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth w-[288px] lg:w-[308px] px-1 py-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((item) => (
          <LocalizedClientLink
            key={item.id}
            href={`/products/${item.handle}`}
            data-hero-card
            className="w-[120px] lg:w-[132px] shrink-0 aspect-[0.7] border border-white/10 hover:border-gold-accent rounded-2xl p-3 bg-black/15 hover:bg-black/25 backdrop-blur-md flex flex-col justify-between items-center transition-[border-color,background-color,box-shadow] duration-300 group hover:shadow-[0_0_24px_rgba(212,175,55,0.22)] scroll-snap-align-start"
          >
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="150px"
                unoptimized={item.image.startsWith("http")}
              />
            </div>
            <div className="text-center mt-2">
              <p className="text-[10px] lg:text-[11px] font-medium tracking-wide text-white/90 group-hover:text-gold-accent transition-colors line-clamp-2">
                {item.title}
              </p>
            </div>
          </LocalizedClientLink>
        ))}
      </div>
      */}

      {/* --- NEXT SLIDER ARROW BUTTON (COMMENTED OUT AS REQUESTED) --- */}
      {/* 
      <button
        type="button"
        aria-label="Next products"
        onClick={() => scrollByCard(1)}
        disabled={!canScrollNext}
        className="w-8 h-8 rounded-full border border-white/20 hover:border-gold-accent text-white/50 hover:text-gold-accent flex items-center justify-center text-xs backdrop-blur-sm transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0"
      >
        <span>&rarr;</span>
      </button>
      */}
    </div>
  )
}

export default HeroProductCarousel
