'use client'
import { useEffect, useRef } from 'react'

export interface BannerColors {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  visualTheme: string
}

export interface BannerAssets {
  colors: BannerColors
  bgImageUrl: string
  logoUrl: string | null
}

export interface BannerCopy {
  heading: string
  subheading: string
  cta: string
}

export interface TemplateElement {
  id: string
  url: string
  x: number
  y: number
  scale: number
  layer: 'background' | 'foreground'
}

export interface ElementConfig {
  visible: boolean
  fontSize: number
  fontWeight: string
  textAlign: 'left' | 'center' | 'right'
  marginTop: number
  fontFamily: string
}

export type DragType = 'logo' | 'heading' | 'subheading' | 'cta'

export interface BannerSizeTemplate {
  heading: ElementConfig
  subheading: ElementConfig
  cta: ElementConfig & {
    size: 'small' | 'medium' | 'large'
    textTransform: 'uppercase' | 'capitalize' | 'none'
    paddingH: number
    paddingV: number
    borderWidth: number
    borderColor: string
    borderRadius: number
  }
  image: { size: 'small' | 'medium' | 'large' | 'none' | 'full' }
  logoSize: number
  layout: {
    paddingLeft: number
    paddingRight: number
    paddingTop: number
    paddingBottom: number
    gap: number
    justify: 'start' | 'center' | 'end'
  }
  pinned?: Partial<Record<DragType, { xPct: number; yPct: number }>>
  elements?: TemplateElement[]
  customFonts?: { name: string; url: string }[]
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEF_EL = (visible: boolean, fontSize: number, fw: string, align: 'left'|'center'|'right'): ElementConfig =>
  ({ visible, fontSize, fontWeight: fw, textAlign: align, marginTop: 0, fontFamily: '' })

const DEF_CTA = (fontSize: number, size: 'small'|'medium'|'large', align: 'left'|'center'|'right' = 'left') => ({
  visible: true, fontSize, fontWeight: '700', textAlign: align, marginTop: 0, fontFamily: '',
  size, textTransform: 'uppercase' as const,
  paddingH: 12, paddingV: 8, borderWidth: 0, borderColor: '#000000', borderRadius: 4,
})

const DEF_LH = (pl: number, pr: number, pt: number, pb: number, gap: number): BannerSizeTemplate['layout'] =>
  ({ paddingLeft: pl, paddingRight: pr, paddingTop: pt, paddingBottom: pb, gap, justify: 'center' })

const DEF_LV = (pl: number, pr: number, pt: number, pb: number, gap: number): BannerSizeTemplate['layout'] =>
  ({ paddingLeft: pl, paddingRight: pr, paddingTop: pt, paddingBottom: pb, gap, justify: 'start' })

export const DEFAULT_BANNER_TEMPLATES: Record<string, BannerSizeTemplate> = {
  billboard:        { heading: DEF_EL(true,18,'700','left'),   subheading: DEF_EL(true, 12,'500','left'),   cta: DEF_CTA(11,'medium','left'),   image:{size:'medium'}, logoSize:52, layout: DEF_LH(20,12, 0, 0,6) },
  leaderboard:      { heading: DEF_EL(true,11,'700','left'),   subheading: DEF_EL(false, 9,'400','left'),   cta: DEF_CTA( 9,'small', 'left'),   image:{size:'small'},  logoSize:36, layout: DEF_LH(16, 8, 0, 0,4) },
  superleaderboard: { heading: DEF_EL(true,11,'700','left'),   subheading: DEF_EL(false, 9,'400','left'),   cta: DEF_CTA( 9,'small', 'left'),   image:{size:'small'},  logoSize:36, layout: DEF_LH(16, 8, 0, 0,4) },
  mediumrect:       { heading: DEF_EL(true,14,'700','left'),   subheading: DEF_EL(true, 10,'500','left'),   cta: DEF_CTA(10,'medium','left'),   image:{size:'medium'}, logoSize:44, layout: DEF_LH(14, 8, 0, 0,5) },
  smartphone:       { heading: DEF_EL(true, 7,'700','left'),   subheading: DEF_EL(false, 6,'400','left'),   cta: DEF_CTA( 7,'small', 'left'),   image:{size:'full'},   logoSize:24, layout: DEF_LH( 8, 8, 0, 0,3) },
  skyscraper:       { heading: DEF_EL(true,13,'700','center'), subheading: DEF_EL(true,  9,'500','center'), cta: DEF_CTA(11,'medium','center'), image:{size:'medium'}, logoSize:44, layout: DEF_LV(12,12,14,10,6) },
  portrait:         { heading: DEF_EL(true,17,'700','center'), subheading: DEF_EL(true, 12,'500','center'), cta: DEF_CTA(14,'large', 'center'), image:{size:'large'},  logoSize:56, layout: DEF_LV(16,16,16,12,8) },
}

export const BANNER_SIZES = [
  { key: 'billboard',        label: 'Billboard',          w: 970,  h: 250,  layout: 'horizontal' },
  { key: 'leaderboard',      label: 'Leaderboard',        w: 728,  h: 90,   layout: 'horizontal' },
  { key: 'superleaderboard', label: 'Super Leaderboard',  w: 970,  h: 90,   layout: 'horizontal' },
  { key: 'mediumrect',       label: 'Medium Rectangle',   w: 300,  h: 250,  layout: 'horizontal' },
  { key: 'smartphone',       label: 'Smartphone Banner',  w: 300,  h: 50,   layout: 'horizontal' },
  { key: 'skyscraper',       label: 'Skyscraper',         w: 160,  h: 600,  layout: 'vertical'   },
  { key: 'portrait',         label: 'Portrait',           w: 300,  h: 1050, layout: 'vertical'   },
] as const

export type BannerKey = typeof BANNER_SIZES[number]['key']

// Image zone as % of banner dimension (horiz = % of width, vert = % of height)
export const IMG_H_PCT: Record<string, string> = { none: '0%', small: '22%', medium: '30%', large: '42%', full: '100%' }
export const IMG_V_PCT: Record<string, string> = { none: '0%', small: '25%', medium: '38%', large: '50%' }

export function injectGoogleFonts() {
  if (typeof document === 'undefined') return
  if (document.querySelector('link[data-gf="banner"]')) return
  const families = ['Inter','Roboto','Open+Sans','Lato','Poppins','Montserrat','Nunito','DM+Sans','Raleway','Oswald','Playfair+Display','Merriweather']
    .map(f => `${f}:wght@400;500;600;700`).join('&family=')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`
  link.setAttribute('data-gf', 'banner')
  document.head.appendChild(link)
}

export function injectCustomFont(name: string, url: string) {
  if (typeof document === 'undefined') return
  const id = `cf-${name.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `@font-face { font-family: '${name}'; src: url('${url}'); font-display: swap; }`
  document.head.appendChild(style)
}

// Upgrades old DB templates (with positions/verticalAlign) to the new flow schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateTemplate(tmpl: any): BannerSizeTemplate {
  const lyt = tmpl.layout ?? {}
  if (lyt.gap !== undefined && lyt.justify !== undefined) return tmpl as BannerSizeTemplate
  // Old schema detected — map verticalAlign → justify, add gap + paddingBottom
  const oldAlign: string = lyt.verticalAlign ?? 'center'
  const justify = oldAlign === 'flex-end' ? 'end' : oldAlign === 'flex-start' ? 'start' : 'center'
  const migrated: BannerSizeTemplate = {
    ...tmpl,
    layout: {
      paddingLeft:  lyt.paddingLeft  ?? 16,
      paddingRight: lyt.paddingRight ?? 12,
      paddingTop:   lyt.paddingTop   ?? 0,
      paddingBottom: 8,
      gap: 6,
      justify,
    },
  }
  if (migrated.image?.size === 'none' && tmpl._sizeKey === 'smartphone') {
    migrated.image = { size: 'full' }
  }
  return migrated
}

// Computes where each element lands in the flow layout (used by buildSVG to match the HTML render).
export type FlowElement = {
  type: 'logo' | 'heading' | 'subheading' | 'cta'
  x: number; y: number; w: number; h: number
  el?: ElementConfig & { textTransform?: string; paddingH?: number; paddingV?: number; borderRadius?: number; borderWidth?: number; borderColor?: string }
  text?: string
}

export function computeFlowLayout(
  size: typeof BANNER_SIZES[number],
  copy: BannerCopy,
  assets: BannerAssets,
  template: BannerSizeTemplate,
): { imgDim: number; items: FlowElement[] } {
  const t = migrateTemplate(template)
  const { w, h } = size
  const isVert = size.layout === 'vertical'
  const isFull = t.image.size === 'full'
  const lyt = t.layout
  const pl = lyt.paddingLeft ?? 16
  const pr = lyt.paddingRight ?? 12
  const pt = lyt.paddingTop ?? 0
  const pb = lyt.paddingBottom ?? 0
  const gap = lyt.gap ?? 6
  const justify = lyt.justify ?? 'center'
  const logoS = t.logoSize ?? 52

  const imgSizePct = isFull ? 0 : isVert
    ? parseFloat(IMG_V_PCT[t.image.size] ?? '0')
    : parseFloat(IMG_H_PCT[t.image.size] ?? '0')
  const imgDim = Math.round((isVert ? h : w) * imgSizePct / 100)

  function estimateLines(text: string, fontSize: number, maxW: number): number {
    if (!text || maxW <= 0) return 1
    const cpp = Math.max(1, Math.floor(maxW / (fontSize * 0.52)))
    const words = text.split(' ')
    let lines = 1, len = 0
    for (const word of words) {
      if (len === 0) { len = word.length; continue }
      if (len + 1 + word.length > cpp) { lines++; len = word.length }
      else len += 1 + word.length
    }
    return lines
  }

  const rawItems: Array<{ type: FlowElement['type']; h: number; mt: number; el?: FlowElement['el']; text?: string }> = []

  if (isVert) {
    const zoneW = w - pl - pr
    const zoneH = h - pt - pb - (isFull ? 0 : imgDim)

    if (assets.logoUrl) rawItems.push({ type: 'logo', h: logoS, mt: 0 })

    const pushText = (type: FlowElement['type'], el: ElementConfig, text: string) => {
      if (!el.visible || !text) return
      rawItems.push({ type, h: estimateLines(text, el.fontSize, zoneW) * el.fontSize * 1.2, mt: el.marginTop || 0, el, text })
    }
    pushText('heading', t.heading, copy.heading)
    pushText('subheading', t.subheading, copy.subheading)
    if (t.cta.visible && copy.cta) rawItems.push({ type: 'cta', h: t.cta.fontSize + (t.cta.paddingV ?? 8) * 2, mt: t.cta.marginTop || 0, el: t.cta, text: copy.cta })

    const totalH = rawItems.reduce((s, item, i) => s + item.h + (i > 0 ? gap + item.mt : 0), 0)
    let curY = pt
    if (justify === 'center') curY = pt + Math.max(0, Math.round((zoneH - totalH) / 2))
    else if (justify === 'end') curY = pt + Math.max(0, zoneH - totalH)

    const items: FlowElement[] = rawItems.map((item, i) => {
      if (i > 0) curY += gap + item.mt
      const out: FlowElement = { type: item.type, x: pl, y: curY, w: zoneW, h: item.h, el: item.el, text: item.text }
      curY += item.h
      return out
    })
    return { imgDim, items }

  } else {
    const logoColW = assets.logoUrl ? logoS + gap : 0
    const textX = pl + logoColW
    const textW = w - pl - (isFull ? pr : gap) - (isFull ? 0 : imgDim) - logoColW
    const textH = h - pt - pb

    const pushText = (type: FlowElement['type'], el: ElementConfig, text: string) => {
      if (!el.visible || !text) return
      rawItems.push({ type, h: estimateLines(text, el.fontSize, textW) * el.fontSize * 1.2, mt: el.marginTop || 0, el, text })
    }
    pushText('heading', t.heading, copy.heading)
    pushText('subheading', t.subheading, copy.subheading)
    if (t.cta.visible && copy.cta) rawItems.push({ type: 'cta', h: t.cta.fontSize + (t.cta.paddingV ?? 8) * 2, mt: t.cta.marginTop || 0, el: t.cta, text: copy.cta })

    const totalH = rawItems.reduce((s, item, i) => s + item.h + (i > 0 ? gap + item.mt : 0), 0)
    let curY = pt
    if (justify === 'center') curY = pt + Math.max(0, Math.round((textH - totalH) / 2))
    else if (justify === 'end') curY = pt + Math.max(0, textH - totalH)

    const items: FlowElement[] = []
    if (assets.logoUrl) {
      items.push({ type: 'logo', x: pl, y: Math.round((h - logoS) / 2), w: logoS, h: logoS })
    }
    rawItems.forEach((item, i) => {
      if (i > 0) curY += gap + item.mt
      items.push({ type: item.type, x: textX, y: curY, w: textW, h: item.h, el: item.el, text: item.text })
      curY += item.h
    })
    return { imgDim, items }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BannerPreview({ size, copy, assets, template, onElementMove }: {
  size: typeof BANNER_SIZES[number]
  copy: BannerCopy
  assets: BannerAssets
  template: BannerSizeTemplate
  onElementMove?: (type: DragType, xPct: number, yPct: number) => void
}) {
  const t = migrateTemplate(template)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    type: DragType; startClientX: number; startClientY: number
    startXPct: number; startYPct: number; el: HTMLElement
  } | null>(null)

  useEffect(() => {
    injectGoogleFonts()
    ;(t.customFonts ?? []).forEach(f => injectCustomFont(f.name, f.url))
  }, [t.customFonts])

  // Window-level drag handlers — direct DOM updates during move for smoothness
  useEffect(() => {
    if (!onElementMove) return
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const scaleX = rect.width / size.w
      const scaleY = rect.height / size.h
      const dx = (e.clientX - d.startClientX) / scaleX
      const dy = (e.clientY - d.startClientY) / scaleY
      const newXPct = Math.max(-15, Math.min(100, d.startXPct + (dx / size.w) * 100))
      const newYPct = Math.max(-15, Math.min(100, d.startYPct + (dy / size.h) * 100))
      d.el.style.left = `${newXPct.toFixed(2)}%`
      d.el.style.top = `${newYPct.toFixed(2)}%`
      d.el.dataset.cx = String(newXPct)
      d.el.dataset.cy = String(newYPct)
    }
    const onUp = () => {
      const d = dragRef.current
      if (!d) return
      const xPct = parseFloat(d.el.dataset.cx ?? String(d.startXPct))
      const yPct = parseFloat(d.el.dataset.cy ?? String(d.startYPct))
      onElementMove(d.type, xPct, yPct)
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onElementMove, size.w, size.h])

  const { w, h } = size
  const isVert = size.layout === 'vertical'
  const isFull = t.image.size === 'full'
  const c = assets.colors
  const bg = c.backgroundColor || '#ffffff'
  const primary = c.primaryColor || '#000000'
  const textColor = c.textColor || '#1f2937'
  const secColor = c.secondaryColor || textColor
  const imgUrl = assets.bgImageUrl
  const lyt = t.layout
  const pl = lyt.paddingLeft ?? 16
  const pr = lyt.paddingRight ?? 12
  const pt = lyt.paddingTop ?? 0
  const pb = lyt.paddingBottom ?? 0
  const gap = lyt.gap ?? 6
  const justify = lyt.justify ?? 'center'
  const logoS = t.logoSize ?? 52

  const imgSizePct = isFull ? 0 : isVert
    ? parseFloat(IMG_V_PCT[t.image.size] ?? '0')
    : parseFloat(IMG_H_PCT[t.image.size] ?? '0')
  const imgDim = Math.round((isVert ? h : w) * imgSizePct / 100)

  const jMap = { start: 'flex-start', center: 'center', end: 'flex-end' } as const
  const selfAlign = (align: string): React.CSSProperties['alignSelf'] =>
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
  const ff = (el: ElementConfig): React.CSSProperties =>
    el.fontFamily ? { fontFamily: `'${el.fontFamily}', sans-serif` } : {}

  const els = t.elements ?? []
  const bgEls = els.filter(e => e.layer === 'background')
  const fgEls = els.filter(e => e.layer === 'foreground')
  const renderEls = (subset: TemplateElement[], z: number) =>
    subset.map(el => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={el.id} src={el.url} alt="" loading="lazy"
        style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.scale ?? 20}%`, height: 'auto', objectFit: 'contain', zIndex: z, pointerEvents: 'none' }} />
    ))

  const ctaLabel = t.cta.textTransform === 'uppercase' ? (copy.cta || '').toUpperCase()
    : t.cta.textTransform === 'capitalize' ? (copy.cta || '').charAt(0).toUpperCase() + (copy.cta || '').slice(1)
    : (copy.cta || '')
  const ctaBorder: React.CSSProperties = t.cta.borderWidth > 0 ? { border: `${t.cta.borderWidth}px solid ${t.cta.borderColor}` } : {}

  // ─── Drag / pinned mode ───────────────────────────────────────────────────

  const isDragMode = !!onElementMove || Object.keys(t.pinned ?? {}).length > 0

  if (isDragMode) {
    const { items } = computeFlowLayout(size, copy, assets, t)
    const pinned = t.pinned ?? {}

    const getPos = (type: DragType): { xPct: number; yPct: number } => {
      if (pinned[type]) return pinned[type]!
      const item = items.find(i => i.type === type)
      if (item) return { xPct: (item.x / w) * 100, yPct: (item.y / h) * 100 }
      return { xPct: 5, yPct: 5 }
    }

    const startDrag = (e: React.MouseEvent, type: DragType, xPct: number, yPct: number) => {
      if (!onElementMove) return
      dragRef.current = {
        type, startClientX: e.clientX, startClientY: e.clientY,
        startXPct: xPct, startYPct: yPct,
        el: e.currentTarget as HTMLElement,
      }
      e.preventDefault()
    }

    const dragEl = (_type: DragType, pos: { xPct: number; yPct: number }, extra: React.CSSProperties = {}): React.CSSProperties => ({
      position: 'absolute',
      left: `${pos.xPct.toFixed(2)}%`,
      top: `${pos.yPct.toFixed(2)}%`,
      cursor: onElementMove ? 'grab' : 'default',
      outline: onElementMove ? '1px dashed rgba(128,128,128,0.6)' : 'none',
      userSelect: 'none',
      zIndex: 5,
      ...extra,
    })

    const textW = (type: DragType) => {
      const item = items.find(i => i.type === type)
      return item?.w ?? Math.round(w * 0.55)
    }

    return (
      <div ref={containerRef} style={{ position: 'relative', width: w, height: h, backgroundColor: bg, overflow: 'hidden' }}>
        {renderEls(bgEls, 0)}

        {/* Full-bleed background image */}
        {isFull && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: isVert
              ? `linear-gradient(to bottom, ${bg}ee 0%, ${bg}99 55%, transparent 100%)`
              : `linear-gradient(to right, ${bg}dd 0%, ${bg}88 55%, transparent 100%)` }} />
          </div>
        )}

        {/* Image zone — horizontal */}
        {!isFull && !isVert && t.image.size !== 'none' && (
          <div style={{ position: 'absolute', right: 0, top: 0, width: imgDim, height: h, overflow: 'hidden', zIndex: 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, ${bg} 0%, transparent 45%)` }} />
          </div>
        )}

        {/* Image zone — vertical */}
        {!isFull && isVert && t.image.size !== 'none' && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: w, height: imgDim, overflow: 'hidden', zIndex: 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${bg} 0%, transparent 40%)` }} />
          </div>
        )}

        {/* Logo */}
        {assets.logoUrl && (() => {
          const pos = getPos('logo')
          return (
            <div
              data-cx={pos.xPct} data-cy={pos.yPct}
              style={dragEl('logo', pos, { display: 'inline-block', lineHeight: 0 })}
              onMouseDown={e => startDrag(e, 'logo', pos.xPct, pos.yPct)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assets.logoUrl!} alt="" loading="lazy" style={{ display: 'block', width: logoS, height: logoS, objectFit: 'contain', pointerEvents: 'none' }} />
            </div>
          )
        })()}

        {/* Heading */}
        {t.heading.visible && copy.heading && (() => {
          const pos = getPos('heading')
          return (
            <div
              data-cx={pos.xPct} data-cy={pos.yPct}
              style={dragEl('heading', pos, { maxWidth: textW('heading'), fontSize: t.heading.fontSize, fontWeight: t.heading.fontWeight, color: textColor, lineHeight: 1.2, textAlign: t.heading.textAlign, wordBreak: 'break-word', ...ff(t.heading) })}
              onMouseDown={e => startDrag(e, 'heading', pos.xPct, pos.yPct)}
            >
              {copy.heading}
            </div>
          )
        })()}

        {/* Subheading */}
        {t.subheading.visible && copy.subheading && (() => {
          const pos = getPos('subheading')
          return (
            <div
              data-cx={pos.xPct} data-cy={pos.yPct}
              style={dragEl('subheading', pos, { maxWidth: textW('subheading'), fontSize: t.subheading.fontSize, fontWeight: t.subheading.fontWeight, color: secColor, lineHeight: 1.3, textAlign: t.subheading.textAlign, wordBreak: 'break-word', ...ff(t.subheading) })}
              onMouseDown={e => startDrag(e, 'subheading', pos.xPct, pos.yPct)}
            >
              {copy.subheading}
            </div>
          )
        })()}

        {/* CTA */}
        {t.cta.visible && copy.cta && (() => {
          const pos = getPos('cta')
          return (
            <div
              data-cx={pos.xPct} data-cy={pos.yPct}
              style={dragEl('cta', pos, { display: 'inline-block', backgroundColor: primary, color: '#ffffff', fontSize: t.cta.fontSize, fontWeight: t.cta.fontWeight, padding: `${t.cta.paddingV ?? 8}px ${t.cta.paddingH ?? 12}px`, borderRadius: t.cta.borderRadius ?? 4, letterSpacing: 0.3, lineHeight: 1, flexShrink: 0, ...ctaBorder, ...ff(t.cta) })}
              onMouseDown={e => startDrag(e, 'cta', pos.xPct, pos.yPct)}
            >
              {ctaLabel}
            </div>
          )
        })()}

        {renderEls(fgEls, 10)}
      </div>
    )
  }

  // ─── Flow mode (default) ──────────────────────────────────────────────────

  const textItems = (
    <>
      {t.heading.visible && copy.heading && (
        <div style={{ fontSize: t.heading.fontSize, fontWeight: t.heading.fontWeight, color: textColor, lineHeight: 1.2, textAlign: t.heading.textAlign, wordBreak: 'break-word', marginTop: t.heading.marginTop || 0, ...ff(t.heading) }}>
          {copy.heading}
        </div>
      )}
      {t.subheading.visible && copy.subheading && (
        <div style={{ fontSize: t.subheading.fontSize, fontWeight: t.subheading.fontWeight, color: secColor, lineHeight: 1.3, textAlign: t.subheading.textAlign, wordBreak: 'break-word', marginTop: t.subheading.marginTop || 0, ...ff(t.subheading) }}>
          {copy.subheading}
        </div>
      )}
      {t.cta.visible && copy.cta && (
        <div style={{ alignSelf: selfAlign(t.cta.textAlign), display: 'inline-block', backgroundColor: primary, color: '#ffffff', fontSize: t.cta.fontSize, fontWeight: t.cta.fontWeight, padding: `${t.cta.paddingV ?? 8}px ${t.cta.paddingH ?? 12}px`, borderRadius: t.cta.borderRadius ?? 4, letterSpacing: 0.3, lineHeight: 1, marginTop: t.cta.marginTop || 0, flexShrink: 0, ...ctaBorder, ...ff(t.cta) }}>
          {ctaLabel}
        </div>
      )}
    </>
  )

  if (isVert) {
    const zoneH = h - pt - pb - (isFull ? 0 : imgDim)
    return (
      <div style={{ position: 'relative', width: w, height: h, backgroundColor: bg, overflow: 'hidden' }}>
        {renderEls(bgEls, 0)}
        {isFull && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${bg}ee 0%, ${bg}99 55%, transparent 100%)` }} />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: jMap[justify], gap, padding: `${pt}px ${pr}px ${pb}px ${pl}px`, height: zoneH, flexShrink: 0, minWidth: 0, overflow: 'hidden' }}>
            {assets.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assets.logoUrl} alt="" loading="lazy"
                style={{ width: logoS, height: logoS, objectFit: 'contain', alignSelf: t.heading.textAlign === 'center' ? 'center' : 'flex-start', flexShrink: 0 }} />
            )}
            {textItems}
          </div>
          {!isFull && t.image.size !== 'none' && (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${bg} 0%, transparent 40%)` }} />
            </div>
          )}
        </div>
        {renderEls(fgEls, 3)}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: w, height: h, backgroundColor: bg, overflow: 'hidden' }}>
      {renderEls(bgEls, 0)}
      {isFull && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, ${bg}dd 0%, ${bg}88 55%, transparent 100%)` }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', zIndex: 2 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', padding: `${pt}px ${isFull ? pr : 0}px ${pb}px ${pl}px`, gap, minWidth: 0, overflow: 'hidden' }}>
          {assets.logoUrl && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assets.logoUrl} alt="" loading="lazy" style={{ width: logoS, height: logoS, objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: jMap[justify], gap, minWidth: 0, alignSelf: 'stretch' }}>
            {textItems}
          </div>
        </div>
        {!isFull && t.image.size !== 'none' && (
          <div style={{ width: imgDim, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, ${bg} 0%, transparent 45%)` }} />
          </div>
        )}
      </div>
      {renderEls(fgEls, 3)}
    </div>
  )
}
