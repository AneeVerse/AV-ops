import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import React, { useState } from "react"
import CountrySelect from "../country-select"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import { State, City } from "country-state-city"
import Select from "@modules/common/components/select"


// Normalize phone — default to India (+91) if no country code present
const normalizePhone = (phone?: string | null): string => {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  if (digits.startsWith("91") && digits.length === 12) return digits
  return digits
}

const BillingAddress = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const [formData, setFormData] = useState<any>({
    "billing_address.full_name": cart?.billing_address?.first_name
      ? `${cart.billing_address.first_name} ${cart.billing_address.last_name === "." ? "" : cart.billing_address.last_name}`.trim()
      : customer?.first_name
      ? `${customer.first_name} ${customer.last_name === "." ? "" : customer.last_name}`.trim()
      : "",
    "billing_address.first_name": cart?.billing_address?.first_name || customer?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || customer?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": normalizePhone(cart?.billing_address?.phone || customer?.phone),
  })

  const countryCodeUpper = (formData["billing_address.country_code"] || "").toUpperCase()

  const stateOptions = React.useMemo(() => {
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

  const cityOptions = React.useMemo(() => {
    if (!countryCodeUpper || !formData["billing_address.province"]) return []
    try {
      const selectedStateObj = stateOptions.find(
        (s) => s.value === formData["billing_address.province"]
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
  }, [countryCodeUpper, formData["billing_address.province"], stateOptions])

  // Sync customer name & phone when customer data loads
  React.useEffect(() => {
    if (customer) {
      setFormData((prev: any) => ({
        ...prev,
        "billing_address.full_name":
          prev["billing_address.full_name"] && prev["billing_address.full_name"].trim() !== ""
            ? prev["billing_address.full_name"]
            : customer.first_name
            ? `${customer.first_name} ${customer.last_name === "." ? "" : customer.last_name}`.trim()
            : "",
        "billing_address.first_name": prev["billing_address.first_name"] || customer.first_name || "",
        "billing_address.last_name": prev["billing_address.last_name"] || customer.last_name || "",
        "billing_address.phone": prev["billing_address.phone"]
          ? normalizePhone(prev["billing_address.phone"])
          : normalizePhone(customer.phone),
      }))
    }
  }, [customer])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    let sanitizedValue = value

    if (name === "billing_address.full_name") {
      const [first, ...rest] = value.split(" ")
      const last = rest.join(" ") || "."
      setFormData((prev: any) => ({
        ...prev,
        [name]: value,
        "billing_address.first_name": first || "",
        "billing_address.last_name": last,
      }))
      return
    }

    if (name === "billing_address.country_code") {
      setFormData((prev: any) => ({
        ...prev,
        [name]: sanitizedValue,
        "billing_address.province": "",
        "billing_address.city": "",
      }))
      return
    }

    if (name === "billing_address.province") {
      setFormData((prev: any) => ({
        ...prev,
        [name]: sanitizedValue,
        "billing_address.city": "",
      }))
      return
    }

    if (name.includes("first_name") || name.includes("last_name") || name.includes("city") || name.includes("province")) {
      sanitizedValue = value.replace(/[^A-Za-z\s]/g, "")
    }

    if (name.includes("postal_code")) {
      sanitizedValue = value.replace(/\D/g, "")
      sanitizedValue = sanitizedValue.slice(0, 6)
    }

    setFormData((prev: any) => ({ ...prev, [name]: sanitizedValue }))

    // Auto-fill City & State when Indian pincode is 6 digits
    if (name === "billing_address.postal_code" && sanitizedValue.length === 6) {
      const fetchLocation = async () => {
        try {
          const response = await fetch(`https://api.postalpincode.in/pincode/${sanitizedValue}`)
          const data = await response.json()
          if (data[0].Status === "Success") {
            const postOffice = data[0].PostOffice[0]
            setFormData((prev: any) => ({
              ...prev,
              "billing_address.city": postOffice.District,
              "billing_address.province": postOffice.State,
            }))
          }
        } catch (e) {}
      }
      fetchLocation()
    }
  }

  return (
    <>
      {/* Full Name */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <Input
          label="Full name*"
          name="billing_address.full_name"
          autoComplete="name"
          value={formData["billing_address.full_name"]}
          onChange={handleChange}
          required
          data-testid="billing-full-name-input"
        />
        <input type="hidden" name="billing_address.first_name" value={formData["billing_address.first_name"]} />
        <input type="hidden" name="billing_address.last_name" value={formData["billing_address.last_name"]} />
      </div>

      {/* Address */}
      <div className="mb-4">
        <Input
          label="Address*"
          name="billing_address.address_1"
          autoComplete="address-line1"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="billing-address-input"
        />
      </div>

      {/* Postal Code, City, State in one row */}
      <div className="grid grid-cols-1 min-[550px]:grid-cols-3 gap-4 mb-4">
        <Input
          label="Postal code*"
          name="billing_address.postal_code"
          autoComplete="postal-code"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          maxLength={6}
          data-testid="billing-postal-input"
        />
        {cityOptions.length > 0 ? (
          <Select
            label="City*"
            name="billing_address.city"
            value={formData["billing_address.city"]}
            onChange={handleChange}
            required
            options={cityOptions}
            data-testid="billing-city-input"
          />
        ) : (
          <Input
            label="City*"
            name="billing_address.city"
            autoComplete="address-level2"
            value={formData["billing_address.city"]}
            onChange={handleChange}
            data-testid="billing-city-input"
          />
        )}
        {stateOptions.length > 0 ? (
          <Select
            label="State / Province*"
            name="billing_address.province"
            value={formData["billing_address.province"]}
            onChange={handleChange}
            required
            options={stateOptions}
            data-testid="billing-province-input"
          />
        ) : (
          <Input
            label="State / Province*"
            name="billing_address.province"
            autoComplete="address-level1"
            value={formData["billing_address.province"]}
            onChange={handleChange}
            data-testid="billing-province-input"
          />
        )}
      </div>

      {/* Country */}
      <div className="mb-4">
        <CountrySelect
          name="billing_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["billing_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="billing-country-select"
        />
      </div>

      {/* Phone */}
      <div className="relative w-full h-12">
        <label className="absolute left-[58px] top-1.5 z-[20] text-[11px] font-medium text-ui-fg-subtle pointer-events-none">
          Phone
        </label>
        <PhoneInput
          country={"in"}
          value={formData["billing_address.phone"]}
          onChange={(value) =>
            setFormData((prev: any) => ({ ...prev, "billing_address.phone": value }))
          }
          inputStyle={{
            width: "100%",
            height: "48px",
            fontSize: "14px",
            paddingLeft: "58px",
            paddingTop: "20px",
            borderRadius: "6px",
            border: "1px solid #C0C0C0",
            backgroundColor: "white",
            fontFamily: "inherit",
            color: "#000",
          }}
          containerStyle={{ width: "100%", height: "48px" }}
          buttonStyle={{
            border: "1px solid #C0C0C0",
            borderRight: "none",
            backgroundColor: "white",
            borderRadius: "6px 0 0 6px",
            width: "48px",
            height: "48px",
            zIndex: 11,
          }}
          dropdownStyle={{ width: "280px", zIndex: 1000 }}
        />
        <input type="hidden" name="billing_address.phone" value={formData["billing_address.phone"]} />
      </div>
    </>
  )
}

export default BillingAddress
