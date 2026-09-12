import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import CategoryMobileScroll, {
  CategoryScrollItem,
} from "./category-mobile-scroll"

type ShopByCategoryProps = {
  categories: HttpTypes.StoreProductCategory[]
}

interface CollectionItem {
  id: string
  name: string
  handle: string
  image: string
  description: string
  backgroundColor: string
}

const JEWELRY_HANDLES = [
  "earrings",
  "rings",
  "necklaces",
  "bracelets",
  "pendants",
  "piercings",
  "mangalsutras",
  "silver-jewelry",
]

const DEMO_HANDLES = new Set(["sweatshirts", "shirts", "merch", "pants"])

const fallbackCollections: CollectionItem[] = [
  {
    id: "earrings",
    name: "Earrings",
    handle: "earrings",
    image: "/category/earrings.png",
    description: "Multi-gemstone luxury studs & drops",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "rings",
    name: "Rings",
    handle: "rings",
    image: "/category/rings.png",
    description: "Luxury stackable gold & diamond rings",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "necklaces",
    name: "Necklaces & Chokers",
    handle: "necklaces",
    image: "/category/necklaces.png",
    description: "Stunning gemstone collar necklaces",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "bracelets",
    name: "Bracelets",
    handle: "bracelets",
    image: "/category/bracelets.png",
    description: "Elegant gold chain & gemstone cuffs",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "pendants",
    name: "Pendants & Charms",
    handle: "pendants",
    image: "/category/pendants.png",
    description: "Pink quartz & flower pendant necklaces",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "piercings",
    name: "Piercing",
    handle: "piercings",
    image: "/category/piercings.png",
    description: "Dainty barbell piercing jewelry",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "mangalsutras",
    name: "Mangalsutras",
    handle: "mangalsutras",
    image: "/category/mangalsutras.png",
    description: "Sacred threads in modern gold designs",
    backgroundColor: "#F5F5F5",
  },
  {
    id: "silver-jewelry",
    name: "Silver Jewelry",
    handle: "silver-jewelry",
    image: "/category/silver-jewelry.png",
    description: "Everyday sterling silver brilliant items",
    backgroundColor: "#F5F5F5",
  },
]

const fallbackByHandle = Object.fromEntries(
  fallbackCollections.map((c) => [c.handle, c])
)

const DISPLAY_NAMES: Record<string, string> = {
  necklaces: "Necklaces & Chokers",
  pendants: "Pendants & Charms",
  piercings: "Piercing",
}

const StarIntersection = () => (
  <div className="bg-white w-5 h-5 rounded-full border border-gray-200/80 flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] z-30">
    <svg className="w-3 h-3 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
    </svg>
  </div>
)

const ShopByCategory = ({ categories }: ShopByCategoryProps) => {
  const topLevel = (categories || []).filter((c) => !c.parent_category_id)
  const jewelry = topLevel.filter((c) =>
    JEWELRY_HANDLES.includes((c.handle || "").toLowerCase())
  )
  const relevant =
    jewelry.length > 0
      ? jewelry
      : topLevel.filter((c) => !DEMO_HANDLES.has((c.handle || "").toLowerCase()))

  const displayItems: CollectionItem[] =
    relevant.length > 0
      ? relevant
          .slice()
          .sort((a, b) => {
            const ai = JEWELRY_HANDLES.indexOf((a.handle || "").toLowerCase())
            const bi = JEWELRY_HANDLES.indexOf((b.handle || "").toLowerCase())
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })
          .map((cat) => {
            const handle = (cat.handle || "").toLowerCase()
            const fallback = fallbackByHandle[handle]
            const metadata = (cat as any).metadata || {}
            return {
              id: cat.id,
              name: DISPLAY_NAMES[handle] || cat.name || fallback?.name || "",
              handle: cat.handle || "",
              image:
                metadata.category_image ||
                fallback?.image ||
                "/category/rings.png",
              description:
                cat.description || fallback?.description || "",
              backgroundColor:
                metadata.category_background_color || "#F5F5F5",
            }
          })
      : fallbackCollections

  const items = displayItems.slice(0, 8)
  const mobileItems: CategoryScrollItem[] = items.map((item) => {
    const isFallback = fallbackByHandle[item.handle]
      ? item.id === item.handle
      : false
    return {
      id: item.id,
      name: item.name,
      handle: item.handle,
      image: item.image,
      linkUrl: isFallback
        ? `/store?q=${item.handle}`
        : `/store?category=${item.id}`,
    }
  })

  return (
    <div className="w-full py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-[#D4AF37] font-semibold tracking-[0.2em] text-[10px] sm:text-xs uppercase block mb-3 font-sans">
            Curated Collections
          </span>
          <h2 className="h2-serif uppercase tracking-wider mb-4 text-[#0d1a11]">
            Shop By Category
          </h2>
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="h-[1px] w-12 bg-[#D4AF37]/45" />
            <span className="text-[#D4AF37] text-[8px] transform rotate-45">
              &#9670;
            </span>
            <span className="h-[1px] w-12 bg-[#D4AF37]/45" />
          </div>
          <p className="text-sm font-sans text-gray-500 leading-relaxed max-w-lg mx-auto tracking-wide">
            Explore our meticulously designed Moissanite creations categorised
            to help you find your perfect spark.
          </p>
        </div>
      </div>

      <CategoryMobileScroll items={mobileItems} />

      <div className="hidden md:block w-full border-t border-b border-gray-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none z-30">
              {[25, 50, 75].map((left) => (
                <div key={`t-${left}`}>
                  <div
                    className="absolute top-0 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%` }}
                  >
                    <StarIntersection />
                  </div>
                  <div
                    className="absolute top-[50%] -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%` }}
                  >
                    <StarIntersection />
                  </div>
                  <div
                    className="absolute bottom-0 -translate-x-1/2 translate-y-1/2"
                    style={{ left: `${left}%` }}
                  >
                    <StarIntersection />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-0">
              {items.map((item, idx) => {
                const isFallback = item.id === item.handle
                const linkUrl = isFallback
                  ? `/store?q=${item.handle}`
                  : `/store?category=${item.id}`

                let borderClasses = ""
                if (idx % 4 !== 3) borderClasses += " border-r"
                if (idx < 4) borderClasses += " border-b"
                if (borderClasses) borderClasses += " border-gray-200"

                return (
                  <LocalizedClientLink
                    key={item.id}
                    href={linkUrl}
                    className={`w-full flex flex-col items-center justify-center p-6 lg:p-8 group transition-all duration-300 ${borderClasses}`}
                  >
                    <div className="w-full aspect-square max-w-[240px] rounded-[16px] bg-[#F5F5F5] flex items-center justify-center p-5 relative overflow-hidden transition-all duration-300 group-hover:brightness-[0.98]">
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={240}
                        height={240}
                        className="object-contain max-h-full max-w-full group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                        style={{
                          maskImage:
                            "radial-gradient(circle at center, white 52%, transparent 74%)",
                          WebkitMaskImage:
                            "radial-gradient(circle at center, white 52%, transparent 74%)",
                        }}
                      />
                    </div>
                    <h3 className="font-sans text-[15px] font-normal text-gray-800 mt-4 group-hover:text-[#D4AF37] transition-colors duration-300 text-center">
                      {item.name}
                    </h3>
                  </LocalizedClientLink>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShopByCategory
