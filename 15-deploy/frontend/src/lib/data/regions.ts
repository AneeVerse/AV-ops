"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  const headers: Record<string, string> = {}
  if (publishableKey) {
    headers["x-publishable-api-key"] = publishableKey
  }

  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      headers,
      next,
      // Regions change when admins add US/EU — avoid stale country maps.
      cache: "no-store",
    })
    .then(({ regions }) => regions)
    .catch((err: any) => {
      console.warn("Medusa backend is offline or returned error. Returning default region fallback:", err?.message || err);
      return [
        {
          id: "reg_01KWMCPR719HTN620FVQNAW7FZ",
          name: "India",
          currency_code: "inr",
          countries: [
            {
              id: 1,
              iso_2: "in",
              name: "India",
              display_name: "India"
            }
          ]
        }
      ] as any
    })
}


export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async (countryCode: string) => {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode)
    }

    const regions = await listRegions()

    if (!regions) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    const region = countryCode
      ? (regionMap.get(countryCode) || regionMap.get("in") || regions[0])
      : (regionMap.get("in") || regionMap.get("us") || regions[0])

    return region
  } catch (e: any) {
    return null
  }
}
