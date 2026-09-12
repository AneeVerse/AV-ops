import React from "react"

import AddAddress from "../address-card/add-address"
import EditAddress from "../address-card/edit-address-modal"
import { HttpTypes } from "@medusajs/types"

type AddressBookProps = {
  customer: HttpTypes.StoreCustomer
  region: HttpTypes.StoreRegion
}

const AddressBook: React.FC<AddressBookProps> = ({ customer, region }) => {
  const { addresses } = customer

  const sortedAddresses = [...addresses].sort((a, b) => {
    // Check for native default flag or metadata default flag
    const aIsDefault = a.is_default_shipping || a.metadata?.is_default === "true" || a.metadata?.is_default === true
    const bIsDefault = b.is_default_shipping || b.metadata?.is_default === "true" || b.metadata?.is_default === true

    if (aIsDefault && !bIsDefault) return -1
    if (!aIsDefault && bIsDefault) return 1

    // Secondary sort by date (newest first)
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
  return (
    <div className="w-full max-w-[800px]">
      <div className="mb-8">
        <h1 className="text-xl font-bold mb-6 text-gray-900">Saved Addresses</h1>
      </div>

      <div className="flex flex-col gap-6">
        {sortedAddresses.map((address) => {
          return (
            <EditAddress region={region} address={address} key={address.id} />
          )
        })}

        <div className="mt-4">
          <AddAddress region={region} addresses={addresses} />
        </div>
      </div>
    </div>
  )
}

export default AddressBook
