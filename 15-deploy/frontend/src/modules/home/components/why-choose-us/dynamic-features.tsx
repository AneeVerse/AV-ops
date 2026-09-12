import { getFeaturesFromConfig } from "@lib/data/dynamic-config"

interface PromiseItem {
  name: string
  description: string
  svgIcon: React.ReactNode
}

const jewelryPromises: PromiseItem[] = [
  {
    name: "GRA Certified Moissanite",
    description: "Every Moissanite gemstone is accompanied by an official GRA Certificate of Authenticity specifying its cut, clarity, and color.",
    svgIcon: (
      <svg className="w-12 h-12 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2">
        <rect x="20" y="15" width="60" height="70" rx="4" />
        <path d="M35 30 H65 M35 45 H65 M35 60 H50" />
        <circle cx="65" cy="65" r="10" />
        <path d="M65 58 L68 64 L74 65 L69 69 L71 75 L65 71 L59 75 L61 69 L56 65 L62 64 Z" fill="#D4AF37" />
      </svg>
    )
  },
  {
    name: "Pure 925 Silver Base",
    description: "All our jewellery pieces are handcrafted in pure 925 Sterling Silver, finished with anti-tarnish rhodium or heavy 18K gold plating.",
    svgIcon: (
      <svg className="w-12 h-12 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2">
        <polygon points="50,15 80,45 50,85 20,45" />
        <polyline points="20,45 50,45 80,45" />
        <line x1="50" y1="15" x2="50" y2="85" />
        <line x1="35" y1="30" x2="65" y2="30" />
        <circle cx="50" cy="45" r="4" fill="#D4AF37" />
      </svg>
    )
  },
  {
    name: "BIS Hallmarked Purity",
    description: "Every piece bears the official Government-approved BIS Hallmark stamp, certifying gold, silver, and metal purity.",
    svgIcon: (
      <svg className="w-12 h-12 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2">
        <polygon points="50,15 85,75 15,75" />
        <polygon points="50,30 73,70 27,70" />
        <circle cx="50" cy="53" r="5" fill="#D4AF37" />
      </svg>
    )
  },
  {
    name: "Free Insured Shipping",
    description: "We offer secure, fully-insured delivery across India to your doorstep, with tamper-proof premium packaging.",
    svgIcon: (
      <svg className="w-12 h-12 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2">
        <rect x="20" y="30" width="60" height="50" rx="3" />
        <path d="M20 45 H80 M50 30 V80 M50 30 L30 15 M50 30 L70 15" />
        <circle cx="50" cy="55" r="7" />
        <path d="M47 55 L49 57 L53 53" strokeWidth="2.5" />
      </svg>
    )
  }
]

const DynamicFeatures = async () => {
  return (
    <div className="w-full py-20 sm:py-28 bg-gradient-to-b from-[#16261b] via-[#122019] to-[#0d1a11] relative overflow-hidden">
      {/* Ambient gold glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-[#D4AF37]/[0.07] rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-[#D4AF37]/[0.06] rounded-full blur-3xl" />

      <div className="content-container relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-20">
          <span className="text-[#D4AF37] font-semibold tracking-[0.25em] text-[10px] sm:text-xs uppercase block mb-3 font-sans">
            Guaranteed Luxury
          </span>
          <h2 className="h2-serif uppercase tracking-wider mb-4 text-[#F7F3EA]">
            The Cultura Jewels Promise
          </h2>
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="h-[1px] w-12 bg-[#D4AF37]/50" />
            <span className="text-[#D4AF37] text-[8px] transform rotate-45">&#9670;</span>
            <span className="h-[1px] w-12 bg-[#D4AF37]/50" />
          </div>
          <p className="text-sm font-sans text-white/55 leading-relaxed max-w-lg mx-auto tracking-wide">
            We hold ourselves to the highest standards of metal purity and gemstone calibration. Explore our four pillars of premium quality.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {jewelryPromises.map((promise, index) => (
            <div key={index} className="h-full">
              <div
                className="flex flex-col items-center text-center p-8 md:p-10 h-full rounded-[20px] bg-white/[0.03] backdrop-blur-sm border border-[#D4AF37]/20 hover:border-[#D4AF37]/60 hover:bg-white/[0.06] hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out group relative overflow-hidden"
              >
                {/* Faint pillar number watermark */}
                <span className="absolute top-4 right-5 font-serif text-[46px] leading-none text-white/[0.04] group-hover:text-[#D4AF37]/10 transition-colors duration-500 select-none pointer-events-none">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {/* Branded Icon Frame */}
                <div className="w-20 h-20 rounded-full bg-[#D4AF37]/[0.08] border border-[#D4AF37]/30 flex items-center justify-center mb-8 group-hover:bg-[#D4AF37]/[0.14] group-hover:border-[#D4AF37]/60 group-hover:shadow-[0_0_32px_rgba(212,175,55,0.28)] transition-all duration-500 ease-out relative z-10">
                  <div className="transform group-hover:scale-105 transition-transform duration-500">
                    {promise.svgIcon}
                  </div>
                </div>

                <h3 className="font-sans text-[13px] font-semibold text-[#F7F3EA] tracking-[0.18em] mb-3 uppercase group-hover:text-[#D4AF37] transition-colors relative z-10">
                  {promise.name}
                </h3>

                {/* Gold hairline under title */}
                <span className="h-[1px] w-8 bg-[#D4AF37]/40 mb-4 group-hover:w-12 group-hover:bg-[#D4AF37]/70 transition-all duration-500 relative z-10" />

                <p className="text-xs sm:text-sm font-sans text-white/55 leading-relaxed font-light relative z-10 transition-colors group-hover:text-white/75">
                  {promise.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DynamicFeatures
