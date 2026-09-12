'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { useLightbox } from '@/lib/lightbox'
import { sb } from '@/lib/supabase'
import type { RenderParams } from '@/lib/generate-store'
import BannerPreview, { BANNER_SIZES, DEFAULT_BANNER_TEMPLATES, type BannerSizeTemplate, type BannerCopy, type BannerColors, type BannerAssets } from '@/components/BannerPreview'
import { PptTemplateSlide } from '@/components/PptTemplateRenderer'
import type { RenderPlan } from '@/lib/ppt/types'
import { buildStaticPostSVG, urlToBase64, buildFontFaceStyle } from '@/lib/static-post-figma'
import { CanvasSvgRecorder, installRecordedPath2D } from '@/lib/canvas-svg-recorder'
import { authedFetch } from '@/lib/authed-fetch'
import { deleteMediaClient } from '@/lib/media-upload'
import { exportToPptx } from '@/lib/ppt/pptx-exporter'
import UiWalkthroughPreview from '@/components/UiWalkthroughPreview'
import { sanitizeInfographicCode as sanitizeInfographicCodeShared, drawBrandLogoOverlay, IFRAME_LOGO_OVERLAY_JS } from '@/lib/infographic-render'

interface GeneratedPost {
  id: string
  brand_id: string | null
  output_url: string
  headline: string | null
  is_broker: boolean | null
  is_carousel: boolean | null
  is_ad_concept: boolean | null
  is_editable_social: boolean | null
  is_infographic: boolean | null
  is_banner: boolean | null
  is_blog: boolean | null
  is_ppt: boolean | null
  is_map_graphic: boolean | null
  is_illustration: boolean | null
  is_ui_walkthrough: boolean | null
  total_frames: number | null
  canvas_width: number | null
  canvas_height: number | null
  created_by_email: string | null
  animated_url: string | null
  remotion_code: string | null
  infographic_theme: string | null
  carousel_session_id: string | null
  created_at: string
  render_params?: RenderParams | null
  brands?: { name: string; brand_profiles?: { infographic_logo_light_url: string | null; infographic_logo_dark_url: string | null; infographic_font_heading: string | null; infographic_font_heading_url: string | null; infographic_font_body: string | null; infographic_font_body_url: string | null }[] } | null
}

interface Brand { id: string; name: string }

const PAGE_SIZE = 20

const TEST_EMAILS = new Set(['team@contentbeta.com'])

function creatorTag(email: string, adminEmails: Set<string>): { label: string; bg: string } {
  if (TEST_EMAILS.has(email)) return { label: 'Test', bg: 'rgba(107,114,128,0.85)' }
  if (adminEmails.has(email)) return { label: 'Admin', bg: 'rgba(239,68,68,0.85)' }
  return { label: 'User', bg: 'rgba(59,130,246,0.85)' }
}

const sanitizeInfographicCode = sanitizeInfographicCodeShared

function detectInfographicTheme(code: string): 'dark' | 'light' {
  const match = code.match(/ctx\.fillStyle\s*=\s*['"]([^'"]+)['"]/)
  if (!match) return 'light'
  const color = match[1].toLowerCase()
  const hex = color.match(/^#([0-9a-f]{3,6})$/)
  if (hex) {
    const h = hex[1]
    const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16)
    const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16)
    const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? 'dark' : 'light'
  }
  return 'light'
}

function applyBrandFonts(code: string, fonts: Array<{ name: string; url: string }>): string {
  if (!fonts.length) return code
  const heading = fonts[0].name
  const body = fonts[1]?.name || fonts[0].name
  return code.replace(/ctx\.font\s*=\s*'([^']*)'/g, (match, fontStr) => {
    if (fontStr.includes(`"${heading}"`) || fontStr.includes(`"${body}"`)) return match
    const size = parseInt(fontStr.match(/(\d+)px/)?.[1] ?? '0')
    const target = size >= 24 ? heading : body
    const replaced = fontStr.replace(/"[^"]+"/, `"${target}"`)
    return `ctx.font = '${replaced}'`
  })
}

function InfographicCanvasPlayer({ remotionCode, logoUrl, fonts }: { remotionCode: string; logoUrl?: string | null; fonts?: Array<{ name: string; url: string }> }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current) return
    const fontDefs = JSON.stringify(fonts ?? [])
    const patchedCode = applyBrandFonts(sanitizeInfographicCode(remotionCode), fonts ?? [])
    // Passed as a JSON-encoded string literal (not spliced as raw script text) so a malformed
    // AI response yields a catchable runtime error instead of an uncaught HTML-parse SyntaxError.
    const safeCode = JSON.stringify(patchedCode).replace(/<\/script/gi, '<\\/script')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#111; display:flex; align-items:center; justify-content:center; width:100vw; height:100vh; overflow:hidden; }
    canvas { width:100vw; height:100vh; object-fit:contain; }
    .render-error { color:#f87171; font-family:sans-serif; padding:20px; text-align:center; font-size:14px; }
  </style>
</head>
<body>
  <canvas id="c" width="1080" height="1080"></canvas>
  <script>
    ${IFRAME_LOGO_OVERLAY_JS}
    const TOTAL_FRAMES = 150;
    const FPS = 30;
    let drawFrame = null;
    try {
      drawFrame = new Function(${safeCode} + '\\n;return typeof drawFrame === "function" ? drawFrame : null;')();
    } catch (e) {
      console.error('Infographic render error:', e);
    }
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    if (typeof drawFrame !== 'function') {
      document.body.innerHTML = '<div class="render-error">Preview unavailable for this infographic.</div>';
    } else {
      function start(logoImg) {
        let frame = 0;
        function tick() {
          ctx.clearRect(0, 0, 1080, 1080);
          // logoImg is intentionally NOT passed into drawFrame/drawGraphic — the AI is never
          // trusted to draw the logo itself (unreliable sizing/positioning across brands, and a
          // null-unsafe drawImage call would abort the whole frame). The app composites it
          // deterministically afterward instead. See lib/infographic-render.ts.
          try { drawFrame(ctx, 1080, 1080, null, frame, TOTAL_FRAMES); } catch(e) {}
          try { __drawBrandLogoOverlay(ctx, logoImg, 1080, 1080); } catch(e) {}
          frame = (frame + 1) % TOTAL_FRAMES;
          setTimeout(() => requestAnimationFrame(tick), 1000 / FPS);
        }
        requestAnimationFrame(tick);
      }
      (async function setup() {
        const fontDefs = ${fontDefs};
        await Promise.all(fontDefs.map(async function(f) {
          if (!f.name || !f.url) return;
          try {
            if (f.url.includes('fonts.googleapis.com')) {
              const link = document.createElement('link');
              link.rel = 'stylesheet'; link.href = f.url;
              document.head.appendChild(link);
              await document.fonts.ready;
            } else {
              const face = new FontFace(f.name, 'url(' + f.url + ')', { weight: '100 900', style: 'normal' });
              await face.load();
              document.fonts.add(face);
            }
          } catch(e) {}
        }));
        ${logoUrl
          ? `const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = ${JSON.stringify(logoUrl)};
        await new Promise(function(r) { logoImg.onload = r; logoImg.onerror = r; });
        start(logoImg.complete && logoImg.naturalWidth ? logoImg : null);`
          : `start(null);`}
      })();
    }
  </script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [remotionCode, logoUrl, fonts])

  return (
    <iframe
      ref={iframeRef}
      loading="lazy"
      style={{ width: '100%', aspectRatio: '1', border: 'none', borderRadius: 8, background: '#111', display: 'block' }}
      sandbox="allow-scripts"
    />
  )
}

function sanitizeBlogCode(code: string): string {
  if (!code.includes('\n') && code.includes('\\n')) {
    code = code.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
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

interface LogoPosition { x: number | 'center'; y: number; height: number }
interface BlogSlide {
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
function blogSlideCanvasSize(slide: BlogSlide): { width: number; height: number } {
  return { width: slide.canvasWidth || 1080, height: slide.canvasHeight || 1080 }
}

// The AI never draws the logo itself (see blog-images canvas prompt's LOGO
// rule) — this deterministically composites it afterward so its position is
// exact and doesn't depend on the AI's own arithmetic.
function drawBlogLogoOverlay(ctx: CanvasRenderingContext2D, canvasWidth: number, slide: BlogSlide, logoImg: HTMLImageElement | null) {
  if (!logoImg || !slide.logoPosition) return
  const { x, y, height } = slide.logoPosition
  if (!logoImg.naturalHeight) return
  const logoW = height * (logoImg.naturalWidth / logoImg.naturalHeight)
  const logoX = x === 'center' ? (canvasWidth - logoW) / 2 : Number(x)
  ctx.drawImage(logoImg, logoX, y, logoW, height)
}

interface BlogSlidesPreviewHandle { getDataUrls: () => string[]; getSVG: () => Promise<string> }
interface BlogSlidesPreviewProps { jobId: string; logoUrls: { light: string | null; dark: string | null }; fonts: { name: string; url: string }[]; onOpen: (urls: string[]) => void }

const BlogSlidesPreview = forwardRef<BlogSlidesPreviewHandle, BlogSlidesPreviewProps>(
  function BlogSlidesPreview({ jobId, logoUrls, fonts, onOpen }, ref) {
    const [slides, setSlides] = useState<BlogSlide[]>([])
    const [logoImgs, setLogoImgs] = useState<{ light: HTMLImageElement | null; dark: HTMLImageElement | null }>({ light: null, dark: null })
    const [fontsLoadedTick, setFontsLoadedTick] = useState(0)
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

    useImperativeHandle(ref, () => ({
      getDataUrls: () => canvasRefs.current.filter(Boolean).map(c => c!.toDataURL('image/png')),
      getSVG: async () => {
        if (!slides.length) throw new Error('No slides to export')

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
          buildFontFaceStyle(fonts),
        ])
        const figmaLogos = { light: figmaLightLogo, dark: figmaDarkLogo }

        const sizes = slides.map(blogSlideCanvasSize)
        const totalWidth = sizes.reduce((sum, s) => sum + s.width, 0)
        const maxHeight = Math.max(...sizes.map(s => s.height))
        const restorePath2D = installRecordedPath2D()
        try {
          let xOffset = 0
          const slideContents = slides.map((slide, index) => {
            const { width: w, height: h } = sizes[index]
            const recorder = new CanvasSvgRecorder(w, h, `blog-${index + 1}`)
            const clean = sanitizeBlogCode(slide.jsCode)
            const fn = new Function('ctx', 'width', 'height', 'logoImg', 'options',
              `${clean}\nif(typeof drawSlide==='function')drawSlide(ctx,width,height,logoImg,options);`
            ) as (...args: unknown[]) => void
            fn(recorder.context, w, h, null, {})
            drawBlogLogoOverlay(recorder.context, w, slide, logoForSlide(slide, figmaLogos))
            const content = recorder.toSVGContent()
            const group = `  <g id="blog-image-${index + 1}" transform="translate(${xOffset}, 0)">\n${content}\n  </g>`
            xOffset += w
            return group
          })

          const svg = [
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
      },
    }))

    useEffect(() => {
      sb.from('blog_jobs').select('js_codes').eq('id', jobId).maybeSingle()
        .then(({ data }) => { if (data?.js_codes) setSlides(data.js_codes as BlogSlide[]) })
    }, [jobId])

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
      Promise.all([load(logoUrls.light), load(logoUrls.dark)]).then(([light, dark]) => {
        if (!cancelled) setLogoImgs({ light, dark })
      })
      return () => { cancelled = true }
    }, [logoUrls])

    function logoForSlide(slide: BlogSlide, logos = logoImgs): HTMLImageElement | null {
      if (!slide.logoVariant || slide.logoVariant === 'none') return null
      return slide.logoVariant === 'dark'
        ? (logos.dark || logos.light)
        : (logos.light || logos.dark)
    }

    useEffect(() => {
      // Load brand fonts so the generated canvas code's ctx.font references resolve
      // instead of silently falling back to a default system font.
      const loadFont = async (name: string, url: string) => {
        if (!name || !url) return
        try {
          if (url.includes('fonts.googleapis.com')) {
            const id = `bi-hist-gf-${name.replace(/\s+/g, '-')}`
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
      Promise.all(fonts.map(f => loadFont(f.name, f.url))).then(() => setFontsLoadedTick(t => t + 1))
    }, [fonts])

    useEffect(() => {
      slides.forEach((slide, i) => {
        const canvas = canvasRefs.current[i]
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const { width, height } = blogSlideCanvasSize(slide)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, width, height)
        const clean = sanitizeBlogCode(slide.jsCode)
        try {
          const fn = new Function('ctx', 'width', 'height', 'logoImg', 'options',
            `${clean}\nif(typeof drawSlide==='function')drawSlide(ctx,width,height,logoImg,options);`
          ) as (...args: unknown[]) => void
          fn(ctx, width, height, null, {})
          drawBlogLogoOverlay(ctx, width, slide, logoForSlide(slide))
        } catch { /* blank on error */ }
      })
    }, [slides, logoImgs, fontsLoadedTick])

    if (!slides.length) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', background: 'var(--bg)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="output-grid-item skeleton" style={{ aspectRatio: '1/1' }} />
          ))}
        </div>
      )
    }

    return (
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', cursor: 'zoom-in', background: 'var(--bg)' }}
        onClick={() => {
          const urls = canvasRefs.current.filter(Boolean).map(c => c!.toDataURL('image/png'))
          if (urls.length) onOpen(urls)
        }}
      >
        {slides.map((slide, i) => (
          <canvas
            key={slide.slideNumber}
            width={blogSlideCanvasSize(slide).width}
            height={blogSlideCanvasSize(slide).height}
            style={{ width: '100%', aspectRatio: `${blogSlideCanvasSize(slide).width} / ${blogSlideCanvasSize(slide).height}`, display: 'block' }}
            ref={el => { canvasRefs.current[i] = el }}
          />
        ))}
      </div>
    )
  })

function PptHistoryPreview({ jobId, onOpen }: { jobId: string; onOpen: (slides: RenderPlan[], title: string, startIndex: number) => void }) {
  const [slides, setSlides] = useState<RenderPlan[] | null>(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    sb.from('ppt_jobs').select('slides,presentation_title').eq('id', jobId).maybeSingle()
      .then(({ data }) => {
        if (Array.isArray(data?.slides) && data.slides.length) {
          setSlides(data.slides as RenderPlan[])
          setTitle(data.presentation_title || 'Presentation')
        }
      })
  }, [jobId])

  if (!slides) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', background: 'var(--bg)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="output-grid-item skeleton" style={{ aspectRatio: '16/9' }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', background: 'var(--bg)' }}>
      {slides.slice(0, 12).map((slide, i) => (
        <div key={i} style={{ cursor: 'zoom-in' }} onClick={() => onOpen(slides, title, i)}>
          <PptTemplateSlide plan={slide} borderRadius={0} />
        </div>
      ))}
    </div>
  )
}

// UI Walkthrough history card — separate from InfographicCanvasPlayer above so nothing
// about the existing motion-infographic rendering path is touched. post.remotion_code is
// fully self-contained (it embeds and preloads its own scene image URLs — see
// lib/ui-walkthrough/stitch-engine.ts), so playback needs nothing beyond the row itself.
function UiWalkthroughHistoryCard({ post }: { post: GeneratedPost }) {
  if (!post.remotion_code) return null

  return <UiWalkthroughPreview code={post.remotion_code} />
}

export default function HistoryPage() {
  const { userRole, userBrandId, userAllowedPages, userEmail, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { openLightbox, openLightboxMany } = useLightbox()
  const blogPreviewRefs = useRef<Map<string, BlogSlidesPreviewHandle>>(new Map())

  interface CarouselGroup {
    id: string
    posts: GeneratedPost[]
    brand_id: string | null
    created_at: string
    brands?: { name: string } | null
  }
  type HistoryItem = GeneratedPost | CarouselGroup
  function isCarouselGroup(item: HistoryItem): item is CarouselGroup {
    return 'posts' in item
  }

  const [items, setItems] = useState<HistoryItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [adminEmails, setAdminEmails] = useState<Set<string>>(new Set())
  const [brandFilter, setBrandFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [infographicModal, setInfographicModal] = useState<{ remotionCode: string; logoUrl: string | null; fonts?: Array<{ name: string; url: string }> } | null>(null)
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<'mp4' | 'mov' | 'gif' | 'webm'>('mp4')
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [bannerModal, setBannerModal] = useState<{ assets: BannerAssets; copy: BannerCopy; templates: Record<string, BannerSizeTemplate>; sizeKeys: string[]; activeSizeKey: string } | null>(null)
  const [pptModal, setPptModal] = useState<{ slides: RenderPlan[]; title: string; activeSlide: number; jobId: string } | null>(null)
  const [historyPptxDownloadingId, setHistoryPptxDownloadingId] = useState<string | null>(null)
  const [historyPdfDownloadingId, setHistoryPdfDownloadingId] = useState<string | null>(null)

  async function reRecordVideo(animCode: string, logoImg: HTMLImageElement | null, format: 'mp4' | 'mov'): Promise<void> {
    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1080
    const ctx = canvas.getContext('2d')!
    const clean = sanitizeInfographicCode(animCode)
    const drawFrameFn = new Function(clean + '\nreturn typeof drawFrame==="function"?drawFrame:null;')() as ((ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null, frame: number, total: number) => void) | null
    if (!drawFrameFn) throw new Error('drawFrame not found')

    const TOTAL_FRAMES = 150
    const FPS = 30
    const mp4Mime = 'video/mp4;codecs=avc1'
    const mimeType = MediaRecorder.isTypeSupported(mp4Mime) ? mp4Mime : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const isActuallyMp4 = mimeType.startsWith('video/mp4')
    const ext = format === 'mov' ? 'mov' : isActuallyMp4 ? 'mp4' : 'webm'
    const blobType = isActuallyMp4 ? 'video/mp4' : 'video/webm'

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    await new Promise<void>(resolve => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: blobType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `infographic-animation.${ext}`; a.click()
        URL.revokeObjectURL(url)
        resolve()
      }
      recorder.start()
      let frame = 0
      const interval = setInterval(() => {
        ctx.clearRect(0, 0, 1080, 1080)
        try { drawFrameFn(ctx, 1080, 1080, null, frame, TOTAL_FRAMES) } catch { }
        try { drawBrandLogoOverlay(ctx, logoImg, 1080, 1080) } catch { }
        frame++
        if (frame >= TOTAL_FRAMES) { clearInterval(interval); recorder.stop() }
      }, 1000 / FPS)
    })
  }

  async function reRecordGif(animCode: string, logoImg: HTMLImageElement | null): Promise<void> {
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
    const SIZE = 540
    const TOTAL_FRAMES = 75
    const FPS = 15
    const DELAY = Math.round(100 / FPS)

    const canvas = document.createElement('canvas')
    canvas.width = SIZE; canvas.height = SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const clean = sanitizeInfographicCode(animCode)
    const drawFrameFn = new Function(clean + '\nreturn typeof drawFrame==="function"?drawFrame:null;')() as ((ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null, frame: number, total: number) => void) | null
    if (!drawFrameFn) throw new Error('drawFrame not found')

    const gif = GIFEncoder()
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const frame = Math.round(i * (150 / TOTAL_FRAMES))
      ctx.clearRect(0, 0, SIZE, SIZE)
      try { drawFrameFn(ctx, SIZE, SIZE, null, frame, 150) } catch { }
      try { drawBrandLogoOverlay(ctx, logoImg, SIZE, SIZE) } catch { }
      const imageData = ctx.getImageData(0, 0, SIZE, SIZE)
      const palette = quantize(imageData.data, 256)
      const index = applyPalette(imageData.data, palette)
      gif.writeFrame(index, SIZE, SIZE, { palette, delay: DELAY })
    }
    gif.finish()
    const blob = new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'infographic-animation.gif'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadVideo(postId: string, post: GeneratedPost) {
    setDownloadingVideoId(postId)
    try {
      const remotionCode = post.remotion_code
      const animatedUrl = post.animated_url

      if ((downloadFormat === 'webm' || !remotionCode) && animatedUrl) {
        const res = await fetch(animatedUrl)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl; a.download = 'infographic-animation.webm'; a.click()
        URL.revokeObjectURL(blobUrl)
        return
      }

      if (!remotionCode) return

      const bp = post.brands?.brand_profiles?.[0]
      const logoUrl = post.infographic_theme === 'dark' ? bp?.infographic_logo_dark_url : bp?.infographic_logo_light_url
      let logoImg: HTMLImageElement | null = null
      if (logoUrl) {
        logoImg = await new Promise(resolve => {
          const img = new Image(); img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = logoUrl
        })
      }

      if (downloadFormat === 'gif') {
        await reRecordGif(remotionCode, logoImg)
      } else {
        await reRecordVideo(remotionCode, logoImg, downloadFormat as 'mp4' | 'mov')
      }
    } catch (err) {
      showToast('Video download failed: ' + (err instanceof Error ? err.message : 'unknown error'), true)
    } finally {
      setDownloadingVideoId(null)
    }
  }

  async function handleDownloadUiWalkthrough(postId: string, post: GeneratedPost) {
    if (!post.remotion_code) return
    setDownloadingVideoId(postId)
    try {
      const { recordWalkthroughVideo, recordWalkthroughGif } = await import('@/lib/ui-walkthrough/record-export')
      const params = { code: post.remotion_code }
      if (downloadFormat === 'gif') {
        await recordWalkthroughGif(params)
      } else if (downloadFormat === 'mp4' || downloadFormat === 'mov') {
        await recordWalkthroughVideo(params, downloadFormat)
      }
    } catch (err) {
      showToast('Video download failed: ' + (err instanceof Error ? err.message : 'unknown error'), true)
    } finally {
      setDownloadingVideoId(null)
    }
  }

  async function copyToFigma(post: GeneratedPost) {
    setCopyingId(post.id)
    try {
      if (post.render_params) {
        let params = post.render_params
        // Template uses removeBg — subject cutout was stripped before saving; regenerate it now
        if (params.removeBg && typeof params.bgImageDataUrl === 'string' && params.bgImageDataUrl.startsWith('http')) {
          try {
            const res = await authedFetch('/api/remove-bg', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: params.bgImageDataUrl }),
            })
            if (res.ok) {
              const blob = await res.blob()
              const subjectImageDataUrl = await new Promise<string>(resolve => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
              })
              params = { ...params, subjectImageDataUrl }
            }
          } catch { /* proceed without subject — better than failing entirely */ }
        }
        const svg = await buildStaticPostSVG(params)
        await navigator.clipboard.writeText(svg)
      } else {
        const res = await fetch(post.output_url)
        const blob = await res.blob()
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      }
      setCopiedId(post.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { showToast('Copy failed', true) }
    finally { setCopyingId(null) }
  }

  async function copyBlogToFigma(post: GeneratedPost) {
    const preview = blogPreviewRefs.current.get(post.id)
    if (!preview) return
    setCopyingId(post.id)
    try {
      const svg = await preview.getSVG()
      await navigator.clipboard.writeText(svg)
      setCopiedId(post.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { showToast('Copy failed', true) }
    finally { setCopyingId(null) }
  }

  function groupCarousels(raw: GeneratedPost[]): HistoryItem[] {
    const slideIndex = (url: string) => { const m = url.match(/\/v2_\d+_(\d+)\.png/); return m ? parseInt(m[1]) : 999 }
    const urlTs = (url: string) => { const m = url.match(/\/v2_(\d+)_\d+\.png/); return m ? m[1] : null }

    // Determine grouping key: prefer carousel_session_id, fall back to URL timestamp
    const getKey = (p: GeneratedPost) => {
      if (p.carousel_session_id) return p.carousel_session_id
      const ts = urlTs(p.output_url)
      return ts ? `${p.brand_id}_${ts}` : null
    }

    const sessionMap = new Map<string, GeneratedPost[]>()
    raw.forEach(p => {
      if (!p.is_carousel) return
      const key = getKey(p)
      if (!key) return
      if (!sessionMap.has(key)) sessionMap.set(key, [])
      sessionMap.get(key)!.push(p)
    })

    const result: HistoryItem[] = []
    const usedSessions = new Set<string>()
    raw.forEach(p => {
      if (!p.is_carousel) { result.push(p); return }
      const key = getKey(p)
      if (!key) { result.push(p); return }
      if (usedSessions.has(key)) return
      usedSessions.add(key)
      const group = sessionMap.get(key)!
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => slideIndex(a.output_url) - slideIndex(b.output_url))
        result.push({ id: `group_${key}`, posts: sorted, brand_id: p.brand_id, created_at: p.created_at, brands: p.brands })
      } else {
        result.push(p)
      }
    })
    return result
  }

  const isAdmin = userRole === 'admin'
  const hasAnyRestrictedAccess = userAllowedPages.length > 0
  const canSeeStockImagery = isAdmin || userAllowedPages.includes('generate-broker')
  const canSeeBlogToCarousel = isAdmin || userAllowedPages.includes('carousel-v2')
  const canSeeAdConcepts = isAdmin || userAllowedPages.includes('ad-concept-generator')
  const canSeeMultiSizeAds = isAdmin || userAllowedPages.includes('generate-banner')
  const canSeeMapGraphics = isAdmin || userAllowedPages.includes('map-graphics')
  const canSeeMotionInfographics = isAdmin || userAllowedPages.includes('infographic-generator')
  const canSeeBlogImages = isAdmin || userAllowedPages.includes('blog-images')
  const canSeePdfToPpt = isAdmin || userAllowedPages.includes('pdf-to-ppt')
  const canSeeIllustrations = isAdmin || userAllowedPages.includes('generate-illustrations')
  const canSeeUiWalkthrough = isAdmin || userAllowedPages.includes('ui-walkthrough')
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const filtersInitialized = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (isAdmin) {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
      sb.from('admins').select('email').then(({ data }) => {
        setAdminEmails(new Set((data || []).map((u: { email: string }) => u.email)))
      })
    }
    filtersInitialized.current = true
    loadHistory(1)
  }, [authLoading])

  useEffect(() => {
    if (!filtersInitialized.current) return
    loadHistory(1)
    setPage(1)
  }, [brandFilter, typeFilter, creatorFilter])

  function buildQuery(from: number, to: number) {
    let query = sb
      .from('generated_posts')
      .select(
        'id,brand_id,output_url,headline,is_broker,is_carousel,is_ad_concept,is_editable_social,is_infographic,is_banner,is_blog,is_ppt,is_map_graphic,is_illustration,is_ui_walkthrough,total_frames,canvas_width,canvas_height,created_by_email,render_params,animated_url,remotion_code,infographic_theme,carousel_session_id,created_at,brands!left(name,brand_profiles!left(infographic_logo_light_url,infographic_logo_dark_url,infographic_font_heading,infographic_font_heading_url,infographic_font_body,infographic_font_body_url))',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (userRole === 'user' && userBrandId) {
      query = query.eq('brand_id', userBrandId)
      if (userEmail) query = query.or(`created_by_email.eq.${userEmail},created_by_email.is.null`)
    } else if (brandFilter) {
      query = query.eq('brand_id', brandFilter)
    }

    if (isAdmin && creatorFilter) {
      const testArr = Array.from(TEST_EMAILS)
      if (creatorFilter === 'test') {
        query = query.in('created_by_email', testArr)
      } else if (adminEmails.size > 0) {
        const emailArr = Array.from(adminEmails)
        if (creatorFilter === 'admin') {
          query = query.in('created_by_email', emailArr)
        } else if (creatorFilter === 'user') {
          query = query.not('created_by_email', 'in', `(${[...emailArr, ...testArr].join(',')})`)
        }
      }
    }

    if (typeFilter === 'social') {
      query = query.is('is_broker', null).is('is_carousel', null).is('is_ad_concept', null).is('is_editable_social', null).is('is_infographic', null).is('is_banner', null).is('is_blog', null).is('is_illustration', null).is('is_ui_walkthrough', null)
    } else if (typeFilter === 'ui_walkthrough') {
      query = query.eq('is_ui_walkthrough', true)
    } else if (typeFilter === 'blog') {
      query = query.eq('is_blog', true)
    } else if (typeFilter === 'banner') {
      query = query.eq('is_banner', true)
    } else if (typeFilter === 'infographic') {
      query = query.eq('is_infographic', true)
    } else if (typeFilter === 'editable_social') {
      query = query.eq('is_editable_social', true)
    } else if (typeFilter === 'broker') {
      query = query.eq('is_broker', true)
    } else if (typeFilter === 'carousel') {
      query = query.eq('is_carousel', true)
    } else if (typeFilter === 'ad_concept') {
      query = query.eq('is_ad_concept', true)
    } else if (typeFilter === 'ppt') {
      query = query.eq('is_ppt', true)
    } else if (typeFilter === 'map_graphic') {
      query = query.eq('is_map_graphic', true)
    } else if (typeFilter === 'illustration') {
      query = query.eq('is_illustration', true)
    }
    return query
  }

  async function loadHistory(targetPage: number) {
    setLoading(true)
    const from = (targetPage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error, count } = await buildQuery(from, to)
    setLoading(false)
    if (error) { showToast('Failed to load history', true); return }

    let rows = (data || []) as unknown as GeneratedPost[]

    // If the last row is a carousel slide, fetch more rows until the group is complete
    const getKey = (p: GeneratedPost) => p.carousel_session_id || (() => { const m = p.output_url.match(/\/v2_(\d+)_\d+\.png/); return m ? `${p.brand_id}_${m[1]}` : null })()
    const lastRow = rows[rows.length - 1]
    if (lastRow?.is_carousel) {
      const lastKey = getKey(lastRow)
      if (lastKey) {
        const lastKeyCount = rows.filter(p => p.is_carousel && getKey(p) === lastKey).length
        if (lastKeyCount < 6) {
          // Fetch up to 5 more rows to complete the group
          const { data: extra } = await buildQuery(to + 1, to + 5)
          if (extra) {
            const completing = (extra as unknown as GeneratedPost[]).filter(p => p.is_carousel && getKey(p) === lastKey)
            rows = ([...rows, ...completing] as GeneratedPost[])
          }
        }
      }
    }

    setItems(groupCarousels(rows))
    setTotalCount(count ?? 0)
  }

  function goToPage(p: number) {
    setPage(p)
    loadHistory(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(post: GeneratedPost) {
    if (!confirm('Delete this post?')) return
    const { error: dbErr } = await sb.from('generated_posts').delete().eq('id', post.id)
    if (dbErr) { showToast(dbErr.message, true); return }
    if (post.output_url) await deleteMediaClient({ url: post.output_url }).catch(() => {})
    showToast('Deleted.')
    loadHistory(page)
  }

  async function handleDeleteGroup(group: CarouselGroup) {
    if (!confirm(`Delete all ${group.posts.length} slides in this carousel?`)) return
    const ids = group.posts.map(p => p.id)
    await sb.from('generated_posts').delete().in('id', ids)
    await Promise.all(
      group.posts.map((p) =>
        p.output_url ? deleteMediaClient({ url: p.output_url }).catch(() => {}) : Promise.resolve()
      )
    )
    showToast('Deleted.')
    loadHistory(page)
  }

  async function handleHistoryDownloadPptx(jobId: string, postId: string) {
    setHistoryPptxDownloadingId(postId)
    try {
      const { data } = await sb.from('ppt_jobs').select('slides,presentation_title').eq('id', jobId).maybeSingle()
      if (!data?.slides || !Array.isArray(data.slides) || !data.slides.length) { showToast('No slides found', true); return }
      await exportToPptx(data.slides as RenderPlan[], data.presentation_title || 'Presentation')
    } catch (err) {
      showToast('PPTX export failed: ' + (err as Error).message, true)
    } finally {
      setHistoryPptxDownloadingId(null)
    }
  }

  // Server renders the deck with a real headless browser (Puppeteer) and prints it via
  // Chromium's own page.pdf() — same component the app renders, no separate client-side
  // rendering path (html2canvas) left to drift out of sync with what's actually shown.
  async function handleHistoryDownloadPdf(jobId: string, postId: string) {
    if (historyPdfDownloadingId) return
    setHistoryPdfDownloadingId(postId)
    try {
      const { data } = await sb.from('ppt_jobs').select('slides,presentation_title,brand_id').eq('id', jobId).maybeSingle()
      if (!data?.slides || !Array.isArray(data.slides) || !data.slides.length) { showToast('No slides found', true); return }

      let fonts: { heading?: { name: string; url: string }; body?: { name: string; url: string } } = {}
      if (data.brand_id) {
        const { data: bp } = await sb.from('brand_profiles')
          .select('ppt_font_heading,ppt_font_heading_url,ppt_font_body,ppt_font_body_url')
          .eq('brand_id', data.brand_id).maybeSingle()
        fonts = {
          heading: bp?.ppt_font_heading && bp?.ppt_font_heading_url ? { name: bp.ppt_font_heading, url: bp.ppt_font_heading_url } : undefined,
          body: bp?.ppt_font_body && bp?.ppt_font_body_url ? { name: bp.ppt_font_body, url: bp.ppt_font_body_url } : undefined,
        }
      }

      const title = data.presentation_title || 'Presentation'
      const res = await authedFetch('/api/pdf-to-ppt/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: data.slides as RenderPlan[], title, fonts }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        showToast('PDF export failed: ' + (err.error || res.status), true)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[^a-z0-9\s]/gi, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showToast('PDF export failed: ' + (err as Error).message, true)
    } finally {
      setHistoryPdfDownloadingId(null)
    }
  }

  function getPageNumbers() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = []
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ marginBottom: '6px' }}>Generated Posts</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>All previously generated images.</p>
        </div>
        {(isAdmin || hasAnyRestrictedAccess) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {isAdmin && (
              <select
                value={brandFilter}
                onChange={e => setBrandFilter(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }}
              >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {isAdmin && (
              <select
                value={creatorFilter}
                onChange={e => setCreatorFilter(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }}
              >
                <option value="">All Creators</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
                <option value="test">Test</option>
              </select>
            )}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }}
            >
              <option value="">All Types</option>
              <option value="editable_social">Static Socials</option>
              {canSeeStockImagery && <option value="broker">Stock Imagery</option>}
              {canSeeBlogToCarousel && <option value="carousel">Blog to Carousel</option>}
              {canSeeAdConcepts && <option value="ad_concept">Ad Concepts</option>}
              {canSeeMultiSizeAds && <option value="banner">Multi-size Ads</option>}
              {canSeeMapGraphics && <option value="map_graphic">Map Graphics</option>}
              {canSeeMotionInfographics && <option value="infographic">Motion Infographics</option>}
              {canSeeBlogImages && <option value="blog">Blog Images</option>}
              {canSeePdfToPpt && <option value="ppt">PDF to PPT</option>}
              {canSeeIllustrations && <option value="illustration">Illustrations</option>}
              {canSeeUiWalkthrough && <option value="ui_walkthrough">UI Walkthrough</option>}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="history-grid">
            {items.length === 0 && <p className="empty-state">No generated posts yet.</p>}
            {items.map(item => {
              if (isCarouselGroup(item)) {
                const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const slideUrls = item.posts.map(p => p.output_url)
                return (
                  <div key={item.id} className="history-card" style={{ position: 'relative' }}>
                    {isAdmin && item.posts[0]?.created_by_email && (() => { const t = creatorTag(item.posts[0].created_by_email, adminEmails); return <span style={{ position: 'absolute', top: '8px', left: '8px', background: t.bg, color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>{t.label}</span> })()}
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(120,60,180,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>
                      Blog to Carousel
                    </span>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', cursor: 'zoom-in', background: 'var(--bg)' }}
                      onClick={() => openLightboxMany(slideUrls, 0)}
                    >
                      {slideUrls.map((url, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={i} src={url} alt={`Slide ${i + 1}`} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      ))}
                    </div>
                    <div className="history-card-info">
                      <div className="history-card-headline">{item.posts.length} slides</div>
                      <div className="history-card-meta">
                        {(item.brands as { name: string } | null)?.name || '—'} · {date}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="history-card-actions" style={{ flexWrap: 'wrap' }}>
                          {slideUrls.map((url, i) => (
                            <button key={i} className="btn btn-secondary btn-sm" onClick={async () => {
                              try {
                                const blob = await fetch(url).then(r => r.blob())
                                const objUrl = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = objUrl
                                a.download = `carousel_slide_${i + 1}.png`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(objUrl)
                              } catch { /* skip */ }
                            }}>{i + 1}</button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={async () => {
                            for (let i = 0; i < slideUrls.length; i++) {
                              try {
                                const blob = await fetch(slideUrls[i]).then(r => r.blob())
                                const objUrl = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = objUrl
                                a.download = `carousel_slide_${i + 1}.png`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(objUrl)
                                await new Promise(r => setTimeout(r, 300))
                              } catch { /* skip */ }
                            }
                          }}>Download all</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteGroup(item)}>Delete all</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.is_blog) {
                const p = item
                const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const jobId = (p.render_params as { job_id?: string } | null)?.job_id
                const bp = (p.brands as any)?.brand_profiles
                const bpData = Array.isArray(bp) ? bp[0] : bp
                const logoUrls = {
                  light: bpData?.infographic_logo_light_url || null,
                  dark: bpData?.infographic_logo_dark_url || null,
                }
                const fonts = [
                  { name: bpData?.infographic_font_heading || '', url: bpData?.infographic_font_heading_url || '' },
                  { name: bpData?.infographic_font_body || '', url: bpData?.infographic_font_body_url || '' },
                ].filter((f: { name: string; url: string }) => f.name && f.url)
                if (!jobId) return null
                return (
                  <div key={p.id} className="history-card" style={{ position: 'relative' }}>
                    {isAdmin && p.created_by_email && (() => { const t = creatorTag(p.created_by_email, adminEmails); return <span style={{ position: 'absolute', top: '8px', left: '8px', background: t.bg, color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>{t.label}</span> })()}
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(16,185,129,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>
                      Blog Images
                    </span>
                    <BlogSlidesPreview
                      ref={el => { if (el) blogPreviewRefs.current.set(p.id, el); else blogPreviewRefs.current.delete(p.id) }}
                      jobId={jobId}
                      logoUrls={logoUrls}
                      fonts={fonts}
                      onOpen={urls => openLightboxMany(urls, 0)}
                    />
                    <div className="history-card-info">
                      <div className="history-card-headline">{p.headline || '—'}</div>
                      <div className="history-card-meta">
                        {(p.brands as { name: string } | null)?.name || '—'} · {date}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="history-card-actions" style={{ flexWrap: 'wrap' }}>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <button key={i} className="btn btn-secondary btn-sm" onClick={() => {
                              const urls = blogPreviewRefs.current.get(p.id)?.getDataUrls() || []
                              if (!urls[i]) return
                              const a = document.createElement('a')
                              a.href = urls[i]; a.download = `blog-image-${i + 1}.png`; a.click()
                            }}>{i + 1}</button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            const urls = blogPreviewRefs.current.get(p.id)?.getDataUrls() || []
                            urls.forEach((url, i) => {
                              setTimeout(() => {
                                const a = document.createElement('a')
                                a.href = url; a.download = `blog-image-${i + 1}.png`; a.click()
                              }, i * 200)
                            })
                          }}>Download all</button>
                          <button
                            disabled={copyingId === p.id}
                            onClick={() => copyBlogToFigma(p)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', border: '1px solid #6366f1', background: copiedId === p.id ? '#6366f1' : 'transparent', color: copiedId === p.id ? '#fff' : '#6366f1', fontSize: '11px', cursor: copyingId === p.id ? 'wait' : 'pointer', fontWeight: 600, transition: 'all 0.15s', opacity: copyingId === p.id ? 0.7 : 1, lineHeight: 1 }}>
                            {copyingId === p.id ? '…' : copiedId === p.id ? '✓' : <>Figma <span style={{ fontSize: '8px', fontWeight: 700, background: copiedId === p.id ? 'rgba(255,255,255,0.3)' : '#6366f1', color: '#fff', borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.05em' }}>BETA</span></>}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.is_banner) {
                const p = item
                const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                type BannerRenderParams = { copy: BannerCopy; colors: BannerColors; logoUrl: string | null; bgImageUrl: string; templates: Record<string, BannerSizeTemplate> }
                const rp = p.render_params as BannerRenderParams | null
                const bannerAssets: BannerAssets | null = rp ? { colors: rp.colors, bgImageUrl: rp.bgImageUrl || p.output_url, logoUrl: rp.logoUrl } : null
                const bannerCopy: BannerCopy = rp?.copy ?? { heading: p.headline || '', subheading: '', cta: '' }
                const sizeKeys = rp?.templates ? Object.keys(rp.templates) : []
                const CELL = 100
                const openModal = (key: string) => {
                  if (!bannerAssets || !rp) return
                  setBannerModal({ assets: bannerAssets, copy: bannerCopy, templates: rp.templates, sizeKeys, activeSizeKey: key })
                }
                return (
                  <div key={p.id} className="history-card" style={{ position: 'relative' }}>
                    {isAdmin && p.created_by_email && (() => { const t = creatorTag(p.created_by_email, adminEmails); return <span style={{ position: 'absolute', top: '8px', left: '8px', background: t.bg, color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>{t.label}</span> })()}
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(14,165,233,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>
                      Multi-size Ads
                    </span>
                    {bannerAssets && sizeKeys.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', background: 'var(--bg)', cursor: 'zoom-in' }}>
                        {sizeKeys.map(key => {
                          const sizeDef = BANNER_SIZES.find(s => s.key === key)
                          if (!sizeDef) return null
                          const tmpl = rp!.templates[key] || DEFAULT_BANNER_TEMPLATES[key]
                          const scale = Math.min(CELL / sizeDef.w, CELL / sizeDef.h)
                          const scaledW = Math.round(sizeDef.w * scale)
                          const scaledH = Math.round(sizeDef.h * scale)
                          const bgColor = bannerAssets.colors.backgroundColor || '#fff'
                          return (
                            <div key={key} onClick={() => openModal(key)}
                              style={{ aspectRatio: '1', overflow: 'hidden', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: scaledW, height: scaledH, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: sizeDef.w, height: sizeDef.h, pointerEvents: 'none' }}>
                                  <BannerPreview size={sizeDef} copy={bannerCopy} assets={bannerAssets} template={tmpl} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.output_url} alt="Banner background" loading="lazy" style={{ cursor: 'zoom-in' }} onClick={() => openLightbox(p.output_url)} />
                    )}
                    <div className="history-card-info">
                      <div className="history-card-headline">{p.headline || '—'}</div>
                      <div className="history-card-meta">
                        {(p.brands as { name: string } | null)?.name || '—'} · {date}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="history-card-actions" style={{ flexWrap: 'wrap' }}>
                          {sizeKeys.map(key => {
                            const sd = BANNER_SIZES.find(s => s.key === key)
                            return (
                              <button key={key} className="btn btn-secondary btn-sm" onClick={() => openModal(key)}>
                                {sd?.label || key}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.is_ppt) {
                const p = item
                const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const jobId = (p.render_params as { job_id?: string } | null)?.job_id
                if (!jobId) return null
                return (
                  <div key={p.id} className="history-card" style={{ position: 'relative' }}>
                    {isAdmin && p.created_by_email && (() => { const t = creatorTag(p.created_by_email, adminEmails); return <span style={{ position: 'absolute', top: '8px', left: '8px', background: t.bg, color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>{t.label}</span> })()}
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>
                      PDF to PPT
                    </span>
                    <PptHistoryPreview
                      jobId={jobId}
                      onOpen={(slides, title, startIndex) => setPptModal({ slides, title, activeSlide: startIndex, jobId })}
                    />
                    <div className="history-card-info">
                      <div className="history-card-headline">{p.headline || '—'}</div>
                      <div className="history-card-meta">
                        {(p.brands as { name: string } | null)?.name || '—'} · {date}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={historyPptxDownloadingId === p.id}
                          onClick={() => handleHistoryDownloadPptx(jobId, p.id)}
                        >
                          {historyPptxDownloadingId === p.id ? 'Building…' : '↓ PPTX'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={historyPdfDownloadingId === p.id}
                          onClick={() => handleHistoryDownloadPdf(jobId, p.id)}
                        >
                          {historyPdfDownloadingId === p.id ? 'Generating…' : '↓ PDF'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                      </div>
                    </div>
                  </div>
                )
              }

              const p = item
              const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <div key={p.id} className="history-card" style={{ position: 'relative' }}>
                  {isAdmin && p.created_by_email && (() => { const t = creatorTag(p.created_by_email, adminEmails); return <span style={{ position: 'absolute', top: '8px', left: '8px', background: t.bg, color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>{t.label}</span> })()}
                  {p.is_editable_social && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(16,185,129,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Static Socials
                    </span>
                  )}
                  {p.is_map_graphic && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(220,38,38,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Map Graphics
                    </span>
                  )}
                  {p.is_illustration && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(16,185,129,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Illustrations
                    </span>
                  )}
                  {!p.is_broker && !p.is_carousel && !p.is_ad_concept && !p.is_editable_social && !p.is_ppt && !p.is_map_graphic && !p.is_illustration && !p.is_ui_walkthrough && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(99,102,241,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      AI Composed
                    </span>
                  )}
                  {p.is_ui_walkthrough && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(29,112,245,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      UI Walkthrough
                    </span>
                  )}
                  {p.is_broker && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,100,200,0.8)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Stock Imagery
                    </span>
                  )}
                  {p.is_carousel && (
                    <span style={{ position: 'absolute', top: '8px', right: p.is_broker ? '60px' : '8px', background: 'rgba(120,60,180,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Blog to Carousel
                    </span>
                  )}
                  {p.is_ad_concept && (
                    <span style={{ position: 'absolute', top: '8px', right: p.is_broker ? '60px' : p.is_carousel ? '68px' : '8px', background: 'rgba(180,100,0,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Ad Concepts
                    </span>
                  )}
                  {p.is_infographic && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(124,58,237,0.85)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>
                      Motion Infographics
                    </span>
                  )}
                  {p.is_infographic && p.remotion_code ? (
                    <div
                      style={{ cursor: 'zoom-in', position: 'relative' }}
                      onClick={() => {
                        const bp = (p.brands as any)?.brand_profiles
                        const bpData = Array.isArray(bp) ? bp[0] : bp
                        const theme = p.infographic_theme ?? (p.remotion_code ? detectInfographicTheme(p.remotion_code) : 'light')
                        const logoUrl = theme === 'dark'
                          ? (bpData?.infographic_logo_dark_url ?? null)
                          : (bpData?.infographic_logo_light_url ?? null)
                        const fonts = [
                          { name: bpData?.infographic_font_heading || '', url: bpData?.infographic_font_heading_url || '' },
                          { name: bpData?.infographic_font_body || '', url: bpData?.infographic_font_body_url || '' },
                        ].filter((f: { name: string; url: string }) => f.name && f.url)
                        setInfographicModal({ remotionCode: p.remotion_code!, logoUrl, fonts })
                      }}
                    >
                      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
                      <InfographicCanvasPlayer
                        remotionCode={p.remotion_code}
                        logoUrl={(() => {
                          const bp = (p.brands as any)?.brand_profiles
                          const bpData = Array.isArray(bp) ? bp[0] : bp
                          const theme = p.infographic_theme ?? detectInfographicTheme(p.remotion_code!)
                          return theme === 'dark'
                            ? (bpData?.infographic_logo_dark_url ?? null)
                            : (bpData?.infographic_logo_light_url ?? null)
                        })()}
                        fonts={(() => {
                          const bp = (p.brands as any)?.brand_profiles
                          const bpData = Array.isArray(bp) ? bp[0] : bp
                          return [
                            { name: bpData?.infographic_font_heading || '', url: bpData?.infographic_font_heading_url || '' },
                            { name: bpData?.infographic_font_body || '', url: bpData?.infographic_font_body_url || '' },
                          ].filter((f: { name: string; url: string }) => f.name && f.url)
                        })()}
                      />
                    </div>
                  ) : p.is_ui_walkthrough && p.remotion_code ? (
                    <UiWalkthroughHistoryCard post={p} />
                  ) : p.output_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.output_url} alt="Generated post" loading="lazy" style={{ cursor: 'zoom-in' }} onClick={() => openLightbox(p.output_url)} />
                  ) : null}
                  <div className="history-card-info">
                    <div className="history-card-headline">{p.headline || '—'}</div>
                    <div className="history-card-meta">
                      {(p.brands as { name: string } | null)?.name || '—'} · {date}
                    </div>
                    <div className="history-card-actions">
                      {!p.is_infographic && !p.is_ui_walkthrough && <a href={p.output_url} download="post.png" target="_blank" className="btn btn-secondary btn-sm" rel="noreferrer">Download</a>}
                      {p.is_infographic && (p.animated_url || p.remotion_code) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            value={downloadFormat}
                            onChange={e => setDownloadFormat(e.target.value as 'mp4' | 'mov' | 'gif' | 'webm')}
                            disabled={downloadingVideoId === p.id}
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', width: 'auto' }}
                          >
                            <option value="mp4">MP4</option>
                            <option value="mov">MOV</option>
                            <option value="gif">GIF</option>
                            <option value="webm">WebM</option>
                          </select>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={downloadingVideoId === p.id}
                            onClick={() => handleDownloadVideo(p.id, p)}
                          >
                            {downloadingVideoId === p.id ? 'Preparing…' : 'Download'}
                          </button>
                        </div>
                      )}
                      {p.is_ui_walkthrough && p.remotion_code && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            value={downloadFormat}
                            onChange={e => setDownloadFormat(e.target.value as 'mp4' | 'mov' | 'gif' | 'webm')}
                            disabled={downloadingVideoId === p.id}
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', width: 'auto' }}
                          >
                            <option value="mp4">MP4</option>
                            <option value="mov">MOV</option>
                            <option value="gif">GIF</option>
                          </select>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={downloadingVideoId === p.id}
                            onClick={() => handleDownloadUiWalkthrough(p.id, p)}
                          >
                            {downloadingVideoId === p.id ? 'Preparing…' : 'Download'}
                          </button>
                        </div>
                      )}
                      {p.is_editable_social && (
                        <button
                          disabled={copyingId === p.id}
                          onClick={() => copyToFigma(p)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', border: '1px solid #6366f1', background: copiedId === p.id ? '#6366f1' : 'transparent', color: copiedId === p.id ? '#fff' : '#6366f1', fontSize: '11px', cursor: copyingId === p.id ? 'wait' : 'pointer', fontWeight: 600, transition: 'all 0.15s', opacity: copyingId === p.id ? 0.7 : 1, lineHeight: 1 }}>
                          {copyingId === p.id ? '…' : copiedId === p.id ? '✓' : <>Figma <span style={{ fontSize: '8px', fontWeight: 700, background: copiedId === p.id ? 'rgba(255,255,255,0.3)' : '#6366f1', color: '#fff', borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.05em' }}>BETA</span></>}
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '32px' }}>
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: '13px' }}
              >
                ←
              </button>
              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} style={{ padding: '6px 4px', color: 'var(--muted)', fontSize: '13px' }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid', borderColor: page === p ? 'var(--red)' : 'var(--border)', background: page === p ? 'var(--red)' : 'var(--surface)', color: page === p ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: '13px', fontWeight: page === p ? 600 : 400 }}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: '13px' }}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {bannerModal && (() => {
        const sizeDef = BANNER_SIZES.find(s => s.key === bannerModal.activeSizeKey)!
        const tmpl = bannerModal.templates[bannerModal.activeSizeKey] || DEFAULT_BANNER_TEMPLATES[bannerModal.activeSizeKey]
        const availW = typeof window !== 'undefined' ? window.innerWidth * 0.88 : 1200
        const availH = typeof window !== 'undefined' ? window.innerHeight * 0.78 : 800
        const scale = Math.min(1, availW / sizeDef.w, availH / sizeDef.h)
        const scaledW = Math.round(sizeDef.w * scale)
        const scaledH = Math.round(sizeDef.h * scale)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={e => { if (e.target === e.currentTarget) setBannerModal(null) }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {bannerModal.sizeKeys.map(key => {
                const sd = BANNER_SIZES.find(s => s.key === key)
                return (
                  <button key={key}
                    onClick={() => setBannerModal(prev => prev ? { ...prev, activeSizeKey: key } : null)}
                    style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid', borderColor: key === bannerModal.activeSizeKey ? '#fff' : 'rgba(255,255,255,0.3)', background: key === bannerModal.activeSizeKey ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                    {sd?.label || key}
                  </button>
                )
              })}
            </div>
            <div style={{ width: scaledW, height: scaledH, overflow: 'hidden', borderRadius: '4px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: sizeDef.w, height: sizeDef.h }}>
                <BannerPreview size={sizeDef} copy={bannerModal.copy} assets={bannerModal.assets} template={tmpl} />
              </div>
            </div>
            <button onClick={() => setBannerModal(null)}
              style={{ position: 'fixed', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
          </div>
        )
      })()}

      {infographicModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setInfographicModal(null) }}
        >
          <div style={{ width: 'min(88vw, 88vh)', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <InfographicCanvasPlayer remotionCode={infographicModal.remotionCode} logoUrl={infographicModal.logoUrl} fonts={infographicModal.fonts} />
          </div>
          <button
            onClick={() => setInfographicModal(null)}
            style={{ position: 'fixed', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
          >&times;</button>
        </div>
      )}

      {pptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setPptModal(null) }}>
          <div style={{ width: 'min(92vw, calc(92vh * 16/9))', position: 'relative' }}>
            <PptTemplateSlide plan={pptModal.slides[pptModal.activeSlide]} borderRadius={8} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <button
              onClick={() => setPptModal(m => m && m.activeSlide > 0 ? { ...m, activeSlide: m.activeSlide - 1 } : m)}
              disabled={pptModal.activeSlide === 0}
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: '18px', cursor: pptModal.activeSlide === 0 ? 'not-allowed' : 'pointer', opacity: pptModal.activeSlide === 0 ? 0.3 : 1 }}
            >←</button>
            <span style={{ color: '#fff', fontSize: '13px', minWidth: 80, textAlign: 'center' }}>
              {pptModal.activeSlide + 1} / {pptModal.slides.length}
            </span>
            <button
              onClick={() => setPptModal(m => m && m.activeSlide < m.slides.length - 1 ? { ...m, activeSlide: m.activeSlide + 1 } : m)}
              disabled={pptModal.activeSlide === pptModal.slides.length - 1}
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: '18px', cursor: pptModal.activeSlide === pptModal.slides.length - 1 ? 'not-allowed' : 'pointer', opacity: pptModal.activeSlide === pptModal.slides.length - 1 ? 0.3 : 1 }}
            >→</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={async () => {
                try { await exportToPptx(pptModal.slides, pptModal.title) } catch { showToast('PPTX export failed', true) }
              }}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
            >↓ PPTX</button>
            <button
              disabled={!!historyPdfDownloadingId}
              onClick={() => handleHistoryDownloadPdf(pptModal.jobId, 'modal')}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, cursor: historyPdfDownloadingId ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: historyPdfDownloadingId ? 0.6 : 1 }}
            >{historyPdfDownloadingId ? 'Generating…' : '↓ PDF'}</button>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '8px' }}>{pptModal.title}</div>
          <button onClick={() => setPptModal(null)}
            style={{ position: 'fixed', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
      )}
    </>
  )
}
