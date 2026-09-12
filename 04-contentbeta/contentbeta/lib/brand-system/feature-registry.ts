export const BRAND_SYSTEM_SCHEMA_VERSION = 3 as const

export type BrandSystemFeatureId =
  | 'static'
  | 'carousel'
  | 'ppt'
  | 'illustration'
  | 'stock-imagery'
  | 'motion'
  | 'multi-size-ads'

export type BrandSystemAssetRole =
  | 'standalone-composition'
  | 'sequence-slide'
  | 'brand-guideline'
  | 'source-document'
  | 'style-reference'
  | 'product-reference'

export type BrandSystemMediaType = 'image' | 'pdf' | 'docx' | 'url'

export interface BrandSystemAssetManifestItem {
  id: string
  feature: BrandSystemFeatureId | 'core'
  role: BrandSystemAssetRole
  order: number
  storagePath: string
  mediaType: BrandSystemMediaType
  mimeType?: string
  originalName?: string
}

export interface BrandSystemFeatureDefinition {
  id: BrandSystemFeatureId
  label: string
  enabled: boolean
  acceptedRoles: BrandSystemAssetRole[]
  minAssets: number
  maxAssets: number
  ordered: boolean
  outputVersion: number
  description: string
}

export interface BrandSystemCoreOutput {
  brandName: string
  brandDescription: string
  infographicGuidelines: string
  palette: {
    primary: string
    secondary: string
    accent: string
    dark: string
    light: string
    text: string
  }
  typography: {
    headingFont: string
    bodyFont: string
    headingWeight: number
    bodyWeight: number
  }
  sourceEvidence: unknown
  visualBlueprints: unknown
  warnings: string[]
}

export interface BrandSystemFeatureOutput<TPayload = unknown> {
  feature: BrandSystemFeatureId
  version: number
  generatedAt: string
  payload: TPayload
}

export interface VersionedBrandSystemDocument {
  schemaVersion: typeof BRAND_SYSTEM_SCHEMA_VERSION
  core: BrandSystemCoreOutput
  features: Partial<Record<BrandSystemFeatureId, BrandSystemFeatureOutput>>
}

export const BRAND_SYSTEM_FEATURES: Record<BrandSystemFeatureId, BrandSystemFeatureDefinition> = {
  static: {
    id: 'static',
    label: 'Static Socials',
    enabled: true,
    acceptedRoles: ['standalone-composition', 'style-reference', 'product-reference'],
    minAssets: 1,
    maxAssets: 10,
    ordered: false,
    outputVersion: 1,
    description: 'Reusable square static backgrounds and editable overlay templates.',
  },
  carousel: {
    id: 'carousel',
    label: 'Carousels',
    enabled: true,
    acceptedRoles: ['sequence-slide'],
    minAssets: 6,
    maxAssets: 6,
    ordered: true,
    outputVersion: 1,
    description: 'Ordered multi-slide visual systems and slide-level overlay templates.',
  },
  ppt: {
    id: 'ppt',
    label: 'Presentations',
    enabled: false,
    acceptedRoles: ['source-document', 'style-reference', 'product-reference'],
    minAssets: 1,
    maxAssets: 20,
    ordered: true,
    outputVersion: 1,
    description: 'Slide masters, layouts, chart rules, and presentation prompt programs.',
  },
  illustration: {
    id: 'illustration',
    label: 'Illustrations',
    enabled: false,
    acceptedRoles: ['style-reference', 'product-reference'],
    minAssets: 1,
    maxAssets: 12,
    ordered: false,
    outputVersion: 1,
    description: 'Illustration language, character/object rules, and reusable scene programs.',
  },
  'stock-imagery': {
    id: 'stock-imagery',
    label: 'Stock Imagery',
    enabled: false,
    acceptedRoles: ['style-reference', 'product-reference'],
    minAssets: 1,
    maxAssets: 12,
    ordered: false,
    outputVersion: 1,
    description: 'Photography direction, subject casting, environment, crop, and grading rules.',
  },
  motion: {
    id: 'motion',
    label: 'Motion',
    enabled: false,
    acceptedRoles: ['sequence-slide', 'style-reference', 'source-document'],
    minAssets: 1,
    maxAssets: 20,
    ordered: true,
    outputVersion: 1,
    description: 'Motion grammar, scene progression, transitions, and timing rules.',
  },
  'multi-size-ads': {
    id: 'multi-size-ads',
    label: 'Multi-size Ads',
    enabled: false,
    acceptedRoles: ['standalone-composition', 'style-reference', 'product-reference'],
    minAssets: 1,
    maxAssets: 12,
    ordered: false,
    outputVersion: 1,
    description: 'Responsive layout families and size-specific safe-zone rules.',
  },
}

export interface BrandSystemManifestValidation {
  valid: boolean
  errors: string[]
  assetsByFeature: Partial<Record<BrandSystemFeatureId, BrandSystemAssetManifestItem[]>>
}

export function validateBrandSystemManifest(
  requestedFeatures: BrandSystemFeatureId[],
  assets: BrandSystemAssetManifestItem[]
): BrandSystemManifestValidation {
  const errors: string[] = []
  const assetsByFeature: Partial<Record<BrandSystemFeatureId, BrandSystemAssetManifestItem[]>> = {}

  for (const featureId of requestedFeatures) {
    const definition = BRAND_SYSTEM_FEATURES[featureId]
    if (!definition) {
      errors.push(`Unknown brand-system feature: ${featureId}.`)
      continue
    }
    if (!definition.enabled) {
      errors.push(`${definition.label} is registered but its compiler is not enabled yet.`)
      continue
    }
    const featureAssets = assets
      .filter(asset => asset.feature === featureId)
      .sort((a, b) => a.order - b.order)
    assetsByFeature[featureId] = featureAssets
    if (featureAssets.length < definition.minAssets || featureAssets.length > definition.maxAssets) {
      errors.push(`${definition.label} requires ${definition.minAssets}-${definition.maxAssets} reference asset(s); received ${featureAssets.length}.`)
    }
    const unsupported = featureAssets.find(asset => !definition.acceptedRoles.includes(asset.role))
    if (unsupported) errors.push(`${definition.label} does not accept the ${unsupported.role} asset role.`)
    if (definition.ordered) {
      const invalidOrder = featureAssets.some((asset, index) => asset.order !== index + 1)
      if (invalidOrder) errors.push(`${definition.label} assets must use a continuous order beginning at 1.`)
    }
  }

  const duplicateIds = assets.filter((asset, index) => assets.findIndex(candidate => candidate.id === asset.id) !== index)
  if (duplicateIds.length) errors.push('The asset manifest contains duplicate IDs.')

  return { valid: errors.length === 0, errors, assetsByFeature }
}

export function enabledBrandSystemFeatures(): BrandSystemFeatureDefinition[] {
  return Object.values(BRAND_SYSTEM_FEATURES).filter(feature => feature.enabled)
}
