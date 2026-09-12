import { retrieveCart, getAbandonedCarts } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string }>
}

export const metadata: Metadata = {
  title: "Bag",
  description: "View your bag",
}

export default async function Cart(props: Props) {
  const params = await props.params
  const countryCode = params.countryCode

  const cart = await retrieveCart().catch((error) => {
    return notFound()
  })

  const customer = await retrieveCustomer()
  const abandonedCarts = await getAbandonedCarts()

  return <CartTemplate cart={cart} customer={customer} countryCode={countryCode} abandonedCarts={abandonedCarts} />
}
