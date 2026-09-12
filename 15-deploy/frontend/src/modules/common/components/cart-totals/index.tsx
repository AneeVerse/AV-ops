"use client"

import { convertToLocale } from "@lib/util/money"
import React from "react"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import ProcessingOverlay from "@modules/checkout/components/processing-overlay"
import { isValidIndianPhone, isValidEmail, normalizeIndianPhone } from "@lib/util/phone"
import { isRazorpayEnabled } from "@lib/util/env"

const readCheckoutFormState = () => {
  if (typeof document === "undefined") {
    return { ready: false, postal: "", address: "", email: "", phone: "" }
  }

  const postalInput = document.getElementById("shipping_postal_code_field") as HTMLInputElement
  const addressInput = document.getElementById("shipping_address_1_field") as HTMLInputElement
  const phoneInput = document.getElementById("shipping_phone_field_internal") as HTMLInputElement
  const emailInput = document.getElementById("shipping_email_field") as HTMLInputElement
  const fullNameInput = document.getElementById("shipping_full_name_field") as HTMLInputElement
  const cityInput = document.getElementById("shipping_city_field") as HTMLInputElement
  const provinceInput = document.getElementById("shipping_province_field") as HTMLInputElement

  const postal = postalInput?.value?.trim() || ""
  const address = addressInput?.value?.trim() || ""
  const email = emailInput?.value?.trim() || ""
  const phone = phoneInput?.value || ""
  const fullName = fullNameInput?.value?.trim() || ""
  const [firstName, ...lastParts] = fullName.split(" ")
  const lastName = lastParts.join(" ") || "."

  const ready =
    postal.length >= 6 &&
    address.length > 0 &&
    isValidIndianPhone(phone) &&
    isValidEmail(email)

  return {
    ready,
    postal,
    address,
    email,
    phone,
    firstName: firstName || "",
    lastName,
    city: cityInput?.value?.trim() || "",
    province: provinceInput?.value?.trim() || "",
  }
}

const isCartDeliveryComplete = (cartData: {
  email?: string | null
  shipping_address?: HttpTypes.StoreCartAddress | null
}) => {
  const shipping = cartData.shipping_address
  return (
    !!shipping?.address_1?.trim() &&
    (shipping?.postal_code?.trim().length ?? 0) >= 6 &&
    isValidEmail(cartData.email) &&
    isValidIndianPhone(shipping?.phone)
  )
}

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
  }
  items?: HttpTypes.StoreCartLineItem[]
  checkoutStep?: string
  customer?: HttpTypes.StoreCustomer | null
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals, items = [], checkoutStep, customer }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeStep = searchParams.get("step")

  // Check if we're on the payment page, order page, or cart page
  const isOnPaymentPage = pathname.includes("/checkout/payment")
  const isOnOrderPage = pathname.includes("/order/")
  const isOnCartPage = pathname.includes("/cart")

  const {
    currency_code,
    total,
    tax_total,
    item_subtotal,
    shipping_subtotal,
    discount_subtotal,
  } = totals

  const cartTotals = totals as HttpTypes.StoreCart & {
    shipping_total?: number | null
  }

  // Calculate Total MRP (sum of original_total from all items)
  const totalMRP = items.reduce((sum, item) => {
    return sum + (item.original_total || item.total || 0)
  }, 0)

  // Calculate total discount (difference between MRP and current subtotal)
  const calculatedDiscount = totalMRP > (item_subtotal || 0)
    ? totalMRP - (item_subtotal || 0)
    : (discount_subtotal || 0)

  // Use GST label for taxes (as shown in the image)
  const gstAmount = tax_total || 0
  const shippingAmount = shipping_subtotal ?? cartTotals.shipping_total ?? 0
  const finalTotal = total || 0
  const itemCount = items.length

  const [isRedirecting, setIsRedirecting] = React.useState(false)
  const placingOrderRef = React.useRef(false)
  const [showOverlay, setShowOverlay] = React.useState(false)
  const [processingVariant, setProcessingVariant] = React.useState<"payment" | "order">("payment")
  const [isAutoSettingShipping, setIsAutoSettingShipping] = React.useState(false)
  const [isSyncingAddress, setIsSyncingAddress] = React.useState(false)
  const [formReady, setFormReady] = React.useState(false)

  // Auto-set shipping method if on payment step and none is selected
  const hasAutoSet = React.useRef<string | null>(null)

  React.useEffect(() => {
    const syncFormReady = (e?: Event) => {
      const fromEvent = (e as CustomEvent | undefined)?.detail?.ready
      if (typeof fromEvent === "boolean") {
        setFormReady(fromEvent)
        return
      }
      setFormReady(readCheckoutFormState().ready)
    }

    syncFormReady()
    window.addEventListener("checkout-form-ready", syncFormReady)
    return () => window.removeEventListener("checkout-form-ready", syncFormReady)
  }, [])
  
  // Listen for real-time shipping / checkout field updates
  React.useEffect(() => {
    const handleShippingSync = () => {
      setIsSyncingAddress(true)
      setIsAutoSettingShipping(true)
      hasAutoSet.current = ""
    }

    const handleCheckoutFieldsSync = () => {
      setIsSyncingAddress(true)
    }

    const handleAddressUpdated = (e: Event) => {
      const syncType = (e as CustomEvent).detail?.syncType
      setIsSyncingAddress(false)
      if (syncType === "shipping") {
        setIsAutoSettingShipping(true)
        hasAutoSet.current = ""
      }
      router.refresh()
    }

    const handleSyncFailed = () => {
      setIsSyncingAddress(false)
    }

    const handleSyncSkipped = () => {
      setIsSyncingAddress(false)
    }

    window.addEventListener("shipping-sync", handleShippingSync)
    window.addEventListener("checkout-fields-sync", handleCheckoutFieldsSync)
    window.addEventListener("address-updated-silent", handleAddressUpdated)
    window.addEventListener("address-sync-failed", handleSyncFailed)
    window.addEventListener("address-sync-skipped", handleSyncSkipped)
    return () => {
      window.removeEventListener("shipping-sync", handleShippingSync)
      window.removeEventListener("checkout-fields-sync", handleCheckoutFieldsSync)
      window.removeEventListener("address-updated-silent", handleAddressUpdated)
      window.removeEventListener("address-sync-failed", handleSyncFailed)
      window.removeEventListener("address-sync-skipped", handleSyncSkipped)
    }
  }, [router])

  // Safety reset for Calculating state
  React.useEffect(() => {
    const hasShipping =
      (cartTotals?.shipping_methods?.length ?? 0) > 0 ||
      shippingAmount > 0
    if (hasShipping && isAutoSettingShipping) {
      setIsAutoSettingShipping(false)
    }
  }, [totals, isAutoSettingShipping, shippingAmount, cartTotals?.shipping_methods?.length])

  const ensureFormSavedToCart = async () => {
    const cartData = totals as any

    // Saved-address checkout hides the form — trust cart when delivery fields are complete
    if (isCartDeliveryComplete(cartData)) {
      return true
    }

    const form = readCheckoutFormState()
    if (!form.ready) {
      // Cart may have address but missing email/phone — try customer email + cart address
      const shipping = cartData.shipping_address
      const fallbackEmail = isValidEmail(cartData.email)
        ? cartData.email!.trim()
        : isValidEmail(customer?.email)
          ? customer!.email!.trim()
          : undefined

      if (
        shipping?.address_1?.trim() &&
        shipping?.postal_code?.trim().length >= 6 &&
        fallbackEmail &&
        isValidIndianPhone(shipping.phone)
      ) {
        const { updateAddressSilently } = await import("@lib/data/cart")
        const result = await updateAddressSilently({
          email: fallbackEmail,
          shipping_address: {
            postal_code: shipping.postal_code,
            address_1: shipping.address_1,
            city: shipping.city,
            province: shipping.province,
            country_code: shipping.country_code || "in",
            first_name: shipping.first_name,
            last_name: shipping.last_name,
            phone: shipping.phone,
          },
          same_as_billing: true,
          assignShipping: false,
        })
        return result?.success === true
      }

      return false
    }

    const cartPhone = normalizeIndianPhone(cartData.shipping_address?.phone)
    const formPhone = isValidIndianPhone(form.phone)
      ? normalizeIndianPhone(form.phone)
      : ""

    const cartEmail = (cartData.email || "").trim()
    const cartMatches =
      form.address === (cartData.shipping_address?.address_1 || "").trim() &&
      form.email === cartEmail &&
      formPhone === cartPhone &&
      form.postal === (cartData.shipping_address?.postal_code || "").trim()

    // Skip API call only when cart already has all fields including email
    if (cartMatches && cartEmail) return true

    const { updateAddressSilently } = await import("@lib/data/cart")
    const result = await updateAddressSilently({
      email: form.email,
      shipping_address: {
        postal_code: form.postal,
        address_1: form.address,
        city: form.city || cartData.shipping_address?.city,
        province: form.province || cartData.shipping_address?.province,
        country_code: cartData.shipping_address?.country_code || "in",
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
      },
      same_as_billing: true,
      assignShipping: false,
    })

    if (result?.success) {
      router.refresh()
      return true
    }
    return false
  }

  const isSetting = React.useRef(false)

  const autoSetShipping = async (retryCount = 0) => {
    const cart = cartTotals
    if (!cart?.id || isSetting.current) return

    // If shipping methods already exist, we are done
    if (cart?.shipping_methods && cart.shipping_methods.length > 0) {
      setIsAutoSettingShipping(false)
      return
    }

    const { listCartOptions, setShippingMethod } = await import("@lib/data/cart")
    const currentKey = cart.id + cart.shipping_address?.postal_code

    const isCheckoutPage = pathname.includes("/checkout")
    const shouldAutoSet = (activeStep === "payment" || isCheckoutPage) && cart?.shipping_address?.postal_code?.length === 6

    if (shouldAutoSet && hasAutoSet.current !== currentKey) {
      
      isSetting.current = true
      setIsAutoSettingShipping(true)

      try {
        const { shipping_options } = await listCartOptions()
        
        if (shipping_options && shipping_options.length > 0) {
          await setShippingMethod({
            cartId: cart.id,
            shippingMethodId: shipping_options[0].id,
            shippingOption: shipping_options[0],
          })
          hasAutoSet.current = currentKey // Mark as done for this pincode
          router.refresh()
          setTimeout(() => {
            setIsAutoSettingShipping(false)
            isSetting.current = false
          }, 400)
        } else if (retryCount < 2) {
          // Brief retry if address/options not ready yet
          setTimeout(() => {
            isSetting.current = false
            autoSetShipping(retryCount + 1)
          }, 800)
        } else {
           setIsAutoSettingShipping(false)
           isSetting.current = false
        }
      } catch (e) {
        if (retryCount < 2) {
          setTimeout(() => {
            isSetting.current = false
            autoSetShipping(retryCount + 1)
          }, 800)
        } else {
          setIsAutoSettingShipping(false)
          isSetting.current = false
        }
      }
    } else {
       setIsAutoSettingShipping(false)
       isSetting.current = false
    }
  }

  React.useEffect(() => {
    autoSetShipping()
  }, [activeStep, totals, router])

  const syncLastEtdToCart = async () => {
    try {
      const cart = totals as any
      const cookiesArr = document.cookie.split('; ')
      const etdCookie = cookiesArr.find(row => row.startsWith('_medusa_last_etd='))
      const lastEtdValue = etdCookie ? etdCookie.split('=')[1] : null

      if (lastEtdValue && cart?.id && cart.metadata?.estimated_delivery !== lastEtdValue) {
        const { updateCartMetadataSilently } = await import("@lib/data/cart")
        await updateCartMetadataSilently({
          ...cart.metadata,
          estimated_delivery: lastEtdValue
        })
      }
    } catch (e) {
      // Ignore sync failure as it's non-critical
    }
  }

  const handleProceedToCheckout = async () => {
    const countryCode = pathname.split('/')[1] || 'in'

    if (customer && customer.addresses.length > 0) {
      setIsRedirecting(true)
      const defaultAddress = customer.addresses.find(a => a.is_default_shipping || a.metadata?.is_default === "true" || a.metadata?.is_default === true) || customer.addresses[0]

      if (defaultAddress) {
        const formData = new FormData()
        formData.append("shipping_address.first_name", defaultAddress.first_name || "")
        formData.append("shipping_address.last_name", defaultAddress.last_name || "")
        formData.append("shipping_address.address_1", defaultAddress.address_1 || "")
        formData.append("shipping_address.address_2", defaultAddress.address_2 || "")
        formData.append("shipping_address.company", defaultAddress.company || "")
        formData.append("shipping_address.postal_code", defaultAddress.postal_code || "")
        formData.append("shipping_address.city", defaultAddress.city || "")
        formData.append("shipping_address.country_code", defaultAddress.country_code || "")
        formData.append("shipping_address.province", defaultAddress.province || "")
        formData.append("shipping_address.phone", defaultAddress.phone || "")
        formData.append("email", customer.email || "")
        formData.append("same_as_billing", "on")

        const { setAddresses } = await import("@lib/data/cart")
        await setAddresses(null, formData)
        setIsRedirecting(false)
        
        if (isOnCartPage) {
          router.push(`/${countryCode}/checkout?step=payment`)
        }
      }
    } else {
      if (isOnCartPage) {
        router.push(`/${countryCode}/checkout?step=payment`)
      }
    }
  }

  return (
    <div className="bg-ivory-bg rounded-lg p-3 min-[550px]:p-4 sm:p-5 md:p-6 min-[1023px]:p-4 min-[1150px]:p-5 min-[1360px]:p-6 border shadow-sm w-full" style={{ borderColor: '#C0C0C0' }}>
      <ProcessingOverlay isOpen={showOverlay} variant={processingVariant} />
      <h3 className="text-sm min-[550px]:text-base sm:text-lg min-[1023px]:text-base min-[1150px]:text-lg min-[1360px]:text-lg font-bold text-gray-900 mb-2.5 min-[550px]:mb-3 sm:mb-4 min-[1023px]:mb-3 min-[1150px]:mb-4 min-[1360px]:mb-4">
        PRICE SUMMARY ({itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"})
      </h3>

      <div className="flex flex-col gap-y-2 min-[550px]:gap-y-2.5 sm:gap-y-3 min-[1023px]:gap-y-2 min-[1150px]:gap-y-3 min-[1360px]:gap-y-3 text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base text-gray-900">
        <div className="flex items-center justify-between">
          <span>Total MRP</span>
          <span data-testid="cart-mrp" data-value={totalMRP}>
            {convertToLocale({ amount: totalMRP, currency_code })}
          </span>
        </div>

        {calculatedDiscount > 0 && (
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span
              className="text-gray-900"
              data-testid="cart-discount"
              data-value={calculatedDiscount}
            >
              {convertToLocale({
                amount: -calculatedDiscount,
                currency_code,
              })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span>GST</span>
          <span data-testid="cart-taxes" data-value={gstAmount}>
            {convertToLocale({ amount: gstAmount, currency_code })}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Shipping</span>
          <span data-testid="cart-shipping" data-value={shippingAmount} className="flex items-center gap-x-2">
            {isAutoSettingShipping && (
              <span className="w-4 h-4 border-2 border-gold-accent border-t-transparent rounded-full animate-spin"></span>
            )}
            {convertToLocale({ amount: shippingAmount, currency_code })}
          </span>
        </div>
      </div>

      <div className="h-px w-full border-b border-gray-200 my-3 min-[550px]:my-4" />

      <div className="flex items-center justify-between text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base font-bold text-gray-900 mb-2.5 min-[550px]:mb-3 sm:mb-4 min-[1023px]:mb-3 min-[1150px]:mb-4 min-[1360px]:mb-4">
        <span>Total</span>
        <span
          className="text-sm min-[550px]:text-base sm:text-lg min-[1023px]:text-base min-[1150px]:text-lg min-[1360px]:text-lg"
          data-testid="cart-total"
          data-value={finalTotal}
        >
          {convertToLocale({ amount: finalTotal, currency_code })}
        </span>
      </div>

      {calculatedDiscount > 0 && (
        <>
          <div className="h-px w-full border-b border-dashed border-gray-300 my-2.5 min-[550px]:my-3 sm:my-4 min-[1023px]:my-3 min-[1150px]:my-4 min-[1360px]:my-4" />
          <div className="text-center">
            <p className="text-green-600 font-medium text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base">
              🎉 Yayy!!! You've saved {convertToLocale({ amount: calculatedDiscount, currency_code })}
            </p>
          </div>
        </>
      )}

      {/* No manual continue button needed as we are in one-step mode */}
      {isOnCartPage && (
        <button
          onClick={handleProceedToCheckout}
          disabled={isRedirecting}
          data-ga-event="proceed_to_checkout_click"
          data-ga-label={convertToLocale({ amount: finalTotal, currency_code })}
          className="w-full h-10 min-[550px]:h-11 sm:h-12 min-[1023px]:h-11 min-[1150px]:h-12 min-[1360px]:h-12 text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base text-white font-medium transition-colors duration-200 hover:opacity-90 mt-3 min-[550px]:mt-4 sm:mt-6 min-[1023px]:mt-5 min-[1150px]:mt-6 min-[1360px]:mt-6 disabled:opacity-50"
          style={{
            backgroundColor: '#0A1D37',
            borderRadius: '30px'
          }}
          data-testid="checkout-button"
        >
          {isRedirecting ? "Loading..." : "Proceed to Checkout"}
        </button>
      )}
      {!isOnCartPage && (
        <div className="w-full">
          {activeStep === "delivery" || activeStep === "payment" || !((totals as any)?.shipping_address?.address_1) || pathname.includes("/checkout") ? (
            <div className="flex flex-col gap-3 mt-3 min-[550px]:mt-4 sm:mt-6 min-[1023px]:mt-5 min-[1150px]:mt-6 min-[1360px]:mt-6">
              {!isRedirecting ? (
                (() => {
                  const cartData = totals as any
                  const resolvedEmail = isValidEmail(cartData.email)
                    ? cartData.email
                    : customer?.email
                  const hasValidEmail = isValidEmail(resolvedEmail)
                  const hasValidPhone = isValidIndianPhone(cartData.shipping_address?.phone)
                  const hasShipping =
                    (cartData.shipping_methods?.length > 0) ||
                    (cartData.shipping_subtotal > 0) ||
                    (cartData.shipping_total > 0) ||
                    shippingAmount > 0
                  const cartReady =
                    hasShipping &&
                    !!cartData.shipping_address?.address_1 &&
                    cartData.shipping_address?.postal_code?.length >= 6 &&
                    hasValidEmail &&
                    hasValidPhone
                  const isCheckoutReady = cartReady || (formReady && hasShipping)
                  const isPaymentDisabled = isAutoSettingShipping || isSyncingAddress || !isCheckoutReady
                  
                  return (
                    <>
                  <button
                    onClick={async () => {
                      if (placingOrderRef.current) return
                      placingOrderRef.current = true
                      setProcessingVariant("order")
                      setShowOverlay(true)
                      setIsRedirecting(true)
                      try {
                        const saved = await ensureFormSavedToCart()
                        if (!saved) {
                          throw new Error("Please complete your delivery address.")
                        }
                        const { initiatePaymentSession, placeOrder } = await import("@lib/data/cart")
                        await initiatePaymentSession(totals as any, { provider_id: "pp_system_default" })
                        await placeOrder()
                      } catch (err: any) {
                        if (err.message === "NEXT_REDIRECT") {
                          throw err // Next.js needs this error to perform the redirect
                        }
                        setIsRedirecting(false)
                        setShowOverlay(false)
                        placingOrderRef.current = false
                        alert("Oops! Something went wrong with Cash on Delivery. " + err.message)
                      }
                    }}
                    disabled={isPaymentDisabled}
                    className={clx(
                      "w-full py-2.5 min-[550px]:py-3 text-xs min-[550px]:text-sm sm:text-base text-gray-900 bg-white border-2 font-bold rounded-lg transition-colors border-gold-accent",
                      {
                        "hover:bg-gold-accent/10": !isPaymentDisabled,
                        "opacity-50 cursor-not-allowed": isPaymentDisabled
                      }
                    )}
                    style={{ borderRadius: '30px' }}
                  >
                    Cash on Delivery
                  </button>
                  {isRazorpayEnabled() && (
                  <button
                    onClick={async () => {
                      if (placingOrderRef.current) return
                      placingOrderRef.current = true
                      setProcessingVariant("payment")
                      setShowOverlay(true)
                      setIsRedirecting(true)
                      try {
                        const saved = await ensureFormSavedToCart()
                        if (!saved) {
                          throw new Error("Please complete your delivery address.")
                        }
                        const { initiatePaymentSession, placeOrder } = await import("@lib/data/cart")
                        const updatedCart: any = await initiatePaymentSession(totals as any, { provider_id: "pp_razorpay_razorpay" }).catch(() => initiatePaymentSession(totals as any, { provider_id: "razorpay" }))

                        const razorpaySession = updatedCart?.payment_collection?.payment_sessions?.find(
                          (s: any) => s.provider_id.includes("razorpay")
                        )
                        if (!razorpaySession?.data?.id) throw new Error("Could not initialize Razorpay")

                        // Load loadRazorpay dynamically so it resolves window.Razorpay
                        const useRazorpayMod = await import("react-razorpay")
                        const useRazorpay = useRazorpayMod.useRazorpay || useRazorpayMod.default?.useRazorpay || (globalThis as any).useRazorpay

                        // We must load via script if hook isn't directly invocable in this async context
                        // The safest pure JS way:
                        const script = document.createElement("script")
                        script.src = "https://checkout.razorpay.com/v1/checkout.js"
                        script.onload = () => {
                          const options = {
                            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY ?? "",
                            amount: razorpaySession.amount,
                            order_id: razorpaySession.data.id,
                            currency: currency_code.toUpperCase(),
                            name: process.env.NEXT_PUBLIC_SHOP_NAME ?? "Cultura Jewels",
                            description: `Secure checkout for your order`,
                            handler: async function (response: any) {
                              await placeOrder().catch((err: any) => {
                                if (err.message === "NEXT_REDIRECT") throw err;
                                alert("Error placing order: " + err.message);
                              })
                            },
                            prefill: {
                              name: `${(totals as any).billing_address?.first_name || ""} ${(totals as any).billing_address?.last_name || ""}`,
                              email: (totals as any).email,
                              contact: (totals as any).shipping_address?.phone || (totals as any).billing_address?.phone || undefined,
                            },
                            theme: {
                              color: "#D4AF37"
                            },
                            modal: {
                              ondismiss: () => {
                                setIsRedirecting(false)
                                setShowOverlay(false)
                              }
                            }
                          }
                          const rzp = new (window as any).Razorpay(options)
                          rzp.on("payment.failed", function (response: any) {
                            setIsRedirecting(false)
                            setShowOverlay(false)
                          })
                          rzp.open()
                        }
                        document.body.appendChild(script)

                      } catch (err: any) {
                        setIsRedirecting(false)
                        setShowOverlay(false)
                        placingOrderRef.current = false
                        alert("Oops! Something went wrong with Razorpay. " + err.message)
                      }
                    }}
                    disabled={isPaymentDisabled}
                    className={clx(
                      "w-full py-2.5 min-[550px]:py-3 text-xs min-[550px]:text-sm sm:text-base text-white font-bold rounded-lg transition-colors bg-royal-blue",
                      {
                        "hover:opacity-90": !isPaymentDisabled,
                        "opacity-50 cursor-not-allowed": isPaymentDisabled
                      }
                    )}
                    style={{ borderRadius: '30px' }}
                  >
                    Pay with Razorpay
                  </button>
                  )}
                </>
              ); })()
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 min-[550px]:py-3 text-xs min-[550px]:text-sm sm:text-base text-white font-bold rounded-lg bg-gray-400 opacity-50 cursor-not-allowed"
                  style={{ borderRadius: '30px' }}
                >
                  Processing...
                </button>
              )}
            </div>
          ) : activeStep === "address" ? (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('trigger-checkout-step'))
              }}
              className="w-full py-2.5 min-[550px]:py-3 sm:py-4 min-[1023px]:py-3 min-[1150px]:py-4 min-[1360px]:py-4 text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base text-white font-medium mt-3 min-[550px]:mt-4 sm:mt-6 min-[1023px]:mt-5 min-[1150px]:mt-6 min-[1360px]:mt-6 rounded-lg transition-colors duration-200 hover:opacity-90"
              style={{
                backgroundColor: '#0A1D37',
                borderRadius: '30px'
              }}
              data-testid="checkout-button-address"
            >
              Continue to delivery
            </button>
          ) : (
            <button
              onClick={handleProceedToCheckout}
              disabled={isRedirecting}
              data-ga-event="proceed_to_checkout_click"
              data-ga-label={convertToLocale({ amount: finalTotal, currency_code })}
              className="w-full h-10 min-[550px]:h-11 sm:h-12 min-[1023px]:h-11 min-[1150px]:h-12 min-[1360px]:h-12 text-xs min-[550px]:text-sm sm:text-base min-[1023px]:text-sm min-[1150px]:text-base min-[1360px]:text-base text-white font-medium transition-colors duration-200 hover:opacity-90 mt-3 min-[550px]:mt-4 sm:mt-6 min-[1023px]:mt-5 min-[1150px]:mt-6 min-[1360px]:mt-6 disabled:opacity-50"
              style={{
                backgroundColor: '#0A1D37',
                borderRadius: '30px'
              }}
              data-testid="checkout-button"
            >
              {isRedirecting ? "Loading..." : "Proceed to Checkout"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default CartTotals
