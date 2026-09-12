'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'
import BannerPreview, {
  BANNER_SIZES, DEFAULT_BANNER_TEMPLATES,
  injectGoogleFonts, injectCustomFont, computeFlowLayout,
  type BannerKey, type BannerAssets, type BannerCopy, type BannerColors,
  type BannerSizeTemplate, type ElementConfig, type TemplateElement,
} from '@/components/BannerPreview'

interface Brand { id: string; name: string }


const GEN_MESSAGES = [
  'Analyzing brand guidelines…',
  'Extracting color palette…',
  'Generating background visual…',
  'Uploading assets…',
  'Almost there…',
]

// ─── SVG for Download / Copy ─────────────────────────────────────────────────

function buildSVG(size: typeof BANNER_SIZES[number], copy: BannerCopy, assets: BannerAssets, template: BannerSizeTemplate): string {
  const t = template
  const { w, h } = size
  const isVert = size.layout === 'vertical'
  const isFull = t.image.size === 'full'
  const c = assets.colors
  const bg = c.backgroundColor || '#ffffff'
  const primary = c.primaryColor || '#000000'
  const textColor = c.textColor || '#1f2937'
  const secColor = c.secondaryColor || textColor
  const imgUrl = assets.bgImageUrl

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const fontAttr = (el: ElementConfig) => el.fontFamily
    ? `font-family="${esc(el.fontFamily)}, Inter, Arial, sans-serif"`
    : 'font-family="Inter, Arial, sans-serif"'

  const { imgDim, items } = computeFlowLayout(size, copy, assets, t)
  const pinned = t.pinned ?? {}

  // Apply pinned x/y overrides (from drag-to-position) while keeping flow width for text wrapping
  const applyPin = (type: string, item: typeof items[number]) => {
    const p = pinned[type as keyof typeof pinned]
    if (!p) return item
    return { ...item, x: Math.round(p.xPct / 100 * w), y: Math.round(p.yPct / 100 * h) }
  }

  let defs = ''
  let body = ''

  body += `  <rect id="Background" width="${w}" height="${h}" fill="${bg}"/>\n`

  // Image zone
  if (t.image.size !== 'none') {
    if (isFull) {
      defs += `<linearGradient id="fadeH" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0"><stop offset="0%" stop-color="${bg}" stop-opacity="0.87"/><stop offset="55%" stop-color="${bg}" stop-opacity="0.53"/><stop offset="100%" stop-color="${bg}" stop-opacity="0"/></linearGradient>`
      body += `  <g id="AI_Visual_Group">\n`
      body += `    <image id="AI_Generated_Image" x="0" y="0" width="${w}" height="${h}" href="${imgUrl}" preserveAspectRatio="xMidYMid slice"/>\n`
      body += `    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#fadeH)"/>\n`
      body += `  </g>\n`
    } else if (isVert) {
      const imgY = h - imgDim
      defs += `<linearGradient id="fadeB" gradientUnits="userSpaceOnUse" x1="0" y1="${imgY}" x2="0" y2="${imgY + imgDim}"><stop offset="0%" stop-color="${bg}" stop-opacity="1"/><stop offset="40%" stop-color="${bg}" stop-opacity="0"/></linearGradient>`
      body += `  <g id="AI_Visual_Group">\n`
      body += `    <image id="AI_Generated_Image" x="0" y="${imgY}" width="${w}" height="${imgDim}" href="${imgUrl}" preserveAspectRatio="xMidYMid slice"/>\n`
      body += `    <rect x="0" y="${imgY}" width="${w}" height="${imgDim}" fill="url(#fadeB)"/>\n`
      body += `  </g>\n`
    } else {
      const imgX = w - imgDim
      defs += `<linearGradient id="fadeR" gradientUnits="userSpaceOnUse" x1="${imgX}" y1="0" x2="${imgX + imgDim}" y2="0"><stop offset="0%" stop-color="${bg}" stop-opacity="1"/><stop offset="45%" stop-color="${bg}" stop-opacity="0"/></linearGradient>`
      body += `  <g id="AI_Visual_Group">\n`
      body += `    <image id="AI_Generated_Image" x="${imgX}" y="0" width="${imgDim}" height="${h}" href="${imgUrl}" preserveAspectRatio="xMidYMid slice"/>\n`
      body += `    <rect x="${imgX}" y="0" width="${imgDim}" height="${h}" fill="url(#fadeR)"/>\n`
      body += `  </g>\n`
    }
  }

  const els = t.elements ?? []
  els.filter(e => e.layer === 'background').forEach(el => {
    body += `  <image x="${Math.round((el.x/100)*w)}" y="${Math.round((el.y/100)*h)}" width="${Math.round((el.scale??20)/100*w)}" href="${el.url}" preserveAspectRatio="xMidYMid meet"/>\n`
  })

  // SVG text with line wrapping (SVG doesn't auto-wrap)
  const svgLines = (text: string, fontSize: number, maxW: number): string[] => {
    const cpp = Math.max(1, Math.floor(maxW / (fontSize * 0.52)))
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const word of words) {
      if (!cur) { cur = word; continue }
      if ((cur + ' ' + word).length <= cpp) cur += ' ' + word
      else { lines.push(cur); cur = word }
    }
    if (cur) lines.push(cur)
    return lines
  }

  const svgText = (id: string, item: typeof items[number], color: string): string => {
    const { x, y, w: tw, el, text } = item
    if (!el || !text) return ''
    const lines = svgLines(text, el.fontSize, tw)
    const lh = el.fontSize * 1.2
    const tx = el.textAlign === 'center' ? x + tw / 2 : el.textAlign === 'right' ? x + tw : x
    const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start'
    const firstY = y + el.fontSize * 0.8
    if (lines.length <= 1) {
      return `  <text id="${id}" x="${Math.round(tx)}" y="${Math.round(firstY)}" ${fontAttr(el)} font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>\n`
    }
    const tspans = lines.map((line, i) => `<tspan x="${Math.round(tx)}" dy="${i === 0 ? 0 : Math.round(lh)}">${esc(line)}</tspan>`).join('')
    return `  <text id="${id}" x="${Math.round(tx)}" y="${Math.round(firstY)}" ${fontAttr(el)} font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${color}" text-anchor="${anchor}">${tspans}</text>\n`
  }

  body += `  <g id="Logo_Group">\n`
  const logoItemRaw = items.find(i => i.type === 'logo')
  const logoItem = logoItemRaw ? applyPin('logo', logoItemRaw) : undefined
  if (logoItem && assets.logoUrl)
    body += `    <image id="Brand_Logo" x="${logoItem.x}" y="${logoItem.y}" width="${logoItem.w}" height="${logoItem.h}" href="${assets.logoUrl}" preserveAspectRatio="xMinYMin meet"/>\n`
  body += `  </g>\n`

  body += `  <g id="Copy_Group">\n`
  const headingItemRaw = items.find(i => i.type === 'heading')
  if (headingItemRaw) body += svgText('Heading_Layer', applyPin('heading', headingItemRaw), textColor)
  const subItemRaw = items.find(i => i.type === 'subheading')
  if (subItemRaw) body += svgText('Subhead_Layer', applyPin('subheading', subItemRaw), secColor)
  body += `  </g>\n`

  const ctaItemRaw = items.find(i => i.type === 'cta')
  const ctaItem = ctaItemRaw ? applyPin('cta', ctaItemRaw) : undefined
  if (ctaItem && t.cta.visible && copy.cta) {
    const ctaLabel = t.cta.textTransform === 'uppercase' ? copy.cta.toUpperCase()
      : t.cta.textTransform === 'capitalize' ? copy.cta.charAt(0).toUpperCase() + copy.cta.slice(1)
      : copy.cta
    const padH = t.cta.paddingH ?? 12
    const ctaW = Math.round(ctaLabel.length * t.cta.fontSize * 0.55) + padH * 2
    const ctaH = ctaItem.h
    // In pinned mode, x is the top-left of the button directly; in flow mode align via textAlign
    const ctaX = pinned.cta ? ctaItem.x
               : t.cta.textAlign === 'center' ? ctaItem.x + Math.round((ctaItem.w - ctaW) / 2)
               : t.cta.textAlign === 'right' ? ctaItem.x + ctaItem.w - ctaW
               : ctaItem.x
    const borderAttr = t.cta.borderWidth > 0 ? ` stroke="${t.cta.borderColor}" stroke-width="${t.cta.borderWidth}"` : ''
    body += `  <g id="CTA_Group">\n`
    body += `    <rect id="CTA_Container" x="${ctaX}" y="${Math.round(ctaItem.y)}" width="${ctaW}" height="${ctaH}" rx="${t.cta.borderRadius ?? 4}" fill="${primary}"${borderAttr}/>\n`
    body += `    <text id="CTA_Text_Layer" x="${ctaX + padH}" y="${Math.round(ctaItem.y + ctaH / 2 + t.cta.fontSize * 0.35)}" ${fontAttr(t.cta)} font-size="${t.cta.fontSize}" font-weight="${t.cta.fontWeight}" fill="#ffffff" text-anchor="start">${esc(ctaLabel)}</text>\n`
    body += `  </g>\n`
  }

  els.filter(e => e.layer === 'foreground').forEach(el => {
    body += `  <image x="${Math.round((el.x/100)*w)}" y="${Math.round((el.y/100)*h)}" width="${Math.round((el.scale??20)/100*w)}" href="${el.url}" preserveAspectRatio="xMidYMid meet"/>\n`
  })

  const defsBlock = defs ? `  <defs>\n    ${defs}\n  </defs>\n` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
${defsBlock}${body}</svg>`
}


async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function getImageNaturalSize(dataUri: string): Promise<{ nw: number; nh: number }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ nw: img.naturalWidth, nh: img.naturalHeight })
    img.onerror = () => resolve({ nw: 0, nh: 0 })
    img.src = dataUri
  })
}

// ─── Figma SVG (built from scratch, editable text, correct positions) ────────

const GFONTS_BANNER = ['Inter','Roboto','Open Sans','Lato','Poppins','Montserrat','Nunito','DM Sans','Raleway','Oswald','Playfair Display','Merriweather']

function bannerFigmaFontStack(el: ElementConfig): string {
  const name = el.fontFamily || 'Inter'
  const w = parseInt(el.fontWeight) || 400
  const variant = w >= 700 ? 'Bold' : w >= 600 ? 'SemiBold' : w >= 500 ? 'Medium' : 'Regular'
  return `'${name}-${variant}', '${name}', Inter, sans-serif`
}

async function buildBannerFigmaSVG(
  size: typeof BANNER_SIZES[number],
  copy: BannerCopy,
  assets: BannerAssets,
  template: BannerSizeTemplate
): Promise<string> {
  const t = template
  const { w, h } = size
  const isVert = size.layout === 'vertical'
  const isFull = t.image.size === 'full'
  const c = assets.colors
  const bgColor = c.backgroundColor || '#ffffff'
  const primaryColor = c.primaryColor || '#000000'
  const textCol = c.textColor || '#1f2937'
  const secCol = c.secondaryColor || textCol
  const els = t.elements ?? []
  const bgEls = els.filter(e => e.layer === 'background')
  const fgEls = els.filter(e => e.layer === 'foreground')

  const xmlEsc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const toB64 = (url: string) => urlToBase64(url).catch(() => '')

  const { imgDim, items } = computeFlowLayout(size, copy, assets, t)
  const pinnedF = t.pinned ?? {}
  const applyPinF = (type: string, item: typeof items[number]) => {
    const p = pinnedF[type as keyof typeof pinnedF]
    if (!p) return item
    return { ...item, x: Math.round(p.xPct / 100 * w), y: Math.round(p.yPct / 100 * h) }
  }

  // Convert all images to base64
  const [bgImgB64, logoB64] = await Promise.all([
    assets.bgImageUrl && t.image.size !== 'none' ? toB64(assets.bgImageUrl) : Promise.resolve(''),
    assets.logoUrl ? toB64(assets.logoUrl) : Promise.resolve(''),
  ])
  const processEl = async (el: TemplateElement) => {
    const dataUrl = await toB64(el.url)
    const { nw, nh } = dataUrl ? await getImageNaturalSize(dataUrl) : { nw: 0, nh: 0 }
    const elW = Math.round((el.scale ?? 20) / 100 * w)
    const elH = nw > 0 ? Math.round((elW / nw) * nh) : elW
    return { ...el, dataUrl, elW, elH }
  }
  const [procBgEls, procFgEls] = await Promise.all([
    Promise.all(bgEls.map(processEl)),
    Promise.all(fgEls.map(processEl)),
  ])

  // Logo natural size → meet scaling
  const logoS = t.logoSize ?? 52
  const { nw: lNW, nh: lNH } = logoB64 ? await getImageNaturalSize(logoB64) : { nw: 0, nh: 0 }
  const lScale = lNH > 0 ? Math.min(logoS / lNW, logoS / lNH) : 1
  const logoW = lNH > 0 ? Math.round(lNW * lScale) : logoS
  const logoH = lNH > 0 ? Math.round(lNH * lScale) : logoS

  // Font declarations
  const googleImports: string[] = []
  const seenGF = new Set<string>()
  const addGF = (name: string) => {
    const match = GFONTS_BANNER.find(f => name.trim().toLowerCase().startsWith(f.toLowerCase()))
    if (match && !seenGF.has(match)) {
      seenGF.add(match)
      googleImports.push(`@import url('https://fonts.googleapis.com/css2?family=${match.replace(/\s+/g,'+')}:wght@400;500;600;700&display=swap');`)
    }
  }
  ;[t.heading, t.subheading, t.cta].forEach(el => el.fontFamily && addGF(el.fontFamily))
  if (!seenGF.has('Inter')) googleImports.push(`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`)

  const customFontB64Map: Record<string, string> = {}
  await Promise.all((t.customFonts ?? []).map(async (cf) => {
    if (cf.name && cf.url) customFontB64Map[cf.name] = await toB64(cf.url).catch(() => '')
  }))
  const fontFaces: string[] = []
  for (const cf of (t.customFonts ?? [])) {
    if (!cf.name || !cf.url) continue
    const b64 = customFontB64Map[cf.name]
    const src = b64 ? `url('${cf.url}'),url('${b64}')` : `url('${cf.url}')`
    fontFaces.push(`@font-face{font-family:'${cf.name}';src:${src};font-weight:100 900;}`)
    for (const variant of ['Bold', 'SemiBold', 'Medium', 'Regular']) {
      fontFaces.push(`@font-face{font-family:'${cf.name}-${variant}';src:${src};font-weight:100 900;}`)
    }
  }

  const defs: string[] = []
  const body: string[] = []

  const styleContent = [...googleImports, ...fontFaces].join('\n    ')
  if (styleContent) defs.push(`  <style>\n    ${styleContent}\n  </style>`)

  body.push(`  <rect id="Background" width="${w}" height="${h}" fill="${bgColor}"/>`)

  // Background image — slice-fit into zone, clipped
  if (bgImgB64 && t.image.size !== 'none') {
    const { nw: iNW, nh: iNH } = await getImageNaturalSize(bgImgB64)
    const clipId = `clip_bg_${size.key}`
    const fadeId = `fade_${size.key}`
    if (isFull) {
      const sc = iNW > 0 ? Math.max(w / iNW, h / iNH) : 1
      const sw = Math.round(iNW * sc), sh = Math.round(iNH * sc)
      const ix = Math.round((w - sw) / 2), iy = Math.round((h - sh) / 2)
      defs.push(`  <linearGradient id="${fadeId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0"><stop offset="0%" stop-color="${bgColor}" stop-opacity="0.87"/><stop offset="55%" stop-color="${bgColor}" stop-opacity="0.53"/><stop offset="100%" stop-color="${bgColor}" stop-opacity="0"/></linearGradient>`)
      defs.push(`  <clipPath id="${clipId}"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath>`)
      body.push(`  <g id="AI_Visual_Group">`)
      body.push(`    <image href="${bgImgB64}" x="${ix}" y="${iy}" width="${sw}" height="${sh}" clip-path="url(#${clipId})"/>`)
      body.push(`    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${fadeId})"/>`)
      body.push(`  </g>`)
    } else if (isVert) {
      const aH = imgDim, aY = h - aH
      const sc = iNW > 0 ? Math.max(w / iNW, aH / iNH) : 1
      const sw = Math.round(iNW * sc), sh = Math.round(iNH * sc)
      const ix = Math.round((w - sw) / 2), iy = Math.round(aY + (aH - sh) / 2)
      defs.push(`  <linearGradient id="${fadeId}" gradientUnits="userSpaceOnUse" x1="0" y1="${aY}" x2="0" y2="${aY + aH}"><stop offset="0%" stop-color="${bgColor}" stop-opacity="1"/><stop offset="40%" stop-color="${bgColor}" stop-opacity="0"/></linearGradient>`)
      defs.push(`  <clipPath id="${clipId}"><rect x="0" y="${aY}" width="${w}" height="${aH}"/></clipPath>`)
      body.push(`  <g id="AI_Visual_Group">`)
      body.push(`    <image href="${bgImgB64}" x="${ix}" y="${iy}" width="${sw}" height="${sh}" clip-path="url(#${clipId})"/>`)
      body.push(`    <rect x="0" y="${aY}" width="${w}" height="${aH}" fill="url(#${fadeId})"/>`)
      body.push(`  </g>`)
    } else {
      const aW = imgDim, aX = w - aW
      const sc = iNW > 0 ? Math.max(aW / iNW, h / iNH) : 1
      const sw = Math.round(iNW * sc), sh = Math.round(iNH * sc)
      const ix = Math.round(aX + (aW - sw) / 2), iy = Math.round((h - sh) / 2)
      defs.push(`  <linearGradient id="${fadeId}" gradientUnits="userSpaceOnUse" x1="${aX}" y1="0" x2="${aX + aW}" y2="0"><stop offset="0%" stop-color="${bgColor}" stop-opacity="1"/><stop offset="45%" stop-color="${bgColor}" stop-opacity="0"/></linearGradient>`)
      defs.push(`  <clipPath id="${clipId}"><rect x="${aX}" y="0" width="${aW}" height="${h}"/></clipPath>`)
      body.push(`  <g id="AI_Visual_Group">`)
      body.push(`    <image href="${bgImgB64}" x="${ix}" y="${iy}" width="${sw}" height="${sh}" clip-path="url(#${clipId})"/>`)
      body.push(`    <rect x="${aX}" y="0" width="${aW}" height="${h}" fill="url(#${fadeId})"/>`)
      body.push(`  </g>`)
    }
  }

  for (const el of procBgEls) {
    body.push(`  <image href="${el.dataUrl}" x="${Math.round((el.x/100)*w)}" y="${Math.round((el.y/100)*h)}" width="${el.elW}" height="${el.elH}"/>`)
  }

  // Logo
  const logoItemRawF = items.find(i => i.type === 'logo')
  const logoItemF = logoItemRawF ? applyPinF('logo', logoItemRawF) : undefined
  if (logoB64 && logoItemF) {
    body.push(`  <g id="Logo_Group">`)
    body.push(`    <image id="Brand_Logo" href="${logoB64}" x="${logoItemF.x}" y="${logoItemF.y}" width="${logoW}" height="${logoH}"/>`)
    body.push(`  </g>`)
  }

  // SVG text with line wrapping
  const svgLinesFigma = (text: string, fontSize: number, maxW: number): string[] => {
    const cpp = Math.max(1, Math.floor(maxW / (fontSize * 0.52)))
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const word of words) {
      if (!cur) { cur = word; continue }
      if ((cur + ' ' + word).length <= cpp) cur += ' ' + word
      else { lines.push(cur); cur = word }
    }
    if (cur) lines.push(cur)
    return lines
  }
  const svgTextFigma = (id: string, item: typeof items[number], color: string): string => {
    const { x, y, w: tw, el, text } = item
    if (!el || !text) return ''
    const ff = bannerFigmaFontStack(el)
    const lines = svgLinesFigma(text, el.fontSize, tw)
    const lh = el.fontSize * 1.2
    const tx = el.textAlign === 'center' ? x + tw / 2 : el.textAlign === 'right' ? x + tw : x
    const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start'
    const firstY = y + el.fontSize * 0.8
    const style = `font-family: ${ff}; font-size: ${el.fontSize}px; font-weight: ${el.fontWeight}; fill: ${color};`
    if (lines.length <= 1) {
      return `    <text id="${id}" x="${Math.round(tx)}" y="${Math.round(firstY)}" font-family="${ff}" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${color}" text-anchor="${anchor}" style="${style}">${xmlEsc(text)}</text>`
    }
    const tspans = lines.map((line, i) => `<tspan x="${Math.round(tx)}" dy="${i === 0 ? 0 : Math.round(lh)}">${xmlEsc(line)}</tspan>`).join('')
    return `    <text id="${id}" x="${Math.round(tx)}" y="${Math.round(firstY)}" font-family="${ff}" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${color}" text-anchor="${anchor}" style="${style}">${tspans}</text>`
  }

  body.push(`  <g id="Copy_Group">`)
  const headingItemRawF = items.find(i => i.type === 'heading')
  if (headingItemRawF) body.push(svgTextFigma('Heading_Layer', applyPinF('heading', headingItemRawF), primaryColor))
  const subItemRawF = items.find(i => i.type === 'subheading')
  if (subItemRawF) body.push(svgTextFigma('Subhead_Layer', applyPinF('subheading', subItemRawF), secCol))
  body.push(`  </g>`)

  // CTA
  const ctaItemRawF = items.find(i => i.type === 'cta')
  const ctaItemF = ctaItemRawF ? applyPinF('cta', ctaItemRawF) : undefined
  if (ctaItemF && t.cta.visible && copy.cta) {
    const ctaLabel = t.cta.textTransform === 'uppercase' ? copy.cta.toUpperCase()
      : t.cta.textTransform === 'capitalize' ? copy.cta.charAt(0).toUpperCase() + copy.cta.slice(1)
      : copy.cta
    const padH = t.cta.paddingH ?? 12
    const ctaW = Math.round(ctaLabel.length * t.cta.fontSize * 0.55) + padH * 2
    const ctaH = ctaItemF.h
    const ctaX = pinnedF.cta ? ctaItemF.x
               : t.cta.textAlign === 'center' ? ctaItemF.x + Math.round((ctaItemF.w - ctaW) / 2)
               : t.cta.textAlign === 'right' ? ctaItemF.x + ctaItemF.w - ctaW
               : ctaItemF.x
    const borderAttr = t.cta.borderWidth > 0 ? ` stroke="${t.cta.borderColor}" stroke-width="${t.cta.borderWidth}"` : ''
    const ff = bannerFigmaFontStack(t.cta)
    body.push(`  <g id="CTA_Group">`)
    body.push(`    <rect id="CTA_Container" x="${ctaX}" y="${Math.round(ctaItemF.y)}" width="${ctaW}" height="${ctaH}" rx="${t.cta.borderRadius ?? 4}" fill="${primaryColor}"${borderAttr}/>`)
    body.push(`    <text id="CTA_Text_Layer" x="${ctaX + padH}" y="${Math.round(ctaItemF.y + ctaH / 2 + t.cta.fontSize * 0.35)}" font-family="${ff}" font-size="${t.cta.fontSize}" font-weight="${t.cta.fontWeight}" fill="${bgColor}" text-anchor="start" style="font-family: ${ff}; font-size: ${t.cta.fontSize}px; fill: ${bgColor};">${xmlEsc(ctaLabel)}</text>`)
    body.push(`  </g>`)
  }

  for (const el of procFgEls) {
    body.push(`  <image href="${el.dataUrl}" x="${Math.round((el.x/100)*w)}" y="${Math.round((el.y/100)*h)}" width="${el.elW}" height="${el.elH}"/>`)
  }

  const defsBlock = defs.length > 0 ? `  <defs>\n${defs.map(d => '  ' + d).join('\n')}\n  </defs>\n` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defsBlock}${body.join('\n')}
</svg>`
}

function downloadSVG(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 200)
}

function previewScale(w: number, h: number): number {
  const maxW = 640
  const maxH = 500
  return Math.min(1, maxW / w, maxH / h)
}

// ─── Progress ─────────────────────────────────────────────────────────────────

// Curve points: [elapsed seconds, percentage] — tuned for ~90s generation
const BANNER_CURVE: [number, number][] = [[0,0],[8,28],[20,48],[40,65],[65,78],[90,88],[130,95]]

function interpolatePct(elapsed: number, curve: [number, number][]): number {
  for (let i = 1; i < curve.length; i++) {
    const [t0, p0] = curve[i - 1]
    const [t1, p1] = curve[i]
    if (elapsed <= t1) return p0 + (p1 - p0) * (elapsed - t0) / (t1 - t0)
  }
  return curve[curve.length - 1][1]
}

function GeneratingOverlay({ messages, startTime, curve }: { messages: string[]; startTime: number; curve: [number, number][] }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const msg = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 4000)
    const prog = setInterval(() => {
      setPct(Math.round(interpolatePct((Date.now() - startTime) / 1000, curve)))
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [messages, startTime, curve])
  return (
    <div style={{ padding: '14px 0 2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{messages[msgIdx]}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: 'var(--red)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// ─── Banner Preview Modal ─────────────────────────────────────────────────────

interface BannerModalProps {
  size: typeof BANNER_SIZES[number]
  copy: BannerCopy
  assets: BannerAssets
  template: BannerSizeTemplate
  onClose: () => void
}

function BannerModal({ size, copy, assets, template, onClose }: BannerModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const availW = typeof window !== 'undefined' ? window.innerWidth * 0.88 : 1200
  const availH = typeof window !== 'undefined' ? window.innerHeight * 0.84 : 900
  const scale = Math.min(1, availW / size.w, availH / size.h)
  const scaledW = Math.round(size.w * scale)
  const scaledH = Math.round(size.h * scale)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: Math.max(scaledW, 320), marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{size.label}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontFamily: 'monospace' }}>{size.w}×{size.h}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '26px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>&times;</button>
      </div>
      <div style={{ overflow: 'hidden', borderRadius: '4px', width: scaledW, height: scaledH, boxShadow: '0 4px 40px rgba(0,0,0,0.7)', flexShrink: 0 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: size.w, height: size.h }}>
          <BannerPreview size={size} copy={copy} assets={assets} template={template} />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GenerateBannerPage() {
  const { userRole, userBrandId, userBrandName, userEmail } = useAuth()
  const { showToast } = useToast()

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [copy, setCopy] = useState<BannerCopy>({ heading: '', subheading: '', cta: '' })
  const [bgPrompt, setBgPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const [assets, setAssets] = useState<BannerAssets | null>(null)
  const [selectedSizes, setSelectedSizes] = useState<Set<BannerKey>>(new Set(BANNER_SIZES.map(s => s.key)))
  const [dbTemplates, setDbTemplates] = useState<Record<string, BannerSizeTemplate>>({})
  const [defaultBgPrompt, setDefaultBgPrompt] = useState('')
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyingKey, setCopyingKey] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState<BannerKey | null>(null)

  const missingSizes = BANNER_SIZES.map(s => s.key).filter(k => !dbTemplates[k])

  useEffect(() => {
    if (userRole === null) return
    if (userRole !== 'admin' && userBrandId) setSelectedBrandId(userBrandId)
  }, [userRole, userBrandId])

  useEffect(() => {
    if (userRole !== 'admin') return
    sb.from('brands').select('id, name').order('name').then(({ data }) => {
      if (data) setBrands(data)
    })
  }, [userRole])

  useEffect(() => {
    if (!selectedBrandId) { setDbTemplates({}); setDefaultBgPrompt(''); return }
    setTemplatesLoading(true)
    Promise.all([
      sb.from('banner_templates').select('*').eq('brand_id', selectedBrandId),
      sb.from('brand_profiles').select('banner_bg_prompt').eq('brand_id', selectedBrandId).single(),
    ]).then(([{ data: tmplData }, { data: profileData }]) => {
      const map: Record<string, BannerSizeTemplate> = {}
      for (const row of (tmplData || [])) map[row.size_key] = row.config as BannerSizeTemplate
      setDbTemplates(map)
      setDefaultBgPrompt(profileData?.banner_bg_prompt || '')
      setTemplatesLoading(false)
    })
  }, [selectedBrandId])

  async function handleGenerate() {
    if (!selectedBrandId) { showToast('Please select a brand', true); return }
    if (!copy.heading.trim()) { showToast('Heading is required', true); return }
    if (!copy.cta.trim()) { showToast('CTA text is required', true); return }

    setGenerating(true)
    setGenerationStartTime(Date.now())
    setAssets(null)

    try {
      const res = await authedFetch('/api/generate-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: selectedBrandId, copy, bgPrompt: bgPrompt.trim() || defaultBgPrompt }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`Error ${res.status}: ${text}`)
      let data: BannerAssets
      try { data = JSON.parse(text) } catch { throw new Error('Invalid response: ' + text) }
      setAssets(data)
      // Save to history (non-blocking)
      sb.from('generated_posts').insert({
        brand_id: selectedBrandId,
        output_url: data.bgImageUrl,
        headline: copy.heading,
        is_banner: true,
        render_params: {
          type: 'banner',
          copy,
          colors: data.colors,
          logoUrl: data.logoUrl,
          bgImageUrl: data.bgImageUrl,
          templates: Object.fromEntries(
            BANNER_SIZES.filter(s => selectedSizes.has(s.key))
              .map(s => [s.key, dbTemplates[s.key] || DEFAULT_BANNER_TEMPLATES[s.key]])
          ),
        },
        ...(userEmail ? { created_by_email: userEmail } : {}),
      }).then(() => {}, () => {})
    } catch (err: unknown) {
      showToast((err as Error).message || 'Generation failed', true)
    } finally {
      setGenerating(false)
      setGenerationStartTime(null)
    }
  }

  function handleDownloadAll() {
    if (!assets) return
    BANNER_SIZES.filter(s => selectedSizes.has(s.key)).forEach(size => {
      const svg = buildSVG(size, copy, assets, dbTemplates[size.key] || DEFAULT_BANNER_TEMPLATES[size.key])
      downloadSVG(svg, `banner_${size.key}_${size.w}x${size.h}.svg`)
    })
  }

  function toggleSize(key: BannerKey) {
    setSelectedSizes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const templatesComplete = missingSizes.length === 0
  const isAdmin = userRole === 'admin'
  const canGenerate = selectedBrandId && copy.heading.trim() && copy.cta.trim() && !generating && !templatesLoading && (isAdmin ? templatesComplete : true)

  if (userRole !== null && !isAdmin && !userBrandId) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--muted)' }}>
        <p style={{ fontSize: '15px' }}>You don&apos;t have access to this page.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0 }}>Multi-size Ads</h1>
        <p className="subtitle" style={{ marginBottom: 0 }}>Create production-ready SVG banners in all standard ad sizes</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* ── Left panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {isAdmin ? (
            <div className="form-card" style={{ padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Brand</p>
              <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}>
                <option value="">Select a brand…</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {selectedBrandId && !templatesLoading && !templatesComplete && (
                <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', fontSize: '12px', color: '#f59e0b' }}>
                  <strong>Templates not configured.</strong> Missing: {missingSizes.join(', ')}
                </div>
              )}
              {selectedBrandId && !templatesLoading && templatesComplete && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#22c55e' }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  All banner templates configured
                </div>
              )}
              {templatesLoading && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>Loading templates…</div>
              )}
            </div>
          ) : userBrandName && (
            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Brand</p>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{userBrandName}</span>
            </div>
          )}

          <div className="form-card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px' }}>Ad Copy</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'heading',    label: 'Heading',    required: true,  ph: 'e.g. Grow faster with AI',           maxLen: 60 },
                { key: 'subheading', label: 'Subheading', required: false, ph: 'e.g. Automate your content workflow', maxLen: 60 },
                { key: 'cta',        label: 'CTA Text',   required: true,  ph: 'e.g. Get Started',                   maxLen: 15 },
              ].map(f => {
                const val = copy[f.key as keyof BannerCopy]
                return (
                  <div key={f.key}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {f.label}
                        {f.required && <span style={{ color: 'var(--red)', marginLeft: '3px' }}>*</span>}
                        {!f.required && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px', fontWeight: 400 }}>(optional)</span>}
                      </span>
                      <span style={{ fontSize: '11px', color: val.length > f.maxLen ? 'var(--red)' : 'var(--muted)', fontWeight: 400 }}>{val.length}/{f.maxLen}</span>
                    </label>
                    <input
                      type="text"
                      maxLength={f.maxLen}
                      value={val}
                      onChange={e => setCopy(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                    />
                    {val.length >= f.maxLen && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--red)' }}>Character limit reached</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="form-card" style={{ padding: '20px' }}>
            <label style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>
              Background Image Prompt
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={bgPrompt}
              onChange={e => setBgPrompt(e.target.value)}
              placeholder={defaultBgPrompt ? `Default: "${defaultBgPrompt}"` : "Describe the visual - e.g. 'modern office, blue tones'"}
              rows={3}
            />
          </div>

          <div className="form-card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>Banner Sizes</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {BANNER_SIZES.map(s => {
                const active = selectedSizes.has(s.key)
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSize(s.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', borderRadius: '8px', border: '1px solid',
                      borderColor: active ? 'var(--red)' : 'var(--border)',
                      background: active ? 'rgba(200,16,46,0.07)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                    }}>
                    <div style={{
                      width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0,
                      border: `2px solid ${active ? 'var(--red)' : '#555'}`,
                      background: active ? 'var(--red)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s',
                    }}>
                      {active && (
                        <svg width="9" height="9" fill="none" viewBox="0 0 12 12" stroke="#fff" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--text)' }}>{s.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace' }}>{s.w}×{s.h}</span>
                  </button>
                )
              })}
            </div>
          </div> 

          <button onClick={handleGenerate} disabled={!canGenerate} className="generate-btn">
            {generating ? 'Generating…' : 'Generate Banners'}
          </button>
        </div>

        {/* ── Right panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {!assets && !generating && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '360px', border: '1px dashed var(--border)', borderRadius: '12px',
              color: 'var(--muted)', gap: '20px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.3 }}>
                <div style={{ width: '220px', height: '56px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                <div style={{ width: '150px', height: '26px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '104px', height: '86px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                  <div style={{ width: '104px', height: '86px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <p style={{ fontSize: '13px', margin: 0 }}>Fill in the form and click Generate Banners</p>
            </div>
          )}

          {generating && (
            <div>
              <div className="skeleton" style={{ width: '100%', minHeight: '360px', borderRadius: '12px' }} />
              {generationStartTime && (
                <GeneratingOverlay messages={GEN_MESSAGES} startTime={generationStartTime} curve={BANNER_CURVE} />
              )}
            </div>
          )}

          {assets && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  {selectedSizes.size} banner{selectedSizes.size !== 1 ? 's' : ''} generated
                </p>
                <button onClick={handleDownloadAll} className="btn btn-secondary btn-sm">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download All SVGs
                </button>
              </div>

              {(() => {
                const sizes = BANNER_SIZES.filter(s => selectedSizes.has(s.key))
                const verticals = sizes.filter(s => s.layout === 'vertical')
                const horizontals = sizes.filter(s => s.layout !== 'vertical')
                const renderCard = (size: typeof BANNER_SIZES[number]) => {
                  const scale = previewScale(size.w, size.h)
                  const scaledW = Math.round(size.w * scale)
                  const scaledH = Math.round(size.h * scale)
                  const svg = buildSVG(size, copy, assets!, dbTemplates[size.key] || DEFAULT_BANNER_TEMPLATES[size.key])
                  return (
                    <div key={size.key} className="form-card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'flex-start', width: Math.max(scaledW + 48, 320) }}>
                      {/* Header bar */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexWrap: 'wrap', gap: '6px',
                        padding: '11px 16px', borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{size.label}</span>
                          <span style={{
                            fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace',
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            padding: '2px 6px', borderRadius: '4px',
                          }}>{size.w}×{size.h}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            disabled={copyingKey === size.key}
                            onClick={async () => {
                              setCopyingKey(size.key)
                              try {
                                const figmaSvg = await buildBannerFigmaSVG(size, copy, assets!, dbTemplates[size.key] || DEFAULT_BANNER_TEMPLATES[size.key])
                                await navigator.clipboard.writeText(figmaSvg)
                                setCopiedKey(size.key)
                                setTimeout(() => setCopiedKey(null), 2000)
                              } finally {
                                setCopyingKey(null)
                              }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{
                              background: copiedKey === size.key ? '#6366f1' : undefined,
                              color: copiedKey === size.key ? '#fff' : undefined,
                              borderColor: copiedKey === size.key ? '#6366f1' : undefined,
                              opacity: copyingKey === size.key ? 0.6 : 1,
                              cursor: copyingKey === size.key ? 'wait' : 'pointer',
                            }}>
                            {copyingKey === size.key ? 'Copying…' : copiedKey === size.key ? '✓ Copied!' : (
                              <>
                                Copy to Figma{' '}
                                <span style={{ fontSize: '9px', fontWeight: 700, background: '#6366f1', color: '#fff', borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.05em' }}>
                                  BETA
                                </span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => downloadSVG(svg, `banner_${size.key}_${size.w}x${size.h}.svg`)}
                            className="btn btn-secondary btn-sm">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                            SVG
                          </button>
                        </div>
                      </div>
                      {/* Preview stage */}
                      <div
                        onClick={() => setPreviewKey(size.key)}
                        style={{
                          padding: '28px 24px',
                          background: 'var(--bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: Math.max(scaledW + 48, 320),
                          cursor: 'zoom-in',
                        }}>
                        <div style={{
                          overflow: 'hidden',
                          borderRadius: '3px',
                          width: scaledW,
                          height: scaledH,
                          boxShadow: '0 2px 16px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
                          flexShrink: 0,
                        }}>
                          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: size.w, height: size.h }}>
                            <BannerPreview size={size} copy={copy} assets={assets!} template={dbTemplates[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                const wideH = horizontals.filter(s => s.key !== 'mediumrect' && s.key !== 'smartphone')
                const pairedH = horizontals.filter(s => s.key === 'mediumrect' || s.key === 'smartphone')
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {wideH.map(renderCard)}
                    {pairedH.length > 0 && (
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {pairedH.map(renderCard)}
                      </div>
                    )}
                    {verticals.length > 0 && (
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {verticals.map(renderCard)}
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {previewKey && assets && (() => {
        const s = BANNER_SIZES.find(b => b.key === previewKey)!
        return (
          <BannerModal
            size={s}
            copy={copy}
            assets={assets}
            template={dbTemplates[previewKey] || DEFAULT_BANNER_TEMPLATES[previewKey]}
            onClose={() => setPreviewKey(null)}
          />
        )
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
