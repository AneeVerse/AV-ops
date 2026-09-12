"use client"

import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

type NewArrivalsProps = {
  products: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
  ratings?: any[]
}

const NewArrivals = ({ products, region, ratings }: NewArrivalsProps) => {
  const safeProducts = (products || []).slice(0, 8) // Show only first 8 products

  return (
    <div className="w-full py-12 sm:py-16 md:py-24 bg-[#F7F3EA]">
      <div className="content-container">
        <div className="section-header">
          <h2 className="section-header-title">New Arrivals</h2>
          <div className="section-header-divider" />
          <p className="section-header-desc">
            Discover our latest moissanite pieces, freshly crafted in 925 sterling silver.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 justify-items-center">
            {safeProducts.length > 0 ? (
              safeProducts.map((product) => (
                <ProductPreview
                  key={product.id}
                  product={product}
                  region={region}
                  rating={ratings?.find((r) => r.product_id === product.id)}
                />
              ))
            ) : (
              <div className="col-span-2 md:col-span-4 text-center py-12">
                <p className="text-gray-500">No new arrivals at the moment. Check back soon!</p>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

export default NewArrivals
