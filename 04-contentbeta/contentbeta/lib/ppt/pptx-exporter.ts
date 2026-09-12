import type { ChartData, RenderPlan } from './types'

interface ParsedColor { color: string; alpha: number }
interface MediaDimensions { width: number; height: number }
interface Box { x: number; y: number; w: number; h: number }

function parsePptxColor(value: string): ParsedColor | null {
  const hex = value.trim().match(/^#?([0-9a-fA-F]{6})$/)
  if (hex) return { color: hex[1].toUpperCase(), alpha: 1 }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (!rgb) return null
  const channel = (input: string) => Math.max(0, Math.min(255, Math.round(Number(input))))
  const toHex = (input: string) => channel(input).toString(16).padStart(2, '0')
  return {
    color: `${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toUpperCase(),
    alpha: Math.max(0, Math.min(1, rgb[4] === undefined ? 1 : Number(rgb[4]))),
  }
}

function compositeTextColor(value: string, background: string): string {
  const fg = parsePptxColor(value)
  const bg = parsePptxColor(background) ?? { color: 'FFFFFF', alpha: 1 }
  if (!fg) return bg.color
  if (fg.alpha >= 1) return fg.color
  const f = [0, 2, 4].map(i => parseInt(fg.color.slice(i, i + 2), 16))
  const b = [0, 2, 4].map(i => parseInt(bg.color.slice(i, i + 2), 16))
  const neutral = Math.max(...f) - Math.min(...f) < 18
  if (neutral) {
    const bgLuminance = (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]) / 255
    return bgLuminance < 0.5 ? 'FFFFFF' : '000000'
  }
  return f
    .map((channel, i) => Math.round(channel * fg.alpha + b[i] * (1 - fg.alpha)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function parseSvgDimensions(svg: string): MediaDimensions | null {
  const viewBox = svg.match(/\bviewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i)
  if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) }
  const width = svg.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i)
  const height = svg.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i)
  return width && height ? { width: Number(width[1]), height: Number(height[1]) } : null
}

async function mediaDimensions(blob: Blob): Promise<MediaDimensions | null> {
  if (blob.type.includes('svg')) return parseSvgDimensions(await blob.text())
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (
    bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50
    && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue }
      const marker = bytes[offset + 1]
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3]
      if (length < 2) break
      if (
        (marker >= 0xc0 && marker <= 0xc3)
        || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb)
        || (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          height: (bytes[offset + 5] << 8) + bytes[offset + 6],
          width: (bytes[offset + 7] << 8) + bytes[offset + 8],
        }
      }
      offset += 2 + length
    }
  }
  return null
}

function containBox(box: Box, dimensions: MediaDimensions | null): Box {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return box
  const scale = Math.min(box.w / dimensions.width, box.h / dimensions.height)
  const w = dimensions.width * scale
  const h = dimensions.height * scale
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

function normalizedMediaBox(dimensions: MediaDimensions): { w: number; h: number } {
  const ratio = dimensions.width / dimensions.height
  return ratio >= 1
    ? { w: ratio, h: 1 }
    : { w: 1, h: 1 / ratio }
}

function keynoteSafeFont(value: string): string {
  const requested = value.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  const safeFonts = new Map([
    ['arial', 'Arial'],
    ['courier new', 'Courier New'],
    ['georgia', 'Georgia'],
    ['times new roman', 'Times New Roman'],
    ['trebuchet ms', 'Trebuchet MS'],
    ['verdana', 'Verdana'],
  ])
  return safeFonts.get(requested.toLowerCase()) ?? 'Arial'
}

function keynoteTextSize(
  content: string,
  fontFace: string,
  sizePt: number,
  fontWeight: 'normal' | 'bold',
  widthInches: number,
): number {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return sizePt
    context.font = `${fontWeight === 'bold' ? '700' : '400'} ${sizePt * (96 / 72)}px "${fontFace}"`
    const widest = Math.max(
      ...content.split('\n').map(line => context.measureText(line).width),
      0,
    )
    const available = widthInches * 96
    return widest > available
      ? Math.max(6, sizePt * (available / widest) * 0.97)
      : sizePt
  } catch {
    return sizePt
  }
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isCompleteSvg(value?: string): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return /^<svg\b/i.test(trimmed) && /<\/svg>\s*$/i.test(trimmed)
}

function wrapSvgLabel(value: string, maxChars = 22): string[] {
  const words = String(value).trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars || !current) current = next
    else { lines.push(current); current = word }
  }
  if (current) lines.push(current)
  if (lines.length <= 2) return lines
  const second = lines.slice(1).join(' ')
  return [lines[0], `${second.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`]
}

function polarPoint(centerX: number, centerY: number, radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  }
}

function doughnutSegmentPath(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarPoint(centerX, centerY, outerRadius, startAngle)
  const outerEnd = polarPoint(centerX, centerY, outerRadius, endAngle)
  const innerEnd = polarPoint(centerX, centerY, innerRadius, endAngle)
  const innerStart = polarPoint(centerX, centerY, innerRadius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function chartToSvg(chart: ChartData, width: number, height: number): string {
  const colors = (
    chart.segmentColors?.length
      ? chart.segmentColors
      : [chart.primaryColor, ...chart.accentColors]
  ).filter(Boolean)
  const textColor = chart.textColor || '#111111'
  const headlineFont = escapeXml(chart.headlineFont || 'Arial')
  const bodyFont = escapeXml(chart.bodyFont || 'Arial')

  if (chart.type === 'doughnut') {
    const values = (chart.series[0]?.values ?? []).map(Number)
    const total = values.reduce((sum, value) => sum + value, 0) || 1
    const radius = Math.min(width * 0.22, height * 0.30)
    const centerX = width * 0.34
    const centerY = height * 0.50
    const strokeWidth = radius * 0.38
    const innerRadius = radius - strokeWidth / 2
    const outerRadius = radius + strokeWidth / 2
    const valueFont = Math.max(12, Math.round(height * 0.040))
    const labelFont = Math.max(9, Math.round(height * 0.032))
    const legendX = width * 0.62
    const legendRowH = Math.max(labelFont * 2.15, (height * 0.82) / Math.max(chart.categories.length, 1))
    const inferredSuffix =
      chart.unitSuffix ??
      (String(chart.centerValue ?? '').includes('%') || Math.abs(total - 100) < 0.5 ? '%' : '')
    let currentAngle = -90

    const arcs = values.map((value, index) => {
      const portion = value / total
      const span = portion * 360
      const start = currentAngle
      const end = currentAngle + span
      currentAngle = end
      const color = escapeXml(colors[index % colors.length] || chart.primaryColor)
      if (span >= 359.9) {
        return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`
      }
      const gap = Math.min(1.2, span * 0.18)
      return `<path d="${doughnutSegmentPath(centerX, centerY, outerRadius, innerRadius, start + gap / 2, end - gap / 2)}" fill="${color}"/>`
    }).join('')

    const centerLabelLines = chart.centerLabel ? wrapSvgLabel(chart.centerLabel, 18) : []
    const centerLabel = centerLabelLines.map((line, index) =>
      `<tspan x="${centerX}" dy="${index === 0 ? 0 : labelFont * 1.05}">${escapeXml(line)}</tspan>`
    ).join('')
    const legend = chart.showLegend === false ? '' : chart.categories.map((category, index) => {
      const dot = Math.max(7, Math.round(labelFont * 0.72))
      const verticalCenter = height * 0.09 + index * legendRowH + legendRowH / 2
      const labelLines = wrapSvgLabel(category)
      const labelX = legendX + dot + 10
      const lineGap = labelFont * 1.08
      const firstLineY = verticalCenter - ((labelLines.length - 1) * lineGap) / 2 + labelFont * 0.36
      const label = labelLines.map((line, lineIndex) =>
        `<tspan x="${labelX}" dy="${lineIndex === 0 ? 0 : lineGap}">${escapeXml(line)}</tspan>`
      ).join('')
      return `<g><rect x="${legendX}" y="${verticalCenter - dot / 2}" width="${dot}" height="${dot}" rx="2" fill="${escapeXml(colors[index % colors.length] || chart.primaryColor)}"/><text x="${labelX}" y="${firstLineY}" fill="${escapeXml(textColor)}" font-size="${labelFont}" font-family="${bodyFont}">${label}</text><text x="${width * 0.98}" y="${verticalCenter + labelFont * 0.36}" text-anchor="end" fill="${escapeXml(textColor)}" font-size="${labelFont}" font-weight="700" font-family="${headlineFont}">${escapeXml(values[index] !== undefined ? `${values[index]}${inferredSuffix}` : '')}</text></g>`
    }).join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${escapeXml(textColor)}" stroke-opacity="0.09" stroke-width="${strokeWidth}"/>${arcs}${chart.centerValue ? `<text x="${centerX}" y="${centerY - valueFont * 0.05}" text-anchor="middle" fill="${escapeXml(textColor)}" font-size="${valueFont * 1.7}" font-weight="700" font-family="${headlineFont}">${escapeXml(chart.centerValue)}</text>` : ''}${centerLabel ? `<text x="${centerX}" y="${centerY + valueFont * 1.15}" text-anchor="middle" fill="${escapeXml(textColor)}" fill-opacity="0.65" font-size="${labelFont * 0.88}" font-family="${bodyFont}">${centerLabel}</text>` : ''}${legend}</svg>`
  }

  const series = chart.series.length > 0 ? chart.series : [{ name: '', values: [], color: chart.primaryColor }]
  const values = series.flatMap(item => item.values.map(Number))
  const rawMax = Math.max(...values, 0)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax || 1)))
  const niceMax = Math.ceil((rawMax * 1.15) / magnitude) * magnitude || 1
  const labelFont = Math.max(9, Math.round(height * 0.032))
  const axisFont = Math.max(8, Math.round(height * 0.026))
  const valueFont = Math.max(10, Math.round(height * 0.040))
  const hasLegend = series.length > 1 && series.some(item => item.name)
  const padLeft = width * 0.07
  const padRight = width * 0.03
  const padTop = height * (hasLegend ? 0.19 : 0.12)
  const padBottom = height * 0.18
  const chartWidth = width - padLeft - padRight
  const chartHeight = height - padTop - padBottom
  const categoryCount = Math.max(chart.categories.length, 1)
  const groupWidth = chartWidth / categoryCount
  const innerWidth = groupWidth * 0.78
  const barGap = Math.min(innerWidth * 0.06, 7)
  const barWidth = Math.min(
    (innerWidth - barGap * (series.length - 1)) / Math.max(series.length, 1),
    width * 0.09,
  )
  const grid = [0.25, 0.5, 0.75, 1].map(fraction => {
    const y = padTop + chartHeight * (1 - fraction)
    const value = Math.round(niceMax * fraction)
    return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="${escapeXml(textColor)}" stroke-opacity="0.10"/><text x="${padLeft - 8}" y="${y + axisFont * 0.36}" text-anchor="end" fill="${escapeXml(textColor)}" fill-opacity="0.55" font-size="${axisFont}" font-family="${bodyFont}">${value}${escapeXml(chart.unitSuffix ?? '')}</text>`
  }).join('')
  const legend = hasLegend ? series.map((item, index) => {
    const x = padLeft + index * width * 0.19
    const color = item.color || colors[index % colors.length] || chart.primaryColor
    return `<rect x="${x}" y="${height * 0.035}" width="${Math.max(8, labelFont * 0.72)}" height="${Math.max(8, labelFont * 0.72)}" rx="2" fill="${escapeXml(color)}"/><text x="${x + Math.max(8, labelFont * 0.72) + 8}" y="${height * 0.035 + labelFont * 0.72}" fill="${escapeXml(textColor)}" font-size="${labelFont}" font-family="${bodyFont}">${escapeXml(item.name)}</text>`
  }).join('') : ''
  const bars = chart.categories.map((category, categoryIndex) => {
    const groupX = padLeft + groupWidth * categoryIndex + (groupWidth - innerWidth) / 2
    const categoryBars = series.map((item, seriesIndex) => {
      const value = Number(item.values[categoryIndex] ?? 0)
      const barHeight = (value / niceMax) * chartHeight
      const x = groupX + seriesIndex * (barWidth + barGap)
      const y = padTop + chartHeight - barHeight
      const color = item.color || colors[seriesIndex % colors.length] || chart.primaryColor
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="${Math.min(5, barWidth * 0.12)}" fill="${escapeXml(color)}"/><text x="${x + barWidth / 2}" y="${Math.max(padTop + valueFont, y - 6)}" text-anchor="middle" fill="${escapeXml(textColor)}" font-size="${valueFont}" font-weight="700" font-family="${headlineFont}">${value}${escapeXml(chart.unitSuffix ?? '')}</text>`
    }).join('')
    const categoryLines = wrapSvgLabel(category, 14)
    const categoryText = categoryLines.map((line, lineIndex) =>
      `<tspan x="${padLeft + groupWidth * categoryIndex + groupWidth / 2}" dy="${lineIndex === 0 ? 0 : labelFont * 1.05}">${escapeXml(line)}</tspan>`
    ).join('')
    return `${categoryBars}<text x="${padLeft + groupWidth * categoryIndex + groupWidth / 2}" y="${padTop + chartHeight + labelFont * 1.35}" text-anchor="middle" fill="${escapeXml(textColor)}" font-size="${labelFont}" font-family="${bodyFont}">${categoryText}</text>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${legend}${grid}<line x1="${padLeft}" y1="${padTop + chartHeight}" x2="${width - padRight}" y2="${padTop + chartHeight}" stroke="${escapeXml(textColor)}" stroke-opacity="0.18"/>${bars}</svg>`
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function rasterizeSvg(
  svg: string,
  box: { w: number; h: number },
  sourceDimensions: MediaDimensions | null = null,
): Promise<{ dataUrl: string; dimensions: MediaDimensions }> {
  const source = sourceDimensions ?? parseSvgDimensions(svg) ?? { width: box.w, height: box.h }
  const ratio = source.width / source.height
  const longest = Math.max(256, Math.round(Math.max(box.w, box.h) * 192))
  const width = ratio >= 1 ? longest : Math.max(1, Math.round(longest * ratio))
  const height = ratio >= 1 ? Math.max(1, Math.round(longest / ratio)) : longest
  const image = new Image()
  image.decoding = 'async'
  const sourceUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('SVG rasterization failed'))
    image.src = sourceUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.drawImage(image, 0, 0, width, height)
  return {
    dataUrl: canvas.toDataURL('image/png'),
    dimensions: { width, height },
  }
}

export async function exportToPptx(plans: RenderPlan[], title: string): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'  // 13.33" × 7.5"

  for (const plan of plans) {
    const s = pptx.addSlide()
    s.background = { fill: plan.background.replace('#', '') }

    // PptxGenJS uses insertion order as z-order. The browser renderer uses the
    // resolved `z` value, so exporting the raw array can put a late image above
    // titles, labels, or charts and make that content appear to disappear.
    const orderedElements = plan.elements
      .map((element, index) => ({ element, index }))
      .sort((a, b) => a.element.z - b.element.z || a.index - b.index)
      .map(({ element }) => element)

    for (const el of orderedElements) {
      if (!el.visible) continue
      const { x, y, w, h } = el.bounds
      if (w <= 0 || h <= 0) continue

      if (el.type === 'rect' && el.style?.fill && el.style.fill !== 'transparent') {
        const fill = parsePptxColor(el.style.fill)
        if (fill) {
          const opacity = fill.alpha * (el.style.opacity ?? 1)
          s.addShape('rect', {
            x, y, w, h,
            fill: { color: fill.color, transparency: Math.round((1 - opacity) * 100) },
            line: { color: fill.color, width: 0 },
          })
        }
      }

      if (el.type === 'image' && el.assetId) {
        try {
          const resp = await fetch(el.assetId)
          if (!resp.ok) throw new Error(`Image request failed (${resp.status})`)
          const blob = await resp.blob()
          let dimensions = await mediaDimensions(blob)
          let dataUrl = await blobToDataUrl(blob)
          const fit = el.id.toLowerCase().includes('logo') ? 'contain' : (el.imageFit ?? 'cover')
          if (blob.type.includes('svg') || /\.svg(?:\?|#|$)/i.test(el.assetId)) {
            const raster = await rasterizeSvg(await blob.text(), { w, h }, dimensions)
            dataUrl = raster.dataUrl
            dimensions = raster.dimensions
          }
          if (fit === 'contain') {
            s.addImage({
              data: dataUrl,
              ...containBox({ x, y, w, h }, dimensions),
            })
          } else if (fit === 'cover' && dimensions) {
            // This PptxGenJS build calculates cover crop from the image object's
            // own w:h ratio. Passing the target box as both the image and sizing
            // box produces a 0% crop and stretches the bitmap. Give it a
            // normalized source ratio, then ask it to crop into the target box.
            const sourceBox = normalizedMediaBox(dimensions)
            s.addImage({
              data: dataUrl,
              x,
              y,
              ...sourceBox,
              sizing: { type: 'cover' as const, w, h },
            })
          } else {
            s.addImage({ data: dataUrl, x, y, w, h })
          }
        } catch (error) {
          console.error(`[pptx] Image "${el.id}" could not be embedded:`, error)
        }
      }

      if (el.type === 'chart' && el.chart) {
        const c = el.chart
        try {
          // Keynote imports editable OOXML charts through an embedded Excel
          // workbook and may report that workbook as an invalid file. Export the
          // same chart visual as a high-resolution PNG instead. This also keeps
          // chart labels and spacing identical to the browser renderer.
          const widthPx = Math.max(320, Math.round(w * 144))
          const heightPx = Math.max(220, Math.round(h * 144))
          const svg = isCompleteSvg(c.svgCode) ? c.svgCode : chartToSvg({
            ...c,
            textColor: `#${compositeTextColor(c.textColor, plan.background)}`,
          }, widthPx, heightPx)
          const sourceDimensions = parseSvgDimensions(svg) ?? { width: widthPx, height: heightPx }
          const raster = await rasterizeSvg(svg, { w, h }, sourceDimensions)
          s.addImage({
            data: raster.dataUrl,
            ...containBox({ x, y, w, h }, raster.dimensions),
          })
        } catch (error) {
          console.error(`[pptx] Chart "${el.id}" could not be rasterized:`, error)
        }
      }

      if (el.type === 'text' && el.text) {
        const t = el.text
        const content = t.lines?.join('\n') ?? t.content
        if (!content) continue
        const sizePt = t.fittedSizePt ?? t.fontSizePt
        if (t.color === 'transparent') continue
        const color = compositeTextColor(t.color, plan.background)
        const fontFace = keynoteSafeFont(t.fontFamily)
        const measuredSizePt = t.lines?.length
          ? keynoteTextSize(content, fontFace, sizePt, t.fontWeight, w)
          : sizePt
        const requestedFont = t.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
        const substitutedLargeTitle = t.lines?.length === 1
          && sizePt >= 24
          && requestedFont.toLowerCase() !== fontFace.toLowerCase()
        const exportSizePt = substitutedLargeTitle
          ? Math.min(measuredSizePt, sizePt * 0.92)
          : measuredSizePt
        try {
          s.addText(content, {
            x, y, w, h,
            fontSize: exportSizePt,
            color,
            fontFace,
            bold: t.fontWeight === 'bold',
            align: t.align,
            valign: t.verticalAlign === 'middle' ? 'middle' : t.verticalAlign === 'bottom' ? 'bottom' : 'top',
            wrap: !t.lines?.length,
            margin: 0,
          })
        } catch (error) {
          console.error(`[pptx] Text "${el.id}" could not be embedded:`, error)
        }
      }
    }
  }

  const safe = (title || 'presentation').replace(/[^a-z0-9\s\-_]/gi, '').trim() || 'presentation'
  await pptx.writeFile({ fileName: safe + '.pptx' })
}
