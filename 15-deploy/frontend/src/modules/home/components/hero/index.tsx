import { HttpTypes } from "@medusajs/types"
import MockupHero from "@modules/home/components/mockup-hero"

type HeroProps = {
  carouselProducts: HttpTypes.StoreProduct[]
}

const Hero = ({ carouselProducts }: HeroProps) => {
  return <MockupHero carouselProducts={carouselProducts} />
}

export default Hero
