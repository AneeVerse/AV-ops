// Default JSON layouts for every slide template.
// Admins can override these per-brand in the DB and edit them in the brands UI.

import type { JsonSlideLayout } from './layout-schema'
import { Z } from './design-tokens'

const CANVAS_W = 13.333
const CANVAS_H = 7.5
const DECO_Y = 0.72
const DECO_H = CANVAS_H - DECO_Y
// The Truckstop-style vertical SVG is naturally about 1.05" wide at 6.78"
// tall. Contain preserves that ratio and avoids stretching the artwork.
const DECO_W = 1.05
const DECO_X = CANVAS_W - DECO_W
const CONTENT_W = 11.5

export const DEFAULT_LAYOUTS: Record<string, JsonSlideLayout> = {

  // ── 1. Cover Hero ───────────────────────────────────────────────────────────
  cover_hero: {
    background: '{{dark}}',
    elements: [
      { type: 'rect', id: 'bg',      x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, fill: '{{dark}}',    z: Z.background },
      { type: 'image', id: 'hero',   x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, src: '{{heroImageUrl}}', fit: 'cover', z: Z.contentBackground, if: 'heroImageUrl' },
      { type: 'rect', id: 'overlay', x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, fill: '{{dark}}',    z: Z.contentBackground + 1, opacity: 0.58, if: 'heroImageUrl' },
      { type: 'rect', id: 'stripe',  x: 0, y: 0, w: 0.08, h: CANVAS_H,     fill: '{{primary}}', z: Z.decorative },
      { type: 'text', id: 'tagline', x: 0.7, y: 1.35, w: 10.5, h: 0.35, content: '{{tagline}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 10, fontWeight: 'normal', color: '{{primary}}',
        uppercase: true, lineHeightMultiplier: 1.2, overflow: 'clip', z: Z.content, if: 'tagline' },
      { type: 'text', id: 'title',   x: 0.7, y: 1.8, w: 10.5, h: 2.5,  content: '{{title}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 52, fontWeight: 'bold', color: '{{white}}',
        lineHeightMultiplier: 1.05, overflow: 'fitted', z: Z.content },
      { type: 'text', id: 'subtitle', x: 0.7, y: 4.45, w: 10.5, h: 0.7, content: '{{subtitle}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 16, fontWeight: 'normal', color: 'rgba(255,255,255,0.75)',
        lineHeightMultiplier: 1.4, overflow: 'fitted', z: Z.content, if: 'subtitle' },
      { type: 'text', id: 'date',    x: 0.7, y: 5.25, w: 4.0,  h: 0.3,  content: '{{date}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 10, fontWeight: 'normal', color: 'rgba(255,255,255,0.45)',
        lineHeightMultiplier: 1.2, overflow: 'clip', z: Z.content, if: 'date' },
      { type: 'image', id: 'logo',   x: 0.7, y: 6.8, w: 2.0, h: 0.45, src: '{{logoForDark}}', fit: 'contain', z: Z.chrome },
    ],
  },

  // ── 2. Section Divider ──────────────────────────────────────────────────────
  section_divider: {
    background: '{{dark}}',
    elements: [
      { type: 'rect',  id: 'bg',  x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, fill: '{{dark}}',    z: Z.background },
      { type: 'rect',  id: 'bar', x: 0, y: 0, w: 0.08,     h: CANVAS_H, fill: '{{primary}}', z: Z.chrome },
      { type: 'text',  id: 'num', x: 1.5, y: 1.5, w: 3.0, h: 0.9, content: '{{sectionNumber}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 60, fontWeight: 'bold', color: '{{primary}}',
        align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1, overflow: 'clip', z: Z.decorative, if: 'sectionNumber' },
      { type: 'text',  id: 'title', x: 1.5, y: 2.6, w: 10.0, h: 2.0, content: '{{title}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 44, fontWeight: 'bold', color: '{{white}}',
        lineHeightMultiplier: 1.1, overflow: 'fitted', z: Z.content },
      { type: 'text',  id: 'subtitle', x: 1.5, y: 4.8, w: 9.0, h: 0.65, content: '{{subtitle}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 16, fontWeight: 'normal', color: 'rgba(255,255,255,0.65)',
        lineHeightMultiplier: 1.4, overflow: 'fitted', z: Z.content, if: 'subtitle' },
      { type: 'image', id: 'logo', x: 11.08, y: 0.20, w: 2.0, h: 0.38, src: '{{logoForDark}}', fit: 'contain', z: Z.chrome },
    ],
  },

  // ── 3. Agenda ───────────────────────────────────────────────────────────────
  agenda: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'agenda_list', startX: 0.55, startY: 2.15, maxItems: 8, itemFontSize: 15, dotSize: 0.14 },
    ],
  },

  // ── 4. Bullets ──────────────────────────────────────────────────────────────
  bullets: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}', subtitle: '{{subtitle}}' },
      {
        type: 'repeat', source: 'bullets',
        baseX: 0.55, baseY: 2.1,
        autoStepY: true, availableH: 4.8, maxItems: 5,
        children: [
          { type: 'rect', id: 'dot_$i',  x: 0, y: 0.06, w: 0.1, h: 0.1, fill: '{{primary}}', radius: 99, z: Z.content },
          { type: 'text', id: 'body_$i', x: 0.3, y: 0, w: 11.2, h: 0.75,
            content: '{{$item}}', fontFamily: '{{bodyFont}}', fontSizePt: 18, fontWeight: 'normal',
            color: '{{dark}}', align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1.35, overflow: 'fitted', z: Z.content },
        ],
      },
    ],
  },

  // ── 5. Two Column ───────────────────────────────────────────────────────────
  two_column: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'two_column_list', dividerX: 6.3, leftX: 0.55, rightX: 6.55, colW: 5.5, startY: 2.15, availableH: 4.55, headingFontSize: 15, itemFontSize: 14 },
    ],
  },

  // ── 6. Stat Callout ─────────────────────────────────────────────────────────
  stat_callout: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'text', id: 'stat', x: 0.55, y: 2.3, w: CONTENT_W, h: 2.8, content: '{{stat}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 108, fontWeight: 'bold', color: '{{primary}}',
        align: 'center', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'fitted', z: Z.content },
      { type: 'text', id: 'stat_label', x: 0.55, y: 5.1, w: CONTENT_W, h: 0.55, content: '{{statLabel}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 20, fontWeight: 'normal', color: '{{dark}}',
        align: 'center', lineHeightMultiplier: 1.3, overflow: 'fitted', z: Z.content },
      { type: 'text', id: 'body', x: 2.5, y: 5.75, w: 8.5, h: 0.9, content: '{{body}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 13, fontWeight: 'normal', color: 'rgba(0,0,0,0.5)',
        align: 'center', lineHeightMultiplier: 1.4, overflow: 'fitted', z: Z.content, if: 'body' },
    ],
  },

  // ── 7. KPI Grid ─────────────────────────────────────────────────────────────
  kpi_grid: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'kpi_grid', baseX: 0.55, baseY: 2.2, availableW: CONTENT_W, availableH: 4.6, gapX: 0.25, gapY: 0.2, maxItems: 6, cardAccentH: 0.06, valueFontSize: 38, labelFontSize: 12, sublabelFontSize: 9 },
    ],
  },

  // ── 8. Data Table / Matrix ─────────────────────────────────────────────────
  data_table: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}', subtitle: '{{subtitle}}' },
      {
        type: 'table', id: 'table', x: 0.55, y: 2.05, w: CONTENT_W, h: 4.45,
        data: '{{rows}}', z: Z.content, if: 'rows',
        style: {
          headerFill: '{{dark}}',
          headerTextColor: '{{white}}',
          headerFontSizePt: 10,
          bodyFontSizePt: 9,
          bodyTextColor: '{{dark}}',
          bodyFill: '{{white}}',
          alternateRowFill: 'rgba(0,0,0,0.045)',
          borderColor: '{{light}}',
          highlightColor: '{{primary}}',
        },
      },
      { type: 'text', id: 'insight', x: 0.55, y: 6.58, w: 10.6, h: 0.35, content: '{{insight}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 10, fontWeight: 'bold', color: '{{primary}}',
        lineHeightMultiplier: 1.2, overflow: 'fitted', z: Z.content, if: 'insight' },
      { type: 'text', id: 'source', x: 0.55, y: 6.98, w: 10.6, h: 0.2, content: '{{source}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 7, fontWeight: 'normal', color: 'rgba(0,0,0,0.5)',
        lineHeightMultiplier: 1.1, overflow: 'clip', z: Z.content, if: 'source' },
    ],
  },

  // ── 9. Feature / Capability Cards ─────────────────────────────────────────
  card_grid: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}', subtitle: '{{subtitle}}' },
      {
        type: 'card_grid', source: 'cards',
        baseX: 0.55, baseY: 2.05, availableW: CONTENT_W, availableH: 4.65,
        gapX: 0.18, gapY: 0.18, maxItems: 8, maxColumns: 4,
        titleFontSize: 12, valueFontSize: 22, bodyFontSize: 8,
      },
      { type: 'text', id: 'footer', x: 0.55, y: 6.88, w: CONTENT_W, h: 0.28, content: '{{footer}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 9, fontWeight: 'bold', color: '{{primary}}',
        align: 'center', lineHeightMultiplier: 1.2, overflow: 'fitted', z: Z.content, if: 'footer' },
    ],
  },

  // ── 10. Image Body ──────────────────────────────────────────────────────────
  image_body: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}', titleWidth: 5.8 },
      // Image panel on the right (when imageUrl exists)
      { type: 'image', id: 'img',    x: 6.8, y: 0, w: 6.533, h: CANVAS_H, src: '{{imageUrl}}', fit: 'cover', z: Z.contentBackground, if: 'imageUrl' },
      { type: 'text',  id: 'body',   x: 0.55, y: 2.1, w: 5.8, h: 4.7, content: '{{body}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 15, fontWeight: 'normal', color: '{{dark}}',
        lineHeightMultiplier: 1.55, overflow: 'fitted', z: Z.content },
    ],
  },

  // ── 11. Quote Attribution ───────────────────────────────────────────────────
  quote_attribution: {
    background: '{{dark}}',
    elements: [
      { type: 'rect',  id: 'bg',     x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, fill: '{{dark}}',    z: Z.background },
      { type: 'image', id: 'deco',   x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.decorative, if: 'decorationUrl' },
      { type: 'rect',  id: 'bar',    x: 0, y: 0, w: 0.08,     h: CANVAS_H, fill: '{{primary}}', z: Z.chrome },
      { type: 'text',  id: 'qmark',  x: 0.8, y: 0.5, w: 3.0, h: 2.0, content: '"',
        fontFamily: '{{headlineFont}}', fontSizePt: 120, fontWeight: 'bold', color: '{{primary}}',
        align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1, overflow: 'clip', z: Z.decorative },
      { type: 'text',  id: 'quote',  x: 1.4, y: 1.8, w: 10.8, h: 3.2, content: '{{quote}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 26, fontWeight: 'bold', color: '{{white}}',
        align: 'left', lineHeightMultiplier: 1.35, overflow: 'fitted', z: Z.content },
      { type: 'rect',  id: 'attr_line', x: 1.4, y: 5.3, w: 0.35, h: 0.03, fill: '{{primary}}', z: Z.content, if: 'attribution' },
      { type: 'text',  id: 'attr',   x: 1.4, y: 5.45, w: 8.0, h: 0.4, content: '{{attribution}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 14, fontWeight: 'bold', color: '{{white}}',
        lineHeightMultiplier: 1.2, overflow: 'clip', z: Z.content, if: 'attribution' },
      { type: 'text',  id: 'role',   x: 1.4, y: 5.92, w: 8.0, h: 0.35, content: '{{role_title}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 12, fontWeight: 'normal', color: 'rgba(255,255,255,0.55)',
        lineHeightMultiplier: 1.2, overflow: 'clip', z: Z.content, if: 'role_title' },
      { type: 'image', id: 'logo',   x: 0.55, y: 7.1, w: 2.0, h: 0.28, src: '{{logoForDark}}', fit: 'contain', z: Z.chrome },
    ],
  },

  // ── 12. Timeline ────────────────────────────────────────────────────────────
  timeline: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'timeline_steps', source: 'steps', lineY: 3.8, lineX: 0.55, lineW: CONTENT_W, maxItems: 5, circleR: 0.22, numberFontSize: 11, labelFontSize: 13, descFontSize: 11 },
    ],
  },

  // ── 13. Comparison ──────────────────────────────────────────────────────────
  comparison: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'rect', id: 'lhead',   x: 0.55, y: 2.1, w: 5.5, h: 0.55, fill: '{{dark}}',    z: Z.contentBackground },
      { type: 'text', id: 'lhtxt',   x: 0.65, y: 2.1, w: 5.3, h: 0.55, content: '{{leftHeading}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 15, fontWeight: 'bold', color: '{{white}}',
        align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'clip', z: Z.content },
      { type: 'rect', id: 'rhead',   x: 6.55, y: 2.1, w: 5.5, h: 0.55, fill: '{{primary}}', z: Z.contentBackground },
      { type: 'text', id: 'rhtxt',   x: 6.65, y: 2.1, w: 5.3, h: 0.55, content: '{{rightHeading}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 15, fontWeight: 'bold', color: '{{white}}',
        align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'clip', z: Z.content },
      { type: 'two_column_list', dividerX: 6.3, leftX: 0.55, rightX: 6.55, colW: 5.5, startY: 2.8, availableH: 4.3, headingFontSize: 15, itemFontSize: 14, suppressHeadings: true },
    ],
  },

  // ── 14. Chart Bar ───────────────────────────────────────────────────────────
  chart_bar: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'chart', id: 'chart', x: 0.55, y: 2.0, w: CONTENT_W, h: 4.85, z: Z.content, chartType: 'bar' },
    ],
  },

  // ── 15. Chart Doughnut ──────────────────────────────────────────────────────
  chart_doughnut: {
    background: '{{light}}',
    elements: [
      { type: 'master', theme: 'light' },
      { type: 'image', id: 'deco', x: DECO_X, y: DECO_Y, w: DECO_W, h: DECO_H, src: '{{decorationUrl}}', fit: 'contain', z: Z.background, if: 'decorationUrl' },
      { type: 'header', theme: 'light', eyebrow: '{{eyebrow}}', title: '{{title}}' },
      { type: 'chart', id: 'chart', x: 0.55, y: 2.0, w: CONTENT_W, h: 3.9, z: Z.content, chartType: 'doughnut' },
      { type: 'text', id: 'insight', x: 0.55, y: 6.1, w: CONTENT_W, h: 0.55, content: '{{insight}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 13, fontWeight: 'normal', color: 'rgba(0,0,0,0.55)',
        align: 'center', lineHeightMultiplier: 1.4, overflow: 'fitted', z: Z.content, if: 'insight' },
    ],
  },

  // ── 16. Closing CTA ─────────────────────────────────────────────────────────
  closing_cta: {
    background: '{{dark}}',
    elements: [
      { type: 'rect',  id: 'bg',     x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, fill: '{{dark}}',    z: Z.background },
      { type: 'rect',  id: 'bar',    x: 0, y: 0, w: 0.08,     h: CANVAS_H, fill: '{{primary}}', z: Z.chrome },
      { type: 'rect',  id: 'accent', x: 0.55, y: 3.6, w: 2.0, h: 0.06,    fill: '{{primary}}', z: Z.decorative },
      { type: 'text',  id: 'title',  x: 0.7, y: 2.0, w: 11.5, h: 2.8, content: '{{title}}',
        fontFamily: '{{headlineFont}}', fontSizePt: 48, fontWeight: 'bold', color: '{{white}}',
        lineHeightMultiplier: 1.1, overflow: 'fitted', z: Z.content },
      { type: 'text',  id: 'subtitle', x: 0.7, y: 3.9, w: 10.0, h: 0.7, content: '{{subtitle}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 18, fontWeight: 'normal', color: 'rgba(255,255,255,0.7)',
        lineHeightMultiplier: 1.4, overflow: 'fitted', z: Z.content, if: 'subtitle' },
      { type: 'text',  id: 'cta',    x: 0.7, y: 4.75, w: 5.0, h: 0.55, content: '{{cta}}',
        fontFamily: '{{bodyFont}}', fontSizePt: 14, fontWeight: 'bold', color: '{{primary}}',
        lineHeightMultiplier: 1.2, overflow: 'clip', z: Z.content, if: 'cta' },
      { type: 'image', id: 'logo',   x: 11.08, y: 0.20, w: 2.0, h: 0.38, src: '{{logoForDark}}', fit: 'contain', z: Z.chrome },
    ],
  },
}
