"use client"

import { useProductListing } from "medusa-product-library"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import StoreHeader from "@modules/store/components/store-header"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

export const ClientPaginatedProductsInner = ({
  sortBy,
  initialPage,
  collectionId,
  categoryId,
  productsIds,
  gender,
  type,
  material,
  color,
  min_price,
  max_price,
  q,
  region,
}: {
  sortBy?: string
  initialPage?: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  gender?: string
  type?: string
  material?: string
  color?: string
  min_price?: string
  max_price?: string
  q?: string
  region: any
}) => {
  // ALL pagination state managed by library
  const {
    products,
    count,
    isLoading,
    totalPages,
    currentPage,
    pageNumbers,
    setPage,
    hasNext,
    hasPrev,
  } = useProductListing({
    sortBy,
    initialPage: initialPage ?? 1,
    limit: PRODUCT_LIMIT,
    collectionId,
    categoryId,
    gender,
    type,
    material,
    color,
    minPrice: min_price,
    maxPrice: max_price,
    q,
  })

  return (
    <>
      <StoreHeader sortBy={(sortBy || "created_at") as SortOptions} productCount={count} q={q} />
      {isLoading ? (
        <div className="w-full flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <ul
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 min-[400px]:gap-4 md:gap-6"
          data-testid="products-list"
        >
          {products.map((p) => (
            <li key={p.id} className="w-full flex justify-center">
              <ProductPreview product={p as any} region={region} />
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="mt-8">
          {/* Cultura Jewels designs this Pagination UI, library provides the data */}
          <Pagination
            data-testid="product-pagination"
            page={currentPage}
            totalPages={totalPages}
            pageNumbers={pageNumbers}
            onPageChange={setPage}
            hasNext={hasNext}
            hasPrev={hasPrev}
          />
        </div>
      )}
    </>
  )
}


export default function ClientPaginatedProducts(props: any) {
  return (
    <ClientPaginatedProductsInner {...props} />
  )
}
