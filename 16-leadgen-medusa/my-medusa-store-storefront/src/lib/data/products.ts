"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"
import Color from "color"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {


  if (!countryCode && !regionId) {

    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {

    region = await getRegion(countryCode)
  } else {

    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }



  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  // 1. Standard Medusa query parameters
  const standardQuery: any = {
    limit,
    offset,
    region_id: region?.id,
    fields:
      "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+variants.metadata,+variants.options,+metadata,+tags,+average_rating,+total_rating_count,+total_rating_sum,+categories,+categories.metadata",
  }

  // 2. Identify advanced filters that require the product-helper API
  const advancedFilterKeys = [
    "metadata", "min_price", "max_price", "q", "collection_id", "category_id",
    "tags", "option_value", "gender", "color", "material", "style", "brand",
    "type", "product_type", "order"
  ]

  const hasAdvancedFilters = !!(queryParams && Object.keys(queryParams).some(key =>
    advancedFilterKeys.includes(key) && (queryParams as any)[key] !== undefined
  ))

  const endpoint = hasAdvancedFilters ? "/store/product-helper/products" : "/store/products";

  let finalQuery: any = { ...standardQuery }

  if (hasAdvancedFilters) {


    // We use URLSearchParams to ensure correct formatting and handle repeated keys if needed
    const params = new URLSearchParams()

    // 1. Add standard params
    params.append("limit", limit.toString())
    params.append("offset", offset.toString())
    if (region?.id) params.append("region_id", region.id)

    // Use '*' for helper endpoint to let it resolve necessary relations
    params.append("fields", "*")

    // 2. Map queryParams
    for (const [key, value] of Object.entries(queryParams || {})) {
      if (["metadata", "min_price", "max_price", "limit", "offset", "region_id", "fields"].includes(key)) continue

      const values = Array.isArray(value) ? value : [value]
      const lowerKey = key.toLowerCase()

      if (lowerKey === "color") {
        // Map 'color' filter to 'option_value' which backend understands for variants
        values.forEach(v => params.append("option_value[]", String(v)))
      } else if (["material", "gender", "product_type", "type", "style", "brand"].includes(lowerKey)) {
        // Map these to metadata as they are defined as metadata in your config
        const metaKey = lowerKey === "type" ? "product_type" : lowerKey
        values.forEach(v => params.append(`metadata[${metaKey}]`, String(v)))
      } else {
        // Standard mapping for others (tags, collection_id, etc.)
        if (Array.isArray(value)) {
          value.forEach(v => params.append(`${key}[]`, String(v)))
        } else if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      }
    }

    // 3. Map price filters (min_price -> price_min, max_price -> price_max)
    if ((queryParams as any).min_price) params.append("price_min", String((queryParams as any).min_price))
    if ((queryParams as any).max_price) params.append("price_max", String((queryParams as any).max_price))

    // 4. Map metadata filters to metadata[key] format
    if ((queryParams as any).metadata) {
      for (const [key, value] of Object.entries((queryParams as any).metadata)) {
        const values = Array.isArray(value) ? value : [value]

        values.forEach(v => {
          if (key.toLowerCase() === "color") {
            // Map color in metadata to option_value[]
            params.append("option_value[]", String(v))
          } else {
            // Standard metadata format: metadata[key]=value
            params.append(`metadata[${key}]`, String(v))
          }
        })
      }
    }

    finalQuery = params

  } else {
    // Standard endpoint - only merge known safe Medusa keys from queryParams 
    // to avoid "Unrecognized fields" errors
    const safeKeys = ["order", "id", "handle", "status", "created_at", "updated_at", "type_id"]
    for (const key of safeKeys) {
      if (queryParams && (queryParams as any)[key]) {
        finalQuery[key] = (queryParams as any)[key]
      }
    }
  }

  // Use the appended query string to avoid SDK's default serialization issues with brackets
  const requestUrl = hasAdvancedFilters ? `${endpoint}?${finalQuery.toString()}` : endpoint;

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      requestUrl,
      {
        method: "GET",
        query: hasAdvancedFilters ? undefined : finalQuery,
        headers,
        next: {
          ...next,
          revalidate: 0, // Disable Next.js cache for now to show logs
        },
        cache: "no-store", // Ensure it hits backend every time for testing
      }
    )
    .then(({ products, count }) => {


      const nextPage = count > offset + limit ? _pageParam + 1 : null

      if (products && products.length > 0) {

      }

      return {
        response: {
          products: products || [],
          count: count || 0,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
    .catch((error) => {
      console.error("listProducts error:", error?.message || error)
      return {
        response: {
          products: [],
          count: 0,
        },
        nextPage: null,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 1,
  queryParams,
  sortBy = "created_at_desc",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  const orderBySort: Partial<Record<SortOptions, string>> = {
    created_at: "-created_at",
    created_at_desc: "-created_at",
    created_at_asc: "created_at",
    price_asc: "variants.calculated_price",
    price_desc: "-variants.calculated_price",
  }

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: page,
    queryParams: {
      ...queryParams,
      limit,
      ...(orderBySort[sortBy] ? { order: orderBySort[sortBy] } : {}),
    },
    countryCode,
  })

  // Client sort as a safety net when the API ignores `order`
  const finalProducts = sortProducts(products, sortBy)

  const nextPage = count > page * limit ? page + 1 : null

  return {
    response: {
      products: finalProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Fetch products that have a specific tag value
 */
export async function getProductsByTag({
  tagValue,
  limit = 12,
  countryCode,
}: {
  tagValue: string
  limit?: number
  countryCode: string
}) {
  try {
    const result = await listProducts({
      queryParams: { tags: [tagValue], limit },
      countryCode,
    })

    return result.response.products
  } catch (error) {
    console.error("Error fetching products by tag:", error)
    return []
  }
}

/**
 * Fetch dynamic filter options from the backend API
 */
export const getDynamicFilters = async (countryCode: string) => {
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    if (!publishableKey) return { genders: [], productTypes: [], materials: [], colors: [] }

    const response = await fetch(`${backendUrl}/store/product-helper/filters`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return { genders: [], productTypes: [], materials: [], colors: [] }
    }

    const data = await response.json()
    
    const formatLabel = (str: string) => {
      return str
        .split(/[_-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }

    const metadata = data.metadata || {}
    const variantOptions = data.variant_options || []

    // Gather all unique colors from all possible sources
    const colorSet = new Set<string>()
    
    // 1. From variant options (check all options with title 'color')
    variantOptions.forEach((o: any) => {
      if (o.option_title.toLowerCase() === 'color' || o.option_title.toLowerCase() === 'colour') {
        o.values?.forEach((v: string) => {
          if (v) colorSet.add(v.trim().toLowerCase())
        })
      }
    })

    // 2. From metadata colors (handle newline/comma separated values)
    if (metadata.color) {
      metadata.color.forEach((c: string) => {
        if (c) {
          const parts = c.split(/[,/\n\r]+/).map(s => s.trim()).filter(Boolean)
          parts.forEach(p => colorSet.add(p.toLowerCase()))
        }
      })
    }

    return {
      genders: (metadata.gender || []).sort().map((g: string) => ({
        value: g,
        label: formatLabel(g)
      })),
      productTypes: (data.product_types || []).sort((a: any, b: any) => a.label.localeCompare(b.label)).map((t: any) => ({
        value: t.label,
        label: formatLabel(t.label)
      })),
      materials: (metadata.material || []).sort().map((m: string) => ({
        value: m,
        label: formatLabel(m)
      })),
      colors: Array.from(colorSet).sort().map((c: string) => {
        let hex = ""
        try {
          // Try to resolve color hex code using the Color library
          hex = Color(c.replace(/\s+/g, '').toLowerCase()).hex()
        } catch (e) {
          try {
            hex = Color(c.toLowerCase()).hex()
          } catch (e2) {
            // No hex found
          }
        }
        return {
          value: c,
          label: formatLabel(c),
          hex
        }
      })
    }
  } catch (error) {
    console.error("Error fetching dynamic filters:", error)
    return { genders: [], productTypes: [], materials: [], colors: [] }
  }
}

/**
 * Fetch a single product by its handle
 */
export async function getProductByHandle(handle: string) {
  const result = await sdk.store.product.list(
    { handle, fields: "*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder,*variants.options,*options,*options.values,*images,*thumbnail,+metadata" },
    { next: { tags: ["products"] } }
  )
  
  return result.products[0]
}

const HERO_PRODUCT_HANDLES = ["auric-flow", "infinite-glow"]

/**
 * Hero carousel products (Auric Flow, Infinite Glow, etc.)
 */
export async function getHeroProducts(countryCode: string) {
  try {
    const region = await getRegion(countryCode)
    if (!region) return []

    const headers = { ...(await getAuthHeaders()) }
    const next = { ...(await getCacheOptions("products")) }

    const result = await sdk.store.product.list(
      {
        handle: HERO_PRODUCT_HANDLES,
        limit: HERO_PRODUCT_HANDLES.length,
        region_id: region.id,
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*images,*thumbnail,+metadata",
      },
      { ...next, headers }
    )

    const byHandle = new Map(
      (result.products || []).map((p) => [p.handle, p])
    )

    return HERO_PRODUCT_HANDLES.map((handle) => byHandle.get(handle)).filter(
      Boolean
    ) as HttpTypes.StoreProduct[]
  } catch (error) {
    console.error("Error fetching hero products:", error)
    return []
  }
}
