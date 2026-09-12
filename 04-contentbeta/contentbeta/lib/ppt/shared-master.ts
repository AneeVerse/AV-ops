import type { ResolvedElement, BrandTokens } from './types'
import { MASTER, Z, CANVAS } from './design-tokens'

export type MasterType = 'light' | 'dark' | 'cover'

export function masterBackground(type: MasterType, tokens: BrandTokens): string {
  if (type === 'cover' || type === 'dark') return tokens.dark
  return tokens.light
}

export function buildMasterElements(
  slideId: string,
  type: MasterType,
  pageNumber: number,
  tokens: BrandTokens
): ResolvedElement[] {
  if (type === 'cover') return []   // cover slides handle their own chrome

  const isDark = type === 'dark'
  const elements: ResolvedElement[] = []

  // Left accent bar
  elements.push({
    id: `${slideId}_bar`,
    type: 'rect',
    bounds: MASTER.accentBar,
    z: Z.chrome,
    visible: true,
    style: { fill: tokens.primary },
  })

  // Logo — use dark-bg logo on dark slides, light-bg logo otherwise
  const logoAsset = isDark ? (tokens.logoDarkUrl ?? tokens.logoUrl) ?? undefined : tokens.logoUrl ?? undefined
  if (logoAsset) {
    elements.push({
      id: `${slideId}_logo`,
      type: 'image',
      bounds: MASTER.logoArea,
      z: Z.chrome,
      visible: true,
      assetId: logoAsset,
      imageFit: 'contain',
    })
  }

  // Page number (bottom-right)
  elements.push({
    id: `${slideId}_pgnum`,
    type: 'text',
    bounds: MASTER.pageNum,
    z: Z.chrome,
    visible: true,
    text: {
      content: String(pageNumber),
      fontFamily: tokens.bodyFont,
      fontSizePt: 8,
      fontWeight: 'normal',
      color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
      align: 'right',
      verticalAlign: 'middle',
      lineHeightMultiplier: 1,
    },
  })

  return elements
}

export function buildHeader(
  slideId: string,
  type: MasterType,
  tokens: BrandTokens,
  opts: { eyebrow?: string; title: string; subtitle?: string; titleWidth?: number }
): ResolvedElement[] {
  const isDark = type === 'dark'
  const textColor = isDark ? tokens.white : tokens.dark
  const elements: ResolvedElement[] = []

  if (opts.eyebrow) {
    elements.push({
      id: `${slideId}_eyebrow`,
      type: 'text',
      bounds: MASTER.eyebrow,
      z: Z.content,
      visible: true,
      text: {
        content: opts.eyebrow,
        fontFamily: tokens.bodyFont,
        fontSizePt: 8,
        fontWeight: 'normal',
        color: tokens.primary,
        align: 'left',
        verticalAlign: 'top',
        lineHeightMultiplier: 1.2,
        uppercase: true,
        overflow: 'clip',
      },
    })
  }

  elements.push({
    id: `${slideId}_title`,
    type: 'text',
    bounds: { ...MASTER.titleLine, w: opts.titleWidth ?? MASTER.titleLine.w },
    z: Z.content,
    visible: true,
    text: {
      content: opts.title ?? '',
      fontFamily: tokens.headlineFont,
      fontSizePt: 32,
      fontWeight: 'bold',
      color: textColor,
      align: 'left',
      verticalAlign: 'top',
      lineHeightMultiplier: 1.1,
      overflow: 'fitted',
    },
  })

  if (opts.subtitle) {
    elements.push({
      id: `${slideId}_subtitle`,
      type: 'text',
      bounds: MASTER.subtitleLine,
      z: Z.content,
      visible: true,
      text: {
        content: opts.subtitle,
        fontFamily: tokens.bodyFont,
        fontSizePt: 14,
        fontWeight: 'normal',
        color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
        align: 'left',
        verticalAlign: 'top',
        lineHeightMultiplier: 1.4,
        overflow: 'fitted',
      },
    })
  }

  return elements
}

// Avoid unused import warning
const _unusedCanvas = CANVAS
void _unusedCanvas
