"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const AboutTemplate = () => {
  const [scrollY, setScrollY] = useState(0)

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
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const clampedScroll = Math.min(800, scrollY)
  
  // Parallax wordmark (balanced vertical placement behind hands/ring)
  const wordmarkScale = 1.85 + clampedScroll * 0.0001
  const wordmarkTranslateY = -65 - clampedScroll * 0.15

  // Parallax model hands (rises upwards on scroll and stops smoothly at 0px offset without going higher)
  const handScale = 1.65 + clampedScroll * 0.0005
  const handTranslateY = Math.max(0, 120 - clampedScroll * 0.38)

  return (
    <div className="bg-ivory-bg min-h-screen">
      {/* 1. Hero Section (Mockup Match - Full Screen Prominence) */}
      <section className="relative w-full h-[88vh] sm:h-[92vh] md:h-[95vh] min-h-[650px] bg-ivory-bg overflow-hidden flex items-center justify-center border-b border-gray-100">
        
        {/* Corner Text Labels - Top Left */}
        <div className="absolute top-6 left-6 sm:top-10 sm:left-10 md:top-12 md:left-12 z-30 flex flex-col pointer-events-none select-none">
          <span className="font-serif text-[#0A1D37] text-base sm:text-lg md:text-xl tracking-[0.25em] font-semibold leading-none">
            CULTURA JEWELS
          </span>
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.18em] opacity-80 mt-1.5 sm:mt-2 font-medium">
            TIMELESS BRILLIANCE
          </span>
        </div>

        {/* Corner Text Labels - Top Right */}
        <div className="absolute top-6 right-6 sm:top-10 sm:right-10 md:top-12 md:right-12 z-30 flex flex-col text-right pointer-events-none select-none">
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.25em] leading-normal font-semibold">FINE</span>
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.25em] leading-normal font-semibold">JEWELRY</span>
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.25em] leading-normal font-semibold">ATELIER</span>
        </div>

        {/* Corner Text Labels - Bottom Left */}
        <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-10 md:bottom-12 md:left-12 z-30 flex flex-col pointer-events-none select-none">
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.18em] leading-normal font-semibold">EVERLASTING SPARKLE</span>
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.18em] leading-normal opacity-80 mt-1 font-medium">CRAFTED TO PERFECTION</span>
        </div>

        {/* Corner Text Labels - Bottom Right */}
        <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 md:bottom-12 md:right-12 z-30 flex flex-col text-right pointer-events-none select-none">
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.18em] leading-normal font-semibold">PURE</span>
          <span className="font-sans text-[#0A1D37] text-[10px] sm:text-xs md:text-sm tracking-[0.18em] leading-normal opacity-80 mt-1 font-medium">RADIANCE</span>
        </div>

        {/* Center: Large Background Wordmark "CULTURA" (z-10) */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none select-none overflow-hidden">
          <div 
            className="relative w-[95%] max-w-[1300px] aspect-[4.8/1] mt-[-11%] sm:mt-[-9%] md:mt-[-7%]"
            style={{
              transform: `translate3d(0, ${wordmarkTranslateY}px, 0) scale(${wordmarkScale})`,
              transformOrigin: "center center",
              willChange: "transform"
            }}
          >
            <Image
              src="/about/cultura-wordmark.png"
              alt="CULTURA Wordmark"
              fill
              sizes="(max-width: 1300px) 95vw, 1300px"
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Center: Foreground "Hands Holding Ring" (z-20) */}
        <div className="absolute bottom-0 inset-x-0 flex justify-center z-20 pointer-events-none select-none h-full overflow-hidden">
          <div className="relative w-[95%] sm:w-[85%] md:w-[75%] max-w-[900px] h-[75%] sm:h-[85%] md:h-[92%] lg:h-[98%] flex items-end justify-center">
            <div 
              className="relative w-full h-full"
              style={{
                transform: `translate3d(0, ${handTranslateY}px, 0) scale(${handScale})`,
                transformOrigin: "bottom center",
                willChange: "transform"
              }}
            >
              <Image
                src="/about/hands-holding-ring.png"
                alt="Hands Holding Ring"
                fill
                sizes="(max-width: 1280px) 95vw, 900px"
                className="object-contain object-bottom filter contrast-[1.05] brightness-95"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Brand Story Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-stretch">
          {/* Text content */}
          <div className="space-y-6 max-w-xl flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-gold-accent block">
              OUR HERITAGE
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#0A1D37] leading-tight">
              A Legacy of Timeless Brilliance
            </h2>
            <p className="text-gray-600 leading-relaxed text-base sm:text-lg">
              Cultura Jewels was established with a singular, unwavering focus: to redefine fine jewelry as a medium of personal storytelling. Our atelier believes that every gemstone and metal contour holds the power to immortalize a memory, celebrate a milestone, or mark a legacy.
            </p>
            <p className="text-gray-600 leading-relaxed text-base sm:text-lg">
              Drawing inspiration from classic proportions and architectural lines, our pieces blend historical grandeur with contemporary restraint. We don't just craft jewelry; we create modern heirlooms designed to accompany you through the journey of a lifetime and beyond.
            </p>
            <div className="pt-4">
              <div className="border-l-2 border-gold-accent pl-4 italic text-[#0A1D37] font-serif text-lg">
                "Every diamond is carefully selected, and every setting is handcrafted, reflecting our dedication to perfection."
              </div>
            </div>
          </div>

          {/* Image content - Stretches to match exact height of text column on desktop */}
          <div className="relative w-full h-full min-h-[380px] lg:min-h-0 aspect-[4/5] lg:aspect-auto rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100/50 bg-white group">
            <Image
              src="/about/about_showcase.png"
              alt="Cultura Jewels Showcase"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-[#0A1D37]/5 mix-blend-multiply transition-opacity group-hover:opacity-0" />
          </div>
        </div>
      </section>

      {/* 3. Craftsmanship & Pillars */}
      <section className="bg-[#FAF8F5] py-20 sm:py-28 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 sm:mb-24">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-gold-accent block">
              OUR STANDARDS
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#0A1D37]">
              Crafted To Perfection
            </h2>
            <p className="text-gray-500 text-base sm:text-lg">
              Behind every creation at Cultura Jewels lies a meticulous orchestration of ethical sourcing, bespoke design, and generations-old craftsmanship.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {[
              {
                title: "Artisanal Mastery",
                desc: "Our master bench jewelers execute every setting, polish, and engraving by hand, ensuring that no two pieces are ever completely identical.",
                num: "01",
              },
              {
                title: "Ethically Sourced",
                desc: "We prioritize sustainability and absolute transparency. All our diamonds are conflict-free, and our gold is 100% ethically sourced.",
                num: "02",
              },
              {
                title: "Bespoke Design",
                desc: "From initial charcoal sketches to the final hand-polish, we collaborate to design jewelry that mirrors the soul and style of the wearer.",
                num: "03",
              },
            ].map((pillar, index) => (
              <div 
                key={index} 
                className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group flex flex-col justify-between min-h-[300px]"
              >
                <div>
                  <div className="font-serif text-3xl font-light text-gold-accent/40 mb-6 group-hover:text-gold-accent transition-colors">
                    {pillar.num}
                  </div>
                  <h3 className="text-xl font-serif font-bold text-[#0A1D37] mb-4">
                    {pillar.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed text-sm sm:text-base">
                    {pillar.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Elegant Call to Action */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto space-y-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#0A1D37] leading-tight">
          Adorn Yourself with Timeless Elegance
        </h2>
        <p className="text-gray-600 max-w-xl mx-auto text-base sm:text-lg">
          Explore our collections of hand-finished fine jewelry and find the perfect piece to speak your story.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
          <LocalizedClientLink
            href="/store"
            className="w-full sm:w-auto bg-[#0A1D37] text-white hover:bg-gold-accent px-8 py-3.5 rounded-full text-sm font-semibold tracking-wider transition-all duration-300 shadow-md hover:shadow-lg uppercase"
          >
            Explore Collections
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/contact"
            className="w-full sm:w-auto bg-transparent border-2 border-[#0A1D37]/20 hover:border-[#0A1D37] text-[#0A1D37] px-8 py-3.5 rounded-full text-sm font-semibold tracking-wider transition-all duration-300 uppercase"
          >
            Book An Appointment
          </LocalizedClientLink>
        </div>
      </section>
    </div>
  )
}

export default AboutTemplate
