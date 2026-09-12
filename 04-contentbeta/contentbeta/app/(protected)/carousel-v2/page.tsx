'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useState, useEffect, useRef } from 'react'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { useAuth } from '@/lib/auth'
import { useLightbox } from '@/lib/lightbox'
import { buildAllCarouselSVG, urlToBase64, type CarouselSlideInput } from '@/lib/static-post-figma'
import OverlayCanvas from '@/components/OverlayCanvas'
import { applyCfgMove, applyCfgReset, buildV2RenderPayload } from '@/lib/carousel-v2-render'
import type { OverlayLayerKey } from '@/lib/overlay-positions'

interface SlideV2 {
  slideType: 'title' | 'problem' | 'insight' | 'shift' | 'action' | 'cta'
  eyebrow?: string | null
  headline?: string
  subhead?: string
  bullets?: string[]
  ctaText?: string | null
  carouselTitle?: string | null
  splitPercent?: number
  logoPos?: string
  visualContext?: string | null
}

interface Colors {
  primaryColor: string
  accentColor: string
  textColor: string
}

interface Brand { id: string; name: string }

type Phase = 'form' | 'copy-generating' | 'copy-review' | 'images-generating' | 'done'

// Copy generation (~25s): scrape + GPT-4o
const COPY_MESSAGES: [number, number, string][] = [
  [0, 15, 'Fetching article…'],
  [15, 28, 'Writing slide copy…'],
  [28, 999, 'Almost there…'],
]
const COPY_CURVE: [number, number][] = [[0, 0], [10, 30], [20, 65], [30, 85], [50, 93]]

// Image generation (~430s): 6 images + overlay
const IMAGE_MESSAGES: [number, number, string][] = [
  [0, 65, 'Generating image 1…'],
  [65, 130, 'Generating image 2…'],
  [130, 195, 'Generating image 3…'],
  [195, 260, 'Generating image 4…'],
  [260, 325, 'Generating image 5…'],
  [325, 390, 'Generating image 6…'],
  [390, 415, 'Rendering slides…'],
  [415, 435, 'Applying brand overlay…'],
  [435, 999, 'Almost there…'],
]
const IMAGE_CURVE: [number, number][] = [[0, 0], [65, 17], [130, 33], [195, 50], [260, 67], [325, 82], [390, 88], [430, 95]]

function interpolate(elapsed: number, curve: [number, number][]): number {
  for (let i = 1; i < curve.length; i++) {
    const [t0, p0] = curve[i - 1]
    const [t1, p1] = curve[i]
    if (elapsed <= t1) return Math.round(p0 + (p1 - p0) * (elapsed - t0) / (t1 - t0))
  }
  return curve[curve.length - 1][1]
}

function ProgressBar({ startTime, messages, curve }: {
  startTime: number
  messages: [number, number, string][]
  curve: [number, number][]
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 800)
    return () => clearInterval(t)
  }, [startTime])
  const msg = messages.find(([s, e]) => elapsed >= s && elapsed < e)?.[2] ?? 'Almost there…'
  const pct = interpolate(elapsed, curve)
  return (
    <div style={{ padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{msg}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

const SLIDE_TYPE_COLORS: Record<string, string> = {
  title: '#6366f1', problem: '#e74c3c', insight: '#f59e0b',
  shift: '#10b981', action: '#3b82f6', cta: '#8b5cf6',
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  title: 'Title', problem: 'Problem', insight: 'Insight',
  shift: 'Shift', action: 'Action', cta: 'CTA',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function CopyReviewPanel({ slides, activeIdx, onSelect, onChange }: {
  slides: SlideV2[]
  activeIdx: number
  onSelect: (i: number) => void
  onChange: (i: number, updated: SlideV2) => void
}) {
  const slide = slides[activeIdx]
  if (!slide) return null
  const typeColor = SLIDE_TYPE_COLORS[slide.slideType] || '#6366f1'
  const hasBullets = slide.slideType !== 'title' && slide.slideType !== 'cta'

  function updateBullet(bi: number, val: string) {
    const bullets = [...(slide.bullets || [])]
    bullets[bi] = val
    onChange(activeIdx, { ...slide, bullets })
  }
  function addBullet() {
    onChange(activeIdx, { ...slide, bullets: [...(slide.bullets || []), ''] })
  }
  function removeBullet(bi: number) {
    onChange(activeIdx, { ...slide, bullets: (slide.bullets || []).filter((_, idx) => idx !== bi) })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 13, padding: '9px 12px',
    border: '1px solid var(--border)', borderRadius: 8,
    background: 'var(--surface)', color: 'var(--text)',
    boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
  }
  const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' }

  return (
    <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Left navigator ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
        {slides.map((s, i) => {
          const color = SLIDE_TYPE_COLORS[s.slideType] || '#6366f1'
          const isActive = i === activeIdx
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 14px',
                background: isActive ? 'var(--bg)' : 'transparent',
                borderLeft: `3px solid ${isActive ? color : 'transparent'}`,
                borderTop: 'none', borderRight: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, width: 18, height: 18, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: isActive ? color : `${color}22`, color: isActive ? '#fff' : color,
                  transition: 'all 0.12s',
                }}>{i + 1}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? color : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {SLIDE_TYPE_LABELS[s.slideType] || s.slideType}
                </span>
              </div>
              <p style={{
                margin: 0, fontSize: 11, color: isActive ? 'var(--text)' : 'var(--muted)',
                lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                fontWeight: isActive ? 500 : 400,
              }}>
                {(s.headline || '').replace(/\*\*/g, '')}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── Right editor ── */}
      <div style={{ flex: 1, minWidth: 0, padding: 24, overflowY: 'auto', maxHeight: 540 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: `${typeColor}18`, color: typeColor, textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>{SLIDE_TYPE_LABELS[slide.slideType] || slide.slideType}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Slide {activeIdx + 1} of {slides.length}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Eyebrow */}
          {slide.slideType === 'title' && (
            <div>
              <FieldLabel>Eyebrow</FieldLabel>
              <input
                value={slide.eyebrow || ''}
                onChange={e => onChange(activeIdx, { ...slide, eyebrow: e.target.value })}
                placeholder="Short label, e.g. 'The real cost'"
                style={inputStyle}
              />
            </div>
          )}

          {/* Headline */}
          <div>
            <FieldLabel>Headline</FieldLabel>
            <textarea
              rows={3}
              value={slide.headline || ''}
              onChange={e => onChange(activeIdx, { ...slide, headline: e.target.value })}
              placeholder="Write the main headline…"
              style={{ ...textareaStyle, fontSize: 14, fontWeight: 600 }}
            />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Wrap key words in <code style={{ fontSize: 10, background: 'var(--surface)', padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border)' }}>**asterisks**</code> for emphasis
            </p>
          </div>

          {/* Subhead */}
          {slide.slideType !== 'cta' && (
            <div>
              <FieldLabel>Subhead</FieldLabel>
              <textarea
                rows={2}
                value={slide.subhead || ''}
                onChange={e => onChange(activeIdx, { ...slide, subhead: e.target.value })}
                placeholder="One supporting sentence…"
                style={textareaStyle}
              />
            </div>
          )}

          {/* Bullets */}
          {hasBullets && (
            <div>
              <FieldLabel>Bullets</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(slide.bullets || []).map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: typeColor, fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>·</span>
                    <input
                      value={b}
                      onChange={e => updateBullet(bi, e.target.value)}
                      placeholder={`Bullet point ${bi + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => removeBullet(bi)}
                      style={{ flexShrink: 0, width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'inherit' }}
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={addBullet}
                  style={{ alignSelf: 'flex-start', marginTop: 2, fontSize: 12, fontWeight: 600, color: typeColor, background: `${typeColor}12`, border: `1px solid ${typeColor}30`, borderRadius: 6, cursor: 'pointer', padding: '5px 12px' }}
                >
                  + Add bullet
                </button>
              </div>
            </div>
          )}

          {/* CTA */}
          {slide.slideType === 'cta' && (
            <div>
              <FieldLabel>CTA Button Text</FieldLabel>
              <input
                value={slide.ctaText || ''}
                onChange={e => onChange(activeIdx, { ...slide, ctaText: e.target.value })}
                placeholder="e.g. Read the full article"
                style={inputStyle}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface CarouselLayout { id: string; name: string }

export default function CarouselV2Page() {
  const { userRole, userBrandId, userAllowedPages, userEmail } = useAuth()
  const { openLightbox } = useLightbox()

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [layouts, setLayouts] = useState<CarouselLayout[]>([])
  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [url, setUrl] = useState('')

  const [phase, setPhase] = useState<Phase>('form')
  const [phaseStartTime, setPhaseStartTime] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Copy state
  const [editableSlides, setEditableSlides] = useState<SlideV2[]>([])
  const [activeSlideIdx, setActiveSlideIdx] = useState(0)
  const [colors, setColors] = useState<Colors | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null)

  // Image / render state (same as before)
  const [slides, setSlides] = useState<SlideV2[]>([])
  const [imageUrls, setImageUrls] = useState<string[] | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderedUrls, setRenderedUrls] = useState<string[] | null>(null)
  const [copyingToFigma, setCopyingToFigma] = useState(false)
  const [copiedToFigma, setCopiedToFigma] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [applyingEdit, setApplyingEdit] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const renderStartedRef = useRef(false)

  const canAccess = userRole === 'admin' || userAllowedPages.includes('carousel-v2')
  const effectiveBrandId = userRole === 'user' ? userBrandId : selectedBrandId

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [userRole])

  useEffect(() => {
    if (userRole !== 'admin' || !effectiveBrandId) { setLayouts([]); setSelectedLayoutId(''); return }
    sb.from('carousel_layouts').select('id,name').eq('brand_id', effectiveBrandId).order('created_at')
      .then(({ data }) => { setLayouts(data || []); setSelectedLayoutId('') })
  }, [effectiveBrandId, userRole])

  function resetToForm() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
    setPhase('form')
    setErrorMsg(null)
    setEditableSlides([])
    setColors(null)
    setLogoUrl(null)
    setImageUrls(null)
    setRenderedUrls(null)
    setSlides([])
    renderStartedRef.current = false
  }

  async function handleGenerateCopy() {
    if (!effectiveBrandId || !url.trim()) return
    setPhase('copy-generating')
    setPhaseStartTime(Date.now())
    setErrorMsg(null)
    setEditableSlides([])
    setImageUrls(null)
    setRenderedUrls(null)
    setSlides([])
    renderStartedRef.current = false

    try {
      const res = await authedFetch('/api/carousel/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: effectiveBrandId, blogUrl: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Copy generation failed')

      // Resolve layoutId (same logic as before — pick randomly if not set by admin)
      let layoutId = selectedLayoutId || null
      if (!layoutId) {
        const { data: allLayouts } = await sb.from('carousel_layouts').select('id').eq('brand_id', effectiveBrandId)
        if (allLayouts && allLayouts.length > 0) {
          const lastUsed = localStorage.getItem(`lastLayoutId_${effectiveBrandId}`)
          const candidates = allLayouts.length > 1 && lastUsed
            ? allLayouts.filter(l => l.id !== lastUsed)
            : allLayouts
          layoutId = candidates[Math.floor(Math.random() * candidates.length)].id
          if (layoutId) localStorage.setItem(`lastLayoutId_${effectiveBrandId}`, layoutId)
        }
      }

      setEditableSlides(data.slides || [])
      setColors(data.colors || null)
      setLogoUrl(data.logoUrl || null)
      setActiveLayoutId(layoutId)
      setPhase('copy-review')
    } catch (err) {
      setErrorMsg((err as Error).message)
      setPhase('form')
    }
  }

  async function handleGenerateImages() {
    if (!effectiveBrandId || !editableSlides.length) return
    setPhase('images-generating')
    setPhaseStartTime(Date.now())
    setErrorMsg(null)
    setImageUrls(null)
    setRenderedUrls(null)
    renderStartedRef.current = false

    const jobId = `v2_img_${Date.now()}_${effectiveBrandId}`

    await authedFetch('/api/carousel-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: effectiveBrandId,
        jobId,
        layoutId: activeLayoutId,
        logoUrl,
        colors,
        slides: editableSlides,
      }),
    }).catch(() => { })

    const start = Date.now()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const { data } = await sb
        .from('carousel_jobs')
        .select('image_urls,slides,logo_url')
        .eq('id', jobId)
        .maybeSingle()

      if (data?.image_urls?.length) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        if (renderStartedRef.current) return
        renderStartedRef.current = true
        const slideData: SlideV2[] = data.slides || []
        const extractedColors = (slideData[0] as SlideV2 & { _colors?: Colors })?._colors || null
        setSlides(slideData)
        setColors(extractedColors)
        setLogoUrl(data.logo_url || null)
        setImageUrls(data.image_urls)
        applyOverlays(data.image_urls, slideData, extractedColors, data.logo_url, activeLayoutId)
        return
      }

      if (Date.now() - start > 15 * 60 * 1000) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setPhase('form')
        setErrorMsg('Image generation timed out. Please try again.')
      }
    }, 6000)
  }

  async function applyOverlays(rawUrls: string[], slideData: SlideV2[], colorData: Colors | null, logo: string | null, layoutId?: string | null) {
    if (!colorData) { setImageUrls(rawUrls); setPhase('done'); return }
    setRendering(true)

    const dbConfigMap: Record<number, Record<string, unknown>> = {}
    if (layoutId) {
      const { data: slidePrompts } = await sb
        .from('carousel_slide_prompts')
        .select('slide_index,puppeteer_config')
        .eq('layout_id', layoutId)
      if (slidePrompts) {
        for (const sp of slidePrompts) {
          dbConfigMap[sp.slide_index] = sp.puppeteer_config || {}
        }
      }
    }

    const results: string[] = []
    const renderedBlobs: (Blob | null)[] = []
    for (let i = 0; i < rawUrls.length; i++) {
      try {
        const slide = slideData[i]
        // Read template logo BEFORE merging n8n config — n8n may send a different/null logo
        const templateLogo = (dbConfigMap[i + 1]?.logoDataUrl as string | null) || null
        const n8nCfg = (slide as SlideV2 & { _cfg?: Record<string, unknown> })?._cfg || {}
        const cfg: Record<string, unknown> = { ...dbConfigMap[i + 1] }
        for (const [key, val] of Object.entries(n8nCfg)) {
          if (val !== undefined) cfg[key] = val
        }
        // Template logo always wins over n8n's logo; fall back to brand default
        const effectiveLogo = templateLogo || logo
        cfg.logoDataUrl = effectiveLogo
          ; (slideData[i] as SlideV2 & { _cfg?: Record<string, unknown> })._cfg = cfg

        let subjectImageDataUrl: string | null = null
        if (cfg.removeBg === true || cfg.removeBg === 'true') {
          try {
            const removedRes = await authedFetch('/api/remove-bg', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: rawUrls[i] }),
            })
            if (removedRes.ok) {
              const removedBlob = await removedRes.blob()
              subjectImageDataUrl = await new Promise(res => {
                const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(removedBlob)
              })
            }
          } catch { /* ignore */ }
        }

        const res = await authedFetch('/api/test-render-slide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildV2RenderPayload({
            slide: slide || {},
            cfg,
            colors: colorData,
            bgImageUrl: rawUrls[i],
            logoUrl: effectiveLogo,
            subjectImageDataUrl,
          })),
        })
        if (res.ok) {
          const blob = await res.blob()
          results.push(URL.createObjectURL(blob))
          renderedBlobs.push(blob)
        } else {
          results.push(rawUrls[i])
          renderedBlobs.push(null)
        }
      } catch {
        results.push(rawUrls[i])
        renderedBlobs.push(null)
      }
    }
    setRenderedUrls(results)
    setRendering(false)
    setPhase('done')

    if (effectiveBrandId) {
      const ts = Date.now()
      const saved: string[] = []
      for (let i = 0; i < renderedBlobs.length; i++) {
        const blob = renderedBlobs[i]
        if (!blob) continue
        try {
          const fileName = `v2_${ts}_${i}.png`
          const uploaded = await uploadMedia(blob, { folder: `generated-posts/${effectiveBrandId}`, fileName })
          saved.push(uploaded.url)
        } catch { /* ignore */ }
      }
      if (saved.length) {
        const sessionId = `v2_${ts}`
        try {
          await sb.from('generated_posts').insert(saved.map(output_url => ({
            brand_id: effectiveBrandId, output_url, is_carousel: true,
            carousel_session_id: sessionId,
            ...(userEmail ? { created_by_email: userEmail } : {}),
          })))
        } catch { /* ignore */ }
      }
    }
  }

  async function copyAllToFigma() {
    if (!imageUrls || !slides.length) return
    setCopyingToFigma(true)
    try {
      const bgDataUrls = await Promise.all(imageUrls.map(u => urlToBase64(u).catch(() => u)))
      const logoDataUrl = logoUrl ? await urlToBase64(logoUrl).catch(() => null) : null

      const slideInputs: CarouselSlideInput[] = imageUrls.map((_, i) => {
        const slide = slides[i] as SlideV2 & { _cfg?: Record<string, unknown> }
        const cfg = slide?._cfg || {}
        const effectivePrimary = (cfg.primaryColor as string | null) || colors?.primaryColor || '#1a1a2e'
        const effectiveAccent = (cfg.accentColor as string | null) || colors?.accentColor || '#3b82f6'
        const effectiveText = (cfg.textColor as string | null) || colors?.textColor || '#ffffff'
        const ctaStyleCfg = (cfg.ctaStyle as Record<string, unknown>) || {}
        return {
          bgImageDataUrl: bgDataUrls[i],
          logoDataUrl: (cfg.logoDataUrl as string | null) || logoDataUrl || null,
          eyebrow: slide?.eyebrow ?? null,
          carouselTitle: slide?.carouselTitle ?? null,
          headline: slide?.headline || null,
          subhead: slide?.subhead || null,
          bullets: slide?.bullets || [],
          ctaText: slide?.ctaText || null,
          slideType: slide?.slideType || null,
          primaryColor: effectivePrimary,
          accentColor: effectiveAccent,
          textColor: effectiveText,
          microcopyColor: (cfg.microcopyColor as string | null) || null,
          splitPercent: (cfg.splitPercent as number | null) ?? slide?.splitPercent ?? null,
          padding: (cfg.padding as number | null) || 60,
          verticalAlign: (cfg.verticalAlign as string | null) || 'center',
          fontFamily: (cfg.fontFamily as string | null) || null,
          customFontDataUrl: (cfg.customFontDataUrl as string | null) || null,
          customFontUrl: (cfg.customFontUrl as string | null) || null,
          headlineFontFamily: (cfg.headlineFontFamily as string | null) || null,
          headlineCustomFontDataUrl: (cfg.headlineCustomFontDataUrl as string | null) || null,
          headlineCustomFontUrl: (cfg.headlineCustomFontUrl as string | null) || null,
          eyebrowFontFamily: (cfg.eyebrowFontFamily as string | null) || null,
          eyebrowCustomFontDataUrl: (cfg.eyebrowCustomFontDataUrl as string | null) || null,
          eyebrowCustomFontUrl: (cfg.eyebrowCustomFontUrl as string | null) || null,
          microcopyFontFamily: (cfg.microcopyFontFamily as string | null) || null,
          microcopyCustomFontDataUrl: (cfg.microcopyCustomFontDataUrl as string | null) || null,
          microcopyCustomFontUrl: (cfg.microcopyCustomFontUrl as string | null) || null,
          bulletFontFamily: (cfg.bulletFontFamily as string | null) || null,
          bulletCustomFontDataUrl: (cfg.bulletCustomFontDataUrl as string | null) || null,
          bulletCustomFontUrl: (cfg.bulletCustomFontUrl as string | null) || null,
          ctaFontFamily: (cfg.ctaFontFamily as string | null) || null,
          ctaCustomFontDataUrl: (cfg.ctaCustomFontDataUrl as string | null) || null,
          ctaCustomFontUrl: (cfg.ctaCustomFontUrl as string | null) || null,
          headlineSize: (cfg.headlineSize as number | null) || null,
          microcopySize: (cfg.microcopySize as number | null) || null,
          bulletSize: (cfg.bulletSize as number | null) || null,
          eyebrowSize: (cfg.eyebrowSize as number | null) || null,
          logoPosition: (cfg.logoPosition as string | null) || slide?.logoPos || 'bottom-left',
          logoX: (cfg.logoX as number | null) ?? null,
          logoY: (cfg.logoY as number | null) ?? null,
          logoSize: (cfg.logoSize as number | null) || 48,
          ctaStyle: slide?.ctaText ? {
            bgColor: ctaStyleCfg.bgColor as string || '#ffffff',
            textColor: ctaStyleCfg.textColor as string || effectivePrimary,
            fontSize: ctaStyleCfg.fontSize as number || 14,
            paddingX: ctaStyleCfg.paddingX as number || 36,
            paddingY: ctaStyleCfg.paddingY as number || 18,
            borderRadius: ctaStyleCfg.borderRadius as number || 4,
          } : null,
          ctaPosition: (cfg.ctaPosition as string | null) || null,
          textX: (cfg.textX as number | null) ?? null,
          textY: (cfg.textY as number | null) ?? null,
          headlineX: (cfg.headlineX as number | null) ?? null,
          headlineY: (cfg.headlineY as number | null) ?? null,
          microcopyX: (cfg.microcopyX as number | null) ?? null,
          microcopyY: (cfg.microcopyY as number | null) ?? null,
          eyebrowX: (cfg.eyebrowX as number | null) ?? null,
          eyebrowY: (cfg.eyebrowY as number | null) ?? null,
          bulletsX: (cfg.bulletsX as number | null) ?? null,
          bulletsY: (cfg.bulletsY as number | null) ?? null,
          eyebrowGap: (cfg.eyebrowGap as number | null) ?? null,
          headlineGap: (cfg.headlineGap as number | null) ?? null,
          subheadGap: (cfg.subheadGap as number | null) ?? null,
          eyebrowColor: (cfg.eyebrowColor as string | null) || null,
          accentBgEnabled: (cfg.accentBgEnabled as boolean) || false,
          accentBgColor: (cfg.accentBgColor as string | null) || null,
          accentBgPadding: (cfg.accentBgPadding as number) ?? 4,
          accentBgRadius: (cfg.accentBgRadius as number) ?? 2,
          elements: ((cfg.elements as Array<{ dataUrl: string; x: number; y: number; width: number; height?: number; opacity: number; zIndex?: number }>) || []).map(el => ({
            ...el, height: el.height ?? el.width,
          })),
        }
      })

      const svg = await buildAllCarouselSVG(slideInputs)
      await navigator.clipboard.writeText(svg)
      setCopiedToFigma(true)
      setTimeout(() => setCopiedToFigma(false), 2000)
    } catch { /* silent */ }
    finally { setCopyingToFigma(false) }
  }

  function slideCfg(i: number): Record<string, unknown> {
    return (slides[i] as SlideV2 & { _cfg?: Record<string, unknown> })?._cfg || {}
  }

  function patchSlideCfg(i: number, updater: (cfg: Record<string, unknown>) => Record<string, unknown>) {
    setSlides(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      const cfg = { ...((s as SlideV2 & { _cfg?: Record<string, unknown> })._cfg || {}) }
      return { ...s, _cfg: updater(cfg) } as SlideV2
    }))
  }

  function handleJobMove(key: OverlayLayerKey, x: number, y: number) {
    if (editingIdx == null) return
    patchSlideCfg(editingIdx, cfg => applyCfgMove(cfg, key, x, y))
  }

  function handleJobReset(key: OverlayLayerKey) {
    if (editingIdx == null) return
    patchSlideCfg(editingIdx, cfg => applyCfgReset(cfg, key))
  }

  async function applySlideEdit() {
    if (editingIdx == null || !imageUrls || !colors) return
    const i = editingIdx
    setApplyingEdit(true)
    try {
      const slide = slides[i]
      const cfg = slideCfg(i)
      const res = await authedFetch('/api/test-render-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildV2RenderPayload({
          slide,
          cfg,
          colors,
          bgImageUrl: imageUrls[i],
          logoUrl: (cfg.logoDataUrl as string | null) || logoUrl,
        })),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setRenderedUrls(prev => {
        const next = [...(prev || imageUrls || [])]
        next[i] = url
        return next
      })
      setEditingIdx(null)
    } finally {
      setApplyingEdit(false)
    }
  }

  const displayUrls = renderedUrls ?? imageUrls

  if (!canAccess) return <p style={{ padding: '40px' }}>You don&apos;t have access to this page.</p>

  return (
    <>
      <h1>Blog to Carousel</h1>
      <p className="subtitle">Paste a blog or article URL to generate carousel images from the content.</p>

      {/* ── FORM ─────────────────────────────────────────────────────────────── */}
      {phase === 'form' && (
        <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
          <div className="form-card">
            <h2>Settings</h2>

            {userRole === 'admin' && (
              <>
                <div className="form-group">
                  <label>Brand</label>
                  <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}>
                    <option value="">Select a brand…</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                {layouts.length > 0 && (
                  <div className="form-group">
                    <label>Layout <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(leave blank to pick randomly)</span></label>
                    <select value={selectedLayoutId} onChange={e => setSelectedLayoutId(e.target.value)}>
                      <option value="">Random</option>
                      {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label>Article URL</label>
              <input
                type="text"
                placeholder="https://example.com/your-blog-post"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerateCopy() }}
              />
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>
                {errorMsg}
              </div>
            )}

            <button
              className="generate-btn"
              onClick={handleGenerateCopy}
              disabled={!effectiveBrandId || !url.trim()}
            >
              Generate Carousel
            </button>
          </div>
        </div>
      )}

      {/* ── COPY GENERATING ──────────────────────────────────────────────────── */}
      {phase === 'copy-generating' && (
        <div className="form-card" style={{ maxWidth: 520 }}>
          <h2 style={{ margin: '0 0 4px', opacity: 0.5 }}>Generating slide copy…</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>Scraping your article and writing carousel copy with AI.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />
            ))}
          </div>
          <ProgressBar startTime={phaseStartTime} messages={COPY_MESSAGES} curve={COPY_CURVE} />
        </div>
      )}

      {/* ── COPY REVIEW ──────────────────────────────────────────────────────── */}
      {phase === 'copy-review' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Review Slide Copy</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                Edit any text before generating the background images.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={resetToForm}
                style={{ fontSize: 13, padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                ← Start over
              </button>
              <button
                className="generate-btn"
                style={{ width: 'auto', padding: '7px 20px' }}
                onClick={handleGenerateImages}
              >
                Generate Carousel →
              </button>
            </div>
          </div>

          <CopyReviewPanel
            slides={editableSlides}
            activeIdx={activeSlideIdx}
            onSelect={setActiveSlideIdx}
            onChange={(i, updated) => {
              const next = [...editableSlides]
              next[i] = updated
              setEditableSlides(next)
            }}
          />

        </div>
      )}

      {/* ── IMAGES GENERATING + DONE ─────────────────────────────────────────── */}
      {(phase === 'images-generating' || phase === 'done') && (
        <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
          {/* left: copy summary */}
          <div className="form-card" style={{ minWidth: 220 }}>
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Slide Copy</h2>
            </div>
            {(phase === 'done' ? slides : editableSlides).map((slide, i) => (
              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>#{i + 1}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase',
                    background: `${SLIDE_TYPE_COLORS[slide.slideType] || '#6366f1'}20`,
                    color: SLIDE_TYPE_COLORS[slide.slideType] || '#6366f1',
                  }}>{slide.slideType}</span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px', lineHeight: 1.3 }}>
                  {(slide.headline || '').replace(/\*\*/g, '')}
                </p>
                {slide.subhead && (
                  <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0, lineHeight: 1.3 }}>
                    {slide.subhead.replace(/\*\*/g, '')}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* right: output area */}
          <div style={{ flex: 1 }}>
            {(phase === 'done') && !rendering && displayUrls && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <button
                  onClick={resetToForm}
                  style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--primary, #6366f1)', color: '#fff', cursor: 'pointer' }}
                >
                  + New carousel
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => displayUrls.forEach((u, i) => { const a = document.createElement('a'); a.href = u; a.download = `carousel_v2_slide_${i + 1}.png`; a.click() })}
                    className="btn btn-secondary btn-sm"
                  >
                    Download All
                  </button>
                  <button
                    disabled={copyingToFigma}
                    onClick={copyAllToFigma}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '5px', border: '1px solid #6366f1', background: copiedToFigma ? '#6366f1' : 'transparent', color: copiedToFigma ? '#fff' : '#6366f1', fontSize: '11px', cursor: copyingToFigma ? 'wait' : 'pointer', fontWeight: 600, transition: 'all 0.15s', opacity: copyingToFigma ? 0.7 : 1, lineHeight: 1 }}>
                    {copyingToFigma ? 'Copying…' : copiedToFigma ? '✓ Copied!' : <>Copy to Figma <span style={{ fontSize: '8px', fontWeight: 700, background: copiedToFigma ? 'rgba(255,255,255,0.3)' : '#6366f1', color: '#fff', borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.05em' }}>BETA</span></>}
                  </button>
                </div>
              </div>
            )}

            <div className="output-area">
              {(phase === 'images-generating' || rendering) && (
                <div style={{ width: '100%' }}>
                  <div className="output-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="output-grid-item skeleton" style={{ minHeight: '200px' }} />
                    ))}
                  </div>
                  <div style={{ padding: '0 16px 16px' }}>
                    <ProgressBar startTime={phaseStartTime} messages={IMAGE_MESSAGES} curve={IMAGE_CURVE} />
                  </div>
                </div>
              )}

              {phase === 'done' && !rendering && displayUrls && (
                <>
                  <div className="output-grid">
                    {displayUrls.map((imgUrl, i) => (
                      <div key={i} className="output-grid-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={`Slide ${i + 1}`}
                          loading="lazy"
                          style={{ cursor: 'zoom-in' }}
                          onClick={() => openLightbox(imgUrl)}
                        />
                        <div className="output-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingIdx(i)}
                          >
                            Edit layout
                          </button>
                          <a href={imgUrl} download={`carousel_v2_slide_${i + 1}.png`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editingIdx != null && colors && imageUrls && slides[editingIdx] && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => !applyingEdit && setEditingIdx(null)}
        >
          <div
            className="form-card"
            style={{ width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto', margin: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Edit slide {editingIdx + 1} layout</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingIdx(null)}
                disabled={applyingEdit}
              >
                Close
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
              Job-only tweak — this does not change the brand template. Drag, then Apply to re-render the PNG.
            </p>
            <OverlayCanvas
              payload={buildV2RenderPayload({
                slide: slides[editingIdx],
                cfg: slideCfg(editingIdx),
                colors,
                bgImageUrl: imageUrls[editingIdx],
                logoUrl: (slideCfg(editingIdx).logoDataUrl as string | null) || logoUrl,
              })}
              onMove={handleJobMove}
              onReset={handleJobReset}
              padding={(slideCfg(editingIdx).padding as number) || 60}
            />
            <button
              className="generate-btn"
              style={{ marginTop: 14 }}
              onClick={applySlideEdit}
              disabled={applyingEdit}
            >
              {applyingEdit ? 'Applying…' : 'Apply to this slide'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
