import { listProductsWithSort, getProductsByTag } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getWishlistProductIds } from "@lib/data/wishlist"
import { fetchRatings } from "@lib/data/reviews"
import ProductPreview from "@modules/products/components/product-preview"
import ProductListViewTracker from "@modules/store/components/product-list-view-tracker"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreHeader from "@modules/store/components/store-header"
import { HttpTypes } from "@medusajs/types"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  gender,
  type,
  material,
  color,
  min_price,
  max_price,
  q,
  filterProps,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  gender?: string
  type?: string
  material?: string
  color?: string
  min_price?: string
  max_price?: string
  q?: string
  filterProps?: any
}) {
  const queryParams: any = {
    limit: 12,
  }

  if (q) {
    queryParams["q"] = q
  }

  if (collectionId) {
    queryParams["collection_id"] = collectionId
  }

  if (categoryId) {
    queryParams["category_id"] = categoryId
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy && sortBy !== "bestsellers") {
    if (sortBy === "created_at") {
      queryParams["order"] = "created_at_desc" // Fallback to newest if old URL is hit
    } else {
      queryParams["order"] = sortBy
    }
  }

  if (gender) {
    queryParams["gender"] = gender
  }
  if (type) {
    queryParams["type"] = type
  }
  if (material) {
    queryParams["material"] = material
  }
  if (color) {
    queryParams["color"] = color
  }

  // Handle Price filtering
  if (min_price) {
    queryParams["min_price"] = min_price
    queryParams["price_min"] = min_price
  }
  if (max_price) {
    queryParams["max_price"] = max_price
    queryParams["price_max"] = max_price
  }

  // Fetch common data in parallel to save time
  const [region, wishlistProductIds, allRatings] = await Promise.all([
    getRegion(countryCode).catch(() => null),
    getWishlistProductIds().catch(() => []),
    fetchRatings().catch(() => [])
  ])

  if (!region) {
    return null
  }

  let products: HttpTypes.StoreProduct[] = []
  let count = 0

  try {
    if (sortBy === "bestsellers") {
      const bestsellerProducts = await getProductsByTag({
        tagValue: "bestseller",
        limit: 12,
        countryCode,
      })
      products = bestsellerProducts
      count = bestsellerProducts.length
    } else {
      const result = await listProductsWithSort({
        page,
        queryParams: queryParams,
        sortBy,
        countryCode,
      })
      products = result.response.products
      count = result.response.count
    }
  } catch (error) {
    console.error("PaginatedProducts fetch error:", error)
    products = []
    count = 0
  }



  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      <ProductListViewTracker
        products={products}
        listId={collectionId ?? categoryId ?? "store"}
        listName={collectionId ? "Collection" : categoryId ? "Category" : "Store"}
      />
      <StoreHeader sortBy={sortBy || "created_at"} productCount={count} filterProps={filterProps} />
      <ul
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 min-[400px]:gap-4 md:gap-6"
        data-testid="products-list"
      >
        {products.map((p) => {
          const productRating = allRatings.find((r: any) => r.product_id === p.id)
          return (
            <li key={p.id} className="w-full flex justify-center">
              <ProductPreview 
                product={p} 
                region={region} 
                wishlistProductIds={wishlistProductIds} 
                rating={productRating}
              />
            </li>
          )
        })}
      </ul>
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            data-testid="product-pagination"
            page={page}
            totalPages={totalPages}
          />
        </div>
      )}
    </>
  )
}
