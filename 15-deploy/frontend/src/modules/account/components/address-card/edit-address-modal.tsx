"use client"

import React, { useEffect, useState, useActionState, useMemo } from "react"
import { PencilSquare as Edit, Trash } from "@medusajs/icons"
import { Button, Heading, Text, clx } from "@medusajs/ui"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import Spinner from "@modules/common/icons/spinner"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { HttpTypes } from "@medusajs/types"
import { updateCustomerAddress } from "@lib/data/customer"
import { State, City } from "country-state-city"
import Select from "@modules/common/components/select"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import {
  deleteCustomerAddress,
  setDefaultAddress,
} from "@lib/data/customer"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
  isActive?: boolean
}

const EditAddress: React.FC<EditAddressProps> = ({
  region,
  address,
  isActive = false,
}) => {
  const [removing, setRemoving] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [fullName, setFullName] = useState(address.first_name ? `${address.first_name} ${address.last_name === "." ? "" : address.last_name}`.trim() : "")
  const [firstName, setFirstName] = useState(address.first_name || "")
  const [lastName, setLastName] = useState(address.last_name || "")
  const [postalCode, setPostalCode] = useState(address.postal_code || "")
  const [city, setCity] = useState(address.city || "")
  const [province, setProvince] = useState(address.province || "")
  const [phone, setPhone] = useState(address.phone || "")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [countryCode, setCountryCode] = useState(address.country_code || "")

  const countryCodeUpper = (countryCode || "").toUpperCase()

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
    if (!countryCodeUpper || !province) return []
    try {
      const selectedStateObj = stateOptions.find(
        (s) => s.value === province
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
  }, [countryCodeUpper, province, stateOptions])

  const [formState, formAction] = useActionState(updateCustomerAddress, {
    success: false,
    error: null,
    addressId: address.id,
  })

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6)
    setPostalCode(val)

    if (val.length === 6) {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${val}`)
        const data = await response.json()
        if (data[0].Status === "Success") {
          const postOffice = data[0].PostOffice[0]
          setCity(postOffice.District)
          setProvince(postOffice.State)
        }
      } catch (error) {
        // Silence error
      }
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10)
    setPhone(val)
  }

  const handleTextOnlyChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^A-Za-z\s]/g, "")
    setter(val)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 12) {
      e.preventDefault()
      setPhoneError("Please enter a valid 10-digit phone number.")
      return
    }
    setPhoneError(null)
  }

  const close = () => {
    setSuccessState(false)
    closeModal()
  }

  useEffect(() => {
    if (successState) {
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successState])

  useEffect(() => {
    if (formState.success) {
      setSuccessState(true)
    }
  }, [formState])

  const removeAddress = async () => {
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
  }

  const handleSetDefault = async () => {
    setSettingDefault(true)
    await setDefaultAddress(address.id)
    setSettingDefault(false)
  }

  return (
    <>
      <div
        className={clx(
          "bg-white border border-gray-100 rounded-xl p-8 w-full flex flex-col justify-between transition-all hover:shadow-lg",
          {
            "border-gray-900": isActive || address.is_default_shipping,
          }
        )}
        data-testid="address-container"
      >
        <div className="flex flex-col mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col gap-y-1">
              <Heading
                className="text-left text-xl font-bold text-gray-900"
                data-testid="address-name"
              >
                {address.first_name} {address.last_name}
              </Heading>
              {address.is_default_shipping && (
                <Text className="text-gold-accent text-xs font-bold uppercase">
                  Default Address
                </Text>
              )}
            </div>
            <div className="flex gap-x-2">
              {address.is_default_shipping && (
                <div className="bg-royal-blue text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                  Default
                </div>
              )}
              <div className="border border-[#D69EFD] text-[#a855f7] px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                {String(address.metadata?.address_type || "HOME")}
              </div>
            </div>
          </div>

          <div className="text-gray-500 text-sm leading-relaxed mb-4">
            <p className="block mb-4">
              {address.address_1}, {address.city}, {address.province ? `${address.province}, ` : ""}{address.postal_code}
            </p>
            <p className="mt-2 text-gray-900">
              <span className="text-gray-500 mr-2">Mobile:</span>
              <span className="font-bold">{address.phone}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="border border-gray-300 rounded-full px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center min-w-[100px]"
            onClick={removeAddress}
            data-testid="address-delete-button"
            disabled={removing}
          >
            {removing && <Spinner className="animate-spin mr-2" />}
            Remove
          </button>

          <button
            className="border border-gray-300 rounded-full px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center min-w-[100px]"
            onClick={open}
            data-testid="address-edit-button"
          >
            Edit
          </button>

          {!address.is_default_shipping && (
            <button
              className="border border-gold-accent rounded-full px-6 py-2 text-sm font-semibold text-gold-accent hover:bg-gold-accent/10 transition-colors flex items-center justify-center min-w-[120px]"
              onClick={handleSetDefault}
              disabled={settingDefault}
            >
              {settingDefault && <Spinner className="animate-spin mr-2" />}
              Set as Default
            </button>
          )}
        </div>
      </div>

      <Modal isOpen={state} close={close} data-testid="edit-address-modal" size="small">
        <Modal.Title>Edit Address</Modal.Title>
        <form 
          action={formAction} 
          onSubmit={handleSubmit}
          className="flex flex-col h-full overflow-hidden"
        >
          <input type="hidden" name="addressId" value={address.id} />
          <Modal.Body>
            <div className="flex flex-col gap-y-4">
              <div>
                <Input
                  label="Full name"
                  name="full_name"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    const val = e.target.value
                    setFullName(val)
                    const [first, ...rest] = val.split(" ")
                    setFirstName(first || "")
                    setLastName(rest.join(" ") || ".")
                  }}
                  data-testid="full-name-input"
                />
                {/* Hidden fields for backend compatibility */}
                <input type="hidden" name="first_name" value={firstName} />
                <input type="hidden" name="last_name" value={lastName} />
              </div>
              <div>
                <Input
                  label="Address"
                  name="address_1"
                  required
                  autoComplete="address-line1"
                  defaultValue={address.address_1 || undefined}
                  data-testid="address-1-input"
                />
              </div>
              <div>
                <Input
                  label="Postal code"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  data-testid="postal-code-input"
                  value={postalCode}
                  onChange={handlePincodeChange}
                />
              </div>
              <div>
                <CountrySelect
                  name="country_code"
                  region={region}
                  required
                  autoComplete="country"
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value)
                    setProvince("")
                    setCity("")
                  }}
                  data-testid="country-select"
                />
              </div>
              <div>
                {stateOptions.length > 0 ? (
                  <Select
                    label="Province / State"
                    name="province"
                    required
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value)
                      setCity("")
                    }}
                    options={stateOptions}
                    data-testid="state-input"
                  />
                ) : (
                  <Input
                    label="Province / State"
                    name="province"
                    autoComplete="address-level1"
                    data-testid="state-input"
                    value={province}
                    onChange={handleTextOnlyChange(setProvince)}
                  />
                )}
              </div>
              <div>
                {cityOptions.length > 0 ? (
                  <Select
                    label="City"
                    name="city"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    options={cityOptions}
                    data-testid="city-input"
                  />
                ) : (
                  <Input
                    label="City"
                    name="city"
                    required
                    autoComplete="locality"
                    data-testid="city-input"
                    value={city}
                    onChange={handleTextOnlyChange(setCity)}
                  />
                )}
              </div>
              <div className="flex flex-col gap-y-2">
                <Text className="text-sm font-semibold text-gray-700">Phone<span className="text-rose-500">*</span></Text>
                <div className="relative w-full h-12">
                  <PhoneInput
                    country={"in"}
                    value={phone}
                    onChange={(value) => {
                      setPhone(value)
                      if (value.replace(/\D/g, "").length >= 12) {
                        setPhoneError(null)
                      }
                    }}
                    inputStyle={{
                      width: "100%",
                      height: "48px",
                      fontSize: "14px",
                      paddingLeft: "58px",
                      borderRadius: "6px",
                      border: phoneError ? "1px solid #EF4444" : "1px solid #C0C0C0",
                      backgroundColor: "white",
                      fontFamily: "inherit",
                      color: "#000"
                    }}
                    containerStyle={{
                      width: "100%",
                      height: "48px"
                    }}
                    buttonStyle={{
                      border: phoneError ? "1px solid #EF4444" : "1px solid #C0C0C0",
                      borderRight: "none",
                      backgroundColor: "white",
                      borderRadius: "6px 0 0 6px",
                      width: "48px",
                      height: "48px",
                      zIndex: 11
                    }}
                    dropdownStyle={{
                      width: "280px",
                      zIndex: 1000
                    }}
                  />
                  <input type="hidden" name="phone" value={phone} />
                </div>
                {phoneError && (
                  <Text className="text-rose-500 text-[11px] font-medium italic mt-1 leading-none">{phoneError}</Text>
                )}
              </div>

              {/* Address Type Selection */}
              <div className="small:col-span-2 flex flex-col gap-y-2 mt-2">
                <Text className="text-sm font-semibold text-gray-700">Address Type</Text>
                <div className="flex gap-x-6">
                  <label className="flex items-center gap-x-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="address_type"
                      value="HOME"
                      defaultChecked={(address.metadata?.address_type as string) !== "OFFICE"}
                      className="peer hidden"
                    />
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center group-hover:border-gold-accent transition-all peer-checked:border-gold-accent peer-checked:[&>div]:scale-100">
                      <div className="w-3 h-3 rounded-full bg-royal-blue scale-0 transition-transform"></div>
                    </div>
                    <span className="text-base font-medium text-gray-600 peer-checked:text-gold-accent transition-colors">Home</span>
                  </label>

                  <label className="flex items-center gap-x-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="address_type"
                      value="OFFICE"
                      defaultChecked={(address.metadata?.address_type as string) === "OFFICE"}
                      className="peer hidden"
                    />
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center group-hover:border-gold-accent transition-all peer-checked:border-gold-accent peer-checked:[&>div]:scale-100">
                      <div className="w-3 h-3 rounded-full bg-royal-blue scale-0 transition-transform"></div>
                    </div>
                    <span className="text-base font-medium text-gray-600 peer-checked:text-gold-accent transition-colors">Office</span>
                  </label>
                </div>
              </div>
            </div>
            {formState.error && (
              <div
                className="text-rose-500 text-small-regular py-4 mt-2 bg-rose-50 px-4 rounded-lg border border-rose-100"
                data-testid="address-error"
              >
                {formState.error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex flex-col small:flex-row gap-3 w-full small:w-auto">
              <button
                type="reset"
                onClick={close}
                className="w-full small:w-auto px-8 py-3 rounded-full border border-gray-300 font-bold text-gray-700 hover:bg-gray-50 transition-all text-base order-2 small:order-1"
                data-testid="cancel-button"
              >
                Cancel
              </button>
              <SubmitButton
                data-testid="save-button"
                className="w-full small:w-auto px-8 py-3 rounded-full bg-royal-blue font-bold text-white hover:bg-[#784ca1] transition-all text-base order-1 small:order-2"
              >
                Update Address
              </SubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default EditAddress
