import type { HttpTypes } from "@medusajs/types"

export interface SizeChartSection {
  title?: string
  headers: string[]
  rows: string[][]
}

export interface SizeChartData {
  title: string
  tip?: string
  sections: SizeChartSection[]
}

// Preset 1: Ring Size Chart
export const RING_SIZE_CHART_PRESET: SizeChartData = {
  title: "Ring Size Guide",
  tip: "For the most accurate fit, measure the inside diameter of an existing ring that fits comfortably, or wrap a strip of paper around your finger base.",
  sections: [
    {
      title: "Standard Ring Sizes",
      headers: ["US Size", "Inside Diameter (mm)", "Inside Circumference (mm)"],
      rows: [
        ["3", "14.1 mm", "44.2 mm"],
        ["4", "14.9 mm", "46.8 mm"],
        ["5", "15.7 mm", "49.3 mm"],
        ["6", "16.5 mm", "51.9 mm"],
        ["7", "17.3 mm", "54.4 mm"],
        ["8", "18.1 mm", "57.0 mm"],
        ["9", "18.9 mm", "59.5 mm"],
        ["10", "19.8 mm", "62.1 mm"],
        ["11", "20.6 mm", "64.6 mm"],
        ["12", "21.4 mm", "67.2 mm"],
      ],
    },
  ],
}

// Preset 2: Bracelet & Bangle Size Guide
export const BRACELET_SIZE_CHART_PRESET: SizeChartData = {
  title: "Bracelet & Bangle Size Guide",
  tip: "To find your bracelet size, measure your wrist with a flexible tape measure just below the wrist bone.",
  sections: [
    {
      title: "Bracelet & Bangle Dimensions",
      headers: ["Size", "Wrist Circumference", "Bangle Diameter"],
      rows: [
        ["Extra Small (XS)", "14.0 - 15.0 cm", "5.5 cm"],
        ["Small (S)", "15.0 - 16.5 cm", "6.0 cm"],
        ["Medium (M)", "16.5 - 18.0 cm", "6.5 cm"],
        ["Large (L)", "18.0 - 19.5 cm", "7.0 cm"],
        ["Extra Large (XL)", "19.5 - 21.0 cm", "7.5 cm"],
      ],
    },
  ],
}

// Preset 3: Necklace Length Guide
export const NECKLACE_SIZE_CHART_PRESET: SizeChartData = {
  title: "Necklace & Chain Length Guide",
  tip: "Standard necklace lengths sit differently depending on neck size. Choose shorter lengths for collared styles or longer lengths for pendants.",
  sections: [
    {
      title: "Standard Chain Lengths",
      headers: ["Length", "Placement", "Recommended Style"],
      rows: [
        ["14 inches (35 cm)", "Collar / High Neckline", "Chokers & Petites"],
        ["16 inches (40 cm)", "Base of Neck", "Sits just above collarbone"],
        ["18 inches (45 cm)", "On Collarbone", "Most popular standard pendant length"],
        ["20 inches (50 cm)", "Below Collarbone", "Great for low necklines & layering"],
        ["24 inches (60 cm)", "At or below sternum", "Statement pendants & opera chains"],
      ],
    },
  ],
}

/**
 * Resolves the dynamic size chart data for a given product.
 * Hierarchy:
 * 1. product.metadata.size_chart (JSON)
 * 2. category.metadata.size_chart (JSON) for any category attached to the product
 * 3. Smart Category / Keyword Resolver (Rings / Bracelets / Necklaces)
 * 4. Default: Ring Size Chart Preset
 */
export function getSizeChartForProduct(product: HttpTypes.StoreProduct): SizeChartData {
  // 1. Check Product Metadata Override
  if (product.metadata?.size_chart) {
    try {
      const parsed = typeof product.metadata.size_chart === "string"
        ? JSON.parse(product.metadata.size_chart)
        : product.metadata.size_chart
      if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return parsed as SizeChartData
      }
    } catch (e) {
      // Ignore parse error
    }
  }

  // 2. Check Category Metadata
  const categories = product.categories || (product.collection ? [product.collection] : [])
  for (const cat of categories) {
    const catMeta = (cat as any).metadata
    if (catMeta?.size_chart) {
      try {
        const parsed = typeof catMeta.size_chart === "string"
          ? JSON.parse(catMeta.size_chart)
          : catMeta.size_chart
        if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          return parsed as SizeChartData
        }
      } catch (e) {
        // Ignore parse error
      }
    }
  }

  // 3. Smart Fallback via Category Handles / Titles / Product Title
  const combinedText = [
    product.title,
    product.handle,
    ...categories.map((c: any) => `${c.name || c.title || ''} ${c.handle || ''}`),
  ].join(" ").toLowerCase()

  if (combinedText.includes("bracelet") || combinedText.includes("bangle") || combinedText.includes("wrist")) {
    return BRACELET_SIZE_CHART_PRESET
  }

  if (combinedText.includes("necklace") || combinedText.includes("chain") || combinedText.includes("pendant")) {
    return NECKLACE_SIZE_CHART_PRESET
  }

  // 4. Default fallback for jewelry items (Rings)
  return RING_SIZE_CHART_PRESET
}
