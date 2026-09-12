"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const retrieveCollection = async (id: string) => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  return sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      {
        next: {
          ...next,
          revalidate: 0,
        },
        cache: "no-store",
      }
    )
    .then(({ collection }) => collection)
}

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  try {
    const next = {
      ...(await getCacheOptions("collections")),
    }

    queryParams.limit = queryParams.limit || "100"
    queryParams.offset = queryParams.offset || "0"

    return sdk.client
      .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
        "/store/collections",
        {
          query: queryParams,
          next: {
            ...next,
            revalidate: 0,
          },
          cache: "no-store",
        }
      )
      .then(({ collections }) => ({ collections, count: collections.length }))
      .catch((error) => {
        if (process.env.NODE_ENV === 'production' || process.env.CI) {
          return { collections: [], count: 0 }
        }
        throw error
      })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production' || process.env.CI) {
      return { collections: [], count: 0 }
    }
    throw error
  }
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection | null> => {
  try {
    const next = {
      ...(await getCacheOptions("collections")),
    }

    // Ensure handle is decoded
    const decodedHandle = decodeURIComponent(handle)


    // Try array-based handle filter (standard for v2)
    const result = await sdk.client
      .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
        query: {
          handle: [decodedHandle],
        },
        next: {
          ...next,
          revalidate: 0,
        },
        cache: "no-store",
      })

    if (result.collections && result.collections.length > 0) {
      return result.collections[0]
    }

    // Fallback: Fetch all and find manually (useful for handles with spaces/special chars)

    const { collections } = await listCollections({ limit: "100" })
    const matchedCollection = collections.find(c =>
      c.handle === decodedHandle ||
      c.handle === handle ||
      c.handle?.replace(/-/g, " ") === decodedHandle
    )

    if (matchedCollection) {

      return matchedCollection
    }


    return null
  } catch (error: any) {

    return null
  }
}
