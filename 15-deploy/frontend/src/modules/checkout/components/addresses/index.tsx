"use client"

import { setAddresses, addCustomerAddressToCart } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text, useToggleState, clx } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import Spinner from "@modules/common/icons/spinner"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useState, startTransition, useEffect } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"
import AddressCard from "../address-card"
import AddAddressModal from "../add-address-modal"
import SelectAddressModal from "../select-address-modal"
import { isValidIndianPhone, normalizeIndianPhone, isValidEmail } from "@lib/util/phone"

const isAddressComplete = (addr: any) => {
  return !!(addr && addr.address_1 && addr.first_name);
}

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOnCheckout = pathname.includes("/checkout")
  const step = searchParams.get("step")
  const addressesInRegion = (() => {
    const filtered = customer?.addresses.filter(
      (a) => a.country_code && cart?.region?.countries?.some(c => c.iso_2 === a.country_code)
    ) || []
    // Deduplicate: if two addresses have same address_1 + postal_code + city, keep the newer one
    const seen = new Map<string, typeof filtered[0]>()
    for (const addr of filtered) {
      const key = `${(addr.address_1 || "").trim().toLowerCase()}|${(addr.postal_code || "").trim()}|${(addr.city || "").trim().toLowerCase()}`
      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, addr)
      } else {
        // Keep the more recently updated one, or the default one
        const existingIsDefault = existing.is_default_shipping || existing.metadata?.is_default === "true" || existing.metadata?.is_default === true
        const addrIsDefault = addr.is_default_shipping || addr.metadata?.is_default === "true" || addr.metadata?.is_default === true
        if (addrIsDefault && !existingIsDefault) {
          seen.set(key, addr)
        } else if (!addrIsDefault && !existingIsDefault) {
          const existingTime = new Date(existing.updated_at || 0).getTime()
          const addrTime = new Date(addr.updated_at || 0).getTime()
          if (addrTime > existingTime) seen.set(key, addr)
        }
      }
    }
    return Array.from(seen.values())
  })()

  const defaultAddress = [...addressesInRegion].sort((a, b) => {
    if (a.is_default_shipping && !b.is_default_shipping) return -1
    if (!a.is_default_shipping && b.is_default_shipping) return 1
    const aDef = a.metadata?.is_default === "true" || a.metadata?.is_default === true
    const bDef = b.metadata?.is_default === "true" || b.metadata?.is_default === true
    if (aDef && !bDef) return -1
    if (!aDef && bDef) return 1
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  })[0]

  // Determine the initial checkout step based on whether the user has a saved address.
  //  • If no address exists → start on the address step.
  //  • If an address exists → start on the payment step.
  //  • Manual overrides (URL step query) are respected.
  const hasSavedAddress = !!defaultAddress && isAddressComplete(defaultAddress);
  const initialStep = hasSavedAddress ? "payment" : "address";
  const isOpen = (
    step === "address" ||
    step === "payment" ||
    (!step && initialStep === "address")
  );

  // Scroll to top and ensure URL reflects the derived initial step when no step param is present
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    if (!step) {
      router.push(`${pathname}?step=${initialStep}`, { scroll: false });
    }
  }, [step, initialStep, pathname, router]);

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  )

  /* Edit Mode State */
  const [isEditing, setIsEditing] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
    router.push(pathname + "?step=address")
  }

  const [message, formAction, isPending] = useActionState(setAddresses, null)

  // Listen for trigger from summary button
  useEffect(() => {
    const handleTrigger = () => {
      const form = document.querySelector('form[autoComplete="off"]') as HTMLFormElement
      const phoneInput = document.getElementById("shipping_phone_field_internal") as HTMLInputElement

      if (phoneInput && !isValidIndianPhone(phoneInput.value)) {
        return
      }

      if (form && !form.checkValidity()) {
        return
      }

      const submitBtn = document.querySelector('[data-testid="submit-address-button"]') as HTMLButtonElement
      if (submitBtn) {
        submitBtn.click()
      }
    }


    if (isOpen) {
      window.addEventListener('trigger-checkout-step', handleTrigger)
      window.addEventListener('submit-address-for-payment', handleTrigger)
      return () => {
        window.removeEventListener('trigger-checkout-step', handleTrigger)
        window.removeEventListener('submit-address-for-payment', handleTrigger)
      }
    }
  }, [isOpen])



  const [addAddressMessage, addAddressAction, isAddAddressPending] = useActionState(addCustomerAddressToCart, null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<HttpTypes.StoreCustomerAddress | null>(null)
  const [showAddAddressForm, setShowAddAddressForm] = useState(false)
  const [isManualRemoval, setIsManualRemoval] = useState(false)
  const [hasManuallySelected, setHasManuallySelected] = useState(false)

  // Load manual selection state from sessionStorage to survive redirects
  useEffect(() => {
    if (typeof window !== "undefined") {
      const manual = sessionStorage.getItem("medusa_address_manual")
      if (manual === "true") {
        setHasManuallySelected(true)
      }
    }

    const clearSyncingState = (syncType: "shipping" | "checkout") => {
      window.dispatchEvent(
        new CustomEvent("address-sync-skipped", { detail: { syncType } })
      )
    }

    const runSilentUpdate = async (
      syncKey: string,
      syncType: "shipping" | "checkout",
      payload: Parameters<typeof import("@lib/data/cart").updateAddressSilently>[0],
      retryCount = 0
    ) => {
      if ((window as any).__lastAddressSyncKey === syncKey) {
        clearSyncingState(syncType)
        return
      }
      if ((window as any).isUpdatingAddress) {
        if (retryCount < 5) {
          setTimeout(() => runSilentUpdate(syncKey, syncType, payload, retryCount + 1), 500)
        } else {
          clearSyncingState(syncType)
        }
        return
      }

      try {
        ;(window as any).isUpdatingAddress = true
        const { updateAddressSilently } = await import("@lib/data/cart")
        const result = await updateAddressSilently(payload)

        if (result?.success) {
          ;(window as any).__lastAddressSyncKey = syncKey
          window.dispatchEvent(
            new CustomEvent("address-updated-silent", { detail: { syncType } })
          )
          router.refresh()
        } else {
          window.dispatchEvent(
            new CustomEvent("address-sync-failed", { detail: { syncType } })
          )
        }
      } finally {
        setTimeout(() => {
          ;(window as any).isUpdatingAddress = false
        }, 800)
      }
    }

    // Pincode only → shipping charge calculate (1 API call)
    const handleShippingSync = async (e: CustomEvent) => {
      const { postal_code, city, province } = e.detail
      if (!postal_code || postal_code.length !== 6) return

      const cityInput = document.getElementById("shipping_city_field") as HTMLInputElement
      const provinceInput = document.getElementById("shipping_province_field") as HTMLInputElement
      const city_val = city || cityInput?.value || cart?.shipping_address?.city || ""
      const province_val = province || provinceInput?.value || cart?.shipping_address?.province || ""

      const currentShipping = cart?.shipping_address
      const hasChanged =
        (postal_code?.trim() || "") !== ((currentShipping?.postal_code as string)?.trim() || "") ||
        (city_val?.trim().toLowerCase() || "") !== ((currentShipping?.city as string)?.trim().toLowerCase() || "") ||
        (province_val?.trim().toLowerCase() || "") !== ((currentShipping?.province as string)?.trim().toLowerCase() || "")

      if (!hasChanged) {
        clearSyncingState("shipping")
        return
      }

      const syncKey = `shipping|${postal_code}|${city_val}|${province_val}`
      await runSilentUpdate(syncKey, "shipping", {
        shipping_address: {
          postal_code,
          city: city_val,
          province: province_val,
          country_code: cart?.shipping_address?.country_code || "in",
        },
        same_as_billing: true,
        assignShipping: true,
      })
    }

    // Batched: address + phone + email (1 debounced API call, no shipping re-fetch)
    const handleCheckoutFieldsSync = async (e: CustomEvent) => {
      const { postal_code, city, province, address_1, first_name, last_name, company, email, phone } =
        e.detail
      if (!postal_code || postal_code.length !== 6) {
        clearSyncingState("checkout")
        return
      }

      const fullNameInput = document.getElementById("shipping_full_name_field") as HTMLInputElement
      const address1Input = document.getElementById("shipping_address_1_field") as HTMLInputElement
      const companyInput = document.getElementById("shipping_company_field") as HTMLInputElement
      const phoneInput = document.getElementById("shipping_phone_field_internal") as HTMLInputElement
      const emailInput = document.getElementById("shipping_email_field") as HTMLInputElement

      const full_name = fullNameInput?.value || ""
      const [parsedFirst, ...lastParts] = full_name.split(" ")
      const parsedLast = lastParts.join(" ") || "."

      const addressVal = (address_1 || address1Input?.value || "").trim()
      const phoneRaw = phone || phoneInput?.value || ""
      const normalizedPhone = isValidIndianPhone(phoneRaw)
        ? normalizeIndianPhone(phoneRaw)
        : undefined
      const emailRaw = email || emailInput?.value || ""
      const validEmail = isValidEmail(emailRaw) ? emailRaw.trim() : undefined
      const companyVal = (company || companyInput?.value || "").trim()

      const currentShipping = cart?.shipping_address
      const resolvedFirst = (first_name || parsedFirst || "").trim()
      const resolvedLast = (last_name || parsedLast || ".").trim()

      const cityVal = (city || cart?.shipping_address?.city || "").trim()
      const provinceVal = (province || cart?.shipping_address?.province || "").trim()

      const hasChanged =
        (addressVal && addressVal !== (currentShipping?.address_1 || "").trim()) ||
        (validEmail && validEmail !== (cart?.email || "").trim()) ||
        (normalizedPhone &&
          normalizedPhone !== normalizeIndianPhone(currentShipping?.phone)) ||
        (resolvedFirst &&
          resolvedFirst !== (currentShipping?.first_name || "").trim())

      if (!hasChanged) {
        clearSyncingState("checkout")
        return
      }

      const syncKey = `checkout|${postal_code}|${addressVal}|${resolvedFirst}|${validEmail || ""}|${normalizedPhone || ""}`
      const shipping_address: Record<string, string> = {
        postal_code,
        country_code: cart?.shipping_address?.country_code || "in",
      }
      if (cityVal) shipping_address.city = cityVal
      if (provinceVal) shipping_address.province = provinceVal
      if (addressVal) shipping_address.address_1 = addressVal
      if (resolvedFirst) {
        shipping_address.first_name = resolvedFirst
        shipping_address.last_name = resolvedLast
      }
      if (companyVal) shipping_address.company = companyVal
      if (normalizedPhone) shipping_address.phone = normalizedPhone

      await runSilentUpdate(syncKey, "checkout", {
        ...(validEmail ? { email: validEmail } : {}),
        shipping_address,
        same_as_billing: true,
        assignShipping: false,
      })
    }

    window.addEventListener("shipping-sync", handleShippingSync as EventListener)
    window.addEventListener("checkout-fields-sync", handleCheckoutFieldsSync as EventListener)
    return () => {
      window.removeEventListener("shipping-sync", handleShippingSync as EventListener)
      window.removeEventListener("checkout-fields-sync", handleCheckoutFieldsSync as EventListener)
    }
  }, [cart, router])



  const shouldAutoSelect = !!defaultAddress && !isEditing && !isManualRemoval && !hasManuallySelected

  // Auto-select default address if needed
  useEffect(() => {
    if (isOpen && shouldAutoSelect && defaultAddress && !isPending) {
      // If cart has no address, OR if the current address is different from default
      // We trigger the update.
      // Simple check: if we are supposed to auto-select, and we haven't just submitted
      const isAddressMatching = cart?.shipping_address &&
        cart.shipping_address.address_1 === defaultAddress.address_1 &&
        cart.shipping_address.postal_code === defaultAddress.postal_code;

      if (!isAddressMatching) {
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
        formData.append("email", customer?.email || cart?.email || "")
        formData.append("same_as_billing", "on")

        startTransition(() => {
          formAction(formData)
        })
      }
    }
  }, [isOpen, shouldAutoSelect, cart?.shipping_address, defaultAddress, isPending, formAction, customer?.email, cart?.email])

  // Find the selected address from cart
  const selectedAddressFromCart = cart?.shipping_address && customer?.addresses.find(a =>
    a.address_1 === cart.shipping_address?.address_1 &&
    a.first_name === cart.shipping_address?.first_name &&
    a.last_name === cart.shipping_address?.last_name
  )

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    selectedAddressFromCart?.id || (shouldAutoSelect ? defaultAddress?.id : null) || null
  )

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId)
  }

  const handleContinue = () => {
    const currentAddressId = selectedAddressId || selectedAddressFromCart?.id
    const address = customer?.addresses.find(a => a.id === currentAddressId)
    if (address && cart) {
      const formData = new FormData()
      formData.append("shipping_address.first_name", address.first_name || "")
      formData.append("shipping_address.last_name", address.last_name || "")
      formData.append("shipping_address.address_1", address.address_1 || "")
      formData.append("shipping_address.address_2", address.address_2 || "")
      formData.append("shipping_address.company", address.company || "")
      formData.append("shipping_address.postal_code", address.postal_code || "")
      formData.append("shipping_address.city", address.city || "")
      formData.append("shipping_address.country_code", address.country_code || "")
      formData.append("shipping_address.province", address.province || "")
      formData.append("shipping_address.phone", address.phone || "")
      formData.append("email", customer?.email || cart?.email || "")
      formData.append("same_as_billing", sameAsBilling ? "on" : "")

      startTransition(() => {
        formAction(formData)
      })
    } else {
      router.push(pathname + "?step=address")
    }
  }



  // Convert cart address to customer address format for display
  const cartAddressAsCustomerAddress = cart?.shipping_address ? {
    id: selectedAddressFromCart?.id || 'cart-address',
    first_name: cart.shipping_address.first_name || '',
    last_name: cart.shipping_address.last_name === "." ? "" : (cart.shipping_address.last_name || ""),
    address_1: cart.shipping_address.address_1 || '',
    address_2: cart.shipping_address.address_2 || '',
    city: cart.shipping_address.city || '',
    province: cart.shipping_address.province || '',
    postal_code: cart.shipping_address.postal_code || '',
    country_code: cart.shipping_address.country_code || '',
    phone: cart.shipping_address.phone || '',
    metadata: (selectedAddressFromCart as any)?.metadata || { address_type: 'HOME' }
  } : null

  // Determine which address to display in the summary view to avoid flickering
  // Priority: 
  // 1. Current address in cart (if complete)
  // 2. Default address (if we are in auto-select mode)
  // 3. Last fallback
  const addressToDisplay = (cart?.shipping_address && isAddressComplete(cart.shipping_address))
    ? cartAddressAsCustomerAddress
    : (shouldAutoSelect ? defaultAddress : (defaultAddress || cartAddressAsCustomerAddress))

  return (
    <div className="bg-ivory-bg">
      {cart && (
        <AddAddressModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false)
            setEditingAddress(null)
          }}
          onSave={(formData) => {
            if (typeof window !== "undefined") {
              sessionStorage.setItem("medusa_address_manual", "true")
            }
            setHasManuallySelected(true)
            startTransition(() => {
              addAddressAction(formData)
              setIsManualRemoval(false)
            })
          }}
          cart={cart}
          editingAddress={editingAddress}
        />
      )}

      {customer && (
        <SelectAddressModal
          isOpen={showSelectModal}
          onClose={() => setShowSelectModal(false)}
          addresses={addressesInRegion}
          selectedAddressId={selectedAddressId}
          onSelect={(id) => {
            handleAddressSelect(id)
            setIsManualRemoval(false)
            if (typeof window !== "undefined") {
              sessionStorage.setItem("medusa_address_manual", "true")
            }
            setHasManuallySelected(true)
            // Trigger address update and continue
            const address = addressesInRegion.find(a => a.id === id)
            if (address && cart) {
              const formData = new FormData()
              formData.append("shipping_address.first_name", address.first_name || "")
              formData.append("shipping_address.last_name", address.last_name || "")
              formData.append("shipping_address.address_1", address.address_1 || "")
              formData.append("shipping_address.address_2", address.address_2 || "")
              formData.append("shipping_address.company", address.company || "")
              formData.append("shipping_address.postal_code", address.postal_code || "")
              formData.append("shipping_address.city", address.city || "")
              formData.append("shipping_address.country_code", address.country_code || "")
              formData.append("shipping_address.province", address.province || "")
              formData.append("shipping_address.phone", address.phone || "")
              formData.append("email", customer?.email || cart?.email || "")
              formData.append("same_as_billing", sameAsBilling ? "on" : "")

              startTransition(() => {
                formAction(formData)
              })
            }
          }}
          onEdit={(address) => {
            setEditingAddress(address)
            setShowSelectModal(false)
            setShowAddModal(true)
          }}
        />
      )}

      {isOpen ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-4 mb-6">
            <Heading
              level="h2"
              className="text-xl sm:text-2xl font-bold text-gray-900"
            >
              Enter Delivery Address
            </Heading>
            
            <div className="flex flex-row gap-2 sm:gap-3">
              {customer && addressesInRegion.length > 1 && (
                <button
                  onClick={() => setShowSelectModal(true)}
                  className="px-3 min-[550px]:px-6 py-2 min-[550px]:py-2.5 rounded-full text-[13px] min-[550px]:text-base font-bold whitespace-nowrap transition-all shadow-md hover:shadow-lg"
                  style={{ backgroundColor: '#0A1D37', color: 'white' }}
                  onMouseEnter={(e) => { e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent') }}
                  onMouseLeave={(e) => { e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue') }}
                >
                  Select Address
                </button>
              )}
              {customer && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className={clx(
                    "px-3 min-[550px]:px-6 py-2 min-[550px]:py-2.5 rounded-full text-[13px] min-[550px]:text-base font-bold whitespace-nowrap transition-all shadow-md hover:shadow-lg",
                    addressesInRegion.length > 0 ? "text-white" : "border border-gray-900 text-gray-900"
                  )}
                  style={addressesInRegion.length > 0 ? { backgroundColor: '#0A1D37' } : {}}
                  onMouseEnter={(e) => { 
                    if (addressesInRegion.length > 0) e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent') 
                  }}
                  onMouseLeave={(e) => { 
                    if (addressesInRegion.length > 0) e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue') 
                  }}
                >
                  Add New Address
                </button>
              )}
            </div>
          </div>

          {/* If we have addresses, show the selected one in a single card, otherwise show the form */}
          {customer && addressesInRegion.length > 0 && !showAddModal && !showAddAddressForm ? (
            <div className="space-y-4">
              {/* Default Address Label */}
              {(addressToDisplay?.id === defaultAddress?.id || (addressToDisplay as any)?.metadata?.is_default === true) && (
                <div className="mb-3">
                  <Text className="text-sm uppercase text-gray-400 font-medium">
                    DEFAULT ADDRESS
                  </Text>
                </div>
              )}

              <AddressCard
                address={addressToDisplay as any}
                isSelected={true}
                isDefault={addressToDisplay?.id === defaultAddress?.id}
                onSelect={() => setShowSelectModal(true)}
                onEdit={() => {
                  setEditingAddress(addressToDisplay as any)
                  setShowAddModal(true)
                }}
                onRemove={() => {
                  setShowSelectModal(true)
                }}
              />
              
              {/* Hidden trigger for programmatic submission */}
              <button
                onClick={handleContinue}
                className="hidden"
                data-testid="submit-address-button"
              />
              
              <ErrorMessage error={message} data-testid="address-error-message" />
            </div>
          ) : (
            <form action={formAction} autoComplete="off" noValidate>
              <div className="pb-8">
                <ShippingAddress
                  customer={customer}
                  checked={sameAsBilling}
                  onChange={toggleSameAsBilling}
                  cart={cart}
                  clearForm={showAddAddressForm}
                />

                {!sameAsBilling && (
                  <div>
                    <Heading
                      level="h2"
                      className="text-3xl-regular gap-x-4 pb-6 pt-8"
                    >
                      Billing address
                    </Heading>

                    <BillingAddress cart={cart} customer={customer} />
                  </div>
                )}
                <button
                  type="submit"
                  className="mt-6 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors hidden"
                  data-testid="submit-address-button"
                >
                  Continue to delivery
                </button>
                <ErrorMessage error={message} data-testid="address-error-message" />
              </div>
            </form>
          )}
        </>
      ) : (
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-4 mb-6">
            <Heading
              level="h2"
              className="text-xl sm:text-2xl font-bold text-gray-900"
            >
              Delivery Address
            </Heading>
            {!isManualRemoval && customer && (
              <div className="flex flex-row gap-2 sm:gap-3">
                {customer && addressesInRegion.length > 1 && (
                  <button
                    onClick={() => setShowSelectModal(true)}
                    className="px-3 min-[550px]:px-6 py-2 min-[550px]:py-2.5 rounded-full text-[13px] min-[550px]:text-base font-bold whitespace-nowrap transition-all shadow-md hover:shadow-lg"
                    style={{
                      backgroundColor: '#0A1D37',
                      color: 'white'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
                    }}
                  >
                    Select Address
                  </button>
                )}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3 min-[550px]:px-6 py-2 min-[550px]:py-2.5 rounded-full text-[13px] min-[550px]:text-base font-bold whitespace-nowrap transition-all shadow-md hover:shadow-lg"
                  style={{
                    backgroundColor: '#0A1D37',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
                  }}
                  data-testid="add-new-address-button"
                >
                  Add New Address
                </button>
              </div>
            )}
          </div>

          {addressToDisplay && !isManualRemoval ? (
            <div className="space-y-4">
              {/* Default Address Label */}
              {(addressToDisplay.id === defaultAddress?.id || (addressToDisplay as any)?.metadata?.is_default === true) && (
                <div className="mb-3">
                  <Text className="text-sm uppercase text-gray-400 font-medium">
                    DEFAULT ADDRESS
                  </Text>
                </div>
              )}

              <AddressCard
                address={addressToDisplay as any}
                isSelected={true}
                isDefault={addressToDisplay.id === defaultAddress?.id}
                onSelect={() => handleEdit()}
                onEdit={() => {
                  setEditingAddress(addressToDisplay as any)
                  setShowAddModal(true)
                }}
                onRemove={() => {
                  setShowSelectModal(true)
                }}
              />
            </div>
          ) : (addressToDisplay || isManualRemoval) ? (
            <div className="flex flex-col min-[550px]:flex-row gap-4 mt-4">
              {customer && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex-1 px-6 py-3 rounded-full font-bold text-white transition-all shadow-md hover:shadow-lg bg-royal-blue"
                >
                  Add New Address
                </button>
              )}
              {customer && addressesInRegion.length > 1 && (
                <button
                  onClick={() => setShowSelectModal(true)}
                  className="flex-1 px-6 py-3 rounded-full border-2 font-bold transition-all"
                  style={{
                    className: 'border-gold-accent',
                    className: 'text-gold-accent',
                    backgroundColor: 'white'
                  }}
                >
                  Select Address
                </button>
              )}
            </div>
          ) : (
            <div>
              <Spinner />
            </div>
          )}
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Addresses
