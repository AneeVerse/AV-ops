import { Metadata } from "next"
import MoissaniteGuideTemplate from "@modules/buying-guides/templates/moissanite-guide"

export const metadata: Metadata = {
  title: "What is Moissanite? | One Carat Moissanite Guide | Cultura Jewels",
  description: "Learn everything about Moissanite gemstones: brilliance, dispersion, durability on Mohs scale, and why lab-grown moissanite is the ultimate choice for fine jewelry.",
}

export default function MoissanitePage() {
  return <MoissaniteGuideTemplate />
}
