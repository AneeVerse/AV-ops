import { Metadata } from "next"
import AboutTemplate from "@modules/about/templates"

export const metadata: Metadata = {
  title: "About Us | Cultura Jewels",
  description: "Learn more about the heritage, standards, and craftsmanship behind Cultura Jewels.",
}

export default function AboutPage() {
  return <AboutTemplate />
}
