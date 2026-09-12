'use client'

import { useState, useMemo, useEffect } from "react"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { getDefaultImageIndexForSelection, getImagesForSelection } from "@lib/util/product"
import { clx } from "@medusajs/ui"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  product?: HttpTypes.StoreProduct
}

import { useRef } from "react"
import { useProductContext } from "@modules/products/context/product-context"
import WishlistIcon from "@modules/products/components/wishlist-icon"
import ShareButton from "@modules/products/components/share-button"

const ImageGallery = ({ images: initialImages, product }: ImageGalleryProps) => {
  const { selectedOptions } = useProductContext()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hasOptionSelection = useMemo(
    () => Object.values(selectedOptions).some(Boolean),
    [selectedOptions]
  )

  // Compute images from full or partial option selection (deduped for color-only picks)
  const images = useMemo(() => {
    if (product && hasOptionSelection) {
      return getImagesForSelection(product, selectedOptions)
    }
    return initialImages
  }, [product, selectedOptions, hasOptionSelection, initialImages])

  const basketCount = useMemo(() => {
    if (!product?.id) return "2"
    const num = product.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return `${(num % 9) + 2}`
  }, [product?.id])

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showRightButton, setShowRightButton] = useState(false)
  const [showLeftButton, setShowLeftButton] = useState(false)

  // Check if scrolling is needed
  const checkScroll = () => {
    const container = scrollContainerRef.current
    if (container) {
      const canScrollLeft = container.scrollLeft > 0
      const canScrollRight = Math.ceil(container.scrollLeft + container.clientWidth) < container.scrollWidth

      setShowLeftButton(canScrollLeft)
      setShowRightButton(canScrollRight)
    }
  }

  // Select the variant's assigned image by default when the selection changes
  useEffect(() => {
    const defaultIndex = product
      ? getDefaultImageIndexForSelection(product, selectedOptions, images)
      : 0

    setSelectedImageIndex(defaultIndex)
    setTimeout(checkScroll, 100)
  }, [selectedOptions, images, product])

  // Handle manual scroll
  const scrollTo = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (container) {
      // Scroll by exactly one thumbnail width (container is divided into 4)
      const scrollAmount = container.clientWidth / 4
      const directionMultiplier = direction === 'left' ? -1 : 1
      container.scrollBy({ left: scrollAmount * directionMultiplier, behavior: 'smooth' })
    }
  }

  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0, percentX: 0, percentY: 0 })
  const [isZooming, setIsZooming] = useState(false)
  const [isPageScrolling, setIsPageScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsPageScrolling(true)
      setIsZooming(false) // Force reset zoom instantly when scrolling starts
      
      // If the entire page reaches the top, reset the gallery scroll too
      if (window.scrollY === 0) {
        const scrollContainer = document.getElementById('product-gallery-container')
        if (scrollContainer && scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsPageScrolling(false)
      }, 300)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPageScrolling) {
      if (isZooming) setIsZooming(false)
      return
    }
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const pxX = e.clientX - left
    const pxY = e.clientY - top
    const x = (pxX / width) * 100
    const y = (pxY / height) * 100
    
    setZoomPosition({ 
      x: pxX, 
      y: pxY, 
      percentX: x, 
      percentY: y 
    })
    
    if (!isZooming) setIsZooming(true)
  }

  const selectedImage = images[selectedImageIndex]

  const zoomFactor = 2
  const lensSize = 200

  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 items-start w-full">
      {/* Left Column - Vertical Thumbnail Gallery (60px x 60px) */}
      {images.length > 0 && (
        <div className="w-full sm:w-[68px] flex-shrink-0 flex flex-row sm:flex-col gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-y-auto sm:max-h-[500px] lg:max-h-[635px] no-scrollbar scroll-smooth p-1 sm:p-1.5">
          {images.map((image, index) => (
            <div
              key={image.id}
              onClick={() => setSelectedImageIndex(index)}
              className={`relative flex-shrink-0 w-[60px] h-[60px] rounded-[12px] overflow-hidden cursor-pointer transition-all duration-200 hover:opacity-90 ${
                selectedImageIndex === index
                  ? 'border-2 border-gold-accent shadow-md'
                  : 'border border-gray-200 hover:border-gray-400 opacity-75 hover:opacity-100'
              }`}
            >
              {!!image.url && (
                <Image
                  src={image.url}
                  priority={index <= 1}
                  className="w-full h-full object-cover rounded-[10px]"
                  alt={`Product thumbnail ${index + 1}`}
                  fill
                  sizes="60px"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Right Column - Main Image (635px x 635px on Desktop) */}
      {selectedImage && (
        <div
          ref={containerRef}
          className="relative w-full aspect-square lg:w-[635px] lg:h-[635px] lg:max-w-[635px] lg:max-h-[635px] bg-ui-bg-subtle rounded-rounded group/main overflow-hidden flex-shrink-0"
          style={{
            borderRadius: '20px',
          }}
        >
          {!!selectedImage.url && (
            <>
              {/* Image Container */}
              <div className="relative w-full h-full overflow-hidden rounded-[20px]">
                <Image
                  src={selectedImage.url}
                  priority={true}
                  className="w-full h-full object-cover"
                  alt="Product main image"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{
                    borderRadius: '20px',
                  }}
                />
              </div>

              {/* Interaction Overlay - Captures all mouse events stably */}
              <div 
                className="absolute inset-0 z-20 cursor-zoom-in rounded-[20px]"
                onMouseEnter={() => !isPageScrolling && setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onMouseMove={handleMouseMove}
                onWheel={() => setIsZooming(false)}
              />

              {/* Prev / Next Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 hover:bg-white text-gray-900 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95 border border-gray-100"
                    aria-label="Previous image"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex((prev) => (prev + 1) % images.length)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 hover:bg-white text-gray-900 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95 border border-gray-100"
                    aria-label="Next image"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}

              {/* Top Right Action Buttons (Favorite & Share) - Sleek Compact Badge */}
              {product && (
                <div 
                  className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-30 flex items-center gap-0.5 bg-white/95 backdrop-blur-md px-1.5 sm:px-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-gray-200/60 hover:border-gold-accent/40 hover:bg-white transition-all duration-300 h-[32px] sm:h-[34px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {product.id && <WishlistIcon productId={product.id} />}
                  <div className="h-3.5 w-[1px] bg-gray-200/80 mx-0.5" />
                  <ShareButton
                    productTitle={product.title ?? ""}
                    productHandle={product.handle ?? ""}
                  />
                </div>
              )}

              {/* Social Proof / Basket Badge - Top Left Corner (Matches Top Right Pill Badge Height Exactly) */}
              <div 
                className="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 z-30 flex items-center gap-1.5 text-gray-700 bg-white/90 backdrop-blur-md px-2.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-gray-200/60 hover:border-gold-accent/40 hover:bg-white transition-all duration-300 pointer-events-none select-none h-[30px]"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-4 h-4 text-gold-accent"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span className="text-[12px] font-semibold tracking-tight leading-none text-gray-700">
                  {basketCount} in basket
                </span>
              </div>

              {/* View Similar Button - Expanding on Hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const element = document.getElementById('related-products')
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
                className="absolute bottom-4 right-4 z-30 bg-white text-gold-accent p-2 rounded-full flex items-center gap-0 hover:gap-2 shadow-lg hover:shadow-xl transition-all duration-500 ease-in-out group w-10 hover:w-[140px] overflow-hidden whitespace-nowrap"
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="group-hover:rotate-12 transition-transform duration-300"
                  >
                    <path d="M12 3L14.5 9L21 11.5L14.5 14L12 20L9.5 14L3 11.5L9.5 9L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19 4L20 6M20 6L21 4M20 6L18 5M20 6L22 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                    <path d="M4 18L5 20M5 20L6 18M5 20L3 19M5 20L7 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </svg>
                </div>
                <span className="text-[11px] font-extrabold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                  View Similar
                </span>
              </button>

              {/* Lens Zoom - Using a nested Image for maximum reliability */}
              {isZooming && !isPageScrolling && containerRef.current && (
                <div
                  key={`lens-${selectedImageIndex}`}
                  className="absolute pointer-events-none z-10 rounded-full border-2 border-white/80 shadow-[0_0_30px_rgba(0,0,0,0.4)] overflow-hidden hidden sm:block"
                  style={{
                    width: `${lensSize}px`,
                    height: `${lensSize}px`,
                    left: `${zoomPosition.percentX}%`,
                    top: `${zoomPosition.percentY}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div 
                    className="absolute"
                    style={{
                      width: `${containerRef.current.offsetWidth * zoomFactor}px`,
                      height: `${containerRef.current.offsetHeight * zoomFactor}px`,
                      left: `${-zoomPosition.x * zoomFactor + lensSize / 2}px`,
                      top: `${-zoomPosition.y * zoomFactor + lensSize / 2}px`,
                    }}
                  >
                    <Image
                      src={selectedImage.url}
                      fill
                      className="object-cover"
                      alt="Zoomed view"
                      sizes="100vw"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
