export type OverlayLayerKey = 'stack' | 'eyebrow' | 'headline' | 'microcopy' | 'bullets' | 'logo' | 'cta'

export const OVERLAY_LAYER_LABELS: Record<OverlayLayerKey, string> = {
  stack: 'Stack',
  eyebrow: 'Eyebrow',
  headline: 'Headline',
  microcopy: 'Subhead',
  bullets: 'Bullets',
  logo: 'Logo',
  cta: 'CTA',
}

export const OVERLAY_POSITION_KEYS = [
  'textX', 'textY', 'textPosition',
  'headlineX', 'headlineY',
  'microcopyX', 'microcopyY',
  'eyebrowX', 'eyebrowY',
  'bulletsX', 'bulletsY',
  'logoX', 'logoY',
] as const

export function overlayMovePatch(key: OverlayLayerKey, x: number, y: number): Record<string, number> {
  switch (key) {
    case 'stack': return { textX: x, textY: y }
    case 'eyebrow': return { eyebrowX: x, eyebrowY: y }
    case 'headline': return { headlineX: x, headlineY: y }
    case 'microcopy': return { microcopyX: x, microcopyY: y }
    case 'bullets': return { bulletsX: x, bulletsY: y }
    case 'logo': return { logoX: x, logoY: y }
    case 'cta': return { ctaX: x, ctaY: y }
  }
}

export function overlayResetPatch(key: OverlayLayerKey): Record<string, null> {
  switch (key) {
    case 'stack': return { textX: null, textY: null }
    case 'eyebrow': return { eyebrowX: null, eyebrowY: null }
    case 'headline': return { headlineX: null, headlineY: null }
    case 'microcopy': return { microcopyX: null, microcopyY: null }
    case 'bullets': return { bulletsX: null, bulletsY: null }
    case 'logo': return { logoX: null, logoY: null }
    case 'cta': return { ctaX: null, ctaY: null }
  }
}

/** Style fingerprint that ignores live pixel positions so drag does not reload the iframe. */
export function overlayStyleKey(payload: Record<string, unknown>): string {
  const copy: Record<string, unknown> = { ...payload }
  for (const key of OVERLAY_POSITION_KEYS) delete copy[key]
  if (copy.cta && typeof copy.cta === 'object') {
    const cta = { ...(copy.cta as Record<string, unknown>) }
    delete cta.x
    delete cta.y
    copy.cta = cta
  }
  return JSON.stringify(copy)
}
