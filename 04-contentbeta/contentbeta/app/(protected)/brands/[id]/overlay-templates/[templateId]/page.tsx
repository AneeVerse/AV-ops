'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { sb } from '@/lib/supabase'
import { useToast } from '@/lib/toast'
import { uploadMedia } from '@/lib/media-upload'
import OverlayCanvas from '@/components/OverlayCanvas'
import type { OverlayLayerKey } from '@/lib/overlay-positions'

interface OverlayElement { dataUrl: string; name: string; x: number; y: number; width: number; opacity: number; zIndex: number }

const FONT_OPTIONS = [
  'Industry', 'Inter', 'Roboto', 'Montserrat', 'Playfair Display', 'Oswald',
  'Raleway', 'Poppins', 'Lato', 'Nunito', 'Source Sans Pro',
]
const LOGO_POSITIONS = ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right']
const ACCENT_POSITIONS = ['right', 'left', 'top', 'bottom', 'none']
const TEXT_ALIGNMENTS = ['left', 'center', 'right']

export default function OverlayTemplateEditorPage() {
  const { id: brandId, templateId } = useParams<{ id: string; templateId: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const isNew = templateId === 'new'

  const [name, setName] = useState('')
  const [bgPrompt, setBgPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)

  // Preview
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Logo
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Elements
  const [elements, setElements] = useState<OverlayElement[]>([])
  const elementInputRef = useRef<HTMLInputElement>(null)

  // Split layout
  const [splitLayout, setSplitLayout] = useState<'free' | 'left-image' | 'right-image'>('free')
  const [splitRatio, setSplitRatio] = useState(50)

  // Preview-only background image (not saved to config)
  const [previewHeadline, setPreviewHeadline] = useState('STREAMLINE YOUR WORKFLOW')
  const [previewMicrocopy, setPreviewMicrocopy] = useState('Discover how AI-driven automation transforms the way teams work.')
  const [previewBgImageDataUrl, setPreviewBgImageDataUrl] = useState<string | null>(null)
  const [previewBgImageName, setPreviewBgImageName] = useState<string | null>(null)
  const previewBgInputRef = useRef<HTMLInputElement>(null)

  // Colors
  const [bgColor, setBgColor] = useState('#1a1a2e')
  const [headlineColor, setHeadlineColor] = useState('#ffffff')
  const [microcopyColor, setMicrocopyColor] = useState('rgba(255,255,255,0.75)')
  const [accentColor, setAccentColor] = useState('rgba(255,255,255,0.15)')

  // Accent text styling
  const [textAccentColor, setTextAccentColor] = useState('#3b82f6')
  const [accentFontFamily, setAccentFontFamily] = useState('')
  const [accentCustomFontDataUrl, setAccentCustomFontDataUrl] = useState<string | null>(null)
  const [accentCustomFontName, setAccentCustomFontName] = useState<string | null>(null)
  const [accentCustomFontUrl, setAccentCustomFontUrl] = useState<string | null>(null)
  const accentFontInputRef = useRef<HTMLInputElement>(null)
  const [accentBgEnabled, setAccentBgEnabled] = useState(false)
  const [accentBgColor, setAccentBgColor] = useState('#ffffff')
  const [accentBgPadding, setAccentBgPadding] = useState(4)
  const [accentBgRadius, setAccentBgRadius] = useState(2)
  const [accentUnderline, setAccentUnderline] = useState(false)
  const [accentUnderlineColor, setAccentUnderlineColor] = useState('')

  // Custom font (global fallback)
  const [customFontDataUrl, setCustomFontDataUrl] = useState<string | null>(null)
  const [customFontName, setCustomFontName] = useState<string | null>(null)
  const [customFontUrl, setCustomFontUrl] = useState<string | null>(null)
  const fontInputRef = useRef<HTMLInputElement>(null)

  // Per-element custom fonts
  const [headlineCustomFontDataUrl, setHeadlineCustomFontDataUrl] = useState<string | null>(null)
  const [headlineCustomFontName, setHeadlineCustomFontName] = useState<string | null>(null)
  const [headlineCustomFontUrl, setHeadlineCustomFontUrl] = useState<string | null>(null)
  const headlineFontInputRef = useRef<HTMLInputElement>(null)
  const [microcopyCustomFontDataUrl, setMicrocopyCustomFontDataUrl] = useState<string | null>(null)
  const [microcopyCustomFontName, setMicrocopyCustomFontName] = useState<string | null>(null)
  const [microcopyCustomFontUrl, setMicrocopyCustomFontUrl] = useState<string | null>(null)
  const microcopyFontInputRef = useRef<HTMLInputElement>(null)

  // Typography
  const [fontFamily, setFontFamily] = useState('Inter')
  const [headlineSize, setHeadlineSize] = useState(86)
  const [headlinePaddingX, setHeadlinePaddingX] = useState(0)
  const [microcopySize, setMicrocopySize] = useState(32)
  const [microcopyPaddingX, setMicrocopyPaddingX] = useState(0)
  const [textAlign, setTextAlign] = useState('left')
  const [uppercase, setUppercase] = useState(true)

  // Layout
  const [padding, setPadding] = useState(80)
  const [logoPosition, setLogoPosition] = useState('bottom-left')
  const [logoSize, setLogoSize] = useState(48)
  const [logoPositionEnabled, setLogoPositionEnabled] = useState(false)
  const [logoX, setLogoX] = useState(80)
  const [logoY, setLogoY] = useState(900)
  const [accentPosition, setAccentPosition] = useState('right')
  const [accentSize, setAccentSize] = useState(12)
  const [patternOpacity, setPatternOpacity] = useState(8)
  const [removeBg, setRemoveBg] = useState(false)
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'center' | 'bottom'>('center')

  // Text position
  const [textPositionEnabled, setTextPositionEnabled] = useState(false)
  const [textX, setTextX] = useState(80)
  const [textY, setTextY] = useState(400)
  const [headlineX, setHeadlineX] = useState<number | null>(null)
  const [headlineY, setHeadlineY] = useState<number | null>(null)
  const [microcopyX, setMicrocopyX] = useState<number | null>(null)
  const [microcopyY, setMicrocopyY] = useState<number | null>(null)

  // CTA
  const [ctaEnabled, setCtaEnabled] = useState(false)
  const [ctaText, setCtaText] = useState('Learn More')
  const [ctaBgColor, setCtaBgColor] = useState('#ffffff')
  const [ctaTextColor, setCtaTextColor] = useState('#000000')
  const [ctaFontSize, setCtaFontSize] = useState(28)
  const [ctaPaddingX, setCtaPaddingX] = useState(48)
  const [ctaPaddingY, setCtaPaddingY] = useState(20)
  const [ctaBorderRadius, setCtaBorderRadius] = useState(9999)
  const [ctaFontFamily, setCtaFontFamily] = useState('')
  const [ctaCustomFontDataUrl, setCtaCustomFontDataUrl] = useState<string | null>(null)
  const [ctaCustomFontName, setCtaCustomFontName] = useState<string | null>(null)
  const [ctaCustomFontUrl, setCtaCustomFontUrl] = useState<string | null>(null)
  const ctaFontInputRef = useRef<HTMLInputElement>(null)
  const [ctaX, setCtaX] = useState(80)
  const [ctaY, setCtaY] = useState(860)
  const [ctaAlign, setCtaAlign] = useState<'left' | 'center' | 'right'>('left')
  const [ctaPositionPreset, setCtaPositionPreset] = useState('')

  useEffect(() => {
    if (!isNew) loadTemplate()
  }, [templateId])

  async function uploadFontToStorage(file: File, fontName: string): Promise<string | null> {
    try {
      const ext = file.name.split('.').pop() || 'ttf'
      const uploaded = await uploadMedia(file, {
        folder: `brand-logos/fonts/${brandId}`,
        fileName: `${fontName}.${ext}`,
      })
      return uploaded.url || null
    } catch {
      return null
    }
  }

  async function loadTemplate() {
    setLoading(true)
    const { data } = await sb.from('overlay_templates').select('*').eq('id', templateId).single()
    if (!data) { showToast('Template not found', true); router.push(`/brands/${brandId}`); return }
    setName(data.name || '')
    setBgPrompt(data.bg_prompt || '')
    const c = data.puppeteer_config || {}
    if (c.splitLayout) setSplitLayout(c.splitLayout)
    if (c.splitRatio !== undefined) setSplitRatio(c.splitRatio)
    if (c.bgColor) setBgColor(c.bgColor)
    if (c.headlineColor) setHeadlineColor(c.headlineColor)
    if (c.microcopyColor) setMicrocopyColor(c.microcopyColor)
    if (c.textAccentColor) setTextAccentColor(c.textAccentColor)
    if (c.accentFontFamily) setAccentFontFamily(c.accentFontFamily)
    if (c.accentCustomFontDataUrl) setAccentCustomFontDataUrl(c.accentCustomFontDataUrl)
    if (c.accentCustomFontName) setAccentCustomFontName(c.accentCustomFontName)
    if (c.accentCustomFontUrl) setAccentCustomFontUrl(c.accentCustomFontUrl)
    if (c.accentBgEnabled !== undefined) setAccentBgEnabled(!!c.accentBgEnabled)
    if (c.accentBgColor) setAccentBgColor(c.accentBgColor)
    if (c.accentBgPadding !== undefined) setAccentBgPadding(c.accentBgPadding)
    if (c.accentBgRadius !== undefined) setAccentBgRadius(c.accentBgRadius)
    if (c.accentUnderline !== undefined) setAccentUnderline(!!c.accentUnderline)
    if (c.accentUnderlineColor) setAccentUnderlineColor(c.accentUnderlineColor)
    if (c.accentColor) setAccentColor(c.accentColor)
    if (c.fontFamily) setFontFamily(c.fontFamily)
    if (c.customFontDataUrl) setCustomFontDataUrl(c.customFontDataUrl)
    if (c.customFontName) setCustomFontName(c.customFontName)
    if (c.customFontUrl) setCustomFontUrl(c.customFontUrl)
    if (c.headlineCustomFontDataUrl) setHeadlineCustomFontDataUrl(c.headlineCustomFontDataUrl)
    if (c.headlineCustomFontName) setHeadlineCustomFontName(c.headlineCustomFontName)
    if (c.headlineCustomFontUrl) setHeadlineCustomFontUrl(c.headlineCustomFontUrl)
    if (c.microcopyCustomFontDataUrl) setMicrocopyCustomFontDataUrl(c.microcopyCustomFontDataUrl)
    if (c.microcopyCustomFontName) setMicrocopyCustomFontName(c.microcopyCustomFontName)
    if (c.microcopyCustomFontUrl) setMicrocopyCustomFontUrl(c.microcopyCustomFontUrl)
    if (c.headlineSize !== undefined) setHeadlineSize(c.headlineSize)
    if (c.headlinePaddingX !== undefined) setHeadlinePaddingX(c.headlinePaddingX)
    if (c.microcopySize !== undefined) setMicrocopySize(c.microcopySize)
    if (c.microcopyPaddingX !== undefined) setMicrocopyPaddingX(c.microcopyPaddingX)
    if (c.textAlign) setTextAlign(c.textAlign)
    if (c.uppercase !== undefined) setUppercase(c.uppercase)
    if (c.padding !== undefined) setPadding(c.padding)
    if (c.logoPosition) setLogoPosition(c.logoPosition)
    if (c.logoSize !== undefined) setLogoSize(c.logoSize)
    if (c.logoX != null && c.logoY != null) { setLogoPositionEnabled(true); setLogoX(c.logoX); setLogoY(c.logoY) }
    if (Array.isArray(c.elements)) setElements(c.elements)
    if (c.accentPosition) setAccentPosition(c.accentPosition)
    if (c.accentSize !== undefined) setAccentSize(c.accentSize)
    if (c.patternOpacity !== undefined) setPatternOpacity(c.patternOpacity)
    if (c.removeBg !== undefined) setRemoveBg(!!c.removeBg)
    if (c.verticalAlign) setVerticalAlign(c.verticalAlign)
    if (c.logoDataUrl) { setLogoUrl(c.logoDataUrl); setLogoPreview(c.logoDataUrl) }
    if (c.headlineX != null) setHeadlineX(c.headlineX)
    if (c.headlineY != null) setHeadlineY(c.headlineY)
    if (c.microcopyX != null) setMicrocopyX(c.microcopyX)
    if (c.microcopyY != null) setMicrocopyY(c.microcopyY)
    // textPosition — new format is nested object, old format was flat fields
    if (c.textPosition) {
      setTextPositionEnabled(true)
      setTextX(c.textPosition.x)
      setTextY(c.textPosition.y)
    } else {
      if (c.textPositionEnabled !== undefined) setTextPositionEnabled(c.textPositionEnabled)
      if (c.textX !== undefined) setTextX(c.textX)
      if (c.textY !== undefined) setTextY(c.textY)
    }
    // cta — new format is nested object, old format was flat fields
    if (c.cta) {
      setCtaEnabled(true)
      if (c.cta.text) setCtaText(c.cta.text)
      if (c.cta.bgColor) setCtaBgColor(c.cta.bgColor)
      if (c.cta.textColor) setCtaTextColor(c.cta.textColor)
      if (c.cta.fontSize !== undefined) setCtaFontSize(c.cta.fontSize)
      if (c.cta.paddingX !== undefined) setCtaPaddingX(c.cta.paddingX)
      if (c.cta.paddingY !== undefined) setCtaPaddingY(c.cta.paddingY)
      if (c.cta.borderRadius !== undefined) setCtaBorderRadius(c.cta.borderRadius)
      if (c.cta.fontFamily) setCtaFontFamily(c.cta.fontFamily)
      if (c.cta.customFontDataUrl) setCtaCustomFontDataUrl(c.cta.customFontDataUrl)
      if (c.cta.customFontName) setCtaCustomFontName(c.cta.customFontName)
      if (c.cta.customFontUrl) setCtaCustomFontUrl(c.cta.customFontUrl)
      if (c.cta.x !== undefined) setCtaX(c.cta.x)
      if (c.cta.y !== undefined) setCtaY(c.cta.y)
      if (c.cta.align) setCtaAlign(c.cta.align)
    } else {
      if (c.ctaEnabled !== undefined) setCtaEnabled(c.ctaEnabled)
      if (c.ctaText) setCtaText(c.ctaText)
      if (c.ctaBgColor) setCtaBgColor(c.ctaBgColor)
      if (c.ctaTextColor) setCtaTextColor(c.ctaTextColor)
      if (c.ctaFontSize !== undefined) setCtaFontSize(c.ctaFontSize)
      if (c.ctaPaddingX !== undefined) setCtaPaddingX(c.ctaPaddingX)
      if (c.ctaPaddingY !== undefined) setCtaPaddingY(c.ctaPaddingY)
      if (c.ctaBorderRadius !== undefined) setCtaBorderRadius(c.ctaBorderRadius)
      if (c.ctaFontFamily) setCtaFontFamily(c.ctaFontFamily)
      if (c.ctaX !== undefined) setCtaX(c.ctaX)
      if (c.ctaY !== undefined) setCtaY(c.ctaY)
    }
    setLoading(false)
  }

  function buildConfig() {
    return {
      splitLayout, splitRatio,
      bgColor, headlineColor, microcopyColor, accentColor,
      textAccentColor,
      accentFontFamily: accentFontFamily || null,
      accentCustomFontDataUrl: accentCustomFontDataUrl || null,
      accentCustomFontName: accentCustomFontName || null,
      accentCustomFontUrl: accentCustomFontUrl || null,
      accentBgEnabled, accentBgColor, accentBgPadding, accentBgRadius,
      accentUnderline, accentUnderlineColor: accentUnderlineColor || null,
      fontFamily, headlineSize, headlinePaddingX, microcopySize, microcopyPaddingX, textAlign, uppercase,
      padding, logoPosition, logoSize,
      logoX: logoPositionEnabled ? logoX : null,
      logoY: logoPositionEnabled ? logoY : null,
      accentPosition, accentSize,
      patternOpacity, verticalAlign, removeBg,
      customFontDataUrl: customFontDataUrl || null,
      customFontName: customFontName || null,
      customFontUrl: customFontUrl || null,
      headlineCustomFontDataUrl: headlineCustomFontDataUrl || null,
      headlineCustomFontName: headlineCustomFontName || null,
      headlineCustomFontUrl: headlineCustomFontUrl || null,
      microcopyCustomFontDataUrl: microcopyCustomFontDataUrl || null,
      microcopyCustomFontName: microcopyCustomFontName || null,
      microcopyCustomFontUrl: microcopyCustomFontUrl || null,
      textPosition: textPositionEnabled ? { x: textX, y: textY } : null,
      headlineX, headlineY, microcopyX, microcopyY,
      logoDataUrl: logoUrl || null,
      elements: elements.map(({ name: _n, ...rest }) => rest),
      cta: ctaEnabled ? {
        text: ctaText, bgColor: ctaBgColor, textColor: ctaTextColor,
        fontSize: ctaFontSize, paddingX: ctaPaddingX, paddingY: ctaPaddingY,
        borderRadius: ctaBorderRadius, x: ctaX, y: ctaY, align: ctaAlign,
        fontFamily: ctaFontFamily || null,
        customFontDataUrl: ctaCustomFontDataUrl || null,
        customFontName: ctaCustomFontName || null,
        customFontUrl: ctaCustomFontUrl || null,
      } : null,
    }
  }

  async function handleSave() {
    if (!name.trim()) { showToast('Please enter a template name.', true); return }
    setSaving(true)
    const payload = {
      brand_id: brandId,
      name: name.trim(),
      bg_prompt: bgPrompt.trim() || null,
      puppeteer_config: buildConfig(),
    }
    let error
    if (isNew) {
      ({ error } = await sb.from('overlay_templates').insert(payload))
    } else {
      ({ error } = await sb.from('overlay_templates').update(payload).eq('id', templateId))
    }
    setSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast('Template saved.')
    router.push(`/brands/${brandId}`)
  }

  async function handlePreview() {
    setPreviewing(true)
    setPreviewUrl(null)
    setPreviewError(null)
    try {
      const res = await authedFetch('/api/test-render-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: previewHeadline,
          microcopy: previewMicrocopy,
          logoUrl,
          ...buildConfig(),
          textPosition: textPositionEnabled ? { x: textX, y: textY } : null,
          customFontDataUrl, customFontName,
          headlineCustomFontDataUrl, headlineCustomFontName,
          microcopyCustomFontDataUrl, microcopyCustomFontName,
          bgImageDataUrl: previewBgImageDataUrl,
          elements: elements.map(({ name: _n, ...rest }) => rest),
          cta: ctaEnabled ? {
            text: ctaText, bgColor: ctaBgColor, textColor: ctaTextColor,
            fontSize: ctaFontSize, paddingX: ctaPaddingX, paddingY: ctaPaddingY,
            borderRadius: ctaBorderRadius, x: ctaX, y: ctaY, align: ctaAlign,
            fontFamily: ctaFontFamily || null, customFontDataUrl: ctaCustomFontDataUrl, customFontName: ctaCustomFontName,
          } : null,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Render failed') }
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setPreviewError((err as Error).message)
    } finally {
      setPreviewing(false)
    }
  }

  function applyCtaPreset(preset: string) {
    if (!preset) return
    const btnH = Math.round(ctaFontSize * 1.2 + ctaPaddingY * 2)
    const btnW = Math.round(ctaText.length * ctaFontSize * 0.55 + ctaPaddingX * 2)
    const pad = padding
    const cy = Math.round((1080 - btnH) / 2)
    const right = 1080 - pad - btnW
    const bottom = 1080 - pad - btnH

    const isCenter = preset === 'center' || preset.endsWith('-center')
    const isRight  = preset.endsWith('-right')
    const align: 'left' | 'center' | 'right' = isCenter ? 'center' : isRight ? 'right' : 'left'
    setCtaAlign(align)

    // For Y only — X is handled by align in the render route
    const yMap: Record<string, number> = {
      'top-left': pad,    'top-center': pad,    'top-right': pad,
      'center-left': cy,  'center': cy,          'center-right': cy,
      'bottom-left': bottom, 'bottom-center': bottom, 'bottom-right': bottom,
    }
    const xMap: Record<string, number> = {
      'top-left': pad,    'top-center': pad,    'top-right': right,
      'center-left': pad, 'center': pad,         'center-right': right,
      'bottom-left': pad, 'bottom-center': pad,  'bottom-right': right,
    }
    setCtaX(xMap[preset] ?? ctaX)
    setCtaY(yMap[preset] ?? ctaY)
    setCtaPositionPreset(preset)
  }

  function handleCanvasMove(key: OverlayLayerKey, x: number, y: number) {
    if (key === 'stack') { setTextPositionEnabled(true); setTextX(x); setTextY(y) }
    if (key === 'headline') { setHeadlineX(x); setHeadlineY(y) }
    if (key === 'microcopy') { setMicrocopyX(x); setMicrocopyY(y) }
    if (key === 'logo') { setLogoPositionEnabled(true); setLogoX(x); setLogoY(y) }
    if (key === 'cta') { setCtaAlign('left'); setCtaX(x); setCtaY(y); setCtaPositionPreset('') }
  }

  function handleCanvasReset(key: OverlayLayerKey) {
    if (key === 'stack') { setTextPositionEnabled(false) }
    if (key === 'headline') { setHeadlineX(null); setHeadlineY(null) }
    if (key === 'microcopy') { setMicrocopyX(null); setMicrocopyY(null) }
    if (key === 'logo') { setLogoPositionEnabled(false); setLogoX(80); setLogoY(900) }
    if (key === 'cta') { setCtaX(80); setCtaY(860) }
  }

  const canvasPayload = useMemo(() => ({
    headline: previewHeadline,
    microcopy: previewMicrocopy,
    logoUrl,
    ...buildConfig(),
    headlineX, headlineY, microcopyX, microcopyY,
    bgImageDataUrl: previewBgImageDataUrl,
    elements: elements.map(({ name: _n, ...rest }) => rest),
    cta: ctaEnabled ? {
      text: ctaText, bgColor: ctaBgColor, textColor: ctaTextColor,
      fontSize: ctaFontSize, paddingX: ctaPaddingX, paddingY: ctaPaddingY,
      borderRadius: ctaBorderRadius, x: ctaX, y: ctaY, align: ctaAlign,
      fontFamily: ctaFontFamily || null, customFontDataUrl: ctaCustomFontDataUrl, customFontName: ctaCustomFontName,
    } : null,
  }), [
    previewHeadline, previewMicrocopy, logoUrl, previewBgImageDataUrl, elements,
    headlineX, headlineY, microcopyX, microcopyY, textX, textY, textPositionEnabled,
    ctaEnabled, ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPaddingX, ctaPaddingY,
    ctaBorderRadius, ctaX, ctaY, ctaAlign, ctaFontFamily, ctaCustomFontDataUrl, ctaCustomFontName,
    splitLayout, splitRatio, bgColor, headlineColor, microcopyColor, accentColor,
    textAccentColor, fontFamily, headlineSize, microcopySize, textAlign, uppercase, padding,
    logoPosition, logoSize, logoX, logoY, logoPositionEnabled, verticalAlign, removeBg,
    customFontDataUrl, customFontName, headlineCustomFontDataUrl, headlineCustomFontName,
    microcopyCustomFontDataUrl, microcopyCustomFontName, headlinePaddingX, microcopyPaddingX,
    accentPosition, accentSize, patternOpacity, accentBgEnabled, accentBgColor, accentBgPadding,
    accentBgRadius, accentUnderline, accentUnderlineColor, accentFontFamily, accentCustomFontDataUrl,
    accentCustomFontName,
  ])

  const colorInput = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="color" value={value.startsWith('#') ? value : '#ffffff'}
          onChange={e => onChange(e.target.value)}
          style={{ width: '40px', height: '36px', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }} />
      </div>
    </div>
  )

  const sectionTitle = (title: string) => (
    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '20px 0 10px' }}>{title}</p>
  )

  if (loading) return null

  return (
    <>
      <button className="back-btn" onClick={() => router.push(`/brands/${brandId}`)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to Brand
      </button>

      <h1>{isNew ? 'New Editable Layout' : 'Edit Layout'}</h1>
      <p className="subtitle">Configure the overlay template. Drag text on the live canvas — Left / Center / Right snap to the edges.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        {/* Left panel — controls */}
        <div className="form-card" style={{ overflowY: 'auto', maxHeight: '85vh' }}>

          {sectionTitle('Template Info')}
          <div className="form-group">
            <label>Template Name</label>
            <input type="text" placeholder="e.g. Left Text Right Mockup" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Background Prompt</label>
            <textarea rows={6} placeholder="Describe the AI-generated background image..." value={bgPrompt} onChange={e => setBgPrompt(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {sectionTitle('Layout Mode')}
          <div className="form-group">
            <label>Layout</label>
            <select value={splitLayout} onChange={e => setSplitLayout(e.target.value as 'free' | 'left-image' | 'right-image')}>
              <option value="free">Free (no split)</option>
              <option value="left-image">Left image, right text</option>
              <option value="right-image">Right image, left text</option>
            </select>
          </div>
          {splitLayout !== 'free' && (
            <div className="form-group">
              <label>Text zone width: {100 - splitRatio}% (image takes remaining {splitRatio}%)</label>
              <input type="range" min={20} max={80} value={splitRatio} onChange={e => setSplitRatio(+e.target.value)} />
            </div>
          )}

          {sectionTitle('Sample Content (for preview only)')}
          <div className="form-group">
            <label>Headline</label>
            <input type="text" value={previewHeadline} onChange={e => setPreviewHeadline(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Microcopy</label>
            <textarea rows={2} value={previewMicrocopy} onChange={e => setPreviewMicrocopy(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Logo <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(optional — overrides brand logo)</span></label>
            <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => { const d = ev.target?.result as string; setLogoUrl(d); setLogoPreview(d) }
                reader.readAsDataURL(file)
              }} />
            {logoPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="logo" loading="lazy" style={{ height: '36px', objectFit: 'contain', borderRadius: '4px', background: 'var(--bg)', padding: '4px', border: '1px solid var(--border)' }} />
                <button className="btn btn-secondary btn-sm" onClick={() => { setLogoUrl(''); setLogoPreview(null) }}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}>Upload Logo</button>
            )}
          </div>

          {sectionTitle('Colors')}
          {colorInput('Background Color (used if no preview image)', bgColor, setBgColor)}
          <div className="form-group">
            <label>Preview Background Image <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(not saved — for layout testing only)</span></label>
            <input ref={previewBgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  setPreviewBgImageDataUrl(ev.target?.result as string)
                  setPreviewBgImageName(file.name)
                }
                reader.readAsDataURL(file)
              }} />
            {previewBgImageName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{previewBgImageName}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => { setPreviewBgImageDataUrl(null); setPreviewBgImageName(null) }}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => previewBgInputRef.current?.click()}>Upload Image</button>
            )}
          </div>
          {colorInput('Headline', headlineColor, setHeadlineColor)}
          {colorInput('Microcopy', microcopyColor, setMicrocopyColor)}

          {sectionTitle('Accent Text')}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.5 }}>
            Styles applied to GPT-selected key words in the headline &amp; microcopy.
          </p>
          {colorInput('Text Accent Color', textAccentColor, setTextAccentColor)}
          <div className="form-group">
            <label>Accent Font <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(leave blank to inherit)</span></label>
            <select value={accentFontFamily} onChange={e => setAccentFontFamily(e.target.value)} disabled={!!accentCustomFontName}>
              <option value="">Same as headline</option>
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Accent Custom Font <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(overrides dropdown)</span></label>
            <input ref={accentFontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const name = file.name.replace(/\.[^.]+$/, '')
                const reader = new FileReader()
                reader.onload = ev => { setAccentCustomFontDataUrl(ev.target?.result as string); setAccentCustomFontName(name) }
                reader.readAsDataURL(file)
                uploadFontToStorage(file, `accent-${name}`).then(url => { if (url) setAccentCustomFontUrl(url) })
              }} />
            {accentCustomFontName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px' }}>{accentCustomFontName}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => { setAccentCustomFontDataUrl(null); setAccentCustomFontName(null); setAccentCustomFontUrl(null) }}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => accentFontInputRef.current?.click()}>Upload Font</button>
            )}
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={accentUnderline} onChange={e => setAccentUnderline(e.target.checked)} />
              Underline accent words
            </label>
          </div>
          {accentUnderline && colorInput('Underline Color', accentUnderlineColor || textAccentColor, setAccentUnderlineColor)}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={accentBgEnabled} onChange={e => setAccentBgEnabled(e.target.checked)} />
              Background patch on accent words
            </label>
          </div>
          {accentBgEnabled && (
            <>
              {colorInput('Patch Color', accentBgColor, setAccentBgColor)}
              <div className="form-group">
                <label>Patch Padding: {accentBgPadding}px</label>
                <input type="range" min={0} max={20} value={accentBgPadding} onChange={e => setAccentBgPadding(+e.target.value)} />
              </div>
              <div className="form-group">
                <label>Patch Border Radius: {accentBgRadius}px</label>
                <input type="range" min={0} max={20} value={accentBgRadius} onChange={e => setAccentBgRadius(+e.target.value)} />
              </div>
            </>
          )}

          {sectionTitle('Typography')}
          <div className="form-group">
            <label>Custom Font (overrides Google Font)</label>
            <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const name = file.name.replace(/\.[^.]+$/, '')
                const reader = new FileReader()
                reader.onload = ev => { setCustomFontDataUrl(ev.target?.result as string); setCustomFontName(name) }
                reader.readAsDataURL(file)
                uploadFontToStorage(file, name).then(url => { if (url) setCustomFontUrl(url) })
              }} />
            {customFontName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px' }}>{customFontName}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => { setCustomFontDataUrl(null); setCustomFontName(null); setCustomFontUrl(null) }}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => fontInputRef.current?.click()}>Upload Font</button>
            )}
          </div>
          <div className="form-group">
            <label>Google Font (fallback for all elements)</label>
            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Headline Font (overrides global)</label>
            <input ref={headlineFontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const name = file.name.replace(/\.[^.]+$/, '')
                const reader = new FileReader()
                reader.onload = ev => { setHeadlineCustomFontDataUrl(ev.target?.result as string); setHeadlineCustomFontName(name) }
                reader.readAsDataURL(file)
                uploadFontToStorage(file, `headline-${name}`).then(url => { if (url) setHeadlineCustomFontUrl(url) })
              }} />
            {headlineCustomFontName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px' }}>{headlineCustomFontName}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => { setHeadlineCustomFontDataUrl(null); setHeadlineCustomFontName(null); setHeadlineCustomFontUrl(null) }}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => headlineFontInputRef.current?.click()}>Upload Headline Font</button>
            )}
          </div>
          <div className="form-group">
            <label>Microcopy Font (overrides global)</label>
            <input ref={microcopyFontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const name = file.name.replace(/\.[^.]+$/, '')
                const reader = new FileReader()
                reader.onload = ev => { setMicrocopyCustomFontDataUrl(ev.target?.result as string); setMicrocopyCustomFontName(name) }
                reader.readAsDataURL(file)
                uploadFontToStorage(file, `microcopy-${name}`).then(url => { if (url) setMicrocopyCustomFontUrl(url) })
              }} />
            {microcopyCustomFontName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px' }}>{microcopyCustomFontName}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => { setMicrocopyCustomFontDataUrl(null); setMicrocopyCustomFontName(null); setMicrocopyCustomFontUrl(null) }}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => microcopyFontInputRef.current?.click()}>Upload Microcopy Font</button>
            )}
          </div>
          <div className="form-group">
            <label>Headline Size: {headlineSize}px</label>
            <input type="range" min={40} max={120} value={headlineSize} onChange={e => setHeadlineSize(+e.target.value)} />
          </div>
          <div className="form-group">
            <label>Headline Horizontal Padding: {headlinePaddingX}px</label>
            <input type="range" min={0} max={200} value={headlinePaddingX} onChange={e => setHeadlinePaddingX(+e.target.value)} />
          </div>
          <div className="form-group">
            <label>Microcopy Size: {microcopySize}px</label>
            <input type="range" min={16} max={60} value={microcopySize} onChange={e => setMicrocopySize(+e.target.value)} />
          </div>
          <div className="form-group">
            <label>Microcopy Horizontal Padding: {microcopyPaddingX}px</label>
            <input type="range" min={0} max={200} value={microcopyPaddingX} onChange={e => setMicrocopyPaddingX(+e.target.value)} />
          </div>
          <div className="form-group">
            <label>Text Alignment</label>
            <select value={textAlign} onChange={e => setTextAlign(e.target.value)}>
              {TEXT_ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={uppercase} onChange={e => setUppercase(e.target.checked)} />
              Uppercase Headline
            </label>
          </div>

          {sectionTitle('Layout')}
          <div className="form-group">
            <label>Padding: {padding}px</label>
            <input type="range" min={20} max={160} value={padding} onChange={e => setPadding(+e.target.value)} />
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Advanced position numbers</summary>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label>Vertical Alignment</label>
              <select value={verticalAlign} onChange={e => setVerticalAlign(e.target.value as 'top' | 'center' | 'bottom')} disabled={textPositionEnabled}>
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={textPositionEnabled} onChange={e => setTextPositionEnabled(e.target.checked)} />
                Manual Text Position
              </label>
            </div>
            {textPositionEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Text X: {textX}px</label>
                  <input type="range" min={0} max={980} value={textX} onChange={e => setTextX(+e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Text Y: {textY}px</label>
                  <input type="range" min={0} max={980} value={textY} onChange={e => setTextY(+e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>X (exact px)</label>
                  <input type="number" min={0} max={1080} value={textX} onChange={e => setTextX(+e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Y (exact px)</label>
                  <input type="number" min={0} max={1080} value={textY} onChange={e => setTextY(+e.target.value)} />
                </div>
              </div>
            )}
          </details>

          {sectionTitle('Logo')}
          <div className="form-group">
            <label>Logo Position</label>
            <select value={logoPosition} onChange={e => setLogoPosition(e.target.value)} disabled={logoPositionEnabled}>
              {LOGO_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={logoPositionEnabled} onChange={e => setLogoPositionEnabled(e.target.checked)} />
              Custom logo position (X / Y)
            </label>
            {logoPositionEnabled && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--muted)' }}>X</label>
                  <input type="number" value={logoX} min={0} max={1080} onChange={e => setLogoX(+e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Y</label>
                  <input type="number" value={logoY} min={0} max={1080} onChange={e => setLogoY(+e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Logo Size: {logoSize}px</label>
            <input type="range" min={24} max={200} value={logoSize} onChange={e => setLogoSize(+e.target.value)} />
          </div>

          {sectionTitle('Elements')}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="removeBg" checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="removeBg" style={{ margin: 0 }}>Remove background from generated image (layer subject over custom elements)</label>
          </div>
          <input
            ref={elementInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = ev => {
                const dataUrl = ev.target?.result as string
                setElements(prev => [...prev, {
                  dataUrl, name: file.name,
                  x: 80, y: 80, width: 200, opacity: 100, zIndex: 1,
                }])
              }
              reader.readAsDataURL(file)
              e.target.value = ''
            }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => elementInputRef.current?.click()}>
            + Add Element
          </button>
          {elements.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {elements.map((el, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={el.dataUrl} alt={el.name} loading="lazy" style={{ height: 32, width: 'auto', borderRadius: 4 }} />
                    <span style={{ fontSize: '12px', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.name}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setElements(prev => prev.filter((_, j) => j !== i))}
                    >Remove</button>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>SIZE: {el.width}px</label>
                    <input type="range" min={50} max={1080} value={el.width}
                      onChange={e => setElements(prev => prev.map((item, j) => j === i ? { ...item, width: +e.target.value } : item))}
                      style={{ width: '100%' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {(['x', 'y'] as const).map(field => (
                      <div key={field}>
                        <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>{field.toUpperCase()}</label>
                        <input type="number" value={el[field]} min={0} max={1080}
                          onChange={e => setElements(prev => prev.map((item, j) => j === i ? { ...item, [field]: +e.target.value } : item))} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>OPACITY %</label>
                      <input type="number" value={el.opacity} min={0} max={100}
                        onChange={e => setElements(prev => prev.map((item, j) => j === i ? { ...item, opacity: +e.target.value } : item))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>LAYER</label>
                      <select value={el.zIndex}
                        onChange={e => setElements(prev => prev.map((item, j) => j === i ? { ...item, zIndex: +e.target.value } : item))}>
                        <option value={3}>Above text &amp; logo</option>
                        <option value={1}>In front of subject, behind text</option>
                        <option value={-1}>Behind subject (behind bg image)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sectionTitle('Accent Bar')}
          <div className="form-group">
            <label>Position</label>
            <select value={accentPosition} onChange={e => setAccentPosition(e.target.value)}>
              {ACCENT_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Thickness: {accentSize}px</label>
            <input type="range" min={0} max={40} value={accentSize} onChange={e => setAccentSize(+e.target.value)} />
          </div>
          <div className="form-group">
            <label>Pattern Opacity: {patternOpacity}%</label>
            <input type="range" min={0} max={40} value={patternOpacity} onChange={e => setPatternOpacity(+e.target.value)} />
          </div>

          {sectionTitle('CTA Button')}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={ctaEnabled} onChange={e => setCtaEnabled(e.target.checked)} />
              Show CTA Button
            </label>
          </div>
          {ctaEnabled && (
            <>
              <div className="form-group">
                <label>Button Text</label>
                <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)} />
              </div>
              {colorInput('Button Color', ctaBgColor, setCtaBgColor)}
              {colorInput('Text Color', ctaTextColor, setCtaTextColor)}
              <div className="form-group">
                <label>Font Size: {ctaFontSize}px</label>
                <input type="range" min={14} max={60} value={ctaFontSize} onChange={e => setCtaFontSize(+e.target.value)} />
              </div>
              <div className="form-group">
                <label>CTA Custom Font</label>
                <input ref={ctaFontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const name = file.name.replace(/\.[^.]+$/, '')
                    const reader = new FileReader()
                    reader.onload = ev => { setCtaCustomFontDataUrl(ev.target?.result as string); setCtaCustomFontName(name) }
                    reader.readAsDataURL(file)
                    uploadFontToStorage(file, `cta-${name}`).then(url => { if (url) setCtaCustomFontUrl(url) })
                  }} />
                {ctaCustomFontName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px' }}>{ctaCustomFontName}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setCtaCustomFontDataUrl(null); setCtaCustomFontName(null); setCtaCustomFontUrl(null) }}>Remove</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => ctaFontInputRef.current?.click()}>Upload Font</button>
                )}
              </div>
              <div className="form-group">
                <label>CTA Font</label>
                <select value={ctaFontFamily} onChange={e => setCtaFontFamily(e.target.value)}>
                  <option value="">Same as headline</option>
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>H Padding: {ctaPaddingX}px</label>
                  <input type="range" min={10} max={120} value={ctaPaddingX} onChange={e => setCtaPaddingX(+e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>V Padding: {ctaPaddingY}px</label>
                  <input type="range" min={6} max={60} value={ctaPaddingY} onChange={e => setCtaPaddingY(+e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Border Radius</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" min={0} max={9999} value={ctaBorderRadius}
                    style={{ flex: 1 }}
                    onChange={e => setCtaBorderRadius(+e.target.value)} />
                  <button className="btn btn-secondary btn-sm" onClick={() => setCtaBorderRadius(9999)}>Pill</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCtaBorderRadius(0)}>Square</button>
                </div>
              </div>
              <div className="form-group">
                <label>Position Preset</label>
                <select value={ctaPositionPreset} onChange={e => applyCtaPreset(e.target.value)}>
                  <option value="">Custom (use sliders below)</option>
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="center-left">Center Left</option>
                  <option value="center">Center</option>
                  <option value="center-right">Center Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>X: {ctaX}px</label>
                  <input type="range" min={0} max={980} value={ctaX} onChange={e => { setCtaX(+e.target.value); setCtaPositionPreset('') }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Y: {ctaY}px</label>
                  <input type="range" min={0} max={980} value={ctaY} onChange={e => { setCtaY(+e.target.value); setCtaPositionPreset('') }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>X (exact px)</label>
                  <input type="number" min={0} max={1080} value={ctaX} onChange={e => setCtaX(+e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Y (exact px)</label>
                  <input type="number" min={0} max={1080} value={ctaY} onChange={e => setCtaY(+e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handlePreview} disabled={previewing}>
              {previewing ? 'Rendering…' : 'Download PNG'}
            </button>
            <button className="generate-btn" style={{ flex: 2, marginTop: 0 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>

        {/* Right panel — live canvas */}
        <div>
          <OverlayCanvas
            payload={canvasPayload}
            onMove={handleCanvasMove}
            onReset={handleCanvasReset}
            padding={padding}
            emptyHint="Drag headline and microcopy on the canvas."
          />
          {previewUrl && (
            <a href={previewUrl} download="overlay-preview.png" className="btn btn-secondary btn-sm" style={{ marginTop: 8, display: 'inline-block' }}>
              Open last PNG
            </a>
          )}
          {previewError && <p style={{ color: 'var(--error, #e74c3c)', fontSize: 12, marginTop: 8 }}>{previewError}</p>}
        </div>
      </div>
    </>
  )
}
