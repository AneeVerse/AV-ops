import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import MobileFilters from "@modules/store/components/mobile-filters"

import PaginatedProducts from "./paginated-products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
  collections,
  collection,
  gender,
  type,
  material,
  color,
  minPrice,
  maxPrice,
  genderOptions,
  typeOptions,
  materialOptions,
  colorOptions,
  category,
  categoryOptions,
  q,
  currencyCode,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  collections?: HttpTypes.StoreCollection[]
  collection?: string | string[]
  category?: string | string[]
  gender?: string | string[]
  type?: string | string[]
  material?: string | string[]
  color?: string | string[]
  minPrice?: string
  maxPrice?: string
  genderOptions?: { value: string; label: string }[]
  typeOptions?: { value: string; label: string }[]
  materialOptions?: { value: string; label: string }[]
  colorOptions?: { value: string; label: string }[]
  categoryOptions?: { value: string; label: string }[]
  q?: string
  currencyCode?: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at_desc"

  const filterProps = {
    sortBy: sort,
    collections,
    collectionValue: collection,
    categoryValue: category,
    categoryOptions,
    genderValue: gender,
    typeValue: type,
    materialValue: material,
    colorValue: color,
    minPrice,
    maxPrice,
    genderOptions,
    typeOptions,
    materialOptions,
    colorOptions,
    q,
    currencyCode,
  }

  return (
    <div className="bg-ivory-bg min-h-screen">
      <div className="w-full max-w-[1360px] mx-auto px-2 min-[340px]:px-3 min-[550px]:px-4 sm:px-6 md:px-8 min-[768px]:px-8 min-[1023px]:px-8 py-4 min-[340px]:py-5 min-[550px]:py-6 sm:py-6 md:py-6">
        {/* Breadcrumb */}
        <div className="mb-4 text-xs min-[400px]:text-sm text-gray-600 flex items-center gap-1.5 px-0.5">
          <span className="hover:text-gold-accent transition-colors cursor-pointer">Home</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-bold">Shop</span>
        </div>

        <div
          className="flex flex-col lg:flex-row gap-4 min-[340px]:gap-5 min-[550px]:gap-6 md:gap-8 min-[768px]:gap-8 min-[1023px]:gap-8"
          data-testid="category-container"
        >
          {/* Side Section - Filters (Independent scroll) - Hidden on mobile */}
          <aside className="hidden lg:block lg:w-72 flex-shrink-0 lg:sticky lg:top-24 lg:h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar pr-2">
            <style dangerouslySetInnerHTML={{
              __html: `
              .custom-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .custom-scrollbar {
                -ms-overflow-style: none;  /* IE and Edge */
                scrollbar-width: none;  /* Firefox */
              }
            `}} />
            <RefinementList {...filterProps} />
          </aside>

          {/* Right Section - Products */}
          <div className="flex-1 min-w-0">
            {q && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 text-sm">Search results for:</span>
                  <span className="text-gray-900 font-bold text-lg italic">"{q}"</span>
                </div>
                <LocalizedClientLink
                  href="/store"
                  className="text-sm font-medium text-gold-accent hover:text-royal-blue bg-white px-4 py-2 rounded-full border border-gold-accent/10 shadow-sm transition-all hover:shadow-md text-center"
                >
                  Clear search
                </LocalizedClientLink>
              </div>
            )}
            <Suspense fallback={<SkeletonProductGrid />}>
              <PaginatedProducts
                sortBy={sort}
                page={pageNumber}
                countryCode={countryCode}
                collectionId={Array.isArray(collection) ? collection.join(',') : collection}
                categoryId={Array.isArray(category) ? category.join(',') : category}
                gender={Array.isArray(gender) ? gender.join(',') : gender}
                type={Array.isArray(type) ? type.join(',') : type}
                material={Array.isArray(material) ? material.join(',') : material}
                color={Array.isArray(color) ? color.join(',') : color}
                min_price={minPrice}
                max_price={maxPrice}
                q={q}
                filterProps={filterProps}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
