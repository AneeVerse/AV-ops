import type { ResolvedElement, BrandTokens } from './types'
import type {
  JsonSlideLayout, JsonStaticElement,
  JsonRepeat, JsonKpiGrid, JsonTimelineSteps, JsonTwoColumnList, JsonAgendaList, JsonCardGrid,
  JsonChart, JsonShape, JsonTable, JsonLegend,
} from './layout-schema'
import { Z, CANVAS, CONTENT_SAFE } from './design-tokens'
import { buildMasterElements, buildHeader } from './shared-master'

interface RgbaColor { r: number; g: number; b: number; a: number }

function parseColor(color: string): RgbaColor | null {
  const hex = color.trim().match(/^#([0-9a-fA-F]{6})$/)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, a: 1 }
  }
  const rgb = color.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (!rgb) return null
  return {
    r: Math.max(0, Math.min(255, Number(rgb[1]))),
    g: Math.max(0, Math.min(255, Number(rgb[2]))),
    b: Math.max(0, Math.min(255, Number(rgb[3]))),
    a: Math.max(0, Math.min(1, rgb[4] === undefined ? 1 : Number(rgb[4]))),
  }
}

function composite(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const a = fg.a + bg.a * (1 - fg.a)
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  }
}

function relativeLuminance(color: RgbaColor): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrastRatio(a: RgbaColor, b: RgbaColor): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b))
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Token / spec resolution ────────────────────────────────────────────────────

const TOKEN_MAP = (tokens: BrandTokens): Record<string, string> => ({
  primary:       tokens.primary,
  accent:        tokens.accent,
  dark:          tokens.dark,
  light:         tokens.light,
  white:         tokens.white,
  headlineFont:  tokens.headlineFont,
  bodyFont:      tokens.bodyFont,
  logoUrl:       tokens.logoUrl ?? '',
  // logoForDark prefers the dark-background logo, falling back to light logo
  logoForDark:   tokens.logoDarkUrl ?? tokens.logoUrl ?? '',
  decorationUrl: tokens.decorationUrl ?? '',
  canvasW:       String(CANVAS.widthIn),
  canvasH:       String(CANVAS.heightIn),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolve(val: string, tokens: BrandTokens, spec: Record<string, any>, ctx: Record<string, string> = {}): string {
  const tmap = TOKEN_MAP(tokens)
  return val.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim()
    if (k in ctx)   return ctx[k]
    if (k in tmap)  return tmap[k]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = spec[k]
    return v !== undefined && v !== null ? String(v) : ''
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isTruthy(field: string, spec: Record<string, any>, ctx: Record<string, string> = {}): boolean {
  const t = field.trim()
  // Simple && and || compound conditions
  if (t.includes('&&')) return t.split('&&').every(f => isTruthy(f.trim(), spec, ctx))
  if (t.includes('||')) return t.split('||').some(f => isTruthy(f.trim(), spec, ctx))
  // Negation
  if (t.startsWith('!')) return !isTruthy(t.slice(1).trim(), spec, ctx)
  if (t in ctx) return !!ctx[t]
  const v = spec[t]
  return Array.isArray(v) ? v.length > 0 : !!v
}

// Extracts the field name from a "{{fieldName}}" token; returns null for literals
function extractFieldRef(token: string): string | null {
  const m = token.match(/^\s*\{\{([^}]+)\}\}\s*$/)
  return m ? m[1].trim() : null
}

function numericValue(value: unknown): number {
  if (typeof value === 'number') return value
  const cleaned = String(value ?? '').replace(/[^0-9.+-]/g, '')
  return cleaned ? Number(cleaned) : Number.NaN
}

function humaniseTableKey(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, letter => letter.toUpperCase())
    .trim()
}

// Some model responses encode an entire cross-tab in object keys such as
// "row_Under_$200,000_2025_Customers". Rebuild those keys into a normal
// four-column table before calculating any cell widths.
function reshapeEncodedTable(
  inputRows: Array<Record<string, unknown>>,
): { cols: string[]; rows: Array<Record<string, unknown>> } | null {
  const allKeys = Array.from(new Set(inputRows.flatMap(row => Object.keys(row))))
  const headerKeys = allKeys.filter(key => key.startsWith('header_'))
  const rowKeys = allKeys.filter(key => key.startsWith('row_'))
  if (headerKeys.length === 0 || rowKeys.length === 0) return null

  const headerDefs = headerKeys.map(key => {
    const token = key.slice('header_'.length)
    const label = inputRows
      .map(row => row[key])
      .find(value => value !== undefined && value !== null && String(value).trim())
    return { token, label: String(label ?? humaniseTableKey(token)) }
  }).sort((a, b) => b.token.length - a.token.length)

  const rows: Array<Record<string, unknown>> = []
  inputRows.forEach(input => {
    const section = String(input.category ?? input.Category ?? input.section ?? input.Section ?? '')
    const grouped = new Map<string, Record<string, unknown>>()
    Object.entries(input).forEach(([key, value]) => {
      if (!key.startsWith('row_')) return
      const encoded = key.slice('row_'.length)
      const header = headerDefs.find(def => encoded.endsWith(`_${def.token}`))
      if (!header) return
      const rawMetric = encoded.slice(0, -(header.token.length + 1))
      const metric = humaniseTableKey(rawMetric)
      const row = grouped.get(metric) ?? { Category: section, Metric: metric }
      row[header.label] = value
      grouped.set(metric, row)
    })
    rows.push(...Array.from(grouped.values()))
  })

  if (rows.length === 0) return null
  return {
    cols: ['Category', 'Metric', ...headerDefs.map(def => def.label)],
    rows,
  }
}

// ── Static element builder ─────────────────────────────────────────────────────

function buildStatic(
  el: JsonStaticElement,
  tokens: BrandTokens,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: Record<string, any>,
  slideId: string,
  pageNumber: number,
  ctx: Record<string, string> = {},
): ResolvedElement[] {
  const r = (s: string) => resolve(s, tokens, spec, ctx)

  if (el.type === 'master') return buildMasterElements(slideId, el.theme, pageNumber, tokens)

  if (el.type === 'header') {
    return buildHeader(slideId, el.theme, tokens, {
      eyebrow:    el.eyebrow  ? r(el.eyebrow)  : undefined,
      title:      r(el.title),
      subtitle:   el.subtitle ? r(el.subtitle) : undefined,
      titleWidth: el.titleWidth,
    })
  }

  if (el.if && !isTruthy(el.if, spec, ctx)) return []

  const id     = r(el.id)
  const bounds = { x: el.x, y: el.y, w: el.w, h: el.h }
  const z      = el.z ?? Z.content

  switch (el.type) {
    case 'rect':
      return [{ id, type: 'rect', bounds, z, visible: true, style: { fill: r(el.fill), opacity: el.opacity, borderRadius: el.radius } }]

    case 'text': {
      const content = r(el.content)
      if (!content) return []
      return [{
        id, type: 'text', bounds, z, visible: true,
        text: {
          content,
          fontFamily:           r(el.fontFamily),
          fontSizePt:           el.fontSizePt,
          fontWeight:           el.fontWeight           ?? 'normal',
          color:                r(el.color),
          align:                el.align                ?? 'left',
          verticalAlign:        el.verticalAlign        ?? 'top',
          lineHeightMultiplier: el.lineHeightMultiplier ?? 1.4,
          overflow:             el.overflow             ?? 'fitted',
          uppercase:            el.uppercase,
        },
      }]
    }

    case 'image': {
      const src = r(el.src)
      if (!src) return []
      return [{
        id,
        type: 'image',
        bounds,
        z,
        visible: true,
        assetId: src,
        imageFit: id.toLowerCase().includes('logo') ? 'contain' : (el.fit ?? 'cover'),
      }]
    }

    case 'chart': {
      const chartEl = el as JsonChart
      const primary = tokens.primary.toLowerCase()
      const accentColors = Array.from(new Set([
        tokens.accent,
        tokens.dark,
        '#747875',
        '#b0b4b2',
        '#d9dddd',
      ].filter(color => color && color.toLowerCase() !== primary)))
      const segmentColors = chartEl.style?.colors?.map(c => r(c)).filter(Boolean)
      const showLegend = chartEl.style?.showLegend !== false

      // Resolve data from layout "data" field if specified, otherwise fall back to default field names
      const dataField = chartEl.data ? extractFieldRef(chartEl.data) : null
      const rawData = dataField ? spec[dataField] : undefined

      if (chartEl.chartType === 'bar') {
        const objectRows = Array.isArray(rawData) && rawData.every(item =>
          item && typeof item === 'object' && !Array.isArray(item)
        ) ? rawData as Array<Record<string, unknown>> : null
        let categories = objectRows
          ? objectRows.map(item => String(item.label ?? item.category ?? ''))
          : ((spec.categories ?? spec.labels ?? spec.chartData?.categories ?? spec.chartData?.labels ?? []) as unknown[]).map(String)
        const rawSeries = spec.series ?? spec.datasets ?? spec.chartData?.series ?? spec.chartData?.datasets
        const parsedSeries = Array.isArray(rawSeries)
          ? rawSeries.map((series: Record<string, unknown>, index: number) => {
            const pointData = Array.isArray(series?.data) ? series.data : []
            if (categories.length === 0 && pointData.every(point => point && typeof point === 'object')) {
              categories = pointData.map(point => String((point as Record<string, unknown>).label ?? (point as Record<string, unknown>).category ?? ''))
            }
            const seriesValues = (Array.isArray(series?.values) ? series.values : pointData)
              .map(point => point && typeof point === 'object'
                ? numericValue((point as Record<string, unknown>).value)
                : numericValue(point))
              .filter(Number.isFinite)
            return {
              name: String(series?.name ?? series?.label ?? `Series ${index + 1}`),
              values: seriesValues,
              color: String(series?.color ?? segmentColors?.[index] ?? [tokens.primary, ...accentColors][index % (accentColors.length + 1)]),
            }
          }).filter(series => series.values.length > 0)
          : []
        const values = objectRows
          ? objectRows.map(item => numericValue(item.value)).filter(Number.isFinite)
          : ((rawData ?? spec.values ?? spec.chartValues ?? []) as unknown[]).map(numericValue).filter(Number.isFinite)
        const series = parsedSeries.length > 0
          ? parsedSeries
          : [{ name: String(spec.seriesName ?? ''), values, color: tokens.primary }]
        if (series.every(item => item.values.length === 0) || categories.length === 0) return []
        return [{
          id, type: 'chart', bounds, z, visible: true,
          chart: {
            type: 'bar', categories,
            series,
            unitSuffix: spec.unitSuffix as string | undefined,
            primaryColor: tokens.primary, textColor: tokens.dark, accentColors,
            segmentColors, showLegend,
            svgCode: spec.svgCode as string | undefined,
          },
        }]
      }
      if (chartEl.chartType === 'doughnut') {
        const segs = ((rawData ?? spec.segments ?? spec.doughnutData ?? []) as Array<{ label: unknown; value: unknown }>)
          .map(s => ({ label: String(s.label), value: Number(s.value) }))
          .filter(s => !isNaN(s.value))
        if (segs.length === 0) return []
        return [{
          id, type: 'chart', bounds, z, visible: true,
          chart: {
            type: 'doughnut',
            categories: segs.map(s => s.label),
            series: [{ name: '', values: segs.map(s => s.value), color: tokens.primary }],
            centerValue:  (spec.centerValue ?? spec.centerKpi) as string | undefined,
            centerLabel:  (spec.centerLabel ?? spec.centerKpiLabel) as string | undefined,
            primaryColor: tokens.primary, textColor: tokens.dark, accentColors,
            segmentColors, showLegend,
            svgCode: spec.svgCode as string | undefined,
          },
        }]
      }
      return []
    }

    case 'shape': {
      const shapeEl = el as JsonShape
      return [{ id, type: 'rect', bounds, z, visible: true, style: { fill: r(shapeEl.fill), opacity: shapeEl.opacity } }]
    }

    case 'table': {
      const tableEl = el as JsonTable
      const field = tableEl.data ? extractFieldRef(tableEl.data) : null
      const rawRows = (field ? spec[field] : null) as unknown
      if (!Array.isArray(rawRows) || rawRows.length === 0) return []

      let cols: string[] = []
      let rows: Array<Record<string, unknown>> = []
      if (rawRows.every(row => Array.isArray(row))) {
        const matrix = rawRows as unknown[][]
        const explicitCols = Array.isArray(spec.columns) ? spec.columns.map(String) : null
        cols = explicitCols?.length
          ? explicitCols
          : matrix[0].map((value, index) => String(value ?? `Column ${index + 1}`))
        const bodyRows = explicitCols?.length ? matrix : matrix.slice(1)
        rows = bodyRows.map(row => Object.fromEntries(cols.map((col, index) => [col, row[index] ?? ''])))
      } else {
        rows = rawRows.filter(row => row && typeof row === 'object' && !Array.isArray(row)) as Array<Record<string, unknown>>
        const reshaped = reshapeEncodedTable(rows)
        if (reshaped) {
          cols = reshaped.cols
          rows = reshaped.rows
        } else {
          cols = rows[0] ? Object.keys(rows[0]) : []
        }
      }
      if (cols.length === 0) return []
      const columnWeights = cols.map(col => {
        const longest = Math.max(
          String(col).length,
          ...rows.slice(0, 20).map(row => String(row[col] ?? '').length),
        )
        return Math.max(1, Math.min(2.8, longest / 13))
      })
      const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0) || 1
      const colWidths = columnWeights.map(weight => bounds.w * weight / totalWeight)
      const colStarts = colWidths.reduce<number[]>((starts, width, index) => {
        starts.push(index === 0 ? bounds.x : starts[index - 1] + colWidths[index - 1])
        return starts
      }, [])
      const rowH   = bounds.h / (rows.length + 1)
      const st     = tableEl.style ?? {}
      const hFill  = st.headerFill       ? r(st.headerFill)       : tokens.dark
      const hColor = st.headerTextColor  ? r(st.headerTextColor)  : tokens.white
      const bodyFill = st.bodyFill        ? r(st.bodyFill)        : tokens.white
      const bodyColor = st.bodyTextColor  ? r(st.bodyTextColor)   : tokens.dark
      const altFill = st.alternateRowFill ? r(st.alternateRowFill) : 'rgba(0,0,0,0.04)'
      const densityScale = rows.length > 14 || cols.length > 7 ? 0.72 : rows.length > 10 || cols.length > 5 ? 0.84 : 1
      const hFs    = Math.max(6.5, (st.headerFontSizePt ?? 12) * densityScale)
      const bFs    = Math.max(6.5, (st.bodyFontSizePt ?? 11) * densityScale)
      const out: ResolvedElement[] = []
      // Header row
      out.push({ id: `${id}_hdr_bg`, type: 'rect', bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: rowH }, z, visible: true, style: { fill: hFill } })
      cols.forEach((col, ci) => {
        const colW = colWidths[ci]
        out.push({ id: `${id}_hdr_${ci}`, type: 'text',
          bounds: { x: colStarts[ci] + 0.05, y: bounds.y, w: Math.max(0.05, colW - 0.1), h: rowH },
          z: z + 1, visible: true,
          text: { content: col, fontFamily: tokens.bodyFont, fontSizePt: hFs, fontWeight: 'bold', color: hColor, align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1.1, overflow: 'fitted' } })
      })
      // Data rows
      rows.forEach((row, ri) => {
        const ry = bounds.y + (ri + 1) * rowH
        out.push({
          id: `${id}_row_${ri}`,
          type: 'rect',
          bounds: { x: bounds.x, y: ry, w: bounds.w, h: rowH },
          z,
          visible: true,
          style: { fill: ri % 2 === 1 ? altFill : bodyFill },
        })
        cols.forEach((col, ci) => {
          const colW = colWidths[ci]
          out.push({ id: `${id}_cell_${ri}_${ci}`, type: 'text',
            bounds: { x: colStarts[ci] + 0.05, y: ry, w: Math.max(0.05, colW - 0.1), h: rowH },
            z: z + 1, visible: true,
            text: { content: String(row[col] ?? ''), fontFamily: tokens.bodyFont, fontSizePt: bFs, fontWeight: 'normal', color: bodyColor, align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1.1, overflow: 'fitted' } })
        })
      })
      return out
    }

    case 'legend': {
      const legendEl = el as JsonLegend
      const field = legendEl.data ? extractFieldRef(legendEl.data) : null
      const items = (field ? spec[field] : null) as Array<{ label: unknown }> | undefined
      if (!Array.isArray(items) || items.length === 0) return []
      const colors   = legendEl.colors?.map(c => r(c)).filter(Boolean) ?? [tokens.primary, tokens.accent, '#747875', '#d9dddd']
      const isCircle = legendEl.marker === 'circle'
      const rowH     = bounds.h / Math.max(items.length, 1)
      const dotSize  = Math.min(rowH * 0.5, 0.14)
      const fontSize = legendEl.fontSizePt ?? 11
      const fontFam  = r(legendEl.fontFamily ?? '{{bodyFont}}')
      const out: ResolvedElement[] = []
      items.forEach((item, i) => {
        const cy    = bounds.y + i * rowH
        const color = colors[i % colors.length] || tokens.primary
        out.push(
          { id: `${id}_leg_dot_${i}`, type: 'rect',
            bounds: { x: bounds.x, y: cy + (rowH - dotSize) / 2, w: dotSize, h: dotSize },
            z, visible: true, style: { fill: color, borderRadius: isCircle ? 99 : 0 } },
          { id: `${id}_leg_lbl_${i}`, type: 'text',
            bounds: { x: bounds.x + dotSize + 0.08, y: cy, w: bounds.w - dotSize - 0.08, h: rowH },
            z, visible: true,
            text: { content: String(item.label ?? ''), fontFamily: fontFam, fontSizePt: fontSize, fontWeight: 'normal', color: tokens.dark, align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1.2, overflow: 'clip' } }
        )
      })
      return out
    }

    default:
      return []
  }
}

// ── Compound element builders ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRepeat(el: JsonRepeat, tokens: BrandTokens, spec: Record<string, any>, slideId: string, pageNumber: number): ResolvedElement[] {
  const arr = spec[el.source]
  if (!Array.isArray(arr)) return []
  const items = arr.slice(0, el.maxItems ?? 10)
  const stepY = el.autoStepY && el.availableH ? el.availableH / Math.max(items.length, 1) : (el.stepY ?? 0)
  const stepX = el.stepX ?? 0
  const out: ResolvedElement[] = []
  items.forEach((item, i) => {
    const ctx: Record<string, string> = {
      '$i':    String(i),
      '$item': typeof item === 'string' ? item : JSON.stringify(item),
    }
    if (typeof item === 'object' && item !== null) {
      Object.entries(item as object).forEach(([k, v]) => { ctx[`$item.${k}`] = String(v) })
    }
    el.children.forEach(child => {
      const offset: JsonStaticElement = {
        ...child,
        id: child.id.includes('$i') ? child.id.replace('$i', String(i)) : `${child.id}_${i}`,
        x: el.baseX + child.x + i * stepX,
        y: el.baseY + child.y + i * stepY,
      } as JsonStaticElement
      out.push(...buildStatic(offset, tokens, spec, slideId, pageNumber, ctx))
    })
  })
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildKpiGrid(el: JsonKpiGrid, tokens: BrandTokens, spec: Record<string, any>, slideId: string): ResolvedElement[] {
  const baseX         = el.baseX         ?? 0.55
  const baseY         = el.baseY         ?? 2.2
  const availableW    = el.availableW    ?? CONTENT_SAFE.width
  const availableH    = el.availableH    ?? 4.6
  const gapX          = el.gapX          ?? 0.25
  const gapY          = el.gapY          ?? 0.2
  const maxItems      = el.maxItems      ?? 6
  const cardAccentH   = el.cardAccentH   ?? 0.06
  const valueFontSize = el.valueFontSize ?? 38
  const labelFontSize = el.labelFontSize ?? 12
  const subFontSize   = el.sublabelFontSize ?? 9

  const kpis = ((spec.kpis ?? []) as Array<{ value: string; label: string; sublabel?: string }>).slice(0, maxItems)
  const cols   = kpis.length <= 3 ? kpis.length : kpis.length <= 4 ? 2 : 3
  const rows   = Math.ceil(kpis.length / Math.max(cols, 1))
  const cardW  = (availableW - (cols - 1) * gapX) / Math.max(cols, 1)
  const cardH  = (availableH - (rows - 1) * gapY) / Math.max(rows, 1)
  const out: ResolvedElement[] = []

  kpis.forEach((kpi, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x   = baseX + col * (cardW + gapX)
    const y   = baseY + row * (cardH + gapY)
    out.push(
      { id: `${slideId}_card_${i}`, type: 'rect', bounds: { x, y, w: cardW, h: cardH }, z: Z.contentBackground, visible: true, style: { fill: tokens.white, borderRadius: 0.1 } },
      { id: `${slideId}_ctop_${i}`, type: 'rect', bounds: { x, y, w: cardW, h: cardAccentH }, z: Z.content, visible: true, style: { fill: tokens.primary } },
      { id: `${slideId}_val_${i}`, type: 'text', bounds: { x: x + 0.2, y: y + cardAccentH, w: cardW - 0.4, h: cardH * 0.50 }, z: Z.content, visible: true,
        text: { content: kpi.value, fontFamily: tokens.headlineFont, fontSizePt: valueFontSize, fontWeight: 'bold', color: tokens.primary, align: 'left', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'fitted' } },
      { id: `${slideId}_lbl_${i}`, type: 'text', bounds: { x: x + 0.2, y: y + cardH * 0.56, w: cardW - 0.4, h: cardH * 0.28 }, z: Z.content, visible: true,
        text: { content: kpi.label, fontFamily: tokens.bodyFont, fontSizePt: labelFontSize, fontWeight: 'normal', color: tokens.dark, align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1.2, overflow: 'fitted' } },
    )
    if (kpi.sublabel) out.push(
      { id: `${slideId}_sub_${i}`, type: 'text', bounds: { x: x + 0.2, y: y + cardH * 0.82, w: cardW - 0.4, h: cardH * 0.16 }, z: Z.content, visible: true,
        text: { content: kpi.sublabel, fontFamily: tokens.bodyFont, fontSizePt: subFontSize, fontWeight: 'normal', color: 'rgba(0,0,0,0.45)', align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1.2, overflow: 'clip' } }
    )
  })
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCardGrid(el: JsonCardGrid, tokens: BrandTokens, spec: Record<string, any>, slideId: string): ResolvedElement[] {
  const source        = el.source        ?? 'cards'
  const baseX         = el.baseX         ?? 0.55
  const baseY         = el.baseY         ?? 2.05
  const availableW    = el.availableW    ?? CONTENT_SAFE.width
  const availableH    = el.availableH    ?? 4.65
  const gapX          = el.gapX          ?? 0.18
  const gapY          = el.gapY          ?? 0.18
  const maxItems      = el.maxItems      ?? 8
  const maxColumns    = Math.max(1, el.maxColumns ?? 4)
  const titleFontSize = el.titleFontSize ?? 12
  const valueFontSize = el.valueFontSize ?? 22
  const bodyFontSize  = el.bodyFontSize  ?? 8
  const cards = ((spec[source] ?? []) as Array<{
    title?: unknown
    value?: unknown
    description?: unknown
    bullets?: unknown[]
  }>).slice(0, maxItems)
  if (cards.length === 0) return []

  const cols = Math.min(maxColumns, cards.length <= 3 ? cards.length : cards.length <= 6 ? 3 : 4)
  const rows = Math.ceil(cards.length / cols)
  const cardW = (availableW - (cols - 1) * gapX) / cols
  const cardH = (availableH - (rows - 1) * gapY) / rows
  const out: ResolvedElement[] = []

  cards.forEach((card, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = baseX + col * (cardW + gapX)
    const y = baseY + row * (cardH + gapY)
    const value = card.value === undefined || card.value === null ? '' : String(card.value)
    const title = String(card.title ?? '')
    const description = String(card.description ?? '')
    const bullets = Array.isArray(card.bullets)
      ? card.bullets.map(String).filter(Boolean).slice(0, rows > 1 ? 3 : 5)
      : []
    const headerH = Math.min(0.62, cardH * 0.25)
    const contentTop = y + headerH + 0.12

    out.push(
      {
        id: `${slideId}_card_bg_${index}`,
        type: 'rect',
        bounds: { x, y, w: cardW, h: cardH },
        z: Z.contentBackground,
        visible: true,
        style: { fill: tokens.white, borderRadius: 0.06 },
      },
      {
        id: `${slideId}_card_head_${index}`,
        type: 'rect',
        bounds: { x, y, w: cardW, h: headerH },
        z: Z.contentBackground + 1,
        visible: true,
        style: { fill: index % 3 === 1 ? tokens.dark : tokens.primary },
      },
      {
        id: `${slideId}_card_title_${index}`,
        type: 'text',
        bounds: { x: x + 0.14, y, w: cardW - 0.28, h: headerH },
        z: Z.content,
        visible: true,
        text: {
          content: title,
          fontFamily: tokens.headlineFont,
          fontSizePt: titleFontSize,
          fontWeight: 'bold',
          color: tokens.white,
          align: 'left',
          verticalAlign: 'middle',
          lineHeightMultiplier: 1.05,
          overflow: 'fitted',
        },
      },
    )

    let bodyY = contentTop
    if (value) {
      const valueH = Math.min(0.52, cardH * 0.24)
      out.push({
        id: `${slideId}_card_value_${index}`,
        type: 'text',
        bounds: { x: x + 0.16, y: bodyY, w: cardW - 0.32, h: valueH },
        z: Z.content,
        visible: true,
        text: {
          content: value,
          fontFamily: tokens.headlineFont,
          fontSizePt: valueFontSize,
          fontWeight: 'bold',
          color: tokens.primary,
          align: 'left',
          verticalAlign: 'middle',
          lineHeightMultiplier: 1,
          overflow: 'fitted',
        },
      })
      bodyY += valueH + 0.06
    }

    if (description) {
      const descH = Math.min(cardH * 0.32, Math.max(0.35, cardH - (bodyY - y) - 0.16))
      out.push({
        id: `${slideId}_card_desc_${index}`,
        type: 'text',
        bounds: { x: x + 0.16, y: bodyY, w: cardW - 0.32, h: descH },
        z: Z.content,
        visible: true,
        text: {
          content: description,
          fontFamily: tokens.bodyFont,
          fontSizePt: bodyFontSize,
          fontWeight: 'normal',
          color: tokens.dark,
          align: 'left',
          verticalAlign: 'top',
          lineHeightMultiplier: 1.2,
          overflow: 'fitted',
        },
      })
      bodyY += descH + 0.05
    }

    if (bullets.length > 0) {
      const remainingH = Math.max(0.25, cardH - (bodyY - y) - 0.12)
      const itemH = remainingH / bullets.length
      bullets.forEach((bullet, bulletIndex) => {
        const bulletY = bodyY + bulletIndex * itemH
        out.push(
          {
            id: `${slideId}_card_dot_${index}_${bulletIndex}`,
            type: 'rect',
            bounds: { x: x + 0.16, y: bulletY + 0.05, w: 0.07, h: 0.07 },
            z: Z.content,
            visible: true,
            style: { fill: tokens.primary, borderRadius: 99 },
          },
          {
            id: `${slideId}_card_bullet_${index}_${bulletIndex}`,
            type: 'text',
            bounds: { x: x + 0.31, y: bulletY, w: cardW - 0.47, h: itemH },
            z: Z.content,
            visible: true,
            text: {
              content: bullet,
              fontFamily: tokens.bodyFont,
              fontSizePt: Math.max(6.5, bodyFontSize - 0.5),
              fontWeight: 'normal',
              color: tokens.dark,
              align: 'left',
              verticalAlign: 'top',
              lineHeightMultiplier: 1.15,
              overflow: 'fitted',
            },
          },
        )
      })
    }
  })

  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTimelineSteps(el: JsonTimelineSteps, tokens: BrandTokens, spec: Record<string, any>, slideId: string): ResolvedElement[] {
  const source        = el.source        ?? 'steps'
  const lineY         = el.lineY         ?? 3.8
  const lineX         = el.lineX         ?? 0.55
  const lineW         = el.lineW         ?? CONTENT_SAFE.width
  const maxItems      = el.maxItems      ?? 5
  const circleR       = el.circleR       ?? 0.22
  const numFontSize   = el.numberFontSize ?? 11
  const labelFontSize = el.labelFontSize  ?? 13
  const descFontSize  = el.descFontSize   ?? 11

  const steps = ((spec[source] ?? []) as Array<{ number: string; label: string; description?: string }>).slice(0, maxItems)
  const stepW = lineW / Math.max(steps.length, 1)
  const out: ResolvedElement[] = [
    { id: `${slideId}_tl_line`, type: 'rect', bounds: { x: lineX, y: lineY - 0.015, w: lineW, h: 0.03 }, z: Z.decorative, visible: true, style: { fill: tokens.primary, opacity: 0.3 } },
  ]
  steps.forEach((step, i) => {
    const cx = lineX + i * stepW + stepW / 2
    out.push(
      { id: `${slideId}_tl_circle_${i}`, type: 'rect', bounds: { x: cx - circleR, y: lineY - circleR, w: circleR * 2, h: circleR * 2 }, z: Z.content, visible: true, style: { fill: tokens.primary, borderRadius: 99 } },
      { id: `${slideId}_tl_num_${i}`, type: 'text', bounds: { x: cx - circleR, y: lineY - circleR, w: circleR * 2, h: circleR * 2 }, z: Z.content + 1, visible: true,
        text: { content: step.number, fontFamily: tokens.headlineFont, fontSizePt: numFontSize, fontWeight: 'bold', color: tokens.white, align: 'center', verticalAlign: 'middle', lineHeightMultiplier: 1, overflow: 'clip' } },
      { id: `${slideId}_tl_label_${i}`, type: 'text', bounds: { x: cx - stepW * 0.45, y: lineY + circleR + 0.13, w: stepW * 0.9, h: 0.45 }, z: Z.content, visible: true,
        text: { content: step.label, fontFamily: tokens.bodyFont, fontSizePt: labelFontSize, fontWeight: 'bold', color: tokens.dark, align: 'center', verticalAlign: 'top', lineHeightMultiplier: 1.2, overflow: 'fitted' } },
    )
    if (step.description) out.push(
      { id: `${slideId}_tl_desc_${i}`, type: 'text', bounds: { x: cx - stepW * 0.45, y: lineY + circleR + 0.65, w: stepW * 0.9, h: 1.8 }, z: Z.content, visible: true,
        text: { content: step.description, fontFamily: tokens.bodyFont, fontSizePt: descFontSize, fontWeight: 'normal', color: 'rgba(0,0,0,0.55)', align: 'center', verticalAlign: 'top', lineHeightMultiplier: 1.35, overflow: 'fitted' } }
    )
    if (i % 2 === 0) out.push(
      { id: `${slideId}_tl_above_${i}`, type: 'text', bounds: { x: cx - stepW * 0.45, y: 2.2, w: stepW * 0.9, h: 1.4 }, z: Z.content, visible: true,
        text: { content: step.label, fontFamily: tokens.bodyFont, fontSizePt: labelFontSize - 1, fontWeight: 'bold', color: tokens.primary, align: 'center', verticalAlign: 'top', lineHeightMultiplier: 1.2, overflow: 'fitted' } }
    )
  })
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTwoColumnList(el: JsonTwoColumnList, tokens: BrandTokens, spec: Record<string, any>, slideId: string): ResolvedElement[] {
  const divX          = el.dividerX      ?? 6.3
  const leftX         = el.leftX         ?? 0.55
  const rightX        = el.rightX        ?? 6.55
  const colW          = el.colW          ?? 5.5
  const startY        = el.startY        ?? 2.15
  const availableH    = el.availableH    ?? 4.55
  const headFontSize  = el.headingFontSize ?? 15
  const itemFontSize  = el.itemFontSize   ?? 14

  const out: ResolvedElement[] = [
    { id: `${slideId}_col_divider`, type: 'rect', bounds: { x: divX, y: 2.1, w: 0.02, h: 4.8 }, z: Z.decorative, visible: true, style: { fill: 'rgba(0,0,0,0.12)' } },
  ]
  ;[
    { heading: spec.leftHeading  as string | undefined, bullets: (spec.leftItems  ?? spec.leftBullets  ?? []) as string[], x: leftX,  color: tokens.dark },
    { heading: spec.rightHeading as string | undefined, bullets: (spec.rightItems ?? spec.rightBullets ?? []) as string[], x: rightX, color: tokens.primary },
  ].forEach(({ heading, bullets, x, color }, col) => {
    let y = startY
    if (heading && !el.suppressHeadings) {
      out.push({ id: `${slideId}_col_hd_${col}`, type: 'text', bounds: { x, y, w: colW, h: 0.4 }, z: Z.content, visible: true,
        text: { content: heading, fontFamily: tokens.headlineFont, fontSizePt: headFontSize, fontWeight: 'bold', color: tokens.primary, align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1.2, overflow: 'clip' } })
      y += 0.5
    }
    const items  = (bullets ?? []).slice(0, 5)
    const itemH  = Math.min(0.75, availableH / Math.max(items.length, 1))
    items.forEach((b, i) => {
      const iy = y + i * itemH
      out.push(
        { id: `${slideId}_col_dot_${col}_${i}`, type: 'rect', bounds: { x, y: iy + 0.06, w: 0.1, h: 0.1 }, z: Z.content, visible: true, style: { fill: color, borderRadius: 99 } },
        { id: `${slideId}_col_b_${col}_${i}`, type: 'text', bounds: { x: x + 0.22, y: iy, w: colW - 0.22, h: itemH }, z: Z.content, visible: true,
          text: { content: b, fontFamily: tokens.bodyFont, fontSizePt: itemFontSize, fontWeight: 'normal', color: tokens.dark, align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1.3, overflow: 'fitted' } },
      )
    })
  })
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAgendaList(el: JsonAgendaList, tokens: BrandTokens, spec: Record<string, any>, slideId: string): ResolvedElement[] {
  const startX       = el.startX     ?? 0.55
  const startY       = el.startY     ?? 2.15
  const maxItems     = el.maxItems   ?? 8
  const itemFontSize = el.itemFontSize ?? 15
  const dotSize      = el.dotSize    ?? 0.14

  const items  = ((spec.items ?? []) as string[]).slice(0, maxItems)
  const cols   = items.length > 4 ? 2 : 1
  const colW   = cols === 2 ? 5.5 : CONTENT_SAFE.width
  const half   = Math.ceil(items.length / 2)
  const itemH  = cols === 2 ? Math.min(0.72, 4.7 / half) : Math.min(0.72, 4.7 / items.length)
  const out: ResolvedElement[] = []

  items.forEach((item, i) => {
    const col  = cols === 2 ? Math.floor(i / half) : 0
    const row  = cols === 2 ? i % half : i
    const x    = startX + col * 6.0
    const y    = startY + row * itemH
    out.push(
      { id: `${slideId}_ag_dot_${i}`, type: 'rect', bounds: { x, y: y + 0.05, w: dotSize, h: dotSize }, z: Z.content, visible: true, style: { fill: tokens.primary, borderRadius: 99 } },
      { id: `${slideId}_ag_item_${i}`, type: 'text', bounds: { x: x + dotSize + 0.14, y, w: colW - dotSize - 0.14, h: itemH }, z: Z.content, visible: true,
        text: { content: item, fontFamily: tokens.bodyFont, fontSizePt: itemFontSize, fontWeight: 'normal', color: tokens.dark, align: 'left', verticalAlign: 'top', lineHeightMultiplier: 1.3, overflow: 'fitted' } },
    )
  })
  return out
}

// ── Public entry point ─────────────────────────────────────────────────────────

export function interpretLayout(
  layout: JsonSlideLayout,
  tokens: BrandTokens,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: Record<string, any>,
  slideId: string,
  pageNumber: number,
): { background: string; elements: ResolvedElement[] } {
  const tokenCtx = TOKEN_MAP(tokens)
  const r = (s: string) => resolve(s, tokens, spec, tokenCtx)
  const background = r(layout.background)
  const elements: ResolvedElement[] = []

  for (const el of layout.elements) {
    switch (el.type) {
      case 'repeat':
        elements.push(...buildRepeat(el as JsonRepeat, tokens, spec, slideId, pageNumber)); break
      case 'kpi_grid':
        elements.push(...buildKpiGrid(el as JsonKpiGrid, tokens, spec, slideId)); break
      case 'timeline_steps':
        elements.push(...buildTimelineSteps(el as JsonTimelineSteps, tokens, spec, slideId)); break
      case 'two_column_list':
        elements.push(...buildTwoColumnList(el as JsonTwoColumnList, tokens, spec, slideId)); break
      case 'agenda_list':
        elements.push(...buildAgendaList(el as JsonAgendaList, tokens, spec, slideId)); break
      case 'card_grid':
        elements.push(...buildCardGrid(el as JsonCardGrid, tokens, spec, slideId)); break
      default:
        elements.push(...buildStatic(el as JsonStaticElement, tokens, spec, slideId, pageNumber, tokenCtx)); break
    }
  }

  // Apply contrast against the element's actual local backdrop. This respects
  // layout-defined card/table/header fills instead of incorrectly recoloring
  // white text merely because the slide canvas itself is light.
  const white: RgbaColor = { r: 255, g: 255, b: 255, a: 1 }
  const slideBg = composite(parseColor(background) ?? white, white)
  const localBackground = (target: ResolvedElement): RgbaColor => {
    const cx = target.bounds.x + target.bounds.w / 2
    const cy = target.bounds.y + target.bounds.h / 2
    const layers = elements
      .filter(candidate =>
        candidate.type === 'rect'
        && candidate.z < target.z
        && !!candidate.style?.fill
        && cx >= candidate.bounds.x
        && cx <= candidate.bounds.x + candidate.bounds.w
        && cy >= candidate.bounds.y
        && cy <= candidate.bounds.y + candidate.bounds.h
      )
      .sort((a, b) => a.z - b.z)

    return layers.reduce((bg, layer) => {
      const fill = parseColor(layer.style?.fill ?? '')
      if (!fill) return bg
      return composite({ ...fill, a: fill.a * (layer.style?.opacity ?? 1) }, bg)
    }, slideBg)
  }

  for (const el of elements) {
    const bg = localBackground(el)
    if (el.type === 'text' && el.text) {
      const rawText = parseColor(el.text.color)
      const visibleText = rawText ? composite(rawText, bg) : null
      const isNeutral = rawText
        ? Math.max(rawText.r, rawText.g, rawText.b) - Math.min(rawText.r, rawText.g, rawText.b) < 18
        : false
      if (
        !visibleText
        || contrastRatio(visibleText, bg) < 4.5
        || (isNeutral && rawText!.a < 1)
      ) {
        el.text.color = relativeLuminance(bg) < 0.42 ? tokens.white : tokens.dark
      }
    } else if (el.type === 'chart' && el.chart) {
      el.chart.textColor = relativeLuminance(bg) < 0.42 ? tokens.white : tokens.dark
    }
  }

  return { background, elements }
}
