import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { ShopByStoneShape } from "@lib/data/dynamic-config"

interface ShapeItem {
  name: string
  label: string
  vibe: string
  link: string
  image?: string
  svgPath?: React.ReactNode
}

const fallbackShapes: ShapeItem[] = [
  {
    name: "Round",
    label: "ROUND",
    vibe: "Brilliant & Classic",
    link: "/store?q=Round",
    image: "/shapes/round.svg",
  },
  {
    name: "Princess",
    label: "PRINCESS",
    vibe: "Modern & Geometric",
    link: "/store?q=Princess",
    image: "/shapes/princess.svg",
  },
  {
    name: "Cushion",
    label: "CUSHION",
    vibe: "Vintage & Soft",
    link: "/store?q=Cushion",
    image: "/shapes/cushion.svg",
  },
  {
    name: "Oval",
    label: "OVAL",
    vibe: "Elongated & Elegant",
    link: "/store?q=Oval",
    image: "/shapes/oval.svg",
  },
  {
    name: "Emerald",
    label: "EMERALD",
    vibe: "Clean & Sophisticated",
    link: "/store?q=Emerald",
    image: "/shapes/emerald.svg",
  },
  {
    name: "Pear",
    label: "PEAR",
    vibe: "Unique & Teardrop",
    link: "/store?q=Pear",
    image: "/shapes/pear.svg",
  },
  {
    name: "Marquise",
    label: "MARQUISE",
    vibe: "Striking & Distinct",
    link: "/store?q=Marquise",
    image: "/shapes/marquise.svg",
  },
  {
    name: "Heart",
    label: "HEART",
    vibe: "Romantic & Bold",
    link: "/store?q=Heart",
    image: "/shapes/heart.svg",
  },
]

type Props = {
  shapes?: ShopByStoneShape[] | null
}

export default function ShopByShape({ shapes: configShapes }: Props) {
  const formatImagePath = (img?: string) => {
    if (!img) return img
    return img
      .replace(/^https?:\/\/[^\/]+/, "")
      .replace("/static/shapes/", "/shapes/")
  }

  const shapes: ShapeItem[] =
    configShapes && configShapes.length > 0
      ? configShapes.map((s) => ({
          name: s.name,
          label: s.label || s.name.toUpperCase(),
          vibe: s.vibe || "",
          link: s.link,
          image: formatImagePath(s.image),
        }))
      : fallbackShapes.map((s) => ({
          ...s,
          image: formatImagePath(s.image),
        }))

  return (
    <div className="py-16 sm:py-20 md:py-28 bg-[#FAF9F5]">
      <div className="content-container">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-20">
          <span className="text-[#D4AF37] font-semibold tracking-[0.2em] text-[10px] sm:text-xs uppercase block mb-3 font-sans">
            Curated Brilliance
          </span>
          <h2 className="h2-serif uppercase tracking-wider mb-4 text-[#0d1a11]">
            Shop By Stone Shape
          </h2>
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="h-[1px] w-12 bg-[#D4AF37]/45" />
            <span className="text-[#D4AF37] text-[8px] transform rotate-45">&#9670;</span>
            <span className="h-[1px] w-12 bg-[#D4AF37]/45" />
          </div>
          <p className="text-sm font-sans text-gray-500 leading-relaxed max-w-lg mx-auto tracking-wide">
            Explore moissanite cuts meticulously crafted to capture light from every angle. Find the shape that defines your personal brilliance.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {shapes.map((shape) => (
            <LocalizedClientLink
              key={shape.name}
              href={shape.link}
              className="bg-white border border-[#E6C280]/35 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-500 transform hover:-translate-y-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-10px_rgba(212,175,55,0.18)] hover:border-[#D4AF37] group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.025)_0%,_transparent_75%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="mb-6 h-12 w-12 flex items-center justify-center transform group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.25)] transition-all duration-500 relative z-10">
                {shape.image ? (
                  <Image
                    src={shape.image}
                    alt={shape.name}
                    width={48}
                    height={48}
                    className="object-contain w-12 h-12"
                    unoptimized={shape.image.endsWith(".svg")}
                  />
                ) : (
                  shape.svgPath
                )}
              </div>
              <h3 className="font-sans text-xs sm:text-sm font-bold text-[#0d1a11] tracking-[0.15em] mb-2 uppercase group-hover:text-[#D4AF37] transition-colors relative z-10">
                {shape.label}
              </h3>
              <p className="text-[10px] sm:text-xs font-sans text-gray-400 font-medium relative z-10 transition-colors group-hover:text-gray-500">
                {shape.vibe}
              </p>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </div>
  )
}
