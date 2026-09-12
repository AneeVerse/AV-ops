export interface TextFitOptions {
  text: string
  boundsW: number   // inches
  boundsH: number   // inches
  fontFamily: string
  fontSizePt: number
  fontWeight: 'normal' | 'bold'
  lineHeightMultiplier: number
  minFontSizePt?: number
  uppercase?: boolean
}

export interface TextFitResult {
  fittedSizePt: number
  lines: string[]
  overflows: boolean
}

let _canvas: OffscreenCanvas | null = null

export async function fitText(opts: TextFitOptions): Promise<TextFitResult> {
  try { await document.fonts.ready } catch { /* server-side */ }

  if (!_canvas) _canvas = new OffscreenCanvas(1, 1)
  const ctx = _canvas.getContext('2d')
  if (!ctx) return { fittedSizePt: opts.fontSizePt, lines: [opts.text], overflows: false }

  // AI-generated slide content isn't runtime-validated before reaching here — an
  // omitted "required" field (title/quote/stat/etc.) surfaces as undefined, not ''.
  const rawText = opts.text ?? ''
  const text = opts.uppercase ? rawText.toUpperCase() : rawText
  const widthPx  = opts.boundsW * 96   // 96 px/inch for text measurement
  const maxHPx   = opts.boundsH * 96
  const minSize  = opts.minFontSizePt ?? Math.max(opts.fontSizePt - 8, 6)

  let sizePt = opts.fontSizePt
  let lines: string[] = []
  let overflows = false

  while (sizePt >= minSize) {
    const sizePx = sizePt * (96 / 72)
    ctx.font = `${opts.fontWeight} ${sizePx}px "${opts.fontFamily}"`
    lines = wrapText(ctx, text, widthPx)
    const totalH = lines.length * sizePx * opts.lineHeightMultiplier
    if (totalH <= maxHPx) { overflows = false; break }
    sizePt--
    if (sizePt < minSize) { overflows = true; break }
  }

  return { fittedSizePt: sizePt, lines, overflows }
}

function wrapText(ctx: OffscreenCanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      if (!word) continue
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = word
      } else { line = test }
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : ['']
}
