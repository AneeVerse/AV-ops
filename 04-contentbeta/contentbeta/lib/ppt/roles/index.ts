import type {
  ResolvedElement, SlideRole, BrandTokens, TextProps,
  CoverHeroSpec, SectionDividerSpec, AgendaSpec, BulletsSpec,
  TwoColumnSpec, StatCalloutSpec, KpiGridSpec, ImageBodySpec,
  QuoteAttributionSpec, TimelineSpec, ComparisonSpec, ClosingCtaSpec,
  ChartBarSpec, ChartDoughnutSpec,
} from '../types'
import { Z, CANVAS } from '../design-tokens'
import { buildMasterElements, buildHeader } from '../shared-master'
import { interpretLayout } from '../layout-interpreter'
import { DEFAULT_LAYOUTS } from '../slide-layouts'
import type { JsonSlideLayout } from '../layout-schema'

export interface LayoutDefinition {
  role: SlideRole
  masterType: 'light' | 'dark' | 'cover'
  compile: (spec: unknown, tokens: BrandTokens, slideId: string, pageNumber: number, layoutOverride?: JsonSlideLayout) => { background: string; elements: ResolvedElement[] }
}

// Helper to make a rect element
function rect(
  id: string, x: number, y: number, w: number, h: number, fill: string,
  z: number = Z.content,
  opts?: { opacity?: number; borderRadius?: number; stroke?: string; strokeWidth?: number }
): ResolvedElement {
  return { id, type: 'rect', bounds: { x, y, w, h }, z, visible: true, style: { fill, ...opts } }
}

// Helper to make a text element
function text(
  id: string, x: number, y: number, w: number, h: number,
  content: string,
  props: Partial<TextProps>,
  z: number = Z.content
): ResolvedElement {
  return {
    id, type: 'text', bounds: { x, y, w, h }, z, visible: true,
    text: {
      fontFamily: 'Arial', fontSizePt: 14, fontWeight: 'normal',
      color: '#1a1a1a', align: 'left', verticalAlign: 'top',
      lineHeightMultiplier: 1.4, overflow: 'fitted',
      // AI-generated slide specs are cast to typed shapes without runtime validation —
      // a "required" field the model omitted surfaces here as undefined, not ''.
      content: content ?? '',
      ...props,
    } as TextProps,
  }
}

// Helper: if a JSON layout is available (default or brand override), use it.
function useLayout(
  role: SlideRole,
  override: JsonSlideLayout | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: any,
  tokens: BrandTokens,
  slideId: string,
  pageNumber: number,
): { background: string; elements: ResolvedElement[] } | null {
  const layout = override ?? DEFAULT_LAYOUTS[role]
  if (!layout) return null
  return interpretLayout(layout, tokens, spec, slideId, pageNumber)
}

function doughnutAccentColors(tokens: BrandTokens): string[] {
  const primary = tokens.primary.toLowerCase()
  return Array.from(new Set([
    tokens.accent,
    tokens.dark,
    '#747875',
    '#b0b4b2',
    '#d9dddd',
  ].filter(color => color && color.toLowerCase() !== primary)))
}

const LAYOUTS: Record<SlideRole, LayoutDefinition> = {

  // ── 1. Cover Hero ──────────────────────────────────────────────────────────
  cover_hero: {
    role: 'cover_hero',
    masterType: 'cover',
    compile(specUnknown, tokens, slideId, _pageNumber, layoutOverride) {
      const r = useLayout('cover_hero', layoutOverride, specUnknown, tokens, slideId, _pageNumber)
      if (r) return r
      const spec = specUnknown as CoverHeroSpec
      const bg = tokens.dark
      const hasImage = !!spec.heroImageUrl
      const textW = 10.5
      const textX = 0.7

      const elements: ResolvedElement[] = [
        rect(`${slideId}_bg`, 0, 0, CANVAS.widthIn, CANVAS.heightIn, bg, Z.background),
      ]

      if (hasImage) {
        // Hero image — full slide bleed
        elements.push({
          id: `${slideId}_hero`, type: 'image',
          bounds: { x: 0, y: 0, w: CANVAS.widthIn, h: CANVAS.heightIn },
          z: Z.contentBackground, visible: true, assetId: spec.heroImageUrl!, imageFit: 'cover',
        })
        // Semi-transparent dark overlay so text is readable
        elements.push(
          rect(`${slideId}_overlay`, 0, 0, CANVAS.widthIn, CANVAS.heightIn,
            tokens.dark, Z.contentBackground + 1, { opacity: 0.58 })
        )
      }

      // Left accent stripe (on top of overlay)
      elements.push(rect(`${slideId}_stripe`, 0, 0, 0.08, CANVAS.heightIn, tokens.primary, Z.decorative))

      elements.push(
        text(`${slideId}_title`, textX, 1.8, textW, 2.5, spec.title, {
          fontFamily: tokens.headlineFont, fontSizePt: 52, fontWeight: 'bold',
          color: tokens.white, lineHeightMultiplier: 1.05, overflow: 'fitted',
        }, Z.content)
      )
      if (spec.tagline) elements.push(
        text(`${slideId}_tagline`, textX, 1.35, textW, 0.35, spec.tagline, {
          fontFamily: tokens.bodyFont, fontSizePt: 10, fontWeight: 'normal',
          color: tokens.primary, uppercase: true, lineHeightMultiplier: 1.2,
          overflow: 'clip',
        }, Z.content)
      )
      if (spec.subtitle) elements.push(
        text(`${slideId}_subtitle`, textX, 4.45, textW, 0.7, spec.subtitle, {
          fontFamily: tokens.bodyFont, fontSizePt: 16, fontWeight: 'normal',
          color: 'rgba(255,255,255,0.75)', lineHeightMultiplier: 1.4, overflow: 'fitted',
        }, Z.content)
      )
      if (spec.date) elements.push(
        text(`${slideId}_date`, textX, 5.25, 4.0, 0.3, spec.date, {
          fontFamily: tokens.bodyFont, fontSizePt: 10, fontWeight: 'normal',
          color: 'rgba(255,255,255,0.45)', lineHeightMultiplier: 1.2, overflow: 'clip',
        }, Z.content)
      )
      if (tokens.logoDarkUrl || tokens.logoUrl) elements.push({
        id: `${slideId}_logo`, type: 'image',
        bounds: { x: 0.7, y: 6.8, w: 2.0, h: 0.45 },
        z: Z.chrome, visible: true, assetId: (tokens.logoDarkUrl ?? tokens.logoUrl) ?? undefined, imageFit: 'contain',
      })
      return { background: bg, elements }
    },
  },

  // ── 2. Section Divider ────────────────────────────────────────────────────
  section_divider: {
    role: 'section_divider',
    masterType: 'dark',
    compile(specUnknown, tokens, slideId, _pageNumber, layoutOverride) {
      const r = useLayout('section_divider', layoutOverride, specUnknown, tokens, slideId, _pageNumber)
      if (r) return r
      const spec = specUnknown as SectionDividerSpec
      const bg = tokens.dark
      const elements: ResolvedElement[] = [
        rect(`${slideId}_bg`, 0, 0, CANVAS.widthIn, CANVAS.heightIn, bg, Z.background),
        rect(`${slideId}_bar`, 0, 0, 0.08, CANVAS.heightIn, tokens.primary, Z.chrome),
      ]
      if (spec.sectionNumber) elements.push(
        text(`${slideId}_num`, 1.5, 1.5, 3.0, 0.9, spec.sectionNumber, {
          fontFamily: tokens.headlineFont, fontSizePt: 60, fontWeight: 'bold',
          color: tokens.primary, align: 'left', verticalAlign: 'top',
          lineHeightMultiplier: 1, overflow: 'clip',
        }, Z.decorative)
      )
      elements.push(
        text(`${slideId}_title`, 1.5, spec.sectionNumber ? 2.6 : 2.2, 10.0, 2.0, spec.title, {
          fontFamily: tokens.headlineFont, fontSizePt: 44, fontWeight: 'bold',
          color: tokens.white, lineHeightMultiplier: 1.1, overflow: 'fitted',
        }, Z.content)
      )
      if (spec.subtitle) elements.push(
        text(`${slideId}_sub`, 1.5, spec.sectionNumber ? 4.8 : 4.4, 9.0, 0.65, spec.subtitle, {
          fontFamily: tokens.bodyFont, fontSizePt: 16, fontWeight: 'normal',
          color: 'rgba(255,255,255,0.65)', lineHeightMultiplier: 1.4, overflow: 'fitted',
        }, Z.content)
      )
      if (tokens.logoDarkUrl || tokens.logoUrl) elements.push({
        id: `${slideId}_logo`, type: 'image',
        bounds: { x: 11.08, y: 0.20, w: 2.0, h: 0.38 },
        z: Z.chrome, visible: true, assetId: (tokens.logoDarkUrl ?? tokens.logoUrl) ?? undefined, imageFit: 'contain',
      })
      return { background: bg, elements }
    },
  },

  // ── 3. Agenda ─────────────────────────────────────────────────────────────
  agenda: {
    role: 'agenda',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('agenda', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as AgendaSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
      ]
      const items = (spec.items || []).slice(0, 8)
      const cols = items.length > 4 ? 2 : 1
      const colW = cols === 2 ? 5.8 : 11.8
      const startX = 0.55
      const startY = 2.15
      const itemH = cols === 2
        ? Math.min(0.72, 4.7 / Math.ceil(items.length / 2))
        : Math.min(0.72, 4.7 / items.length)

      items.forEach((item, i) => {
        const col = cols === 2 ? Math.floor(i / Math.ceil(items.length / 2)) : 0
        const row = cols === 2 ? i % Math.ceil(items.length / 2) : i
        const x = startX + col * 6.2
        const y = startY + row * itemH
        elements.push(
          rect(`${slideId}_dot_${i}`, x, y + 0.05, 0.14, 0.14, tokens.primary, Z.content, { borderRadius: 99 }),
          text(`${slideId}_item_${i}`, x + 0.28, y, colW - 0.28, itemH, item, {
            fontFamily: tokens.bodyFont, fontSizePt: 15, fontWeight: 'normal',
            color: tokens.dark, lineHeightMultiplier: 1.3, overflow: 'fitted',
          }, Z.content)
        )
      })
      return { background: bg, elements }
    },
  },

  // ── 4. Bullets ────────────────────────────────────────────────────────────
  bullets: {
    role: 'bullets',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('bullets', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as BulletsSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title, subtitle: spec.subtitle }),
      ]
      const bullets = (spec.bullets || []).slice(0, 5)
      const contentY = spec.subtitle ? 2.1 : 1.85
      const itemH = Math.min(0.85, 4.8 / bullets.length)
      bullets.forEach((b, i) => {
        const y = contentY + i * itemH
        elements.push(
          rect(`${slideId}_bullet_${i}`, 0.55, y + 0.06, 0.1, 0.1, tokens.primary, Z.content, { borderRadius: 99 }),
          text(`${slideId}_body_${i}`, 0.85, y, 11.4, itemH, b, {
            fontFamily: tokens.bodyFont, fontSizePt: 18, fontWeight: 'normal',
            color: tokens.dark, lineHeightMultiplier: 1.35, overflow: 'fitted',
          }, Z.content)
        )
      })
      return { background: bg, elements }
    },
  },

  // ── 5. Two Column ─────────────────────────────────────────────────────────
  two_column: {
    role: 'two_column',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('two_column', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as TwoColumnSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
        // Divider line
        rect(`${slideId}_divider`, 6.7, 2.1, 0.02, 4.8, 'rgba(0,0,0,0.12)', Z.decorative),
      ]
      ;[
        { heading: spec.leftHeading, bullets: spec.leftBullets, x: 0.55 },
        { heading: spec.rightHeading, bullets: spec.rightBullets, x: 7.0 },
      ].forEach(({ heading, bullets, x }, col) => {
        let y = 2.15
        if (heading) {
          elements.push(text(`${slideId}_hd_${col}`, x, y, 5.8, 0.4, heading, {
            fontFamily: tokens.headlineFont, fontSizePt: 15, fontWeight: 'bold',
            color: tokens.primary, lineHeightMultiplier: 1.2, overflow: 'clip',
          }, Z.content))
          y += 0.5
        }
        const items = (bullets || []).slice(0, 5)
        const itemH = Math.min(0.75, (6.7 - y) / Math.max(items.length, 1))
        items.forEach((b, i) => {
          const iy = y + i * itemH
          elements.push(
            rect(`${slideId}_dot_${col}_${i}`, x, iy + 0.06, 0.1, 0.1, tokens.primary, Z.content, { borderRadius: 99 }),
            text(`${slideId}_b_${col}_${i}`, x + 0.22, iy, 5.58, itemH, b, {
              fontFamily: tokens.bodyFont, fontSizePt: 14, fontWeight: 'normal',
              color: tokens.dark, lineHeightMultiplier: 1.3, overflow: 'fitted',
            }, Z.content)
          )
        })
      })
      return { background: bg, elements }
    },
  },

  // ── 6. Stat Callout ───────────────────────────────────────────────────────
  stat_callout: {
    role: 'stat_callout',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('stat_callout', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as StatCalloutSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
        // Big stat
        text(`${slideId}_stat`, 0.55, 2.3, 12.5, 2.8, spec.stat, {
          fontFamily: tokens.headlineFont, fontSizePt: 108, fontWeight: 'bold',
          color: tokens.primary, align: 'center', verticalAlign: 'middle',
          lineHeightMultiplier: 1, overflow: 'fitted',
        }, Z.content),
        text(`${slideId}_stat_label`, 0.55, 5.1, 12.5, 0.55, spec.statLabel, {
          fontFamily: tokens.bodyFont, fontSizePt: 20, fontWeight: 'normal',
          color: tokens.dark, align: 'center', lineHeightMultiplier: 1.3, overflow: 'fitted',
        }, Z.content),
      ]
      if (spec.body) elements.push(
        text(`${slideId}_body`, 2.5, 5.75, 8.5, 0.9, spec.body, {
          fontFamily: tokens.bodyFont, fontSizePt: 13, fontWeight: 'normal',
          color: 'rgba(0,0,0,0.5)', align: 'center', lineHeightMultiplier: 1.4, overflow: 'fitted',
        }, Z.content)
      )
      return { background: bg, elements }
    },
  },

  // ── 7. KPI Grid ───────────────────────────────────────────────────────────
  kpi_grid: {
    role: 'kpi_grid',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('kpi_grid', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as KpiGridSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
      ]
      const kpis = (spec.kpis || []).slice(0, 6)
      const cols = kpis.length <= 3 ? kpis.length : kpis.length <= 4 ? 2 : 3
      const rows = Math.ceil(kpis.length / cols)
      const cardW = (12.2 - (cols - 1) * 0.25) / cols
      const cardH = (4.6 - (rows - 1) * 0.2) / rows
      kpis.forEach((kpi, i) => {
        const col = i % cols, row = Math.floor(i / cols)
        const x = 0.55 + col * (cardW + 0.25)
        const y = 2.2 + row * (cardH + 0.2)
        elements.push(
          rect(`${slideId}_card_${i}`, x, y, cardW, cardH, tokens.white, Z.contentBackground, { borderRadius: 0.1 }),
          rect(`${slideId}_ctop_${i}`, x, y, cardW, 0.06, tokens.primary, Z.content),
          text(`${slideId}_val_${i}`, x + 0.2, y + 0.06, cardW - 0.4, cardH * 0.50, kpi.value, {
            fontFamily: tokens.headlineFont, fontSizePt: 38, fontWeight: 'bold',
            color: tokens.primary, align: 'left', verticalAlign: 'middle',
            lineHeightMultiplier: 1, overflow: 'fitted',
          }, Z.content),
          text(`${slideId}_lbl_${i}`, x + 0.2, y + cardH * 0.56, cardW - 0.4, cardH * 0.28, kpi.label, {
            fontFamily: tokens.bodyFont, fontSizePt: 12, fontWeight: 'normal',
            color: tokens.dark, align: 'left', lineHeightMultiplier: 1.2, overflow: 'fitted',
          }, Z.content)
        )
        if (kpi.sublabel) elements.push(
          text(`${slideId}_sub_${i}`, x + 0.2, y + cardH * 0.82, cardW - 0.4, cardH * 0.16, kpi.sublabel, {
            fontFamily: tokens.bodyFont, fontSizePt: 9, fontWeight: 'normal',
            color: 'rgba(0,0,0,0.45)', align: 'left', lineHeightMultiplier: 1.2, overflow: 'clip',
          }, Z.content)
        )
      })
      return { background: bg, elements }
    },
  },

  // ── 8. Data Table / Matrix ────────────────────────────────────────────────
  data_table: {
    role: 'data_table',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('data_table', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (!r) throw new Error('Missing data_table layout')
      return r
    },
  },

  // ── 9. Feature / Capability Grid ──────────────────────────────────────────
  card_grid: {
    role: 'card_grid',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('card_grid', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (!r) throw new Error('Missing card_grid layout')
      return r
    },
  },

  // ── 10. Image Body ────────────────────────────────────────────────────────
  image_body: {
    role: 'image_body',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('image_body', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as ImageBodySpec
      const bg = tokens.light
      const imgLeft = (spec.imagePosition ?? 'right') === 'left'
      const imgX = imgLeft ? 0 : 6.8
      const textX = imgLeft ? 7.2 : 0.55
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title, titleWidth: 5.8 }),
        text(`${slideId}_body`, textX, 2.1, 5.8, 4.7, spec.body, {
          fontFamily: tokens.bodyFont, fontSizePt: 15, fontWeight: 'normal',
          color: tokens.dark, lineHeightMultiplier: 1.55, overflow: 'fitted',
        }, Z.content),
      ]
      if (spec.imageUrl) {
        elements.push({
          id: `${slideId}_img`, type: 'image',
          bounds: { x: imgX, y: 0, w: 6.533, h: CANVAS.heightIn },
          z: Z.contentBackground, visible: true, assetId: spec.imageUrl, imageFit: 'cover',
        })
      } else {
        elements.push(
          rect(`${slideId}_img_bg`, imgX, 0, 6.533, CANVAS.heightIn, tokens.primary, Z.contentBackground, { opacity: 0.12 })
        )
      }
      return { background: bg, elements }
    },
  },

  // ── 9. Quote Attribution ──────────────────────────────────────────────────
  quote_attribution: {
    role: 'quote_attribution',
    masterType: 'dark',
    compile(specUnknown, tokens, slideId, _pageNumber, layoutOverride) {
      const r = useLayout('quote_attribution', layoutOverride, specUnknown, tokens, slideId, _pageNumber)
      if (r) return r
      const spec = specUnknown as QuoteAttributionSpec
      const bg = tokens.dark
      const elements: ResolvedElement[] = [
        rect(`${slideId}_bg`, 0, 0, CANVAS.widthIn, CANVAS.heightIn, bg, Z.background),
        rect(`${slideId}_bar`, 0, 0, 0.08, CANVAS.heightIn, tokens.primary, Z.chrome),
        // Big quote mark
        text(`${slideId}_qmark`, 0.8, 0.5, 3.0, 2.0, '"', {
          fontFamily: tokens.headlineFont, fontSizePt: 120, fontWeight: 'bold',
          color: tokens.primary, align: 'left', verticalAlign: 'top',
          lineHeightMultiplier: 1, overflow: 'clip',
        }, Z.decorative),
        text(`${slideId}_quote`, 1.4, 1.8, 10.8, 3.2, spec.quote, {
          fontFamily: tokens.headlineFont, fontSizePt: 26, fontWeight: 'bold',
          color: tokens.white, align: 'left', lineHeightMultiplier: 1.35, overflow: 'fitted',
        }, Z.content),
      ]
      if (spec.attribution) elements.push(
        rect(`${slideId}_attr_line`, 1.4, 5.3, 0.35, 0.03, tokens.primary, Z.content),
        text(`${slideId}_attr`, 1.4, 5.45, 8.0, 0.4, spec.attribution, {
          fontFamily: tokens.bodyFont, fontSizePt: 14, fontWeight: 'bold',
          color: tokens.white, lineHeightMultiplier: 1.2, overflow: 'clip',
        }, Z.content)
      )
      if (spec.role_title) elements.push(
        text(`${slideId}_role`, 1.4, 5.92, 8.0, 0.35, spec.role_title, {
          fontFamily: tokens.bodyFont, fontSizePt: 12, fontWeight: 'normal',
          color: 'rgba(255,255,255,0.55)', lineHeightMultiplier: 1.2, overflow: 'clip',
        }, Z.content)
      )
      if (tokens.logoDarkUrl || tokens.logoUrl) elements.push({
        id: `${slideId}_logo`, type: 'image',
        bounds: { x: 0.55, y: 7.1, w: 2.0, h: 0.28 },
        z: Z.chrome, visible: true, assetId: (tokens.logoDarkUrl ?? tokens.logoUrl) ?? undefined, imageFit: 'contain',
      })
      return { background: bg, elements }
    },
  },

  // ── 10. Timeline ──────────────────────────────────────────────────────────
  timeline: {
    role: 'timeline',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('timeline', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as TimelineSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
      ]
      const steps = (spec.steps || []).slice(0, 5)
      const stepW = 12.2 / steps.length
      const lineY = 3.8
      // Connecting line
      elements.push(rect(`${slideId}_line`, 0.55, lineY - 0.015, 12.2, 0.03, tokens.primary, Z.decorative, { opacity: 0.3 }))
      steps.forEach((step, i) => {
        const cx = 0.55 + i * stepW + stepW / 2
        const circleR = 0.22
        elements.push(
          rect(`${slideId}_circle_${i}`, cx - circleR, lineY - circleR, circleR * 2, circleR * 2, tokens.primary, Z.content, { borderRadius: 99 }),
          text(`${slideId}_num_${i}`, cx - circleR, lineY - circleR, circleR * 2, circleR * 2, step.number, {
            fontFamily: tokens.headlineFont, fontSizePt: 11, fontWeight: 'bold',
            color: tokens.white, align: 'center', verticalAlign: 'middle',
            lineHeightMultiplier: 1, overflow: 'clip',
          }, Z.content + 1),
          text(`${slideId}_label_${i}`, cx - stepW * 0.45, lineY + 0.35, stepW * 0.9, 0.45, step.label, {
            fontFamily: tokens.bodyFont, fontSizePt: 13, fontWeight: 'bold',
            color: tokens.dark, align: 'center', lineHeightMultiplier: 1.2, overflow: 'fitted',
          }, Z.content)
        )
        if (step.description) elements.push(
          text(`${slideId}_desc_${i}`, cx - stepW * 0.45, lineY + 0.85, stepW * 0.9, 1.8, step.description, {
            fontFamily: tokens.bodyFont, fontSizePt: 11, fontWeight: 'normal',
            color: 'rgba(0,0,0,0.55)', align: 'center', lineHeightMultiplier: 1.35, overflow: 'fitted',
          }, Z.content)
        )
        // Step header above line (alternating)
        if (i % 2 === 0) {
          elements.push(
            text(`${slideId}_above_${i}`, cx - stepW * 0.45, 2.2, stepW * 0.9, 1.4, step.label, {
              fontFamily: tokens.bodyFont, fontSizePt: 12, fontWeight: 'bold',
              color: tokens.primary, align: 'center', lineHeightMultiplier: 1.2, overflow: 'fitted',
            }, Z.content)
          )
        }
      })
      return { background: bg, elements }
    },
  },

  // ── 11. Comparison ────────────────────────────────────────────────────────
  comparison: {
    role: 'comparison',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('comparison', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as ComparisonSpec
      const bg = tokens.light
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
        // Left panel header
        rect(`${slideId}_lhead`, 0.55, 2.1, 5.9, 0.55, tokens.dark, Z.contentBackground),
        text(`${slideId}_lhtxt`, 0.65, 2.1, 5.7, 0.55, spec.leftHeading, {
          fontFamily: tokens.headlineFont, fontSizePt: 15, fontWeight: 'bold',
          color: tokens.white, align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'clip',
        }, Z.content),
        // Right panel header
        rect(`${slideId}_rhead`, 6.85, 2.1, 5.9, 0.55, tokens.primary, Z.contentBackground),
        text(`${slideId}_rhtxt`, 6.95, 2.1, 5.7, 0.55, spec.rightHeading, {
          fontFamily: tokens.headlineFont, fontSizePt: 15, fontWeight: 'bold',
          color: tokens.white, align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'clip',
        }, Z.content),
      ]
      ;[
        { items: spec.leftItems, x: 0.55, color: tokens.dark },
        { items: spec.rightItems, x: 6.85, color: tokens.primary },
      ].forEach(({ items, x, color }, col) => {
        const rows = (items || []).slice(0, 5)
        const itemH = Math.min(0.8, 4.3 / Math.max(rows.length, 1))
        rows.forEach((item, i) => {
          const y = 2.8 + i * itemH
          elements.push(
            rect(`${slideId}_dot_${col}_${i}`, x + 0.18, y + 0.06, 0.1, 0.1, color, Z.content, { borderRadius: 99 }),
            text(`${slideId}_item_${col}_${i}`, x + 0.4, y, 5.4, itemH, item, {
              fontFamily: tokens.bodyFont, fontSizePt: 14, fontWeight: 'normal',
              color: tokens.dark, lineHeightMultiplier: 1.3, overflow: 'fitted',
            }, Z.content)
          )
        })
      })
      return { background: bg, elements }
    },
  },

  // ── 12. Chart Bar ─────────────────────────────────────────────────────────
  chart_bar: {
    role: 'chart_bar',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const r = useLayout('chart_bar', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const spec = specUnknown as ChartBarSpec
      const bg = tokens.light
      // Distinct palette: primary, accent, then neutrals — no duplicates at index 0/1
      const accentColors = [tokens.accent, '#747875', '#d9dddd', tokens.dark]
      const values = (spec.values ?? []).map(Number).filter(n => !isNaN(n))
      const categories = (spec.categories ?? []).map(String)
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
        {
          id: `${slideId}_chart`,
          type: 'chart',
          bounds: { x: 0.55, y: 2.0, w: 12.23, h: 4.85 },
          z: Z.content,
          visible: true,
          chart: {
            type: 'bar',
            categories,
            series: [{ name: spec.seriesName ?? '', values, color: tokens.primary }],
            unitSuffix: spec.unitSuffix,
            primaryColor: tokens.primary,
            textColor: tokens.dark,
            accentColors,
            svgCode: spec.svgCode,
          },
        },
      ]
      return { background: bg, elements }
    },
  },

  // ── 13. Chart Doughnut ────────────────────────────────────────────────────
  chart_doughnut: {
    role: 'chart_doughnut',
    masterType: 'light',
    compile(specUnknown, tokens, slideId, pageNumber, layoutOverride) {
      const spec = specUnknown as ChartDoughnutSpec
      const chartPanels = (spec.charts ?? []).map(panel => ({
        title: String(panel.title ?? ''),
        segments: (panel.segments ?? []).map(segment => ({
          label: String(segment.label),
          value: Number(segment.value),
        })).filter(segment => segment.label && Number.isFinite(segment.value)),
        centerValue: panel.centerValue,
        centerLabel: panel.centerLabel,
      })).filter(panel => panel.segments.length >= 2).slice(0, 2)

      // A source page can contain two independent pie/doughnut panels. A single
      // chart element cannot preserve that information, so use a deterministic
      // two-panel layout instead of collapsing the page into one headline ring.
      if (chartPanels.length > 1) {
        const accentColors = doughnutAccentColors(tokens)
        const panelX = [0.55, 6.42]
        const brandChromeLayout = layoutOverride
          ? {
              ...layoutOverride,
              elements: layoutOverride.elements.filter(element =>
                element.type === 'master'
                || element.type === 'header'
                || ('id' in element && (element.id === 'deco' || element.id === 'subtitle')),
              ),
            }
          : null
        const brandChrome = brandChromeLayout
          ? interpretLayout(brandChromeLayout, tokens, spec, slideId, pageNumber)
          : null
        const bg = brandChrome?.background ?? tokens.light
        const elements: ResolvedElement[] = [
          ...(brandChrome?.elements ?? [
            ...buildMasterElements(slideId, 'light', pageNumber, tokens),
            ...buildHeader(slideId, 'light', tokens, {
              eyebrow: spec.eyebrow,
              title: spec.title,
            }),
          ]),
        ]

        chartPanels.forEach((panel, index) => {
          elements.push(
            text(`${slideId}_panel_${index}_title`, panelX[index], 1.78, 5.35, 0.42, panel.title, {
              fontFamily: tokens.bodyFont,
              fontSizePt: 15,
              fontWeight: 'bold',
              color: tokens.dark,
              align: 'center',
              verticalAlign: 'middle',
              lineHeightMultiplier: 1.1,
              overflow: 'fitted',
            }, Z.content),
            {
              id: `${slideId}_panel_${index}_chart`,
              type: 'chart',
              bounds: { x: panelX[index], y: 2.2, w: 5.35, h: 4.35 },
              z: Z.content,
              visible: true,
              chart: {
                type: 'doughnut',
                categories: panel.segments.map(segment => segment.label),
                series: [{
                  name: '',
                  values: panel.segments.map(segment => segment.value),
                  color: tokens.primary,
                }],
                centerValue: panel.centerValue,
                centerLabel: panel.centerLabel,
                unitSuffix: '%',
                primaryColor: tokens.primary,
                textColor: tokens.dark,
                accentColors,
              },
            },
          )
        })

        if (spec.insight) {
          elements.push(text(`${slideId}_insight`, 0.55, 6.64, 11.22, 0.34, spec.insight, {
            fontFamily: tokens.bodyFont,
            fontSizePt: 11,
            fontWeight: 'normal',
            color: tokens.dark,
            align: 'center',
            verticalAlign: 'middle',
            lineHeightMultiplier: 1.2,
            overflow: 'fitted',
          }, Z.content))
        }
        return { background: bg, elements }
      }

      const r = useLayout('chart_doughnut', layoutOverride, specUnknown, tokens, slideId, pageNumber)
      if (r) return r
      const bg = tokens.light
      const accentColors = doughnutAccentColors(tokens)
      const segments = (spec.segments ?? []).map(s => ({
        label: String(s.label),
        value: Number(s.value),
      })).filter(s => !isNaN(s.value))
      const elements: ResolvedElement[] = [
        ...buildMasterElements(slideId, 'light', pageNumber, tokens),
        ...buildHeader(slideId, 'light', tokens, { eyebrow: spec.eyebrow, title: spec.title }),
        {
          id: `${slideId}_chart`,
          type: 'chart',
          bounds: { x: 0.55, y: 2.0, w: 12.23, h: spec.insight ? 4.2 : 4.85 },
          z: Z.content,
          visible: true,
          chart: {
            type: 'doughnut',
            categories: segments.map(s => s.label),
            series: [{ name: '', values: segments.map(s => s.value), color: tokens.primary }],
            centerValue: spec.centerValue,
            centerLabel: spec.centerLabel,
            primaryColor: tokens.primary,
            textColor: tokens.dark,
            accentColors,
            svgCode: spec.svgCode,
          },
        },
      ]
      if (spec.insight) elements.push(
        text(`${slideId}_insight`, 0.55, 6.3, 12.23, 0.55, spec.insight, {
          fontFamily: tokens.bodyFont, fontSizePt: 13, fontWeight: 'normal',
          color: 'rgba(0,0,0,0.55)', align: 'center', lineHeightMultiplier: 1.4, overflow: 'fitted',
        }, Z.content)
      )
      return { background: bg, elements }
    },
  },

  // ── 14. Closing CTA ───────────────────────────────────────────────────────
  closing_cta: {
    role: 'closing_cta',
    masterType: 'cover',
    compile(specUnknown, tokens, slideId, _pageNumber, layoutOverride) {
      const r = useLayout('closing_cta', layoutOverride, specUnknown, tokens, slideId, _pageNumber)
      if (r) return r
      const spec = specUnknown as ClosingCtaSpec
      const bg = tokens.dark
      const elements: ResolvedElement[] = [
        rect(`${slideId}_bg`, 0, 0, CANVAS.widthIn, CANVAS.heightIn, bg, Z.background),
        rect(`${slideId}_bar`, 0, 0, 0.08, CANVAS.heightIn, tokens.primary, Z.chrome),
        rect(`${slideId}_accent`, 0.55, 3.6, 2.0, 0.06, tokens.primary, Z.decorative),
        text(`${slideId}_title`, 0.7, 2.0, 11.5, 2.8, spec.title, {
          fontFamily: tokens.headlineFont, fontSizePt: 48, fontWeight: 'bold',
          color: tokens.white, lineHeightMultiplier: 1.1, overflow: 'fitted',
        }, Z.content),
      ]
      if (spec.subtitle) elements.push(
        text(`${slideId}_sub`, 0.7, 3.9, 10.0, 0.7, spec.subtitle, {
          fontFamily: tokens.bodyFont, fontSizePt: 18, fontWeight: 'normal',
          color: 'rgba(255,255,255,0.7)', lineHeightMultiplier: 1.4, overflow: 'fitted',
        }, Z.content)
      )
      if (spec.cta) elements.push(
        text(`${slideId}_cta`, 0.7, 4.75, 5.0, 0.55, spec.cta, {
          fontFamily: tokens.bodyFont, fontSizePt: 14, fontWeight: 'bold',
          color: tokens.primary, lineHeightMultiplier: 1.2, overflow: 'clip',
        }, Z.content)
      )
      if (tokens.logoDarkUrl || tokens.logoUrl) elements.push({
        id: `${slideId}_logo`, type: 'image',
        bounds: { x: 11.08, y: 0.20, w: 2.0, h: 0.38 },
        z: Z.chrome, visible: true, assetId: (tokens.logoDarkUrl ?? tokens.logoUrl) ?? undefined, imageFit: 'contain',
      })
      return { background: bg, elements }
    },
  },
}

export function getLayout(role: SlideRole): LayoutDefinition | undefined {
  return LAYOUTS[role]
}

export function getAllRoles(): SlideRole[] {
  return Object.keys(LAYOUTS) as SlideRole[]
}
