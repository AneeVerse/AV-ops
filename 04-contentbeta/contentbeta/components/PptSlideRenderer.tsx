'use client'
import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ComponentStyle {
  fill?: string
  text_color?: string
  font_family?: string
  font_size?: number
  font_weight?: string
  line_height?: number
  alignment?: string
  letter_spacing?: number
  text_transform?: string
  border_radius?: number
  opacity?: number
  stroke?: string
  stroke_width?: number
}

export interface ChartDataPoint { label: string; value: number; display_value?: string; series?: string }
export interface ChartLayout { required?: boolean; chart_type?: string; chart_data?: ChartDataPoint[]; series_colors?: string[] }
export interface TableLayout { required?: boolean; columns?: string[]; rows?: Array<{ cells?: string[] } | string[]>; header_fill?: string; header_text?: string }
export interface ImageLayout { required?: boolean; image_prompt?: string; image_zone_id?: string }

export interface RenderComponent {
  id: string
  semantic_role: string
  component_type: string
  content?: string
  x: number; y: number; width: number; height: number
  zIndex?: number
  editable_in_ppt?: boolean
  render_mode?: string
  safeAreaCritical?: boolean
  image_url?: string
  style?: ComponentStyle
  children?: RenderComponent[]
}

export interface RenderReadySlide {
  slide_number: number
  archetype?: string
  layout_variant?: string
  background?: { fill?: string; color?: string }
  components: RenderComponent[]
  chart_layout?: ChartLayout
  table_layout?: TableLayout
  image_layout?: ImageLayout
  image_generation_prompt?: string
  speaker_notes?: string
}

export interface RenderReadyPlan { slides: RenderReadySlide[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlaceholderContent(text?: string): boolean {
  if (!text) return false
  const t = text.toLowerCase().trim()
  return (
    /^container for/.test(t) ||
    /^background (bar|shape|panel|overlay|strip|block) for/.test(t) ||
    /(panel|section|zone|area)\s+container$/.test(t) ||
    /^(left|right|top|bottom|center)\s+(panel|container|section|area|zone|column|block)/.test(t) ||
    /^(decorative|background|overlay|divider|separator)\s/.test(t) ||
    t.endsWith(' container') ||
    t.endsWith(' placeholder') ||
    t.endsWith(' background') ||
    t.endsWith(' panel')
  )
}
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex?.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function isLightColor(hex?: string): boolean {
  if (!hex || hex === 'transparent') return true
  const rgb = hexToRgb(hex)
  if (!rgb) return true
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  const lum = 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2])
  return lum > 0.35
}

function fontFamilyCSS(family?: string): string {
  if (!family) return 'Calibri, Arial, sans-serif'
  const l = family.toLowerCase()
  if (l.includes('industry') || l.includes('arial black')) return '"Arial Black", Arial, sans-serif'
  if (l.includes('inter'))    return 'Inter, system-ui, sans-serif'
  if (l.includes('calibri'))  return 'Calibri, Arial, sans-serif'
  if (l.includes('arial'))    return 'Arial, sans-serif'
  return `"${family}", Calibri, Arial, sans-serif`
}

function fontWeightCSS(weight?: string): string | number {
  if (!weight) return 400
  const n = parseInt(weight)
  if (!isNaN(n)) return n
  const l = weight.toLowerCase()
  if (l === 'black' || l === 'extrabold') return 900
  if (l === 'bold') return 700
  if (l === 'semibold') return 600
  if (l === 'light') return 300
  return 400
}

// ─── Component renderer ───────────────────────────────────────────────────────
function ComponentRenderer({ comp, slideBg }: { comp: RenderComponent; slideBg: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: Record<string, any> = comp.style || {}
  // Normalize camelCase → snake_case (different batches return different conventions)
  const fill       = s.fill
  const textColor  = s.text_color  || s.textColor  || s.color
  const fontFamily = fontFamilyCSS(s.font_family  || s.fontFamily)
  const fontWeight = fontWeightCSS(String(s.font_weight  || s.fontWeight || ''))
  const fontSize   = s.font_size   || s.fontSize   || 16
  const lineHeight = s.line_height || s.lineHeight || 1.2
  const alignment  = (s.alignment  || s.text_align || s.textAlign || 'left') as 'left' | 'center' | 'right'
  const rawLS      = s.letter_spacing ?? s.letterSpacing
  const letterSp   = rawLS ? (typeof rawLS === 'string' ? rawLS : `${rawLS * 0.01}em`) : undefined
  const textTrans  = (s.text_transform || s.textTransform || 'none') as React.CSSProperties['textTransform']
  const radius     = s.border_radius || s.borderRadius || 0

  const base: React.CSSProperties = {
    position: 'absolute',
    left: comp.x,
    top: comp.y,
    width: comp.width,
    height: comp.height,
    zIndex: comp.zIndex ?? 10,
    boxSizing: 'border-box',
    overflow: 'hidden',
  }

  const type = comp.component_type?.toLowerCase()
  const role = comp.semantic_role?.toLowerCase()

  // background
  if (type === 'background' || role === 'slide_background') {
    return <div style={{ ...base, background: fill || '#FFFFFF', borderRadius: radius, overflow: 'visible' }} />
  }

  // image
  if (type === 'image_placeholder' || role === 'image_placeholder' || role === 'slide_image') {
    if (comp.image_url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comp.image_url} alt="" draggable={false} loading="lazy"
          style={{ ...base, objectFit: 'cover', display: 'block', borderRadius: radius }} />
      )
    }
    return (
      <div style={{ ...base, background: fill || '#DADDDD', borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>
    )
  }

  // logo
  if (type === 'logo_placeholder' || role === 'logo_placeholder') {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
        <span style={{ fontFamily, fontSize: 14, color: textColor || '#888', fontWeight: 700 }}>LOGO</span>
      </div>
    )
  }

  // page number
  if (type === 'page_number' || role === 'page_number') {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        fontFamily, fontSize: 13, color: textColor || '#888888' }}>
        {comp.content}
      </div>
    )
  }

  // chart
  if (type === 'chart' || type === 'chart_container' || role === 'chart_container') {
    return (
      <div style={{ ...base, background: fill || '#F2F3F3', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6C6F6C" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9l3-3 3 3 4-5 4 5"/><path d="M3 14h18"/>
        </svg>
        <span style={{ fontSize: 14, color: '#6C6F6C', fontFamily }}>{comp.content || 'CHART'}</span>
      </div>
    )
  }

  // table
  if (type === 'table' || type === 'table_container' || role === 'table_container') {
    return (
      <div style={{ ...base, background: fill || '#F2F3F3', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, color: '#6C6F6C', fontFamily }}>TABLE</span>
      </div>
    )
  }

  // connector
  if (type === 'connector' || role === 'process_connector') {
    return <div style={{ ...base, background: fill || '#888888', borderRadius: 2 }} />
  }

  // shape / card / decorative
  if (type === 'shape' || type === 'card' || type === 'decorative_pattern' || type === 'decorative_shape' || type === 'chart_shape') {
    const resolvedFill = fill === 'transparent' ? 'transparent' : (fill || 'transparent')
    const visibleContent = !isPlaceholderContent(comp.content) ? comp.content : undefined
    return (
      <div style={{
        ...base,
        background: resolvedFill,
        borderRadius: radius,
        border: s.stroke && s.stroke !== 'none' ? `${s.stroke_width || 1}px solid ${s.stroke}` : undefined,
        opacity: s.opacity ?? 1,
        display: visibleContent ? 'flex' : 'block',
        alignItems: visibleContent ? 'center' : undefined,
        justifyContent: visibleContent ? (alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start') : undefined,
        padding: visibleContent ? '8px 16px' : undefined,
      }}>
        {visibleContent && (
          <span style={{ color: textColor || '#FFFFFF', fontSize, fontFamily, fontWeight, lineHeight, textAlign: alignment, letterSpacing: letterSp, textTransform: textTrans, wordBreak: 'break-word' }}>
            {visibleContent}
          </span>
        )}
      </div>
    )
  }

  // text (default — covers text, bullet_item, stat values, kickers, etc.)
  const effectiveFill = fill && fill !== 'transparent' ? fill : undefined
  const textContent = isPlaceholderContent(comp.content) ? '' : (comp.content || '')
  return (
    <div style={{
      ...base,
      overflow: 'visible', // allow wrapped lines to show beyond the AI-assigned box height
      background: effectiveFill,
      borderRadius: radius,
      color: textColor || (isLightColor(slideBg) ? '#1a1a1a' : '#FFFFFF'),
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight,
      textAlign: alignment,
      letterSpacing: letterSp,
      textTransform: textTrans,
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
      padding: effectiveFill ? '4px 8px' : undefined,
    }}>
      {textContent}
    </div>
  )
}

// ─── Slide renderer ───────────────────────────────────────────────────────────
export function SlideRenderer({ slide, borderRadius = 8 }: { slide: RenderReadySlide; borderRadius?: number }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1920))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const bgFill = slide.background?.fill || slide.background?.color || '#FFFFFF'
  const sorted = [...(slide.components || [])].sort((a, b) => (a.zIndex ?? 10) - (b.zIndex ?? 10))

  return (
    <div ref={outerRef} style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius, border: '1px solid var(--border)' }}>
      {scale > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 1920, height: 1080,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          background: bgFill,
        }}>
          {sorted.map(comp => (
            <ComponentRenderer key={comp.id} comp={comp} slideBg={bgFill} />
          ))}
        </div>
      )}
    </div>
  )
}
