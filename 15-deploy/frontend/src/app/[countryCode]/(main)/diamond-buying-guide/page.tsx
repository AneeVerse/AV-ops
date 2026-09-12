import { Metadata } from "next"
import DiamondGuideTemplate from "@modules/buying-guides/templates/diamond-guide"

export const metadata: Metadata = {
  title: "Diamond Buying Guide | Expert Tips & Advice | Cultura Jewels",
  description: "Comprehensive diamond buying guide covering the 4Cs (Cut, Clarity, Color, Carat), diamond shapes, certification (GIA, IGI, SGL), and care tips.",
}

export default function DiamondBuyingGuidePage() {
  return <DiamondGuideTemplate />
}
