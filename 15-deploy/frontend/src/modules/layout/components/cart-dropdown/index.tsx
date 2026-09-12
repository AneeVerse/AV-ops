"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import Image from "next/image"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timer | undefined>(
    undefined
  )
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false)

  const open = () => setCartDropdownOpen(true)
  const close = () => setCartDropdownOpen(false)

  const totalItems =
    cartState?.items?.reduce((acc, item) => {
      return acc + item.quantity
    }, 0) || 0

  const subtotal = cartState?.subtotal ?? 0
  const itemRef = useRef<number>(totalItems || 0)

  const timedOpen = () => {
    open()

    const timer = setTimeout(close, 2000)

    setActiveTimer(timer)
  }

  const openAndCancel = () => {
    if (activeTimer) {
      clearTimeout(activeTimer)
    }
  }

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (activeTimer) {
        clearTimeout(activeTimer)
      }
    }
  }, [activeTimer])

  const pathname = usePathname()
  const prevPathname = useRef(pathname)

  // open cart dropdown when modifying the cart items, but only if we're not on the cart page
  useEffect(() => {
    // Check if we just navigated away from the cart page
    const isNavigationFromCart = prevPathname.current.includes("/cart") && !pathname.includes("/cart")

    if (itemRef.current !== totalItems && !pathname.includes("/cart") && !isNavigationFromCart) {
      timedOpen()
    }
    itemRef.current = totalItems
    prevPathname.current = pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, pathname])

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isCheckoutPage = pathname.includes("/checkout")

  if (pathname.includes("/cart") || isCheckoutPage) {
    return (
      <div className="h-full flex items-center">
        <LocalizedClientLink
          className="hover:opacity-80 transition-opacity flex items-center"
          href="/cart"
          data-testid="nav-cart-link-simple"
        >
          <div className="relative">
            <Image
              src="/shopping-bag (3).svg"
              alt="Cart"
              width={26}
              height={26}
              className="w-7 h-7 sm:w-6 sm:h-6 lg:w-7 lg:h-7"
            />
            {totalItems > 0 && !isCheckoutPage && (
              <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 flex items-center justify-center bg-royal-blue text-white text-[8px] sm:text-[10px] rounded-full font-bold shadow-sm">
                {totalItems}
              </div>
            )}
          </div>
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div
      className="h-full z-50"
      onMouseEnter={openAndCancel}
      onMouseLeave={close}
    >
      <Popover className="relative h-full">
        {!isMounted ? (
          /* Placeholder to prevent hydration mismatch */
          <div className="h-full flex items-center">
            <div className="relative">
              <Image src="/shopping-bag (3).svg" alt="Cart" width={26} height={26} className="w-7 h-7 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />
              {totalItems > 0 && (
                <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 flex items-center justify-center bg-royal-blue text-white text-[8px] sm:text-[10px] rounded-full font-bold shadow-sm">{totalItems}</div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile View: Simple Link (No Dropdown) */}
            <div className="h-full flex items-center sm:hidden">
              <LocalizedClientLink
                className="hover:opacity-80 transition-opacity flex items-center"
                href="/cart"
                data-testid="nav-cart-link-mobile"
              >
                <div className="relative">
                  <Image
                    src="/shopping-bag (3).svg"
                    alt="Cart"
                    width={26}
                    height={26}
                    className="w-7 h-7 min-[340px]:w-7 min-[340px]:h-7"
                  />
                  {totalItems > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 flex items-center justify-center bg-royal-blue text-white text-[8px] rounded-full font-bold shadow-sm">
                      {totalItems}
                    </div>
                  )}
                </div>
              </LocalizedClientLink>
            </div>

            {/* Desktop View: Popover Button (Opens Dropdown) */}
            <div className="h-full items-center hidden sm:flex">
              <PopoverButton className="h-full flex items-center focus:outline-none">
                <LocalizedClientLink
                  className="hover:opacity-80 transition-opacity flex items-center"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  <div className="relative">
                    <Image
                      src="/shopping-bag (3).svg"
                      alt="Cart"
                      width={26}
                      height={26}
                      className="sm:w-6 sm:h-6 lg:w-7 lg:h-7"
                    />
                    {totalItems > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 flex items-center justify-center bg-royal-blue text-white text-[8px] sm:text-[10px] rounded-full font-bold shadow-sm">
                        {totalItems}
                      </div>
                    )}
                  </div>
                </LocalizedClientLink>
              </PopoverButton>
            </div>
          </>
        )}
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel
            static
            className="absolute top-[calc(100%+8px)] right-0 w-[320px] sm:w-[380px] md:w-[420px] p-[1.5px] bg-gradient-to-br from-royal-blue via-gold-accent to-royal-blue shadow-xl rounded-2xl overflow-hidden z-[100] sm:block hidden"
            data-testid="nav-cart-dropdown"
          >
            <div className="bg-ivory-bg/95 backdrop-blur-2xl rounded-[calc(1rem-1.5px)] flex flex-col h-full overflow-hidden text-ui-fg-base">
              <div className="p-4 flex items-center justify-center border-b border-gray-100/50">
                <h3 className="text-lg font-bold text-gold-accent tracking-tight">Bag</h3>
              </div>
              <CartItems cartState={cartState} subtotal={subtotal} close={close} />
            </div>
          </PopoverPanel>
        </Transition>

        {/* Mobile View Bottom Sheet (Opens for 2 seconds).
            Rendered via a portal to document.body so it escapes the sticky
            header's containing block (created by its backdrop-filter) and its
            `fixed` positioning anchors to the viewport bottom, not the header. */}
        {isMounted && createPortal(
        <div className="sm:hidden">
          <Transition
            show={cartDropdownOpen}
            as={Fragment}
            enter="transition ease-out duration-300"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="transition ease-in duration-200"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
             <div className="fixed inset-x-0 bottom-0 z-[100] pt-3 pb-4 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.12)] rounded-t-[24px] border-t border-gold-accent/10 translate-z-0">
                <div className="flex items-center justify-between px-5 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h3 className="text-[14px] font-black text-gray-900 leading-none">Added to Bag</h3>
                  </div>
                  <button onClick={close} className="p-1 text-gray-300 hover:text-gray-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                
                {cartState && cartState.items && cartState.items.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {(() => {
                      const items = cartState?.items || []
                      if (items.length === 0) return null

                      const sortedItems = [...items].sort((a: any, b: any) => {
                        const dateA = a.updated_at || a.created_at || ""
                        const dateB = b.updated_at || b.created_at || ""
                        return dateA > dateB ? -1 : 1
                      })
                      
                      const lastItem = sortedItems[0]
                      if (!lastItem) return null
                      
                      return (
                        <div className="flex items-center gap-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-50">
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-white border border-gray-100 shadow-sm">
                            <Thumbnail
                              thumbnail={lastItem.thumbnail}
                              images={lastItem.variant?.product?.images}
                              variantImages={lastItem.variant?.images}
                              size="square"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[13px] font-bold text-gray-900 truncate mb-0">{lastItem.title}</h4>
                            <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase tracking-tight">
                              <span>Qty: {lastItem.quantity}</span>
                              <span className="w-0.5 h-0.5 bg-gray-300 rounded-full" />
                              <span className="text-gold-accent">
                                <LineItemPrice
                                  item={lastItem}
                                  style="tight"
                                  currencyCode={cartState?.currency_code}
                                />
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    <LocalizedClientLink 
                      href="/cart" 
                      className="w-full bg-royal-blue hover:bg-gold-accent border-none rounded-xl h-10 text-[13px] font-black tracking-tight flex items-center justify-center text-white shadow-sm"
                      onClick={close}
                    >
                        View Bag & Checkout
                    </LocalizedClientLink>
                  </div>
                ) : null}
             </div>
          </Transition>
        </div>,
        document.body
        )}
      </Popover>
    </div>
  )
}

const CartItems = ({ cartState, subtotal, close }: { cartState: any, subtotal: number, close: () => void }) => {
  return (
    <>
      {cartState && cartState.items?.length ? (
        <>
          <div className="overflow-y-scroll max-h-[402px] px-4 grid grid-cols-1 gap-y-8 no-scrollbar p-px py-4">
            {cartState.items
              .sort((a: any, b: any) => {
                const dateA = a.updated_at || a.created_at || ""
                const dateB = b.updated_at || b.created_at || ""
                return dateA > dateB ? -1 : 1
              })
              .map((item: any) => (
                <div
                  className="grid grid-cols-[122px_1fr] gap-x-4"
                  key={item.id}
                  data-testid="cart-item"
                >
                  <LocalizedClientLink
                    href={`/products/${item.product_handle}`}
                    className="w-24"
                  >
                    <Thumbnail
                      thumbnail={item.thumbnail}
                      images={item.variant?.product?.images}
                      variantImages={item.variant?.images}
                      size="square"
                    />
                  </LocalizedClientLink>
                  <div className="flex flex-col justify-between flex-1">
                    <div className="flex flex-col flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col overflow-ellipsis whitespace-nowrap mr-4 w-[180px]">
                          <h3 className="text-base-regular overflow-hidden text-ellipsis font-bold">
                            <LocalizedClientLink
                              href={`/products/${item.product_handle}`}
                              data-testid="product-link"
                            >
                              {item.title}
                            </LocalizedClientLink>
                          </h3>
                          <LineItemOptions
                            variant={item.variant}
                            metadata={item.metadata}
                            data-testid="cart-item-variant"
                            data-value={item.variant}
                          />
                          <span
                            data-testid="cart-item-quantity"
                            data-value={item.quantity}
                          >
                            Quantity: {item.quantity}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <LineItemPrice
                            item={item}
                            style="tight"
                            currencyCode={cartState.currency_code}
                          />
                        </div>
                      </div>
                    </div>
                    <DeleteButton
                      id={item.id}
                      productId={item.product_id || ""}
                      thumbnail={item.thumbnail}
                      className="mt-1"
                      data-testid="cart-item-remove-button"
                    >
                      Remove
                    </DeleteButton>
                  </div>
                </div>
              ))}
          </div>
          <div className="p-4 flex flex-col gap-y-4 text-small-regular bg-gray-50/50">
            <div className="flex items-center justify-between">
              <span className="text-ui-fg-base font-semibold">
                Subtotal{" "}
                <span className="font-normal">(excl. taxes)</span>
              </span>
              <span
                className="text-large-semi font-bold"
                data-testid="cart-subtotal"
                data-value={subtotal}
              >
                {convertToLocale({
                  amount: subtotal,
                  currency_code: cartState.currency_code,
                })}
              </span>
            </div>
            <LocalizedClientLink href="/cart" passHref>
              <Button
                className="w-full bg-royal-blue hover:bg-gold-accent border-none rounded-2xl h-12"
                size="large"
                data-testid="go-to-cart-button"
                onClick={close}
              >
                Go to bag
              </Button>
            </LocalizedClientLink>
          </div>
        </>
      ) : (
        <div>
          <div className="flex py-16 flex-col gap-y-4 items-center justify-center">
            <div className="bg-royal-blue text-small-regular flex items-center justify-center w-6 h-6 rounded-full text-white shadow-sm">
              <span>0</span>
            </div>
            <span className="text-gray-600 font-medium">Your shopping bag is empty.</span>
            <div>
              <LocalizedClientLink href="/store">
                <>
                  <span className="sr-only">Go to all products page</span>
                  <Button
                    onClick={close}
                    className="bg-royal-blue hover:bg-gold-accent border-none rounded-full px-8"
                  >
                    Explore products
                  </Button>
                </>
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CartDropdown
