"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

interface ProductContextType {
    selectedVariantId: string | undefined
    selectedOptions: Record<string, string | undefined>
    setSelectedVariantId: (id: string | undefined) => void
    setSelectedOptions: (options: Record<string, string | undefined>) => void
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export const ProductProvider = ({ children }: { children: React.ReactNode }) => {
    const searchParams = useSearchParams()
    const initialVariantId = searchParams.get("v_id") || undefined
    const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
        initialVariantId
    )
    const [selectedOptions, setSelectedOptions] = useState<
        Record<string, string | undefined>
    >({})

    useEffect(() => {
        const vId = searchParams.get("v_id")
        if (vId) {
            setSelectedVariantId(vId)
        }
    }, [searchParams])

    return (
        <ProductContext.Provider
            value={{
                selectedVariantId,
                selectedOptions,
                setSelectedVariantId,
                setSelectedOptions,
            }}
        >
            {children}
        </ProductContext.Provider>
    )
}

export const useProductContext = () => {
    const context = useContext(ProductContext)
    if (context === undefined) {
        throw new Error("useProductContext must be used within a ProductProvider")
    }
    return context
}
