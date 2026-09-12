import { Metadata } from "next"
import { HttpTypes } from "@medusajs/types"

import nextDynamic from "next/dynamic"
import { listCategories } from "@lib/data/categories"
import Hero from "@modules/home/components/hero"
import ShopByShape from "@modules/home/components/shop-by-shape"
import ShopByCategory from "@modules/home/components/shop-by-category"
import CelestiqueCollection from "@modules/home/components/celestique-collection"
import NewArrivals from "@modules/home/components/new-arrivals"

// Dynamic imports for components further down the page or with large data
const WhyChooseUs = nextDynamic(() => import("@modules/home/components/why-choose-us"))
const LovedByMoms = nextDynamic(() => import("@modules/home/components/loved-by-moms"))
const Features = nextDynamic(() => import("@modules/home/components/features"))
const Testimonials = nextDynamic(() => import("@modules/home/components/testimonials"))
const ShopByLook = nextDynamic(() => import("@modules/home/components/shop-by-look"))
const ShopByVideo = nextDynamic(() => import("@modules/home/components/shop-by-video"))

import { listProductsWithSort, getProductsByTag } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getTestimonialsFromConfig } from "@lib/data/dynamic-config"
import { fetchRatings } from "@lib/data/reviews"
import { getMockHomeProducts, getMockRegion } from "@lib/data/ui-mocks"
import { getShopByStoneShapes } from "@lib/data/dynamic-config"
import { getShopByLooksFromApi } from "@lib/data/shop-by-look"
import { getShopByVideosFromApi } from "@lib/data/shop-by-video"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Exquisite Moissanite Jewelry Store | Cultura Jewels",
  description:
    "Explore Cultura Jewels's premium collection of Moissanite jewelry. Shop custom-crafted rings, necklaces, earrings, and pendants set in pure 925 sterling silver.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  // Skip slow Medusa calls while VPS/backend is unreachable — UI work only
  const backendUp = await Promise.race([
    fetch(`${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/health`, {
      cache: "no-store",
    })
      .then((r) => r.ok)
      .catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
  ])

  const region =
    (backendUp
      ? await getRegion(countryCode).catch(() => null)
      : null) || getMockRegion(countryCode)

  // Mocks are local/offline UI only — never show INR placeholders on live regions.
  const useMocks = !backendUp
  const mockProducts = useMocks ? getMockHomeProducts(countryCode) : []

  let categories: any[] = []
  let newArrivals = mockProducts
  let bestsellers = mockProducts
  let testimonialsData: any = null
  let allRatings: any[] = []
  let stoneShapes: Awaited<ReturnType<typeof getShopByStoneShapes>> = null
  let dynamicLooks: any[] | null = null
  let dynamicVideos: any[] | null = null

  if (backendUp) {
    const [
      categoriesResult,
      newArrivalsResult,
      bestsellersResult,
      testimonialsResult,
      ratingsResult,
      stoneShapesResult,
      looksResult,
      videosResult,
    ] = await Promise.all([
      listCategories({ limit: 50 }).catch(() => []),
      listProductsWithSort({
        page: 1,
        queryParams: { limit: 12 },
        sortBy: "created_at_desc",
        countryCode,
      }).catch(() => ({ response: { products: [] } })),
      getProductsByTag({
        tagValue: "bestseller",
        limit: 10,
        countryCode,
      }).catch(() => []),
      getTestimonialsFromConfig().catch(() => null),
      fetchRatings().catch(() => []),
      getShopByStoneShapes().catch(() => null),
      getShopByLooksFromApi().catch(() => null),
      getShopByVideosFromApi().catch(() => null),
    ])

    categories = categoriesResult || []
    newArrivals = (newArrivalsResult as any).response?.products || []
    bestsellers = bestsellersResult?.length ? bestsellersResult : []
    testimonialsData = testimonialsResult
    allRatings = ratingsResult || []
    stoneShapes = stoneShapesResult
    dynamicLooks = looksResult
    dynamicVideos = videosResult
  }

  // Structured Data (JSON-LD) for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Cultura Jewels",
    "alternateName": "Cultura Jewels Moissanite Jewelry",
    "url": "https://onecarat.world",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://onecarat.world/store?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Cultura Jewels",
    "url": "https://onecarat.world",
    "logo": "https://onecarat.world/Logo.png",
    "sameAs": [
      "https://www.instagram.com/onecarat.world/",
      "https://www.facebook.com/onecarat.world"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91 91527 55529",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["en", "hi"]
    }
  }

  return (
    <div className="bg-ivory-bg w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <Hero carouselProducts={newArrivals} />
      <ShopByCategory categories={categories} />
      <LovedByMoms
        products={bestsellers.length ? bestsellers : newArrivals}
        region={region}
        ratings={allRatings}
      />
      <CelestiqueCollection />
      <ShopByShape shapes={stoneShapes} />
      <ShopByLook
        products={bestsellers.length ? bestsellers : newArrivals}
        region={region}
        initialLooks={dynamicLooks || undefined}
      />
      <ShopByVideo
        products={bestsellers.length ? bestsellers : newArrivals}
        region={region}
        initialVideos={dynamicVideos || undefined}
      />
      <WhyChooseUs />
      <NewArrivals
        products={newArrivals}
        region={region}
        ratings={allRatings}
      />
      <Testimonials initialData={testimonialsData} />
      <Features />
    </div>
  )
}
