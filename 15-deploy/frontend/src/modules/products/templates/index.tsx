import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import Breadcrumb from "@modules/common/components/breadcrumb"

import ProductActionsWrapper from "./product-actions-wrapper"
import { ProductProvider } from "@modules/products/context/product-context"
import ProductViewTracker from "@modules/products/components/product-view-tracker"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
  selectedVariantId?: string | null
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
  selectedVariantId,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      <div className="bg-ivory-bg min-h-screen pb-20 lg:pb-0">
        <ProductProvider>
          <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 min-[768px]:px-6 min-[1023px]:px-6 min-[1200px]:px-8 min-[1360px]:px-8 py-4 sm:py-6 min-[768px]:py-6 min-[1023px]:py-6 min-[1360px]:py-6">
            {/* Breadcrumb */}
            <Breadcrumb product={product} />

            {/* Main Product Layout */}
            <div
              className="flex flex-col min-[1024px]:flex-row gap-4 sm:gap-5 min-[768px]:gap-5 min-[1023px]:gap-5 min-[1024px]:gap-8 min-[1200px]:gap-10 min-[1360px]:gap-12 mt-4 sm:mt-6 min-[768px]:mt-5 min-[1023px]:mt-5 min-[1024px]:mt-6 min-[1360px]:mt-6"
              data-testid="product-container"
            >
              {/* Left Side - Image Gallery */}
              <div id="product-gallery-container" className="w-full min-[1024px]:w-auto min-[1024px]:max-w-[725px] min-[1024px]:sticky min-[1024px]:top-[100px] min-[1024px]:max-h-[calc(100vh-100px)] min-[1024px]:overflow-y-auto min-[1024px]:[&::-webkit-scrollbar]:hidden min-[1024px]:self-start">
                <ImageGallery images={images} product={product} />
              </div>

              {/* Right Side - Product Information */}
              <div className="w-full min-[1024px]:flex-1 flex flex-col">
                <div className="w-full flex flex-col gap-2 sm:gap-3">
                  <ProductInfo product={product} region={region} />
                  <Suspense
                    fallback={
                      <ProductActions
                        disabled={true}
                        product={product}
                        region={region}
                      />
                    }
                  >
                    <ProductActionsWrapper id={product.id} region={region} />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </ProductProvider>
      </div>

      {/* Why Choose Moissanite Diamond Section */}
      <div className="w-full bg-white pt-12 sm:pt-16 pb-0 border-t border-gray-100">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-[38px] font-serif text-gray-900 mb-2 tracking-wide font-medium">
              Why Choose Moissanite Diamond?
            </h2>
            <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 font-medium tracking-wide">
              Discover 4 reasons to pick Moissanite Diamond
            </p>
          </div>

          {/* Grid Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 mb-10 sm:mb-12">
            {/* Card 1 */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50 shadow-sm hover:shadow-md transition-all duration-300">
              <img
                src="/product-page/Diamond_Tester_1.gif"
                alt="Diamond Tester"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Card 2 */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50 shadow-sm hover:shadow-md transition-all duration-300">
              <img
                src="/product-page/Diamond_as_Hardness_1.gif"
                alt="Same As Diamond Hardness"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Card 3 */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50 shadow-sm hover:shadow-md transition-all duration-300">
              <img
                src="/product-page/DIAMOND_MOISSANITE_CUBIC_ZIRCON.jpg"
                alt="Cubic Zirconia | Diamond | Moissanite"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Card 4 */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50 shadow-sm hover:shadow-md transition-all duration-300">
              <img
                src="/product-page/MOISSANITE_VS_DIAMOND.jpg"
                alt="Diamond VS Moissanite"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Auto Scrolling Banner */}
        <div className="bg-royal-blue text-white py-3 md:py-3.5 overflow-hidden select-none w-full border-y border-white/5">
          <div className="flex animate-marquee whitespace-nowrap w-max">
            <div className="flex items-center font-semibold">
              {[
                "Quality Control & Assurance",
                "Bespoke Experience",
                "Personalized Jewelry, Made for You",
                "Fast & Secure Shipping",
                "Quality Control & Assurance",
                "Fast & Secure Shipping",
                "Quality Control & Assurance"
              ].map((item, idx) => (
                <React.Fragment key={idx}>
                  <span 
                    className="unique-announcement text-white select-none"
                    style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '12px', margin: "0 20px" }}
                  >
                    {item}
                  </span>
                  <span 
                    className="unique-dot-separator text-white select-none text-[20px] leading-none align-middle" 
                    style={{ fontFamily: '"IBM Plex Sans", sans-serif', margin: "0 10px" }}
                  >
                    •
                  </span>
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center font-semibold" aria-hidden="true">
              {[
                "Quality Control & Assurance",
                "Bespoke Experience",
                "Personalized Jewelry, Made for You",
                "Fast & Secure Shipping",
                "Quality Control & Assurance",
                "Fast & Secure Shipping",
                "Quality Control & Assurance"
              ].map((item, idx) => (
                <React.Fragment key={`dup-${idx}`}>
                  <span 
                    className="unique-announcement text-white select-none"
                    style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '12px', margin: "0 20px" }}
                  >
                    {item}
                  </span>
                  <span 
                    className="unique-dot-separator text-white select-none text-[20px] leading-none align-middle" 
                    style={{ fontFamily: '"IBM Plex Sans", sans-serif', margin: "0 10px" }}
                  >
                    •
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        id="related-products"
        className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 min-[768px]:px-6 md:px-8 mt-4 sm:mt-6 md:mt-8 mb-8 sm:mb-12 min-[768px]:mb-12 md:mb-16 lg:mb-32 scroll-mt-[120px]"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
