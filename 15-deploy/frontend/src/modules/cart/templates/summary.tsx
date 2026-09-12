"use client"

import CartTotals from "@modules/common/components/cart-totals"
import DiscountCode from "@modules/checkout/components/discount-code"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
  customer: HttpTypes.StoreCustomer | null
}

function getCheckoutStep(cart: HttpTypes.StoreCart, customer: HttpTypes.StoreCustomer | null) {
  return "payment"
}

const Summary = ({ cart, customer }: SummaryProps) => {
  const step = getCheckoutStep(cart, customer)

  return (
    <div className="flex flex-col gap-y-4 min-[550px]:gap-y-5 sm:gap-y-6">
      <DiscountCode cart={cart} />
      <CartTotals totals={cart} items={cart.items} checkoutStep={step} customer={customer} />
    </div>
  )
}

export default Summary
