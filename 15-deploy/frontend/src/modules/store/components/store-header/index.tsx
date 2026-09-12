"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { clx } from "@medusajs/ui"
import SortProducts, { SortOptions } from "../refinement-list/sort-products"
import MobileFilters from "../mobile-filters"

type StoreHeaderProps = {
  sortBy: SortOptions
  productCount?: number
  q?: string
  filterProps?: any
}

export default function StoreHeader({ sortBy, productCount, q, filterProps }: StoreHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
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

  return (
    <div className={clx(
      "flex flex-col gap-4 mb-6 transition-opacity duration-200",
      isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'
    )}>
      <div className="flex flex-row items-center justify-between gap-2 px-0.5">
        <h1 className="text-xl min-[400px]:text-2xl font-black text-gray-900 tracking-tight flex items-baseline gap-2 overflow-hidden" data-testid="store-page-title">
          <span className="truncate">
            {q ? `"${q}"` : "All Products"}
          </span>
          {productCount !== undefined && (
            <span className="text-[10px] min-[400px]:text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              {productCount} Items
            </span>
          )}
        </h1>

        {/* Desktop Sort Only (Hidden on Mobile as we'll group it) */}
        <div className="hidden lg:flex items-center">
          <SortProducts sortBy={sortBy} setQueryParams={setQueryParams} />
        </div>
      </div>

      {/* Mobile/Tablet Controls Row (Filters + Sort) - Compact & Corner Aligned */}
      <div className="flex lg:hidden items-center justify-between gap-2 w-full px-0.5 mt-2 max-[450px]:grid max-[450px]:grid-cols-2">
        <div className="min-[450px]:w-auto w-full">
          {filterProps && <MobileFilters {...filterProps} hideMargin={true} />}
        </div>
        <div className="min-[450px]:w-auto w-full">
          <SortProducts sortBy={sortBy} setQueryParams={setQueryParams} />
        </div>
      </div>
    </div>
  )
}
