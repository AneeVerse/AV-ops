"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

interface Testimonial {
  id: string
  text: string
  name: string
  rating: number
  avatar?: string
}

interface TestimonialsProps {
  initialData?: {
    title: string
    testimonials: Testimonial[]
  } | null
}

const Testimonials = ({ initialData }: TestimonialsProps) => {
  // Fallback to default testimonials if API returns empty
  const defaultTestimonials: Testimonial[] = [
    {
      id: "1",
      text: "The moissanite sparkles even more beautifully than I imagined. The sterling silver setting feels substantial and elegant.",
      name: "Priya S.",
      rating: 5,
    },
    {
      id: "2",
      text: "Ordered a custom ring for our anniversary. The craftsmanship is exceptional and delivery was faster than expected.",
      name: "Rahul M.",
      rating: 5,
    },
    {
      id: "3",
      text: "Cultura Jewels is now my go-to for fine jewelry. The GRA certification and quality at this price point is unmatched.",
      name: "Anita K.",
      rating: 4.5,
    },
    {
      id: "4",
      text: "Stunning earrings that catch the light from every angle. The packaging felt as premium as the jewelry itself.",
      name: "Sneha P.",
      rating: 5,
    },
    {
      id: "5",
      text: "Bought a pendant for my wife — she hasn't taken it off since. Brilliant cut, flawless finish.",
      name: "Rajesh K.",
      rating: 5,
    },
  ]

  const [currentIndex, setCurrentIndex] = useState(0)
  const [title, setTitle] = useState<string>(initialData?.title || "What Our Customers Say")
  const [testimonials, setTestimonials] = useState<Testimonial[]>(
    initialData?.testimonials && initialData.testimonials.length > 0
      ? initialData.testimonials
      : defaultTestimonials
  )
  // Always start with 1 to ensure consistent SSR/client hydration
  const [itemsPerView, setItemsPerView] = useState(1)

  useEffect(() => {
    // Update itemsPerView based on window width after mount
    const updateItemsPerView = () => {
      if (window.innerWidth >= 768) {
        setItemsPerView(3)
      } else if (window.innerWidth >= 400) {
        setItemsPerView(2)
      } else {
        setItemsPerView(1)
      }
    }

    updateItemsPerView()
    window.addEventListener('resize', updateItemsPerView)

    return () => window.removeEventListener('resize', updateItemsPerView)
  }, [])

  const displayTestimonials = testimonials.length > 0 ? testimonials : defaultTestimonials

  const getDisplayTestimonials = () => {
    const endIndex = currentIndex + itemsPerView
    if (endIndex <= displayTestimonials.length) {
      return displayTestimonials.slice(currentIndex, endIndex)
    }
    return [...displayTestimonials.slice(currentIndex), ...displayTestimonials.slice(0, endIndex - displayTestimonials.length)]
  }

  const nextTestimonials = () => {
    setCurrentIndex((prev) => (prev + itemsPerView) % Math.max(displayTestimonials.length, 1))
  }

  const prevTestimonials = () => {
    setCurrentIndex((prev) => (prev - itemsPerView + displayTestimonials.length) % Math.max(displayTestimonials.length, 1))
  }

  const visibleTestimonials = getDisplayTestimonials()
  // For 340px-399px range (itemsPerView = 1), always show navigation if more than 1 testimonial exists
  const hasMore = itemsPerView === 1
    ? displayTestimonials.length > 1
    : displayTestimonials.length > itemsPerView

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  const renderStars = (rating: number, testimonialId: string) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    return (
      <div className="flex gap-0.5 sm:gap-1 items-center">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return (
              <svg
                key={i}
                className="testimonial-star w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )
          } else if (i === fullStars && hasHalfStar) {
            return (
              <svg
                key={i}
                className="testimonial-star w-3 h-3 sm:w-4 sm:h-4 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <defs>
                  <linearGradient id={`half-${i}-${testimonialId}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <path
                  fill={`url(#half-${i}-${testimonialId})`}
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>
            )
          } else {
            return (
              <svg
                key={i}
                className="testimonial-star w-3 h-3 sm:w-4 sm:h-4 text-gray-300"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )
          }
        })}
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media (min-width: 340px) and (max-width: 399px) {
            .testimonials-outer-section {
              padding-left: 0.5rem !important;
              padding-right: 0.5rem !important;
            }
            .testimonials-container {
              max-width: 100% !important;
              padding: 1rem !important;
            }
            .testimonials-title {
              font-size: 1.125rem !important;
              margin-bottom: 1.25rem !important;
            }
            .testimonials-large-quote {
              font-size: 2.5rem !important;
              top: -0.5rem !important;
            }
            .testimonials-grid {
              display: flex !important;
              flex-wrap: nowrap !important;
              flex-direction: row !important;
              justify-content: flex-start !important;
              align-items: stretch !important;
              gap: 0 !important;
              margin-bottom: 1.25rem !important;
              overflow: visible !important;
              width: 100% !important;
              position: relative !important;
            }
            .testimonial-card {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 100% !important;
              flex: 0 0 100% !important;
              flex-shrink: 0 !important;
              height: auto !important;
              min-height: 180px !important;
              padding: 0.875rem !important;
              border-radius: 1.125rem !important;
              margin: 0 !important;
              display: block !important;
            }
            /* Force only first card to show at 340px-399px */
            .testimonials-grid > .testimonial-card:nth-child(n+2) {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              width: 0 !important;
              height: 0 !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .testimonial-small-quote {
              font-size: 1.75rem !important;
              top: 0.625rem !important;
              left: 0.625rem !important;
            }
            .testimonial-text {
              font-size: 0.6875rem !important;
              min-height: 55px !important;
              margin-bottom: 0.625rem !important;
            }
            .testimonial-avatar {
              width: 2.25rem !important;
              height: 2.25rem !important;
            }
            .testimonial-name {
              font-size: 0.6875rem !important;
            }
            .testimonial-star {
              width: 0.6875rem !important;
              height: 0.6875rem !important;
            }
            .testimonial-avatar-initials {
              font-size: 0.6875rem !important;
            }
            .testimonial-star-container {
              gap: 0.125rem !important;
            }
            .testimonials-nav-button {
              width: 2rem !important;
              height: 2rem !important;
              display: flex !important;
            }
            .testimonials-nav-svg {
              width: 1rem !important;
              height: 1rem !important;
            }
            .testimonials-nav-container {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              gap: 0.75rem !important;
              margin-top: 1rem !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
          }
          @media (min-width: 400px) and (max-width: 639px) {
            .testimonials-outer-section {
              padding-left: 0.5rem !important;
              padding-right: 0.5rem !important;
            }
            .testimonials-container {
              max-width: 100% !important;
              padding: 0.75rem !important;
            }
            .testimonials-title {
              font-size: 1.25rem !important;
              margin-bottom: 1.25rem !important;
            }
            .testimonials-large-quote {
              font-size: 3rem !important;
              top: -0.5rem !important;
            }
            .testimonials-grid {
              display: flex !important;
              flex-wrap: wrap !important;
              gap: 0.625rem !important;
              margin-bottom: 1.25rem !important;
              justify-content: center !important;
            }
            .testimonial-card {
              width: calc(50% - 0.3125rem) !important;
              max-width: calc(50% - 0.3125rem) !important;
              min-width: 0 !important;
              flex: 0 0 calc(50% - 0.3125rem) !important;
              height: auto !important;
              min-height: 200px !important;
              padding: 0.75rem !important;
              border-radius: 1.125rem !important;
              display: block !important;
            }
            .testimonial-card:not(:first-child):not(:nth-child(2)) {
              display: none !important;
            }
            .testimonial-small-quote {
              font-size: 1.75rem !important;
              top: 0.5rem !important;
              left: 0.5rem !important;
            }
            .testimonial-text {
              font-size: 0.625rem !important;
              min-height: 55px !important;
              margin-bottom: 0.5rem !important;
              line-height: 1.4 !important;
            }
            .testimonial-avatar {
              width: 2rem !important;
              height: 2rem !important;
            }
            .testimonial-name {
              font-size: 0.625rem !important;
            }
            .testimonial-star {
              width: 0.6875rem !important;
              height: 0.6875rem !important;
            }
            .testimonial-avatar-initials {
              font-size: 0.6875rem !important;
            }
            .testimonial-star-container {
              gap: 0.125rem !important;
            }
            .testimonials-nav-button {
              width: 1.75rem !important;
              height: 1.75rem !important;
            }
            .testimonials-nav-svg {
              width: 0.75rem !important;
              height: 0.75rem !important;
            }
          }
          @media (min-width: 640px) and (max-width: 767px) {
            .testimonials-container {
              max-width: 100% !important;
              padding: 1.5rem !important;
            }
            .testimonials-title {
              font-size: 1.75rem !important;
              margin-bottom: 2rem !important;
            }
            .testimonials-large-quote {
              font-size: 4rem !important;
              top: -0.75rem !important;
            }
            .testimonials-grid {
              gap: 1.25rem !important;
              margin-bottom: 2rem !important;
            }
            .testimonial-card {
              width: calc(50% - 0.625rem) !important;
              max-width: calc(50% - 0.625rem) !important;
              min-width: 0 !important;
              height: auto !important;
              min-height: 240px !important;
              padding: 1.25rem !important;
              border-radius: 1.5rem !important;
            }
            .testimonial-small-quote {
              font-size: 2.5rem !important;
              top: 1rem !important;
              left: 1rem !important;
            }
            .testimonial-text {
              font-size: 0.8125rem !important;
              min-height: 70px !important;
              margin-bottom: 1rem !important;
            }
            .testimonial-avatar {
              width: 2.75rem !important;
              height: 2.75rem !important;
            }
            .testimonial-name {
              font-size: 0.8125rem !important;
            }
            .testimonial-star {
              width: 0.875rem !important;
              height: 0.875rem !important;
            }
            .testimonial-avatar-initials {
              font-size: 0.875rem !important;
            }
            .testimonial-star-container {
              gap: 0.125rem !important;
            }
            .testimonials-nav-button {
              width: 2.5rem !important;
              height: 2.5rem !important;
            }
            .testimonials-nav-svg {
              width: 1.125rem !important;
              height: 1.125rem !important;
            }
          }
          @media (min-width: 768px) and (max-width: 1023px) {
            .testimonials-outer-section {
              padding-left: 1rem !important;
              padding-right: 1rem !important;
            }
            .testimonials-container {
              max-width: 100% !important;
              padding: 1rem !important;
            }
            .testimonials-title {
              font-size: 1.5rem !important;
              margin-bottom: 1.5rem !important;
            }
            .testimonials-large-quote {
              font-size: 3.5rem !important;
              top: -0.5rem !important;
            }
            .testimonials-grid {
              gap: 0.75rem !important;
              margin-bottom: 1.5rem !important;
              justify-content: center !important;
            }
            .testimonial-card {
              width: calc(33.333% - 0.5rem) !important;
              max-width: calc(33.333% - 0.5rem) !important;
              min-width: 0 !important;
              flex: 0 0 calc(33.333% - 0.5rem) !important;
              height: auto !important;
              min-height: 220px !important;
              padding: 0.875rem !important;
              border-radius: 1.25rem !important;
            }
            .testimonial-small-quote {
              font-size: 2rem !important;
              top: 0.625rem !important;
              left: 0.625rem !important;
            }
            .testimonial-text {
              font-size: 0.6875rem !important;
              min-height: 60px !important;
              margin-bottom: 0.625rem !important;
              line-height: 1.4 !important;
            }
            .testimonial-avatar {
              width: 2.25rem !important;
              height: 2.25rem !important;
            }
            .testimonial-name {
              font-size: 0.6875rem !important;
            }
            .testimonial-star {
              width: 0.75rem !important;
              height: 0.75rem !important;
            }
            .testimonial-avatar-initials {
              font-size: 0.75rem !important;
            }
            .testimonial-star-container {
              gap: 0.125rem !important;
            }
            .testimonials-nav-button {
              width: 2rem !important;
              height: 2rem !important;
            }
            .testimonials-nav-svg {
              width: 0.875rem !important;
              height: 0.875rem !important;
            }
          }
          @media (min-width: 1024px) and (max-width: 1440px) {
            .testimonials-container {
              max-width: 1360px !important;
              padding: 2rem !important;
            }
            .testimonials-title {
              font-size: 2.25rem !important;
              margin-bottom: 3rem !important;
            }
            .testimonials-large-quote {
              font-size: 6rem !important;
            }
            .testimonials-grid {
              gap: 1.5rem !important;
              margin-bottom: 2rem !important;
            }
            .testimonial-card {
              width: calc(33.333% - 1rem) !important;
              max-width: calc(33.333% - 1rem) !important;
              min-width: 0 !important;
              height: auto !important;
              min-height: 260px !important;
              padding: 1.5rem !important;
              border-radius: 1.875rem !important;
            }
            .testimonial-small-quote {
              font-size: 3rem !important;
              top: 1rem !important;
              left: 1rem !important;
            }
            .testimonial-text {
              font-size: 0.875rem !important;
              min-height: 80px !important;
              margin-bottom: 1rem !important;
            }
            .testimonial-avatar {
              width: 3rem !important;
              height: 3rem !important;
            }
            .testimonial-name {
              font-size: 0.875rem !important;
            }
            .testimonial-star {
              width: 1rem !important;
              height: 1rem !important;
            }
            .testimonial-avatar-initials {
              font-size: 1rem !important;
            }
            .testimonial-star-container {
              gap: 0.25rem !important;
            }
            .testimonials-nav-button {
              width: 2.5rem !important;
              height: 2.5rem !important;
            }
            .testimonials-nav-svg {
              width: 1.25rem !important;
              height: 1.25rem !important;
            }
          }
          @media (min-width: 1441px) {
            .testimonials-container {
              max-width: 1360px !important;
              padding: 2rem !important;
            }
            .testimonials-title {
              font-size: 2.5rem !important;
              margin-bottom: 3rem !important;
            }
            .testimonials-large-quote {
              font-size: 8rem !important;
            }
            .testimonials-grid {
              gap: 1.5rem !important;
              margin-bottom: 2rem !important;
            }
            .testimonial-card {
              width: calc(33.333% - 1rem) !important;
              max-width: 400px !important;
              min-width: 0 !important;
              height: 268px !important;
              padding: 1.5rem !important;
              border-radius: 1.875rem !important;
            }
            .testimonial-small-quote {
              font-size: 4rem !important;
            }
            .testimonial-text {
              font-size: 0.875rem !important;
              min-height: 80px !important;
            }
            .testimonial-star {
              width: 1rem !important;
              height: 1rem !important;
            }
            .testimonial-avatar-initials {
              font-size: 1.125rem !important;
            }
            .testimonial-star-container {
              gap: 0.25rem !important;
            }
          }
        `
      }} />
      <div className="w-full py-8 sm:py-12 md:py-14 lg:py-16 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 bg-ivory-bg testimonials-outer-section">
        <div className="w-full flex justify-center">
          <div className="relative w-full testimonials-container" style={{ maxWidth: '1360px' }}>
            {/* Large Quotation Marks */}
            <div className="absolute top-0 left-0 testimonials-large-quote font-bold text-gold-accent opacity-20 hidden sm:block" style={{ fontFamily: "serif", lineHeight: "1" }}>
              "
            </div>
            <div className="absolute top-0 right-0 testimonials-large-quote font-bold text-gold-accent opacity-20 hidden sm:block" style={{ fontFamily: "serif", lineHeight: "1" }}>
              "
            </div>

            {/* Title */}
            <div className="text-center relative z-10 mb-6 sm:mb-8 md:mb-10 lg:mb-12">
              <span className="text-[#D4AF37] font-semibold tracking-[0.25em] text-[10px] sm:text-xs uppercase block mb-3 font-sans">
                Loved Worldwide
              </span>
              <h2 className="h2-serif testimonials-title mb-0">
                {title}
              </h2>
              <div className="flex items-center justify-center gap-3 mt-4">
                <span className="h-[1px] w-10 bg-[#D4AF37]/50" />
                <span className="text-[#D4AF37] text-[8px] transform rotate-45">&#9670;</span>
                <span className="h-[1px] w-10 bg-[#D4AF37]/50" />
              </div>
            </div>

            {/* Testimonials Grid */}
            <div className="relative z-10">
              <div className="flex flex-wrap justify-center testimonials-grid gap-4 sm:gap-5 md:gap-6">
                {visibleTestimonials.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    className="bg-gradient-to-b from-white to-[#FBF7EE] group relative testimonial-card w-full sm:w-auto transition-all duration-500 ease-out sm:hover:-translate-y-3 sm:hover:scale-[1.03] shadow-[0_10px_30px_rgba(13,26,17,0.06)] hover:shadow-[0_24px_50px_rgba(212,175,55,0.18)] border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 z-10 hover:z-20 cursor-default"
                  >
                    {/* Small Quotation Mark */}
                    <div 
                      className="absolute top-3 sm:top-4 left-3 sm:left-4 testimonial-small-quote font-bold text-gold-accent opacity-30 transition-all duration-500 ease-out group-hover:opacity-50 group-hover:scale-125 group-hover:-translate-y-1 group-hover:-translate-x-1" 
                      style={{ fontFamily: "serif", lineHeight: "1" }}
                    >
                      "
                    </div>

                    {/* Review Content */}
                    <div className="relative z-10 mt-4 sm:mt-6 transition-transform duration-500 group-hover:translate-x-1">
                      <p className="text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 italic testimonial-text" style={{ color: '#222222' }}>
                        {testimonial.text}
                      </p>

                      {/* Reviewer Info */}
                      <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                        <div className="testimonial-avatar w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gold-accent/10 flex items-center justify-center flex-shrink-0 border-2 border-gold-border/30 transition-all duration-500 group-hover:border-gold-accent/40 group-hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                          {testimonial.avatar ? (
                            <Image
                              src={testimonial.avatar}
                              alt={testimonial.name}
                              width={48}
                              height={48}
                              className="w-full h-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <span className="text-[#0d1a11] font-bold testimonial-avatar-initials text-xs sm:text-sm md:text-base lg:text-lg transition-transform duration-500 group-hover:scale-110">
                              {getInitials(testimonial.name)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 transition-transform duration-500 group-hover:translate-x-1">
                          <p className="text-gray-900 font-bold text-xs sm:text-sm testimonial-name truncate transition-colors duration-300 group-hover:text-gold-accent">
                            {testimonial.name}
                          </p>
                          {/* Star Rating */}
                          <div className="testimonial-star-container transition-transform duration-500 group-hover:scale-105 origin-left">
                            {renderStars(testimonial.rating, testimonial.id)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Arrows */}
              {hasMore && (
                <div className="flex justify-center items-center gap-3 sm:gap-4 mt-4 sm:mt-6 testimonials-nav-container">
                  <button
                    onClick={prevTestimonials}
                    className="testimonials-nav-button w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center transition-colors hover:bg-royal-blue hover:border-royal-blue hover:text-white"
                    aria-label="Previous testimonials"
                  >
                    <svg
                      className="testimonials-nav-svg w-4 h-4 sm:w-5 sm:h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextTestimonials}
                    className="testimonials-nav-button w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-gold-accent bg-royal-blue flex items-center justify-center text-white transition-colors hover:bg-gold-accent hover:border-gold-accent"
                    aria-label="Next testimonials"
                  >
                    <svg
                      className="testimonials-nav-svg w-4 h-4 sm:w-5 sm:h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Testimonials
