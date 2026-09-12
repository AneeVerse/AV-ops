'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import OverlayCanvas from '@/components/OverlayCanvas'
import { overlayMovePatch, overlayResetPatch, type OverlayLayerKey } from '@/lib/overlay-positions'

interface CarouselLayout { id: string; name: string }

interface PuppeteerElement {
  dataUrl: string
  x: number
  y: number
  width: number
  opacity: number
  zIndex: number
}

interface PuppeteerConfig {
  headlineColor: string
  headlineSize: number
  microcopyColor: string
  microcopySize: number
  textAlign: string
  fontFamily: string
  bgColor: string
  padding: number
  splitPercent: number | null
  verticalAlign: string
  uppercase: boolean
  logoPosition: string
  logoSize: number
  logoX: number | null
  logoY: number | null
  textX: number | null
  textY: number | null
  headlineX: number | null
  headlineY: number | null
  microcopyX: number | null
  microcopyY: number | null
  eyebrowX: number | null
  eyebrowY: number | null
  bulletsX: number | null
  bulletsY: number | null
  accentColor: string
  accentFontFamily: string
  accentCustomFontDataUrl: string | null
  accentBgEnabled: boolean
  accentBgColor: string
  accentBgPadding: number
  accentBgRadius: number
  accentUnderline: boolean
  accentUnderlineColor: string
  eyebrowColor: string
  eyebrowGap: number
  headlineGap: number
  subheadGap: number
  bulletSize: number
  eyebrowSize: number
  eyebrowUppercase: boolean
  ctaPosition: string
  customFontDataUrl: string | null
  customFontUrl: string | null
  headlineFontFamily: string
  headlineCustomFontDataUrl: string | null
  headlineCustomFontUrl: string | null
  eyebrowFontFamily: string
  eyebrowCustomFontDataUrl: string | null
  eyebrowCustomFontUrl: string | null
  microcopyFontFamily: string
  microcopyCustomFontDataUrl: string | null
  microcopyCustomFontUrl: string | null
  bulletFontFamily: string
  bulletCustomFontDataUrl: string | null
  bulletCustomFontUrl: string | null
  ctaFontFamily: string
  ctaCustomFontDataUrl: string | null
  ctaCustomFontUrl: string | null
  removeBg: boolean
  elements: PuppeteerElement[]
  logoDataUrl: string | null
  ctaStyle: {
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

interface SlideState {
  prompt: string
  config: PuppeteerConfig
  saving: boolean
  previewing: boolean
  previewUrl: string | null
  testBgUrl: string | null
  testLogoUrl: string | null
  testCtaText: string
  testEyebrow: string
  testHeadline: string
  testSubhead: string
  testBullets: string
  expanded: boolean
  isDirty: boolean
}

const DEFAULT_CONFIG = (): PuppeteerConfig => ({
  eyebrowColor: '',
  headlineColor: '#ffffff',
  headlineSize: 72,
  microcopyColor: '#cccccc',
  microcopySize: 28,
  textAlign: 'left',
  fontFamily: 'Inter',
  bgColor: '#1a1a2e',
  padding: 60,
  splitPercent: null,
  verticalAlign: 'center',
  uppercase: false,
  logoPosition: 'bottom-left',
  logoSize: 48,
  logoX: null,
  logoY: null,
  textX: null,
  textY: null,
  headlineX: null,
  headlineY: null,
  microcopyX: null,
  microcopyY: null,
  eyebrowX: null,
  eyebrowY: null,
  bulletsX: null,
  bulletsY: null,
  accentColor: '#3b82f6',
  accentFontFamily: '',
  accentCustomFontDataUrl: null,
  accentBgEnabled: false,
  accentBgColor: '#ffffff',
  accentBgPadding: 4,
  accentBgRadius: 2,
  accentUnderline: false,
  accentUnderlineColor: '',
  eyebrowGap: 16,
  headlineGap: 20,
  subheadGap: 28,
  bulletSize: 18,
  eyebrowSize: 13,
  eyebrowUppercase: true,
  ctaPosition: 'center',
  customFontDataUrl: null,
  customFontUrl: null,
  headlineFontFamily: '',
  headlineCustomFontDataUrl: null,
  headlineCustomFontUrl: null,
  eyebrowFontFamily: '',
  eyebrowCustomFontDataUrl: null,
  eyebrowCustomFontUrl: null,
  microcopyFontFamily: '',
  microcopyCustomFontDataUrl: null,
  microcopyCustomFontUrl: null,
  bulletFontFamily: '',
  bulletCustomFontDataUrl: null,
  bulletCustomFontUrl: null,
  ctaFontFamily: '',
  ctaCustomFontDataUrl: null,
  ctaCustomFontUrl: null,
  removeBg: false,
  elements: [],
  logoDataUrl: null,
  ctaStyle: { bgColor: '#ffffff', textColor: '#000000', fontSize: 18, paddingX: 32, paddingY: 14, borderRadius: 9999, x: 60, y: 900 },
})

const SLIDE_LABELS = [
  'Slide 1 — Title',
  'Slide 2 — Visual',
  'Slide 3 — Text',
  'Slide 4 — Visual',
  'Slide 5 — Text',
  'Slide 6 — CTA',
]
const FONT_OPTIONS = ['Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Lato', 'Poppins', 'Open Sans', 'Industry']

function defaultSlide(): SlideState {
  return { prompt: '', config: DEFAULT_CONFIG(), saving: false, previewing: false, previewUrl: null, testBgUrl: null, testLogoUrl: null, testCtaText: '', testEyebrow: '', testHeadline: '', testSubhead: '', testBullets: '', expanded: false, isDirty: false }
}

export default function CarouselLayoutDetailPage() {
  const { id: brandId, layoutId } = useParams<{ id: string; layoutId: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [layout, setLayout] = useState<CarouselLayout | null>(null)
  const [slides, setSlides] = useState<SlideState[]>(Array.from({ length: 6 }, defaultSlide))
  const [savingAll, setSavingAll] = useState(false)
  const bgInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const logoInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const elInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { loadData() }, [layoutId])

  async function loadData() {
    const [{ data: l }, { data: sp }] = await Promise.all([
      sb.from('carousel_layouts').select('id,name').eq('id', layoutId).single(),
      sb.from('carousel_slide_prompts').select('*').eq('layout_id', layoutId).order('slide_index'),
    ])
    setLayout(l)
    const filled = Array.from({ length: 6 }, defaultSlide)
    ;(sp || []).forEach((row: { slide_index: number; prompt: string; puppeteer_config?: PuppeteerConfig }) => {
      const i = row.slide_index - 1
      if (i >= 0 && i < 6) {
        filled[i].prompt = row.prompt || ''
        if (row.puppeteer_config) {
          filled[i].config = { ...DEFAULT_CONFIG(), ...row.puppeteer_config }
          if (row.puppeteer_config.logoDataUrl) filled[i].testLogoUrl = row.puppeteer_config.logoDataUrl
        }
      }
    })
    setSlides(filled)
  }

  function updateSlide(index: number, patch: Partial<SlideState>) {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function updateConfig(index: number, patch: Partial<PuppeteerConfig>) {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, config: { ...s.config, ...patch }, isDirty: true } : s))
  }

  function updateEl(index: number, elIndex: number, key: keyof PuppeteerElement, val: unknown) {
    setSlides(prev => prev.map((s, i) => {
      if (i !== index) return s
      return { ...s, config: { ...s.config, elements: s.config.elements.map((el, ei) => ei === elIndex ? { ...el, [key]: val } : el) }, isDirty: true }
    }))
  }

  function removeEl(index: number, elIndex: number) {
    setSlides(prev => prev.map((s, i) => {
      if (i !== index) return s
      return { ...s, config: { ...s.config, elements: s.config.elements.filter((_, ei) => ei !== elIndex) }, isDirty: true }
    }))
  }

  async function handleSaveSlide(index: number) {
    updateSlide(index, { saving: true })
    try {
      const s = slides[index]
      const { error } = await sb.from('carousel_slide_prompts').upsert(
        { layout_id: layoutId, slide_index: index + 1, prompt: s.prompt.trim(), puppeteer_config: s.config },
        { onConflict: 'layout_id,slide_index' }
      )
      if (error) { showToast(error.message, true); return }
      updateSlide(index, { isDirty: false })
      showToast(`Slide ${index + 1} saved.`)
    } finally {
      updateSlide(index, { saving: false })
    }
  }

  async function handleSaveAll() {
    setSavingAll(true)
    try {
      const rows = slides.map((s, i) => ({
        layout_id: layoutId,
        slide_index: i + 1,
        prompt: s.prompt.trim(),
        puppeteer_config: s.config,
      }))
      const { error } = await sb.from('carousel_slide_prompts').upsert(rows, { onConflict: 'layout_id,slide_index' })
      if (error) { showToast(error.message, true); return }
      setSlides(prev => prev.map(s => ({ ...s, isDirty: false })))
      showToast('All slides saved.')
    } finally {
      setSavingAll(false)
    }
  }

  function handleTestBgUpload(index: number, file: File) {
    const reader = new FileReader()
    reader.onload = ev => updateSlide(index, { testBgUrl: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  function handleTestLogoUpload(index: number, file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      updateSlide(index, { testLogoUrl: dataUrl })
      updateConfig(index, { logoDataUrl: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  function handleElementUpload(index: number, file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      const el: PuppeteerElement = { dataUrl, x: 0, y: 0, width: 200, opacity: 100, zIndex: 1 }
      setSlides(prev => prev.map((s, i) => i === index ? { ...s, config: { ...s.config, elements: [...s.config.elements, el] }, isDirty: true } : s))
    }
    reader.readAsDataURL(file)
  }

  async function handlePreview(index: number) {
    const s = slides[index]
    if (!s.testBgUrl) return
    updateSlide(index, { previewing: true, previewUrl: null })
    const hasV2Text = !!(s.testEyebrow || s.testHeadline || s.testSubhead || s.testBullets)
    try {
      const bullets = s.testBullets ? s.testBullets.split('\n').map(b => b.trim()).filter(Boolean) : []
      const body = hasV2Text ? {
        // V2 renderer — shows split layout with bullets, bold markers, accent color
        v2: true,
        slideType: index === 0 ? 'title' : index === 5 ? 'cta' : 'problem',
        headline: s.testHeadline,
        microcopy: s.testSubhead,
        bullets,
        eyebrow: s.testEyebrow || null,
        carouselTitle: null,
        splitPercent: s.config.splitPercent ?? null,
        primaryColor: s.config.bgColor,
        accentColorV2: s.config.accentColor,
        accentFontFamily: s.config.accentFontFamily || null,
        accentCustomFontDataUrl: s.config.accentCustomFontDataUrl || null,
        accentBgEnabled: s.config.accentBgEnabled ?? false,
        accentBgColor: s.config.accentBgColor || null,
        accentBgPadding: s.config.accentBgPadding ?? 4,
        accentBgRadius: s.config.accentBgRadius ?? 2,
        accentUnderline: s.config.accentUnderline ?? false,
        accentUnderlineColor: s.config.accentUnderlineColor || null,
        textColor: s.config.headlineColor,
        microcopyColorV2: s.config.microcopyColor,
        bgImageDataUrl: s.testBgUrl,
        logoUrl: s.config.logoDataUrl || null,
        logoPosition: s.config.logoPosition,
        logoX: s.config.logoX,
        logoY: s.config.logoY,
        logoSize: s.config.logoSize,
        headlineSize: s.config.headlineSize,
        textX: s.config.textX,
        textY: s.config.textY,
        headlineX: s.config.headlineX,
        headlineY: s.config.headlineY,
        microcopyX: s.config.microcopyX,
        microcopyY: s.config.microcopyY,
        eyebrowX: s.config.eyebrowX,
        eyebrowY: s.config.eyebrowY,
        bulletsX: s.config.bulletsX,
        bulletsY: s.config.bulletsY,
        microcopySize: s.config.microcopySize,
        bulletSize: s.config.bulletSize ?? 18,
        eyebrowColor: s.config.eyebrowColor || null,
        eyebrowSize: s.config.eyebrowSize ?? 13,
        eyebrowUppercase: s.config.eyebrowUppercase ?? true,
        eyebrowGap: s.config.eyebrowGap ?? 16,
        headlineGap: s.config.headlineGap ?? 20,
        subheadGap: s.config.subheadGap ?? 28,
        ctaPosition: s.config.ctaPosition || 'center',
        verticalAlign: s.config.verticalAlign,
        fontFamily: s.config.fontFamily,
        customFontDataUrl: s.config.customFontDataUrl || null,
        headlineFontFamily: s.config.headlineFontFamily || null,
        headlineCustomFontDataUrl: s.config.headlineCustomFontDataUrl || null,
        eyebrowFontFamily: s.config.eyebrowFontFamily || null,
        eyebrowCustomFontDataUrl: s.config.eyebrowCustomFontDataUrl || null,
        microcopyFontFamily: s.config.microcopyFontFamily || null,
        microcopyCustomFontDataUrl: s.config.microcopyCustomFontDataUrl || null,
        bulletFontFamily: s.config.bulletFontFamily || null,
        bulletCustomFontDataUrl: s.config.bulletCustomFontDataUrl || null,
        ctaFontFamily: s.config.ctaFontFamily || null,
        ctaCustomFontDataUrl: s.config.ctaCustomFontDataUrl || null,
        padding: s.config.padding,
        elements: s.config.elements,
        cta: s.testCtaText ? { text: s.testCtaText, bgColor: s.config.ctaStyle.bgColor, textColor: s.config.ctaStyle.textColor, fontSize: s.config.ctaStyle.fontSize, paddingX: s.config.ctaStyle.paddingX, paddingY: s.config.ctaStyle.paddingY, borderRadius: s.config.ctaStyle.borderRadius, x: s.config.ctaStyle.x, y: s.config.ctaStyle.y } : null,
      } : {
        // V1 renderer — existing layout
        headline: '',
        microcopy: '',
        bgImageDataUrl: s.testBgUrl,
        logoUrl: s.config.logoDataUrl || '',
        logoPosition: s.config.logoPosition,
        logoSize: s.config.logoSize,
        logoX: s.config.logoX,
        logoY: s.config.logoY,
        padding: s.config.padding,
        headlineColor: s.config.headlineColor,
        headlineSize: s.config.headlineSize,
        microcopyColor: s.config.microcopyColor,
        microcopySize: s.config.microcopySize,
        textAlign: s.config.textAlign,
        fontFamily: s.config.fontFamily,
        bgColor: s.config.bgColor,
        verticalAlign: s.config.verticalAlign,
        uppercase: s.config.uppercase,
        elements: s.config.elements,
        cta: s.testCtaText ? { text: s.testCtaText, bgColor: s.config.ctaStyle.bgColor, textColor: s.config.ctaStyle.textColor, fontSize: s.config.ctaStyle.fontSize, paddingX: s.config.ctaStyle.paddingX, paddingY: s.config.ctaStyle.paddingY, borderRadius: s.config.ctaStyle.borderRadius, x: s.config.ctaStyle.x, y: s.config.ctaStyle.y } : null,
        hideText: false,
      }
      const res = await authedFetch('/api/test-render-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { showToast('Preview failed', true); return }
      const blob = await res.blob()
      updateSlide(index, { previewUrl: URL.createObjectURL(blob) })
    } finally {
      updateSlide(index, { previewing: false })
    }
  }

  function buildPreviewPayload(index: number): Record<string, unknown> {
    const s = slides[index]
    const cfg = s.config
    const bullets = s.testBullets
      ? s.testBullets.split('\n').map(b => b.trim()).filter(Boolean)
      : ['First bullet', 'Second bullet']
    return {
      v2: true,
      slideType: index === 0 ? 'title' : index === 5 ? 'cta' : 'problem',
      headline: s.testHeadline || 'Transform **Onboarding**',
      microcopy: s.testSubhead || 'One sentence with **key phrase**',
      bullets: index === 0 ? [] : bullets,
      eyebrow: index === 0 ? null : (s.testEyebrow || 'Insights'),
      carouselTitle: null,
      splitPercent: cfg.splitPercent ?? null,
      primaryColor: cfg.bgColor,
      accentColorV2: cfg.accentColor,
      accentFontFamily: cfg.accentFontFamily || null,
      accentCustomFontDataUrl: cfg.accentCustomFontDataUrl || null,
      accentBgEnabled: cfg.accentBgEnabled ?? false,
      accentBgColor: cfg.accentBgColor || null,
      accentBgPadding: cfg.accentBgPadding ?? 4,
      accentBgRadius: cfg.accentBgRadius ?? 2,
      accentUnderline: cfg.accentUnderline ?? false,
      accentUnderlineColor: cfg.accentUnderlineColor || null,
      textColor: cfg.headlineColor,
      microcopyColorV2: cfg.microcopyColor,
      bgImageDataUrl: s.testBgUrl,
      logoUrl: cfg.logoDataUrl || s.testLogoUrl || null,
      logoPosition: cfg.logoPosition,
      logoX: cfg.logoX,
      logoY: cfg.logoY,
      logoSize: cfg.logoSize,
      headlineSize: cfg.headlineSize,
      textX: cfg.textX,
      textY: cfg.textY,
      headlineX: cfg.headlineX,
      headlineY: cfg.headlineY,
      microcopyX: cfg.microcopyX,
      microcopyY: cfg.microcopyY,
      eyebrowX: cfg.eyebrowX,
      eyebrowY: cfg.eyebrowY,
      bulletsX: cfg.bulletsX,
      bulletsY: cfg.bulletsY,
      microcopySize: cfg.microcopySize,
      bulletSize: cfg.bulletSize ?? 18,
      eyebrowColor: cfg.eyebrowColor || null,
      eyebrowSize: cfg.eyebrowSize ?? 13,
      eyebrowUppercase: cfg.eyebrowUppercase ?? true,
      eyebrowGap: cfg.eyebrowGap ?? 16,
      headlineGap: cfg.headlineGap ?? 20,
      subheadGap: cfg.subheadGap ?? 28,
      ctaPosition: cfg.ctaPosition || 'center',
      verticalAlign: cfg.verticalAlign,
      fontFamily: cfg.fontFamily,
      customFontDataUrl: cfg.customFontDataUrl || null,
      headlineFontFamily: cfg.headlineFontFamily || null,
      headlineCustomFontDataUrl: cfg.headlineCustomFontDataUrl || null,
      eyebrowFontFamily: cfg.eyebrowFontFamily || null,
      eyebrowCustomFontDataUrl: cfg.eyebrowCustomFontDataUrl || null,
      microcopyFontFamily: cfg.microcopyFontFamily || null,
      microcopyCustomFontDataUrl: cfg.microcopyCustomFontDataUrl || null,
      bulletFontFamily: cfg.bulletFontFamily || null,
      bulletCustomFontDataUrl: cfg.bulletCustomFontDataUrl || null,
      ctaFontFamily: cfg.ctaFontFamily || null,
      ctaCustomFontDataUrl: cfg.ctaCustomFontDataUrl || null,
      padding: cfg.padding,
      elements: cfg.elements,
      cta: (s.testCtaText || index === 5) ? {
        text: s.testCtaText || 'Learn more',
        bgColor: cfg.ctaStyle.bgColor,
        textColor: cfg.ctaStyle.textColor,
        fontSize: cfg.ctaStyle.fontSize,
        paddingX: cfg.ctaStyle.paddingX,
        paddingY: cfg.ctaStyle.paddingY,
        borderRadius: cfg.ctaStyle.borderRadius,
        x: cfg.ctaStyle.x,
        y: cfg.ctaStyle.y,
      } : null,
    }
  }

  function handleCanvasMove(index: number, key: OverlayLayerKey, x: number, y: number) {
    if (key === 'cta') {
      updateConfig(index, { ctaStyle: { ...slides[index].config.ctaStyle, x, y } })
      return
    }
    updateConfig(index, overlayMovePatch(key, x, y) as Partial<PuppeteerConfig>)
  }

  function handleCanvasReset(index: number, key: OverlayLayerKey) {
    if (key === 'cta') {
      updateConfig(index, { ctaStyle: { ...slides[index].config.ctaStyle, x: 60, y: 900 } })
      return
    }
    updateConfig(index, overlayResetPatch(key) as Partial<PuppeteerConfig>)
  }

  if (!layout) return null

  return (
    <>
      <button className="back-btn" onClick={() => router.push(`/brands/${brandId}`)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to Brand
      </button>

      <div className="detail-header">
        <div className="detail-title">
          <h1>{layout.name}</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>Each slide has its own background prompt and Puppeteer overlay template.</p>
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary btn-sm" onClick={handleSaveAll} disabled={savingAll}>
            {savingAll ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {slides.map((slide, i) => {
          const cfg = slide.config
          return (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {/* Card header */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: slide.expanded ? '1px solid var(--border)' : 'none', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => updateSlide(i, { expanded: !slide.expanded })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transition: 'transform 0.2s', transform: slide.expanded ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--muted)', flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{SLIDE_LABELS[i]}</span>
                  {slide.prompt && <span style={{ fontSize: '11px', color: 'var(--muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slide.prompt}</span>}
                </div>
                <button className="btn btn-primary btn-sm" disabled={slide.saving || !slide.isDirty} onClick={e => { e.stopPropagation(); handleSaveSlide(i) }}>
                  {slide.saving ? 'Saving…' : 'Save slide'}
                </button>
              </div>

              {slide.expanded && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', alignItems: 'start' }}>
                {/* Left: settings */}
                <div style={{ padding: '18px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                  {/* Background prompt */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Background image prompt</p>
                    <textarea
                      rows={3}
                      placeholder="Describe the background visual. No text — Puppeteer will overlay text separately."
                      value={slide.prompt}
                      onChange={e => updateSlide(i, { prompt: e.target.value, isDirty: true })}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '80px' }}
                    />
                  </div>


                  {/* Remove BG */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={cfg.removeBg ?? false}
                        onChange={e => updateConfig(i, { removeBg: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      Remove background from generated image
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>(keeps subject, transparent bg)</span>
                  </div>

                  {/* Test text */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Test text</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {i !== 0 && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Eyebrow <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(label above headline)</span></label>
                          <input type="text" placeholder="e.g. INSIGHTS" value={slide.testEyebrow} onChange={e => updateSlide(i, { testEyebrow: e.target.value })} />
                        </div>
                      )}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Headline <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(use **word** for bold)</span></label>
                        <input type="text" placeholder="e.g. Transform **Onboarding**" value={slide.testHeadline} onChange={e => updateSlide(i, { testHeadline: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Subhead</label>
                        <input type="text" placeholder="e.g. One sentence with **key phrase**" value={slide.testSubhead} onChange={e => updateSlide(i, { testSubhead: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Bullets <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(one per line)</span></label>
                        <textarea
                          rows={3}
                          placeholder={'First bullet\nSecond bullet'}
                          value={slide.testBullets}
                          onChange={e => updateSlide(i, { testBullets: e.target.value })}
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Text style */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Text style</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Accent color <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(bold highlights)</span></label>
                        <input type="color" value={cfg.accentColor || '#3b82f6'} onChange={e => updateConfig(i, { accentColor: e.target.value })} style={{ height: '38px', padding: '2px 4px', width: '100%' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={cfg.accentUnderline ?? false} onChange={e => updateConfig(i, { accentUnderline: e.target.checked })} />
                          Underline accent
                        </label>
                      </div>
                      {(cfg.accentUnderline ?? false) && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Underline color</label>
                          <input type="color" value={cfg.accentUnderlineColor || cfg.accentColor || '#3b82f6'} onChange={e => updateConfig(i, { accentUnderlineColor: e.target.value })} style={{ height: '38px', padding: '2px 4px', width: '100%' }} />
                        </div>
                      )}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={cfg.accentBgEnabled ?? false} onChange={e => updateConfig(i, { accentBgEnabled: e.target.checked })} />
                          BG patch
                        </label>
                      </div>
                      {cfg.accentBgEnabled && (
                        <>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Patch color</label>
                            <input type="color" value={cfg.accentBgColor || '#ffffff'} onChange={e => updateConfig(i, { accentBgColor: e.target.value })} style={{ height: '38px', padding: '2px 4px', width: '100%' }} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Pad {cfg.accentBgPadding ?? 4}px</label>
                            <input type="range" min={0} max={20} value={cfg.accentBgPadding ?? 4} onChange={e => updateConfig(i, { accentBgPadding: +e.target.value })} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Radius {cfg.accentBgRadius ?? 2}px</label>
                            <input type="range" min={0} max={20} value={cfg.accentBgRadius ?? 2} onChange={e => updateConfig(i, { accentBgRadius: +e.target.value })} />
                          </div>
                        </>
                      )}
                      {i !== 5 ? (
                        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                          <details>
                            <summary style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Advanced position numbers</summary>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>Vertical align</label>
                                <select value={cfg.verticalAlign} onChange={e => updateConfig(i, { verticalAlign: e.target.value })}>
                                  <option value="top">Top</option>
                                  <option value="center">Center</option>
                                  <option value="bottom">Bottom</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>Text X</label>
                                <input type="number" placeholder="null" value={cfg.textX ?? ''} onChange={e => { const v = Number(e.target.value); updateConfig(i, { textX: e.target.value === '' || isNaN(v) ? null : v }) }} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>Text Y</label>
                                <input type="number" placeholder="null" value={cfg.textY ?? ''} onChange={e => { const v = Number(e.target.value); updateConfig(i, { textY: e.target.value === '' || isNaN(v) ? null : v }) }} />
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : (
                        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                          <label>Text position (CTA slide)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '6px' }}>
                            {[
                              { pos: 'top-left',      label: '↖' },
                              { pos: 'top-center',    label: '↑' },
                              { pos: 'top-right',     label: '↗' },
                              { pos: 'center-left',   label: '←' },
                              { pos: 'center',        label: '·' },
                              { pos: 'center-right',  label: '→' },
                              { pos: 'bottom-left',   label: '↙' },
                              { pos: 'bottom-center', label: '↓' },
                              { pos: 'bottom-right',  label: '↘' },
                            ].map(({ pos, label }) => {
                              const active = (cfg.ctaPosition || 'center') === pos
                              return (
                                <button key={pos} type="button" onClick={() => updateConfig(i, { ctaPosition: pos, textX: null, textY: null })} style={{ height: '38px', borderRadius: '4px', border: active ? '2px solid var(--primary,#6366f1)' : '1px solid var(--border)', background: active ? 'var(--primary-light,#ede9fe)' : 'var(--surface)', cursor: 'pointer', fontSize: '18px', color: active ? 'var(--primary,#6366f1)' : 'var(--muted)' }}>
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Headline color</label>
                        <input type="color" value={cfg.headlineColor || '#ffffff'} onChange={e => updateConfig(i, { headlineColor: e.target.value })} style={{ height: '38px', padding: '2px 4px', width: '100%' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Subhead color</label>
                        <input type="color" value={cfg.microcopyColor || '#cccccc'} onChange={e => updateConfig(i, { microcopyColor: e.target.value })} style={{ height: '38px', padding: '2px 4px', width: '100%' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Headline size</label>
                        <input type="number" value={cfg.headlineSize} onChange={e => updateConfig(i, { headlineSize: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Subhead size</label>
                        <input type="number" value={cfg.microcopySize} onChange={e => updateConfig(i, { microcopySize: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Bullet size</label>
                        <input type="number" value={cfg.bulletSize ?? 18} onChange={e => updateConfig(i, { bulletSize: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Eyebrow color <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(default: accent)</span></label>
                        <input type="color" value={cfg.eyebrowColor || cfg.accentColor || '#3b82f6'} onChange={e => updateConfig(i, { eyebrowColor: e.target.value })} style={{ height: '38px', padding: '2px 4px', width: '100%' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Eyebrow size</label>
                        <input type="number" value={cfg.eyebrowSize ?? 13} onChange={e => updateConfig(i, { eyebrowSize: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Eyebrow case</label>
                        <select value={cfg.eyebrowUppercase ?? true ? 'upper' : 'sentence'} onChange={e => updateConfig(i, { eyebrowUppercase: e.target.value === 'upper' })}>
                          <option value="upper">ALL CAPS</option>
                          <option value="sentence">Sentence case</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Eyebrow gap <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(below eyebrow)</span></label>
                        <input type="number" min={0} max={120} value={cfg.eyebrowGap ?? 16} onChange={e => updateConfig(i, { eyebrowGap: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Headline gap <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(below headline)</span></label>
                        <input type="number" min={0} max={120} value={cfg.headlineGap ?? 20} onChange={e => updateConfig(i, { headlineGap: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Subhead gap <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(below subhead)</span></label>
                        <input type="number" min={0} max={120} value={cfg.subheadGap ?? 28} onChange={e => updateConfig(i, { subheadGap: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Split % <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(text panel width)</span></label>
                        <input type="number" min={10} max={100} placeholder="AI decides" value={cfg.splitPercent ?? ''} onChange={e => updateConfig(i, { splitPercent: e.target.value === '' ? null : Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  {/* Per-element fonts */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Fonts</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {([
                        { label: 'Global (fallback)', familyKey: 'fontFamily', dataUrlKey: 'customFontDataUrl', urlKey: 'customFontUrl' },
                        { label: 'Headline', familyKey: 'headlineFontFamily', dataUrlKey: 'headlineCustomFontDataUrl', urlKey: 'headlineCustomFontUrl' },
                        { label: 'Eyebrow', familyKey: 'eyebrowFontFamily', dataUrlKey: 'eyebrowCustomFontDataUrl', urlKey: 'eyebrowCustomFontUrl' },
                        { label: 'Microcopy / Subhead', familyKey: 'microcopyFontFamily', dataUrlKey: 'microcopyCustomFontDataUrl', urlKey: 'microcopyCustomFontUrl' },
                        { label: 'Bullets', familyKey: 'bulletFontFamily', dataUrlKey: 'bulletCustomFontDataUrl', urlKey: 'bulletCustomFontUrl' },
                        { label: 'Accent words', familyKey: 'accentFontFamily', dataUrlKey: 'accentCustomFontDataUrl', urlKey: null },
                        { label: 'CTA Button', familyKey: 'ctaFontFamily', dataUrlKey: 'ctaCustomFontDataUrl', urlKey: 'ctaCustomFontUrl' },
                      ] as { label: string; familyKey: keyof PuppeteerConfig; dataUrlKey: keyof PuppeteerConfig; urlKey: keyof PuppeteerConfig | null }[]).map(({ label, familyKey, dataUrlKey, urlKey }) => {
                        const currentFamily = (cfg[familyKey] as string) || ''
                        const currentDataUrl = (cfg[dataUrlKey] as string | null) || null
                        const fontOptions = ['Inter','Roboto','Open Sans','Montserrat','Lato','Poppins','Playfair Display','Raleway','Nunito','DM Sans','Outfit','Manrope']
                        return (
                          <div key={familyKey} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{label}</span>
                            <select
                              value={currentDataUrl ? '__custom__' : (currentFamily || '__default__')}
                              onChange={e => {
                                if (e.target.value === '__custom__' || e.target.value === '__default__') return
                                const clear = urlKey ? { [familyKey]: e.target.value, [dataUrlKey]: null, [urlKey]: null } : { [familyKey]: e.target.value, [dataUrlKey]: null }
                                updateConfig(i, clear as Partial<PuppeteerConfig>)
                              }}
                              style={{ fontSize: '12px' }}
                            >
                              {familyKey !== 'fontFamily' && <option value="__default__">— same as global —</option>}
                              {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
                              {currentDataUrl && <option value="__custom__">Custom: {currentFamily}</option>}
                            </select>
                            <label style={{ cursor: 'pointer', fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                              {currentDataUrl ? '✓ Custom' : 'Upload'}
                              <input type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }} onChange={e => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const fontName = file.name.replace(/\.[^.]+$/, '')
                                const reader = new FileReader()
                                reader.onload = () => updateConfig(i, { [familyKey]: fontName, [dataUrlKey]: reader.result as string } as Partial<PuppeteerConfig>)
                                reader.readAsDataURL(file)
                                // Upload to ImageKit to get an HTTP URL Figma can load
                                if (urlKey) {
                                  const ext = file.name.split('.').pop() || 'ttf'
                                  uploadMedia(file, {
                                    folder: `brand-logos/fonts/${brandId}`,
                                    fileName: `${fontName}.${ext}`,
                                  })
                                    .then((uploaded) => {
                                      if (uploaded.url) updateConfig(i, { [urlKey]: uploaded.url } as Partial<PuppeteerConfig>)
                                    })
                                    .catch(() => { /* HTTP URL unavailable; base64 only — Figma SVG font won't load */ })
                                }
                              }} />
                            </label>
                            {currentDataUrl && (
                              <button className="btn btn-secondary btn-sm" style={{ gridColumn: '2 / -1', color: 'var(--error,#e55)', fontSize: '11px' }}
                                onClick={() => {
                                  const clear = urlKey ? { [familyKey]: '', [dataUrlKey]: null, [urlKey]: null } : { [familyKey]: '', [dataUrlKey]: null }
                                  updateConfig(i, clear as Partial<PuppeteerConfig>)
                                }}>
                                Remove custom font
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Logo */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Logo</p>
                    {cfg.logoDataUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cfg.logoDataUrl} alt="logo" loading="lazy" style={{ height: '32px', objectFit: 'contain', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--muted)', flex: 1 }}>Logo uploaded</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => { updateConfig(i, { logoDataUrl: null }); updateSlide(i, { testLogoUrl: null }) }} style={{ color: 'var(--error, #e55)' }}>Remove</button>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Position</label>
                        <select value={cfg.logoPosition} onChange={e => updateConfig(i, { logoPosition: e.target.value, logoX: null, logoY: null })}>
                          <option value="bottom-left">Bottom left</option>
                          <option value="bottom-center">Bottom center</option>
                          <option value="bottom-right">Bottom right</option>
                          <option value="top-left">Top left</option>
                          <option value="top-center">Top center</option>
                          <option value="top-right">Top right</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Size (px)</label>
                        <input type="number" value={cfg.logoSize} onChange={e => updateConfig(i, { logoSize: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>X <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(overrides pos)</span></label>
                        <input type="number" placeholder="null" value={cfg.logoX ?? ''} onChange={e => updateConfig(i, { logoX: e.target.value === '' ? null : Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Y</label>
                        <input type="number" placeholder="null" value={cfg.logoY ?? ''} onChange={e => updateConfig(i, { logoY: e.target.value === '' ? null : Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  {/* Element overlays */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Element overlays</p>
                    <input ref={ref => { elInputRefs.current[i] = ref }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleElementUpload(i, f); e.target.value = '' }} />
                    <button className="btn btn-secondary btn-sm" onClick={() => elInputRefs.current[i]?.click()} style={{ marginBottom: cfg.elements.length ? '10px' : 0 }}>
                      Add element
                    </button>
                    {cfg.elements.map((el, ei) => (
                      <div key={ei} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px', paddingBottom: '12px', borderBottom: ei < cfg.elements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={el.dataUrl} alt="" loading="lazy" style={{ width: '56px', height: '56px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', flexShrink: 0 }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1 }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>X</label>
                            <input type="number" value={el.x} onChange={e => updateEl(i, ei, 'x', Number(e.target.value))} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Y</label>
                            <input type="number" value={el.y} onChange={e => updateEl(i, ei, 'y', Number(e.target.value))} />
                          </div>
                          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                            <label>Size: {el.width}px</label>
                            <input type="range" min={50} max={1080} value={el.width} onChange={e => updateEl(i, ei, 'width', Number(e.target.value))} style={{ width: '100%' }} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Opacity %</label>
                            <input type="number" min={0} max={100} value={el.opacity} onChange={e => updateEl(i, ei, 'opacity', Number(e.target.value))} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Layer</label>
                            <select value={el.zIndex ?? 1} onChange={e => updateEl(i, ei, 'zIndex', Number(e.target.value))}>
                              <option value={3}>Above text &amp; logo</option>
                              <option value={1}>In front of subject, behind text</option>
                              <option value={-1}>Behind subject (behind bg image)</option>
                            </select>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error,#e55)', fontSize: '11px' }} onClick={() => removeEl(i, ei)}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA button */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>CTA button</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label>CTA text placeholder</label>
                        <input type="text" placeholder="Leave empty to hide CTA" value={slide.testCtaText} onChange={e => updateSlide(i, { testCtaText: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>BG color</label>
                        <input type="color" value={cfg.ctaStyle.bgColor} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, bgColor: e.target.value } })} style={{ height: '38px', padding: '2px 4px' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Text color</label>
                        <input type="color" value={cfg.ctaStyle.textColor} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, textColor: e.target.value } })} style={{ height: '38px', padding: '2px 4px' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Font size</label>
                        <input type="number" value={cfg.ctaStyle.fontSize} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, fontSize: Number(e.target.value) } })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Border radius</label>
                        <input type="number" value={cfg.ctaStyle.borderRadius} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, borderRadius: Number(e.target.value) } })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Pad X</label>
                        <input type="number" value={cfg.ctaStyle.paddingX} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, paddingX: Number(e.target.value) } })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Pad Y</label>
                        <input type="number" value={cfg.ctaStyle.paddingY} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, paddingY: Number(e.target.value) } })} />
                      </div>
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label>Position preset</label>
                        <select
                          defaultValue=""
                          onChange={e => {
                            const pad = cfg.padding || 60
                            const presets: Record<string, { x: number; y: number }> = {
                              'bottom-left':   { x: pad, y: 1080 - pad - 60 },
                              'bottom-center': { x: 540, y: 1080 - pad - 60 },
                              'bottom-right':  { x: 1080 - pad - 200, y: 1080 - pad - 60 },
                              'top-left':      { x: pad, y: pad },
                              'top-center':    { x: 540, y: pad },
                              'top-right':     { x: 1080 - pad - 200, y: pad },
                            }
                            const p = presets[e.target.value]
                            if (p) updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, x: p.x, y: p.y } })
                          }}
                        >
                          <option value="">Apply preset…</option>
                          <option value="bottom-left">Bottom left</option>
                          <option value="bottom-center">Bottom center</option>
                          <option value="bottom-right">Bottom right</option>
                          <option value="top-left">Top left</option>
                          <option value="top-center">Top center</option>
                          <option value="top-right">Top right</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>X <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(manual)</span></label>
                        <input type="number" value={cfg.ctaStyle.x} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, x: Number(e.target.value) } })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Y <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(manual)</span></label>
                        <input type="number" value={cfg.ctaStyle.y} onChange={e => updateConfig(i, { ctaStyle: { ...cfg.ctaStyle, y: Number(e.target.value) } })} />
                      </div>
                    </div>
                  </div>

                  {/* Test preview */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Test preview</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input ref={ref => { bgInputRefs.current[i] = ref }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleTestBgUpload(i, f); e.target.value = '' }} />
                      <button className="btn btn-secondary btn-sm" onClick={() => bgInputRefs.current[i]?.click()}>
                        {slide.testBgUrl ? 'Replace test background' : 'Upload test background'}
                      </button>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Solid:</span>
                        {['#000000','#1a1a2e','#0f172a','#1e3a5f','#2d1b4e','#374151','#7f1d1d','#991b1b','#ffffff','#f8fafc','#f1f5f9','#e2e8f0'].map(color => (
                          <button key={color} title={color} onClick={() => {
                            const canvas = document.createElement('canvas')
                            canvas.width = 1080; canvas.height = 1080
                            const ctx = canvas.getContext('2d')!
                            ctx.fillStyle = color
                            ctx.fillRect(0, 0, 1080, 1080)
                            updateSlide(i, { testBgUrl: canvas.toDataURL('image/png') })
                          }} style={{ width: '20px', height: '20px', borderRadius: '4px', background: color, border: '1px solid var(--border)', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                        ))}
                      </div>
                      <input ref={ref => { logoInputRefs.current[i] = ref }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleTestLogoUpload(i, f); e.target.value = '' }} />
                      <button className="btn btn-secondary btn-sm" onClick={() => logoInputRefs.current[i]?.click()}>
                        {slide.testLogoUrl ? 'Replace test logo' : 'Upload test logo'}
                      </button>
                      {slide.testLogoUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={slide.testLogoUrl} alt="logo" loading="lazy" style={{ height: '28px', objectFit: 'contain', marginTop: '2px' }} />
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '4px' }}
                        disabled={slide.previewing}
                        onClick={() => handlePreview(i)}
                      >
                        {slide.previewing ? 'Rendering…' : 'Download PNG'}
                      </button>
                      {slide.previewUrl && (
                        <a href={slide.previewUrl} download={`slide-${i + 1}.png`} className="btn btn-secondary btn-sm">Open last PNG</a>
                      )}
                    </div>
                  </div>

                </div>

                {/* Right: live canvas */}
                <div style={{ padding: '18px' }}>
                  <OverlayCanvas
                    payload={buildPreviewPayload(i)}
                    onMove={(key, x, y) => handleCanvasMove(i, key, x, y)}
                    onReset={key => handleCanvasReset(i, key)}
                    padding={cfg.padding || 60}
                    emptyHint="Drag the text stack on the canvas. Upload a test BG for a realistic preview."
                  />
                </div>
              </div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
