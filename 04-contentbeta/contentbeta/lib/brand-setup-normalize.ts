import type {
  BrandSetupCarouselSlide,
  BrandSetupOverlayConfig,
  BrandSetupResult,
} from '@/lib/brand-setup-types'

const ROLES: BrandSetupCarouselSlide['role'][] = ['title', 'problem', 'insight', 'shift', 'action', 'cta']
const CTA_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const
const HEX = /^#[0-9A-F]{6}$/i
const POSITIVE_OVERLAY_REQUEST = /\b(?:logo|brand mark|headline|tagline|cta|marketing copy)\b[^.\n]{0,80}\b(?:prominent|bold|display|place|center|feature|foreground|highlight|show|render|visible|on the (?:left|right|top|bottom)|at the (?:left|right|top|bottom))\b|\b(?:prominent|bold|display|place|center|feature|foreground|highlight|show|render)\w*\b[^.\n]{0,80}\b(?:logo|brand mark|headline|tagline|cta|marketing copy)\b/i

function hasPositiveOverlayRequest(value: string): boolean {
  return value.split(/(?<=[.!?])\s+|\n+/).some(sentence => {
    const lower = sentence.toLowerCase()
    // Negative production rules such as "do not render ... logo" previously
    // matched POSITIVE_OVERLAY_REQUEST and produced misleading advisories.
    if (/\b(?:do not|don't|never|no|without|must not|cannot|can't)\b/.test(lower)) return false
    return POSITIVE_OVERLAY_REQUEST.test(sentence)
  })
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function stringArray(value: unknown, limit = 24): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, limit)
    : []
}

function numberArray(value: unknown, limit = 12): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0 && item < 100)
    .slice(0, limit)
}

function normalizeVisualBlueprint(value: unknown) {
  const source = record(value)
  return {
    referenceIndexes: numberArray(source.referenceIndexes),
    canvas: stringArray(source.canvas, 16),
    zones: stringArray(source.zones, 24),
    recurringComponents: stringArray(source.recurringComponents, 24),
    colorAndContrast: stringArray(source.colorAndContrast, 20),
    typographyBehavior: stringArray(source.typographyBehavior, 20),
    imageryAndDepth: stringArray(source.imageryAndDepth, 20),
    densityAndRhythm: stringArray(source.densityAndRhythm, 20),
    invariants: stringArray(source.invariants, 20),
    prohibitedDrift: stringArray(source.prohibitedDrift, 20),
  }
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, numberValue(value, fallback))))
}

function decimal(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, numberValue(value, fallback)))
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function color(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return HEX.test(candidate) ? candidate : fallback
}

function percent(value: unknown, fallback: number, min: number, max: number): number {
  let parsed = numberValue(value, fallback)
  if (parsed > 0 && parsed <= 1) parsed *= 100
  return Math.round(Math.min(max, Math.max(min, parsed)))
}

function optionalCoordinate(value: unknown): number | null {
  const parsed = numberValue(value, Number.NaN)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(Math.min(1080, Math.max(0, parsed)))
}

/**
 * Convert an evidence-led composition into the renderer's deterministic
 * overlay contract. The background model is responsible only for the visual
 * zone; copy, logo and CTA coordinates are owned by Puppeteer/Figma renderers.
 */
export function lockBrandSetupOverlayLayout(
  config: BrandSetupOverlayConfig,
  mode: 'editable' | 'carousel',
  role?: BrandSetupCarouselSlide['role']
): BrandSetupOverlayConfig {
  const padding = 60
  const textPercent = Math.min(72, Math.max(34,
    config.splitPercent ?? (config.splitLayout === 'free' ? 42 : 100 - config.splitRatio)
  ))
  const textWidth = Math.round(1080 * textPercent / 100)

  let textX = 0
  let textY = 110
  if (config.splitLayout === 'left-image') textX = 1080 - textWidth
  if (config.splitLayout === 'free') {
    if (config.textAlign === 'center') textX = Math.max(0, Math.round((1080 - textWidth) / 2))
    else if (config.textAlign === 'right') textX = 1080 - textWidth
    if (config.verticalAlign === 'center') textY = role === 'title' ? 190 : 220
    if (config.verticalAlign === 'bottom') textY = role === 'cta' ? 430 : 500
  } else if (config.verticalAlign === 'center') {
    textY = role === 'title' ? 150 : 190
  } else if (config.verticalAlign === 'bottom') {
    textY = role === 'cta' ? 420 : 480
  }

  // A top logo and the copy block must never compete for the same pixels.
  if (textY < 120) textY = 120
  const logoOnRight = config.splitLayout === 'left-image' || config.textAlign === 'right'
  const logoX = logoOnRight ? 930 : 60
  const logoY = 48
  const logoPosition = logoOnRight ? 'top-right' : 'top-left'
  const ctaOnRight = logoOnRight
  const ctaCentered = config.splitLayout === 'free' && config.textAlign === 'center'
  const ctaPosition = ctaCentered ? 'bottom-center' : ctaOnRight ? 'bottom-right' : 'bottom-left'
  const ctaX = ctaCentered ? 430 : ctaOnRight ? 760 : 60
  const ctaY = 900
  const ctaStyle = {
    ...(config.ctaStyle || {
      bgColor: config.accentColor,
      textColor: config.bgColor,
      fontSize: mode === 'carousel' ? 20 : 22,
      paddingX: 28,
      paddingY: 14,
      borderRadius: 12,
      x: ctaX,
      y: ctaY,
    }),
    x: ctaX,
    y: ctaY,
  }

  return {
    ...config,
    padding,
    splitPercent: textPercent,
    splitRatio: config.splitLayout === 'free' ? 50 : 100 - textPercent,
    // The CTA slide's text position is owned exclusively by ctaPosition in the
    // renderer; a non-null textX/textY here would silently override it.
    textX: role === 'cta' ? null : textX,
    textY: role === 'cta' ? null : textY,
    // The editable renderer positions text relative to its own text zone,
    // whereas the carousel renderer consumes canvas-relative textX/textY and
    // applies padding inside that wrapper. Keep both coordinate systems fixed.
    textPosition: {
      x: mode === 'editable' ? padding : textX + padding,
      y: textY + padding,
    },
    logoPosition,
    logoX,
    logoY,
    ctaPosition,
    ctaStyle,
    cta: config.cta ? { ...config.cta, ...ctaStyle } : null,
    accentBgEnabled: false,
    accentBgColor: null,
    accentUnderline: false,
    elements: [],
  }
}

function normalizeSplitLayout(value: unknown, textAlign: string): BrandSetupOverlayConfig['splitLayout'] {
  if (value === 'free' || value === 'left-image' || value === 'right-image') return value
  if (value === 'vertical') return textAlign === 'right' ? 'left-image' : 'right-image'
  return 'free'
}

function normalizeCtaPosition(value: unknown, role?: BrandSetupCarouselSlide['role']) {
  const fallback = role === 'title' ? 'bottom-left' : role === 'cta' ? 'bottom-center' : 'bottom-left'
  if (value === 'left') return 'bottom-left'
  if (value === 'center') return 'bottom-center'
  if (value === 'right') return 'bottom-right'
  return enumValue(value, CTA_POSITIONS, fallback)
}

function normalizeConfig(
  input: unknown,
  palette: BrandSetupResult['palette'],
  typography: BrandSetupResult['typography'],
  mode: 'editable' | 'carousel',
  role?: BrandSetupCarouselSlide['role']
): BrandSetupOverlayConfig {
  const source = record(input)
  const textAlign = enumValue(source.textAlign, ['left', 'center', 'right'] as const, 'left')
  const splitLayout = normalizeSplitLayout(source.splitLayout, textAlign)
  const splitRatio = percent(source.splitRatio, 50, 30, 65)
  const splitPercent = splitLayout === 'free'
    ? percent(source.splitPercent ?? source.splitRatio, 45, 30, 75)
    : 100 - splitRatio
  const headlineDefault = mode === 'carousel' ? 58 : 72
  const microcopyDefault = mode === 'carousel' ? 24 : 28
  const paddingDefault = mode === 'carousel' ? 64 : 72
  const ctaPosition = normalizeCtaPosition(source.ctaPosition, role)
  const ctaSource = record(source.cta)
  const ctaStyleSource = Object.keys(record(source.ctaStyle)).length ? record(source.ctaStyle) : ctaSource
  const ctaStyle = {
    bgColor: color(ctaStyleSource.bgColor, palette.accent),
    textColor: color(ctaStyleSource.textColor, palette.dark),
    fontSize: integer(ctaStyleSource.fontSize, 22, 18, mode === 'carousel' ? 28 : 30),
    paddingX: integer(ctaStyleSource.paddingX, 28, 20, 40),
    paddingY: integer(ctaStyleSource.paddingY, 14, 10, 22),
    borderRadius: integer(ctaStyleSource.borderRadius, 12, 0, 40),
    x: integer(ctaStyleSource.x, 80, 60, 900),
    y: integer(ctaStyleSource.y, 920, 60, 980),
  }
  const textPositionSource = record(source.textPosition)
  const textPosition = Number.isFinite(Number(textPositionSource.x)) && Number.isFinite(Number(textPositionSource.y))
    ? { x: integer(textPositionSource.x, 80, 60, 1020), y: integer(textPositionSource.y, 120, 60, 1020) }
    : null
  const fontFamily = stringValue(source.fontFamily, typography.bodyFont)

  return lockBrandSetupOverlayLayout({
    splitLayout,
    splitRatio,
    splitPercent,
    bgColor: color(source.bgColor, palette.light),
    headlineColor: color(source.headlineColor, palette.text),
    microcopyColor: color(source.microcopyColor, palette.text),
    accentColor: color(source.accentColor, palette.accent),
    textAccentColor: color(source.textAccentColor, palette.accent),
    accentBgEnabled: bool(source.accentBgEnabled),
    accentBgColor: color(source.accentBgColor, palette.accent),
    accentBgPadding: integer(source.accentBgPadding, 5, 0, 20),
    accentBgRadius: integer(source.accentBgRadius, 2, 0, 20),
    accentUnderline: bool(source.accentUnderline),
    accentUnderlineColor: color(source.accentUnderlineColor, palette.accent),
    fontFamily,
    headlineFontFamily: stringValue(source.headlineFontFamily, typography.headingFont),
    microcopyFontFamily: stringValue(source.microcopyFontFamily, typography.bodyFont),
    headlineSize: integer(source.headlineSize, headlineDefault, mode === 'carousel' ? 44 : 60, mode === 'carousel' ? 70 : 84),
    microcopySize: integer(source.microcopySize, microcopyDefault, mode === 'carousel' ? 19 : 23, mode === 'carousel' ? 29 : 34),
    bulletSize: integer(source.bulletSize, 20, 16, 30),
    eyebrowColor: color(source.eyebrowColor, palette.accent),
    eyebrowSize: integer(source.eyebrowSize, 15, 11, 24),
    eyebrowUppercase: bool(source.eyebrowUppercase, true),
    eyebrowGap: integer(source.eyebrowGap, 14, 0, 80),
    headlineGap: integer(source.headlineGap, 18, 0, 100),
    subheadGap: integer(source.subheadGap, 24, 0, 100),
    textAlign,
    uppercase: bool(source.uppercase),
    padding: integer(source.padding, paddingDefault, 60, 100),
    logoPosition: stringValue(source.logoPosition, 'top-left'),
    logoSize: integer(source.logoSize, 48, 36, 72),
    logoX: optionalCoordinate(source.logoX),
    logoY: optionalCoordinate(source.logoY),
    accentPosition: stringValue(source.accentPosition, 'bottom-left'),
    accentSize: integer(source.accentSize, 64, 0, 160),
    patternOpacity: decimal(source.patternOpacity, 0.12, 0, 1),
    verticalAlign: enumValue(source.verticalAlign, ['top', 'center', 'bottom'] as const, 'center'),
    removeBg: bool(source.removeBg),
    textPosition,
    textX: optionalCoordinate(source.textX),
    textY: optionalCoordinate(source.textY),
    elements: [],
    cta: mode === 'editable' || role === 'cta' ? {
      text: stringValue(ctaSource.text, 'Learn more'),
      ...ctaStyle,
      align: enumValue(ctaSource.align, ['left', 'center', 'right'] as const, textAlign),
    } : null,
    ctaStyle,
    ctaPosition,
  }, mode, role)
}

function rendererMapping(config: BrandSetupOverlayConfig): string {
  const textPercent = config.splitPercent ?? (config.splitLayout === 'free' ? 40 : 100 - config.splitRatio)
  const visualPercent = 100 - textPercent
  if (config.splitLayout === 'right-image') {
    return `Renderer mapping: the left ${textPercent}% is the text-safe zone and the right ${visualPercent}% is the visual zone; this mapping overrides any conflicting directional language above.`
  }
  if (config.splitLayout === 'left-image') {
    return `Renderer mapping: the right ${textPercent}% is the text-safe zone and the left ${visualPercent}% is the visual zone; this mapping overrides any conflicting directional language above.`
  }
  const textRegion = config.verticalAlign === 'top' ? 'top' : config.verticalAlign === 'bottom' ? 'bottom' : 'central'
  const visualRegion = config.verticalAlign === 'top' ? 'bottom' : config.verticalAlign === 'bottom' ? 'top' : 'outer'
  return `Renderer mapping: the ${textRegion} ${textPercent}% is the text-safe zone and the ${visualRegion} ${visualPercent}% is the visual zone in a free composition.`
}

function sanitizeOverlayRequests(value: string): string {
  return value.split('\n').map(line => {
    // Evidence lines describe what was measured in the uploaded source. They are
    // not instructions to draw those overlay elements. Replacing the complete
    // line when it mentioned "logo at top-left" erased the evidence and section
    // heading from every compiled prompt.
    if (/^(?:EVIDENCE BASIS|REFERENCE BLUEPRINT|SHARED FAMILY EVIDENCE):/i.test(line.trim())) {
      // Keep the measured location while changing the noun to an explicit empty
      // reserve, so the image model cannot interpret an observed source mark as
      // an instruction to draw a new one.
      return line
        .replace(/\bbrand mark\b/gi, 'deterministic overlay reserve')
        .replace(/\blogo\b/gi, 'deterministic overlay reserve')
    }
    let replacementAdded = false
    return line.split(/(?<=[.!?])\s+/).map(sentence => {
      const lower = sentence.toLowerCase()
      const isLegitimateReserve = lower.includes('reserve') || lower.includes('do not') || lower.includes('no logo') || lower.includes('without a logo')
      if (!isLegitimateReserve && POSITIVE_OVERLAY_REQUEST.test(sentence)) {
        if (replacementAdded) return ''
        replacementAdded = true
        return 'Reserve the corresponding area as quiet negative space for the deterministic overlay logo; do not draw a logo or Brand Mark into the AI background.'
      }
      return sentence
    }).filter(Boolean).join(' ')
  }).join('\n')
}

function ensureBackgroundContract(value: string, config?: BrandSetupOverlayConfig): string {
  // Make normalization idempotent. Results pass through normalization after the
  // guide-repair stage, so retain the creative program and rebuild one canonical
  // technical contract instead of appending a second copy.
  const creativePrompt = value.split(/\n\nTechnical production contract:/i)[0].trim()
  let prompt = sanitizeOverlayRequests(creativePrompt)
  if (!prompt) return ''
  if (config && /renderer mapping:/i.test(prompt)) {
    prompt = prompt.replace(/Renderer mapping:[^\n]*?(?=Format:|$)/i, `${rendererMapping(config)} `)
  }
  const lower = prompt.toLowerCase()
  const additions: string[] = []
  if (config && !lower.includes('renderer mapping:')) additions.push(rendererMapping(config))
  if (!/1\s*:\s*1/.test(lower) || !lower.includes('1080')) {
    additions.push('Format: square 1:1, 1080x1080.')
  }
  if (!lower.includes('full-bleed') && !lower.includes('full bleed')) {
    additions.push('Use one continuous full-bleed canvas with no outer frame or floating poster.')
  }
  if (!lower.includes('deterministic') && !lower.includes('html overlay')) {
    additions.push('Keep the designated text-safe zone visually quiet because deterministic HTML overlays will add the real copy, logo, and CTA.')
  }
  if (!lower.includes('no text-holder box') && !lower.includes('no placeholder panel')) {
    additions.push('Create negative space through subject placement, crop, lighting, blur, or a continuous color field: no text-holder box, no blank card, no placeholder panel, no empty banner, no framed copy area, and no callout rectangle. A real product screen or dashboard is allowed only as the primary evidence-backed subject in the visual zone, never as an empty copy container.')
  }
  const negativeRules = ['no headline', 'no logo', 'no watermark', 'no brand name', 'no decorative fake text']
  if (negativeRules.some(rule => !lower.includes(rule))) {
    additions.push('No headline, no paragraph, no CTA text, no logo, no watermark, no brand name, no decorative fake text, no illegible UI labels, and no clipped primary subject.')
  }
  return additions.length ? `${prompt}\n\nTechnical production contract: ${additions.join(' ')}` : prompt
}

function rendererSignature(config: BrandSetupOverlayConfig): string {
  return [
    config.splitLayout,
    config.splitPercent,
    config.bgColor,
    config.textAlign,
    config.verticalAlign,
    config.logoPosition,
    config.ctaPosition,
  ].join('|')
}

function compositionSignature(config: BrandSetupOverlayConfig): string {
  return [
    config.splitLayout,
    config.splitPercent,
    config.textAlign,
    config.verticalAlign,
    config.logoPosition,
    config.ctaPosition,
  ].join('|')
}

function applyCompositionPreset(
  config: BrandSetupOverlayConfig,
  preset: Partial<BrandSetupOverlayConfig>,
  mode: 'editable' | 'carousel',
  role?: BrandSetupCarouselSlide['role']
): BrandSetupOverlayConfig {
  const next = { ...config, ...preset }
  return lockBrandSetupOverlayLayout(next, mode, role)
}

function diversifyStaticConfigs(configs: BrandSetupOverlayConfig[]): BrandSetupOverlayConfig[] {
  if (new Set(configs.map(compositionSignature)).size >= 3) return configs
  const presets: Partial<BrandSetupOverlayConfig>[] = [
    { splitLayout: 'right-image', splitPercent: 58, textAlign: 'left', verticalAlign: 'center' },
    { splitLayout: 'right-image', splitPercent: 52, textAlign: 'left', verticalAlign: 'top' },
    { splitLayout: 'free', splitPercent: 40, textAlign: 'left', verticalAlign: 'top' },
    { splitLayout: 'right-image', splitPercent: 48, textAlign: 'left', verticalAlign: 'center' },
    { splitLayout: 'free', splitPercent: 44, textAlign: 'left', verticalAlign: 'center' },
  ]
  return configs.map((config, index) => applyCompositionPreset(config, presets[index % presets.length], 'editable'))
}

function diversifyCarouselConfigs(
  layouts: Array<{ name: string; slides: BrandSetupCarouselSlide[] }>
): Array<{ name: string; slides: BrandSetupCarouselSlide[] }> {
  if (layouts.length !== 2 || layouts.some(layout => layout.slides.length !== 6)) return layouts

  const firstSequence = layouts[0].slides.map(slide => rendererSignature(slide.puppeteerConfig))
  const secondSequence = layouts[1].slides.map(slide => rendererSignature(slide.puppeteerConfig))
  const matchingAcrossFamilies = firstSequence.filter((signature, index) => signature === secondSequence[index]).length
  if (matchingAcrossFamilies <= 2) return layouts

  const alternateFamilyPresets: Partial<BrandSetupOverlayConfig>[] = [
    { splitLayout: 'right-image', splitPercent: 52, textAlign: 'left', verticalAlign: 'center' },
    { splitLayout: 'free', splitPercent: 40, textAlign: 'left', verticalAlign: 'top' },
    { splitLayout: 'left-image', splitPercent: 48, textAlign: 'left', verticalAlign: 'center' },
    { splitLayout: 'right-image', splitPercent: 44, textAlign: 'left', verticalAlign: 'center' },
    { splitLayout: 'free', splitPercent: 36, textAlign: 'center', verticalAlign: 'bottom' },
    { splitLayout: 'left-image', splitPercent: 56, textAlign: 'left', verticalAlign: 'bottom' },
  ]

  return layouts.map((layout, familyIndex) => familyIndex === 0 ? layout : ({
    ...layout,
    slides: layout.slides.map((slide, slideIndex) => ({
      ...slide,
      puppeteerConfig: applyCompositionPreset(slide.puppeteerConfig, alternateFamilyPresets[slideIndex], 'carousel', slide.role),
    })),
  }))
}

function evidenceSafeCarouselName(name: string, hasProductUiEvidence: boolean, hasPhotographyEvidence: boolean): string {
  let normalized = name
  if (!hasProductUiEvidence) {
    normalized = normalized.replace(/\bproduct\b/gi, 'Campaign').replace(/\bui\b/gi, 'Editorial')
  }
  if (!hasPhotographyEvidence && /\bphotograph(?:y|ic)?\b/i.test(normalized)) {
    normalized = normalized.replace(/\b(?:editorial\s+)?photograph(?:y|ic)?(?:-led)?\b/gi, 'Data-and-illustration-led')
  }
  return normalized
}

export function normalizeBrandSetupResult(input: unknown, brandName: string): BrandSetupResult {
  const source = record(input)
  const evidenceSource = record(source.sourceEvidence)
  const references = Array.isArray(evidenceSource.references)
    ? evidenceSource.references.map((item, index) => {
      const evidence = record(item)
      const declaredType = enumValue(evidence.declaredType, ['auto', 'static-creative', 'carousel-slide', 'logo-palette', 'campaign-creative', 'product-ui', 'photography'] as const, 'auto')
      const classifiedFallback = declaredType === 'auto' || declaredType === 'static-creative' || declaredType === 'carousel-slide'
        ? 'campaign-creative'
        : declaredType
      const classifiedType = enumValue(evidence.classifiedType, ['logo-palette', 'campaign-creative', 'product-ui', 'photography'] as const, classifiedFallback)
      let allowedInfluence = stringArray(evidence.allowedInfluence, 12)
      let prohibitedInferences = stringArray(evidence.prohibitedInferences, 12)
      if (classifiedType === 'campaign-creative') {
        prohibitedInferences = prohibitedInferences.filter(rule => !/\b(layouts?|compositions?)\b/i.test(rule))
        if (!allowedInfluence.some(rule => /\b(layout|composition|grid)\b/i.test(rule))) allowedInfluence.push('layout and composition')
        if (!prohibitedInferences.length) prohibitedInferences.push('logo placement, brand-policy claims, and unsupported product capabilities')
      }
      if (classifiedType === 'logo-palette' && !prohibitedInferences.some(rule => /\b(layouts?|compositions?)\b/i.test(rule))) {
        prohibitedInferences.push('layout and composition')
      }
      if (classifiedType === 'logo-palette' && !allowedInfluence.length) {
        allowedInfluence.push('logo identity and palette evidence only')
      }
      if (classifiedType === 'product-ui') {
        if (!allowedInfluence.length) allowedInfluence.push('visible product anatomy and interface composition')
        if (!prohibitedInferences.length) prohibitedInferences.push('unsupported product capabilities, invented data, and brand-policy claims')
      }
      if (classifiedType === 'photography') {
        if (!allowedInfluence.length) allowedInfluence.push('photographic subject, crop, lighting, environment, and color treatment')
        if (!prohibitedInferences.length) prohibitedInferences.push('brand identity rules, product capabilities, and campaign claims')
      }
      return {
        referenceIndex: integer(evidence.referenceIndex, index + 1, 1, 99),
        declaredType,
        classifiedType,
        observedTraits: stringArray(evidence.observedTraits, 20),
        allowedInfluence,
        prohibitedInferences,
      }
    })
    : []
  const sourceEvidence: BrandSetupResult['sourceEvidence'] = {
    sourcePriority: stringArray(evidenceSource.sourcePriority, 8),
    references,
    repeatedPatterns: stringArray(evidenceSource.repeatedPatterns, 20),
    uncertainties: stringArray(evidenceSource.uncertainties, 20),
  }
  const visualBlueprintSource = record(source.visualBlueprints)
  const staticSystem = normalizeVisualBlueprint(visualBlueprintSource.staticSystem)
  const carouselSystemSource = record(visualBlueprintSource.carouselSystem)
  const visualBlueprints: BrandSetupResult['visualBlueprints'] = {
    staticSystem,
    carouselSystem: {
      ...normalizeVisualBlueprint(carouselSystemSource),
      slides: Array.isArray(carouselSystemSource.slides)
        ? carouselSystemSource.slides.slice(0, 6).map((item, index) => {
            const slide = record(item)
            return {
              referenceIndex: integer(slide.referenceIndex, index + 2, 1, 99),
              slideNumber: integer(slide.slideNumber, index + 1, 1, 6),
              role: stringValue(slide.role, `page ${index + 1}`),
              uniqueStructure: stringArray(slide.uniqueStructure, 16),
              retainedFamilyRules: stringArray(slide.retainedFamilyRules, 12),
            }
          })
        : [],
    },
  }
  const paletteSource = record(source.palette)
  const typographySource = record(source.typography)
  const palette = {
    primary: color(paletteSource.primary, '#2563EB'),
    secondary: color(paletteSource.secondary, '#64748B'),
    accent: color(paletteSource.accent, '#F59E0B'),
    dark: color(paletteSource.dark, '#111827'),
    light: color(paletteSource.light, '#FFFFFF'),
    text: color(paletteSource.text, '#111827'),
  }
  const typography = {
    headingFont: stringValue(typographySource.headingFont, 'Arial, sans-serif'),
    bodyFont: stringValue(typographySource.bodyFont, 'Arial, sans-serif'),
    headingWeight: integer(typographySource.headingWeight, 700, 400, 900),
    bodyWeight: integer(typographySource.bodyWeight, 400, 300, 700),
  }
  const staticSeeds = Array.isArray(source.staticLayouts) ? source.staticLayouts.map((item, index) => {
    const layout = record(item)
    return {
      name: stringValue(layout.name, `Brand composition ${index + 1}`),
      prompt: stringValue(layout.prompt, ''),
    }
  }) : []
  const rawEditableSeeds = Array.isArray(source.editableTemplates) ? source.editableTemplates.map((item, index) => {
    const template = record(item)
    return {
      name: stringValue(template.name, staticSeeds[index]?.name || `Editable composition ${index + 1}`),
      bgPrompt: stringValue(template.bgPrompt, staticSeeds[index]?.prompt || ''),
      puppeteerConfig: normalizeConfig(template.puppeteerConfig, palette, typography, 'editable'),
    }
  }) : []
  // Preserve the measured reference geometry. Artificially forcing left/right
  // reversals here was a major source of visual drift from uploaded creatives.
  const editableSeeds = rawEditableSeeds
  const staticLayouts = staticSeeds.map((layout, index) => ({
    ...layout,
    prompt: ensureBackgroundContract(layout.prompt, editableSeeds[index]?.puppeteerConfig),
  }))
  const editableTemplates = editableSeeds.map((template, index) => ({
    ...template,
    bgPrompt: staticLayouts[index]?.prompt || ensureBackgroundContract(template.bgPrompt, template.puppeteerConfig),
  }))
  const hasProductUiEvidence = sourceEvidence.references.some(reference => reference.classifiedType === 'product-ui')
  const hasPhotographyEvidence = sourceEvidence.references.some(reference => reference.classifiedType === 'photography')
  const rawCarouselLayouts = Array.isArray(source.carouselLayouts) ? source.carouselLayouts.map((item, layoutIndex) => {
    const layout = record(item)
    const slidesSource = Array.isArray(layout.slides) ? layout.slides : []
    const rawName = stringValue(layout.name, `Carousel system ${layoutIndex + 1}`)
    return {
      name: evidenceSafeCarouselName(rawName, hasProductUiEvidence, hasPhotographyEvidence),
      slides: slidesSource.slice(0, 6).map((item, index) => {
        const slide = record(item)
        const role = ROLES[index]
        const puppeteerConfig = normalizeConfig(slide.puppeteerConfig, palette, typography, 'carousel', role)
        return {
          slideIndex: index + 1,
          role,
          prompt: ensureBackgroundContract(stringValue(slide.prompt, ''), puppeteerConfig),
          puppeteerConfig,
        }
      }),
    }
  }) : []
  const carouselLayouts = diversifyCarouselConfigs(rawCarouselLayouts)
  const infographicLayouts = Array.isArray(source.infographicLayouts)
    ? source.infographicLayouts.slice(0, 4).map((item, index) => {
      const layout = record(item)
      return {
        name: stringValue(layout.name, `${brandName} Infographic Layout ${index + 1}`),
        description: stringValue(layout.description, ''),
        isActive: layout.isActive !== false,
      }
    })
    : []

  return {
    brandName,
    sourceEvidence,
    visualBlueprints,
    brandDescription: stringValue(source.brandDescription, ''),
    infographicGuidelines: stringValue(source.infographicGuidelines, ''),
    infographicLayouts,
    palette,
    typography,
    staticLayouts,
    editableTemplates,
    carouselLayouts,
    warnings: Array.isArray(source.warnings)
      ? source.warnings.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
      : [],
  }
}

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Infographic guidelines are a production hand-off, not a short brand summary.
 * These checks remain advisory: a structurally valid setup can still be saved
 * while the repair pass develops the written specification further.
 */
export function getInfographicGuidelineIssues(value: string): string[] {
  const issues: string[] = []
  const guideline = value.trim()
  const lower = guideline.toLowerCase()

  const requirements: Array<[string, RegExp]> = [
    ['source authority', /source (?:authority|priority)/],
    ['production objective', /production objective/],
    ['color tokens', /color tokens?|approved palette/],
    ['approved contrast pairs', /contrast pairs?/],
    ['typography scale', /typography(?: roles)?(?: and)?(?: 1080x1080)? scale|type scale/],
    ['canvas and grid', /canvas[^\n]{0,80}grid|grid[^\n]{0,80}canvas/],
    ['safe areas', /safe (?:areas?|margins?)|text-safe/],
    ['spacing rules', /\bspacing\b/],
    ['reusable component anatomy', /component anatomy|reusable components?/],
    ['KPI/stat modules', /\bkpi\b|stat modules?/],
    ['charts and data encoding', /charts?[^\n]{0,80}data encoding|data encoding/],
    ['comparison/process/timeline/map rules', /comparisons?|process flows?|timelines?|\bmaps?\b/],
    ['visual assets', /visual motifs?|photography|icons?|illustrations?/],
    ['layout recipes', /layout recipes?/],
    ['light and dark variants', /light[^\n]{0,80}dark|dark[^\n]{0,80}light/],
    ['motion system', /motion infographic system|motion system|animation system/],
    ['timing and easing', /easing/],
    ['reduced motion', /reduced[- ]motion/],
    ['implementation guidance', /html\/css\/svg\/canvas|implementation/],
    ['accessibility', /accessibility/],
    ['do/don’t rules', /\bdo\b[\s/&–—-]+(?:don['’]t|not)\b/],
    ['preflight QA checklist', /preflight|qa checklist/],
  ]

  for (const [label, pattern] of requirements) {
    if (!pattern.test(lower)) issues.push(`infographicGuidelines is missing ${label}`)
  }

  return issues
}

function citedReferenceIndexes(prompt: string): number[] {
  const indexes = new Set<number>()
  const referencePattern = /\breference\s+(\d+)\b/gi
  let match: RegExpExecArray | null
  while ((match = referencePattern.exec(prompt)) !== null) indexes.add(Number(match[1]))
  return Array.from(indexes)
}

function validateBackgroundPrompt(prompt: string, label: string, minWords: number, issues: string[]) {
  const lower = prompt.toLowerCase()
  const creativeCore = lower.split(/technical production contract:/i)[0]
  const instructionCore = creativeCore
    .split('\n')
    .filter(line => !/^(?:evidence basis|reference blueprint|shared family evidence):/i.test(line.trim()))
    .join('\n')
  if (words(prompt) < minWords) issues.push(`${label} is too brief (${words(prompt)} words; minimum ${minWords})`)
  if (!lower.includes('analy') || !lower.includes('copy')) issues.push(`${label} must instruct analysis of the supplied copy`)
  if (!lower.includes('select') && !lower.includes('choose') && !lower.includes('adapt')) issues.push(`${label} must include reusable scene-selection logic`)
  if (!/\b\d{1,2}\s*%/.test(lower)) issues.push(`${label} must quantify its safe and visual zones with percentages`)
  if (!/1\s*:\s*1/.test(lower) || !lower.includes('1080')) issues.push(`${label} must specify square 1:1 1080x1080`)
  if (!lower.includes('safe zone') && !lower.includes('safe-zone')) issues.push(`${label} must define a text-safe zone`)
  if (!lower.includes('visual zone') && !lower.includes('visual-zone')) issues.push(`${label} must define the complementary visual zone`)
  if (!lower.includes('full-bleed') && !lower.includes('full bleed')) issues.push(`${label} must specify full-bleed behavior`)
  for (const required of ['no headline', 'no logo', 'no watermark', 'no brand name', 'no decorative fake text']) {
    if (!lower.includes(required)) issues.push(`${label} is missing the negative rule "${required}"`)
  }
  for (const section of ['purpose', 'evidence basis', 'reference blueprint', 'copy analysis', 'scene selection', 'layout', 'visual', 'density', 'restriction', 'final output']) {
    if (!lower.includes(section)) issues.push(`${label} is missing production section: ${section}`)
  }
  const evidenceSection = creativeCore.split('evidence basis:')[1]?.split('copy analysis:')[0] || ''
  if ((evidenceSection.match(/;/g) || []).length < 5) {
    issues.push(`${label} evidence basis must list at least 6 semicolon-separated atomic observations`)
  }
  const sceneSection = creativeCore.split('scene selection:')[1]?.split('layout:')[0] || ''
  const minimumSceneRules = label.startsWith('carousel') ? 4 : 5
  if ((sceneSection.match(/→/g) || []).length < minimumSceneRules) {
    issues.push(`${label} must contain at least ${minimumSceneRules} explicit topic → scene-selection rules`)
  }
  const restrictionsSection = creativeCore.split('restrictions:')[1]?.split('final output:')[0] || ''
  const minimumRestrictions = label.startsWith('carousel') ? 7 : 10
  const numberedRestrictions = restrictionsSection.match(/\b\d{1,2}[.)]\s/g) || []
  if (numberedRestrictions.length < minimumRestrictions) {
    issues.push(`${label} must contain at least ${minimumRestrictions} numbered concept-specific restrictions`)
  }
  if (hasPositiveOverlayRequest(instructionCore)) {
    issues.push(`${label} asks the image model to render or emphasize an overlay logo/brand mark`)
  }
  if (!creativeCore.includes('do not promote a minor reference icon into the primary hero')) {
    issues.push(`${label} must prevent minor reference icons from becoming generic hero imagery`)
  }
}

function validateRendererMapping(prompt: string, config: BrandSetupOverlayConfig, label: string, issues: string[]) {
  const lower = prompt.toLowerCase()
  const creativeCore = lower.split(/technical production contract:/i)[0]
  const textPercent = config.splitPercent ?? (config.splitLayout === 'free' ? 40 : 100 - config.splitRatio)
  if (!lower.includes('renderer mapping:')) issues.push(`${label} is missing the authoritative renderer mapping`)
  if (config.splitLayout === 'right-image' && !lower.includes(`left ${textPercent}% is the text-safe zone`)) {
    issues.push(`${label} conflicts with right-image renderer mapping`)
  }
  if (config.splitLayout === 'left-image' && !lower.includes(`right ${textPercent}% is the text-safe zone`)) {
    issues.push(`${label} conflicts with left-image renderer mapping`)
  }
  const expectedRegion = config.splitLayout === 'right-image'
    ? 'left'
    : config.splitLayout === 'left-image'
      ? 'right'
      : config.verticalAlign === 'top'
        ? 'top'
        : config.verticalAlign === 'bottom'
          ? 'bottom'
          : 'central'
  const directionalClaims: Array<{ region: string; percent: number | null }> = []
  const forwardPattern = /\b(left|right|top|bottom|central)\s+(\d{1,2})%\b[^.\n]{0,100}\btext-safe zone\b/g
  const reversePattern = /\btext-safe zone\b[^.\n]{0,100}\b(left|right|top|bottom|central)\s+(\d{1,2})%\b/g
  let claim: RegExpExecArray | null
  while ((claim = forwardPattern.exec(creativeCore)) !== null) directionalClaims.push({ region: claim[1], percent: Number(claim[2]) })
  while ((claim = reversePattern.exec(creativeCore)) !== null) directionalClaims.push({ region: claim[1], percent: Number(claim[2]) })
  for (const directionalClaim of directionalClaims) {
    if (directionalClaim.region !== expectedRegion || directionalClaim.percent !== textPercent) {
      issues.push(`${label} contains a conflicting ${directionalClaim.region} ${directionalClaim.percent}% text-safe-zone instruction before the renderer mapping`)
      break
    }
  }
}

export function validateBrandSetupResult(result: BrandSetupResult): string[] {
  const issues: string[] = []
  if (!result.sourceEvidence.references.length) {
    issues.push('sourceEvidence must contain one auditable entry per visual reference or carousel page')
  }
  result.sourceEvidence.references.forEach((reference, index) => {
    if (reference.observedTraits.length < 8) issues.push(`sourceEvidence reference ${index + 1} has fewer than 8 atomic observed traits`)
    if (!reference.allowedInfluence.length) issues.push(`sourceEvidence reference ${index + 1} must define allowed influence`)
    if (!reference.prohibitedInferences.length) issues.push(`sourceEvidence reference ${index + 1} must define prohibited inferences`)
    if (reference.classifiedType === 'logo-palette') {
      const restrictions = reference.prohibitedInferences.join(' ').toLowerCase()
      if (!/\blayouts?\b|\bcompositions?\b/.test(restrictions)) {
        issues.push(`sourceEvidence logo/palette reference ${index + 1} must prohibit layout or composition inference`)
      }
    }
    if (reference.classifiedType === 'campaign-creative') {
      const restrictions = reference.prohibitedInferences.join(' ').toLowerCase()
      if (/\blayouts?\b|\bcompositions?\b/.test(restrictions)) {
        issues.push(`sourceEvidence campaign reference ${index + 1} incorrectly prohibits layout or composition evidence`)
      }
    }
  })
  const structuralTraitPattern = /\b(?:x\s*=|y\s*=|\d{1,3}%|top|bottom|left|right|upper|lower|center|aligned|column|row|band|card|panel|block|margin|gap|crop|overlap|width|height)\b/i
  result.sourceEvidence.references.forEach((reference, index) => {
    const structuralTraits = reference.observedTraits.filter(trait => structuralTraitPattern.test(trait)).length
    if (structuralTraits < 4) issues.push(`sourceEvidence reference ${index + 1} lacks measured structural observations (${structuralTraits}; minimum 4)`)
  })
  const staticBlueprint = result.visualBlueprints.staticSystem
  const carouselBlueprint = result.visualBlueprints.carouselSystem
  if (staticBlueprint.zones.length < 2 || staticBlueprint.invariants.length < 1) {
    issues.push('visualBlueprints static system must define at least two measured zones and one invariant')
  }
  if (carouselBlueprint.referenceIndexes.length && (
    carouselBlueprint.slides.length !== 6
    || carouselBlueprint.recurringComponents.length < 1
    || result.sourceEvidence.repeatedPatterns.length < 2
  )) {
    issues.push('visualBlueprints carousel system must preserve six page blueprints, one recurring component, and two repeated layout patterns')
  }
  issues.push(...getInfographicGuidelineIssues(result.infographicGuidelines))
  if (result.infographicLayouts.length !== 4) issues.push('exactly 4 infographic layouts are required')
  result.infographicLayouts.forEach((layout, index) => {
    if (!layout.isActive) issues.push(`infographic layout ${index + 1} must be active`)
    if (words(layout.description) < 250) issues.push(`infographic layout ${index + 1} is too brief (${words(layout.description)} words; minimum 250)`)
    for (const section of ['purpose', 'content routing', 'canvas zones', 'component anatomy', 'motion sequence', 'restrictions', 'final output']) {
      if (!layout.description.toLowerCase().includes(section)) issues.push(`infographic layout ${index + 1} is missing ${section}`)
    }
  })
  const infographicNames = result.infographicLayouts.map(item => item.name.toLowerCase())
  if (new Set(infographicNames).size !== infographicNames.length) issues.push('infographic layout names must be unique')
  const brandGuide = result.brandDescription.toLowerCase()
  const requiredBrandSections = [
    'brand summary',
    'visual identity',
    'color palette',
    'typography',
    'style',
    'cta',
    'background imagery',
    'ui mockup',
    'icons and illustration',
  ]
  for (const section of requiredBrandSections) {
    if (!brandGuide.includes(section)) issues.push(`brandDescription is missing the ${section} section`)
  }
  if (result.staticLayouts.length !== 5) issues.push('exactly 5 static layouts are required')
  if (result.editableTemplates.length !== 5) issues.push('exactly 5 editable templates are required')
  if (result.carouselLayouts.length !== 2) issues.push('exactly 2 carousel layouts are required')

  const staticReferenceIndexes = result.sourceEvidence.references
    .filter(reference => reference.declaredType === 'static-creative')
    .map(reference => reference.referenceIndex)
  const carouselReferenceIndexes = result.sourceEvidence.references
    .filter(reference => reference.declaredType === 'carousel-slide')
    .map(reference => reference.referenceIndex)
  const staticReferenceSet = new Set(staticReferenceIndexes)

  result.staticLayouts.forEach((layout, index) => {
    validateBackgroundPrompt(layout.prompt, `static layout ${index + 1}`, 260, issues)
    if (result.editableTemplates[index]) validateRendererMapping(layout.prompt, result.editableTemplates[index].puppeteerConfig, `static layout ${index + 1}`, issues)
    if (staticReferenceIndexes.length) {
      const cited = citedReferenceIndexes(layout.prompt)
      if (!cited.some(referenceIndex => staticReferenceSet.has(referenceIndex)) || cited.some(referenceIndex => !staticReferenceSet.has(referenceIndex))) {
        issues.push(`static layout ${index + 1} violates reference grouping; cite only standalone-static reference(s) ${staticReferenceIndexes.join(', ')}`)
      }
    }
  })
  result.editableTemplates.forEach((template, index) => {
    validateBackgroundPrompt(template.bgPrompt, `editable template ${index + 1}`, 260, issues)
    validateRendererMapping(template.bgPrompt, template.puppeteerConfig, `editable template ${index + 1}`, issues)
  })

  const normalizedPrompts = new Set<string>()
  for (let layoutIndex = 0; layoutIndex < result.carouselLayouts.length; layoutIndex++) {
    const layout = result.carouselLayouts[layoutIndex]
    if (layout.slides.length !== 6) {
      issues.push(`carousel layout ${layoutIndex + 1} must contain 6 slides`)
      continue
    }
    layout.slides.forEach((slide, slideIndex) => {
      if (slide.slideIndex !== slideIndex + 1 || slide.role !== ROLES[slideIndex]) {
        issues.push(`carousel layout ${layoutIndex + 1}, slide ${slideIndex + 1} has an invalid index or role`)
      }
      validateBackgroundPrompt(slide.prompt, `carousel ${layoutIndex + 1}, slide ${slideIndex + 1}`, 180, issues)
      validateRendererMapping(slide.prompt, slide.puppeteerConfig, `carousel ${layoutIndex + 1}, slide ${slideIndex + 1}`, issues)
      if (carouselReferenceIndexes.length) {
        const cited = citedReferenceIndexes(slide.prompt)
        if (cited.some(referenceIndex => staticReferenceSet.has(referenceIndex))) {
          issues.push(`carousel ${layoutIndex + 1}, slide ${slideIndex + 1} violates reference grouping by citing a standalone-static reference`)
        }
        const expectedReference = layoutIndex === 0 && carouselReferenceIndexes.length === 6
          ? carouselReferenceIndexes[slideIndex]
          : null
        if (expectedReference && !cited.includes(expectedReference)) {
          issues.push(`carousel 1, slide ${slideIndex + 1} violates ordered reference grouping; it must cite carousel reference ${expectedReference}`)
        }
      }
      const signature = slide.prompt.toLowerCase().replace(/\s+/g, ' ').trim()
      if (normalizedPrompts.has(signature)) issues.push(`carousel ${layoutIndex + 1}, slide ${slideIndex + 1} duplicates another prompt`)
      normalizedPrompts.add(signature)
    })
  }

  const staticNames = result.staticLayouts.map(item => item.name.toLowerCase())
  if (new Set(staticNames).size !== staticNames.length) issues.push('static layout names must be unique')
  const carouselNames = result.carouselLayouts.map(item => item.name.toLowerCase())
  if (new Set(carouselNames).size !== carouselNames.length) issues.push('carousel layout names must be unique')
  if (result.carouselLayouts.length === 2 && result.carouselLayouts.every(layout => layout.slides.length === 6)) {
    const rendererSequence = (layout: BrandSetupResult['carouselLayouts'][number]) => layout.slides.map(slide => {
      const config = slide.puppeteerConfig
      return [config.splitLayout, config.splitPercent, config.bgColor, config.textAlign, config.verticalAlign].join('|')
    })
    const first = rendererSequence(result.carouselLayouts[0])
    const second = rendererSequence(result.carouselLayouts[1])
    const matchingSlides = first.filter((signature, index) => signature === second[index]).length
    if (matchingSlides > 2) issues.push(`carousel families reuse the same renderer composition on ${matchingSlides} of 6 corresponding slides; at least 4 must differ`)
  }
  const hasProductUiEvidence = result.sourceEvidence.references.some(reference => reference.classifiedType === 'product-ui')
  if (!hasProductUiEvidence && result.carouselLayouts.some(layout => /\b(product|ui)\b/i.test(layout.name))) {
    issues.push('a carousel is labeled Product/UI without a product-ui reference; photographed cards do not qualify')
  }
  return issues
}

export function getBlockingBrandSetupIssues(issues: string[]): string[] {
  return issues.filter(issue => {
    if (issue.includes('exactly ') || issue.includes('must contain 6 slides') || issue.includes('invalid index or role')) return true
    // All necessary headings must be present, but their bodies may be empty
    // when the available sources contain no verified evidence for that section.
    if (issue.startsWith('brandDescription is missing')) return true
    return false
  })
}
