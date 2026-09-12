"use client"

import { HttpTypes } from "@medusajs/types"
import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Input from "@modules/common/components/input"
import CountrySelect from "../country-select"
import Checkbox from "@modules/common/components/checkbox"
import SplitPhoneInput from "@modules/common/components/split-phone-input"
import { isValidIndianPhone } from "@lib/util/phone"

import { useModal } from "@lib/context/modal-context"

type AddAddressModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (formData: FormData) => void
  cart: HttpTypes.StoreCart | null
  editingAddress?: HttpTypes.StoreCustomerAddress | null
}

const AddAddressModal: React.FC<AddAddressModalProps> = ({
  isOpen,
  onClose,
  onSave,
  cart,
  editingAddress,
}) => {
  const { setIsModalOpen } = useModal()
  const [addressType, setAddressType] = useState<"HOME" | "OFFICE">(
    (editingAddress?.metadata?.address_type as "HOME" | "OFFICE") || "HOME"
  )
  const [isDefault, setIsDefault] = useState(
    editingAddress?.is_default_shipping ||
    editingAddress?.metadata?.is_default === "true" ||
    editingAddress?.metadata?.is_default === true ||
    false
  )

  const [fullName, setFullName] = useState(editingAddress?.first_name || "")
  const [phone, setPhone] = useState(editingAddress?.phone || "")
  const [postalCode, setPostalCode] = useState(editingAddress?.postal_code || "")
  const [city, setCity] = useState(editingAddress?.city || "")
  const [province, setProvince] = useState(editingAddress?.province || "")
  const [phoneError, setPhoneError] = useState<string | null>(null)

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

  const handleTextOnlyChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^A-Za-z\s]/g, "")
    setter(val)
  }

  React.useEffect(() => {
    setIsModalOpen(isOpen)
    if (isOpen) {
      document.body.style.overflow = "hidden"
      // Sync form states with editingAddress when opening
      setAddressType((editingAddress?.metadata?.address_type as "HOME" | "OFFICE") || "HOME")
      setIsDefault(
        editingAddress?.is_default_shipping ||
        editingAddress?.metadata?.is_default === "true" ||
        editingAddress?.metadata?.is_default === true ||
        false
      )
      setPostalCode(editingAddress?.postal_code || "")
      setCity(editingAddress?.city || "")
      setProvince(editingAddress?.province || "")
      setFullName(editingAddress?.first_name || "")
      setPhone(editingAddress?.phone || "")
    } else {
      document.body.style.overflow = "unset"
      setPhoneError(null)
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen, setIsModalOpen, editingAddress])

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[10000] flex justify-center p-4 items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl w-full max-h-[90vh] shadow-2xl relative flex flex-col" style={{ width: '600px' }}>
        <div className="text-white px-6 py-5 flex items-center justify-between rounded-t-xl shrink-0 bg-royal-blue">
          <h2 className="text-xl font-bold">
            {editingAddress ? "Edit Address" : "Add New Address"}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20"
          >
            ×
          </button>
        </div>

        <form
          action={(formData) => {
            const digits = phone.replace(/\D/g, "")
            if (!isValidIndianPhone(phone)) {
              setPhoneError("Please enter a valid 10-digit mobile number")
              return
            }

            // Add address type and default address metadata
            formData.append("address_type", addressType)
            formData.append("is_default", isDefault ? "true" : "false")
            formData.append("email", cart?.email || "")
            formData.append("same_as_billing", "on")
            formData.set("shipping_address.phone", phone)
            if (editingAddress?.id) {
              formData.append("address_id", editingAddress.id)
            }
            onSave(formData)
            onClose()
          }}
          className="flex-1 flex flex-col overflow-hidden bg-gray-50 rounded-b-xl"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-white p-5 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 rounded bg-royal-blue"></span>
                CONTACT DETAILS
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name<span className="text-red-500">*</span>
                  </label>
                  <Input
                    label=""
                    name="shipping_address.first_name"
                    value={fullName}
                    onChange={handleTextOnlyChange(setFullName)}
                    required
                  />
                </div>
                <div>
                  <SplitPhoneInput
                    value={phone}
                    onChange={(value) => {
                      setPhone(value)
                      if (isValidIndianPhone(value)) {
                        setPhoneError(null)
                      }
                    }}
                    label="Mobile No"
                    required
                    error={!!phoneError}
                    errorMessage={phoneError || "Please enter a valid 10-digit mobile number"}
                    hiddenInputName="shipping_address.phone"
                    data-testid="add-address-phone-input"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 rounded bg-royal-blue"></span>
                ADDRESS DETAILS
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pin Code<span className="text-red-500">*</span>
                  </label>
                  <Input
                    label=""
                    name="shipping_address.postal_code"
                    value={postalCode}
                    onChange={handlePincodeChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address (locality, building, street)<span className="text-red-500">*</span>
                  </label>
                  <Input
                    label=""
                    name="shipping_address.address_1"
                    defaultValue={editingAddress?.address_1 || ""}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Locality / Town<span className="text-red-500">*</span>
                  </label>
                  <Input
                    label=""
                    name="shipping_address.city"
                    value={city}
                    onChange={handleTextOnlyChange(setCity)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <CountrySelect
                      name="shipping_address.country_code"
                      region={cart?.region}
                      defaultValue={editingAddress?.country_code || undefined}
                      required
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State<span className="text-red-500">*</span>
                    </label>
                    <Input
                      label=""
                      name="shipping_address.province"
                      value={province}
                      onChange={handleTextOnlyChange(setProvince)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 rounded bg-royal-blue"></span>
                ADDRESS TYPE
              </h3>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="radio"
                      name="address_type"
                      value="HOME"
                      checked={addressType === "HOME"}
                      onChange={() => setAddressType("HOME")}
                      className="sr-only"
                    />
                    <div
                      className={addressType === "HOME" ? "w-5 h-5 rounded-full border-2 flex items-center justify-center" : "w-5 h-5 rounded-full border-2 border-gray-300 bg-white"}
                      className={addressType === "HOME" ? "bg-royal-blue border-royal-blue text-white" : ""}
                    >
                      {addressType === "HOME" && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-gray-700">Home</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="radio"
                      name="address_type"
                      value="OFFICE"
                      checked={addressType === "OFFICE"}
                      onChange={() => setAddressType("OFFICE")}
                      className="sr-only"
                    />
                    <div
                      className={addressType === "OFFICE" ? "w-5 h-5 rounded-full border-2 flex items-center justify-center" : "w-5 h-5 rounded-full border-2 border-gray-300 bg-white"}
                      className={addressType === "OFFICE" ? "bg-royal-blue border-royal-blue text-white" : ""}
                    >
                      {addressType === "OFFICE" && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-gray-700">Office</span>
                </label>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm">
              <Checkbox
                label="Make this as my default address"
                name="is_default"
                checked={isDefault}
                onChange={() => setIsDefault(!isDefault)}
              />
            </div>

          </div>

          <div className="flex gap-4 p-6 border-t bg-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg bg-royal-blue"
              onMouseEnter={(e) => {
                e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
              }}
              onMouseLeave={(e) => {
                e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
              }}
            >
              Save Address
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default AddAddressModal
