import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import YouMayAlsoLike from "../components/you-may-also-like"
import CartViewTracker from "../components/cart-view-tracker"
import AbandonedCarts from "../components/abandoned-carts"
import ScrollToPendingOrdersButton from "../components/abandoned-carts/ScrollToPendingOrdersButton"
import { HttpTypes } from "@medusajs/types"

const CartTemplate = ({
  cart,
  customer,
  countryCode,
  abandonedCarts,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  countryCode: string
  abandonedCarts?: {
    buyNowCarts: HttpTypes.StoreCart[]
    reorderCarts: HttpTypes.StoreCart[]
  }
}) => {
  return (
    <div className="bg-ivory-bg min-h-screen">
      <div className="w-full max-w-[1360px] mx-auto px-3 min-[550px]:px-4 sm:px-6 md:px-8 min-[1023px]:px-4 min-[1150px]:px-6 min-[1360px]:px-8 pt-3 pb-4 min-[550px]:pt-4 min-[550px]:pb-6 sm:pt-5 sm:pb-8 md:pt-6 md:pb-12 min-[1023px]:pt-6 min-[1023px]:pb-10 min-[1150px]:pt-6 min-[1150px]:pb-12 min-[1360px]:pt-8 min-[1360px]:pb-12" data-testid="cart-container">
        
        {cart?.items?.length ? (
          <>
            <CartViewTracker cart={cart} />
            
            <div className="grid grid-cols-1 min-[1024px]:grid-cols-[1fr_380px] min-[1150px]:grid-cols-[1fr_420px] gap-4 min-[550px]:gap-5 sm:gap-6 md:gap-8 min-[768px]:gap-6 min-[1023px]:gap-4 min-[1150px]:gap-6 min-[1200px]:gap-10 min-[1360px]:gap-12 w-full">
              <div className="flex flex-col gap-y-3 min-[550px]:gap-y-4 sm:gap-y-6 order-1 min-[768px]:order-1 min-[1024px]:order-1 w-full min-w-0">
                <div className="w-full min-[1024px]:pr-2">


                  {!customer && (
                    <div className="mb-4">
                      <SignInPrompt />
                      <Divider />
                    </div>
                  )}

                  <ItemsTemplate cart={cart} />
                  
                  <div className="mt-4 min-[1024px]:mt-6">
                    <AbandonedCarts abandonedCarts={abandonedCarts} countryCode={countryCode} />
                  </div>
                </div>
              </div>
              <div className="relative order-2 min-[768px]:order-2 min-[1024px]:order-2 w-full min-[1024px]:w-auto h-full">
                <div className="flex flex-col gap-y-4 min-[550px]:gap-y-5 sm:gap-y-6 min-[768px]:gap-y-6 min-[1024px]:sticky min-[1024px]:top-20 w-full">
                  {cart && cart.region && (
                    <Summary cart={cart as any} customer={customer} />
                  )}
                </div>
              </div>
            </div>

            <YouMayAlsoLike cart={cart} countryCode={countryCode} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center w-full min-h-[50vh] pt-8 pb-16">
            {abandonedCarts && (abandonedCarts.buyNowCarts.length > 0 || abandonedCarts.reorderCarts.length > 0) ? (
              <div className="w-full max-w-4xl px-4 animate-in fade-in duration-500">
                <div className="text-center mb-10">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 mb-3 tracking-tight">
                    You have pending orders
                  </h1>
                  <p className="text-neutral-500 text-base sm:text-lg max-w-md mx-auto">
                    Your main cart is empty, but you left some items behind. Complete your purchase below!
                  </p>
                </div>
                <AbandonedCarts abandonedCarts={abandonedCarts} countryCode={countryCode} />
              </div>
            ) : (
              <EmptyCartMessage />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CartTemplate
