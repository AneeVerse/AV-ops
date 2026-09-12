import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { SHOP_NAME_LINE1, SHOP_NAME_LINE2 } from "@lib/util/brand"

const DynamicLogo = async () => {
  return (
    <LocalizedClientLink
      href="/"
      className="inline-flex flex-col items-center sm:items-start justify-center gap-0.5 py-0.5 group shrink-0"
      data-testid="nav-store-link"
    >
      <span className="block font-serif text-base sm:text-lg md:text-xl font-bold tracking-[0.12em] text-royal-blue group-hover:text-gold-accent transition-colors uppercase leading-none">
        {SHOP_NAME_LINE1}
      </span>
      <span className="block text-[8px] sm:text-[9px] font-semibold tracking-[0.18em] text-gold-accent group-hover:text-royal-blue transition-colors uppercase leading-none sm:pl-px">
        {SHOP_NAME_LINE2}
      </span>
    </LocalizedClientLink>
  )
}

export default DynamicLogo
