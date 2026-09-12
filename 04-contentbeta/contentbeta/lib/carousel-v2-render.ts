import type { OverlayLayerKey } from '@/lib/overlay-positions'
import { overlayMovePatch } from '@/lib/overlay-positions'

export interface CarouselCopySlide {
  slideType?: string
  eyebrow?: string | null
  headline?: string
  subhead?: string
  bullets?: string[]
  ctaText?: string | null
  carouselTitle?: string | null
  splitPercent?: number
  logoPos?: string
}

export function applyCfgMove(cfg: Record<string, unknown>, key: OverlayLayerKey, x: number, y: number): Record<string, unknown> {
  if (key === 'cta') {
    const ctaStyle = { ...((cfg.ctaStyle as Record<string, unknown>) || {}), x, y }
    return { ...cfg, ctaStyle }
  }
  return { ...cfg, ...overlayMovePatch(key, x, y) }
}

export function applyCfgReset(cfg: Record<string, unknown>, key: OverlayLayerKey): Record<string, unknown> {
  if (key === 'cta') {
    const ctaStyle = { ...((cfg.ctaStyle as Record<string, unknown>) || {}), x: 60, y: 900 }
    return { ...cfg, ctaStyle }
  }
  const next = { ...cfg }
  if (key === 'stack') { next.textX = null; next.textY = null }
  if (key === 'eyebrow') { next.eyebrowX = null; next.eyebrowY = null }
  if (key === 'headline') { next.headlineX = null; next.headlineY = null }
  if (key === 'microcopy') { next.microcopyX = null; next.microcopyY = null }
  if (key === 'bullets') { next.bulletsX = null; next.bulletsY = null }
  if (key === 'logo') { next.logoX = null; next.logoY = null }
  return next
}

export function buildV2RenderPayload(opts: {
  slide: CarouselCopySlide
  cfg: Record<string, unknown>
  colors: { primaryColor: string; accentColor: string; textColor: string }
  bgImageUrl?: string | null
  bgImageDataUrl?: string | null
  logoUrl: string | null
  subjectImageDataUrl?: string | null
}): Record<string, unknown> {
  const { slide, cfg, colors, bgImageUrl, bgImageDataUrl, logoUrl, subjectImageDataUrl } = opts
  const ctaStyle = (cfg.ctaStyle as Record<string, unknown>) || {}
  const effectivePrimary = (cfg.primaryColor as string | null) || colors.primaryColor
  const effectiveAccent = (cfg.accentColor as string | null) || colors.accentColor
  const effectiveText = (cfg.textColor as string | null) || colors.textColor
  return {
    v2: true,
    slideType: slide?.slideType,
    headline: slide?.headline || '',
    microcopy: slide?.subhead || '',
    eyebrow: slide?.eyebrow || null,
    carouselTitle: slide?.carouselTitle || null,
    bullets: slide?.bullets || [],
    splitPercent: (cfg.splitPercent as number | null) ?? slide?.splitPercent ?? null,
    textX: (cfg.textX as number | null) ?? null,
    textY: (cfg.textY as number | null) ?? null,
    headlineX: (cfg.headlineX as number | null) ?? null,
    headlineY: (cfg.headlineY as number | null) ?? null,
    microcopyX: (cfg.microcopyX as number | null) ?? null,
    microcopyY: (cfg.microcopyY as number | null) ?? null,
    eyebrowX: (cfg.eyebrowX as number | null) ?? null,
    eyebrowY: (cfg.eyebrowY as number | null) ?? null,
    bulletsX: (cfg.bulletsX as number | null) ?? null,
    bulletsY: (cfg.bulletsY as number | null) ?? null,
    primaryColor: effectivePrimary,
    accentColorV2: effectiveAccent,
    textColor: effectiveText,
    microcopyColorV2: (cfg.microcopyColor as string | null) || null,
    bgImageUrl: bgImageUrl || null,
    bgImageDataUrl: bgImageDataUrl || null,
    subjectImageDataUrl: subjectImageDataUrl || null,
    logoUrl,
    logoPosition: (cfg.logoPosition as string | null) || slide?.logoPos || 'bottom-left',
    logoX: cfg.logoX ?? null,
    logoY: cfg.logoY ?? null,
    logoSize: (cfg.logoSize as number | null) || 48,
    headlineSize: (cfg.headlineSize as number | null) || null,
    microcopySize: (cfg.microcopySize as number | null) || null,
    bulletSize: (cfg.bulletSize as number | null) || null,
    eyebrowSize: (cfg.eyebrowSize as number | null) || null,
    eyebrowUppercase: cfg.eyebrowUppercase != null ? cfg.eyebrowUppercase : null,
    ctaPosition: (cfg.ctaPosition as string | null) || null,
    headlineFontFamily: (cfg.headlineFontFamily as string | null) || null,
    headlineCustomFontDataUrl: (cfg.headlineCustomFontDataUrl as string | null) || null,
    eyebrowFontFamily: (cfg.eyebrowFontFamily as string | null) || null,
    eyebrowCustomFontDataUrl: (cfg.eyebrowCustomFontDataUrl as string | null) || null,
    microcopyFontFamily: (cfg.microcopyFontFamily as string | null) || null,
    microcopyCustomFontDataUrl: (cfg.microcopyCustomFontDataUrl as string | null) || null,
    bulletFontFamily: (cfg.bulletFontFamily as string | null) || null,
    bulletCustomFontDataUrl: (cfg.bulletCustomFontDataUrl as string | null) || null,
    ctaFontFamily: (cfg.ctaFontFamily as string | null) || null,
    ctaCustomFontDataUrl: (cfg.ctaCustomFontDataUrl as string | null) || null,
    accentFontFamily: (cfg.accentFontFamily as string | null) || null,
    accentCustomFontDataUrl: (cfg.accentCustomFontDataUrl as string | null) || null,
    accentBgEnabled: (cfg.accentBgEnabled as boolean) || false,
    accentBgColor: (cfg.accentBgColor as string | null) || null,
    accentBgPadding: (cfg.accentBgPadding as number) ?? 4,
    accentBgRadius: (cfg.accentBgRadius as number) ?? 2,
    accentUnderline: (cfg.accentUnderline as boolean) || false,
    eyebrowGap: (cfg.eyebrowGap as number | null) ?? null,
    headlineGap: (cfg.headlineGap as number | null) ?? null,
    subheadGap: (cfg.subheadGap as number | null) ?? null,
    padding: (cfg.padding as number | null) || 60,
    verticalAlign: (cfg.verticalAlign as string | null) || 'center',
    fontFamily: (cfg.fontFamily as string | null) || null,
    customFontDataUrl: (cfg.customFontDataUrl as string | null) || null,
    elements: (cfg.elements as unknown[]) || [],
    cta: slide?.ctaText ? {
      text: slide.ctaText,
      bgColor: ctaStyle.bgColor as string || '#ffffff',
      textColor: ctaStyle.textColor as string || effectivePrimary,
      fontSize: ctaStyle.fontSize as number || 14,
      paddingX: ctaStyle.paddingX as number || 36,
      paddingY: ctaStyle.paddingY as number || 18,
      borderRadius: ctaStyle.borderRadius as number || 4,
      x: ctaStyle.x as number || 0,
      y: ctaStyle.y as number || 0,
    } : null,
  }
}
