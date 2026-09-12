"use client"

import { Plus } from "@medusajs/icons"
import { Button, Heading, Text } from "@medusajs/ui"
import { useEffect, useState, useActionState, useMemo } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress } from "@lib/data/customer"
import { State, City } from "country-state-city"
import Select from "@modules/common/components/select"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"

const AddAddress = ({
  region,
  addresses,
}: {
  region: HttpTypes.StoreRegion
  addresses: HttpTypes.StoreCustomerAddress[]
}) => {
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [fullName, setFullName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [countryCode, setCountryCode] = useState("")

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

  const [formState, formAction] = useActionState(addCustomerAddress, {
    isDefaultShipping: addresses.length === 0,
    success: false,
    error: null,
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
        // Pincode fetch failure handled silently
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
    setPostalCode("")
    setCity("")
    setProvince("")
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

  return (
    <>
      <button
        className="border border-dashed border-gold-accent/20 bg-gold-accent/10/10 rounded-xl p-5 w-full flex items-center justify-start gap-x-2 hover:bg-gold-accent/10 transition-colors group"
        onClick={open}
        data-testid="add-address-button"
      >
        <span className="text-gold-accent group-hover:text-gold-accent/80 transition-colors">
          <Plus />
        </span>
        <span className="text-gold-accent font-medium group-hover:text-gold-accent/80 transition-colors text-base">Add New Address</span>
      </button>

      <Modal isOpen={state} close={close} data-testid="add-address-modal" size="small">
        <Modal.Title>Add New Address</Modal.Title>
        <form 
          action={formAction} 
          onSubmit={handleSubmit}
          className="flex flex-col h-full overflow-hidden"
        >
          <Modal.Body>
            <div className="flex flex-col gap-y-4">
              <div>
                <Input
                  label="Full name"
                  name="full-name"
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
                {/* Hidden fields for actual submission */}
                <input type="hidden" name="first_name" value={firstName} />
                <input type="hidden" name="last_name" value={lastName} />
              </div>
              <div>
                <Input
                  label="Address"
                  name="address_1"
                  required
                  autoComplete="address-line1"
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
                  region={region}
                  name="country_code"
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
                      defaultChecked
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
                Save Changes
              </SubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default AddAddress
