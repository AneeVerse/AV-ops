import type { RenderPlan, ResolvedElement, ChartData } from './types'
import { PX_PER_INCH } from './design-tokens'

function px(inches: number): number { return inches * PX_PER_INCH }

function isCompleteSvg(value?: string): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return /^<svg\b/i.test(trimmed) && /<\/svg>\s*$/i.test(trimmed)
}

function wrapLegendLabel(value: string, maxChars = 22): string[] {
  const words = String(value).trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars || !current) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  if (lines.length <= 2) return lines
  const second = lines.slice(1).join(' ')
  return [lines[0], `${second.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`]
}

export function ChartSvg({ chart, w, h }: { chart: ChartData; w: number; h: number }) {
  const {
    categories,
    series,
    primaryColor,
    textColor,
    accentColors,
    segmentColors,
    showLegend,
    headlineFont = 'Arial',
    bodyFont = 'Arial',
  } = chart
  // Layout can supply explicit per-segment colors; otherwise fall back to brand palette
  const segPalette = (segmentColors?.length ? segmentColors : [primaryColor, ...accentColors]).filter(Boolean)

  // Font sizes scaled to SVG height so they're readable at any canvas scale
  const fVal  = Math.round(h * 0.040)   // value labels above bars / center value
  const fCat  = Math.round(h * 0.032)   // category / legend text
  const fAxis = Math.round(h * 0.026)   // axis tick labels

  if (chart.type === 'doughnut') {
    const values = (series[0]?.values ?? []).map(Number)
    const total  = values.reduce((a, b) => a + b, 0) || 1
    // Smaller ring: constrained by height so chart doesn't feel overwhelming
    const r  = Math.min(w * 0.22, h * 0.30)
    const cx = w * 0.34
    const cy = h * 0.50
    const sw = r * 0.38
    const circ = 2 * Math.PI * r
    const gap  = circ * 0.008
    let acc = 0
    const legendX = w * 0.62
    const legendRowH = Math.max(fCat * 2.15, (h * 0.82) / Math.max(categories.length, 1))

    return (
      <g>
        {/* Track ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={textColor} strokeOpacity={0.09} strokeWidth={sw} />
        {values.map((val, i) => {
          const pct  = val / total
          const len  = Math.max(pct * circ - gap, 0)
          const offset = -(acc * circ) + circ * 0.25
          acc += pct
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={segPalette[i % segPalette.length]} strokeWidth={sw}
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={offset}
              strokeLinecap="butt" />
          )
        })}
        {/* Center value */}
        {chart.centerValue && (
          <text x={cx} y={cy + fVal * 0.38} textAnchor="middle" fill={textColor}
            fontSize={fVal * 1.7} fontWeight="700" fontFamily={headlineFont}>
            {chart.centerValue}
          </text>
        )}
        {chart.centerLabel && (
          <text x={cx} y={cy + fVal * 0.38 + fCat * 1.4} textAnchor="middle"
            fill={textColor} fontSize={fCat} opacity={0.55} fontFamily={bodyFont}>
            {chart.centerLabel}
          </text>
        )}
        {/* Legend — hidden when layout supplies its own legend element */}
        {showLegend !== false && categories.map((cat, i) => {
          const dot = Math.round(fCat * 0.72)
          const vy = h * 0.09 + i * legendRowH + legendRowH / 2
          const pct = total > 0 ? Math.round((values[i] / total) * 100) : 0
          const legendValueX = Math.round(w * 0.98)
          const labelLines = wrapLegendLabel(cat)
          const labelX = legendX + dot + 10
          const lineGap = fCat * 1.08
          const firstLineY = vy - ((labelLines.length - 1) * lineGap) / 2 + fCat * 0.36
          return (
            <g key={i}>
              <rect x={legendX} y={vy - dot / 2} width={dot} height={dot}
                fill={segPalette[i % segPalette.length]} rx={3} />
              <text x={labelX} y={firstLineY}
                fill={textColor} fontSize={fCat} fontFamily={bodyFont}>
                {labelLines.map((line, lineIndex) => (
                  <tspan key={lineIndex} x={labelX} dy={lineIndex === 0 ? 0 : lineGap}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text x={legendValueX} y={vy + fCat * 0.36} textAnchor="end"
                fill={textColor} fontSize={fCat} fontWeight="600" fontFamily={headlineFont}>
                {values[i] !== undefined ? `${values[i]}${chart.unitSuffix ?? ''}` : `${pct}%`}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  // ── Bar chart ───────────────────────────────────────────────────────────────
  const allBarValues = series.flatMap(item => (item.values ?? []).map(Number))
  const rawMax = Math.max(...allBarValues, 0)

  // Nice round ceiling for Y-axis
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax || 1)))
  const niceMax = Math.ceil((rawMax * 1.15) / magnitude) * magnitude || 1

  const hasSeriesLegend = series.length > 1 && series.some(item => item.name)
  const padL = w * 0.07, padR = w * 0.03, padT = h * (hasSeriesLegend ? 0.19 : 0.12), padB = h * 0.18
  const cw = w - padL - padR
  const ch = h - padT - padB
  const n = Math.max(categories.length, 1)
  const barGroupW = cw / n
  const barsPerGroup = Math.max(series.length, 1)
  const groupInnerW = barGroupW * 0.78
  const barGap = Math.min(groupInnerW * 0.06, 7)
  const barW = Math.min(
    (groupInnerW - barGap * (barsPerGroup - 1)) / barsPerGroup,
    w * 0.09,
  )

  // 4 horizontal grid lines
  const gridLines = [0.25, 0.5, 0.75, 1.0]

  return (
    <g>
      {hasSeriesLegend && (
        <g>
          {series.map((item, index) => {
            const itemW = w * 0.19
            const legendX = padL + index * itemW
            const color = item.color || segPalette[index % segPalette.length]
            return (
              <g key={`legend-${index}`}>
                <rect x={legendX} y={h * 0.035} width={Math.max(8, fCat * 0.72)} height={Math.max(8, fCat * 0.72)}
                  fill={color} rx={2} />
                <text x={legendX + Math.max(8, fCat * 0.72) + 8} y={h * 0.035 + fCat * 0.72}
                  fill={textColor} fontSize={fCat} fontFamily={bodyFont}>
                  {item.name}
                </text>
              </g>
            )
          })}
        </g>
      )}
      {/* Grid lines + Y-axis labels */}
      {gridLines.map((frac) => {
        const gy = padT + ch * (1 - frac)
        const val = Math.round(niceMax * frac)
        return (
          <g key={frac}>
            <line x1={padL} y1={gy} x2={w - padR} y2={gy}
              stroke={textColor} strokeOpacity={0.10} strokeWidth={1.5} />
            <text x={padL - 8} y={gy + fAxis * 0.36} textAnchor="end"
              fill={textColor} fontSize={fAxis} opacity={0.45} fontFamily={bodyFont}>
              {val}{chart.unitSuffix ?? ''}
            </text>
          </g>
        )
      })}
      {/* Baseline */}
      <line x1={padL} y1={padT + ch} x2={w - padR} y2={padT + ch}
        stroke={textColor} strokeWidth={2} opacity={0.15} />

      {/* Bars */}
      {categories.map((cat, ci) => {
        const groupX = padL + barGroupW * ci + (barGroupW - groupInnerW) / 2
        return (
          <g key={ci}>
            {series.map((item, si) => {
              const val = Number(item.values?.[ci] ?? 0)
              const bh = (val / niceMax) * ch
              const bx = groupX + si * (barW + barGap)
              const by = padT + ch - bh
              const color = item.color || segPalette[si % segPalette.length] || primaryColor
              return (
                <g key={si}>
                  <rect x={bx} y={by} width={barW} height={bh}
                    fill={color} rx={Math.round(barW * 0.08)} />
                  <text x={bx + barW / 2} y={by - fVal * 0.35} textAnchor="middle"
                    fill={color} fontSize={series.length > 2 ? fAxis : fVal} fontWeight="700" fontFamily={headlineFont}>
                    {val}{chart.unitSuffix ?? ''}
                  </text>
                </g>
              )
            })}
            {/* Category label */}
            <text x={padL + barGroupW * ci + barGroupW / 2} y={padT + ch + fCat * 1.1} textAnchor="middle"
              fill={textColor} fontSize={fCat} opacity={0.65} fontFamily={bodyFont}>
              {cat}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function ElementRenderer({ el, native = false }: { el: ResolvedElement; native?: boolean }) {
  const { bounds: b, style: s = {} } = el
  const base: React.CSSProperties = {
    position: 'absolute',
    left: px(b.x), top: px(b.y),
    width: px(b.w), height: px(b.h),
    zIndex: el.z,
    opacity: s.opacity ?? 1,
    boxSizing: 'border-box',
  }

  if (!el.visible) return null

  if (el.type === 'rect') {
    return <div style={{
      ...base,
      background: s.fill || 'transparent',
      borderRadius: s.borderRadius ? px(s.borderRadius) : undefined,
      border: s.stroke ? `${s.strokeWidth || 1}px solid ${s.stroke}` : undefined,
    }} />
  }

  if (el.type === 'image' && el.assetId) {
    const fit = el.id.toLowerCase().includes('logo') ? 'contain' : (el.imageFit ?? 'cover')
    const objectFit = fit === 'stretch' ? 'fill' : fit
    const isSvg  = /\.svg(\?|#|$)/i.test(el.assetId)
    if (native) {
      // SVGs via CSS background-image are broken in html2canvas — it ignores background-size
      // and renders at the SVG's natural dimensions. Use <img> with explicit px bounds instead;
      // html2canvas respects the img element's width/height for SVGs.
      if (isSvg || fit === 'contain') {
        // eslint-disable-next-line @next/next/no-img-element
        return (
          <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src={el.assetId} alt="" crossOrigin="anonymous" loading="eager"
              data-image-fit={fit}
              data-element-id={el.id}
              style={{ width: '100%', height: '100%', objectFit, display: 'block' }} />
          </div>
        )
      }
      // Raster images use the layout's explicit fit mode in preview and PDF capture.
      return <div style={{
        ...base,
        backgroundImage: `url(${el.assetId})`,
        backgroundSize: fit === 'stretch' ? '100% 100%' : fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={el.assetId} alt="" draggable={false} loading="lazy"
      style={{ ...base, objectFit }} />
  }

  if (el.type === 'chart' && el.chart) {
    const w = px(b.w), h = px(b.h)
    if (isCompleteSvg(el.chart.svgCode)) {
      const svgCode = el.chart.svgCode.replace(/<svg /, '<svg style="width:100%;height:100%;" ')
      return (
        <div style={{ ...base, overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: svgCode }} />
      )
    }
    return (
      <div style={base}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
          <ChartSvg chart={el.chart} w={w} h={h} />
        </svg>
      </div>
    )
  }

  if (el.type === 'text' && el.text) {
    const t = el.text
    const sizePt = t.fittedSizePt ?? t.fontSizePt
    const sizePx = sizePt * (PX_PER_INCH / 72)
    const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' } as const
    const valignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

    if (t.lines?.length) {
      return (
        <div style={{
          ...base,
          display: 'flex',
          flexDirection: 'column',
          alignItems: alignMap[t.align] || 'flex-start',
          justifyContent: valignMap[t.verticalAlign] || 'flex-start',
          overflow: t.overflow === 'visible' ? 'visible' : 'hidden',
        }}>
          {t.lines.map((line, i) => (
            <span key={i} style={{
              fontFamily: `"${t.fontFamily}", Arial, sans-serif`,
              fontSize: sizePx,
              fontWeight: t.fontWeight === 'bold' ? 700 : 400,
              color: t.color,
              lineHeight: t.lineHeightMultiplier,
              textTransform: t.uppercase ? 'uppercase' : undefined,
              whiteSpace: 'pre',
              textAlign: t.align,
              width: '100%',
            }}>{line}</span>
          ))}
        </div>
      )
    }

    // Fallback: raw text without line wrapping
    return (
      <div style={{
        ...base,
        fontFamily: `"${t.fontFamily}", Arial, sans-serif`,
        fontSize: sizePx,
        fontWeight: t.fontWeight === 'bold' ? 700 : 400,
        color: t.color,
        lineHeight: t.lineHeightMultiplier,
        textTransform: t.uppercase ? 'uppercase' : undefined,
        textAlign: t.align,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: valignMap[t.verticalAlign] || 'flex-start',
        alignItems: alignMap[t.align] || 'flex-start',
        overflow: t.overflow === 'visible' ? 'visible' : 'hidden',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}>
        {t.uppercase ? t.content.toUpperCase() : t.content}
      </div>
    )
  }

  return null
}

export function PptSlideMarkup({ plan }: { plan: RenderPlan }) {
  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', background: plan.background }}>
      {plan.elements.map(el => <ElementRenderer key={el.id} el={el} native />)}
    </div>
  )
}
