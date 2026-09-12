import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { SHOP_NAME_LINE1, SHOP_NAME_LINE2 } from "@lib/util/brand"

const FooterLogo = async () => {
  return (
    <LocalizedClientLink href="/" className="flex flex-col items-start justify-center mb-3 sm:mb-4 group">
      <span className="font-serif text-lg sm:text-xl font-bold tracking-[0.15em] text-white group-hover:text-[#D4AF37] transition-colors uppercase leading-none">
        {SHOP_NAME_LINE1}
      </span>
      <span className="text-[7px] sm:text-[9px] font-semibold tracking-[0.2em] text-[#D4AF37] group-hover:text-white transition-colors uppercase mt-1">
        {SHOP_NAME_LINE2}
      </span>
    </LocalizedClientLink>
  )
}

export default FooterLogo
