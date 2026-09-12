type Matrix = [number, number, number, number, number, number]

type RecorderState = {
  fillStyle: string | SvgGradient
  strokeStyle: string | SvgGradient
  globalAlpha: number
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  transform: Matrix
  clipId: string | null
}

type GradientStop = { offset: number; color: string }

class SvgGradient {
  readonly kind: 'linear' | 'radial'
  readonly args: number[]
  readonly stops: GradientStop[] = []

  constructor(kind: 'linear' | 'radial', args: number[]) {
    this.kind = kind
    this.args = args
  }

  addColorStop(offset: number, color: string) {
    this.stops.push({ offset: Math.max(0, Math.min(1, Number(offset))), color: String(color) })
  }
}

class RecordedPath {
  commands: string[] = []

  moveTo(x: number, y: number) { this.commands.push(`M ${num(x)} ${num(y)}`) }
  lineTo(x: number, y: number) { this.commands.push(`L ${num(x)} ${num(y)}`) }
  rect(x: number, y: number, w: number, h: number) {
    this.commands.push(`M ${num(x)} ${num(y)} H ${num(x + w)} V ${num(y + h)} H ${num(x)} Z`)
  }
  roundRect(x: number, y: number, w: number, h: number, radii: number | number[] = 0) {
    const raw = Array.isArray(radii) ? radii : [radii]
    const r = Math.max(0, Math.min(Math.abs(w) / 2, Math.abs(h) / 2, Number(raw[0]) || 0))
    this.commands.push(
      `M ${num(x + r)} ${num(y)} H ${num(x + w - r)} Q ${num(x + w)} ${num(y)} ${num(x + w)} ${num(y + r)}` +
      ` V ${num(y + h - r)} Q ${num(x + w)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)}` +
      ` H ${num(x + r)} Q ${num(x)} ${num(y + h)} ${num(x)} ${num(y + h - r)}` +
      ` V ${num(y + r)} Q ${num(x)} ${num(y)} ${num(x + r)} ${num(y)} Z`,
    )
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.commands.push(`Q ${num(cpx)} ${num(cpy)} ${num(x)} ${num(y)}`)
  }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
    this.commands.push(`C ${num(cp1x)} ${num(cp1y)} ${num(cp2x)} ${num(cp2y)} ${num(x)} ${num(y)}`)
  }
  arc(x: number, y: number, radius: number, start: number, end: number, anticlockwise = false) {
    const deltaRaw = anticlockwise ? start - end : end - start
    const delta = ((deltaRaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    if (Math.abs(deltaRaw) >= Math.PI * 2 - 0.0001) {
      this.commands.push(
        `M ${num(x + radius)} ${num(y)} A ${num(radius)} ${num(radius)} 0 1 0 ${num(x - radius)} ${num(y)}` +
        ` A ${num(radius)} ${num(radius)} 0 1 0 ${num(x + radius)} ${num(y)}`,
      )
      return
    }
    const sx = x + radius * Math.cos(start), sy = y + radius * Math.sin(start)
    const ex = x + radius * Math.cos(end), ey = y + radius * Math.sin(end)
    const large = delta > Math.PI ? 1 : 0
    const sweep = anticlockwise ? 0 : 1
    this.commands.push(`M ${num(sx)} ${num(sy)} A ${num(radius)} ${num(radius)} 0 ${large} ${sweep} ${num(ex)} ${num(ey)}`)
  }
  closePath() { this.commands.push('Z') }
  toString() { return this.commands.join(' ') }
}

function num(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0'
}

function esc(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function matrixMultiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function defaultState(): RecorderState {
  return {
    fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1, lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic',
    shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    transform: [1, 0, 0, 1, 0, 0], clipId: null,
  }
}

export class CanvasSvgRecorder {
  private state = defaultState()
  private stack: RecorderState[] = []
  private path = new RecordedPath()
  private lastFilledPath: RecordedPath | null = null
  private elements: string[] = []
  private defs: string[] = []
  private gradientIds = new Map<SvgGradient, string>()
  private measureCtx: CanvasRenderingContext2D

  readonly canvas: { width: number; height: number }

  constructor(private width: number, private height: number, private idPrefix = 'canvas') {
    this.measureCtx = document.createElement('canvas').getContext('2d')!
    this.canvas = { width, height }
  }

  get context(): CanvasRenderingContext2D {
    return this as unknown as CanvasRenderingContext2D
  }

  get fillStyle() { return this.state.fillStyle as string }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) { this.state.fillStyle = v as unknown as string | SvgGradient }
  get strokeStyle() { return this.state.strokeStyle as string }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) { this.state.strokeStyle = v as unknown as string | SvgGradient }
  get globalAlpha() { return this.state.globalAlpha }
  set globalAlpha(v: number) { this.state.globalAlpha = Number(v) }
  get lineWidth() { return this.state.lineWidth }
  set lineWidth(v: number) { this.state.lineWidth = Number(v) }
  get lineCap() { return this.state.lineCap }
  set lineCap(v: CanvasLineCap) { this.state.lineCap = v }
  get lineJoin() { return this.state.lineJoin }
  set lineJoin(v: CanvasLineJoin) { this.state.lineJoin = v }
  get font() { return this.state.font }
  set font(v: string) { this.state.font = String(v) }
  get textAlign() { return this.state.textAlign }
  set textAlign(v: CanvasTextAlign) { this.state.textAlign = v }
  get textBaseline() { return this.state.textBaseline }
  set textBaseline(v: CanvasTextBaseline) { this.state.textBaseline = v }
  get shadowColor() { return this.state.shadowColor }
  set shadowColor(v: string) { this.state.shadowColor = String(v) }
  get shadowBlur() { return this.state.shadowBlur }
  set shadowBlur(v: number) { this.state.shadowBlur = Number(v) }
  get shadowOffsetX() { return this.state.shadowOffsetX }
  set shadowOffsetX(v: number) { this.state.shadowOffsetX = Number(v) }
  get shadowOffsetY() { return this.state.shadowOffsetY }
  set shadowOffsetY(v: number) { this.state.shadowOffsetY = Number(v) }

  save() { this.stack.push({ ...this.state, transform: [...this.state.transform] as Matrix }) }
  restore() { const saved = this.stack.pop(); if (saved) this.state = saved }
  beginPath() { this.path = new RecordedPath(); this.lastFilledPath = null }
  closePath() { this.path.closePath() }
  moveTo(x: number, y: number) { this.path.moveTo(x, y) }
  lineTo(x: number, y: number) { this.path.lineTo(x, y) }
  rect(x: number, y: number, w: number, h: number) { this.path.rect(x, y, w, h) }
  roundRect(x: number, y: number, w: number, h: number, r?: number | number[]) { this.path.roundRect(x, y, w, h, r) }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) { this.path.quadraticCurveTo(cpx, cpy, x, y) }
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number) { this.path.bezierCurveTo(a, b, c, d, e, f) }
  arc(x: number, y: number, r: number, s: number, e: number, ccw?: boolean) { this.path.arc(x, y, r, s, e, ccw) }
  arcTo(_x1: number, _y1: number, x2: number, y2: number) { this.path.lineTo(x2, y2) }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, ccw = false) {
    if (Math.abs(end - start) >= Math.PI * 2 - 0.0001 && rotation === 0) {
      this.path.commands.push(
        `M ${num(x + rx)} ${num(y)} A ${num(rx)} ${num(ry)} 0 1 0 ${num(x - rx)} ${num(y)}` +
        ` A ${num(rx)} ${num(ry)} 0 1 0 ${num(x + rx)} ${num(y)}`,
      )
      return
    }
    const sx = x + rx * Math.cos(start), sy = y + ry * Math.sin(start)
    const ex = x + rx * Math.cos(end), ey = y + ry * Math.sin(end)
    const delta = Math.abs(end - start)
    this.path.commands.push(`M ${num(sx)} ${num(sy)} A ${num(rx)} ${num(ry)} ${num(rotation * 180 / Math.PI)} ${delta > Math.PI ? 1 : 0} ${ccw ? 0 : 1} ${num(ex)} ${num(ey)}`)
  }

  fill(path?: RecordedPath) {
    const target = path || this.path
    this.emitPath(target, true, false)
    if (!path) {
      this.lastFilledPath = target
      this.path = new RecordedPath()
    }
  }
  stroke(path?: RecordedPath) {
    const target = path || (this.path.commands.length ? this.path : this.lastFilledPath)
    if (target) this.emitPath(target, false, true)
    if (!path) {
      this.path = new RecordedPath()
      this.lastFilledPath = null
    }
  }
  clip(path?: RecordedPath) {
    const d = (path || this.path).toString()
    if (!d) return
    const id = `${this.idPrefix}-clip-${this.defs.length + 1}`
    this.defs.push(`<clipPath id="${id}"><path d="${d}"${this.transformAttr()}/></clipPath>`)
    this.state.clipId = id
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.elements.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" ${this.paintAttrs(true, false)}/>`)
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.elements.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" ${this.paintAttrs(false, true)}/>`)
  }
  clearRect() { /* A fresh recorder is transparent; generated slides clear only at the start. */ }

  fillText(text: string, x: number, y: number, maxWidth?: number) { this.emitText(text, x, y, false, maxWidth) }
  strokeText(text: string, x: number, y: number, maxWidth?: number) { this.emitText(text, x, y, true, maxWidth) }
  measureText(text: string) {
    this.measureCtx.font = this.state.font
    return this.measureCtx.measureText(String(text))
  }

  drawImage(image: CanvasImageSource, ...args: number[]) {
    const src = (image as HTMLImageElement).src || (image as HTMLCanvasElement).toDataURL?.('image/png') || ''
    if (!src) return
    let x = 0, y = 0, w = Number((image as HTMLImageElement).naturalWidth || (image as HTMLCanvasElement).width || 0)
    let h = Number((image as HTMLImageElement).naturalHeight || (image as HTMLCanvasElement).height || 0)
    if (args.length === 2) [x, y] = args
    else if (args.length === 4) [x, y, w, h] = args
    else if (args.length >= 8) [, , , , x, y, w, h] = args
    this.elements.push(`<image href="${esc(src)}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="none" ${this.commonAttrs()}/>`)
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new SvgGradient('linear', [x0, y0, x1, y1]) as unknown as CanvasGradient
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new SvgGradient('radial', [x0, y0, r0, x1, y1, r1]) as unknown as CanvasGradient
  }
  setLineDash() { /* Figma imports solid lines reliably; dash support can be added when needed. */ }
  getLineDash() { return [] }

  translate(x: number, y: number) { this.state.transform = matrixMultiply(this.state.transform, [1, 0, 0, 1, x, y]) }
  scale(x: number, y: number) { this.state.transform = matrixMultiply(this.state.transform, [x, 0, 0, y, 0, 0]) }
  rotate(angle: number) {
    const c = Math.cos(angle), s = Math.sin(angle)
    this.state.transform = matrixMultiply(this.state.transform, [c, s, -s, c, 0, 0])
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.state.transform = matrixMultiply(this.state.transform, [a, b, c, d, e, f])
  }
  setTransform(a: number | DOMMatrix = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.state.transform = typeof a === 'number'
      ? [a, b, c, d, e, f]
      : [a.a, a.b, a.c, a.d, a.e, a.f]
  }
  resetTransform() { this.state.transform = [1, 0, 0, 1, 0, 0] }

  toSVGContent(): string {
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : ''
    return `${defs}${this.elements.join('\n')}`
  }

  toSVG(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">${this.toSVGContent()}</svg>`
  }

  private emitPath(path: RecordedPath, fill: boolean, stroke: boolean) {
    const d = path?.toString()
    if (d) this.elements.push(`<path d="${d}" ${this.paintAttrs(fill, stroke)}/>`)
  }

  private emitText(text: string, x: number, y: number, stroke: boolean, maxWidth?: number) {
    const font = this.parseFont()
    const anchor = this.state.textAlign === 'center' ? 'middle'
      : this.state.textAlign === 'right' || this.state.textAlign === 'end' ? 'end' : 'start'
    const baseline = this.state.textBaseline === 'top' || this.state.textBaseline === 'hanging' ? 'text-before-edge'
      : this.state.textBaseline === 'middle' ? 'central'
      : this.state.textBaseline === 'bottom' || this.state.textBaseline === 'ideographic' ? 'text-after-edge' : 'alphabetic'
    const widthAttr = maxWidth ? ` textLength="${num(maxWidth)}" lengthAdjust="spacingAndGlyphs"` : ''
    const paint = this.paintAttrs(!stroke, stroke)
    this.elements.push(
      `<text x="${num(x)}" y="${num(y)}" font-family="${esc(font.family)}" font-size="${num(font.size)}"` +
      ` font-weight="${esc(font.weight)}" font-style="${font.style}" text-anchor="${anchor}" dominant-baseline="${baseline}"${widthAttr} ${paint}>${esc(text)}</text>`,
    )
  }

  private parseFont() {
    const font = this.state.font || '10px sans-serif'
    const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/)
    const size = sizeMatch ? Number(sizeMatch[1]) : 10
    const before = sizeMatch ? font.slice(0, sizeMatch.index).trim() : ''
    const familyRaw = sizeMatch ? font.slice((sizeMatch.index || 0) + sizeMatch[0].length).trim() : 'sans-serif'
    const quotedFamily = familyRaw.match(/^(['"])(.*?)\1/)
    const family = quotedFamily?.[2] || familyRaw.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
    const weight = before.match(/\b(100|200|300|400|500|600|700|800|900|bold|bolder|lighter)\b/)?.[1] || '400'
    const style = /\bitalic\b/.test(before) ? 'italic' : 'normal'
    return { size, family: family || 'sans-serif', weight, style }
  }

  private paint(value: string | SvgGradient): string {
    if (!(value instanceof SvgGradient)) return String(value)
    let id = this.gradientIds.get(value)
    if (!id) {
      id = `${this.idPrefix}-gradient-${this.gradientIds.size + 1}`
      this.gradientIds.set(value, id)
      const stops = value.stops.map(s => `<stop offset="${num(s.offset * 100)}%" stop-color="${esc(s.color)}"/>`).join('')
      if (value.kind === 'linear') {
        const [x1, y1, x2, y2] = value.args
        this.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}">${stops}</linearGradient>`)
      } else {
        const [, , , x, y, r] = value.args
        this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(x)}" cy="${num(y)}" r="${num(r)}">${stops}</radialGradient>`)
      }
    }
    return `url(#${id})`
  }

  private paintAttrs(fill: boolean, stroke: boolean): string {
    const attrs = [
      fill ? `fill="${esc(this.paint(this.state.fillStyle))}"` : 'fill="none"',
      stroke ? `stroke="${esc(this.paint(this.state.strokeStyle))}" stroke-width="${num(this.state.lineWidth)}" stroke-linecap="${this.state.lineCap}" stroke-linejoin="${this.state.lineJoin}"` : '',
      this.commonAttrs(),
    ]
    return attrs.filter(Boolean).join(' ')
  }

  private commonAttrs(): string {
    const clip = this.state.clipId ? ` clip-path="url(#${this.state.clipId})"` : ''
    return `opacity="${num(this.state.globalAlpha)}"${this.transformAttr()}${clip}`
  }

  private transformAttr(): string {
    const [a, b, c, d, e, f] = this.state.transform
    return a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0
      ? '' : ` transform="matrix(${[a, b, c, d, e, f].map(num).join(' ')})"`
  }
}

export function installRecordedPath2D(): () => void {
  const original = window.Path2D
  window.Path2D = RecordedPath as unknown as typeof Path2D
  return () => { window.Path2D = original }
}
