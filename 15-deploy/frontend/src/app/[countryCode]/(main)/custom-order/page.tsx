import { Metadata } from "next"
import CustomOrderTemplate from "@modules/custom-order/templates"

export const metadata: Metadata = {
  title: "Custom Order | Custom Work - Cultura Jewels",
  description: "Craft your bespoke custom jewelry, pendants, rings, and chains with our master artisans.",
}

export default function CustomOrderPage() {
  return <CustomOrderTemplate />
}
