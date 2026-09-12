"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  PHONE_COUNTRIES,
  combinePhoneParts,
  parsePhoneParts,
  type PhoneCountry,
} from "@lib/util/phone"

type SplitPhoneInputProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
  error?: boolean
  errorMessage?: string
  /** Visible input id for the local number field */
  numberInputId?: string
  /** Hidden input id used by checkout address sync */
  hiddenInputId?: string
  hiddenInputName?: string
  "data-testid"?: string
}

const SplitPhoneInput: React.FC<SplitPhoneInputProps> = ({
  value,
  onChange,
  label = "Phone",
  required = false,
  error = false,
  errorMessage = "Enter 10 digit valid phone number.",
  numberInputId = "phone_number_field",
  hiddenInputId,
  hiddenInputName,
  "data-testid": dataTestId,
}) => {
  const parsed = parsePhoneParts(value)
  const [dialCode, setDialCode] = useState(parsed.dialCode)
  const [localNumber, setLocalNumber] = useState(parsed.localNumber)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedCountry =
    PHONE_COUNTRIES.find((c) => c.dialCode === dialCode) ?? PHONE_COUNTRIES[0]

  useEffect(() => {
    const next = parsePhoneParts(value)
    setDialCode(next.dialCode)
    setLocalNumber(next.localNumber)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const emitChange = (nextDial: string, nextLocal: string) => {
    onChange(combinePhoneParts(nextDial, nextLocal))
  }

  const handleCountrySelect = (country: PhoneCountry) => {
    setDialCode(country.dialCode)
    setDropdownOpen(false)
    emitChange(country.dialCode, localNumber)
  }

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value.replace(/\D/g, "")

    // If user pasted full number with country code, strip the +91 prefix
    if (next.length > 10 && next.startsWith("91")) {
      next = next.slice(2, 12)
    } else {
      next = next.slice(0, 10)
    }

    setLocalNumber(next)
    emitChange(dialCode, next)
  }

  const borderColor = error ? "#EF4444" : "#C0C0C0"

  return (
    <div className="w-full" ref={containerRef} data-testid={dataTestId}>
      <div className="flex gap-2 w-full">
        {/* Country code box with flag dropdown */}
        <div className="relative shrink-0 w-[108px]">
          <label className="sr-only">Country code</label>
          <button
            type="button"
            aria-label="Select country code"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((open) => !open)}
            className="flex items-center justify-between gap-1 w-full h-12 px-2.5 bg-white border rounded-md hover:bg-gray-50 transition-colors"
            style={{ borderColor }}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-lg leading-none">{selectedCountry.flag}</span>
              <span className="text-sm font-medium text-gray-900">+{selectedCountry.dialCode}</span>
            </span>
            <svg
              className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <ul
              className="absolute left-0 top-[calc(100%+4px)] z-[1000] w-[220px] max-h-48 overflow-y-auto bg-white border rounded-md shadow-lg py-1"
              style={{ borderColor: "#C0C0C0" }}
              role="listbox"
            >
              {PHONE_COUNTRIES.map((country) => (
                <li key={country.iso2} role="option" aria-selected={country.dialCode === dialCode}>
                  <button
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm hover:bg-gold-accent/10 transition-colors ${
                      country.dialCode === dialCode ? "bg-gold-accent/10 font-medium" : ""
                    }`}
                  >
                    <span className="text-lg leading-none">{country.flag}</span>
                    <span className="text-gray-900">{country.name}</span>
                    <span className="ml-auto text-gray-500">+{country.dialCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Phone number box — digits only, no country code */}
        <div className="relative flex-1 min-w-0">
          <input
            type="tel"
            id={numberInputId}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder=" "
            required={required}
            value={localNumber}
            onChange={handleLocalChange}
            maxLength={10}
            className="peer pt-6 pb-2 block w-full h-12 px-4 mt-0 bg-white border rounded-md appearance-none focus:outline-none focus:border-gold-accent focus:ring-0 hover:bg-gray-50 transition-colors duration-200 antialiased"
            style={{ borderColor }}
          />
          <label
            htmlFor={numberInputId}
            className="flex items-center absolute left-4 px-1 transition-all duration-300 top-1/2 -translate-y-1/2 origin-0 text-ui-fg-subtle pointer-events-none peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-gold-accent peer-focus:z-10 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:z-10"
          >
            {label}
            {required && <span className="text-rose-500">*</span>}
          </label>
        </div>
      </div>

      {hiddenInputName && (
        <input
          type="hidden"
          id={hiddenInputId}
          name={hiddenInputName}
          value={combinePhoneParts(dialCode, localNumber)}
        />
      )}

      {error && (
        <p className="text-red-500 text-[11px] mt-1 font-medium italic">{errorMessage}</p>
      )}
    </div>
  )
}

export default SplitPhoneInput
