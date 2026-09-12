import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getHomeBannersFromConfig, getAppBannersFromConfig } from "@lib/data/dynamic-config"

const DynamicBanner = async () => {
  const homeBanners = await getHomeBannersFromConfig()
  const appBanners = await getAppBannersFromConfig()

  const defaultBanner = {
    image: "/newbanner.png",
    title: "Cultura Jewels Atelier",
    subtitle: "Where Light Becomes Legacy",
    description:
      "Hand-set moissanite in 925 sterling silver. GRA-certified stones, atelier craftsmanship, designed for a lifetime of brilliance.",
    buttonName: "Explore Collection",
    buttonLink: "/store",
  }

  const homeBanner =
    homeBanners && homeBanners.length > 0 ? homeBanners[0] : defaultBanner
  const homeBannerImage = homeBanner.image || "/newbanner.png"

  const firstAppBanner = appBanners && appBanners.length > 0 ? appBanners[0] : null
  const appBanner = {
    image: firstAppBanner?.image || "/appbanner.png",
    title: firstAppBanner?.title || homeBanner.title,
    subtitle: firstAppBanner?.subtitle || homeBanner.subtitle,
    description: firstAppBanner?.description || homeBanner.description,
    buttonName: firstAppBanner?.buttonName || homeBanner.buttonName,
    buttonLink: firstAppBanner?.buttonLink || homeBanner.buttonLink,
  }

  const HeroCopy = ({
    banner,
    compact = false,
  }: {
    banner: typeof defaultBanner
    compact?: boolean
  }) => (
    <div className={compact ? "space-y-4" : "space-y-6 md:space-y-8"}>
      <div className="space-y-4">
        {banner.title && (
          <p className="text-gold-accent font-sans text-[10px] sm:text-xs tracking-[0.35em] uppercase">
            {banner.title}
          </p>
        )}
        <div className="h-px w-12 bg-gold-accent/60" />
        {banner.subtitle && (
          <h1
            className={`font-serif font-medium text-royal-blue leading-[1.08] tracking-tight ${
              compact
                ? "text-2xl min-[451px]:text-3xl"
                : "text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem]"
            }`}
          >
            {banner.subtitle}
          </h1>
        )}
      </div>

      {banner.description && (
        <p
          className={`text-gray-500 font-sans leading-relaxed max-w-md ${
            compact ? "text-xs min-[451px]:text-sm line-clamp-3" : "text-sm md:text-base"
          }`}
        >
          {banner.description}
        </p>
      )}

      {banner.buttonName && (
        <div className={compact ? "pt-1" : "pt-2"}>
          <LocalizedClientLink href={banner.buttonLink || "/store"}>
            <button
              data-ga-event="hero_banner_click"
              data-ga-label={banner.buttonName || "Shop Now"}
              className="group inline-flex items-center gap-3 border border-royal-blue text-royal-blue bg-transparent hover:bg-royal-blue hover:text-white px-8 py-3.5 text-[11px] sm:text-xs font-sans font-medium uppercase tracking-[0.2em] transition-all duration-300"
            >
              {banner.buttonName}
              <span className="inline-block w-8 h-px bg-gold-accent group-hover:bg-white transition-colors" />
            </button>
          </LocalizedClientLink>
        </div>
      )}
    </div>
  )

  return (
    <section className="w-full bg-ivory-bg">
      {/* Desktop & tablet — split studio layout, full viewport below header */}
      <div className="hero-viewport hidden min-[551px]:flex">
        <div className="w-[44%] lg:w-[40%] xl:w-[38%] flex items-center bg-ivory-bg border-r border-gold-border/15 px-10 md:px-14 lg:px-16 xl:px-20 py-10 lg:py-12 relative z-10 overflow-y-auto">
          <div className="absolute top-8 left-10 md:left-14 lg:left-16 w-px h-16 bg-gradient-to-b from-gold-accent/80 to-transparent" />
          <HeroCopy banner={homeBanner} />
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden bg-royal-blue">
          {homeBannerImage ? (
            <Image
              src={homeBannerImage}
              alt={homeBanner.subtitle || "Cultura Jewels Jewelry"}
              fill
              sizes="(min-width: 1024px) 60vw, 55vw"
              className="object-cover object-[28%_center] scale-105"
              priority
            />
          ) : (
            <div className="w-full h-full bg-footer-navy" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ivory-bg/20 via-transparent to-royal-blue/10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-royal-blue/25 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Mobile — stacked editorial, full viewport below header */}
      <div className="hero-viewport block min-[551px]:hidden flex flex-col">
        <div className="relative flex-1 min-h-0 overflow-hidden bg-royal-blue">
          {appBanner.image ? (
            <Image
              src={appBanner.image}
              alt={appBanner.subtitle || "Cultura Jewels Jewelry"}
              fill
              sizes="100vw"
              className="object-cover object-[30%_center]"
              priority
            />
          ) : (
            <div className="w-full h-full bg-footer-navy" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ivory-bg" />
        </div>
        <div className="shrink-0 px-6 sm:px-10 py-8 sm:py-10 bg-ivory-bg border-t border-gold-border/20">
          <HeroCopy banner={appBanner} compact />
        </div>
      </div>
    </section>
  )
}

export default DynamicBanner
