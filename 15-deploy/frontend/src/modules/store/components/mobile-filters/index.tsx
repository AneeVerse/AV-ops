"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { clx } from "@medusajs/ui"
import RefinementList from "../refinement-list"
import { SortOptions } from "../refinement-list/sort-products"
import { HttpTypes } from "@medusajs/types"

type MobileFiltersProps = {
    sortBy: SortOptions
    collections?: HttpTypes.StoreCollection[]
    collectionValue?: string | string[]
    genderValue?: string | string[]
    typeValue?: string | string[]
    materialValue?: string | string[]
    colorValue?: string | string[]
    minPrice?: string
    maxPrice?: string
    genderOptions?: { value: string; label: string }[]
    typeOptions?: { value: string; label: string }[]
    materialOptions?: { value: string; label: string }[]
    colorOptions?: { value: string; label: string }[]
    hideMargin?: boolean
}

const MobileFilters: React.FC<MobileFiltersProps> = ({ hideMargin, ...props }) => {
    const [isOpen, setIsOpen] = useState(false)
    const searchParams = useSearchParams()

    // Close panel when search params change (filter applied)
    useEffect(() => {
        setIsOpen(false)
    }, [searchParams])

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    return (
        <div className={clx("lg:hidden w-full", !hideMargin && "mb-4")}>
            {/* Filter Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center justify-center gap-x-2 bg-white border border-gray-200 px-8 py-1.5 rounded-full shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] hover:bg-gray-50 transition-all active:scale-95 w-full min-[450px]:w-auto"
                data-ga-event="mobile_filter_open_click"
                data-ga-label="Open Filters"
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold-accent"
                >
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Filters</span>
            </button>

            {/* Backdrop */}
            <div
                className={clx(
                    "fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 z-[9999]",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            />

            {/* Left Side Panel */}
            <div
                className={clx(
                    "fixed top-0 left-0 h-full w-[280px] min-[400px]:w-[320px] bg-ivory-bg shadow-2xl transition-transform duration-200 ease-in-out z-[10000] flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-ivory-bg">
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Filters</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                        data-ga-event="mobile_filter_close_click"
                        data-ga-label="Close Filters"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar-hidden p-0">
                    <style dangerouslySetInnerHTML={{
                        __html: `
            .custom-scrollbar-hidden::-webkit-scrollbar {
              display: none;
            }
            .custom-scrollbar-hidden {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}} />
                    {/* We wrap RefinementList but we remove its shadow/border since it's already in a panel */}
                    <div className="p-0 [&>div]:shadow-none [&>div]:border-0 [&>div]:rounded-none">
                        <RefinementList {...props} hideTitle={true} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MobileFilters
