"use client"

import { HttpTypes } from "@medusajs/types"
import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useModal } from "@lib/context/modal-context"
import AddressCard from "../address-card"

type SelectAddressModalProps = {
    isOpen: boolean
    onClose: () => void
    addresses: HttpTypes.StoreCustomerAddress[]
    selectedAddressId: string | null
    onSelect: (addressId: string) => void
    onEdit: (address: HttpTypes.StoreCustomerAddress) => void
}

const SelectAddressModal: React.FC<SelectAddressModalProps> = ({
    isOpen,
    onClose,
    addresses,
    selectedAddressId,
    onSelect,
    onEdit,
}) => {
    const { setIsModalOpen } = useModal()

    React.useEffect(() => {
        setIsModalOpen(isOpen)
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isOpen, setIsModalOpen])

    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!isOpen || !mounted) return null

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[10000] flex justify-center p-4 overflow-y-auto items-start"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="bg-white rounded-xl w-full max-h-fit shadow-2xl my-8 relative" style={{ width: '600px' }}>
                <div className="text-white px-6 py-5 flex items-center justify-between rounded-t-xl sticky top-0 z-10 bg-royal-blue">
                    <h2 className="text-xl font-bold">Select Delivery Address</h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-200 text-2xl font-bold transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-gray-50">
                    {addresses.length > 0 ? (
                        addresses.map((address) => (
                            <AddressCard
                                key={address.id}
                                address={address}
                                isSelected={selectedAddressId === address.id}
                                onSelect={() => {
                                    onSelect(address.id)
                                    onClose()
                                }}
                                onEdit={() => onEdit(address)}
                                onRemove={() => { }} // Remove option not needed in selection modal
                            />
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No saved addresses found.</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-white rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-full font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}

export default SelectAddressModal
