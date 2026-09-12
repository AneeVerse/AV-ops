import type { BrandTokens } from './types'

export const CANVAS = {
  widthIn: 13.333,
  heightIn: 7.5,
} as const

// Keep slide content clear of the optional vertical decoration on the right.
// The decoration itself starts at 12.283" and is rendered at its natural
// aspect ratio; the extra gap prevents cards, charts, and tables from touching it.
export const CONTENT_SAFE = {
  x: 0.55,
  right: 12.05,
  width: 11.5,
} as const

// Convert inches to pixels for the 1920×1080 preview canvas
// 1920 / 13.333 = 144 px/inch
export const PX_PER_INCH = 144

export function inchesToPx(inches: number): number {
  return Math.round(inches * PX_PER_INCH)
}

// Z-index layers
export const Z = {
  background: 0,
  contentBackground: 5,
  decorative: 8,
  content: 10,
  overlay: 15,
  chrome: 20,
} as const

// Master element positions (inches) — same for all brands
export const MASTER = {
  accentBar:   { x: 0,     y: 0,    w: 0.08, h: 7.5  },   // thin left edge bar
  logoArea:    { x: 11.08, y: 0.20, w: 2.0,  h: 0.38 },   // top-right logo
  pageNum:     { x: 11.65, y: 7.25, w: 0.35, h: 0.18 },   // bottom-right, before side decoration
  eyebrow:     { x: 0.55,  y: 0.30, w: 10.0, h: 0.22 },
  titleLine:   { x: 0.55,  y: 0.65, w: 10.3, h: 0.85 },   // narrowed to clear top-right logo
  subtitleLine:{ x: 0.55,  y: 1.55, w: 11.2, h: 0.45 },
  contentArea: { x: CONTENT_SAFE.x, y: 2.1, w: CONTENT_SAFE.width, h: 5.0 },
} as const

export function buildTokens(
  palette: Record<string, string>,
  logoUrl?: string | null,
  decorationUrl?: string | null,
  logoDarkUrl?: string | null,
): BrandTokens {
  return {
    primary:      palette.primary_color  || palette.primaryColor  || '#6366f1',
    accent:       palette.accent_color   || palette.accentColor   || '#8b5cf6',
    dark:         palette.dark_color     || palette.darkColor     || '#1a1a1a',
    light:        palette.light_color    || palette.lightColor    || '#F2F3F3',
    white:        '#FFFFFF',
    headlineFont: palette.heading_font   || palette.headingFont   || 'Arial',
    bodyFont:     palette.body_font      || palette.bodyFont      || 'Calibri',
    logoUrl:      logoUrl ?? null,
    logoDarkUrl:  logoDarkUrl ?? null,
    decorationUrl: decorationUrl ?? null,
  }
}
