import { getWebsiteDescriptionFromConfig } from "@lib/data/dynamic-config"

const FooterDescription = async () => {
  const description = (await getWebsiteDescriptionFromConfig()) || "Cultura Jewels is an online luxury jewellery brand specialising in GRA-certified Moissanite jewellery handcrafted in pure 925 sterling silver. We design elegant rings, earrings, pendants, and customized necklaces that capture diamond-like brilliance at an accessible price. Experience the pinnacle of craftsmanship, government-approved hallmarked purity, and sustainable, conflict-free fine jewellery."

  return (
    <p className="text-white text-xs sm:text-sm leading-relaxed">{description}</p>
  )
}

export default FooterDescription

