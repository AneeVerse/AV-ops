import { Suspense } from "react"
import Image from "next/image"

import { listRegions } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion, HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import DynamicLogo from "@modules/layout/components/dynamic-logo"
import MobileMenu from "@modules/layout/components/mobile-menu"
import SearchPanel from "@modules/layout/components/search-panel"
import DesktopSearch, { DesktopSearchIcon } from "@modules/layout/components/desktop-search"
import AccountDropdown from "@modules/layout/components/account-dropdown"
import WishlistCounter from "@modules/layout/components/wishlist-counter"
import PromoBar from "@modules/layout/components/promo-bar"
import SiteHeaderHeight from "@modules/layout/components/site-header-height"
import NavHeaderWrapper from "@modules/layout/components/nav-header-wrapper"


// Helper function to get profile image URL from metadata
const getProfileImageUrl = (customer: HttpTypes.StoreCustomer | null): string | null => {
  if (!customer) {
    return null
  }
  const metadata = customer.metadata as Record<string, any> | undefined
  if (metadata?.profile_image_url) {
    return metadata.profile_image_url
  }
  return null
}

export default async function Nav() {
  const [regions, currentLocale, customer] = await Promise.all([
    listRegions().catch(() => []),
    getLocale().catch(() => null),
    retrieveCustomer().catch(() => null),
  ])

  return (
    <div
      id="site-header"
      className="sticky top-0 inset-x-0 z-50 group [--site-header-h:3.5rem] sm:[--site-header-h:4rem]"
    >
      <SiteHeaderHeight />
      <PromoBar />
      <NavHeaderWrapper>
        <nav className="max-w-[1440px] w-full mx-auto px-3 sm:px-4 md:px-6 txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between min-h-[var(--site-header-h)] text-small-regular">
          {/* 1. Left Side: Mobile Menu (Visible ONLY on Mobile < 640px) */}
          <div className="sm:hidden flex-1 basis-0 flex items-center self-stretch">
            <MobileMenu customer={customer} countryCode={currentLocale || "in"} />
          </div>

          {/* 2. Logo: Center on Mobile, Left on Tablets/Desktop (>= 640px) */}
          <div className="flex-1 basis-0 flex items-center justify-center sm:justify-start min-w-0 self-stretch">
            <DynamicLogo />
          </div>

          {/* 3. Desktop/Tablet Section (>= 640px) */}
          <DesktopSearch countryCode={currentLocale || "us"}>
            <div className="hidden sm:flex items-center gap-x-4 xl:gap-x-6 self-stretch flex-1 basis-0 justify-end min-w-0">
              {/* Search Logic: Side Panel for Tablet (<1024), Top Bar for Desktop (>=1024) */}
              <div className="hidden lg:flex">
                <DesktopSearchIcon />
              </div>
              <div className="flex lg:hidden">
                <SearchPanel countryCode={currentLocale || "us"} />
              </div>

              {customer && (
                <LocalizedClientLink
                  href="/wishlist"
                  className="hover:opacity-80 transition-opacity"
                  data-testid="nav-wishlist-link"
                >
                  <div className="relative">
                    <Image
                      src="/Wishlist.svg"
                      alt="Wishlist"
                      width={26}
                      height={26}
                      className="w-5 h-5"
                    />
                    <WishlistCounter />
                  </div>
                </LocalizedClientLink>
              )}
              {!customer ? (
                <LocalizedClientLink
                  href="/account"
                  className="bg-royal-blue hover:bg-[#D4AF37] transition-all duration-200 text-white px-6 py-2 rounded-full text-small-regular font-semibold uppercase tracking-wider shadow-sm hover:shadow-md"
                  data-testid="nav-login-link"
                >
                  Login
                </LocalizedClientLink>
              ) : (
                <AccountDropdown customer={customer} />
              )}
              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="hover:opacity-80 transition-opacity"
                    href="/cart"
                    data-testid="nav-cart-link"
                  >
                    <Image
                      src="/shopping-bag (3).svg"
                      alt="Cart"
                      width={26}
                      height={26}
                      className="w-7 h-7"
                    />
                  </LocalizedClientLink>
                }
              >
                <div className="flex items-center">
                  <CartButton />
                </div>
              </Suspense>
            </div>
          </DesktopSearch>

          {/* 4. Right Side: Mobile Icons (Visible ONLY on Mobile < 640px) */}
          <div className="sm:hidden flex-1 basis-0 flex items-center justify-end gap-x-4 h-full">
            {/* Cart Button */}
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:opacity-80 transition-opacity p-1"
                  href="/cart"
                  data-testid="mobile-nav-cart-link"
                >
                  <Image
                    src="/shopping-bag (3).svg"
                    alt="Cart"
                    width={20}
                    height={20}
                    className="w-6 h-6 min-[340px]:w-7 min-[340px]:h-7"
                  />
                </LocalizedClientLink>
              }
            >
              <div className="flex items-center">
                <CartButton />
              </div>
            </Suspense>

            {/* Search Icon (Side Panel for Mobile) */}
            <div className="flex items-center">
              <SearchPanel countryCode={currentLocale || "us"} />
            </div>
          </div>
        </nav>
      </NavHeaderWrapper>
    </div>
  )
}
