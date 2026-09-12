import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"
import { useSecureCookies } from "@lib/util/env"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "in"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
    )
  }

  try {
    if (
      !regionMap.keys().next().value ||
      regionMapUpdated < Date.now() - 3600 * 1000
    ) {
      // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
      const { regions } = await fetch(`${BACKEND_URL}/store/regions`, {
        headers: {
          "x-publishable-api-key": PUBLISHABLE_API_KEY!,
        },
        next: {
          revalidate: 3600,
          tags: [`regions-${cacheId}`],
        },
        cache: "force-cache",
      }).then(async (response) => {
        const json = await response.json()

        if (!response.ok) {
          throw new Error(json.message)
        }

        return json
      })

      if (!regions?.length) {
        throw new Error(
          "No regions found. Please set up regions in your Medusa Admin."
        )
      }

      // Create a map of country codes to regions.
      regions.forEach((region: HttpTypes.StoreRegion) => {
        region.countries?.forEach((c) => {
          regionMapCache.regionMap.set(c.iso_2 ?? "", region)
        })
      })

      // Ensure 'in', 'us' and common international codes are registered
      if (!regionMapCache.regionMap.has("in")) {
        const inRegion = (regions.find((r: any) => r.currency_code === "inr" || r.name?.toLowerCase().includes("india")) || regions[0] || { id: "reg_in", name: "India", currency_code: "inr" }) as any
        regionMapCache.regionMap.set("in", inRegion)
      }
      if (!regionMapCache.regionMap.has("us")) {
        const usRegion = (regions.find((r: any) => r.currency_code === "usd" || r.name?.toLowerCase().includes("united states")) || regions[0] || { id: "reg_us", name: "United States" }) as any
        regionMapCache.regionMap.set("us", usRegion)
        regionMapCache.regionMap.set("ca", usRegion)
        regionMapCache.regionMap.set("gb", usRegion)
      }

      regionMapCache.regionMapUpdated = Date.now()
    }
  } catch (err: any) {
    console.warn("Middleware failed to fetch regions from backend. Error:", err?.message || err)
    
    // Clear and set fallback regions for India & US / International
    const fallbackRegionIN = {
      id: "reg_in",
      name: "India",
      currency_code: "inr",
      countries: [{ id: 1, iso_2: "in", name: "India", display_name: "India" }]
    } as any
    const fallbackRegionUS = {
      id: "reg_us",
      name: "United States",
      currency_code: "usd",
      countries: [{ id: 2, iso_2: "us", name: "United States", display_name: "United States" }]
    } as any
    
    regionMapCache.regionMap.clear()
    regionMapCache.regionMap.set("in", fallbackRegionIN)
    regionMapCache.regionMap.set("us", fallbackRegionUS)
    regionMapCache.regionMap.set("ca", fallbackRegionUS)
    regionMapCache.regionMap.set("gb", fallbackRegionUS)
    regionMapCache.regionMap.set("au", fallbackRegionUS)
    regionMapCache.regionMap.set("de", fallbackRegionUS)
    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/** In-memory IP → country cache (middleware isolate). */
const ipCountryCache = new Map<string, { code: string | null; expires: number }>()

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()
  const ip = forwarded || realIp || null

  if (!ip) {
    return null
  }

  // Skip loopback / private IPs (local curl, Docker, etc.)
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  ) {
    return null
  }

  return ip
}

function getCountryFromHeaders(request: NextRequest): string | undefined {
  // Only trust geo headers set by CDNs/proxies (not client-spoofable custom headers).
  const candidates = [
    request.headers.get("cf-ipcountry"),
    request.headers.get("cloudfront-viewer-country"),
    request.headers.get("x-vercel-ip-country"),
  ]

  for (const raw of candidates) {
    const code = raw?.trim().toLowerCase()
    // Cloudflare uses XX / T1 for unknown / Tor
    if (code && /^[a-z]{2}$/.test(code) && code !== "xx" && code !== "t1") {
      return code
    }
  }

  return undefined
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  const cached = ipCountryCache.get(ip)
  if (cached && cached.expires > Date.now()) {
    return cached.code
  }

  let code: string | null = null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 900)
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    )
    clearTimeout(timer)

    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean
        country_code?: string
      }
      if (data?.success && typeof data.country_code === "string") {
        code = data.country_code.toLowerCase()
      }
    }
  } catch {
    // Geo lookup is best-effort — fall through to URL / default region.
  }

  ipCountryCache.set(ip, { code, expires: Date.now() + 1000 * 60 * 60 * 6 })
  if (ipCountryCache.size > 5000) {
    const oldest = ipCountryCache.keys().next().value
    if (oldest) {
      ipCountryCache.delete(oldest)
    }
  }

  return code
}

/**
 * Resolve shop country:
 * 1) Country already in the URL
 * 2) Manual preference cookie
 * 3) CDN / proxy geo headers
 * 4) IP geolocation
 * 5) DEFAULT_REGION (India / "in")
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()
    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      return urlCountryCode
    }

    const manualPref = request.cookies
      .get("_medusa_region_pref")
      ?.value?.toLowerCase()
    if (manualPref && regionMap.has(manualPref)) {
      return manualPref
    }

    const headerCountry = getCountryFromHeaders(request)
    if (headerCountry && regionMap.has(headerCountry)) {
      return headerCountry
    }

    const ip = getClientIp(request)
    if (ip) {
      const ipCountry = await lookupCountryByIp(ip)
      if (ipCountry && regionMap.has(ipCountry)) {
        return ipCountry
      }
    }

    if (regionMap.has(DEFAULT_REGION)) {
      return DEFAULT_REGION
    }

    return "in"
  } catch (error) {
    // Silence error for production
  }
}

/**
 * Middleware to handle region selection and onboarding status.
 */
/**
 * Middleware to handle region selection and onboarding status.
 */
async function handleRegions(request: NextRequest) {
  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)

  // Ensure 'in' is ALWAYS registered in regionMap
  if (!regionMap.has("in")) {
    const defaultRegion = regionMap.values().next().value || { id: "reg_in", name: "India", currency_code: "inr" }
    regionMap.set("in", defaultRegion)
  }

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const pathname = request.nextUrl.pathname

  // Handle auth routes (OAuth callbacks) FIRST - before country code checks
  // This ensures /{countryCode}/auth/... routes are handled correctly

  // Redirect /{countryCode}/auth/... to /auth/... (for Google OAuth callbacks)
  // This must happen BEFORE urlHasCountryCode check to prevent early return
  const pathParts = pathname.split('/').filter(Boolean)
  if (pathParts.length >= 2 && pathParts[1] === 'auth') {
    // Check if first part is a country code (2-3 letters)
    if (/^[a-z]{2,3}$/i.test(pathParts[0])) {
      // Remove country code and redirect to /auth/... preserving query params
      const newPath = '/' + pathParts.slice(1).join('/')
      const newUrl = new URL(request.nextUrl)
      newUrl.pathname = newPath
      // Preserve all query parameters
      return NextResponse.redirect(newUrl, 307)
    }
  }

  // Skip middleware for auth routes (OAuth callbacks) without country code
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next()
  }

  // check if the url is a static asset
  if (pathname.includes(".")) {
    return NextResponse.next()
  }

  const pathCountry = pathname.split("/")[1]?.toLowerCase()
  const pathHasValidCountry = !!(pathCountry && regionMap.has(pathCountry))
  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  const urlHasCountryCode =
    !!(countryCode && pathHasValidCountry && pathCountry === countryCode) || pathHasValidCountry

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  // if one of the country codes is in the url and the cache id is not set, set the cache id and redirect
  if (urlHasCountryCode && !cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return response
  }

  const redirectPath = pathname === "/" ? "" : pathname

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    // Avoid /us/in/... when path already starts with a different country segment
    // that somehow wasn't in regionMap; strip unknown 2-letter prefix.
    let pathForRedirect = redirectPath
    if (
      pathCountry &&
      /^[a-z]{2}$/.test(pathCountry) &&
      !regionMap.has(pathCountry)
    ) {
      pathForRedirect = "/" + pathname.split("/").slice(2).join("/")
      if (pathForRedirect === "/") {
        pathForRedirect = ""
      }
    }

    redirectUrl = `${request.nextUrl.origin}/${countryCode}${pathForRedirect}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })
  } else if (!urlHasCountryCode && !countryCode) {
    // Handle case where no valid country code exists (empty regions)
    return new NextResponse(
      "No valid regions configured. Please set up regions with countries in your Medusa Admin.",
      { status: 500 }
    )
  }

  return response
}

export async function middleware(request: NextRequest) {
  const response = await handleRegions(request)
  const pathname = request.nextUrl.pathname

  // Skip sync for static assets and API routes
  if (pathname.includes(".") || pathname.startsWith("/api")) {
    return response
  }

  // --- Cart Sync Logic (Sync on Refresh) ---
  const authToken = request.cookies.get("_medusa_jwt")?.value
  const cartId = request.cookies.get("_medusa_cart_id")?.value
  const syncLock = request.cookies.get("_medusa_cart_synced")?.value
  
  const isPageRequest = request.headers.get("accept")?.includes("text/html")
  const buyNowCartId = request.cookies.get("buy_now_cart_id")?.value
  let activeCartIdFromSync = null
  let isTokenExpired = false

  const isBuyNowPath = pathname.includes("/checkout")
  
  // Run sync if we have a token and it's a page request
  if (authToken && !syncLock && isPageRequest && !pathname.includes(".")) {
    try {
      const syncRes = await fetch(`${BACKEND_URL}/store/carts/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_API_KEY!,
          Authorization: `Bearer ${authToken}`,
        },
        ...(cartId ? { body: JSON.stringify({ cart_id: cartId }) } : {}),
        cache: "no-store",
      })

      if (syncRes.ok) {
        const data = await syncRes.json()
        console.log("--- Middleware Sync Response (JSON) ---")
        console.log(JSON.stringify(data, null, 2))
        console.log("---------------------------------------")
        
        activeCartIdFromSync = data.cart?.id || data.id || data.cart_id
      } else if (syncRes.status === 401 || syncRes.status === 403) {
        isTokenExpired = true
      }
    } catch (error) {
      console.error("Middleware Cart Sync Error:", error)
    }
  }

  // Prepare the response
  let finalResponse = response

  if (response.status !== 307 && response.status !== 308 && response.status !== 302) {
    // If we have a new cart ID, we MUST inject it into request headers for the current render
    const updatedHeaders = new Headers(request.headers)
    // Only inject x-cart-id if we're not in a Buy Now flow on checkout
    if (activeCartIdFromSync && !(buyNowCartId && isBuyNowPath)) {
      updatedHeaders.set("x-cart-id", activeCartIdFromSync)
    }

    // Pass the pathname down so server components can know where they are
    updatedHeaders.set("x-pathname", pathname)

    finalResponse = NextResponse.next({
      request: {
        headers: updatedHeaders,
      },
    })
  }

  // Clear buy_now_cart_id if we are navigating anywhere EXCEPT checkout
  // Clear buy_now_cart_id if we are navigating anywhere EXCEPT checkout (Only for main page requests)
  if (isPageRequest && buyNowCartId && !pathname.includes("/checkout")) {
    finalResponse.cookies.set("buy_now_cart_id", "", { maxAge: -1, path: "/" })
  }

  // Now set the cookies on the FINAL response object
  if (activeCartIdFromSync) {
    finalResponse.cookies.set("_medusa_cart_id", activeCartIdFromSync, {
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies(),
      path: "/",
    })
  }
  
  if (activeCartIdFromSync || (authToken && !syncLock && isPageRequest)) {
    // SET LOCK: Don't sync again for 10 seconds to prevent loops
    finalResponse.cookies.set("_medusa_cart_synced", "true", { 
      maxAge: 10,
      path: "/",
    })
  }

  if (isTokenExpired) {
    finalResponse.cookies.set("_medusa_jwt", "", { maxAge: -1, path: "/" })
  }

  return finalResponse
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
