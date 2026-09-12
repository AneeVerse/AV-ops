"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type CategoryScrollItem = {
  id: string
  name: string
  handle: string
  image: string
  linkUrl: string
}

type Props = {
  items: CategoryScrollItem[]
}

export default function CategoryMobileScroll({ items }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pausedUntilRef = useRef(0)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || items.length === 0) return

    const pause = () => {
      pausedUntilRef.current = Date.now() + 4000
    }

    el.addEventListener("pointerdown", pause, { passive: true })
    el.addEventListener("touchstart", pause, { passive: true })
    el.addEventListener("wheel", pause, { passive: true })

    const timer = window.setInterval(() => {
      if (!el || Date.now() < pausedUntilRef.current) return
      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 0) return
      const next = el.scrollLeft + Math.max(140, Math.floor(el.clientWidth * 0.55))
      if (next >= maxScroll - 4) {
        el.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        el.scrollTo({ left: next, behavior: "smooth" })
      }
    }, 3200)

    return () => {
      window.clearInterval(timer)
      el.removeEventListener("pointerdown", pause)
      el.removeEventListener("touchstart", pause)
      el.removeEventListener("wheel", pause)
    }
  }, [items.length])

  return (
    <div
      ref={scrollerRef}
      className="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory px-6 pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {items.map((item) => (
        <LocalizedClientLink
          key={item.id}
          href={item.linkUrl}
          className="snap-start shrink-0 w-[42vw] max-w-[180px] flex flex-col items-center text-center group"
        >
          <div className="w-full aspect-square rounded-[16px] bg-[#F5F5F5] flex items-center justify-center p-4 overflow-hidden">
            <Image
              src={item.image}
              alt={item.name}
              width={180}
              height={180}
              className="object-contain max-h-full max-w-full"
              style={{
                maskImage:
                  "radial-gradient(circle at center, white 52%, transparent 74%)",
                WebkitMaskImage:
                  "radial-gradient(circle at center, white 52%, transparent 74%)",
              }}
            />
          </div>
          <h3 className="font-sans text-sm font-normal text-gray-800 mt-3 group-hover:text-[#D4AF37] transition-colors">
            {item.name}
          </h3>
        </LocalizedClientLink>
      ))}
    </div>
  )
}
