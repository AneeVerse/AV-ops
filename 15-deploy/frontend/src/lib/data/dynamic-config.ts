"use server"

import { cache } from "react"
import { getAuthHeaders } from "./cookies"

// Define the structure based on the actual API response and client usage
export interface DynamicConfig {
  "homepage-config"?: {
    logo?: string
    "homepage-banner-array"?: Array<{
      "homepage-banner"?: {
        "homepage-banner-image"?: string
        "homepage-banner-title"?: string
        "homepage-banner-subtitle"?: string
        "homepage-banner-description"?: string
        "homepage-banner-button-name"?: string
        "homepage-banner-button-link"?: string
      }
    }>
    "app-banner-array"?: Array<{
      "app-banner"?: {
        "app-banner-image"?: string
        "app-banner-title"?: string
        "app-banner-subtitle"?: string
        "app-banner-description"?: string
        "app-banner-button-name"?: string
        "app-banner-button-link"?: string
        "app-banner-link"?: string
      }
    }>
    "website-description"?: string
    "website_description"?: string
    "why-choose-us-title"?: string
    "why-choose-us-features"?: Array<{
      feature?: {
        "feature-name"?: string
        "feature-icon"?: string
      }
      // Handle potential direct structure if any
      "feature-name"?: string
      "feature-icon"?: string
    }>
    "contact-us"?: {
      "contact-phone"?: string
      "contact-email"?: string
      "contact-address"?: string
    }
    "social-links"?: Array<{
      "social-link"?: {
        "social-platform-name"?: string
        "social-platform-icon"?: string
        "social-platform-url"?: string
      }
      // Handle potential direct structure if any
      "social-platform-name"?: string
      "social-platform-icon"?: string
      "social-platform-url"?: string
    }>
    "promo-bar"?: {
      "promo-text"?: string
      "promo-code"?: string
      "promo-value"?: string
      "promo-active"?: boolean
    }
    // Allow for other properties
    [key: string]: any
  }
}

export const getDynamicConfig = cache(async (): Promise<DynamicConfig | null> => {
  try {
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"



    if (!publishableKey) {

      return null
    }

    const authHeaders = await getAuthHeaders()

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-publishable-api-key": publishableKey,
    }

    if (authHeaders && "authorization" in authHeaders) {
      headers["authorization"] = authHeaders.authorization
    }

    const fetchStart = Date.now()
    const response = await fetch(`${baseUrl}/store/dynamic-config`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    const duration = Date.now() - fetchStart



    if (!response.ok) {

      return null
    }

    const data = await response.json()


    return data
  } catch (error) {

    return null
  }
})

export const getLogoFromConfig = async (): Promise<string | null> => {
  try {
    const config = await getDynamicConfig()
    const logo = config?.["homepage-config"]?.logo

    return logo || null
  } catch (error) {

    return null
  }
}

export const getBannerImageFromConfig = async (): Promise<string | null> => {
  try {
    const config = await getDynamicConfig()
    const bannerArray = config?.["homepage-config"]?.["homepage-banner-array"]

    if (bannerArray && bannerArray.length > 0) {
      const firstBanner = bannerArray[0]
      const image = firstBanner?.["homepage-banner"]?.["homepage-banner-image"]

      return image || null
    }


    return null
  } catch (error) {

    return null
  }
}

export const getMobileBannerFromConfig = async (): Promise<{ image: string | null; link: string | null }> => {
  try {
    const config = await getDynamicConfig()
    const bannerArray = config?.["homepage-config"]?.["app-banner-array"]

    if (bannerArray && bannerArray.length > 0) {
      const firstBanner = bannerArray[0]
      const image = firstBanner?.["app-banner"]?.["app-banner-image"] || null
      const link = firstBanner?.["app-banner"]?.["app-banner-button-link"] || firstBanner?.["app-banner"]?.["app-banner-link"] || null

      return { image, link }
    }


    return { image: null, link: null }
  } catch (error) {

    return { image: null, link: null }
  }
}

export const getHomeBannersFromConfig = async (): Promise<Array<{
  image?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonName?: string;
  buttonLink?: string;
}> | null> => {
  try {
    const config = await getDynamicConfig()
    const bannerArray = config?.["homepage-config"]?.["homepage-banner-array"]

    if (bannerArray && bannerArray.length > 0) {
      return bannerArray.map(item => {
        const banner = item["homepage-banner"]
        return {
          image: banner?.["homepage-banner-image"],
          title: banner?.["homepage-banner-title"],
          subtitle: banner?.["homepage-banner-subtitle"],
          description: banner?.["homepage-banner-description"],
          buttonName: banner?.["homepage-banner-button-name"],
          buttonLink: banner?.["homepage-banner-button-link"],
        }
      })
    }
    return null
  } catch (error) {

    return null
  }
}

export const getAppBannersFromConfig = async (): Promise<Array<{
  image?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonName?: string;
  buttonLink?: string;
}> | null> => {
  try {
    const config = await getDynamicConfig()
    const bannerArray = config?.["homepage-config"]?.["app-banner-array"]

    if (bannerArray && bannerArray.length > 0) {
      return bannerArray.map(item => {
        const banner = item["app-banner"]
        return {
          image: banner?.["app-banner-image"],
          title: banner?.["app-banner-title"],
          subtitle: banner?.["app-banner-subtitle"],
          description: banner?.["app-banner-description"],
          buttonName: banner?.["app-banner-button-name"],
          buttonLink: banner?.["app-banner-button-link"],
        }
      })
    }
    return null
  } catch (error) {

    return null
  }
}

// Legacy function for backward compatibility
export const getMobileBannerImageFromConfig = async (): Promise<string | null> => {
  const { image } = await getMobileBannerFromConfig()
  return image
}

export const getWebsiteDescriptionFromConfig = async (): Promise<string | null> => {
  try {
    const config = await getDynamicConfig()
    const homepageConfig = config?.["homepage-config"]
    const desc = homepageConfig?.["website-description"] || homepageConfig?.["website_description"]


    return desc || null
  } catch (error) {

    return null
  }
}

export const getFeaturesFromConfig = async (): Promise<{ title: string; features: Array<{ name: string; icon: string }> } | null> => {
  try {
    const config = await getDynamicConfig()
    const homepageConfig = config?.["homepage-config"]

    if (!homepageConfig) return null

    const title = homepageConfig["why-choose-us-title"] || "The Cultura Jewels Promise"
    const featuresRaw = homepageConfig["why-choose-us-features"] || []

    const features = featuresRaw.map((item: any) => {
      const feature = item?.feature || item
      return {
        name: feature?.["feature-name"] || "",
        icon: feature?.["feature-icon"] || "",
      }
    }).filter((f: any) => f.name && f.icon)


    return { title, features }
  } catch (error) {

    return null
  }
}

export const getContactInfoFromConfig = async (): Promise<{ phone?: string; email?: string; address?: string } | null> => {
  try {
    const config = await getDynamicConfig()
    const contactConfig = config?.["homepage-config"]?.["contact-us"]

    if (!contactConfig) {

      return null
    }



    return {
      phone: contactConfig["contact-phone"],
      email: contactConfig["contact-email"],
      address: contactConfig["contact-address"],
    }
  } catch (error) {

    return null
  }
}

export const getTestimonialsFromConfig = async (): Promise<{ title: string; testimonials: Array<{ id: string; text: string; name: string; rating: number; avatar?: string }> } | null> => {
  try {
    const config = await getDynamicConfig()
    const homepageConfig = config?.["homepage-config"]

    if (!homepageConfig) return null

    const title = homepageConfig["rating-title"] || "Happy Parents Say About Us"
    const ratings = homepageConfig["ratings"] || []

    const testimonials = ratings.map((item: any, index: number) => {
      const review = item?.review || item
      return {
        id: `review-${index}`,
        text: review?.["review-description"] || "",
        name: review?.["review-user-name"] || "",
        rating: parseFloat(review?.["review-rating"] || "5"),
        avatar: review?.["review-profile-image"] || undefined,
      }
    }).filter((t: any) => t.text && t.name)



    return { title, testimonials }
  } catch (error) {

    return null
  }
}

export const getSocialLinksFromConfig = async (): Promise<Array<{ name: string; url: string; icon?: string }> | null> => {
  try {
    const config = await getDynamicConfig()
    const socialLinksRaw = config?.["homepage-config"]?.["social-links"] || []

    const socialLinks = socialLinksRaw.map((item: any) => {
      const link = item?.["social-link"] || item
      return {
        name: link?.["social-platform-name"] || "",
        url: link?.["social-platform-url"] || "",
        icon: link?.["social-platform-icon"] || undefined,
      }
    }).filter((l: any) => l.name && l.url)


    return socialLinks.length > 0 ? socialLinks : null
  } catch (error) {

    return null
  }
}

export const getFaqsFromConfig = async (): Promise<Array<{ category: string; items: Array<{ q: string; a: string }> }> | null> => {
  try {
    const config = await getDynamicConfig()
    const faqsRaw = config?.["homepage-config"]?.["faq-array"] || []

    if (!Array.isArray(faqsRaw) || faqsRaw.length === 0) return null

    const categoriesMap: Record<string, { displayCategory: string, items: Array<{q: string; a: string}> }> = {}

    faqsRaw.forEach((item: any) => {
      const faq = item?.["faq"] || item
      const displayCategory = (faq?.["faq-category"] || "General Questions").trim()
      const categoryKey = displayCategory.toLowerCase()
      const q = (faq?.["faq-question"] || "").trim()
      const a = (faq?.["faq-answer"] || "").trim()

      if (q && a) {
        if (!categoriesMap[categoryKey]) categoriesMap[categoryKey] = { displayCategory, items: [] }
        categoriesMap[categoryKey].items.push({ q, a })
      }
    })

    const faqs = Object.values(categoriesMap).map(catData => ({
      category: catData.displayCategory,
      items: catData.items
    }))

    return faqs.length > 0 ? faqs : null
  } catch (error) {
    return null
  }
}
export const getPromoBarConfig = async (): Promise<{ text: string | null; code: string | null; value: string | null; active: boolean }> => {
  try {
    const config = await getDynamicConfig()
    const promoConfig = config?.["homepage-config"]?.["promo-bar"]

    return {
      text: promoConfig?.["promo-text"] || null,
      code: promoConfig?.["promo-code"] || null,
      value: promoConfig?.["promo-value"] || null,
      active: promoConfig?.["promo-active"] ?? false
    }
  } catch (error) {
    return { text: null, code: null, value: null, active: false }
  }
}

export type ShopByStoneShape = {
  name: string
  label: string
  vibe: string
  image?: string
  link: string
}

export const getShopByStoneShapes = async (): Promise<ShopByStoneShape[] | null> => {
  try {
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
    if (!publishableKey) return null

    // Dedicated route — plugin /store/dynamic-config nesting drops array items
    // when the array field has an empty default value.
    const response = await fetch(`${baseUrl}/store/stone`, {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    })
    if (response.ok) {
      const data = await response.json()
      const shapes = (data?.shapes || [])
        .map((s: any) => ({
          name: (s?.name || "").trim(),
          label: (s?.label || s?.name || "").trim(),
          vibe: (s?.vibe || "").trim(),
          image: (s?.image || "").trim() || undefined,
          link:
            (s?.link || "").trim() ||
            (s?.name ? `/store?q=${encodeURIComponent(s.name)}` : ""),
        }))
        .filter((s: ShopByStoneShape) => s.name && s.link)
      if (shapes.length > 0) return shapes
    }

    // Fallback: nested dynamic-config (works if plugin serializer is fixed)
    const config = await getDynamicConfig()
    const raw = config?.["homepage-config"]?.["shop-by-stone-array"]
    if (!Array.isArray(raw) || raw.length === 0) return null

    const shapes = raw
      .map((item: any) => {
        const stone = item?.["shop-by-stone"] || item
        const name = (stone?.["shop-by-stone-name"] || "").trim()
        const label = (stone?.["shop-by-stone-label"] || name).trim()
        const vibe = (stone?.["shop-by-stone-vibe"] || "").trim()
        const image = (stone?.["shop-by-stone-image"] || "").trim() || undefined
        const link =
          (stone?.["shop-by-stone-link"] || "").trim() ||
          (name ? `/store?q=${encodeURIComponent(name)}` : "")
        return { name, label, vibe, image, link }
      })
      .filter((s: ShopByStoneShape) => s.name && s.link)

    return shapes.length > 0 ? shapes : null
  } catch {
    return null
  }
}
