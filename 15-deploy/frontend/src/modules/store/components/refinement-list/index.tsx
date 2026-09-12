"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState, useEffect, useTransition } from "react"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "./sort-products"
import FilterCheckboxGroup from "@modules/common/components/filter-checkbox-group"
import { convertToLocale } from "@lib/util/money"

type RefinementListProps = {
  sortBy: SortOptions
  search?: boolean
  'data-testid'?: string
  collections?: HttpTypes.StoreCollection[]
  collectionValue?: string | string[]
  genderValue?: string | string[]
  typeValue?: string | string[]
  materialValue?: string | string[]
  colorValue?: string | string[]
  categoryValue?: string | string[]
  minPrice?: string
  maxPrice?: string
  genderOptions?: { value: string; label: string }[]
  typeOptions?: { value: string; label: string }[]
  materialOptions?: { value: string; label: string }[]
  colorOptions?: { value: string; label: string }[]
  categoryOptions?: { value: string; label: string }[]
  hideTitle?: boolean
  q?: string
  currencyCode?: string
}

const RefinementList = ({
  sortBy,
  'data-testid': dataTestId,
  collections,
  collectionValue,
  categoryValue,
  genderValue,
  typeValue,
  materialValue,
  colorValue,
  minPrice,
  maxPrice,
  genderOptions,
  typeOptions,
  materialOptions,
  colorOptions,
  categoryOptions,
  hideTitle = false,
  q,
  currencyCode = "inr",
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [minPriceLocal, setMinPriceLocal] = useState(parseInt(minPrice || "0"))
  const [maxPriceLocal, setMaxPriceLocal] = useState(parseInt(maxPrice || "10000"))

  useEffect(() => {
    setMinPriceLocal(parseInt(minPrice || "0"))
    setMaxPriceLocal(parseInt(maxPrice || "10000"))
  }, [minPrice, maxPrice])

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }

      return params.toString()
    },
    [searchParams]
  )

  const setQueryParams = (name: string, value: string) => {
    const query = createQueryString(name, value)
    startTransition(() => {
      router.replace(`${pathname}?${query}`, { scroll: false })
    })
  }

  const handleFilterChange = (name: string, currentValues: string | string[] | undefined, value: string) => {
    let values: string[] = []
    if (typeof currentValues === "string") {
      values = currentValues.split(",").filter(Boolean)
    } else if (Array.isArray(currentValues)) {
      values = currentValues
    }

    const newValues = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]

    setQueryParams(name, newValues.join(","))
  }

  const handlePriceApply = () => {
    const params = new URLSearchParams(searchParams)
    params.set("min_price", minPriceLocal.toString())
    params.set("max_price", maxPriceLocal.toString())
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams)
    params.delete("collection")
    params.delete("category")
    params.delete("gender")
    params.delete("type")
    params.delete("material")
    params.delete("color")
    params.delete("min_price")
    params.delete("max_price")
    params.delete("q")
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const hasFilters = !!(collectionValue || categoryValue || genderValue || typeValue || materialValue || colorValue || minPrice || maxPrice || q)

  return (
    <div className={`bg-white rounded-lg p-6 shadow-sm border border-gray-200 flex flex-col gap-y-8 transition-opacity duration-75 ${isPending ? 'opacity-90 pointer-events-none' : 'opacity-100'}`}>
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">FILTERS</h2>
          {hasFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-gold-accent hover:opacity-80 uppercase tracking-wider transition-colors"
              data-ga-event="filter_clear_all_click"
              data-ga-label="Clear All Filters"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {hideTitle && hasFilters && (
        <div className="flex justify-end">
          <button
            onClick={clearAllFilters}
            className="text-xs font-semibold text-gold-accent hover:opacity-80 uppercase tracking-wider transition-colors"
            data-ga-event="filter_clear_all_click"
            data-ga-label="Clear All Filters"
          >
            Clear All
          </button>
        </div>
      )}

      {/* SORT BY component has been removed as per requirement */}

      {collections && collections.length > 0 && (
        <FilterCheckboxGroup
          title="Age Group"
          items={collections.map(c => ({ value: c.id, label: c.title || "" }))}
          values={typeof collectionValue === 'string' ? collectionValue.split(',') : collectionValue || []}
          handleChange={(v) => handleFilterChange('collection', collectionValue, v)}
        />
      )}

      {categoryOptions && categoryOptions.length > 0 && (
        <FilterCheckboxGroup
          title="Category"
          items={categoryOptions}
          values={typeof categoryValue === 'string' ? categoryValue.split(',') : categoryValue || []}
          handleChange={(v) => handleFilterChange('category', categoryValue, v)}
        />
      )}

      {genderOptions && genderOptions.length > 0 && (
        <FilterCheckboxGroup
          title="Gender"
          items={genderOptions}
          values={typeof genderValue === 'string' ? genderValue.split(',') : genderValue || []}
          handleChange={(v) => handleFilterChange('gender', genderValue, v)}
        />
      )}

      {typeOptions && typeOptions.length > 0 && (
        <FilterCheckboxGroup
          title="Product Type"
          items={typeOptions}
          values={typeof typeValue === 'string' ? typeValue.split(',') : typeValue || []}
          handleChange={(v) => handleFilterChange('type', typeValue, v)}
        />
      )}

      {colorOptions && colorOptions.length > 0 && (
        <FilterCheckboxGroup
          title="Color"
          items={colorOptions}
          values={typeof colorValue === 'string' ? colorValue.split(',') : colorValue || []}
          handleChange={(v) => handleFilterChange('color', colorValue, v)}
          isColor={true}
        />
      )}

      {materialOptions && materialOptions.length > 0 && (
        <FilterCheckboxGroup
          title="Material"
          items={materialOptions}
          values={typeof materialValue === 'string' ? materialValue.split(',') : materialValue || []}
          handleChange={(v) => handleFilterChange('material', materialValue, v)}
        />
      )}

      {/* Price Range Filter */}
      <div className="flex flex-col border-b border-gray-100 pb-4 last:border-0 last:pb-0">
        <div className="flex items-center justify-between w-full py-1">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Price</h3>
        </div>
        <div className="mt-6 px-2">
          <div
            className="relative h-1.5 w-full bg-gray-200 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - rect.left
              const percentage = Math.max(0, Math.min(1, x / rect.width))
              const value = Math.round((percentage * 10000) / 100) * 100

              if (Math.abs(value - minPriceLocal) < Math.abs(value - maxPriceLocal)) {
                setMinPriceLocal(Math.min(value, maxPriceLocal - 500))
              } else {
                setMaxPriceLocal(Math.max(value, minPriceLocal + 500))
              }
            }}
          >
            <div
              className="absolute h-full bg-royal-blue rounded-full"
              style={{
                left: `${(minPriceLocal / 10000) * 100}%`,
                right: `${100 - (maxPriceLocal / 10000) * 100}%`
              }}
            />
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={minPriceLocal}
              onChange={(e) => setMinPriceLocal(Math.min(parseInt(e.target.value), maxPriceLocal - 500))}
              className={`absolute pointer-events-none appearance-none w-full h-1.5 bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-royal-blue [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg ${minPriceLocal > 5000 ? 'z-10' : 'z-20'}`}
              onClick={(e) => e.stopPropagation()}
            />
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={maxPriceLocal}
              onChange={(e) => setMaxPriceLocal(Math.max(parseInt(e.target.value), minPriceLocal + 500))}
              className={`absolute pointer-events-none appearance-none w-full h-1.5 bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-royal-blue [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg ${minPriceLocal > 5000 ? 'z-20' : 'z-10'}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="mt-6 flex items-center justify-between text-sm font-medium text-gray-700">
            <span>
              {convertToLocale({
                amount: minPriceLocal,
                currency_code: currencyCode,
                maximumFractionDigits: 0,
              })}
            </span>
            <span>
              {convertToLocale({
                amount: maxPriceLocal,
                currency_code: currencyCode,
                maximumFractionDigits: 0,
              })}
              +
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handlePriceApply}
              className="flex-1 bg-royal-blue text-white py-1.5 rounded text-xs font-bold hover:bg-opacity-90 transition-all border-none outline-none"
              data-ga-event="filter_price_apply_click"
              data-ga-label="Apply Price Filter"
            >
              APPLY
            </button>
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.delete("min_price")
                params.delete("max_price")
                startTransition(() => {
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                })
              }}
              className="px-3 border border-gray-200 py-1.5 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all outline-none"
              data-ga-event="filter_price_reset_click"
              data-ga-label="Reset Price Filter"
            >
              RESET
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RefinementList
