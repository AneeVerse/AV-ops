interface FeatureItem {
  name: string
  subtitle: string
  svgIcon: React.ReactNode
}

const features: FeatureItem[] = [
  {
    name: "Insured Shipping",
    subtitle: "Free secure delivery",
    svgIcon: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2.5">
        <rect x="20" y="25" width="60" height="50" rx="3" />
        <path d="M20 40 H80 M50 25 V75" />
        <polygon points="50,15 60,25 40,25" />
      </svg>
    ),
  },
  {
    name: "7-Day Returns",
    subtitle: "Hassle-free exchanges",
    svgIcon: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2.5">
        <path d="M30 40 C30 20, 70 20, 70 40 C70 60, 30 65, 30 80 H70" />
        <polyline points="20,70 30,80 40,70" />
      </svg>
    ),
  },
  {
    name: "925 Pure Silver",
    subtitle: "Nickel-free silver base",
    svgIcon: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2.5">
        <polygon points="50,15 80,45 50,85 20,45" />
        <line x1="50" y1="15" x2="50" y2="85" />
      </svg>
    ),
  },
  {
    name: "Velvet Packaging",
    subtitle: "Premium luxury boxes",
    svgIcon: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8 stroke-[#D4AF37] fill-none" viewBox="0 0 100 100" strokeWidth="2.5">
        <rect x="25" y="25" width="50" height="50" rx="4" />
        <path d="M25 45 H75 M50 25 V75" />
        <path d="M40 25 C40 18, 60 18, 60 25" />
      </svg>
    ),
  },
]

const Features = () => {
  return (
    <div className="w-full py-6 sm:py-8 lg:py-12 px-4 sm:px-6 md:px-8 lg:px-12 bg-[#FCFBF7] border-t border-[#E6C280]/20">
      <div className="max-w-[1360px] mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 justify-items-center">
          {features.map((feature, index) => (
            <div
              key={feature.name}
              className={`
                flex flex-row items-center justify-start 
                w-full relative px-2 sm:px-4 py-2
                ${index < features.length - 1 && index !== 1 ? 'md:border-r border-[#E6C280]/20' : ''}
              `}
            >
              <div className="flex-shrink-0 mr-3 transform hover:scale-105 transition-transform duration-200">
                {feature.svgIcon}
              </div>
              <div className="text-left min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0d1a11] leading-tight mb-0.5 uppercase tracking-wider font-sans">
                  {feature.name}
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium font-sans">
                  {feature.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Features
