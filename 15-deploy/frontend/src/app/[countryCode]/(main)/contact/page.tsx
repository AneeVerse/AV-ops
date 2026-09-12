import { Metadata } from "next"
import ContactTemplate from "@modules/contact/templates"

type Props = {
  params: Promise<{ countryCode: string }>
}

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with us",
}

export default async function ContactPage(props: Props) {
  const params = await props.params
  const countryCode = params.countryCode

  const { getContactInfoFromConfig } = await import("@lib/data/dynamic-config")
  const contactInfo = await getContactInfoFromConfig()

  return <ContactTemplate countryCode={countryCode} contactInfo={contactInfo as any} />
}
