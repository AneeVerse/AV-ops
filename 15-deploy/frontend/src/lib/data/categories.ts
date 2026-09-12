import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, any>) => {
  try {
    const next = {
      ...(await getCacheOptions("categories")),
    }

    const limit = query?.limit || 100

    return sdk.client
      .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
        "/store/product-categories",
        {
          query: {
            fields:
              "+metadata,*category_children, *products, *parent_category, *parent_category.parent_category",
            limit,
            ...query,
          },
          next: {
            ...next,
            revalidate: 0,
          },
          cache: "no-store",
        }
      )
      .then(({ product_categories }) => product_categories)
      .catch((error) => {
        if (process.env.NODE_ENV === 'production' || process.env.CI) {
          return []
        }
        throw error
      })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production' || process.env.CI) {
      return []
    }
    throw error
  }
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  try {
    const handle = `${categoryHandle.join("/")}`
    const decodedHandle = decodeURIComponent(handle)


    const next = {
      ...(await getCacheOptions("categories")),
    }

    const result = await sdk.client
      .fetch<HttpTypes.StoreProductCategoryListResponse>(
        `/store/product-categories`,
        {
          query: {
            handle: [decodedHandle],
          },
          next: {
            ...next,
            revalidate: 0,
          },
          cache: "no-store",
        }
      )

    if (result.product_categories && result.product_categories.length > 0) {
      return result.product_categories[0]
    }

    // Fallback: Fetch all categories and find manually

    const allCategories = await listCategories({ limit: "200" })
    const matchedCategory = allCategories.find(c =>
      c.handle === decodedHandle ||
      c.handle === handle ||
      c.handle?.replace(/-/g, " ") === decodedHandle
    )

    if (matchedCategory) {

      return matchedCategory
    }


    return null
  } catch (error: any) {

    return null
  }
}
