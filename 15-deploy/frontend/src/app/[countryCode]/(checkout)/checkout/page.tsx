import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutBeginTracker from "@modules/checkout/components/checkout-begin-tracker"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout(props: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const searchParams = await props.searchParams
  const cartIdFromUrl = searchParams.cart_id as string
  
  const cart = await retrieveCart(cartIdFromUrl)

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3 min-[550px]:px-4 sm:px-6 md:px-8 min-[1023px]:px-4 min-[1150px]:px-6 min-[1360px]:px-8 py-4 min-[550px]:py-6 sm:py-8 md:py-12 min-[1023px]:py-10 min-[1150px]:py-12 min-[1360px]:py-12">
      <CheckoutBeginTracker cart={cart} />
      <div className="grid grid-cols-1 min-[1024px]:grid-cols-[1fr_416px] gap-4 min-[550px]:gap-5 sm:gap-6 md:gap-8 min-[768px]:gap-6 min-[1023px]:gap-4 min-[1150px]:gap-6 min-[1200px]:gap-10 min-[1360px]:gap-12 w-full items-start">
        <div className="w-full min-[1024px]:sticky min-[1024px]:top-20">
          <style dangerouslySetInnerHTML={{
            __html: `
            .checkout-form-scroll::-webkit-scrollbar { display: none; }
            .checkout-form-scroll { -ms-overflow-style: none; scrollbar-width: none; }
          `}} />
          <div className="w-full min-[1024px]:max-h-[calc(100vh-140px)] min-[1024px]:overflow-y-auto min-[1024px]:pr-4 checkout-form-scroll">
            <PaymentWrapper cart={cart}>
              <CheckoutForm cart={cart} customer={customer} />
            </PaymentWrapper>
          </div>
        </div>
        <div className="w-full min-[1024px]:sticky min-[1024px]:top-20">
          <CheckoutSummary cart={cart} customer={customer} />
        </div>
      </div>
    </div>
  )
}
