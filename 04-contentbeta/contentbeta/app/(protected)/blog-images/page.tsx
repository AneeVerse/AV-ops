'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { useLightbox } from '@/lib/lightbox'
import { urlToBase64, buildFontFaceStyle } from '@/lib/static-post-figma'
import { CanvasSvgRecorder, installRecordedPath2D } from '@/lib/canvas-svg-recorder'

// [start, end) seconds → message — tuned to ~240s total workflow
const TIMED_MESSAGES: [number, number, string][] = [
  [0,   12,  'Reading your PDF…'],
  [12,  28,  'Extracting key themes…'],
  [28,  50,  'Planning 6 blog slides…'],
  [50,  90,  'Writing slide 1 canvas code…'],
  [90,  130, 'Writing slide 2 canvas code…'],
  [130, 165, 'Writing slides 3 & 4…'],
  [165, 200, 'Writing slides 5 & 6…'],
  [200, 225, 'Validating slide quality…'],
  [225, 999, 'Almost there…'],
]

const PROGRESS_CURVE: [number, number][] = [[0,0],[20,8],[50,20],[90,38],[130,55],[165,68],[200,80],[225,89],[245,94]]

function interpolatePct(elapsed: number): number {
  for (let i = 1; i < PROGRESS_CURVE.length; i++) {
    const [t0, p0] = PROGRESS_CURVE[i - 1]
    const [t1, p1] = PROGRESS_CURVE[i]
    if (elapsed <= t1) return p0 + (p1 - p0) * (elapsed - t0) / (t1 - t0)
  }
  return PROGRESS_CURVE[PROGRESS_CURVE.length - 1][1]
}

function GeneratingOverlay({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 800)
    return () => clearInterval(timer)
  }, [startTime])
  const msg = TIMED_MESSAGES.find(([s, e]) => elapsed >= s && elapsed < e)?.[2] ?? 'Almost there…'
  const pct = Math.round(interpolatePct(elapsed))
  return (
    <div style={{ padding: '16px 16px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{msg}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

interface Brand { id: string; name: string }
interface BlogLayoutGroup { id: string; name: string; description: string | null }
interface LogoPosition { x: number | 'center'; y: number; height: number }
interface Slide {
  slideNumber: number
  title: string
  jsCode: string
  logoVariant?: 'light' | 'dark' | 'none'
  logoPosition?: LogoPosition | null
  canvasWidth?: number
  canvasHeight?: number
}

// Each slide can have its own canvas size, declared via its layout slot's
// "canvas" key — falls back to 1080x1080 when unset.
function slideCanvasSize(slide: Slide): { width: number; height: number } {
  return { width: slide.canvasWidth || 1080, height: slide.canvasHeight || 1080 }
}

// The AI never draws the logo itself (see canvas prompt's LOGO rule) — this
// deterministically composites it afterward so its position is exact and
// doesn't depend on the AI's own arithmetic.
function drawLogoOverlay(ctx: CanvasRenderingContext2D, canvasWidth: number, slide: Slide, logoImg: HTMLImageElement | null) {
  if (!logoImg || !slide.logoPosition) return
  const { x, y, height } = slide.logoPosition
  if (!logoImg.naturalHeight) return
  const logoW = height * (logoImg.naturalWidth / logoImg.naturalHeight)
  const logoX = x === 'center' ? (canvasWidth - logoW) / 2 : Number(x)
  ctx.drawImage(logoImg, logoX, y, logoW, height)
}

async function uploadPdfToStorage(file: File, brandId: string, jobId: string): Promise<string> {
  const uploaded = await uploadMedia(file, {
    folder: `generated-posts/blog-pdfs/${brandId}`,
    fileName: `${jobId}.pdf`,
  })
  return uploaded.url
}

function sanitizeCode(code: string): string {
  if (!code.includes('\n') && code.includes('\\n')) {
    code = code
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  code = Array.from(code).map(ch => {
    const cp = ch.codePointAt(0)
    if (cp === 0x2028 || cp === 0x2029) return '\n'
    if (cp === 0x2018 || cp === 0x2019) return "'"
    if (cp === 0x2013 || cp === 0x2014) return '-'
    return ch
  }).join('')
  // Fix: const-varName = (hyphenated identifiers are invalid JS)
  code = code.replace(
    /\bconst-([a-zA-Z_$][a-zA-Z0-9_$]*(?:-[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*=/g,
    (_: string, name: string) => {
      const camel = name.replace(/-([a-zA-Z$])/g, (_2: string, c: string) => c.toUpperCase())
      return `const ${camel} =`
    }
  )
  // Fix: unescaped apostrophes in contractions inside single-quoted strings (don't → don\'t)
  code = code.replace(/([a-zA-Z])'([stdmvre])\b/g, "$1\\'$2")
  // Fix: possessives before a space (customers' subscription → customers\' subscription)
  code = code.replace(/([a-zA-Z]s)' /g, "$1\\' ")
  return code
}

export default function BlogImagesPage() {
  const { userRole, userBrandId, userBrandName, userAllowedPages } = useAuth()
  const router = useRouter()
  const { openLightboxMany } = useLightbox()

  useEffect(() => {
    if (userRole === null) return
    if (userRole !== 'admin' && !userAllowedPages.includes('blog-images')) router.replace('/generate')
  }, [userRole, userAllowedPages, router])

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [layoutGroups, setLayoutGroups] = useState<BlogLayoutGroup[]>([])
  const [selectedLayoutGroupId, setSelectedLayoutGroupId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [logoImgs, setLogoImgs] = useState<{ light: HTMLImageElement | null; dark: HTMLImageElement | null }>({ light: null, dark: null })
  const [brandLogoUrls, setBrandLogoUrls] = useState<{ light: string | null; dark: string | null }>({ light: null, dark: null })
  const [brandFonts, setBrandFonts] = useState<{ name: string | null; url: string | null }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [copyingToFigma, setCopyingToFigma] = useState(false)
  const [copiedToFigma, setCopiedToFigma] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
    } else if (userBrandId && userBrandName) {
      setBrands([{ id: userBrandId, name: userBrandName }])
      setSelectedBrandId(userBrandId)
    }
  }, [userRole, userBrandId, userBrandName])

  useEffect(() => {
    setLogoImgs({ light: null, dark: null })
    setBrandLogoUrls({ light: null, dark: null })
    setBrandFonts([])
    if (!selectedBrandId) return
    sb.from('brand_profiles')
      .select('infographic_logo_light_url,infographic_logo_dark_url,logo_url,infographic_font_heading,infographic_font_heading_url,infographic_font_body,infographic_font_body_url')
      .eq('brand_id', selectedBrandId).single()
      .then(async ({ data }) => {
        setBrandLogoUrls({
          light: data?.infographic_logo_light_url || data?.logo_url || null,
          dark: data?.infographic_logo_dark_url || null,
        })
        setBrandFonts([
          { name: data?.infographic_font_heading || null, url: data?.infographic_font_heading_url || null },
          { name: data?.infographic_font_body || null, url: data?.infographic_font_body_url || null },
        ])

        // Load brand fonts so the generated canvas code's ctx.font references
        // (e.g. font: "900 72px 'Industry Bold'") actually resolve, instead of
        // silently falling back to a default system font.
        const loadFont = async (name?: string | null, url?: string | null) => {
          if (!name || !url) return
          try {
            if (url.includes('fonts.googleapis.com')) {
              const id = `bi-gf-${name.replace(/\s+/g, '-')}`
              if (!document.getElementById(id)) {
                const link = document.createElement('link')
                link.id = id; link.rel = 'stylesheet'; link.href = url
                document.head.appendChild(link)
              }
              await document.fonts.ready
            } else {
              const face = new FontFace(name, `url(${url})`, { weight: '100 900', style: 'normal' })
              await face.load()
              document.fonts.add(face)
            }
          } catch { /* font load failure is non-fatal */ }
        }
        await Promise.all([
          loadFont(data?.infographic_font_heading, data?.infographic_font_heading_url),
          loadFont(data?.infographic_font_body, data?.infographic_font_body_url),
        ])
      })
  }, [selectedBrandId])

  // Keep both variants loaded; each layout decides whether a logo is present and
  // which variant it needs.
  useEffect(() => {
    let cancelled = false
    const load = (url: string | null) => new Promise<HTMLImageElement | null>(resolve => {
      if (!url) { resolve(null); return }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    Promise.all([load(brandLogoUrls.light), load(brandLogoUrls.dark)]).then(([light, dark]) => {
      if (!cancelled) setLogoImgs({ light, dark })
    })
    return () => { cancelled = true }
  }, [brandLogoUrls])

  function logoForSlide(slide: Slide, logos = logoImgs): HTMLImageElement | null {
    if (!slide.logoVariant || slide.logoVariant === 'none') return null
    return slide.logoVariant === 'dark'
      ? (logos.dark || logos.light)
      : (logos.light || logos.dark)
  }

  useEffect(() => {
    setLayoutGroups([])
    setSelectedLayoutGroupId('')
    if (!selectedBrandId) return
    sb.from('blog_layout_groups')
      .select('id,name,description')
      .eq('brand_id', selectedBrandId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setLayoutGroups(data || []))
  }, [selectedBrandId])

  function handleFileSelect(file: File) {
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return }
    setPdfFile(file)
    setError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleGenerate() {
    if (!selectedBrandId || !pdfFile) { setError('Please select a brand and upload a PDF.'); return }
    if (!selectedLayoutGroupId) { setError('No JSON layout selected. Create one in Brand Settings, then pick it here.'); return }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    setGenerating(true)
    setGenerationStartTime(Date.now())
    setError(null)
    setSlides([])

    const jobId = `blog_${Date.now()}_${selectedBrandId}`

    try {
      const pdfUrl = await uploadPdfToStorage(pdfFile, selectedBrandId, jobId)

      const triggerRes = await authedFetch('/api/blog-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: selectedBrandId, pdfUrl, filename: pdfFile.name, layoutGroupId: selectedLayoutGroupId || null, jobId }),
      })
      if (!triggerRes.ok) {
        const errData = await triggerRes.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to start generation (${triggerRes.status})`)
      }

      const start = Date.now()
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await sb.from('blog_jobs').select('js_codes').eq('id', jobId).maybeSingle()

          if (data?.js_codes && Array.isArray(data.js_codes) && data.js_codes.length > 0) {
            clearInterval(pollRef.current!); pollRef.current = null
            setSlides(data.js_codes as Slide[])
            setGenerating(false); setGenerationStartTime(null)

            try {
              const { data: { session } } = await sb.auth.getSession()
              const creatorEmail = session?.user?.email ?? null
              await sb.from('generated_posts').insert({
                brand_id: selectedBrandId,
                output_url: '',
                headline: pdfFile.name.replace(/\.pdf$/i, ''),
                is_blog: true,
                render_params: { job_id: jobId, slide_count: data.js_codes.length },
                ...(creatorEmail ? { created_by_email: creatorEmail } : {}),
              })
            } catch { /* non-critical */ }
            return
          }
        } catch { /* ignore poll errors */ }
        if (Date.now() - start > 15 * 60 * 1000) {
          clearInterval(pollRef.current!); pollRef.current = null
          setGenerating(false); setGenerationStartTime(null)
          setError('Generation took too long. Check n8n for errors and try again.')
        }
      }, 5000)
    } catch (err) {
      setGenerating(false); setGenerationStartTime(null)
      setError((err as Error).message)
    }
  }

  function renderSlideToCanvas(canvas: HTMLCanvasElement | null, slide: Slide) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = slideCanvasSize(slide)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const clean = sanitizeCode(slide.jsCode)
    try {
      const fn = new Function('ctx', 'width', 'height', 'logoImg', 'options',
        `${clean}\nif(typeof drawSlide==='function')drawSlide(ctx,width,height,logoImg,options);`
      ) as (...args: unknown[]) => void
      fn(ctx, width, height, null, {})
      drawLogoOverlay(ctx, width, slide, logoForSlide(slide))
    } catch (err) {
      console.error(`[blog-images] slide ${slide.slideNumber} render error:`, err)
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#e74c3c'
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Render error — check console', width / 2, height / 2)
    }
  }

  function openPreview(index: number) {
    const canvases = document.querySelectorAll<HTMLCanvasElement>('.blog-slide-canvas')
    const urls = Array.from(canvases).map(c => c.toDataURL('image/png'))
    if (urls.length) openLightboxMany(urls, index)
  }


  function downloadAll() {
    const canvases = document.querySelectorAll<HTMLCanvasElement>('.blog-slide-canvas')
    canvases.forEach((canvas, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.download = `blog-image-${i + 1}.png`
        a.href = canvas.toDataURL('image/png')
        a.click()
      }, i * 200)
    })
  }

  async function copyAllToFigma() {
    if (!slides.length) return

    setCopyingToFigma(true)
    setError(null)
    let svg = ''

    const svgPromise = (async () => {
      const toEmbeddedImage = async (source: HTMLImageElement | null) => {
        if (!source?.src || source.src.startsWith('data:')) return source
        try {
          const dataUrl = await urlToBase64(source.src)
          return await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = dataUrl
          })
        } catch { return source }
      }
      const [figmaLightLogo, figmaDarkLogo, fontFaceStyle] = await Promise.all([
        toEmbeddedImage(logoImgs.light),
        toEmbeddedImage(logoImgs.dark),
        buildFontFaceStyle(brandFonts),
      ])
      const figmaLogos = { light: figmaLightLogo, dark: figmaDarkLogo }

      const sizes = slides.map(slideCanvasSize)
      const totalWidth = sizes.reduce((sum, s) => sum + s.width, 0)
      const maxHeight = Math.max(...sizes.map(s => s.height))
      const restorePath2D = installRecordedPath2D()
      try {
        let xOffset = 0
        const slideContents = slides.map((slide, index) => {
          const { width: w, height: h } = sizes[index]
          const recorder = new CanvasSvgRecorder(w, h, `blog-${index + 1}`)
          const clean = sanitizeCode(slide.jsCode)
          const fn = new Function('ctx', 'width', 'height', 'logoImg', 'options',
            `${clean}\nif(typeof drawSlide==='function')drawSlide(ctx,width,height,logoImg,options);`
          ) as (...args: unknown[]) => void
          fn(recorder.context, w, h, null, {})
          drawLogoOverlay(recorder.context, w, slide, logoForSlide(slide, figmaLogos))
          const content = recorder.toSVGContent()
          const group = `  <g id="blog-image-${index + 1}" transform="translate(${xOffset}, 0)">\n${content}\n  </g>`
          xOffset += w
          return group
        })

        svg = [
          `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${maxHeight}" viewBox="0 0 ${totalWidth} ${maxHeight}">`,
          `  <defs><style>${fontFaceStyle}</style></defs>`,
          ...slideContents,
          '</svg>',
        ].join('\n')

        const parsedSvg = new DOMParser().parseFromString(svg, 'image/svg+xml')
        const parserError = parsedSvg.querySelector('parsererror')
        if (parserError) {
          throw new Error(`Generated SVG is invalid: ${parserError.textContent || 'unknown XML error'}`)
        }
        return svg
      } finally {
        restorePath2D()
      }
    })()

    try {
      // Start the clipboard operation synchronously from the click. Passing the
      // pending Blob preserves browser user-activation while fonts/logo data and
      // editable SVG layers are still being prepared.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': svgPromise.then(value => new Blob([value], { type: 'text/plain' })),
          }),
        ])
      } else {
        svg = await svgPromise
        await navigator.clipboard.writeText(svg)
      }
      setCopiedToFigma(true)
      setTimeout(() => setCopiedToFigma(false), 2000)
    } catch (copyError) {
      try { svg = svg || await svgPromise } catch (exportError) {
        console.error('[blog-images] editable Figma export error:', exportError)
        setError('Could not convert this slide code to editable Figma layers. Check the console for the unsupported Canvas operation.')
        return
      }
      if (!svg) {
        console.error('[blog-images] editable Figma export error:', copyError)
        setError('Could not convert this slide code to editable Figma layers. Check the console for the unsupported Canvas operation.')
        return
      }
      try {
        const textarea = document.createElement('textarea')
        textarea.value = svg
        textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!copied) throw new Error('Copy command was rejected')
        setCopiedToFigma(true)
        setTimeout(() => setCopiedToFigma(false), 2000)
      } catch (fallbackError) {
        console.error('[blog-images] clipboard error:', copyError, fallbackError)
        setError('Could not copy the images. Please allow clipboard access and try again.')
      }
    } finally {
      setCopyingToFigma(false)
    }
  }

  if (userRole !== 'admin' && !userAllowedPages.includes('blog-images')) return null

  return (
    <>
      <h1>Blog Images</h1>
      <p className="subtitle">Upload a PDF and generate 6 branded blog images using AI.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>
          <div className="form-card">
            <h2>Settings</h2>

            <div className="form-group">
              <label>Brand</label>
              <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)} disabled={generating}>
                <option value="">Select a brand...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {selectedBrandId && (
              <div className="form-group">
                <label>JSON Layout</label>
                {layoutGroups.length > 0 ? (
                  <select value={selectedLayoutGroupId} onChange={e => setSelectedLayoutGroupId(e.target.value)} disabled={generating}>
                    <option value="">Select a layout...</option>
                    {layoutGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--error,#e74c3c)' }}>
                    No JSON layout found for this brand. Create one in Brand Settings first.
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>PDF Document</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !generating && fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--primary,#6366f1)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '20px 16px', textAlign: 'center',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  background: dragOver ? 'rgba(99,102,241,0.05)' : 'var(--bg)',
                  transition: 'all 0.15s ease',
                }}
              >
                {pdfFile ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{pdfFile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(pdfFile.size / 1024).toFixed(0)} KB - click to change</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Drop PDF here or click to upload</div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--error,#e74c3c)', marginBottom: 8 }}>
                {error}
              </div>
            )}

            <button className="generate-btn" onClick={handleGenerate} disabled={generating || !selectedBrandId || !pdfFile || !selectedLayoutGroupId}>
              {generating ? 'Generating...' : 'Generate Blog Images'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="form-card">
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Generated Slides</h2>
                {slides.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{slides.length} images</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {slides.length > 0 && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={downloadAll}>
                      Download All
                    </button>
                    <button
                      disabled={copyingToFigma}
                      onClick={copyAllToFigma}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 5, border: '1px solid #6366f1',
                        background: copiedToFigma ? '#6366f1' : 'transparent',
                        color: copiedToFigma ? '#fff' : '#6366f1',
                        fontSize: 11, cursor: copyingToFigma ? 'wait' : 'pointer',
                        fontWeight: 600, transition: 'all 0.15s',
                        opacity: copyingToFigma ? 0.7 : 1, lineHeight: 1,
                      }}
                    >
                      {copyingToFigma ? 'Copying…' : copiedToFigma ? '✓ Copied!' : (
                        <>Copy to Figma <span style={{ fontSize: 8, fontWeight: 700, background: '#6366f1', color: '#fff', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.05em' }}>BETA</span></>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {generating ? (
              <div>
                <div className="output-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="output-grid-item skeleton" style={{ aspectRatio: '1/1' }} />
                  ))}
                </div>
                {generationStartTime && <GeneratingOverlay startTime={generationStartTime} />}
              </div>
            ) : slides.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {slides.map((slide, i) => (
                  <div key={slide.slideNumber} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => openPreview(i)} title="Click to preview">
                      <div style={{ aspectRatio: `${slideCanvasSize(slide).width} / ${slideCanvasSize(slide).height}`, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <canvas
                          className="blog-slide-canvas"
                          width={slideCanvasSize(slide).width}
                          height={slideCanvasSize(slide).height}
                          style={{ width: '100%', height: '100%', display: 'block' }}
                          ref={canvas => renderSlideToCanvas(canvas, slide)}
                        />
                      </div>
                      <div
                        className="slide-overlay"
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.15s ease', background: 'rgba(0,0,0,0.3)',
                        }}
                      >
                        <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6 }}>
                          Preview
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }}>{slide.title}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '60px 0' }}>
                Upload a PDF and click Generate to create blog images
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .slide-overlay { pointer-events: none; }
        div:hover > .slide-overlay { opacity: 1 !important; }
      `}</style>
    </>
  )
}
