import type { RenderParams } from './generate-store'

export async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = new Uint8Array(await res.arrayBuffer())
  const mime = res.headers.get('content-type') || 'image/png'
  let b64 = ''
  const chunk = 8192
  for (let i = 0; i < buf.length; i += chunk) {
    b64 += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[])
  }
  return `data:${mime};base64,${btoa(b64)}`
}

export async function getImageNaturalSize(dataUri: string): Promise<{ nw: number; nh: number }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ nw: img.naturalWidth, nh: img.naturalHeight })
    img.onerror = () => resolve({ nw: 0, nh: 0 })
    img.src = dataUri
  })
}

// Figma doesn't support SVG-in-SVG (<image href="data:image/svg+xml;...">).
// This rasterizes an SVG data URI to a PNG data URI via canvas so it embeds correctly.
async function ensurePngDataUrl(dataUrl: string, size = 256): Promise<string> {
  if (!dataUrl.startsWith('data:image/svg+xml')) return dataUrl
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || size
      const h = img.naturalHeight || size
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Wraps text into lines based on approximate character width.
// Bold/heavy fonts are wider (~0.62×), regular fonts narrower (~0.50×).
function wrapText(text: string, maxWidth: number, fontSize: number, fontWeight = 400): string[] {
  const factor = fontWeight >= 700 ? 0.48 : fontWeight >= 500 ? 0.45 : 0.42
  const charWidth = fontSize * factor
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (test.length * charWidth <= maxWidth || !current) {
      current = test
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

// Renders a text line with accent-colored tspans. Falls back to a plain <text> if no accent words present.
// accentBg draws an approximate rect behind each accented segment (SVG has no CSS background, so we estimate widths).
function accentedTextSvg(
  line: string,
  accentedWords: Set<string>,
  attrs: { x: number; y: number; fontFamily: string; fontSize: number; fontWeight: number | string; fill: string; accentFill: string; anchor: string; extraStyle?: string; accentBg?: { color: string; padding: number; radius: number } }
): string {
  const { x, y, fontFamily, fontSize, fontWeight, fill, accentFill, anchor, extraStyle = '', accentBg } = attrs
  const base = `x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="${anchor}" style="font-family: ${fontFamily}; font-size: ${fontSize}px; font-weight: ${fontWeight}; fill: ${fill};${extraStyle}"`
  const words = line.split(/\s+/).filter(Boolean)
  const hasAccent = words.some(w => accentedWords.has(w))
  if (!hasAccent) return `  <text ${base} fill="${fill}">${escXml(line)}</text>`
  // Group consecutive words of the same type into one tspan so spaces live
  // inside text content rather than as standalone tspans (Figma drops those).
  type Seg = { text: string; accent: boolean }
  const segments: Seg[] = []
  for (const word of words) {
    const isAccent = accentedWords.has(word)
    const last = segments[segments.length - 1]
    if (last && last.accent === isAccent) last.text += ' ' + word
    else segments.push({ text: word, accent: isAccent })
  }
  // Emit background rects for accented segments (approximate char-width tracking)
  const rects: string[] = []
  if (accentBg) {
    const charW = fontSize * 0.62
    let segX = x
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const textForW = i < segments.length - 1 ? seg.text + ' ' : seg.text
      const segW = textForW.length * charW
      if (seg.accent) {
        const leftBuffer = fontSize * 0.15
        const rX = Math.round(segX - accentBg.padding - leftBuffer)
        const rY = Math.round(y - fontSize * 0.85 - accentBg.padding)
        const rW = Math.round(segW + accentBg.padding * 2 + leftBuffer + fontSize * 0.05)
        const rH = Math.round(fontSize * 1.1 + accentBg.padding * 2)
        rects.push(`  <rect x="${rX}" y="${rY}" width="${rW}" height="${rH}" rx="${accentBg.radius}" fill="${accentBg.color}"/>`)
      }
      segX += segW
    }
  }
  const tspans = segments.map((seg, i) => {
    const text = i < segments.length - 1 ? seg.text + ' ' : seg.text
    return `<tspan fill="${seg.accent ? accentFill : fill}">${escXml(text)}</tspan>`
  }).join('')
  const textEl = `  <text ${base}>${tspans}</text>`
  return rects.length ? rects.join('\n') + '\n' + textEl : textEl
}

const GOOGLE_FONTS = ['Inter', 'Roboto', 'Montserrat', 'Open Sans', 'Lato', 'Poppins', 'Nunito', 'Source Sans Pro', 'Raleway', 'Oswald', 'Outfit', 'Playfair Display']

function normalizeFontAlias(raw: string): string | null {
  const clean = raw.trim().replace(/['"]/g, '')
  const suffixPattern = /[-_ ](bold|bolditalic|medium|mediumitalic|regular|semibold|semibolditalic|light|lightitalic|italic|thin|thinitalic|black|blackitalic)$/i
  const m = clean.match(suffixPattern)
  if (!m) return null
  const rawBase = clean.replace(suffixPattern, '')
  const isAllCaps = !/[a-z]/.test(rawBase) && /[A-Z]/.test(rawBase)
  const base = isAllCaps
    ? rawBase.split(/[ _-]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : rawBase
  const suffix = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
  const alias = `${base}-${suffix}`
  return alias !== clean ? alias : null
}

function getFigmaFontFamily(fontName: string, weight: number): string {
  const clean = fontName.trim().replace(/['"]/g, '')
  const suffixPattern = /[-_ ](bold|bolditalic|medium|mediumitalic|regular|semibold|semibolditalic|light|lightitalic|italic|thin|thinitalic|black|blackitalic)$/i
  const m = clean.match(suffixPattern)
  if (m) {
    // Font already has a suffix — preserve it, don't override with weight-based name.
    // Title-case only when base is ALL-CAPS (e.g. "INDUSTRY" → "Industry").
    // Leave mixed/camelCase untouched (e.g. "PlayfairDisplay" stays as-is).
    const rawBase = clean.replace(suffixPattern, '')
    const isAllCaps = !/[a-z]/.test(rawBase) && /[A-Z]/.test(rawBase)
    const base = isAllCaps
      ? rawBase.split(/[ _-]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      : rawBase
    const suffix = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
    return `${base}-${suffix}, ${base}`
  }
  // No suffix — derive variant from CSS weight
  const base = clean
  if (weight >= 700) return `${base}-Bold, ${base}`
  if (weight >= 500) return `${base}-Medium, ${base}`
  return `${base}-Regular, ${base}`
}

// Figma's SVG import resolves fonts by name against installed/system fonts — it
// never fetches a URL. Embedding the actual font file as a base64 @font-face
// (keyed to the exact family name the SVG's <text> elements reference) is what
// makes brand custom fonts render correctly instead of silently falling back.
// Google/standard fonts get a plain @import since Figma does have those locally.
export async function buildFontFaceStyle(fonts: { name: string | null; url: string | null }[]): Promise<string> {
  const faces: string[] = []
  const seenUrls = new Set<string>()
  for (const f of fonts) {
    if (!f.name || !f.url || seenUrls.has(f.url) || f.url.includes('fonts.googleapis.com')) continue
    seenUrls.add(f.url)
    const alias = normalizeFontAlias(f.name)
    try {
      const dataUrl = await urlToBase64(f.url)
      const src = `url('${f.url}'),url('${dataUrl}')`
      faces.push(`@font-face{font-family:'${f.name}';src:${src};font-weight:100 900;}`)
      if (alias) faces.push(`@font-face{font-family:'${alias}';src:${src};font-weight:100 900;}`)
    } catch { /* skip — that text falls back to the default font instead of failing the export */ }
  }

  const seenGoogle = new Set<string>()
  for (const f of fonts) {
    if (!f.name) continue
    const clean = f.name.trim().replace(/['"]/g, '')
    const match = GOOGLE_FONTS.find(g => clean.toLowerCase().startsWith(g.toLowerCase()))
    if (match) seenGoogle.add(match)
  }
  seenGoogle.add('Inter')
  const familyParams = Array.from(seenGoogle).map(name => `family=${name.replace(/\s+/g, '+')}:wght@400;500;700;800;900`).join('&')
  const googleImport = `@import url('https://fonts.googleapis.com/css2?${familyParams}&display=swap');`

  return [googleImport, ...faces].join('\n')
}

export async function textToSvgPath(text: string, x: number, y: number, fontSize: number, fontDataUrl: string, fill: string): Promise<string> {
  try {
    const opentype = await import('opentype.js')
    const base64 = fontDataUrl.split(',')[1]
    const binary = atob(base64)
    const buf = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const font = opentype.parse(buf)
    const path = font.getPath(text, x, y, fontSize)
    const d = path.toPathData(2)
    return `<path d="${d}" fill="${fill}"/>`
  } catch {
    return ''
  }
}

export async function buildStaticPostSVG(params: RenderParams): Promise<string> {
  const padding = (params.padding as number) || 80
  const headlineSize = params.headlineSize || 86
  const microcopySize = params.microcopySize || 32
  const headlineColor = (params.headlineColor as string) || '#ffffff'
  const microcopyColor = (params.microcopyColor as string) || 'rgba(255,255,255,0.75)'
  const textAccentColor = (params.textAccentColor as string) || (params.accentColor as string) || headlineColor
  const fontFamily = (params.customFontName as string) || (params.fontFamily as string) || 'Inter'
  const logoSize = (params.logoSize as number) || 48
  const logoPosition = (params.logoPosition as string) || 'bottom-left'
  const verticalAlign = (params.verticalAlign as string) || 'center'
  const textAlign = (params.textAlign as string) || 'left'

  const bgUrl = params.bgImageDataUrl as string
  const logoUrl = params.logoUrl as string
  const [bgBase64, logoBase64Raw] = await Promise.all([
    bgUrl ? (bgUrl.startsWith('data:') ? Promise.resolve(bgUrl) : urlToBase64(bgUrl)) : Promise.resolve(''),
    logoUrl ? (logoUrl.startsWith('data:') ? Promise.resolve(logoUrl) : urlToBase64(logoUrl)) : Promise.resolve(''),
  ])
  const logoBase64 = logoBase64Raw ? await ensurePngDataUrl(logoBase64Raw, 512) : ''

  const { nw: logoNW, nh: logoNH } = logoBase64 ? await getImageNaturalSize(logoBase64) : { nw: 0, nh: 0 }
  const logoWidth = logoNH > 0 ? Math.round((logoSize / logoNH) * logoNW) : logoSize * 3

  const textPosition = params.textPosition as { x: number; y: number } | null
  const totalTextH = headlineSize * 1.1 + 32 + microcopySize * 1.5

  const hx = params.headlineX != null ? params.headlineX : textPosition ? textPosition.x : padding
  const hy = params.headlineY != null ? params.headlineY : (() => {
    if (textPosition) return textPosition.y + headlineSize * 0.9
    if (verticalAlign === 'top') return padding + headlineSize * 0.9
    if (verticalAlign === 'bottom') return 1080 - padding - totalTextH + headlineSize * 0.9
    return (1080 - totalTextH) / 2 + headlineSize * 0.9
  })()
  const splitLayout = (params.splitLayout as string) || 'free'
  const splitRatio = (params.splitRatio as number) || 50
  const textMaxWidth = splitLayout === 'free'
    ? 1080 - 2 * padding
    : Math.round((1 - splitRatio / 100) * 1080 - 2 * padding)
  // Use browser-measured line breaks when available (sent from iframe 'ready' event),
  // otherwise fall back to character-width estimation.
  const stripBold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1')
  const accentedWords = new Set<string>()
  const accentSource = `${params.headline || ''}`
  const accentRe = /\*\*(.+?)\*\*/g
  let accentMatch: RegExpExecArray | null
  while ((accentMatch = accentRe.exec(accentSource)) !== null) accentedWords.add(accentMatch[1])
  const noAccent = new Set<string>()
  const hlLines = (params.headlineLines as string[] | null)?.length
    ? (params.headlineLines as string[]).map(stripBold)
    : params.headline ? wrapText(stripBold(params.headline as string), textMaxWidth, headlineSize, 900) : []
  const mcLines = (params.microcopyLines as string[] | null)?.length
    ? (params.microcopyLines as string[]).map(stripBold)
    : params.microcopy ? wrapText(stripBold(params.microcopy as string), textMaxWidth, microcopySize, 400) : []
  const hlLineH = headlineSize * 1.15
  const mcLineH = microcopySize * 1.5
  const mx = params.microcopyX != null ? params.microcopyX : hx
  const my = params.microcopyY != null ? params.microcopyY : hy + (hlLines.length - 1) * hlLineH + headlineSize * 1.1 + 32


  const anchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
  const txOffset = textAlign === 'center' ? 540 : textAlign === 'right' ? 1080 - padding : null

  let lx = params.logoX as number | null
  let ly = params.logoY as number | null
  if (lx == null || ly == null) {
    if (logoPosition === 'top-left')           { lx = padding; ly = padding }
    else if (logoPosition === 'top-center')    { lx = 540 - logoWidth / 2; ly = padding }
    else if (logoPosition === 'top-right')     { lx = 1080 - padding - logoWidth; ly = padding }
    else if (logoPosition === 'bottom-center') { lx = 540 - logoWidth / 2; ly = 1080 - padding - logoSize }
    else if (logoPosition === 'bottom-right')  { lx = 1080 - padding - logoWidth; ly = 1080 - padding - logoSize }
    else                                       { lx = padding; ly = 1080 - padding - logoSize }
  }

  const cta = params.cta
  const fontFaces: string[] = []
  const seenFontData = new Set<string>()
  const addFontFace = (name: string | null, dataUrl: string | null, httpUrl?: string | null) => {
    if (!name) return
    const key = httpUrl || dataUrl
    if (!key || seenFontData.has(key)) return
    seenFontData.add(key)
    const alias = normalizeFontAlias(name)
    if (httpUrl) {
      // HTTP URL: Figma can fetch it, so use it as primary src with base64 fallback
      const src = dataUrl?.startsWith('data:')
        ? `url('${httpUrl}'),url('${dataUrl}')`
        : `url('${httpUrl}')`
      fontFaces.push(`@font-face{font-family:'${name}';src:${src};font-weight:100 900;}`)
      // Alias with normalized hyphenated name so Figma matches the font-family stack
      // e.g. 'INDUSTRY BOLD' → 'Industry-Bold' which appears first in the font-family attribute
      if (alias) fontFaces.push(`@font-face{font-family:'${alias}';src:${src};font-weight:100 900;}`)
    } else if (dataUrl?.startsWith('data:')) {
      // Base64 only: works in browser (Puppeteer), not in Figma
      fontFaces.push(`@font-face{font-family:'${name}';src:url('${dataUrl}');font-weight:100 900;}`)
      if (alias) fontFaces.push(`@font-face{font-family:'${alias}';src:url('${dataUrl}');font-weight:100 900;}`)
    }
  }
  addFontFace(params.customFontName as string | null, params.customFontDataUrl as string | null, params.customFontUrl as string | null)
  addFontFace(params.headlineCustomFontName as string | null ?? params.headlineFontFamily as string | null, params.headlineCustomFontDataUrl as string | null, params.headlineCustomFontUrl as string | null)
  addFontFace(params.microcopyCustomFontName as string | null ?? params.microcopyFontFamily as string | null, params.microcopyCustomFontDataUrl as string | null, params.microcopyCustomFontUrl as string | null)
  if (cta) {
    const ctaR = cta as unknown as Record<string, unknown>
    addFontFace(ctaR.customFontName as string | null ?? cta.fontFamily as string | null, ctaR.customFontDataUrl as string | null, ctaR.customFontUrl as string | null)
  }

  const headlineFontName = (params.headlineCustomFontName as string | null) || (params.headlineFontFamily as string | null) || (params.customFontName as string | null) || fontFamily
  const microcopyFontName = (params.microcopyCustomFontName as string | null) || (params.microcopyFontFamily as string | null) || (params.customFontName as string | null) || fontFamily
  const ctaFontName = ((cta as unknown as Record<string, unknown>)?.customFontName as string | null) || (cta?.fontFamily as string | null) || fontFamily

  const headlineFigmaFont = getFigmaFontFamily(headlineFontName, 900)
  const microcopyFigmaFont = getFigmaFontFamily(microcopyFontName, 400)
  const ctaFigmaFont = getFigmaFontFamily(ctaFontName, 700)

  // Google Fonts @import for known standard fonts
  const googleImports: string[] = []
  const seenGoogleFonts = new Set<string>()
  const maybeAddGoogleFont = (name: string) => {
    const clean = name.trim().replace(/['"]/g, '')
    const match = GOOGLE_FONTS.find(f => clean.toLowerCase().startsWith(f.toLowerCase()))
    if (match && !seenGoogleFonts.has(match)) {
      seenGoogleFonts.add(match)
      googleImports.push(`@import url('https://fonts.googleapis.com/css2?family=${match.replace(/\s+/g, '+')}:wght@400;500;700;800;900&display=swap');`)
    }
  }
  maybeAddGoogleFont(headlineFontName)
  maybeAddGoogleFont(microcopyFontName)
  maybeAddGoogleFont(ctaFontName)
  // Always include Inter for fallback
  if (!seenGoogleFonts.has('Inter')) googleImports.push(`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');`)

  const cssClasses = `
      text { user-select: none; -webkit-user-select: none; }
      .post-headline { font-family: ${headlineFigmaFont}; font-weight: 900; }
      .post-microcopy { font-family: ${microcopyFigmaFont}; font-weight: 400; }
      .post-cta { font-family: ${ctaFigmaFont}; font-weight: 700; }`

  const lines: string[] = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1080" viewBox="0 0 1080 1080">`)
  const styleContent = [...googleImports, ...fontFaces, cssClasses].join('\n      ')
  lines.push(`  <defs><style>${styleContent}</style></defs>`)

  type Elem = { dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex?: number }
  const elements: Elem[] = (params.elements as Elem[] | null) || []

  const elementsWithSize = await Promise.all(elements.map(async el => {
    const { nw, nh } = await getImageNaturalSize(el.dataUrl)
    const height = nw > 0 ? Math.round((el.width / nw) * nh) : el.width
    return { ...el, height }
  }))

  // Background is always the bottom-most layer
  if (bgBase64) {
    lines.push(`  <image href="${bgBase64}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice"/>`)
  }

  // Elements with zIndex < 0 sit between the main bg and the subject cutout (mirrors HTML z-index:0 under subject's z-index:1)
  for (const el of elementsWithSize) {
    if ((el.zIndex ?? 1) >= 0) continue
    const opacityAttr = el.opacity != null && el.opacity !== 100 ? ` opacity="${(el.opacity / 100).toFixed(2)}"` : ''
    lines.push(`  <image href="${el.dataUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMinYMin meet"${opacityAttr}/>`)
  }

  // Subject image (bg-removed generated image) — above main bg and negative-zIndex elements, below text
  const subjectDataUrl = params.subjectImageDataUrl as string | null | undefined
  if (subjectDataUrl) {
    lines.push(`  <image href="${subjectDataUrl}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice"/>`)
  }

  // Build a flat list of every layer with its effective z-index, then sort and render in one pass.
  // Negative-zIndex elements are already rendered above; skip them here.
  type LayerEntry =
    | { kind: 'element'; el: typeof elementsWithSize[0]; z: number; seq: number }
    | { kind: 'headline'; z: number; seq: number }
    | { kind: 'microcopy'; z: number; seq: number }
    | { kind: 'cta'; z: number; seq: number }
    | { kind: 'logo'; z: number; seq: number }

  const layers: LayerEntry[] = []
  let seq = 0

  for (const el of elementsWithSize) {
    const rawZ = el.zIndex ?? 1
    if (rawZ < 0) continue  // already rendered between bg and subject
    layers.push({ kind: 'element', el, z: rawZ, seq: seq++ })
  }
  if (params.headline)  layers.push({ kind: 'headline',  z: 2,  seq: seq++ })
  if (params.microcopy) layers.push({ kind: 'microcopy', z: 2,  seq: seq++ })
  if (cta?.text)        layers.push({ kind: 'cta',       z: 3,  seq: seq++ })
  if (logoBase64)       layers.push({ kind: 'logo',      z: 10, seq: seq++ })

  // Stable sort: z-index first, original insertion order breaks ties
  layers.sort((a, b) => a.z !== b.z ? a.z - b.z : a.seq - b.seq)

  for (const layer of layers) {
    if (layer.kind === 'element') {
      const el = layer.el
      const opacityAttr = el.opacity != null && el.opacity !== 100 ? ` opacity="${(el.opacity / 100).toFixed(2)}"` : ''
      lines.push(`  <image href="${el.dataUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMinYMin meet"${opacityAttr}/>`)
    }

    if (layer.kind === 'headline') {
      const x = txOffset ?? hx
      hlLines.forEach((line, i) => {
        lines.push(accentedTextSvg(line, accentedWords, {
          x, y: Math.round(hy + i * hlLineH),
          fontFamily: headlineFigmaFont, fontSize: headlineSize, fontWeight: 900,
          fill: headlineColor, accentFill: textAccentColor, anchor,
          extraStyle: ' font-weight: 900;',
        }))
      })
    }

    if (layer.kind === 'microcopy') {
      const x = txOffset ?? mx
      mcLines.forEach((line, i) => {
        lines.push(accentedTextSvg(line, noAccent, {
          x, y: Math.round(my + i * mcLineH),
          fontFamily: microcopyFigmaFont, fontSize: microcopySize, fontWeight: 400,
          fill: microcopyColor, accentFill: textAccentColor, anchor,
        }))
      })
    }

    if (layer.kind === 'cta') {
      const ctaH = (params.ctaHeight as number | null) ?? Math.round(cta!.paddingY * 2 + cta!.fontSize * 1.4)
      const ctaW = (params.ctaWidth as number | null) ?? Math.round(cta!.text.length * cta!.fontSize * 0.6 + cta!.paddingX * 2)
      // Clamp rx to half the smaller dimension — matches browser behaviour and prevents Figma from rendering an oval
      const ctaRx = Math.min(cta!.borderRadius ?? 9999, Math.floor(Math.min(ctaW, ctaH) / 2))
      const ctaAlign = (cta as unknown as Record<string, unknown>).align as string | undefined
      let cx: number
      if (ctaAlign === 'center') cx = Math.round((1080 - ctaW) / 2)
      else if (ctaAlign === 'right') cx = 1080 - padding - ctaW
      else cx = cta!.x
      const cy = cta!.y
      lines.push(`  <rect x="${cx}" y="${cy}" width="${ctaW}" height="${ctaH}" rx="${ctaRx}" fill="${cta!.bgColor}"/>`)
      const ctaTextX = Math.round(cx + ctaW / 2)
      const ctaTextY = Math.round(cy + ctaH / 2 + cta!.fontSize * 0.38)
      lines.push(`  <text class="post-cta" x="${ctaTextX}" y="${ctaTextY}" font-family="${ctaFigmaFont}" font-size="${cta!.fontSize}" font-weight="700" fill="${cta!.textColor}" text-anchor="middle" style="font-family: ${ctaFigmaFont}; font-weight: 700; font-size: ${cta!.fontSize}px; fill: ${cta!.textColor};">${escXml(cta!.text)}</text>`)
    }

    if (layer.kind === 'logo') {
      lines.push(`  <image href="${logoBase64}" x="${Math.round(lx)}" y="${Math.round(ly)}" width="${logoWidth}" height="${logoSize}" preserveAspectRatio="xMinYMid meet"/>`)
    }
  }

  lines.push(`</svg>`)
  return lines.join('\n')
}

// ── Carousel V2 SVG Export ────────────────────────────────────────────────────

export interface CarouselSlideInput {
  bgImageDataUrl: string
  logoDataUrl?: string | null
  eyebrow?: string | null
  carouselTitle?: string | null
  headline?: string | null
  subhead?: string | null
  bullets?: string[]
  ctaText?: string | null
  slideType?: string | null
  primaryColor: string
  accentColor?: string | null
  textColor?: string | null
  microcopyColor?: string | null
  splitPercent?: number | null
  padding?: number | null
  verticalAlign?: string | null
  fontFamily?: string | null
  customFontDataUrl?: string | null
  customFontUrl?: string | null
  headlineFontFamily?: string | null
  headlineCustomFontDataUrl?: string | null
  headlineCustomFontUrl?: string | null
  eyebrowFontFamily?: string | null
  eyebrowCustomFontDataUrl?: string | null
  eyebrowCustomFontUrl?: string | null
  microcopyFontFamily?: string | null
  microcopyCustomFontDataUrl?: string | null
  microcopyCustomFontUrl?: string | null
  bulletFontFamily?: string | null
  bulletCustomFontDataUrl?: string | null
  bulletCustomFontUrl?: string | null
  ctaFontFamily?: string | null
  ctaCustomFontDataUrl?: string | null
  ctaCustomFontUrl?: string | null
  headlineSize?: number | null
  microcopySize?: number | null
  bulletSize?: number | null
  eyebrowSize?: number | null
  logoPosition?: string | null
  logoX?: number | null
  logoY?: number | null
  logoSize?: number | null
  ctaStyle?: {
    bgColor?: string; textColor?: string; fontSize?: number
    paddingX?: number; paddingY?: number; borderRadius?: number
  } | null
  ctaPosition?: string | null
  elements?: Array<{ dataUrl: string; x: number; y: number; width: number; height: number; opacity: number; zIndex?: number }>
  textX?: number | null
  textY?: number | null
  headlineX?: number | null
  headlineY?: number | null
  microcopyX?: number | null
  microcopyY?: number | null
  eyebrowX?: number | null
  eyebrowY?: number | null
  bulletsX?: number | null
  bulletsY?: number | null
  eyebrowGap?: number | null
  headlineGap?: number | null
  subheadGap?: number | null
  eyebrowColor?: string | null
  accentBgEnabled?: boolean | null
  accentBgColor?: string | null
  accentBgPadding?: number | null
  accentBgRadius?: number | null
}

function buildCarouselSlideSVGContent(
  slide: CarouselSlideInput,
  logoWidth: number,
  fontFaces: string[],
  seenFontData: Set<string>
): string {
  const isCta = slide.slideType === 'cta'
  const isTitle = slide.slideType === 'title'
  const sp = slide.splitPercent ?? (isCta ? 80 : isTitle ? 65 : 50)
  const pad = slide.padding ?? 60
  const tc = slide.textColor ?? '#ffffff'
  const ac = slide.accentColor ?? '#3b82f6'
  const mc = slide.microcopyColor ?? tc
  const ls = slide.logoSize ?? 48
  const accentBg = slide.accentBgEnabled && slide.accentBgColor
    ? { color: slide.accentBgColor, padding: slide.accentBgPadding ?? 4, radius: slide.accentBgRadius ?? 2 }
    : undefined

  const font = slide.fontFamily ?? 'Inter'
  const hFont = slide.headlineFontFamily ?? font
  const eFont = slide.eyebrowFontFamily ?? font
  const mFont = slide.microcopyFontFamily ?? font
  const bFont = slide.bulletFontFamily ?? font
  const cFont = slide.ctaFontFamily ?? font

  const eSize = slide.eyebrowSize ?? 14
  const hSize = slide.headlineSize ?? (isCta ? 72 : 52)
  const mSize = slide.microcopySize ?? (isCta ? 28 : 20)
  const bSize = slide.bulletSize ?? 18

  const addFace = (name: string, dataUrl: string | null | undefined, httpUrl?: string | null) => {
    const key = httpUrl || dataUrl
    if (!key || seenFontData.has(key)) return
    seenFontData.add(key)
    const alias = normalizeFontAlias(name)
    if (httpUrl) {
      const src = dataUrl?.startsWith('data:') ? `url('${httpUrl}'),url('${dataUrl}')` : `url('${httpUrl}')`
      fontFaces.push(`@font-face{font-family:'${name}';src:${src};font-weight:100 900;}`)
      if (alias) fontFaces.push(`@font-face{font-family:'${alias}';src:${src};font-weight:100 900;}`)
    } else if (dataUrl?.startsWith('data:')) {
      fontFaces.push(`@font-face{font-family:'${name}';src:url('${dataUrl}');font-weight:100 900;}`)
      if (alias) fontFaces.push(`@font-face{font-family:'${alias}';src:url('${dataUrl}');font-weight:100 900;}`)
    }
  }
  addFace(font,  slide.customFontDataUrl,      slide.customFontUrl)
  addFace(hFont, slide.headlineCustomFontDataUrl, slide.headlineCustomFontUrl)
  addFace(eFont, slide.eyebrowCustomFontDataUrl,  slide.eyebrowCustomFontUrl)
  addFace(mFont, slide.microcopyCustomFontDataUrl, slide.microcopyCustomFontUrl)
  addFace(bFont, slide.bulletCustomFontDataUrl,   slide.bulletCustomFontUrl)
  addFace(cFont, slide.ctaCustomFontDataUrl,      slide.ctaCustomFontUrl)

  const hFigma = getFigmaFontFamily(hFont, 500)
  const eFigma = getFigmaFontFamily(eFont, 400)
  const mFigma = getFigmaFontFamily(mFont, 400)
  const bFigma = getFigmaFontFamily(bFont, 400)
  const cFigma = getFigmaFontFamily(cFont, 500)

  const elems: string[] = []

  if (slide.bgImageDataUrl) {
    elems.push(`    <image href="${slide.bgImageDataUrl}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice"/>`)
  }

  const renderElems = (zFilter: (z: number) => boolean) => {
    for (const el of (slide.elements ?? [])) {
      if (!zFilter(el.zIndex ?? 1)) continue
      const opAttr = el.opacity != null && el.opacity !== 100 ? ` opacity="${(el.opacity / 100).toFixed(2)}"` : ''
      elems.push(`    <image href="${el.dataUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMinYMin meet"${opAttr}/>`)
    }
  }
  renderElems(z => z <= 1)
  renderElems(z => z > 1)

  const textZoneW = isCta ? 700 : Math.round(sp / 100 * 1080 - 2 * pad)
  // textContentX: left edge where text glyphs start (inside the container + padding)
  const hasAbsPos = slide.textX != null && slide.textY != null
  const textContentX = isCta
    ? Math.round((1080 - 700) / 2)
    : hasAbsPos ? (slide.textX! + pad) : pad

  const stripBold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1')

  const accentWordSet = new Set<string>()
  const accentSrc = `${slide.headline || ''}`
  const accentRe2 = /\*\*(.+?)\*\*/g
  let accentM2: RegExpExecArray | null
  while ((accentM2 = accentRe2.exec(accentSrc)) !== null)
    accentM2[1].split(/\s+/).filter(Boolean).forEach(w => accentWordSet.add(w))
  const noAccentSet = new Set<string>()

  const eyebrowText = isCta ? null : (slide.eyebrow
    ? slide.eyebrow.charAt(0).toUpperCase() + slide.eyebrow.slice(1).toLowerCase()
    : (slide.carouselTitle || null))

  const eyebrowGap = slide.eyebrowGap ?? 16
  const headlineGap = slide.headlineGap ?? 20
  const subheadGap = slide.subheadGap ?? 28
  const bulletGap = 16
  const hLines = slide.headline ? wrapText(stripBold(slide.headline), textZoneW, hSize, 500) : []
  const mLines = slide.subhead  ? wrapText(stripBold(slide.subhead),  textZoneW, mSize, 400) : []

  let curY: number
  if (hasAbsPos) {
    // Template has an explicit text block position — use it directly
    curY = slide.textY! + pad
  } else {
    let totalH = 0
    if (eyebrowText)         totalH += eSize * 1.4 + eyebrowGap
    if (hLines.length)       totalH += hSize * 1.1 * hLines.length + headlineGap
    if (mLines.length)       totalH += mSize * 1.5 * mLines.length + subheadGap
    if (slide.bullets?.length) {
      for (const b of slide.bullets)
        totalH += bSize * 1.5 * wrapText(stripBold(b), textZoneW - 20, bSize, 400).length + bulletGap
    }
    const vAlign = slide.verticalAlign ?? 'center'
    curY = Math.round(
      vAlign === 'top'    ? pad :
      vAlign === 'bottom' ? 1080 - pad - totalH :
      (1080 - totalH) / 2
    )
  }

  if (eyebrowText) {
    const ec = slide.eyebrowColor || ac
    const ex = slide.eyebrowX ?? textContentX
    const ey = slide.eyebrowY != null ? slide.eyebrowY + eSize : Math.round(curY + eSize)
    elems.push(`    <text x="${ex}" y="${Math.round(ey)}" font-family="${eFigma}" font-size="${eSize}" font-weight="400" fill="${ec}" style="font-family: ${eFigma}; font-size: ${eSize}px; fill: ${ec};">${escXml(eyebrowText)}</text>`)
    if (slide.eyebrowX == null || slide.eyebrowY == null) curY += Math.round(eSize * 1.4 + eyebrowGap)
  }

  {
    const hx = slide.headlineX ?? textContentX
    let hy = slide.headlineY != null ? slide.headlineY : curY
    hLines.forEach(line => {
      elems.push(accentedTextSvg(line, accentWordSet, {
        x: hx, y: Math.round(hy + hSize),
        fontFamily: hFigma, fontSize: hSize, fontWeight: 500,
        fill: tc, accentFill: ac, anchor: 'start',
        accentBg,
      }).replace(/^  /, '    '))
      hy += Math.round(hSize * 1.1)
    })
    if (hLines.length && (slide.headlineX == null || slide.headlineY == null)) curY = hy + headlineGap
  }

  {
    const mx = slide.microcopyX ?? textContentX
    let my = slide.microcopyY != null ? slide.microcopyY : curY
    mLines.forEach(line => {
      elems.push(accentedTextSvg(line, noAccentSet, {
        x: mx, y: Math.round(my + mSize),
        fontFamily: mFigma, fontSize: mSize, fontWeight: 400,
        fill: mc, accentFill: ac, anchor: 'start',
        extraStyle: ' opacity: 0.85;',
        accentBg,
      }).replace(/^  /, '    '))
      my += Math.round(mSize * 1.5)
    })
    if (mLines.length && (slide.microcopyX == null || slide.microcopyY == null)) curY = my + subheadGap
  }

  if (slide.bullets?.length) {
    const bx = slide.bulletsX ?? textContentX
    let by = slide.bulletsY != null ? slide.bulletsY : curY
    for (const bullet of slide.bullets) {
      const bLines = wrapText(stripBold(bullet), textZoneW - 20, bSize, 400)
      bLines.forEach((line, i) => {
        if (i === 0) elems.push(`    <circle cx="${bx + 4}" cy="${Math.round(by + bSize * 0.35)}" r="4" fill="${ac}"/>`)
        elems.push(`    <text x="${bx + 20}" y="${Math.round(by + bSize)}" font-family="${bFigma}" font-size="${bSize}" font-weight="400" fill="${mc}" style="font-family: ${bFigma}; font-size: ${bSize}px; fill: ${mc};">${escXml(line)}</text>`)
        by += Math.round(bSize * 1.5)
      })
      by += bulletGap
    }
    if (slide.bulletsX == null || slide.bulletsY == null) curY = by
  }

  if (isCta && slide.ctaText && slide.ctaStyle) {
    const cs = slide.ctaStyle
    const cfSize = cs.fontSize ?? 14
    const cpX = cs.paddingX ?? 36
    const cpY = cs.paddingY ?? 18
    const cBg  = cs.bgColor ?? '#ffffff'
    const cTc  = cs.textColor ?? slide.primaryColor
    const cBtnW = Math.round(slide.ctaText.length * cfSize * 0.6 + cpX * 2)
    const cBtnH = Math.round(cpY * 2 + cfSize * 1.5)
    const cBR = Math.min(cs.borderRadius ?? 4, Math.floor(Math.min(cBtnW, cBtnH) / 2))
    const ctaPos = slide.ctaPosition ?? 'center'
    const cBtnX = ctaPos.endsWith('right') ? 1080 - pad - cBtnW
      : ctaPos.endsWith('left') ? pad : Math.round((1080 - cBtnW) / 2)
    const cBtnY = ctaPos.startsWith('top') ? pad
      : ctaPos.startsWith('bottom') ? 1080 - pad - cBtnH
      : 1080 - pad * 3 - cBtnH
    elems.push(`    <rect x="${cBtnX}" y="${cBtnY}" width="${cBtnW}" height="${cBtnH}" rx="${cBR}" fill="${cBg}"/>`)
    elems.push(`    <text x="${Math.round(cBtnX + cBtnW / 2)}" y="${Math.round(cBtnY + cBtnH / 2 + cfSize * 0.38)}" font-family="${cFigma}" font-size="${cfSize}" font-weight="500" fill="${cTc}" text-anchor="middle" style="font-family: ${cFigma}; font-size: ${cfSize}px; fill: ${cTc};">${escXml(slide.ctaText)}</text>`)
  }

  if (slide.logoDataUrl) {
    let lx: number, ly: number
    if (slide.logoX != null && slide.logoY != null) {
      lx = slide.logoX; ly = slide.logoY
    } else {
      const lp = slide.logoPosition ?? 'bottom-left'
      const lw = logoWidth
      if (lp === 'top-left')           { lx = pad;                          ly = pad }
      else if (lp === 'top-center')    { lx = Math.round(540 - lw / 2);     ly = pad }
      else if (lp === 'top-right')     { lx = 1080 - pad - lw;              ly = pad }
      else if (lp === 'bottom-center') { lx = Math.round(540 - lw / 2);     ly = 1080 - pad - ls }
      else if (lp === 'bottom-right')  { lx = 1080 - pad - lw;              ly = 1080 - pad - ls }
      else                             { lx = pad;                           ly = 1080 - pad - ls }
    }
    elems.push(`    <image href="${slide.logoDataUrl}" x="${Math.round(lx)}" y="${Math.round(ly)}" width="${logoWidth}" height="${ls}" preserveAspectRatio="xMinYMid meet"/>`)
  }

  return elems.join('\n')
}

export async function buildAllCarouselSVG(slides: CarouselSlideInput[]): Promise<string> {
  if (!slides.length) return ''

  const fontFaces: string[] = []
  const seenFontData = new Set<string>()
  const googleImports: string[] = []
  const seenGoogleFonts = new Set<string>()

  const maybeAddGoogleFont = (name: string) => {
    const clean = name.trim().replace(/['"]/g, '')
    const match = GOOGLE_FONTS.find(f => clean.toLowerCase().startsWith(f.toLowerCase()))
    if (match && !seenGoogleFonts.has(match)) {
      seenGoogleFonts.add(match)
      googleImports.push(`@import url('https://fonts.googleapis.com/css2?family=${match.replace(/\s+/g, '+')}:wght@400;500;700;800;900&display=swap');`)
    }
  }
  for (const slide of slides) {
    const font = slide.fontFamily ?? 'Inter'
    ;[slide.headlineFontFamily, slide.microcopyFontFamily, slide.eyebrowFontFamily, slide.bulletFontFamily, slide.ctaFontFamily, font]
      .filter(Boolean).forEach(f => maybeAddGoogleFont(f!))
  }
  if (!seenGoogleFonts.has('Inter')) googleImports.push(`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');`)

  // Pre-process elements: convert HTTP URLs to base64, compute natural heights
  const processedSlides = await Promise.all(slides.map(async slide => {
    // Fetch HTTP logo URLs to base64 first, then rasterize SVGs to PNG
    let rawLogo = slide.logoDataUrl ?? null
    if (rawLogo && !rawLogo.startsWith('data:')) {
      try { rawLogo = await urlToBase64(rawLogo) } catch { /* keep original */ }
    }
    const logoDataUrl = rawLogo ? await ensurePngDataUrl(rawLogo, 512) : slide.logoDataUrl
    if (!slide.elements?.length) return { ...slide, logoDataUrl }
    const elements = await Promise.all(slide.elements.map(async el => {
      let dataUrl = el.dataUrl
      if (dataUrl && !dataUrl.startsWith('data:')) {
        try { dataUrl = await urlToBase64(dataUrl) } catch { /* keep original */ }
      }
      let height = el.height
      if (!height) {
        const { nw, nh } = dataUrl ? await getImageNaturalSize(dataUrl) : { nw: 0, nh: 0 }
        height = nw > 0 ? Math.round((el.width / nw) * nh) : el.width
      }
      return { ...el, dataUrl, height }
    }))
    return { ...slide, logoDataUrl, elements }
  }))

  // Compute logo width per slide — each slide may use a different logo with a different aspect ratio
  const slideContents = await Promise.all(processedSlides.map(async slide => {
    const ls = slide.logoSize ?? 48
    const logo = typeof slide.logoDataUrl === 'string' && slide.logoDataUrl ? slide.logoDataUrl : null
    const { nw, nh } = logo ? await getImageNaturalSize(logo) : { nw: 0, nh: 0 }
    const slideLogoWidth = nh > 0 ? Math.round((ls / nh) * nw) : ls * 3
    return buildCarouselSlideSVGContent(slide, slideLogoWidth, fontFaces, seenFontData)
  }))

  const n = slides.length
  const svgLines: string[] = []
  svgLines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${1080 * n}" height="1080" viewBox="0 0 ${1080 * n} 1080">`)
  const styleContent = [...googleImports, ...fontFaces].join('\n      ')
  if (styleContent) svgLines.push(`  <defs><style>${styleContent}</style></defs>`)
  slideContents.forEach((content, i) => {
    svgLines.push(`  <g id="slide-${i + 1}" transform="translate(${i * 1080}, 0)">`)
    svgLines.push(content)
    svgLines.push(`  </g>`)
  })
  svgLines.push(`</svg>`)
  return svgLines.join('\n')
}
