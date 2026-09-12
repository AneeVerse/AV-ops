import type { BrandSetupResult } from '@/lib/brand-setup-types'
import {
  BRAND_SYSTEM_FEATURES,
  BRAND_SYSTEM_SCHEMA_VERSION,
  type BrandSystemFeatureId,
  type VersionedBrandSystemDocument,
} from '@/lib/brand-system/feature-registry'

export function toVersionedBrandSystemDocument(
  result: BrandSetupResult,
  requestedFeatures: BrandSystemFeatureId[] = ['static', 'carousel']
): VersionedBrandSystemDocument {
  const generatedAt = new Date().toISOString()
  const features: VersionedBrandSystemDocument['features'] = {}

  if (requestedFeatures.includes('static')) {
    features.static = {
      feature: 'static',
      version: BRAND_SYSTEM_FEATURES.static.outputVersion,
      generatedAt,
      payload: {
        layouts: result.staticLayouts,
        editableTemplates: result.editableTemplates,
      },
    }
  }
  if (requestedFeatures.includes('carousel')) {
    features.carousel = {
      feature: 'carousel',
      version: BRAND_SYSTEM_FEATURES.carousel.outputVersion,
      generatedAt,
      payload: {
        layouts: result.carouselLayouts,
      },
    }
  }

  return {
    schemaVersion: BRAND_SYSTEM_SCHEMA_VERSION,
    core: {
      brandName: result.brandName,
      brandDescription: result.brandDescription,
      infographicGuidelines: result.infographicGuidelines,
      palette: result.palette,
      typography: result.typography,
      sourceEvidence: result.sourceEvidence,
      visualBlueprints: result.visualBlueprints,
      warnings: result.warnings,
    },
    features,
  }
}

/**
 * Keeps current storage/rendering code compatible while allowing future feature
 * adapters to save their own payloads from the versioned document.
 */
export function hydrateLegacyBrandSetupFields(result: BrandSetupResult): BrandSetupResult {
  const document = result.brandSystem
  if (!document) return result
  const staticPayload = document.features.static?.payload as {
    layouts?: BrandSetupResult['staticLayouts']
    editableTemplates?: BrandSetupResult['editableTemplates']
  } | undefined
  const carouselPayload = document.features.carousel?.payload as {
    layouts?: BrandSetupResult['carouselLayouts']
  } | undefined
  return {
    ...result,
    brandName: document.core.brandName || result.brandName,
    brandDescription: document.core.brandDescription || result.brandDescription,
    infographicGuidelines: document.core.infographicGuidelines || result.infographicGuidelines,
    staticLayouts: staticPayload?.layouts || result.staticLayouts,
    editableTemplates: staticPayload?.editableTemplates || result.editableTemplates,
    carouselLayouts: carouselPayload?.layouts || result.carouselLayouts,
  }
}
