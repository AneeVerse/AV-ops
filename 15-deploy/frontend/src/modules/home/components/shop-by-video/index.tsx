"use client"

import React, { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Dialog, Transition } from "@headlessui/react"
import X from "@modules/common/icons/x"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import { addToCart, buyNow } from "@lib/data/cart"

export type VideoItem = {
  id: string
  title: string
  views: string
  likes: number
  shares: number
  videoUrl: string
  posterImage: string
  product: {
    id: string
    title: string
    handle: string
    price: string
    image: string
    variantId?: string
    variants?: HttpTypes.StoreProductVariant[]
    options?: HttpTypes.StoreProductOption[]
    productUrl: string
  }
}

function ModalVideoPlayer({
  src,
  isCenter,
  isMuted,
}: {
  src: string
  isCenter: boolean
  isMuted: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isCenter) {
      // Defer play slightly so HeadlessUI dialog enter animation runs at 60fps
      const timer = setTimeout(() => {
        if (videoRef.current) {
          const playPromise = videoRef.current.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => {})
          }
        }
      }, 80)
      return () => clearTimeout(timer)
    } else {
      video.pause()
    }
  }, [isCenter])

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      muted={!isCenter || isMuted}
      playsInline
      preload="metadata"
      className="absolute inset-0 w-full h-full object-cover transform-gpu"
    />
  )
}

function CardVideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true

    const attemptPlay = () => {
      if (video.paused) {
        const promise = video.play()
        if (promise !== undefined) {
          promise.catch(() => {})
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            attemptPlay()
          } else {
            video.pause()
          }
        })
      },
      { threshold: 0.05 }
    )

    observer.observe(video)
    attemptPlay()

    return () => {
      observer.disconnect()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      onLoadedData={(e) => {
        const target = e.currentTarget
        target.muted = true
        target.play().catch(() => {})
      }}
      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700 ease-out"
    />
  )
}

type ShopByVideoProps = {
  products?: HttpTypes.StoreProduct[]
  region?: HttpTypes.StoreRegion
  initialVideos?: any[]
}

// 10 Video Items Data (5-second looping luxury jewelry videos matching Zillionaire reels)
const VIDEO_ITEMS: VideoItem[] = [
  {
    id: "video-1",
    title: "Relic Cross Pendant",
    views: "8K",
    likes: 24,
    shares: 18,
    videoUrl: "/Venice_1.mp4",
    posterImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v1",
      title: "Relic Cross Moissanite Pendant",
      handle: "auric-flow",
      price: "RS. 14,999 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-2",
    title: "Miami Link Bracelet",
    views: "18K",
    likes: 42,
    shares: 29,
    videoUrl: "/Venice_5.mp4",
    posterImage: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v2",
      title: "Miami Cuban Link Bracelet",
      handle: "infinite-glow",
      price: "RS. 19,200 INR",
      image: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-3",
    title: "Tennis Chain 4mm",
    views: "12K",
    likes: 56,
    shares: 31,
    videoUrl: "/Venice_8.mp4",
    posterImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v3",
      title: "4mm Solitaire Tennis Chain",
      handle: "silver-chain",
      price: "RS. 24,000 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-4",
    title: "Punkzster Charm Bracelet",
    views: "2K",
    likes: 19,
    shares: 11,
    videoUrl: "/Venice_11.mp4",
    posterImage: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v4",
      title: "Punkzster Charm Silver Bracelet",
      handle: "celestique-ring",
      price: "RS. 16,500 INR",
      image: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-5",
    title: "Iced Solitaire Cuban",
    views: "13K",
    likes: 88,
    shares: 45,
    videoUrl: "/Venice_1.mp4",
    posterImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v5",
      title: "Iced Solitaire Cuban Necklace",
      handle: "auric-flow",
      price: "RS. 28,999 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-6",
    title: "Emerald Solitaire Ring",
    views: "15K",
    likes: 67,
    shares: 34,
    videoUrl: "/Venice_5.mp4",
    posterImage: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v6",
      title: "Emerald Solitaire Moissanite Ring",
      handle: "celestique-ring",
      price: "RS. 15,800 INR",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-7",
    title: "Chandelier Drop Earrings",
    views: "9K",
    likes: 31,
    shares: 14,
    videoUrl: "/Venice_8.mp4",
    posterImage: "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v7",
      title: "Chandelier Moissanite Drop Earrings",
      handle: "moonlit-hoops",
      price: "RS. 11,499 INR",
      image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-8",
    title: "Double Stack Cuban Chain",
    views: "21K",
    likes: 112,
    shares: 62,
    videoUrl: "/Venice_11.mp4",
    posterImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v8",
      title: "Double Stack Heavy Cuban Chain",
      handle: "infinite-glow",
      price: "RS. 32,500 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-9",
    title: "Bezel Solitaire Bracelet",
    views: "7K",
    likes: 29,
    shares: 16,
    videoUrl: "/Venice_1.mp4",
    posterImage: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v9",
      title: "Bezel Solitaire Silver Bracelet",
      handle: "auric-flow",
      price: "RS. 13,999 INR",
      image: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
  {
    id: "video-10",
    title: "Hindi Letter Pendant",
    views: "25K",
    likes: 145,
    shares: 89,
    videoUrl: "/Venice_5.mp4",
    posterImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
    product: {
      id: "prod-v10",
      title: "Custom 3D Hindi Letter Pendant",
      handle: "silver-chain",
      price: "RS. 36,000 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      productUrl: "/store",
    },
  },
]

export default function ShopByVideo({ products = [], initialVideos }: ShopByVideoProps) {
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null)
  const [dynamicVideos, setDynamicVideos] = useState<any[]>(initialVideos || [])
  const [reelStep, setReelStep] = useState<"reel" | "options">("reel")
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showSizeChart, setShowSizeChart] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState(true)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({})
  const [copyToast, setCopyToast] = useState(false)
  const [isBuying, setIsBuying] = useState(false)
  const [addedSuccess, setAddedSuccess] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const params = useParams()
  const countryCode = (params?.countryCode as string) || "in"

  useEffect(() => {
    if (!initialVideos || initialVideos.length === 0) {
      const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      fetch(`${baseUrl}/store/shop-by-video`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.videos && Array.isArray(data.videos) && data.videos.length > 0) {
            setDynamicVideos(data.videos)
          }
        })
        .catch(() => {})
    }
  }, [initialVideos])

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 10)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
    }
  }

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    checkScroll()
    el.addEventListener("scroll", checkScroll, { passive: true })
    window.addEventListener("resize", checkScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [])

  // Dynamically map real store products if available
  const safeRealProducts = products || []
  const hasRealProducts = safeRealProducts.length > 0

  const getDynamicProduct = (staticProduct: VideoItem["product"], idx: number): VideoItem["product"] => {
    if (!hasRealProducts) {
      let priceDisplay = staticProduct.price
      if (countryCode !== "in" && priceDisplay.includes("₹")) {
        const num = parseFloat(priceDisplay.replace(/[^0-9.]/g, ""))
        if (!isNaN(num)) {
          priceDisplay = `$${(num / 83).toFixed(2)} USD`
        }
      }
      return {
        ...staticProduct,
        price: priceDisplay,
        productUrl: staticProduct.handle ? `/products/${staticProduct.handle}` : "/store",
      }
    }

    const realProd = safeRealProducts[idx % safeRealProducts.length]
    let formattedPrice = staticProduct.price

    try {
      const { cheapestPrice } = getProductPrice({ product: realProd })
      if (cheapestPrice?.calculated_price) {
        formattedPrice = cheapestPrice.calculated_price
      }
    } catch (e) {
      // Fallback
    }

    const realThumbnail = realProd.thumbnail || realProd.images?.[0]?.url || staticProduct.image
    const realHandle = realProd.handle || staticProduct.handle
    const realVariantId = realProd.variants?.[0]?.id || ""
    const realVariants = realProd.variants || []
    const realOptions = realProd.options || []

    return {
      id: realProd.id || staticProduct.id,
      title: realProd.title || staticProduct.title,
      handle: realHandle,
      price: formattedPrice,
      image: realThumbnail,
      variantId: realVariantId,
      variants: realVariants,
      options: realOptions,
      productUrl: realHandle ? `/products/${realHandle}` : "/store",
    }
  }

  function getStableHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  const formatDynamicVideo = (item: any, idx: number): VideoItem => {
    const targetProductId = item.productId || item.product_id || item.product?.id
    let prod = item.product

    if (!prod && targetProductId && safeRealProducts.length > 0) {
      prod = safeRealProducts.find((p: any) => p.id === targetProductId || p.handle === targetProductId)
    }

    if (!prod && hasRealProducts) {
      const stableIndex = getStableHash(item.id || item.videoUrl || String(idx))
      prod = safeRealProducts[stableIndex % safeRealProducts.length]
    }

    let price = "RS. 14,999 INR"
    if (prod) {
      try {
        const { cheapestPrice } = getProductPrice({ product: prod })
        if (cheapestPrice?.calculated_price) price = cheapestPrice.calculated_price
      } catch {}
    }

    return {
      id: item.id || `dyn-vid-${idx}`,
      title: item.title || "Custom Jewellery Reel",
      views: item.views || "10K",
      likes: item.likes || 42,
      shares: item.shares || 19,
      videoUrl: item.videoUrl,
      posterImage: item.posterImage || prod?.thumbnail || prod?.images?.[0]?.url || "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      product: {
        id: prod?.id || "prod-v-dyn",
        title: prod?.title || item.title || "Custom Jewellery",
        handle: prod?.handle || "store",
        price: price,
        image: prod?.thumbnail || prod?.images?.[0]?.url || item.posterImage || "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
        variantId: prod?.variants?.[0]?.id,
        variants: prod?.variants || [],
        options: prod?.options || [],
        productUrl: prod?.handle ? `/products/${prod.handle}` : "/store",
      },
    }
  }

  const customFormattedVideos = dynamicVideos.map((item, idx) => formatDynamicVideo(item, idx))
  const staticMappedVideos = VIDEO_ITEMS.map((item, idx) => ({
    ...item,
    product: getDynamicProduct(item.product, idx),
  }))

  const mappedVideos = [...customFormattedVideos, ...staticMappedVideos]

  const selectedVideo =
    selectedVideoIndex !== null && mappedVideos[selectedVideoIndex]
      ? mappedVideos[selectedVideoIndex]
      : null

  // Clean, realistic jewelry & apparel options (matching Zillionaire Shop Now modal)
  const getDynamicProductOptions = (prod: VideoItem["product"]) => {
    const optionsMap: Record<string, string[]> = {}

    if (prod.options && prod.options.length > 0) {
      prod.options.forEach((opt: any) => {
        const title = opt.title || opt.name
        if (title && opt.values && title.toLowerCase() !== "default option") {
          const valList = opt.values
            .map((v: any) => (typeof v === "object" ? v.value : v))
            .filter((v: any) => v && String(v).toLowerCase() !== "default option value")
          if (valList.length > 0) {
            optionsMap[title] = Array.from(new Set(valList))
          }
        }
      })
    }

    // Fallback: If no custom options exist, provide realistic Zillionaire jewelry sizes & metal colors
    if (Object.keys(optionsMap).length === 0) {
      const lowerTitle = prod.title.toLowerCase()
      if (lowerTitle.includes("chain") || lowerTitle.includes("necklace") || lowerTitle.includes("pendant")) {
        optionsMap["Size"] = ["15 Inches (Choker)", "18 Inches", "20 Inches", "22 Inches"]
        optionsMap["Color"] = ["Yellow Gold", "White Gold", "Rose Gold"]
      } else if (lowerTitle.includes("ring")) {
        optionsMap["Size"] = ["5", "6", "7", "8", "9", "10", "11", "12"]
        optionsMap["Color"] = ["White Gold", "Yellow Gold", "Rose Gold"]
      } else if (lowerTitle.includes("bracelet")) {
        optionsMap["Size"] = ["6.5 Inches", "7 Inches", "7.5 Inches", "8 Inches"]
        optionsMap["Color"] = ["White Gold", "Yellow Gold", "Rose Gold"]
      } else {
        optionsMap["Size"] = ["Standard Fit"]
        optionsMap["Color"] = ["White Gold", "Yellow Gold", "Rose Gold"]
      }
    }

    return optionsMap
  }

  // Reset reel step and selections when video index changes
  useEffect(() => {
    setReelStep("reel")
    setSelectedOptions({})
    setValidationError(null)
    setShowSizeChart(false)
    setAddedSuccess(false)
  }, [selectedVideoIndex])

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
      setTimeout(checkScroll, 350)
    }
  }

  const handleOpenReel = (index: number) => {
    setSelectedVideoIndex(index)
  }

  const handleCloseReel = () => {
    setSelectedVideoIndex(null)
    setReelStep("reel")
    setSelectedOptions({})
    setValidationError(null)
    setShowSizeChart(false)
    setAddedSuccess(false)
  }

  const handlePrevReel = () => {
    if (selectedVideoIndex !== null) {
      setSelectedVideoIndex((prev) =>
        prev === 0 ? mappedVideos.length - 1 : (prev as number) - 1
      )
    }
  }

  const handleNextReel = () => {
    if (selectedVideoIndex !== null) {
      setSelectedVideoIndex((prev) =>
        prev === mappedVideos.length - 1 ? 0 : (prev as number) + 1
      )
    }
  }

  const handleToggleLike = (id: string) => {
    setLikedMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleShareVideo = (e: React.MouseEvent, video: VideoItem) => {
    e.stopPropagation()
    const shareUrl = window.location.origin + (video.product.productUrl || `/${countryCode}/store`)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {})
    }
    setCopyToast(true)
    setTimeout(() => {
      setCopyToast(false)
    }, 2500)
  }

  // Add to Cart Only
  const handleAddToCartOnly = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!selectedVideo) return

    let targetVariantId = selectedVideo.product.variantId
    if (selectedVideo.product.variants && selectedVideo.product.variants.length > 0) {
      const matchedVariant = selectedVideo.product.variants.find((v: any) => {
        if (!v.options) return true
        return v.options.every((opt: any) => {
          const optTitle = opt.option?.title || opt.title
          return !optTitle || !selectedOptions[optTitle] || selectedOptions[optTitle] === opt.value
        })
      })
      if (matchedVariant?.id) {
        targetVariantId = matchedVariant.id
      }
    }

    if (!targetVariantId) {
      window.location.href = selectedVideo.product.productUrl || `/${countryCode}/store`
      return
    }

    try {
      setIsBuying(true)
      await addToCart({
        variantId: targetVariantId,
        quantity: 1,
        countryCode,
        metadata: selectedOptions,
      })
      setAddedSuccess(true)
      setTimeout(() => setAddedSuccess(false), 3000)
    } catch (err) {
      console.error("Add to cart failed:", err)
    } finally {
      setIsBuying(false)
    }
  }

  // Confirm Option Selection & Add to Cart -> Redirect to Checkout
  const handleConfirmCheckout = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!selectedVideo) return

    let targetVariantId = selectedVideo.product.variantId
    if (selectedVideo.product.variants && selectedVideo.product.variants.length > 0) {
      const matchedVariant = selectedVideo.product.variants.find((v: any) => {
        if (!v.options) return true
        return v.options.every((opt: any) => {
          const optTitle = opt.option?.title || opt.title
          return !optTitle || !selectedOptions[optTitle] || selectedOptions[optTitle] === opt.value
        })
      })
      targetVariantId = matchedVariant?.id || selectedVideo.product.variants[0]?.id || selectedVideo.product.variantId
    }

    if (!targetVariantId) {
      targetVariantId = selectedVideo.product.id
    }

    try {
      setIsBuying(true)
      await buyNow({
        variantId: targetVariantId,
        quantity: 1,
        countryCode,
        metadata: selectedOptions,
      })
      handleCloseReel()
      window.location.href = `/${countryCode}/checkout`
    } catch (err) {
      console.error("Buy now checkout failed:", err)
      handleCloseReel()
      window.location.href = `/${countryCode}/checkout`
    } finally {
      setIsBuying(false)
    }
  }

  return (
    <section className="w-full py-12 sm:py-16 bg-ivory-bg relative overflow-hidden">
      {/* Background ambient gold glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#D4AF37]/[0.06] rounded-full blur-3xl" />

      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 relative z-10">
        {/* Header Title */}
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-[0.25em] text-[#102a43] uppercase font-sans">
            SHOP BY VIDEO
          </h2>
          <div className="w-10 h-0.5 bg-[#102a43] opacity-80 mx-auto mt-2" />
        </div>

        {/* Carousel Container */}
        <div className="relative group w-full">
          {/* Scroll Left Arrow (Hidden when at start) */}
          {canScrollLeft && (
            <button
              onClick={() => handleScroll("left")}
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-[#0d1a11] text-[#D4AF37] border border-[#D4AF37]/50 shadow-2xl hover:bg-[#D4AF37] hover:text-[#0d1a11] hover:border-[#D4AF37] transition-all duration-300 opacity-95 group-hover:opacity-100 hover:scale-110 active:scale-95 animate-in fade-in"
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Scroll Right Arrow (Hidden when at end) */}
          {canScrollRight && (
            <button
              onClick={() => handleScroll("right")}
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-[#0d1a11] text-[#D4AF37] border border-[#D4AF37]/50 shadow-2xl hover:bg-[#D4AF37] hover:text-[#0d1a11] hover:border-[#D4AF37] transition-all duration-300 opacity-95 group-hover:opacity-100 hover:scale-110 active:scale-95 animate-in fade-in"
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Video Cards Scroll Row */}
          <div
            ref={scrollContainerRef}
            className="flex items-center justify-between gap-3 sm:gap-4 overflow-x-auto scrollbar-none py-2 px-0 scroll-smooth w-full"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {mappedVideos.map((video, index) => (
              <div
                key={video.id}
                onClick={() => handleOpenReel(index)}
                className="relative shrink-0 w-[210px] sm:w-[230px] md:w-[250px] lg:w-[268px] aspect-[9/16] rounded-2xl overflow-hidden bg-[#0d1a11] border border-[#D4AF37]/30 shadow-xl cursor-pointer group/card transition-all duration-500 hover:scale-[1.02] hover:border-[#D4AF37]"
              >
                {/* 5-Second Looping Video Preview */}
                <CardVideoPreview src={video.videoUrl} />

                {/* Center Video Play Icon Overlay (Appears on Hover) */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                  <div className="w-12 h-12 rounded-full bg-black/40 border border-[#D4AF37]/60 flex items-center justify-center backdrop-blur-sm text-white shadow-2xl scale-95 group-hover/card:scale-105 transition-transform duration-300">
                    <svg className="w-6 h-6 fill-white ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

                {/* Top Badge: View Count */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold font-sans">
                  <svg className="w-3 h-3 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>{video.views}</span>
                </div>

                {/* Bottom Overlay: Product Thumbnail + Title */}
                <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2.5 p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#0d1a11] border border-[#D4AF37]/30">
                    <Image
                      src={video.product.image}
                      alt={video.product.title}
                      fill
                      className="object-cover object-center"
                    />
                  </div>
                  <div className="overflow-hidden text-left">
                    <h4 className="text-xs font-semibold text-white truncate font-sans">
                      {video.product.title}
                    </h4>
                    <p className="text-[10px] text-[#D4AF37] font-bold font-sans">
                      {video.product.price}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen 3D Swapping Carousel Modal (Exact Zillionaire Whatmore 3D Swapping Animation) */}
      <Transition appear show={selectedVideoIndex !== null} as={React.Fragment}>
        <Dialog as="div" className="relative z-[110]" onClose={handleCloseReel}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/90 transform-gpu" />
          </Transition.Child>

          <Transition.Child
            as={React.Fragment}
            enter="transition-all ease-out duration-300 transform-gpu"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition-all ease-in duration-200 transform-gpu"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="fixed inset-0 overflow-hidden flex items-center justify-center">
            {/* Luxury Floating Share Toast Notification */}
            <div
              className={`fixed top-6 sm:top-10 left-1/2 -translate-x-1/2 z-[160] px-5 py-2.5 rounded-full bg-[#0d1a11]/95 border border-[#D4AF37]/80 text-white text-xs font-bold font-sans shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center gap-2.5 transition-all duration-300 pointer-events-none ${
                copyToast
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 -translate-y-4 scale-95"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0d1a11] flex items-center justify-center font-extrabold text-xs shadow-md">
                ✓
              </div>
              <span className="tracking-wide text-white font-medium">Reel link copied to clipboard!</span>
            </div>

            {/* Global Close Button (White circle icon on top right) */}
            <button
              onClick={handleCloseReel}
              className="absolute top-5 right-5 sm:top-8 sm:right-8 z-50 p-2.5 text-white hover:text-[#D4AF37] transition-all duration-300 hover:scale-110 active:scale-95"
              aria-label="Close reels"
            >
              <X size={26} />
            </button>

            {/* Zillionaire White Circular Slider Navigation Arrow (Left) */}
            <button
              onClick={handlePrevReel}
              className="absolute left-3 sm:left-[calc(50%-420px)] md:left-[calc(50%-440px)] z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black hover:bg-[#D4AF37] transition-all duration-300 shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95"
              aria-label="Previous Reel"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>

            {/* Zillionaire White Circular Slider Navigation Arrow (Right) */}
            <button
              onClick={handleNextReel}
              className="absolute right-3 sm:right-[calc(50%-420px)] md:right-[calc(50%-440px)] z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black hover:bg-[#D4AF37] transition-all duration-300 shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95"
              aria-label="Next Reel"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </button>

            {/* Dynamic 3D Track Container (Animated position & scaling for every card) */}
            <div
              className="relative w-full max-w-5xl mx-auto h-[90vh] flex items-center justify-center py-4"
              style={{ perspective: "1200px" }}
            >
              {selectedVideoIndex !== null &&
                mappedVideos.map((video, idx) => {
                  const total = mappedVideos.length
                  let diff = idx - selectedVideoIndex
                  if (diff < -Math.floor(total / 2)) diff += total
                  if (diff > Math.floor(total / 2)) diff -= total

                  const isCenter = diff === 0
                  const isLeft = diff === -1
                  const isRight = diff === 1
                  const isVisible = isCenter || isLeft || isRight

                  // Unmount offscreen cards to keep popup modal opening silky smooth (60fps)
                  if (!isVisible) return null

                  // Calculate smooth luxury spring CSS transforms for 3D card swapping
                  let style: React.CSSProperties = {
                    transition: "transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out, filter 400ms ease-out",
                    willChange: "transform, opacity, filter",
                  }

                  if (isCenter) {
                    style = {
                      ...style,
                      transform: "translate3d(0px, 0px, 0px) scale(1.0) rotateY(0deg)",
                      opacity: 1,
                      zIndex: 30,
                      filter: "brightness(1)",
                      pointerEvents: "auto",
                      visibility: "visible",
                    }
                  } else if (isLeft) {
                    style = {
                      ...style,
                      transform: "translate3d(-220px, 0px, -50px) scale(0.85) rotateY(10deg)",
                      opacity: 0.65,
                      zIndex: 10,
                      filter: "brightness(0.7)",
                      pointerEvents: "auto",
                      visibility: "visible",
                    }
                  } else {
                    style = {
                      ...style,
                      transform: "translate3d(220px, 0px, -50px) scale(0.85) rotateY(-10deg)",
                      opacity: 0.65,
                      zIndex: 10,
                      filter: "brightness(0.7)",
                      pointerEvents: "auto",
                      visibility: "visible",
                    }
                  }

                  return (
                    <div
                      key={video.id}
                      onClick={() => {
                        if (isLeft) handlePrevReel()
                        if (isRight) handleNextReel()
                      }}
                      style={style}
                      className="absolute h-[70vh] sm:h-[74vh] md:h-[78vh] max-h-[640px] w-auto aspect-[9/16] rounded-[24px] sm:rounded-[28px] overflow-hidden bg-[#0d1a11] border border-[#D4AF37]/50 shadow-[0_30px_80px_rgba(0,0,0,0.95)] flex flex-col justify-between cursor-pointer"
                    >
                      {/* Video Player (Only main active center video plays) */}
                      <ModalVideoPlayer
                        src={video.videoUrl}
                        isCenter={isCenter}
                        isMuted={isMuted}
                      />

                      {/* Video Dark Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

                      {/* Top Bar Controls (Only visible on active center card) */}
                      {isCenter && (
                        <div className="relative z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setIsMuted(!isMuted)
                              }}
                              className="p-2 rounded-full bg-black/50 text-white hover:bg-[#D4AF37] hover:text-[#0d1a11] border border-white/20 transition-all backdrop-blur-md"
                              aria-label={isMuted ? "Unmute" : "Mute"}
                            >
                              {isMuted ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                              )}
                            </button>
                            <span className="text-xs text-white/90 font-bold tracking-wider font-sans bg-black/40 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                              {video.title}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Right Action Icons Column (Only visible on active center card) */}
                      {isCenter && (
                        <div className="absolute right-4 bottom-24 z-20 flex flex-col items-center gap-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleLike(video.id)
                            }}
                            className="flex flex-col items-center gap-1 group"
                          >
                            <div className={`p-3 rounded-full border backdrop-blur-md transition-all ${
                              likedMap[video.id]
                                ? "bg-red-600 text-white border-red-500 scale-110"
                                : "bg-black/50 text-white border-white/20 hover:border-[#D4AF37]"
                            }`}>
                              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                            </div>
                            <span className="text-[10px] text-white font-bold font-sans">
                              {video.likes + (likedMap[video.id] ? 1 : 0)}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleShareVideo(e, video)}
                            className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                          >
                            <div className="p-3 rounded-full bg-black/50 text-white border border-white/20 hover:border-[#D4AF37] backdrop-blur-md transition-all">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </div>
                            <span className="text-[10px] text-white font-bold font-sans">
                              {video.shares}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Default Bottom Bar (Only on active center card) */}
                      {isCenter && (
                        <div
                          className={`absolute inset-x-3 bottom-3 z-20 transition-all duration-300 ease-out ${
                            reelStep === "reel"
                              ? "opacity-100 translate-y-0 pointer-events-auto"
                              : "opacity-0 translate-y-4 pointer-events-none"
                          }`}
                        >
                          <div className="p-3.5 rounded-2xl bg-[#0d1a11]/90 border border-[#D4AF37]/40 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xl">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#0d1a11] border border-[#D4AF37]/40">
                                <Image
                                  src={video.product.image}
                                  alt={video.product.title}
                                  fill
                                  className="object-cover object-center"
                                />
                              </div>
                              <div className="overflow-hidden text-left">
                                <h4 className="text-xs font-bold text-white truncate font-sans">
                                  {video.product.title}
                                </h4>
                                <p className="text-xs font-extrabold text-[#D4AF37] font-sans">
                                  {video.product.price}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReelStep("options")
                              }}
                              className="py-2.5 px-4 rounded-full bg-[#D4AF37] text-[#0d1a11] hover:bg-white transition-all duration-300 font-bold text-[11px] uppercase tracking-wider shrink-0 shadow-lg hover:scale-105 active:scale-95"
                            >
                              Buy Now
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ZILLIONAIRE EXACT SHOP NOW BOTTOM POPOVER CARD OVERLAY (Only on active center card) */}
                      {isCenter && (
                        <div
                          className={`absolute inset-x-3 bottom-3 z-30 bg-[#0d1a11]/95 border border-[#D4AF37]/40 rounded-[24px] p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 ease-out ${
                            reelStep === "options"
                              ? "opacity-100 translate-y-0 pointer-events-auto"
                              : "opacity-0 translate-y-6 pointer-events-none"
                          }`}
                        >
                          {/* Top Header */}
                          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-2 mb-3">
                            <span className="text-xs font-extrabold text-[#D4AF37] tracking-[0.2em] uppercase font-sans">
                              SHOP NOW
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReelStep("reel")
                              }}
                              className="p-1 text-white/70 hover:text-white rounded-full transition-colors"
                              aria-label="Close options"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          {/* Product Thumbnail + Info */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="relative w-14 h-14 rounded-xl bg-white p-1 overflow-hidden shrink-0 border border-[#D4AF37]/30 shadow-md">
                              <Image
                                src={video.product.image}
                                alt={video.product.title}
                                fill
                                className="object-contain"
                              />
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="text-xs sm:text-sm font-bold text-white leading-snug font-sans truncate">
                                {video.product.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-extrabold text-[#D4AF37] font-sans">
                                  {video.product.price}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                                  In Stock
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Product Options */}
                          {Object.entries(getDynamicProductOptions(video.product)).map(
                            ([optTitle, optValues]) => {
                              const isSizeOption = optTitle.toLowerCase().includes("size")
                              const selectedVal = selectedOptions[optTitle] || optValues[0]

                              return (
                                <div key={optTitle} className="mb-2.5 text-left">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider font-sans">
                                      {optTitle}
                                    </label>
                                    {isSizeOption && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setShowSizeChart(true)
                                        }}
                                        className="text-[9px] text-[#D4AF37] hover:text-white font-semibold flex items-center gap-1 transition-colors"
                                      >
                                        Size Chart
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {optValues.map((val) => {
                                      const isActive = selectedVal === val
                                      return (
                                        <button
                                          key={val}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedOptions((prev) => ({ ...prev, [optTitle]: val }))
                                            setValidationError(null)
                                          }}
                                          className={`py-1.5 px-3 rounded-xl text-[11px] font-bold transition-all duration-300 border ${
                                            isActive
                                              ? "bg-[#D4AF37] text-[#0d1a11] border-[#D4AF37] shadow-md scale-105"
                                              : "bg-white/5 text-white/80 border-white/20 hover:border-[#D4AF37]/60 hover:text-white"
                                          }`}
                                        >
                                          {val}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            }
                          )}

                          {/* Added to Cart Success Toast */}
                          {addedSuccess && (
                            <div className="mb-2 p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold text-center animate-in fade-in duration-200">
                              ✓ Added to cart successfully!
                            </div>
                          )}

                          {/* 3 Action Buttons: ADD TO CART + BUY NOW + SHOPPING BAG ICON */}
                          <div className="flex items-center gap-1.5 sm:gap-2 pt-2 border-t border-white/10 w-full">
                            <button
                              onClick={handleAddToCartOnly}
                              disabled={isBuying}
                              className="flex-1 py-2.5 px-1.5 sm:px-3 rounded-full border border-[#D4AF37] text-[#D4AF37] hover:bg-white hover:text-[#0d1a11] hover:border-white transition-all font-bold text-[10px] sm:text-[11px] uppercase tracking-wide whitespace-nowrap shadow-md disabled:opacity-50 text-center"
                            >
                              Add To Cart
                            </button>

                            <button
                              onClick={handleConfirmCheckout}
                              disabled={isBuying}
                              className="flex-1 py-2.5 px-1.5 sm:px-3 rounded-full bg-[#D4AF37] text-[#0d1a11] hover:bg-white transition-all font-bold text-[10px] sm:text-[11px] uppercase tracking-wide whitespace-nowrap shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 text-center"
                            >
                              {isBuying ? "Processing..." : "Buy Now"}
                            </button>

                            <LocalizedClientLink
                              href="/cart"
                              onClick={handleCloseReel}
                              className="p-2 sm:p-2.5 rounded-full border border-white/20 text-white hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-white/5 transition-all shadow-md flex items-center justify-center shrink-0 w-8 h-8 sm:w-9 sm:h-9"
                              title="View Shopping Cart"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                            </LocalizedClientLink>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>

      {/* Side Slide-Over Ring Size Guide Drawer (Cultura Jewels Luxury Theme) */}
      <Transition appear show={showSizeChart} as={React.Fragment}>
        <Dialog as="div" className="relative z-[130]" onClose={() => setShowSizeChart(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
                <Transition.Child
                  as={React.Fragment}
                  enter="transform transition ease-in-out duration-300 sm:duration-400"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-300 sm:duration-400"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md bg-gradient-to-br from-[#16261b] via-[#122019] to-[#0d1a11] border-l border-[#D4AF37]/30 text-white shadow-[0_25px_60px_rgba(0,0,0,0.8)] p-5 sm:p-7 flex flex-col justify-between overflow-y-auto overflow-x-hidden relative">
                    {/* Ambient gold glow blob in background */}
                    <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-[#D4AF37]/[0.08] rounded-full blur-3xl" />

                    <div className="relative z-10 w-full">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-4 mb-5">
                        <Dialog.Title className="text-lg sm:text-xl font-bold text-white font-serif tracking-wide">
                          Ring Size Guide
                        </Dialog.Title>
                        <button
                          type="button"
                          onClick={() => setShowSizeChart(false)}
                          className="p-2 text-white/70 hover:text-[#0d1a11] hover:bg-[#D4AF37] border border-[#D4AF37]/40 rounded-full transition-all duration-300"
                          aria-label="Close guide"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Pro Tip Box with Premium Vector Gold Lightbulb Icon */}
                      <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-4 mb-5 flex items-start gap-3 text-left backdrop-blur-sm">
                        <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h-4a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <h5 className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider mb-1 font-sans">
                            PRO TIP
                          </h5>
                          <p className="text-xs text-white/80 leading-relaxed font-sans">
                            For the most accurate fit, measure the inside diameter of an existing ring that fits comfortably.
                          </p>
                        </div>
                      </div>

                      {/* Section Title */}
                      <div className="flex items-center gap-2 mb-3 text-left">
                        <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#D4AF37] font-sans">
                          STANDARD RING SIZES
                        </h4>
                      </div>

                      {/* Table - 100% Fit & No Horizontal Scroll */}
                      <div className="rounded-2xl border border-[#D4AF37]/30 overflow-hidden shadow-xl bg-[#0d1a11]/80 backdrop-blur-sm w-full">
                        <table className="w-full text-left text-xs font-sans table-auto">
                          <thead className="bg-[#0d1a11] border-b border-[#D4AF37]/30 text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
                            <tr>
                              <th className="py-3 px-3 sm:px-4">US Size</th>
                              <th className="py-3 px-2 sm:px-3 text-center">Diameter</th>
                              <th className="py-3 px-3 sm:px-4 text-right">Circumference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {[
                              { size: "4", dia: "14.9 mm", circ: "46.8 mm" },
                              { size: "5", dia: "15.7 mm", circ: "49.3 mm" },
                              { size: "6", dia: "16.5 mm", circ: "51.9 mm" },
                              { size: "7", dia: "17.3 mm", circ: "54.4 mm" },
                              { size: "8", dia: "18.1 mm", circ: "57.0 mm" },
                              { size: "9", dia: "18.9 mm", circ: "59.5 mm" },
                              { size: "10", dia: "19.8 mm", circ: "62.1 mm" },
                              { size: "11", dia: "20.6 mm", circ: "64.6 mm" },
                              { size: "12", dia: "21.4 mm", circ: "67.2 mm" },
                            ].map((item) => {
                              const isCurrentSelected = selectedOptions["Size"] === item.size
                              return (
                                <tr
                                  key={item.size}
                                  className={`transition-all duration-300 ${
                                    isCurrentSelected
                                      ? "bg-[#D4AF37] font-bold text-[#0d1a11]"
                                      : "hover:bg-white/5 text-white/80"
                                  }`}
                                >
                                  <td className="py-2.5 px-3 sm:px-4 flex items-center gap-1.5 whitespace-nowrap">
                                    {isCurrentSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#0d1a11]" />}
                                    Size {item.size}
                                  </td>
                                  <td className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">{item.dia}</td>
                                  <td className="py-2.5 px-3 sm:px-4 text-right whitespace-nowrap">{item.circ}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Close Button at bottom */}
                    <div className="pt-5 border-t border-[#D4AF37]/20 mt-5 relative z-10 w-full">
                      <button
                        type="button"
                        onClick={() => setShowSizeChart(false)}
                        className="w-full py-3.5 px-4 rounded-full bg-[#D4AF37] text-[#0d1a11] font-bold text-xs uppercase tracking-widest hover:bg-white transition-all duration-300 shadow-lg hover:scale-[1.02] active:scale-95"
                      >
                        Got It, Close Guide
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    </section>
  )
}
