import { clx } from "@medusajs/ui"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import FooterLogo from "@modules/layout/components/footer-logo"
import FooterContact from "@modules/layout/components/footer-contact"
import FooterDescription from "@modules/layout/components/footer-description"
import FooterNewsletter from "@modules/layout/components/footer-newsletter"
import FooterCategories from "@modules/layout/components/footer-categories"
import { listCategories } from "@lib/data/categories"
import { getSocialLinksFromConfig } from "@lib/data/dynamic-config"

export default async function Footer() {
  const allCategories = await listCategories({ limit: 20 }).catch(() => [])
  const categories = (allCategories || []).filter(c => !c.parent_category_id).slice(0, 6)

  const fetchedSocialLinks = await getSocialLinksFromConfig().catch(() => null)

  // Default social links if none are configured in admin
  const defaultSocialLinks = [
    { name: "LinkedIn", url: "#", icon: "/LINK.svg" },
    { name: "Facebook", url: "#", icon: "/FACE.svg" },
    { name: "Instagram", url: "#", icon: "/INSTA.svg" },
    { name: "YouTube", url: "#", icon: "/YOU.svg" }
  ]

  const getFallbackIcon = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes("facebook")) return "/FACE.svg"
    if (n.includes("linkedin")) return "/LINK.svg"
    if (n.includes("instagram")) return "/INSTA.svg"
    if (n.includes("youtube")) return "/YOU.svg"
    return null
  }

  const socialLinks = (fetchedSocialLinks && fetchedSocialLinks.length > 0
    ? fetchedSocialLinks
    : defaultSocialLinks).map(link => ({
      ...link,
      icon: link.icon || getFallbackIcon(link.name)
    }))

  return (
    <footer className="w-full overflow-hidden" style={{ backgroundColor: '#0c1810', minHeight: 'auto' }}>
      <div className="mx-auto px-4 sm:px-6 md:px-6 lg:px-6 py-8 sm:py-12 md:py-16 flex flex-col" style={{ maxWidth: '1440px' }}>
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-4 md:gap-3 lg:gap-3 xl:gap-6 mb-8 sm:mb-10 md:mb-12">
          {/* Left Section - Brand Information */}
          <div className="col-span-2 sm:col-span-1 md:col-span-1 lg:col-span-1">
            <FooterLogo />
            <FooterDescription />
          </div>

          {/* Company Column */}
          <div className="flex flex-col gap-y-3 sm:gap-y-4">
            <h3 className="text-white text-sm sm:text-base font-semibold mb-1 sm:mb-2">Company</h3>
            <ul className="flex flex-col gap-y-1.5 sm:gap-y-2">
              <li>
                <LocalizedClientLink
                  href="/"
                  data-ga-event="footer_link_click"
                  data-ga-label="Home"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Home
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/store"
                  data-ga-event="footer_link_click"
                  data-ga-label="Shop"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Shop
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/blog"
                  data-ga-event="footer_link_click"
                  data-ga-label="Blog"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Blog
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/contact"
                  data-ga-event="footer_link_click"
                  data-ga-label="Contact Us"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Contact Us
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/help"
                  data-ga-event="footer_link_click"
                  data-ga-label="Help"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Help
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          {/* Separate Guides Column */}
          <div className="flex flex-col gap-y-3 sm:gap-y-4">
            <h3 className="text-white text-sm sm:text-base font-semibold mb-1 sm:mb-2">Guides</h3>
            <ul className="flex flex-col gap-y-1.5 sm:gap-y-2">
              <li>
                <LocalizedClientLink
                  href="/jewellery-buying-guide"
                  data-ga-event="footer_link_click"
                  data-ga-label="Jewellery Buying Guide"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Jewellery Buying Guide
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/diamond-buying-guide"
                  data-ga-event="footer_link_click"
                  data-ga-label="Diamond Buying Guide"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Diamond Buying Guide
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/what-is-moissanite"
                  data-ga-event="footer_link_click"
                  data-ga-label="What is Moissanite"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  What is Moissanite
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          {/* Shop Column with Subcategories */}
          <FooterCategories categories={categories} />

          {/* Policy Column */}
          <div className="flex flex-col gap-y-3 sm:gap-y-4">
            <h3 className="text-white text-sm sm:text-base font-semibold mb-1 sm:mb-2">Policy</h3>
            <ul className="flex flex-col gap-y-1.5 sm:gap-y-2">
              <li>
                <LocalizedClientLink
                  href="/made-to-order-policy"
                  data-ga-event="footer_link_click"
                  data-ga-label="Made To Order Policy"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Made To Order Policy
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/shipping-policy"
                  data-ga-event="footer_link_click"
                  data-ga-label="Shipping Policy"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Shipping Policy
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/return-policy"
                  data-ga-event="footer_link_click"
                  data-ga-label="Return Policy"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Return Policy
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/privacy-policy"
                  data-ga-event="footer_link_click"
                  data-ga-label="Privacy Policy"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Privacy Policy
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/terms-of-use"
                  data-ga-event="footer_link_click"
                  data-ga-label="Terms of Use"
                  className="text-white text-xs sm:text-sm hover:text-[#D4AF37] transition-colors"
                >
                  Terms of Use
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          {/* Contact Us Column */}
          <div className="col-span-2 sm:col-span-1 md:col-span-1 lg:col-span-1">
            <FooterContact />
          </div>
        </div>

        {/* Bottom Section - Newsletter, Social Media, Copyright */}
        <div className="border-t border-white/10 pt-6 sm:pt-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Newsletter */}
            <div className="flex-1 w-full lg:w-auto">
              <p className="text-white text-xs sm:text-sm mb-2 sm:mb-3">
                Get the latest insights and updates on luxury jewelry collections.
              </p>
            </div>
          </div>

          {/* Newsletter Input and Social Media */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-4 mb-4 sm:mb-6">
            <FooterNewsletter />

            {/* Social Media Icons */}
            <div className="flex items-center justify-center sm:justify-end gap-3 sm:gap-4 flex-shrink-0">
              {socialLinks?.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ga-event="social_click"
                  data-ga-label={link.name}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-all duration-300 relative bg-transparent hover:scale-110"
                  aria-label={link.name}
                >
                  {link.icon ? (
                    <Image
                      src={link.icon}
                      alt={link.name}
                      width={40}
                      height={40}
                      className="object-contain pointer-events-none"
                      quality={100}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center hover:bg-[#D4AF37] hover:border-[#D4AF37] transition-colors pointer-events-none">
                      <span className="text-white text-sm sm:text-base font-bold uppercase tracking-tighter">
                        {link.name.substring(0, 2)}
                      </span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center pt-4 sm:pt-6 border-t border-white/10">
            <p className="text-white text-xs sm:text-sm">
              © Cultura Jewels. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
