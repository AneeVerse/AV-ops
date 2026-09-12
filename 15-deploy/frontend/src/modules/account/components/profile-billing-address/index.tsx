"use client"

import React, { useEffect, useMemo, useActionState, useState, useRef } from "react"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"

import Input from "@modules/common/components/input"
import NativeSelect from "@modules/common/components/native-select"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress, updateCustomerAddress } from "@lib/data/customer"
import { State, City } from "country-state-city"
import Select from "@modules/common/components/select"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
  regions: HttpTypes.StoreRegion[]
}

const ProfileBillingAddress: React.FC<MyInformationProps> = ({
  customer,
  regions,
}) => {
  const regionOptions = useMemo(() => {
    return (
      regions
        ?.map((region) => {
          return region.countries?.map((country) => ({
            value: country.iso_2,
            label: country.display_name,
          }))
        })
        .flat() || []
    )
  }, [regions])

  const [successState, setSuccessState] = useState(false)

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  const initialState: Record<string, any> = {
    isDefaultBilling: true,
    isDefaultShipping: false,
    error: false,
    success: false,
  }

  if (billingAddress) {
    initialState.addressId = billingAddress.id
  }

  const [state, formAction] = useActionState(
    billingAddress ? updateCustomerAddress : addCustomerAddress,
    initialState
  )

  // --- Controlled form state ---
  const [formData, setFormData] = useState({
    full_name: billingAddress?.first_name
      ? `${billingAddress.first_name} ${billingAddress.last_name === "." ? "" : billingAddress.last_name}`.trim()
      : customer?.first_name
      ? `${customer.first_name} ${customer.last_name === "." ? "" : customer.last_name}`.trim()
      : "",
    first_name: billingAddress?.first_name || customer?.first_name || "",
    last_name: billingAddress?.last_name || customer?.last_name || "",
    company: billingAddress?.company || "",
    phone: billingAddress?.phone || customer?.phone || "",
    address_1: billingAddress?.address_1 || "",
    address_2: billingAddress?.address_2 || "",
    postal_code: billingAddress?.postal_code || "",
    city: billingAddress?.city || "",
    province: billingAddress?.province || "",
    country_code: billingAddress?.country_code || "",
  })

  const countryCodeUpper = (formData.country_code || "").toUpperCase()

  const stateOptions = useMemo(() => {
    if (!countryCodeUpper) return []
    try {
      return State.getStatesOfCountry(countryCodeUpper).map((s) => ({
        value: s.name,
        label: s.name,
        isoCode: s.isoCode,
      }))
    } catch (e) {
      return []
    }
  }, [countryCodeUpper])

  const cityOptions = useMemo(() => {
    if (!countryCodeUpper || !formData.province) return []
    try {
      const selectedStateObj = stateOptions.find(
        (s) => s.value === formData.province
      )
      if (!selectedStateObj) return []
      const cities = City.getCitiesOfState(countryCodeUpper, selectedStateObj.isoCode)
      const uniqueNames = Array.from(new Set(cities.map((c) => c.name)))
      return uniqueNames.map((name) => ({
        value: name,
        label: name,
      }))
    } catch (e) {
      return []
    }
  }, [countryCodeUpper, formData.province, stateOptions])


  const [stateSearchOpen, setStateSearchOpen] = useState(false)
  const [citySearchOpen, setCitySearchOpen] = useState(false)
  const stateContainerRef = useRef<HTMLDivElement>(null)
  const cityContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stateContainerRef.current && !stateContainerRef.current.contains(event.target as Node)) {
        setStateSearchOpen(false)
      }
      if (cityContainerRef.current && !cityContainerRef.current.contains(event.target as Node)) {
        setCitySearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Sync customer name if not already set
  useEffect(() => {
    if (customer) {
      setFormData((prev) => ({
        ...prev,
        full_name:
          prev.full_name && prev.full_name.trim() !== ""
            ? prev.full_name
            : customer.first_name
            ? `${customer.first_name} ${customer.last_name === "." ? "" : customer.last_name}`.trim()
            : "",
        first_name: prev.first_name || customer.first_name || "",
        last_name: prev.last_name || customer.last_name || "",
        phone: prev.phone || customer.phone || "",
      }))
    }
  }, [customer])

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  const clearState = () => {
    setSuccessState(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    if (name === "full_name") {
      const [first, ...rest] = value.split(" ")
      const last = rest.join(" ") || "."
      setFormData((prev) => ({ ...prev, full_name: value, first_name: first || "", last_name: last }))
      return
    }

    if (name === "country_code") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        province: "",
        city: "",
      }))
      return
    }

    if (name === "province") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        city: "",
      }))
      return
    }

    let sanitizedValue = value
    if (name === "postal_code") {
      sanitizedValue = value.replace(/\D/g, "").slice(0, 6)
    } else if (name === "city" || name === "province") {
      sanitizedValue = value.replace(/[^A-Za-z\s]/g, "")
    }

    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))

    // Auto-fill City & State from Indian pincode
    if (name === "postal_code" && sanitizedValue.length === 6) {
      const fetchLocation = async () => {
        try {
          const response = await fetch(`https://api.postalpincode.in/pincode/${sanitizedValue}`)
          const data = await response.json()
          if (data[0].Status === "Success") {
            const postOffice = data[0].PostOffice[0]
            setFormData((prev) => ({
              ...prev,
              city: postOffice.District,
              province: postOffice.State,
            }))
          }
        } catch (e) {}
      }
      fetchLocation()
    }
  }

  const currentInfo = useMemo(() => {
    if (!billingAddress) {
      return "No billing address"
    }

    const country =
      regionOptions?.find(
        (country) => country?.value === billingAddress.country_code
      )?.label || billingAddress.country_code?.toUpperCase()

    return (
      <div className="flex flex-col gap-y-0.5 text-sm text-gray-600 font-normal" data-testid="current-info">
        <span className="text-gray-900 font-bold mb-0.5 tracking-tight">
          {billingAddress.first_name} {billingAddress.last_name}
        </span>
        {billingAddress.phone && <span className="text-gray-500">{billingAddress.phone}</span>}
        {billingAddress.company && <span className="text-gray-500">{billingAddress.company}</span>}
        <span className="text-gray-500 leading-relaxed">
          {billingAddress.address_1}
          {billingAddress.address_2 ? `, ${billingAddress.address_2}` : ""}
        </span>
        <span className="text-gray-500">
          {billingAddress.postal_code}, {billingAddress.city}
        </span>
        <span className="text-gray-500 font-medium">{country}</span>
      </div>
    )
  }, [billingAddress, regionOptions])

  return (
    <form action={formAction} onReset={() => clearState()} className="w-full">
      <input type="hidden" name="addressId" value={billingAddress?.id || ""} />
      <input type="hidden" name="first_name" value={formData.first_name} />
      <input type="hidden" name="last_name" value={formData.last_name} />
      <AccountInfo
        label="Billing address"
        currentInfo={currentInfo}
        isSuccess={successState}
        isError={!!state.error}
        clearState={clearState}
        data-testid="account-billing-address-editor"
      >
        <div className="grid grid-cols-1 gap-y-2.5">
          {/* Full Name */}
          <div className="flex flex-col gap-y-0.5">
            <label className="text-sm font-medium text-gray-700">Full name<span className="text-red-500">*</span></label>
            <input
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/20 transition-all text-sm"
              data-testid="billing-full-name-input"
            />
          </div>

          {/* Phone */}
           <div className="flex flex-col gap-y-0.5">
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <div className="relative w-full phone-input-container">
              <PhoneInput
                country={"in"}
                value={formData.phone}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, phone: `+${value}` }));
                }}
                inputStyle={{
                  width: "100%",
                  height: "46px",
                  fontSize: "14px",
                  paddingLeft: "52px",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#f9fafb99",
                  transition: "all 0.2s"
                }}
                buttonStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px 0 0 8px",
                  paddingLeft: "8px"
                }}
                containerStyle={{
                  width: "100%",
                  height: "46px"
                }}
                dropdownStyle={{
                  width: "280px",
                  borderRadius: "8px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                }}
              />
            </div>
            <style jsx global>{`
              .phone-input-container .react-tel-input .form-control:focus {
                background-color: white !important;
                outline: none !important;
                ring: 2px !important;
                border-color: #D4AF37 !important;
                box-shadow: 0 0 0 2px #f3e8ff !important;
              }
            `}</style>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-y-0.5">
            <label className="text-sm font-medium text-gray-700">Address<span className="text-red-500">*</span></label>
            <input
              name="address_1"
              value={formData.address_1}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/20 transition-all text-sm"
              data-testid="billing-address-1-input"
            />
          </div>

          {/* Postal Code, City, State */}
          <div className="grid grid-cols-1 min-[450px]:grid-cols-3 gap-2.5">
            <div className="flex flex-col gap-y-0.5">
              <label className="text-sm font-medium text-gray-700">Postal code<span className="text-red-500">*</span></label>
              <input
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                required
                maxLength={6}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/20 transition-all text-sm"
                data-testid="billing-postcal-code-input"
              />
            </div>
            <div className="flex flex-col gap-y-0.5" ref={cityContainerRef}>
              <label className="text-sm font-medium text-gray-700">City<span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  onFocus={() => setCitySearchOpen(true)}
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/20 transition-all text-sm pr-10"
                  data-testid="billing-city-input"
                />
                <span className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </span>
                
                {citySearchOpen && cityOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-12 z-[100] max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl py-1">
                    {cityOptions
                      .filter(opt => opt.label.toLowerCase().includes((formData.city || "").toLowerCase()))
                      .map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            handleChange({ target: { name: "city", value: opt.value } } as any)
                            setCitySearchOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gold-accent/10 hover:text-gold-accent transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-y-0.5" ref={stateContainerRef}>
              <label className="text-sm font-medium text-gray-700">Province</label>
              <div className="relative">
                <input
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  onFocus={() => setStateSearchOpen(true)}
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/20 transition-all text-sm pr-10"
                  data-testid="billing-province-input"
                />
                <span className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </span>

                {stateSearchOpen && stateOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-12 z-[100] max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl py-1">
                    {stateOptions
                      .filter(opt => opt.label.toLowerCase().includes((formData.province || "").toLowerCase()))
                      .map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            handleChange({ target: { name: "province", value: opt.value } } as any)
                            setStateSearchOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gold-accent/10 hover:text-gold-accent transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Country */}
          <div className="flex flex-col gap-y-0.5">
            <label className="text-sm font-medium text-gray-700">Country<span className="text-red-500">*</span></label>
            <NativeSelect
              name="country_code"
              value={formData.country_code}
              onChange={handleChange}
              required
              className="rounded-lg h-[46px]" // Matches the height of manual inputs
              data-testid="billing-country-code-select"
            >
              <option value="">-</option>
              {regionOptions.map((option, i) => (
                <option key={i} value={option?.value}>
                  {option?.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileBillingAddress
