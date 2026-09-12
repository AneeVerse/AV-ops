import { Metadata } from "next"
import HelpTemplate from "@modules/help/templates"

type Props = {
  params: Promise<{ countryCode: string }>
}

export const metadata: Metadata = {
  title: "Help & FAQs",
  description: "Get answers to your questions and contact our support team",
}

export default async function HelpPage(props: Props) {
  const params = await props.params
  const countryCode = params.countryCode

  const { getContactInfoFromConfig, getFaqsFromConfig } = await import("@lib/data/dynamic-config")
  let contactInfo = null
  let dynamicFaqs = null
  try {
      contactInfo = await getContactInfoFromConfig()
      dynamicFaqs = await getFaqsFromConfig()
  } catch (e) {
      // fallback
  }

  return <HelpTemplate countryCode={countryCode} contactInfo={contactInfo as any} dynamicFaqs={dynamicFaqs} />
}
