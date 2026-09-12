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

export type LookItem = {
  id: string
  image: string
  lookName: string
  isFeatured?: boolean
  gridSpan: string // Tailwind classes for grid layout
  product: {
    id: string
    title: string
    handle: string
    price: string
    image: string
    description?: string
    variantId?: string
    variants?: HttpTypes.StoreProductVariant[]
    options?: HttpTypes.StoreProductOption[]
    productUrl: string
  }
}

type ShopByLookProps = {
  products?: HttpTypes.StoreProduct[]
  region?: HttpTypes.StoreRegion
  initialLooks?: any[]
}

// Block 1 (Initial 9 items layout matching reference collage 1 - No celebrity names)
const BLOCK_1_LOOKS = [
  {
    id: "look-1",
    lookName: "Solitaire Cuban Statement",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
    gridSpan: "col-span-2 row-span-2",
    product: {
      id: "prod-1",
      title: "Solitaire Cuban Chain in 925 Silver",
      handle: "auric-flow",
      price: "RS. 14,999 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Crafted with VVS Moissanite diamonds set in solid sterling silver.",
      productUrl: "/store",
    },
  },
  {
    id: "look-2",
    lookName: "Moissanite Tennis Necklace",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-2",
      title: "Moissanite Tennis Necklace",
      handle: "infinite-glow",
      price: "RS. 18,500 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Classic full-row solitaire tennis necklace.",
      productUrl: "/store",
    },
  },
  {
    id: "look-3",
    lookName: "Drop Gemstone Statement",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-3",
      title: "Drop Gemstone Statement Earrings",
      handle: "moonlit-hoops",
      price: "RS. 8,999 INR",
      image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80",
      description: "Elegant drop earrings with synthetic ruby accents.",
      productUrl: "/store",
    },
  },
  {
    id: "look-4",
    lookName: "Heavy Link Choker & Cross",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-4",
      title: "Heavy Link Choker & Cross Pendant",
      handle: "auric-flow",
      price: "RS. 22,000 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Bold hip-hop inspired Cuban link chain.",
      productUrl: "/store",
    },
  },
  {
    id: "look-5",
    lookName: "Iced Out Cross Pendant",
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-5",
      title: "Iced Out Cross Moissanite Pendant",
      handle: "celestique-ring",
      price: "RS. 12,499 INR",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80",
      description: "Statement cross pendant set in pure 925 sterling silver.",
      productUrl: "/store",
    },
  },
  {
    id: "look-6",
    lookName: "Double Stacked Cuban Set",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
    isFeatured: true,
    gridSpan: "col-span-2 row-span-2",
    product: {
      id: "prod-6",
      title: "Double Stacked Cuban Chain Set",
      handle: "silver-chain",
      price: "RS. 29,999 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Signature double Cuban chain set seen on top artists.",
      productUrl: "/store",
    },
  },
  {
    id: "look-7",
    lookName: "Chandelier Diamond Earrings",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-7",
      title: "Chandelier Diamond Dangle Earrings",
      handle: "moonlit-hoops",
      price: "RS. 9,499 INR",
      image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80",
      description: "Dazzling chandelier earrings with Moissanite drops.",
      productUrl: "/store",
    },
  },
  {
    id: "look-8",
    lookName: "Multi-Band Solitaire Ring",
    image: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-8",
      title: "Multi-Band Solitaire Ring Collection",
      handle: "celestique-ring",
      price: "RS. 16,800 INR",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80",
      description: "Stacked VVS Moissanite rings for high impact styling.",
      productUrl: "/store",
    },
  },
  {
    id: "look-9",
    lookName: "Custom Typography Moissanite",
    image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-9",
      title: "HINDI Custom Typography Pendant",
      handle: "auric-flow",
      price: "RS. 34,500 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Custom heavy 3D lettered Moissanite statement piece.",
      productUrl: "/store",
    },
  },
]

// Block 2 (Loaded / expanded when '+' button is clicked)
const BLOCK_2_LOOKS = [
  {
    id: "look-10",
    lookName: "Triple Layered Lock Chain",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
    gridSpan: "col-span-2 row-span-2",
    product: {
      id: "prod-10",
      title: "Triple Layered Lock & Key Necklace",
      handle: "infinite-glow",
      price: "RS. 24,999 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Signature layered lock charm chain in silver.",
      productUrl: "/store",
    },
  },
  {
    id: "look-11",
    lookName: "Bezel Set Tennis Bracelet",
    image: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-11",
      title: "Bezel Set Solitaire Tennis Bracelet",
      handle: "auric-flow",
      price: "RS. 15,200 INR",
      image: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
      description: "Sleek bezel-set Moissanite bracelet.",
      productUrl: "/store",
    },
  },
  {
    id: "look-12",
    lookName: "Signet Emerald Cut Ring",
    image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-12",
      title: "Signet Emerald Cut Ring",
      handle: "celestique-ring",
      price: "RS. 11,999 INR",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80",
      description: "Bold emerald cut Moissanite signet ring.",
      productUrl: "/store",
    },
  },
  {
    id: "look-13",
    lookName: "Heart Solitaire Heavy Chain",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-13",
      title: "Heart Solitaire Heavy Chain",
      handle: "auric-flow",
      price: "RS. 19,800 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Over-sized heart cut pendant on solid chain.",
      productUrl: "/store",
    },
  },
  {
    id: "look-14",
    lookName: "Lightning Bolt Choker Set",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    isFeatured: true,
    gridSpan: "col-span-2 row-span-2",
    product: {
      id: "prod-14",
      title: "Lightning Bolt Choker & Ring Set",
      handle: "infinite-glow",
      price: "RS. 27,500 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "Iconic lightning bolt pendant with pavé set band rings.",
      productUrl: "/store",
    },
  },
  {
    id: "look-15",
    lookName: "Classic Silver Rope Chain",
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-15",
      title: "Classic Silver Rope Chain",
      handle: "silver-chain",
      price: "RS. 7,999 INR",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
      description: "4mm silver diamond-cut rope chain.",
      productUrl: "/store",
    },
  },
  {
    id: "look-16",
    lookName: "Iced Out Solitaire Cuff",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-16",
      title: "Iced Out Solitaire Cuff Bracelet",
      handle: "auric-flow",
      price: "RS. 13,500 INR",
      image: "https://images.unsplash.com/photo-1611591475143-be232935f478?auto=format&fit=crop&w=600&q=80",
      description: "Heavy hinged cuff bracelet embedded with Moissanites.",
      productUrl: "/store",
    },
  },
  {
    id: "look-17",
    lookName: "Radiant Cut Halo Ring",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-17",
      title: "Radiant Cut Halo Ring",
      handle: "celestique-ring",
      price: "RS. 17,999 INR",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80",
      description: "3 carat radiant cut center stone with halo border.",
      productUrl: "/store",
    },
  },
  {
    id: "look-18",
    lookName: "Pavé Stud Earrings Pair",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
    gridSpan: "col-span-1 row-span-1",
    product: {
      id: "prod-18",
      title: "Pavé Stud Earrings Pair",
      handle: "moonlit-hoops",
      price: "RS. 6,499 INR",
      image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80",
      description: "Round brilliant cut Moissanite stud earrings.",
      productUrl: "/store",
    },
  },
]

export default function ShopByLook({ products = [], initialLooks }: ShopByLookProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dynamicLooks, setDynamicLooks] = useState<any[]>(initialLooks || [])
  
  // Zillionaire Two-Step Modal Navigation State
  const [modalStep, setModalStep] = useState<"info" | "options">("info")
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showSizeChart, setShowSizeChart] = useState<boolean>(false)
  const [isBuying, setIsBuying] = useState(false)
  const [addedSuccess, setAddedSuccess] = useState(false)

  const params = useParams()
  const countryCode = (params?.countryCode as string) || "in"
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!initialLooks || initialLooks.length === 0) {
      const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      fetch(`${baseUrl}/store/shop-by-look`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.looks && Array.isArray(data.looks) && data.looks.length > 0) {
            setDynamicLooks(data.looks)
          }
        })
        .catch(() => {})
    }
  }, [initialLooks])

  // Dynamically map real store products if available, with smart fallbacks
  const safeRealProducts = products || []
  const hasRealProducts = safeRealProducts.length > 0

  const getDynamicProduct = (staticProduct: LookItem["product"], idx: number): LookItem["product"] => {
    if (!hasRealProducts) {
      return {
        ...staticProduct,
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
      // Fallback to static price string if price calculation fails
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
      description: staticProduct.description,
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

  // Format backend dynamic look item
  const formatDynamicLook = (item: any, idx: number): LookItem => {
    const targetProductId = item.productId || item.product_id || item.product?.id
    let prod = item.product

    if (!prod && targetProductId && safeRealProducts.length > 0) {
      prod = safeRealProducts.find((p: any) => p.id === targetProductId || p.handle === targetProductId)
    }

    if (!prod && hasRealProducts) {
      const stableIndex = getStableHash(item.id || item.image || String(idx))
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
      id: item.id || `dyn-look-${idx}`,
      lookName: item.lookName || item.title || "Featured Look",
      image: item.image,
      isFeatured: !!item.isFeatured,
      gridSpan: item.gridSpan || (item.isFeatured ? "col-span-2 row-span-2" : "col-span-1 row-span-1"),
      product: {
        id: prod?.id || "prod-dyn",
        title: prod?.title || item.lookName || "Custom Jewellery",
        handle: prod?.handle || "store",
        price: price,
        image: prod?.thumbnail || prod?.images?.[0]?.url || item.image,
        description: prod?.description || "High quality handcrafted moissanite jewellery.",
        variantId: prod?.variants?.[0]?.id,
        variants: prod?.variants || [],
        options: prod?.options || [],
        productUrl: prod?.handle ? `/products/${prod.handle}` : "/store",
      },
    }
  }

  const customFormattedLooks = dynamicLooks.map((item, idx) => formatDynamicLook(item, idx))
  const staticBlock1Mapped = BLOCK_1_LOOKS.map((item, idx) => ({
    ...item,
    product: getDynamicProduct(item.product as any, idx),
  }))
  const staticBlock2Mapped = BLOCK_2_LOOKS.map((item, idx) => ({
    ...item,
    product: getDynamicProduct(item.product as any, BLOCK_1_LOOKS.length + idx),
  }))

  const combinedLooks = [...customFormattedLooks, ...staticBlock1Mapped, ...staticBlock2Mapped]

  const visibleCount = isExpanded ? combinedLooks.length : 10
  const allLooks = combinedLooks.slice(0, visibleCount)

  const selectedLook =
    selectedIndex !== null && allLooks[selectedIndex]
      ? allLooks[selectedIndex]
      : null

  // Extract available options dynamically from product variants/options
  const getDynamicProductOptions = (prod: LookItem["product"]) => {
    const optionsMap: Record<string, string[]> = {}

    if (prod.options && prod.options.length > 0) {
      prod.options.forEach((opt: any) => {
        const title = opt.title || opt.name
        if (title && opt.values) {
          const valList = opt.values
            .map((v: any) => (typeof v === "object" ? v.value : v))
            .filter(Boolean)
          if (valList.length > 0) {
            optionsMap[title] = Array.from(new Set(valList))
          }
        }
      })
    }

    // Fallback: If no Medusa options exist on this product, provide smart default options
    if (Object.keys(optionsMap).length === 0) {
      const lowerTitle = prod.title.toLowerCase()
      const isApparel = lowerTitle.includes("sweatshirt") || lowerTitle.includes("t-shirt") || lowerTitle.includes("hoodie") || lowerTitle.includes("shirt")
      if (isApparel) {
        optionsMap["Size"] = ["S", "M", "L", "XL"]
        optionsMap["Color"] = ["Black", "Grey", "White"]
      } else {
        optionsMap["Size"] = ["4", "5", "6", "7", "8", "10", "11", "12", "13", "14"]
        optionsMap["Color / Metal"] = ["White", "Yellow", "Rose"]
      }
    }

    return optionsMap
  }

  // Reset options and validation when selected look changes
  useEffect(() => {
    setModalStep("info")
    setSelectedOptions({})
    setValidationError(null)
    setShowSizeChart(false)
  }, [selectedIndex])

  const handleOpenModal = (index: number) => {
    setSelectedIndex(index)
  }

  const handleCloseModal = () => {
    setSelectedIndex(null)
    setModalStep("info")
    setSelectedOptions({})
    setValidationError(null)
    setShowSizeChart(false)
  }

  const handlePrevLook = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((prev) =>
        prev === 0 ? allLooks.length - 1 : (prev as number) - 1
      )
    }
  }

  const handleNextLook = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((prev) =>
        prev === allLooks.length - 1 ? 0 : (prev as number) + 1
      )
    }
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isExpanded && sectionRef.current) {
      const yOffset = -80
      const element = sectionRef.current
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
    setIsExpanded(!isExpanded)
  }

  // Add to Cart Only (adds item to main cart)
  const handleAddToCartOnly = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!selectedLook) return

    const optionsMap = getDynamicProductOptions(selectedLook.product)
    const requiredOptionTitles = Object.keys(optionsMap)
    const unselectedOptions = requiredOptionTitles.filter(
      (optTitle) => !selectedOptions[optTitle]
    )

    if (unselectedOptions.length > 0) {
      setValidationError(`Please select ${unselectedOptions.join(" & ")}`)
      return
    }

    setValidationError(null)

    let targetVariantId = selectedLook.product.variantId
    if (selectedLook.product.variants && selectedLook.product.variants.length > 0) {
      const matchedVariant = selectedLook.product.variants.find((v: any) => {
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
      window.location.href = selectedLook.product.productUrl || `/${countryCode}/store`
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

  // Buy Now: Standalone temporary cart for instant single-product checkout
  const handleConfirmCheckout = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!selectedLook) return

    const optionsMap = getDynamicProductOptions(selectedLook.product)
    const requiredOptionTitles = Object.keys(optionsMap)
    const unselectedOptions = requiredOptionTitles.filter(
      (optTitle) => !selectedOptions[optTitle]
    )

    if (unselectedOptions.length > 0) {
      setValidationError(`Please select ${unselectedOptions.join(" & ")}`)
      return
    }

    setValidationError(null)

    let targetVariantId = selectedLook.product.variantId
    if (selectedLook.product.variants && selectedLook.product.variants.length > 0) {
      const matchedVariant = selectedLook.product.variants.find((v: any) => {
        if (!v.options) return true
        return v.options.every((opt: any) => {
          const optTitle = opt.option?.title || opt.title
          return !optTitle || !selectedOptions[optTitle] || selectedOptions[optTitle] === opt.value
        })
      })
      targetVariantId = matchedVariant?.id || selectedLook.product.variants[0]?.id || selectedLook.product.variantId
    }

    if (!targetVariantId) {
      targetVariantId = selectedLook.product.id
    }

    try {
      setIsBuying(true)
      await buyNow({
        variantId: targetVariantId,
        quantity: 1,
        countryCode,
        metadata: selectedOptions,
      })
      handleCloseModal()
      window.location.href = `/${countryCode}/checkout`
    } catch (err) {
      console.error("Buy now checkout failed:", err)
      handleCloseModal()
      window.location.href = `/${countryCode}/checkout`
    } finally {
      setIsBuying(false)
    }
  }

  const renderLookCard = (look: LookItem, index: number) => {
    return (
      <div
        key={look.id || `look-${index}`}
        onClick={() => handleOpenModal(index)}
        className={`${look.gridSpan || "col-span-1 row-span-1"} relative overflow-hidden aspect-square cursor-pointer bg-[#051109] group transition-colors duration-500`}
      >
        {/* Outer wrapper with subtle inset emerald frame on hover */}
        <div
          className={`w-full h-full relative transition-all duration-700 ease-out bg-[#051109] ${
            look.isFeatured
              ? "p-0 group-hover:p-3 sm:group-hover:p-4"
              : "p-0 group-hover:p-2 sm:group-hover:p-2.5"
          }`}
        >
          {/* Inner image container */}
          <div className="w-full h-full relative overflow-hidden">
            <Image
              src={look.image}
              alt={look.lookName}
              fill
              sizes={
                look.isFeatured
                  ? "(max-width: 768px) 100vw, 40vw"
                  : "(max-width: 768px) 50vw, 25vw"
              }
              className="object-cover object-center transform group-hover:scale-[1.03] transition-transform duration-700 ease-out"
            />

            {/* Inset Gold Border Accent on Hover */}
            <div className="absolute inset-0 border border-[#D4AF37]/0 group-hover:border-[#D4AF37]/40 transition-colors duration-700 ease-out pointer-events-none z-10" />

            {/* Subtle Gradient Vignette Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out pointer-events-none" />

            {/* SHOP THIS LOOK Badge: Elegant luxury button */}
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-400 ease-out">
              <div className="bg-[#051109]/90 backdrop-blur-sm text-white px-3.5 sm:px-4 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] border border-[#D4AF37]/60 shadow-lg">
                SHOP THIS LOOK
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section ref={sectionRef} className="w-full py-10 sm:py-14 md:py-16 bg-ivory-bg scroll-mt-20">
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6">
        {/* Header Title */}
        <div className="text-center mb-6 sm:mb-10">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-[0.25em] text-[#102a43] uppercase font-sans">
            SHOP BY LOOK
          </h2>
          <div className="w-10 h-0.5 bg-[#102a43] mx-auto mt-2 opacity-80" />
        </div>

        {/* Unified Collage Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 grid-flow-dense gap-2 sm:gap-3">
          {allLooks.map((look, idx) => renderLookCard(look, idx))}
        </div>

        {/* Plus (+) / Collapse Expand Button */}
        <div className="flex justify-center mt-6 sm:mt-8 md:mt-10">
          <button
            onClick={handleToggleExpand}
            aria-label={isExpanded ? "Show less looks" : "Show more looks"}
            className="p-3 sm:p-4 text-[#102a43] hover:text-[#0f172a] hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-none"
          >
            <svg
              className={`w-7 h-7 sm:w-9 sm:h-9 transition-transform duration-500 ease-in-out ${
                isExpanded ? "rotate-45" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Shop The Look Modal (Exact Zillionaire 2-Step Flow) */}
      <Transition appear show={!!selectedLook} as={React.Fragment}>
        <Dialog as="div" className="relative z-[100]" onClose={handleCloseModal}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-[28px] bg-gradient-to-br from-[#16261b] via-[#122019] to-[#0d1a11] text-left align-middle shadow-[0_25px_60px_rgba(0,0,0,0.6)] border border-[#D4AF37]/30 transition-all relative">
                  {/* Close button with matching gold glassmorphism hover effect */}
                  <button
                    onClick={handleCloseModal}
                    className="absolute top-4 right-4 z-30 p-2.5 text-white/80 bg-[#0d1a11]/60 hover:bg-[#D4AF37] hover:text-[#0d1a11] border border-[#D4AF37]/40 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 focus:outline-none hover:scale-105 active:scale-95"
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>

                  {selectedLook && (
                    <div className="grid grid-cols-1 md:grid-cols-2 min-h-[480px] md:min-h-[520px]">
                      {/* Left Side: Look Image with Navigation Arrows */}
                      <div className="relative aspect-square md:aspect-auto w-full h-full bg-[#0d1a11] flex items-center justify-center overflow-hidden group/img">
                        <Image
                          src={selectedLook.image}
                          alt={selectedLook.lookName}
                          fill
                          className="object-cover"
                        />

                        {/* Bottom Gradient overlay */}
                        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0d1a11] to-transparent pointer-events-none" />

                        {/* Prev Look Arrow */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePrevLook()
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-3 text-white bg-[#0d1a11]/60 hover:bg-[#D4AF37] hover:text-[#0d1a11] border border-[#D4AF37]/40 rounded-full transition-all duration-300 shadow-xl backdrop-blur-sm hover:scale-105 active:scale-95 focus:outline-none"
                          aria-label="Previous Look"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 19.5L8.25 12l7.5-7.5"
                            />
                          </svg>
                        </button>

                        {/* Next Look Arrow */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNextLook()
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-white bg-[#0d1a11]/60 hover:bg-[#D4AF37] hover:text-[#0d1a11] border border-[#D4AF37]/40 rounded-full transition-all duration-300 shadow-xl backdrop-blur-sm hover:scale-105 active:scale-95 focus:outline-none"
                          aria-label="Next Look"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Right Side: STEP 1 ("info") vs STEP 2 ("options") */}
                      {modalStep === "info" ? (
                        /* STEP 1: INITIAL SUMMARY CARD (Spacious Luxury Layout) */
                        <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-between items-center text-center relative overflow-hidden h-full">
                          {/* Ambient gold glow blob in background */}
                          <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-[#D4AF37]/[0.08] rounded-full blur-3xl" />

                          <div className="flex flex-col items-center relative z-10 w-full my-auto">
                            {/* Header Tag */}
                            <span className="text-[#D4AF37] font-semibold tracking-[0.25em] text-[10px] sm:text-xs uppercase block mb-4 font-sans">
                              SHOP THE LOOK
                            </span>

                            {/* Product Thumbnail Box */}
                            <div className="relative w-32 h-32 sm:w-40 sm:h-40 mb-4 sm:mb-5 rounded-2xl bg-[#0d1a11] border border-[#D4AF37]/40 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] group/prod">
                              <Image
                                src={selectedLook.product.image}
                                alt={selectedLook.product.title}
                                fill
                                className="object-cover object-center group-hover/prod:scale-105 transition-transform duration-500 ease-out"
                              />
                              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
                            </div>

                            {/* Product Title */}
                            <h3
                              className="text-base sm:text-lg font-semibold text-white tracking-wide font-sans leading-snug max-w-xs sm:max-w-sm mx-auto line-clamp-2 mb-2"
                              title={selectedLook.product.title}
                            >
                              {selectedLook.product.title}
                            </h3>

                            {/* Product Price */}
                            <p className="text-base sm:text-lg font-extrabold text-[#D4AF37] mb-3 font-sans">
                              {selectedLook.product.price}
                            </p>

                            {/* Quality Tag */}
                            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-5">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              GRA Certified Moissanite
                            </div>
                          </div>

                          {/* Step 1 Dual CTAs - Airy Balanced Position */}
                          <div className="relative z-10 w-full pt-2 flex flex-col sm:flex-row gap-3">
                            {/* View Product Button */}
                            <LocalizedClientLink
                              href={selectedLook.product.productUrl}
                              onClick={handleCloseModal}
                              className="flex-1 py-3.5 px-5 rounded-full border border-[#D4AF37] text-[#D4AF37] hover:bg-white hover:text-[#0d1a11] hover:border-white transition-all duration-300 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-95"
                            >
                              View Product
                            </LocalizedClientLink>

                            {/* Buy Now Button -> Opens Zillionaire Options Step */}
                            <button
                              onClick={() => setModalStep("options")}
                              className="flex-1 py-3.5 px-5 rounded-full bg-[#D4AF37] text-[#0d1a11] hover:bg-white transition-all duration-300 font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95"
                            >
                              Buy Now
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* STEP 2: DYNAMIC OPTION SELECTION VIEW WITH MANDATORY VALIDATION */
                        <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-between text-center relative overflow-hidden bg-[#0d1a11]/90 h-full">
                          {/* Ambient gold glow blob in background */}
                          <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-[#D4AF37]/[0.08] rounded-full blur-3xl" />

                          <div className="flex flex-col items-center relative z-10 w-full my-auto">
                            {/* Top Bar with Back Button + Centered Title */}
                            <div className="w-full flex items-center justify-between mb-4 border-b border-[#D4AF37]/20 pb-3">
                              <button
                                onClick={() => setModalStep("info")}
                                className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-white font-bold uppercase tracking-wider transition-colors"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M15.75 19.5L8.25 12l7.5-7.5"
                                  />
                                </svg>
                                Back
                              </button>

                              <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate max-w-[200px] font-sans">
                                {selectedLook.product.title}
                              </h4>

                              <div className="w-10" />
                            </div>

                            {/* Product Image Thumbnail */}
                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-3 rounded-2xl bg-[#0d1a11] border border-[#D4AF37]/40 overflow-hidden shadow-xl">
                              <Image
                                src={selectedLook.product.image}
                                alt={selectedLook.product.title}
                                fill
                                className="object-cover object-center"
                              />
                            </div>

                            {/* Dynamic Product Option Selector (Derived from Product Variants) */}
                            {Object.entries(getDynamicProductOptions(selectedLook.product)).map(
                              ([optionTitle, optionValues]) => {
                                const isSizeOption = optionTitle.toLowerCase().includes("size")
                                const selectedVal = selectedOptions[optionTitle]
                                const isMissing = validationError && !selectedVal

                                return (
                                  <div key={optionTitle} className="w-full max-w-xs mb-3 text-left">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider font-sans">
                                        SELECT {optionTitle}
                                      </label>
                                      {isSizeOption && (
                                        <button
                                          type="button"
                                          onClick={() => setShowSizeChart(true)}
                                          className="text-[10px] text-[#D4AF37] hover:text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                          </svg>
                                          Size Chart
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                      {optionValues.map((val) => {
                                        const isActive = selectedVal === val
                                        return (
                                          <button
                                            key={val}
                                            type="button"
                                            onClick={() => {
                                              setSelectedOptions((prev) => ({ ...prev, [optionTitle]: val }))
                                              setValidationError(null)
                                            }}
                                            className={`py-2 px-3 sm:px-4 rounded-full text-xs font-bold transition-all duration-300 border flex items-center justify-center ${
                                              isActive
                                                ? "bg-[#D4AF37] text-[#0d1a11] border-[#D4AF37] shadow-md scale-105"
                                                : isMissing
                                                ? "bg-white/5 text-white/90 border-[#D4AF37]/80 hover:border-[#D4AF37]"
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
                          </div>

                          {/* Ultra-Premium Champagne Gold Validation Notification Badge */}
                          {validationError && (
                            <div className="relative z-10 w-full max-w-xs mx-auto mb-3 py-2 px-4 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                              <svg className="w-4 h-4 text-[#D4AF37] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="tracking-wide">{validationError}</span>
                            </div>
                          )}

                          {/* Step 2 Bottom Bar: Price + ADD TO CART & BUY NOW Buttons */}
                          <div className="relative z-10 w-full pt-3 border-t border-white/10 flex items-center justify-between gap-2.5">
                            <div className="text-left shrink-0">
                              <span className="text-[9px] uppercase tracking-widest text-white/60 block font-sans">PRICE</span>
                              <span className="text-xs sm:text-sm font-extrabold text-[#D4AF37] font-sans">
                                {selectedLook.product.price}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* ADD TO CART */}
                              <button
                                onClick={handleAddToCartOnly}
                                disabled={isBuying}
                                className={`py-2.5 px-3.5 rounded-full border border-[#D4AF37]/60 text-white hover:bg-[#D4AF37]/20 transition-all duration-300 font-bold text-[10px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md ${
                                  addedSuccess ? "bg-emerald-600/30 border-emerald-400 text-emerald-300" : ""
                                }`}
                              >
                                {addedSuccess ? "✓ ADDED" : "ADD TO CART"}
                              </button>

                              {/* BUY NOW */}
                              <button
                                onClick={handleConfirmCheckout}
                                disabled={isBuying}
                                className="py-2.5 px-4 rounded-full bg-[#D4AF37] text-[#0d1a11] hover:bg-white transition-all duration-300 font-bold text-[10px] sm:text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 disabled:opacity-75"
                              >
                                {isBuying ? (
                                  <>
                                    <svg className="animate-spin h-3.5 w-3.5 text-[#0d1a11]" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    BUY NOW
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                                      />
                                    </svg>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Side Slide-Over Ring Size Guide Drawer (Cultura Jewels Luxury Theme) */}
      <Transition appear show={showSizeChart} as={React.Fragment}>
        <Dialog as="div" className="relative z-[120]" onClose={() => setShowSizeChart(false)}>
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
