import { Metadata } from "next"
import JewelleryGuideTemplate from "@modules/buying-guides/templates/jewellery-guide"

export const metadata: Metadata = {
  title: "Jewellery Buying Guide for Women & Men | Cultura Jewels",
  description: "Complete guide to choosing fine jewellery for men and women, including metal options (White Gold, Rose Gold, Yellow Gold, Platinum), diamond/gemstone selection, and category styles.",
}

export default function JewelleryBuyingGuidePage() {
  return <JewelleryGuideTemplate />
}
