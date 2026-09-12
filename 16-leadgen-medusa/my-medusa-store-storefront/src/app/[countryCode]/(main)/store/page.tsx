import { Metadata } from "next"

import { listCollections } from "@lib/data/collections"
import { getDynamicFilters } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { getRegion } from "@lib/data/regions"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Shop All Products",
  description: "Browse Cultura Jewels's complete collection of premium moissanite jewelry. Perfect styles for all ages, from age-specific groups to category favorites.",
}

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    collection?: string | string[]
    category?: string | string[]
    gender?: string | string[]
    type?: string | string[]
    material?: string | string[]
    color?: string | string[]
    min_price?: string
    max_price?: string
    q?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page, collection, category, gender, type, material, color, min_price, max_price, q } = searchParams

  const [collectionsRes, categoriesRes, dynamicFiltersRes, regionRes] = await Promise.all([
    listCollections().catch(() => ({ collections: [], count: 0 })),
    listCategories().catch(() => []),
    getDynamicFilters(params.countryCode).catch(() => ({ genders: [], productTypes: [], materials: [], colors: [] })),
    getRegion(params.countryCode).catch(() => null),
  ])

  const collections = collectionsRes?.collections || []
  const categories = Array.isArray(categoriesRes) ? categoriesRes : []
  const dynamicFilters = dynamicFiltersRes || { genders: [], productTypes: [], materials: [], colors: [] }
  const region = regionRes

  // Filter for top-level categories or all for now
  const categoryOptions = categories.map(c => ({
    value: c.id,
    label: c.name || ""
  }))

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      collections={collections}
      collection={collection}
      category={category}
      categoryOptions={categoryOptions}
      gender={gender}
      type={type}
      material={material}
      color={color}
      minPrice={min_price}
      maxPrice={max_price}
      genderOptions={dynamicFilters.genders}
      typeOptions={dynamicFilters.productTypes}
      materialOptions={dynamicFilters.materials}
      colorOptions={dynamicFilters.colors}
      q={q}
      currencyCode={region?.currency_code}
    />
  )
}
