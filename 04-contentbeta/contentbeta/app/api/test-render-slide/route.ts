import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { OVERLAY_INTERACTION_SCRIPT } from '@/lib/overlay-interaction-script'

export const maxDuration = 60

// Serializes chromium binary extraction to prevent concurrent spawn ETXTBSY errors.
// Promise is assigned synchronously before any await so concurrent callers all
// wait on the same promise instead of each triggering a parallel extraction.
let chromiumExecPathPromise: Promise<string> | null = null
function getChromiumExecPath(): Promise<string> {
  if (!chromiumExecPathPromise) {
    chromiumExecPathPromise = (async () => {
      const chromium = await import('@sparticuz/chromium-min')
      return chromium.default.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
      )
    })()
  }
  return chromiumExecPathPromise
}

function isDarkHexColor(value: string | null | undefined): boolean {
  const hex = (value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (!hex) return true
  const normalized = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 145
}



export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const {
    headline, microcopy, logoUrl,
    bgColor, headlineColor, microcopyColor, accentColor,
    textAccentColor = null as string | null,
    accentFontFamily = null as string | null,
    accentCustomFontDataUrl = null as string | null,
    accentCustomFontName = null as string | null,
    accentBgEnabled = false,
    accentBgColor = null as string | null,
    accentBgPadding = 4,
    accentBgRadius = 2,
    accentUnderline = false,
    accentUnderlineColor = null as string | null,
    fontFamily, headlineSize, headlinePaddingX = 0, microcopySize, microcopyPaddingX = 0, textAlign, uppercase,
    padding, logoPosition, logoSize, accentPosition, accentSize,
    verticalAlign,
    elements = [] as { dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex?: number }[],
    cta = null as { text: string; bgColor: string; textColor: string; fontSize: number; paddingX: number; paddingY: number; borderRadius: number; x: number; y: number; align?: 'left' | 'center' | 'right' | null; fontFamily?: string | null; customFontDataUrl?: string | null; customFontName?: string | null } | null,
    customFontDataUrl = null as string | null,
    customFontName = null as string | null,
    bgImageUrl = null as string | null,
    bgImageDataUrl = null as string | null,
    backgroundContrastProtection = false,
    subjectImageDataUrl = null as string | null,
    textPosition = null as { x: number; y: number } | null,
    splitLayout = 'free' as 'free' | 'left-image' | 'right-image',
    splitRatio = 50,
    hideText = false,
    logoX = null as number | null,
    logoY = null as number | null,
    headlineX = null as number | null,
    headlineY = null as number | null,
    microcopyX = null as number | null,
    microcopyY = null as number | null,
    eyebrowX = null as number | null,
    eyebrowY = null as number | null,
    bulletsX = null as number | null,
    bulletsY = null as number | null,
    textX = null as number | null,
    textY = null as number | null,
    // Return HTML string instead of rendering PNG
    returnHtml = false,
    // V2 layout params
    v2 = false,
    eyebrow = null as string | null,
    carouselTitle = null as string | null,
    bullets = [] as string[],
    splitPercent = null as number | null,
    primaryColor = null as string | null,
    textColor = null as string | null,
    microcopyColorV2 = null as string | null,
    accentColorV2 = null as string | null,
    slideType = null as string | null,
    bulletSize = null as number | null,
    eyebrowColor = null as string | null,
    eyebrowSize = null as number | null,
    eyebrowUppercase: _eyebrowUppercase = null as boolean | null,
    ctaPosition = null as string | null,
    headlineFontFamily = null as string | null,
    headlineCustomFontDataUrl = null as string | null,
    headlineCustomFontName = null as string | null,
    eyebrowFontFamily = null as string | null,
    eyebrowCustomFontDataUrl = null as string | null,
    microcopyFontFamily = null as string | null,
    microcopyCustomFontDataUrl = null as string | null,
    microcopyCustomFontName = null as string | null,
    bulletFontFamily = null as string | null,
    bulletCustomFontDataUrl = null as string | null,
    ctaFontFamily = null as string | null,
    ctaCustomFontDataUrl = null as string | null,
    eyebrowGap = null as number | null,
    headlineGap = null as number | null,
    subheadGap = null as number | null,
  } = await req.json()

  // Fetch remote URLs server-side to avoid large base64 payloads causing 413
  const fetchAsDataUrl = async (url: string) => {
    const r = await fetch(url)
    const buf = await r.arrayBuffer()
    const mime = r.headers.get('content-type') || 'image/png'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  }

  let resolvedBgImageDataUrl: string | null = bgImageDataUrl
  let resolvedLogoUrl: string | null = logoUrl
  if (bgImageUrl && !resolvedBgImageDataUrl) {
    try { resolvedBgImageDataUrl = await fetchAsDataUrl(bgImageUrl) } catch (e) { console.error('[render-slide] bgImageUrl fetch failed:', e) }
  }
  // If bgImageDataUrl is a plain URL (not a data URL), fetch it server-side
  if (resolvedBgImageDataUrl && resolvedBgImageDataUrl.startsWith('http')) {
    try { resolvedBgImageDataUrl = await fetchAsDataUrl(resolvedBgImageDataUrl) } catch (e) { console.error('[render-slide] bgImageDataUrl fetch failed:', e); resolvedBgImageDataUrl = null }
  }

  if (resolvedLogoUrl && !resolvedLogoUrl.startsWith('data:')) {
    try { resolvedLogoUrl = await fetchAsDataUrl(resolvedLogoUrl) } catch (e) { console.error('[render-slide] logo fetch failed:', e) }
  }

  const activeFontFamily = customFontName || fontFamily || 'Inter'
  const activeHeadlineFontFamily = headlineCustomFontName || headlineFontFamily || activeFontFamily
  const activeMicrocopyFontFamily = microcopyCustomFontName || microcopyFontFamily || activeFontFamily
  const ctaActiveFontFamily = cta?.customFontName || cta?.fontFamily || activeFontFamily

  const justifyContent =
    verticalAlign === 'top' ? 'flex-start' :
    verticalAlign === 'bottom' ? 'flex-end' : 'center'

  const accentStyle = (() => {
    if (accentPosition === 'none' || !accentSize) return ''
    const size = `${accentSize}px`
    const color = accentColor || 'rgba(255,255,255,0.15)'
    if (accentPosition === 'right')  return `position:absolute;top:0;right:0;width:${size};height:100%;background:${color};`
    if (accentPosition === 'left')   return `position:absolute;top:0;left:0;width:${size};height:100%;background:${color};`
    if (accentPosition === 'top')    return `position:absolute;top:0;left:0;width:100%;height:${size};background:${color};`
    if (accentPosition === 'bottom') return `position:absolute;bottom:0;left:0;width:100%;height:${size};background:${color};`
    return ''
  })()

  const logoStyle = (() => {
    const base = `position:absolute;height:${logoSize || 48}px;z-index:2;`
    if (logoX != null && logoY != null) return base + `left:${logoX}px;top:${logoY}px;`
    if (logoPosition === 'bottom-left')   return base + `bottom:${padding}px;left:${padding}px;`
    if (logoPosition === 'bottom-center') return base + `bottom:${padding}px;left:50%;transform:translateX(-50%);`
    if (logoPosition === 'bottom-right')  return base + `bottom:${padding}px;right:${padding}px;`
    if (logoPosition === 'top-left')      return base + `top:${padding}px;left:${padding}px;`
    if (logoPosition === 'top-center')    return base + `top:${padding}px;left:50%;transform:translateX(-50%);`
    if (logoPosition === 'top-right')     return base + `top:${padding}px;right:${padding}px;`
    return base + `bottom:${padding}px;left:${padding}px;`
  })()

  const googleFont = (fontFamily || 'Inter').replace(/ /g, '+')

  const fontLink = (() => {
    const parts: string[] = []
    if (customFontDataUrl)
      parts.push(`<style>@font-face { font-family: '${activeFontFamily}'; src: url('${customFontDataUrl}'); font-weight: 100 900; }</style>`)
    else if (fontFamily === 'Industry')
      parts.push(`<link href="https://fonts.cdnfonts.com/css/industry" rel="stylesheet"/>`)
    else
      parts.push(`<link href="https://fonts.googleapis.com/css2?family=${googleFont}:wght@400;700;900&display=swap" rel="stylesheet"/>`)
    if (headlineCustomFontDataUrl && activeHeadlineFontFamily !== activeFontFamily)
      parts.push(`<style>@font-face { font-family: '${activeHeadlineFontFamily}'; src: url('${headlineCustomFontDataUrl}'); font-weight: 100 900; }</style>`)
    if (microcopyCustomFontDataUrl && activeMicrocopyFontFamily !== activeFontFamily)
      parts.push(`<style>@font-face { font-family: '${activeMicrocopyFontFamily}'; src: url('${microcopyCustomFontDataUrl}'); font-weight: 100 900; }</style>`)
    if (accentCustomFontDataUrl && accentCustomFontName)
      parts.push(`<style>@font-face { font-family: '${accentCustomFontName}'; src: url('${accentCustomFontDataUrl}'); font-weight: 100 900; }</style>`)
    else if (accentFontFamily && !accentCustomFontDataUrl && accentFontFamily !== fontFamily)
      parts.push(`<link href="https://fonts.googleapis.com/css2?family=${accentFontFamily.replace(/ /g, '+')}:wght@400;700;900&display=swap" rel="stylesheet"/>`)
    return parts.join('\n  ')
  })()

  const ctaFontLink = (() => {
    if (!cta) return ''
    if (cta.customFontDataUrl) {
      return `<style>@font-face { font-family: '${ctaActiveFontFamily}'; src: url('${cta.customFontDataUrl}'); font-weight: 100 900; }</style>`
    }
    if (cta.fontFamily === 'Industry') {
      return `<link href="https://fonts.cdnfonts.com/css/industry" rel="stylesheet"/>`
    }
    if (cta.fontFamily && cta.fontFamily !== activeFontFamily) {
      return `<link href="https://fonts.googleapis.com/css2?family=${cta.fontFamily.replace(/ /g, '+')}:wght@400;700;900&display=swap" rel="stylesheet"/>`
    }
    return ''
  })()

  // Width each element occupies — matches what the text-zone constrains them to
  const contentWidth = splitLayout === 'free'
    ? 1080 - 2 * (padding || 80)
    : (1 - (splitRatio || 50) / 100) * 1080 - 2 * (padding || 80)

  // Build accent span style from all accent config fields
  // textAccentColor is a dedicated text-highlight color; accentColor is reused from the bar so may be semi-transparent
  const accentCol = textAccentColor || accentColor || '#3b82f6'
  const activeAccentFont = accentCustomFontName || accentFontFamily || null
  const accentSpanStyle = [
    `color:${accentCol}`,
    activeAccentFont ? `font-family:'${activeAccentFont}',sans-serif` : '',
    accentUnderline ? `text-decoration:underline${accentUnderlineColor ? `;text-decoration-color:${accentUnderlineColor}` : ''}` : '',
    accentBgEnabled && accentBgColor
      ? `background:${accentBgColor};padding:0 ${accentBgPadding}px;border-radius:${accentBgRadius}px;-webkit-box-decoration-break:clone;box-decoration-break:clone`
      : '',
  ].filter(Boolean).join(';')

  const parseBoldV1 = (text: string): string =>
    text.replace(/\*\*(.+?)\*\*/g, `<span style="${accentSpanStyle}">$1</span>`)
  const stripBoldV1 = (text: string): string =>
    text.replace(/\*\*(.+?)\*\*/g, '$1')

  const headlineHtml = headlineX != null && headlineY != null
    ? (headline ? `<div class="headline" data-drag-key="headline" style="position:absolute;left:${headlineX}px;top:${headlineY}px;width:${contentWidth}px;">${parseBoldV1(headline)}</div>` : '')
    : (headline ? `<div class="headline" data-drag-key="headline">${parseBoldV1(headline)}</div>` : '')

  const microcopyHtml = microcopy
    ? (microcopyX != null && microcopyY != null
      ? `<div class="microcopy" data-drag-key="microcopy" style="position:absolute;left:${microcopyX}px;top:${microcopyY}px;width:${contentWidth}px;">${stripBoldV1(microcopy)}</div>`
      : `<div class="microcopy" data-drag-key="microcopy">${stripBoldV1(microcopy)}</div>`)
    : ''

  const textBlock = !hideText ? (() => {
    const hAbs = headline && headlineX != null && headlineY != null
    const mAbs = microcopy && microcopyX != null && microcopyY != null
    if (hAbs && mAbs) return headlineHtml + '\n  ' + microcopyHtml
    if (hAbs) return headlineHtml + (microcopyHtml ? '\n  <div class="text-zone"><div class="content">' + microcopyHtml + '</div></div>' : '')
    if (mAbs) return (headlineHtml ? '<div class="text-zone"><div class="content">' + headlineHtml + '</div></div>\n  ' : '') + microcopyHtml
    const inner = headlineHtml + microcopyHtml
    return inner ? `<div class="text-zone"><div class="content" data-drag-key="stack">${inner}</div></div>` : ''
  })() : ''

  // Generated backgrounds are unpredictable. Protect only the copy zone with
  // a soft gradient so the background stays visible while copy is always legible.
  const contrastOverlay = (() => {
    if (!backgroundContrastProtection || !resolvedBgImageDataUrl || hideText || (!headline && !microcopy)) return ''
    const copyIsDark = isDarkHexColor(headlineColor || '#ffffff')
    const strong = copyIsDark ? 'rgba(255,255,255,0.94)' : 'rgba(3,7,31,0.82)'
    const soft = copyIsDark ? 'rgba(255,255,255,0.66)' : 'rgba(3,7,31,0.56)'
    if (splitLayout === 'left-image') {
      const start = Math.max(0, (splitRatio || 50) - 12)
      return `<div aria-hidden="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,transparent 0%,transparent ${start}%,${soft} ${splitRatio || 50}%,${strong} 100%);"></div>`
    }
    if (splitLayout === 'right-image') {
      const end = Math.min(100, 112 - (splitRatio || 50))
      return `<div aria-hidden="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,${strong} 0%,${soft} ${100 - (splitRatio || 50)}%,transparent ${end}%,transparent 100%);"></div>`
    }
    if (textAlign === 'center') {
      return `<div aria-hidden="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,transparent 4%,${soft} 24%,${strong} 50%,${soft} 76%,transparent 96%);"></div>`
    }
    return `<div aria-hidden="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,${strong} 0%,${soft} 54%,transparent 76%);"></div>`
  })()

  const interactionScript = OVERLAY_INTERACTION_SCRIPT

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  ${fontLink}
  ${ctaFontLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    body {
      width: 1080px;
      height: 1080px;
      font-family: '${activeFontFamily}', sans-serif;
      background: ${bgColor || '#1a1a2e'};
      ${resolvedBgImageDataUrl ? `background-image: url('${resolvedBgImageDataUrl}'); background-size: cover; background-position: center top;` : ''}
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: ${splitLayout === 'free' ? justifyContent : 'flex-start'};
      padding: ${splitLayout === 'free' ? `${padding || 80}px` : '0'};
    }
    .text-zone {
      ${splitLayout === 'free' ? '' : `
      position: absolute;
      top: 0;
      ${splitLayout === 'left-image' ? `right: 0; left: ${splitRatio}%;` : `left: 0; right: ${splitRatio}%;`}
      height: 1080px;
      display: flex;
      flex-direction: column;
      justify-content: ${justifyContent};
      padding: ${padding || 80}px;
      `}
    }
    .content { position: ${textPosition ? 'absolute' : 'relative'}; z-index: 2; width: ${textPosition ? `calc(100% - ${textPosition.x}px)` : '100%'}; ${textPosition ? `left:${textPosition.x}px;top:${textPosition.y}px;` : ''} }
    .headline {
      font-family: '${activeHeadlineFontFamily}', sans-serif;
      font-size: ${headlineSize || 86}px;
      font-weight: 900;
      color: ${headlineColor || '#ffffff'};
      line-height: 1.05;
      letter-spacing: -2px;
      margin-bottom: 32px;
      text-align: ${textAlign || 'left'};
      overflow: visible;
      overflow-wrap: anywhere;
      ${uppercase ? 'text-transform: uppercase;' : ''}
      ${(headlinePaddingX as number) > 0 ? `padding-left: ${headlinePaddingX}px; padding-right: ${headlinePaddingX}px;` : ''}
    }
    .microcopy {
      font-family: '${activeMicrocopyFontFamily}', sans-serif;
      font-size: ${microcopySize || 32}px;
      font-weight: 400;
      color: ${microcopyColor || 'rgba(255,255,255,0.75)'};
      line-height: 1.5;
      text-align: ${textAlign || 'left'};
      overflow: visible;
      ${(microcopyPaddingX as number) > 0 ? `padding-left: ${microcopyPaddingX}px; padding-right: ${microcopyPaddingX}px;` : ''}
    }
  </style>
</head>
<body>
  ${accentStyle ? `<div style="${accentStyle}"></div>` : ''}
  ${contrastOverlay}
  ${textBlock}
  ${elements.filter((el: { zIndex?: number }) => (el.zIndex ?? 1) < 0).map((el: { dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex?: number }) =>
    `<img draggable="false" src="${el.dataUrl}" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;opacity:${(el.opacity ?? 100) / 100};z-index:0;pointer-events:none;" />`
  ).join('\n  ')}
  ${subjectImageDataUrl ? `<img draggable="false" src="${subjectImageDataUrl}" style="position:absolute;inset:0;width:1080px;height:1080px;object-fit:cover;object-position:center top;z-index:1;pointer-events:none;" />` : ''}
  ${elements.filter((el: { zIndex?: number }) => (el.zIndex ?? 1) >= 0).map((el: { dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex?: number }) =>
    `<img draggable="false" src="${el.dataUrl}" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;opacity:${(el.opacity ?? 100) / 100};z-index:${el.zIndex ?? 1};pointer-events:none;" />`
  ).join('\n  ')}
  ${resolvedLogoUrl ? `<img data-type="logo" data-drag-key="logo" draggable="false" style="${logoStyle}" src="${resolvedLogoUrl}" />` : ''}
  ${!hideText && cta ? (() => {
    const align = cta.align || (cta.x === 540 ? 'center' : 'left')
    const posStyle = align === 'center'
      ? `left:50%;transform:translateX(-50%);`
      : align === 'right'
        ? `right:${padding || 80}px;`
        : `left:${cta.x}px;`
    return `<div data-type="cta" data-drag-key="cta" style="position:absolute;${posStyle}top:${cta.y}px;z-index:3;background:${cta.bgColor};color:${cta.textColor};font-family:'${ctaActiveFontFamily}',sans-serif;font-size:${cta.fontSize}px;font-weight:700;padding:${cta.paddingY}px ${cta.paddingX}px;border-radius:${cta.borderRadius ?? 9999}px;white-space:nowrap;line-height:1;">${cta.text}</div>`
  })() : ''}
  ${returnHtml ? interactionScript : ''}
</body>
</html>`

  // ── V2 layout: full-bleed bg image, text panel on left splitPercent% ──
  if (v2) {
    const sp = splitPercent ?? (slideType === 'title' ? 65 : slideType === 'cta' ? 80 : 50)
    const pc = primaryColor || '#1a1a2e'
    const ac = accentColorV2 || accentColor || '#3b82f6'
    const tc = textColor || '#ffffff'
    const mc = microcopyColorV2 || tc
    const isCta = slideType === 'cta'
    const font = customFontName || fontFamily || 'Inter'

    // Resolve per-element font — fall back to global font
    const hFont = headlineFontFamily  || font
    const eFont = eyebrowFontFamily   || font
    const mFont = microcopyFontFamily || font
    const bFont = bulletFontFamily    || font
    const cFont = ctaFontFamily       || font
    const aFont = accentCustomFontName || accentFontFamily || null  // accent font (optional)

    // Build font links: one Google Fonts link per unique non-custom font family
    const fLink = (() => {
      const googleFamilies = new Set<string>()
      const pairs: [string, string | null][] = [
        [font,  customFontDataUrl],
        [hFont, headlineCustomFontDataUrl],
        [eFont, eyebrowCustomFontDataUrl],
        [mFont, microcopyCustomFontDataUrl],
        [bFont, bulletCustomFontDataUrl],
        [cFont, ctaCustomFontDataUrl],
      ]
      // Accent Google Font — only if no custom file and different from global font
      if (aFont && !accentCustomFontDataUrl && aFont !== font) pairs.push([aFont, null])
      for (const [name, dataUrl] of pairs) {
        if (!dataUrl) googleFamilies.add(name)
      }
      return Array.from(googleFamilies)
        .map(f => `<link href="https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@400;700;900&display=swap" rel="stylesheet"/>`)
        .join('\n  ')
    })()

    // Build accent span style
    const v2AccentTextColor = textAccentColor || (accentBgEnabled && accentBgColor
      ? (isDarkHexColor(accentBgColor) ? '#ffffff' : '#07111f')
      : ac)
    const v2AccentSpanStyle = [
      `color:${v2AccentTextColor}`,
      `font-weight:700`,
      aFont ? `font-family:'${aFont}',sans-serif` : '',
      accentUnderline ? `text-decoration:underline${accentUnderlineColor ? `;text-decoration-color:${accentUnderlineColor}` : ''}` : '',
      accentBgEnabled && accentBgColor
        ? `background:${accentBgColor};padding:0 ${accentBgPadding}px;border-radius:${accentBgRadius}px;-webkit-box-decoration-break:clone;box-decoration-break:clone`
        : '',
    ].filter(Boolean).join(';')

    // Parse **bold** markers into accent-styled spans (headline only)
    const parseBold = (text: string): string =>
      text.replace(/\*\*(.+?)\*\*/g, `<span style="${v2AccentSpanStyle}">$1</span>`)
    const stripBold = (text: string): string =>
      text.replace(/\*\*(.+?)\*\*/g, '$1')

    // Build @font-face blocks for unique custom fonts
    const customFontFaces = (() => {
      const seen = new Set<string>()
      const blocks: string[] = []
      const add = (name: string, dataUrl: string | null) => {
        if (!dataUrl || seen.has(dataUrl)) return
        seen.add(dataUrl)
        blocks.push(`@font-face{font-family:'${name}';src:url('${dataUrl}');font-weight:100 900;}`)
      }
      add(font,  customFontDataUrl)
      add(hFont, headlineCustomFontDataUrl)
      add(eFont, eyebrowCustomFontDataUrl)
      add(mFont, microcopyCustomFontDataUrl)
      add(bFont, bulletCustomFontDataUrl)
      add(cFont, ctaCustomFontDataUrl)
      const accentFontName = accentCustomFontName || accentFontFamily
      if (accentFontName && accentCustomFontDataUrl) add(accentFontName, accentCustomFontDataUrl)
      return blocks.length ? `<style>${blocks.join('')}</style>` : ''
    })()

    const eSize = eyebrowSize || 14
    const toSentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    const eyebrowText = slideType === 'title' ? null : (eyebrow ? toSentenceCase(eyebrow) : carouselTitle || null)
    const ec = eyebrowColor || ac
    const pad = padding || 60
    const layerAbs = (x: number | null, y: number | null) => x != null && y != null
    const absCss = (x: number | null, y: number | null, extra: string) =>
      layerAbs(x, y) ? `position:absolute;left:${x}px;top:${y}px;z-index:5;margin:0;${extra}` : extra
    const eyebrowAbs = layerAbs(eyebrowX, eyebrowY)
    const headlineAbs = layerAbs(headlineX, headlineY)
    const microcopyAbs = layerAbs(microcopyX, microcopyY)
    const bulletsAbs = layerAbs(bulletsX, bulletsY)

    const eyebrowHtml = eyebrowText
      ? `<div class="eyebrow" data-drag-key="eyebrow" style="${absCss(eyebrowX, eyebrowY, `font-size:${eSize}px;font-weight:400;letter-spacing:0.05em;color:${ec};margin-bottom:${eyebrowAbs ? 0 : (eyebrowGap ?? 16)}px;font-family:'${eFont}',sans-serif;`)}">${eyebrowText}</div>`
      : ''

    const headlineText = stripBold(headline || '')
    // A manually positioned text block (for example, text on the right of an
    // illustration) must use the remaining canvas width, not a percentage
    // measured from the left edge. Otherwise `left:540px; width:50%` runs
    // past a 1080px canvas and clips the copy.
    const textPanelOuterWidth = textX != null && textX > 0
      ? Math.min(Math.round(1080 * sp / 100), 1080 - textX - 24)
      : Math.round(1080 * sp / 100)
    const fitHeadlineSize = () => {
      const requested = Math.min(headlineSize || (isCta ? 64 : 52), isCta ? 68 : 56)
      const zoneWidth = isCta ? 700 : Math.max(260, textPanelOuterWidth - (pad * 2))
      const maxLines = isCta ? 3 : 4
      let size = requested
      while (size > 32) {
        const approximateCharsPerLine = Math.max(8, Math.floor(zoneWidth / (size * 0.54)))
        const approximateLines = Math.ceil(headlineText.length / approximateCharsPerLine)
        if (approximateLines <= maxLines) break
        size -= 2
      }
      return size
    }
    const hSize = fitHeadlineSize()
    const mSize = Math.min(microcopySize || (isCta ? 24 : 20), isCta ? 26 : 22)

    const headlineHtml = headline
      ? `<h2 class="headline" data-drag-key="headline" style="${absCss(headlineX, headlineY, `font-size:${hSize}px;font-weight:700;line-height:1.06;letter-spacing:-0.025em;color:${tc};margin-top:0;margin-bottom:${headlineAbs ? 0 : (headlineGap ?? 20)}px;font-family:'${hFont}',sans-serif;overflow-wrap:anywhere;word-break:normal;`)}">${parseBold(headline)}</h2>`
      : ''

    const subheadHtml = microcopy
      ? `<p class="microcopy" data-drag-key="microcopy" style="${absCss(microcopyX, microcopyY, `font-size:${mSize}px;font-weight:400;line-height:1.5;color:${mc};opacity:0.85;margin-top:0;margin-bottom:${microcopyAbs ? 0 : (subheadGap ?? 28)}px;font-family:'${mFont}',sans-serif;`)}">${stripBold(microcopy)}</p>`
      : ''

    const bSize = bulletSize || 18
    const bulletsHtml = bullets && bullets.length
      ? `<div class="bullets" data-drag-key="bullets" style="${absCss(bulletsX, bulletsY, 'display:flex;flex-direction:column;gap:16px;')}">${bullets.map((b: string) =>
          `<div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${ac};flex-shrink:0;margin-top:${Math.round(bSize * 0.35)}px;"></div>
            <span style="font-size:${bSize}px;font-weight:400;line-height:1.5;color:${mc};font-family:'${bFont}',sans-serif;">${stripBold(b)}</span>
          </div>`
        ).join('')}</div>`
      : ''

    const stackedHtml = [!eyebrowAbs && eyebrowHtml, !headlineAbs && headlineHtml, !microcopyAbs && subheadHtml, !bulletsAbs && bulletsHtml].filter(Boolean).join('')
    const absLayersHtml = [eyebrowAbs && eyebrowHtml, headlineAbs && headlineHtml, microcopyAbs && subheadHtml, bulletsAbs && bulletsHtml].filter(Boolean).join('')
    const stackOverflow = returnHtml ? 'visible' : 'hidden'

    const logoV2Style = (() => {
      const lp = logoPosition || 'bottom-left'
      const ls = logoSize || 48
      const pad = padding || 60
      if (logoX != null && logoY != null) return `position:absolute;height:${ls}px;left:${logoX}px;top:${logoY}px;z-index:10;`
      if (lp === 'top-left')      return `position:absolute;height:${ls}px;top:${pad}px;left:${pad}px;z-index:10;`
      if (lp === 'top-center')    return `position:absolute;height:${ls}px;top:${pad}px;left:50%;transform:translateX(-50%);z-index:10;`
      if (lp === 'top-right')     return `position:absolute;height:${ls}px;top:${pad}px;right:${pad}px;z-index:10;`
      if (lp === 'bottom-center') return `position:absolute;height:${ls}px;bottom:${pad}px;left:50%;transform:translateX(-50%);z-index:10;`
      if (lp === 'bottom-right')  return `position:absolute;height:${ls}px;bottom:${pad}px;right:${pad}px;z-index:10;`
      return `position:absolute;height:${ls}px;bottom:${pad}px;left:${pad}px;z-index:10;`
    })()

    // CTA: map ctaPosition → justify-content (vertical) + align-items (horizontal)
    const pos = isCta ? (ctaPosition || 'center') : null
    const jc = pos
      ? (pos.startsWith('top') ? 'flex-start' : pos.startsWith('bottom') ? 'flex-end' : 'center')
      : (verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center')
    const ai = pos
      ? (pos.endsWith('right') ? 'flex-end' : pos.endsWith('center') || pos === 'center' ? 'center' : 'flex-start')
      : 'flex-start'
    // text-align inside the wrapper follows horizontal alignment
    const innerTextAlign = ai === 'flex-end' ? 'right' : ai === 'center' ? 'center' : 'left'

    // CTA is absolutely positioned on body (same as static) so left:50% = 50% of full 1080px
    const ctaV2BtnH = Math.round((cta?.paddingY ?? 18) * 2 + (cta?.fontSize ?? 14) * 1.5)
    const ctaV2Y = cta?.y != null
      ? cta.y
      : (ctaPosition || '').startsWith('top')
        ? pad
        : (ctaPosition || '').startsWith('bottom')
          ? 1080 - pad - ctaV2BtnH
          : 1080 - pad * 3
    const ctaV2HPos = cta?.x != null
      ? `left:${cta.x}px;`
      : (ctaPosition || 'center').endsWith('right')
        ? `right:${pad}px;`
        : (ctaPosition || 'center').endsWith('left')
          ? `left:${pad}px;`
          : `left:50%;transform:translateX(-50%);`
    const ctaBtnHtml = isCta && cta?.text
      ? `<div data-type="cta" data-drag-key="cta" style="position:absolute;${ctaV2HPos}top:${ctaV2Y}px;z-index:5;display:inline-block;padding:${cta.paddingY ?? 18}px ${cta.paddingX ?? 36}px;background:${cta.bgColor ?? '#ffffff'};color:${cta.textColor ?? pc};font-family:'${cFont}',sans-serif;font-size:${cta.fontSize ?? 14}px;font-weight:500;letter-spacing:0.1em;border-radius:${cta.borderRadius ?? 4}px;white-space:nowrap;">${cta.text}</div>`
      : ''

    const v2html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  ${fLink}
  ${customFontFaces}
</head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:${stackOverflow};position:relative;font-family:'${font}',sans-serif;background:${pc};user-select:none;">
  ${resolvedBgImageDataUrl ? `<img src="${resolvedBgImageDataUrl}" draggable="false" style="position:absolute;inset:0;width:1080px;height:1080px;object-fit:cover;object-position:center top;z-index:0;pointer-events:none;" />` : ''}
  ${elements.filter((el: { zIndex?: number }) => (el.zIndex ?? 1) <= 1).map((el: { dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex?: number }) =>
    `<img src="${el.dataUrl}" draggable="false" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;opacity:${(el.opacity ?? 100) / 100};z-index:1;pointer-events:none;" />`
  ).join('\n  ')}
  ${subjectImageDataUrl ? `<img src="${subjectImageDataUrl}" draggable="false" style="position:absolute;inset:0;width:1080px;height:1080px;object-fit:cover;object-position:center top;z-index:2;pointer-events:none;" />` : ''}
  ${elements.filter((el: { zIndex?: number }) => (el.zIndex ?? 1) > 1).map((el: { dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex?: number }) =>
    `<img src="${el.dataUrl}" draggable="false" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;opacity:${(el.opacity ?? 100) / 100};z-index:3;pointer-events:none;" />`
  ).join('\n  ')}
  ${isCta
    ? `<div style="position:absolute;left:0;top:0;width:1080px;height:1080px;display:flex;flex-direction:column;justify-content:${jc};align-items:${ai};z-index:4;padding:${pad}px;box-sizing:border-box;overflow:${stackOverflow};">
    <div class="text-stack" data-drag-key="stack" style="width:700px;max-height:${1080 - (pad * 2) - ctaV2BtnH - 24}px;overflow:${stackOverflow};text-align:${innerTextAlign};">${stackedHtml}</div>
  </div>
  ${ctaBtnHtml}`
    : `<div class="text-stack" data-drag-key="stack" style="position:absolute;${textX != null || textY != null ? `left:${textX ?? 0}px;top:${textY ?? 0}px;width:${textPanelOuterWidth}px;` : `left:0;top:0;width:${sp}%;height:100%;display:flex;flex-direction:column;justify-content:${jc};align-items:flex-start;`}z-index:4;padding:${pad}px;box-sizing:border-box;text-align:left;overflow:${stackOverflow};">
    ${stackedHtml}
  </div>`
  }
  ${absLayersHtml}
  ${resolvedLogoUrl ? `<img data-type="logo" data-drag-key="logo" src="${resolvedLogoUrl}" style="${logoV2Style}" draggable="false" />` : ''}
  ${returnHtml ? interactionScript : ''}
</body>
</html>`

    if (returnHtml) {
      return new NextResponse(v2html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // Render to PNG via Puppeteer
    try {
      let browser
      if (process.env.NODE_ENV === 'production') {
        const chromium = await import('@sparticuz/chromium-min')
        const puppeteer = await import('puppeteer-core')
        browser = await puppeteer.default.launch({
          args: chromium.default.args,
          defaultViewport: { width: 1080, height: 1080 },
          executablePath: await getChromiumExecPath(),
          headless: true,
        })
      } else {
        const puppeteer = await import('puppeteer')
        browser = await puppeteer.default.launch({ defaultViewport: { width: 1080, height: 1080 }, headless: true })
      }
      const page = await browser.newPage()
      await page.setViewport({ width: 1080, height: 1080 })
      await page.setContent(v2html, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.evaluate(() => document.fonts.ready)
      const screenshot = await page.screenshot({ type: 'png', fullPage: false })
      await browser.close()
      return new NextResponse(Buffer.from(screenshot), {
        headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'inline; filename="slide.png"' },
      })
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 })
    }
  }

  if (returnHtml) {
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    let browser

    if (process.env.NODE_ENV === 'production') {
      const chromium = await import('@sparticuz/chromium-min')
      const puppeteer = await import('puppeteer-core')
      browser = await puppeteer.default.launch({
        args: chromium.default.args,
        defaultViewport: { width: 1080, height: 1080 },
        executablePath: await getChromiumExecPath(),
        headless: true,
      })
    } else {
      const puppeteer = await import('puppeteer')
      browser = await puppeteer.default.launch({
        defaultViewport: { width: 1080, height: 1080 },
        headless: true,
      })
    }

    const page = await browser.newPage()
    await page.setViewport({ width: 1080, height: 1080 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.evaluate(() => document.fonts.ready)
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    await browser.close()

    return new NextResponse(Buffer.from(screenshot), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="slide.png"',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
