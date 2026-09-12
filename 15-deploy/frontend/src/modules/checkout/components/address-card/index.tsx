"use client"

import { HttpTypes } from "@medusajs/types"
import React from "react"

type AddressCardProps = {
  address: HttpTypes.StoreCustomerAddress | any
  isSelected: boolean
  isDefault?: boolean
  onSelect: () => void
  onEdit: () => void
  onRemove: () => void
}

const AddressCard: React.FC<AddressCardProps> = ({
  address,
  isSelected,
  isDefault = false,
  onSelect,
  onEdit,
  onRemove,
}) => {
  const addressType = address.metadata?.address_type || "HOME"

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't trigger onSelect if clicking on buttons
    const target = e.target as HTMLElement
    if (target.closest('button')) {
      return
    }
    onSelect()
  }

  return (
    <div
      className={`rounded-lg p-6 border-2 cursor-pointer transition-all ${isSelected
        ? "shadow-md"
        : ""
        }`}
      style={{
        borderColor: '#C0C0C0'
      }}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-4">
        {/* Radio Button */}
        <div className="flex-shrink-0 mt-1">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected
              ? ""
              : "border-gray-300 bg-ivory-bg"
              }`}
            style={isSelected ? {
              className: 'border-gold-accent',
              backgroundColor: '#0A1D37'
            } : {}}
          >
            {isSelected && (
              <div className="w-2 h-2 rounded-full bg-white"></div>
            )}
          </div>
        </div>

        {/* Address Content */}
        <div className="flex-1">
          {/* Name and Address Type Tag */}
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-bold text-gray-900">
              {address.first_name} {address.last_name === "." ? "" : address.last_name}
            </h3>
            <span
              className="px-2 py-1 rounded text-xs font-medium uppercase"
              style={{
                backgroundColor: 'rgba(212,175,55,0.2)',
                className: 'text-gold-accent',
                border: '1px solid #D4AF37'
              }}
            >
              {addressType}
            </span>
          </div>

          {/* Address Details */}
          <div className="text-base text-gray-700 mb-2">
            <p>{address.address_1}</p>
            {address.address_2 && <p>{address.address_2}</p>}
            <p>
              {address.city}
              {address.province && `, ${address.province}`}
              {address.postal_code && ` - ${address.postal_code}`}
            </p>
            {address.country_code && (
              <p>{address.country_code.toUpperCase()}</p>
            )}
          </div>

          {/* Mobile Number */}
          {address.phone && (
            <div className="text-base text-gray-700 mb-2">
              <span className="text-gray-600">Mobile: </span>
              <span className="font-semibold">{address.phone}</span>
            </div>
          )}

          {/* Pay on Delivery */}
          <div className="text-sm text-gray-500 mb-4">
            <span>• Pay on Delivery available</span>
          </div>

          {/* Action Buttons */}
          <div
            className="flex gap-3 mt-4 relative z-10"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEdit()
              }}
              className="border transition-colors flex items-center justify-center relative z-20"
              style={{
                color: '#222222',
                borderColor: '#000000',
                borderRadius: '30px',
                width: '89px',
                height: '40px',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddressCard
