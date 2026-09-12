export interface BrandSetupPalette {
  primary: string
  secondary: string
  accent: string
  dark: string
  light: string
  text: string
}

export interface BrandSetupTypography {
  headingFont: string
  bodyFont: string
  headingWeight: number
  bodyWeight: number
}

export interface BrandSetupOverlayConfig {
  splitLayout: 'free' | 'left-image' | 'right-image'
  splitRatio: number
  splitPercent?: number | null
  bgColor: string
  headlineColor: string
  microcopyColor: string
  accentColor: string
  textAccentColor: string
  accentBgEnabled?: boolean
  accentBgColor?: string | null
  accentBgPadding?: number
  accentBgRadius?: number
  accentUnderline?: boolean
  accentUnderlineColor?: string | null
  fontFamily: string
  headlineFontFamily?: string | null
  microcopyFontFamily?: string | null
  headlineSize: number
  microcopySize: number
  bulletSize?: number
  eyebrowColor?: string | null
  eyebrowSize?: number
  eyebrowUppercase?: boolean
  eyebrowGap?: number
  headlineGap?: number
  subheadGap?: number
  textAlign: 'left' | 'center' | 'right'
  uppercase: boolean
  padding: number
  logoPosition: string
  logoSize: number
  logoX: number | null
  logoY: number | null
  accentPosition: string
  accentSize: number
  patternOpacity: number
  verticalAlign: 'top' | 'center' | 'bottom'
  ctaPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | null
  removeBg: boolean
  textPosition: { x: number; y: number } | null
  textX?: number | null
  textY?: number | null
  headlineX?: number | null
  headlineY?: number | null
  microcopyX?: number | null
  microcopyY?: number | null
  eyebrowX?: number | null
  eyebrowY?: number | null
  bulletsX?: number | null
  bulletsY?: number | null
  elements: unknown[]
  cta: {
    text: string
    bgColor: string
    textColor: string
    fontSize: number
    paddingX: number
    paddingY: number
    borderRadius: number
    x: number
    y: number
    align: 'left' | 'center' | 'right'
  } | null
  ctaStyle?: {
    bgColor: string
    textColor: string
    fontSize: number
    paddingX: number
    paddingY: number
    borderRadius: number
    x: number
    y: number
  } | null
  [key: string]: unknown
}

export interface BrandSetupStaticLayout {
  name: string
  prompt: string
}

export interface BrandSetupInfographicLayout {
  name: string
  description: string
  isActive: boolean
}

export interface BrandSetupEditableTemplate {
  name: string
  bgPrompt: string
  puppeteerConfig: BrandSetupOverlayConfig
}

export interface BrandSetupCarouselSlide {
  slideIndex: number
  role: 'title' | 'problem' | 'insight' | 'shift' | 'action' | 'cta'
  prompt: string
  puppeteerConfig: BrandSetupOverlayConfig
}

export interface BrandSetupCarouselLayout {
  name: string
  slides: BrandSetupCarouselSlide[]
}

export interface BrandSetupReferenceEvidence {
  referenceIndex: number
  declaredType: BrandSetupReferenceType
  classifiedType: BrandSetupClassifiedReferenceType
  observedTraits: string[]
  allowedInfluence: string[]
  prohibitedInferences: string[]
}

export interface BrandSetupSourceEvidence {
  sourcePriority: string[]
  references: BrandSetupReferenceEvidence[]
  repeatedPatterns: string[]
  uncertainties: string[]
}

export interface BrandSetupVisualBlueprint {
  referenceIndexes: number[]
  canvas: string[]
  zones: string[]
  recurringComponents: string[]
  colorAndContrast: string[]
  typographyBehavior: string[]
  imageryAndDepth: string[]
  densityAndRhythm: string[]
  invariants: string[]
  prohibitedDrift: string[]
}

export interface BrandSetupCarouselSlideBlueprint {
  referenceIndex: number
  slideNumber: number
  role: string
  uniqueStructure: string[]
  retainedFamilyRules: string[]
}

export interface BrandSetupVisualBlueprints {
  staticSystem: BrandSetupVisualBlueprint
  carouselSystem: BrandSetupVisualBlueprint & {
    slides: BrandSetupCarouselSlideBlueprint[]
  }
}

export interface BrandSetupResult {
  brandName: string
  sourceEvidence: BrandSetupSourceEvidence
  visualBlueprints: BrandSetupVisualBlueprints
  brandDescription: string
  infographicGuidelines: string
  infographicLayouts: BrandSetupInfographicLayout[]
  palette: BrandSetupPalette
  typography: BrandSetupTypography
  staticLayouts: BrandSetupStaticLayout[]
  editableTemplates: BrandSetupEditableTemplate[]
  carouselLayouts: BrandSetupCarouselLayout[]
  warnings: string[]
  brandSystem?: VersionedBrandSystemDocument
}

export interface BrandSetupSourceSummary {
  websiteCharacters: number
  websitePages?: number
  guidelineCharacters: number
  verifiedFacts?: number
  referenceImages: number
  carouselPages?: number
}

export type BrandSetupClassifiedReferenceType = 'logo-palette' | 'campaign-creative' | 'product-ui' | 'photography'
export type BrandSetupReferenceType = 'auto' | 'static-creative' | 'carousel-slide' | BrandSetupClassifiedReferenceType
import type { VersionedBrandSystemDocument } from '@/lib/brand-system/feature-registry'
