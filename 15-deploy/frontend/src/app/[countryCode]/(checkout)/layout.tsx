import Nav from "@modules/layout/templates/nav"
import Footer from "@modules/layout/templates/footer"
import { ModalProvider } from "@lib/context/modal-context"
import NavWrapper from "@modules/layout/components/nav-wrapper"
import { WishlistProvider } from "@lib/context/wishlist-context"
import CheckoutLeaveGuard from "@modules/checkout/components/checkout-leave-guard"
import { retrieveCustomer } from "@lib/data/customer"
import VerificationBanner from "@modules/layout/components/verification-banner"

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const customer = await retrieveCustomer()
  return (
    <WishlistProvider>
      <ModalProvider>
        <CheckoutLeaveGuard />
        <NavWrapper>
          <Nav />
        </NavWrapper>
        {customer && <VerificationBanner customer={customer} />}
        <div className="w-full bg-ivory-bg relative min-h-screen">
          <div className="relative" data-testid="checkout-container">{children}</div>
        </div>
        <Footer />
      </ModalProvider>
    </WishlistProvider>
  )
}
