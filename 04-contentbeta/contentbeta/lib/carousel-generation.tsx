'use client'
import { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { authedFetch } from '@/lib/authed-fetch'

interface SlideData {
  slideType: 'title' | 'visual' | 'text' | 'cta'
  headline?: string
  heading?: string
  subhead?: string
  carouselTitle?: string
  smallCopy?: string
  bullets?: string[]
  ctaText?: string
}

interface PuppeteerConfig {
  headlineColor?: string
  headlineSize?: number
  microcopyColor?: string
  microcopySize?: number
  textAlign?: string
  fontFamily?: string
  bgColor?: string
  padding?: number
  verticalAlign?: string
  uppercase?: boolean
  logoPosition?: string
  logoSize?: number
  logoX?: number | null
  logoY?: number | null
  elements?: Array<{ dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex: number }>
  logoDataUrl?: string | null
  ctaStyle?: {
    bgColor: string
    textColor: string
    fontSize: number
    paddingX: number
    paddingY: number
    borderRadius: number
    x: number
    y: number
  }
}

interface CarouselGenerationState {
  generating: boolean
  imageUrls: string[] | null
  errorMsg: string | null
  generationStartTime: number | null
  selectedBrandId: string
  url: string
  setSelectedBrandId: (id: string) => void
  setUrl: (url: string) => void
  startGeneration: (brandId: string, blogUrl: string, userEmail?: string | null) => void
  clearResults: () => void
}

const CarouselGenerationContext = createContext<CarouselGenerationState | null>(null)

function buildSlideRenderParams(slide: SlideData, bgImageUrl: string, config: PuppeteerConfig, brandLogoUrl: string | null) {
  const logoUrl = config.logoDataUrl || brandLogoUrl || null

  // CTA only — no headline/microcopy overlay (GPT bakes copy into the image)
  const cta = config.ctaStyle && slide.ctaText
    ? { text: slide.ctaText, ...config.ctaStyle }
    : null

  return {
    headline: '',
    microcopy: '',
    bgImageDataUrl: bgImageUrl,
    logoUrl: logoUrl || '',
    logoPosition: config.logoPosition || 'bottom-left',
    logoSize: config.logoSize || 48,
    logoX: config.logoX ?? null,
    logoY: config.logoY ?? null,
    padding: config.padding || 60,
    headlineColor: config.headlineColor || '#ffffff',
    headlineSize: config.headlineSize || 72,
    microcopyColor: config.microcopyColor || 'rgba(255,255,255,0.8)',
    microcopySize: config.microcopySize || 28,
    textAlign: config.textAlign || 'left',
    fontFamily: config.fontFamily || 'Inter',
    bgColor: config.bgColor || '#1a1a2e',
    verticalAlign: config.verticalAlign || 'center',
    uppercase: config.uppercase || false,
    elements: config.elements || [],
    cta,
    hideText: false,
  }
}

async function applyOverlayToSlide(
  slide: SlideData,
  bgImageUrl: string,
  config: PuppeteerConfig,
  logoUrl: string | null,
): Promise<{ blobUrl: string; blob: Blob }> {
  const params = buildSlideRenderParams(slide, bgImageUrl, config, logoUrl)
  const res = await fetch('/api/test-render-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`Puppeteer overlay failed for slide`)
  const blob = await res.blob()
  return { blobUrl: URL.createObjectURL(blob), blob }
}

async function saveOverlaidSlides(blobs: Blob[], brandId: string, imageUrls: string[]): Promise<string[]> {
  const finalUrls: string[] = []
  await Promise.all(blobs.map(async (blob, i) => {
    try {
      const uploaded = await uploadMedia(blob, {
        folder: `generated-posts/${brandId}`,
        fileName: `overlay_${Date.now()}_${i}.png`,
      })
      finalUrls[i] = uploaded.url
    } catch {
      finalUrls[i] = imageUrls[i]
    }
  }))
  return finalUrls
}

export function CarouselGenerationProvider({ children }: { children: ReactNode }) {
  const [generating, setGenerating] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [url, setUrl] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartRef = useRef<number>(0)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function startGeneration(brandId: string, blogUrl: string, userEmail?: string | null) {
    const jobId = `${Date.now()}_${brandId}`
    setGenerating(true)
    setImageUrls(null)
    setErrorMsg(null)
    setGenerationStartTime(Date.now())

    authedFetch('/api/blog-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, blogUrl, jobId }),
    }).catch(() => {})

    pollStartRef.current = Date.now()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > 10 * 60 * 1000) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setGenerating(false)
        setErrorMsg('Generation timed out. Please try again.')
        return
      }
      const { data } = await sb.from('carousel_jobs')
        .select('image_urls,layout_id,logo_url,slides')
        .eq('id', jobId)
        .single()

      if (data?.image_urls?.length) {
        clearInterval(pollRef.current!)
        pollRef.current = null

        const rawUrls: string[] = data.image_urls
        const slides: SlideData[] = data.slides || []
        const layoutId: string | null = data.layout_id || null
        const logoUrl: string | null = data.logo_url || null

        // Fetch per-slide puppeteer configs from the layout
        let slideConfigs: PuppeteerConfig[] = Array(6).fill({})
        if (layoutId) {
          const { data: slidePrompts } = await sb
            .from('carousel_slide_prompts')
            .select('slide_index,puppeteer_config')
            .eq('layout_id', layoutId)
            .order('slide_index')
          if (slidePrompts) {
            slideConfigs = Array.from({ length: 6 }, (_, i) => {
              const row = slidePrompts.find((r: { slide_index: number; puppeteer_config?: PuppeteerConfig }) => r.slide_index === i + 1)
              return row?.puppeteer_config || {}
            })
          }
        }

        // Apply Puppeteer overlay sequentially to avoid resource exhaustion
        try {
          const overlayResults: { blobUrl: string; blob: Blob }[] = []
          for (let i = 0; i < rawUrls.length; i++) {
            overlayResults.push(await applyOverlayToSlide(slides[i] || { slideType: 'visual' }, rawUrls[i], slideConfigs[i], logoUrl))
          }
          const blobs = overlayResults.map(r => r.blob)
          const blobUrls = overlayResults.map(r => r.blobUrl)

          // Save overlaid images to storage and DB in background
          saveOverlaidSlides(blobs, brandId, rawUrls).then(async finalUrls => {
            await sb.from('generated_posts').insert(
              finalUrls.map(outputUrl => ({
                brand_id: brandId,
                output_url: outputUrl,
                is_carousel: true,
                ...(userEmail ? { created_by_email: userEmail } : {}),
              }))
            )
          }).catch(() => {})

          setImageUrls(blobUrls)
        } catch {
          // Overlay failed — fall back to raw BG images
          setImageUrls(rawUrls)
        }

        setGenerating(false)
      }
    }, 8000)
  }

  function clearResults() {
    setImageUrls(null)
    setErrorMsg(null)
  }

  return (
    <CarouselGenerationContext.Provider value={{
      generating, imageUrls, errorMsg, generationStartTime,
      selectedBrandId, url,
      setSelectedBrandId, setUrl,
      startGeneration, clearResults,
    }}>
      {children}
    </CarouselGenerationContext.Provider>
  )
}

export function useCarouselGeneration() {
  const ctx = useContext(CarouselGenerationContext)
  if (!ctx) throw new Error('useCarouselGeneration must be used within CarouselGenerationProvider')
  return ctx
}
