'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { useLightbox } from '@/lib/lightbox'
import { sb } from '@/lib/supabase'
import { useGenerateStore, type GenerationResult, type SlideState, type RenderParams, type CtaConfig, emptySlide } from '@/lib/generate-store'
import { buildStaticPostSVG } from '@/lib/static-post-figma'
import { uploadMedia } from '@/lib/media-upload'

const HEADLINE_MAX = 40
const MICROCOPY_MAX = 100
const CTA_MAX = 25


// ─── AI mode types ────────────────────────────────────────────────────────────
interface Brand { id: string; name: string }
interface Category { id: string; label: string }

async function callN8n(payload: object): Promise<{ imageUrl: string }> {
  const res = await authedFetch('/api/generate-social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
  let data: { imageUrl?: string; output_url?: string; error?: string }
  try { data = JSON.parse(text) } catch { throw new Error('Non-JSON response: ' + text) }
  if (data.error) throw new Error(data.error)
  const imageUrl = data.imageUrl || data.output_url
  if (!imageUrl) throw new Error('No imageUrl in: ' + text)
  return { imageUrl }
}


// ─── Puppeteer / Editable mode types ─────────────────────────────────────────
interface OverlayTemplate { id: string; name: string; puppeteer_config: Record<string, unknown> }

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

const AI_MESSAGES = [
  'Reading your prompt…',
  'Studying brand design language…',
  'Selecting visual references…',
  'Generating variations…',
  'Applying brand colors…',
  'Placing logo overlay…',
  'Running quality check…',
  'Polishing final output…',
  'Almost there…',
]

const PUPPETEER_MESSAGES = [
  'Reading your headline…',
  'Reading microcopy…',
  'Selecting design templates…',
  'Generating background…',
  'Applying brand identity…',
  'Placing text overlay…',
  'Refining composition…',
  'Rendering final image…',
  'Almost there…',
]

// keyframe points [elapsed_seconds, percent]
const PROGRESS_CURVE: [number, number][] = [[0,0],[23,55],[41,75],[52,88],[58,92]]

function interpolate(elapsed: number): number {
  for (let i = 1; i < PROGRESS_CURVE.length; i++) {
    const [t0, p0] = PROGRESS_CURVE[i - 1]
    const [t1, p1] = PROGRESS_CURVE[i]
    if (elapsed <= t1) return p0 + (p1 - p0) * (elapsed - t0) / (t1 - t0)
  }
  return PROGRESS_CURVE[PROGRESS_CURVE.length - 1][1]
}

function GeneratingOverlay({ messages, startTime }: { messages: string[]; startTime: number }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const msg = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 5000)
    const prog = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      setPct(Math.round(interpolate(elapsed)))
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [messages, startTime])

  return (
    <div style={{ padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{messages[msgIdx]}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '999px',
          background: 'var(--primary, #6366f1)',
          width: `${pct}%`, transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function GenerateContent() {
  const { userRole, userBrandId, userBrandName, userEmail, userTokens, deductTokens } = useAuth()
  const { showToast } = useToast()
  const { openLightbox } = useLightbox()
  const searchParams = useSearchParams()

  // Persisted state from store (survives navigation)
  const {
    mode, setMode,
    selectedBrandId, setSelectedBrandId,
    headline, setHeadline,
    microcopy, setMicrocopy,
    cta, setCta,
    selectedCatId, setSelectedCatId,
    generating, setGenerating,
    aiResults, setAiResults,
    slides, setSlides,
    activeIdx, setActiveIdx,
    puppeteerLoading, setPuppeteerLoading,
    error, setError,
    refetchDebounce,
    generationStartTime, setGenerationStartTime,
  } = useGenerateStore()

  // Local-only (UI state that doesn't need to persist)
  const [brands, setBrands] = useState<Brand[]>([])
  const [overlayTemplates, setOverlayTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [exporting, setExporting] = useState(false)
  const [copyingIdx, setCopyingIdx] = useState<number | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)

  const effectiveBrandId = userRole === 'user' ? userBrandId! : selectedBrandId
  const editMode = activeIdx !== null

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => {
        setBrands(data || [])
        const preselect = searchParams.get('brand')
        if (preselect) { setSelectedBrandId(preselect); loadCategories(preselect) }
      })
    } else if (userBrandId) {
      loadCategories(userBrandId)
    }
  }, [userRole, userBrandId, searchParams])

  useEffect(() => {
    if (userRole !== 'admin' || !effectiveBrandId) { setOverlayTemplates([]); setSelectedTemplateId(''); return }
    sb.from('overlay_templates').select('id,name').eq('brand_id', effectiveBrandId).order('created_at')
      .then(({ data }) => { setOverlayTemplates(data || []); setSelectedTemplateId('') })
  }, [effectiveBrandId, userRole])

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => setScale(entries[0].contentRect.width / 1080))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [activeIdx])

  async function loadCategories(brandId: string) {
    const { data: cats } = await sb.from('reference_categories').select('*').eq('brand_id', brandId).order('created_at')
    setCategories(cats || [])
    setSelectedCatId('')
  }

  // ── AI generate ─────────────────────────────────────────────────────────────
  async function handleAiGenerate() {
    const brandId = userRole === 'user' ? userBrandId! : selectedBrandId
    if (!brandId) { showToast('Please select a brand.', true); return }
    if (!selectedCatId) { showToast('Please select a reference type.', true); return }
    if (!headline.trim()) { showToast('Please enter a headline.', true); return }
    if (!cta.trim()) { showToast('Please enter a CTA.', true); return }
    if (headline.length > HEADLINE_MAX) { showToast(`Headline must be ${HEADLINE_MAX} characters or less.`, true); return }
    if (microcopy.length > MICROCOPY_MAX) { showToast(`Microcopy must be ${MICROCOPY_MAX} characters or less.`, true); return }
    if (cta.length > CTA_MAX) { showToast(`CTA must be ${CTA_MAX} characters or less.`, true); return }
    if (userRole === 'user' && (userTokens === null || userTokens < 2)) {
      showToast('Not enough tokens to generate.', true); return
    }
    setGenerating(true); setAiResults(null); setError(null); setGenerationStartTime(Date.now())
    const payload = { referenceCategoryId: selectedCatId, brandId, headline: headline.trim(), cta: cta.trim() }
    const settled = await Promise.allSettled([callN8n(payload), callN8n(payload)])
    await new Promise(r => setTimeout(r, 1500))
    const mapped: GenerationResult[] = settled.map(r =>
      r.status === 'fulfilled'
        ? { status: 'fulfilled', value: r.value }
        : { status: 'rejected', reason: r.reason as { message?: string } }
    )
    setAiResults(mapped)
    setGenerating(false)
    if (userRole === 'user') {
      const successCount = mapped.filter(r => r.status === 'fulfilled').length
      if (successCount > 0) await deductTokens(successCount)
    }
  }

  // ── Puppeteer generate ───────────────────────────────────────────────────────
  function updateSlide(idx: 0 | 1, patch: Partial<SlideState>) {
    setSlides(s => { const n: [SlideState, SlideState] = [{ ...s[0] }, { ...s[1] }]; n[idx] = { ...n[idx], ...patch }; return n })
  }

  function updateEditParams(idx: 0 | 1, updater: (p: RenderParams) => RenderParams) {
    setSlides(s => {
      if (!s[idx].editParams) return s
      const n: [SlideState, SlideState] = [{ ...s[0] }, { ...s[1] }]
      n[idx] = { ...n[idx], editParams: updater(s[idx].editParams!) }
      return n
    })
  }

  useEffect(() => {
    if (activeIdx === null) return
    const idx = activeIdx
    function onMessage(e: MessageEvent) {
      const d = e.data; if (!d?.type) return
      if (d.type === 'ready') {
        updateEditParams(idx, p => {
          const next = { ...p }
          if (d.positions?.headline) { next.headlineX = d.positions.headline.x; next.headlineY = d.positions.headline.y }
          if (d.positions?.microcopy) { next.microcopyX = d.positions.microcopy.x; next.microcopyY = d.positions.microcopy.y }
          if (d.positions?.cta && next.cta) next.cta = { ...next.cta, x: d.positions.cta.x, y: d.positions.cta.y }
          if (d.ctaSize && next.cta) { next.ctaWidth = d.ctaSize.w; next.ctaHeight = d.ctaSize.h }
          if (d.positions?.logo) { next.logoX = d.positions.logo.x; next.logoY = d.positions.logo.y }
          if (d.lines?.headline) next.headlineLines = d.lines.headline
          if (d.lines?.microcopy) next.microcopyLines = d.lines.microcopy
          return next
        })
      }
      if (d.type === 'move') {
        updateEditParams(idx, p => {
          if (d.key === 'headline') return { ...p, headlineX: d.x, headlineY: d.y }
          if (d.key === 'microcopy') return { ...p, microcopyX: d.x, microcopyY: d.y }
          if (d.key === 'cta' && p.cta) return { ...p, cta: { ...p.cta, x: d.x, y: d.y } }
          if (d.key === 'logo') return { ...p, logoX: d.x, logoY: d.y }
          return p
        })
      }
      if (d.type === 'text') {
        updateEditParams(idx, p => {
          if (d.key === 'headline') return { ...p, headline: d.value }
          if (d.key === 'microcopy') return { ...p, microcopy: d.value }
          if (d.key === 'ctaText' && p.cta) return { ...p, cta: { ...p.cta, text: d.value } }
          return p
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [activeIdx])

  async function fetchHtml(params: RenderParams): Promise<string> {
    const res = await authedFetch('/api/test-render-slide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, returnHtml: true }),
    })
    if (!res.ok) throw new Error('Failed to load editor')
    return res.text()
  }

  async function renderPng(params: RenderParams): Promise<{ blobUrl: string; blob: Blob }> {
    const res = await authedFetch('/api/test-render-slide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Render failed') }
    const blob = await res.blob()
    return { blobUrl: URL.createObjectURL(blob), blob }
  }

  async function saveToHistory(blob: Blob, brandId: string, headlineText: string, renderParams?: RenderParams): Promise<string> {
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`
    const uploaded = await uploadMedia(blob, { folder: `generated-posts/${brandId}`, fileName })
    const publicUrl = uploaded.url
    // Strip large base64 subject image before storing — not needed for SVG export
    const paramsToStore = renderParams ? { ...renderParams, subjectImageDataUrl: null } : null
    await sb.from('generated_posts').insert({ brand_id: brandId, output_url: publicUrl, headline: headlineText, is_editable_social: true, render_params: paramsToStore, ...(userEmail ? { created_by_email: userEmail } : {}) })
    return publicUrl
  }

  async function handlePuppeteerGenerate() {
    const brandId = effectiveBrandId
    if (!brandId) { showToast('Please select a brand.', true); return }
    if (!headline.trim()) { showToast('Please enter a headline.', true); return }
    if (userRole === 'user' && (userTokens === null || userTokens < 2)) {
      showToast('Not enough tokens to generate.', true); return
    }
    setPuppeteerLoading(true); setError(null); setActiveIdx(null); setGenerationStartTime(Date.now())
    setSlides([emptySlide(), emptySlide()])

    try {
      const { data: allTemplates, error: tErr } = await sb
        .from('overlay_templates').select('id,name,puppeteer_config').eq('brand_id', brandId)
      if (tErr) throw new Error(tErr.message)
      if (!allTemplates?.length) throw new Error('No overlay templates found for this brand.')

      const pool = selectedTemplateId
        ? allTemplates.filter(t => t.id === selectedTemplateId)
        : allTemplates
      const t1: OverlayTemplate = pickRandom(pool.length ? pool : allTemplates)
      const rest = allTemplates.length > 1 ? allTemplates.filter(t => t.id !== t1.id) : allTemplates
      const t2: OverlayTemplate = selectedTemplateId ? t1 : pickRandom(rest)

      // Ask GPT to wrap 1–2 key words in **...**  for accent coloring — runs in
      // parallel with bg generation so it adds zero extra wait time
      const accentCopyPromise = authedFetch('/api/accent-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: headline.trim(), microcopy: microcopy.trim() }),
      }).then(r => r.ok ? r.json() : { headline: headline.trim(), microcopy: microcopy.trim() })
        .catch(() => ({ headline: headline.trim(), microcopy: microcopy.trim() }))

      const copyPayload = { heading: headline.trim(), ...(microcopy.trim() ? { microcopy: microcopy.trim() } : {}) }
      const callGenerateBg = async (overlayTemplateId: string) => {
        const res = await authedFetch('/api/generate-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, overlayTemplateId, copy: copyPayload }),
        })
        const text = await res.text()
        let data: { bgImageUrl?: string; logoUrl?: string; error?: string }
        try { data = JSON.parse(text) } catch { throw new Error('n8n error: ' + text) }
        if (!res.ok || data.error) throw new Error(data.error || ('n8n error: ' + text))
        return data
      }
      const [bg1, bg2] = await Promise.all([
        callGenerateBg(t1.id),
        callGenerateBg(t2.id),
      ])
      if (!bg1.bgImageUrl || !bg2.bgImageUrl) throw new Error('n8n did not return background image URLs')
      const bgPair = [
        { bgImageUrl: bg1.bgImageUrl, logoUrl: bg1.logoUrl || '' },
        { bgImageUrl: bg2.bgImageUrl, logoUrl: bg2.logoUrl || '' },
      ] as const

      const cfg1 = t1.puppeteer_config || {}
      const cfg2 = t2.puppeteer_config || {}
      const ctaVal = cta.trim()
      const makeCta = (cfg: Record<string, unknown>): CtaConfig | null =>
        ctaVal ? { ...((cfg.cta as CtaConfig | null) ?? {}), text: ctaVal } as CtaConfig : null

      const fetchRemovedBg = async (imageUrl: string): Promise<string | null> => {
        try {
          const res = await authedFetch('/api/remove-bg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl }) })
          if (!res.ok) return null
          const blob = await res.blob()
          return await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(blob) })
        } catch { return null }
      }

      const [subjectUrl1, subjectUrl2, accentedCopy] = await Promise.all([
        cfg1.removeBg ? fetchRemovedBg(bgPair[0].bgImageUrl) : Promise.resolve(null),
        cfg2.removeBg ? fetchRemovedBg(bgPair[1].bgImageUrl) : Promise.resolve(null),
        accentCopyPromise,
      ])

      const mkParams = (cfg: Record<string, unknown>, bg: { bgImageUrl: string; logoUrl: string }, subjectImageDataUrl: string | null): RenderParams => ({
        ...cfg,
        headline: accentedCopy.headline, microcopy: microcopy.trim(),
        logoUrl: (cfg.logoDataUrl as string) || bg.logoUrl || '',
        bgImageDataUrl: bg.bgImageUrl, cta: makeCta(cfg),
        textPosition: (cfg.textPosition as { x: number; y: number } | null) ?? null,
        headlineSize: (cfg.headlineSize as number) || 86,
        microcopySize: (cfg.microcopySize as number) || 32,
        headlineX: null, headlineY: null, microcopyX: null, microcopyY: null,
        subjectImageDataUrl,
      })

      const p1 = mkParams(cfg1, bgPair[0], subjectUrl1)
      const p2 = mkParams(cfg2, bgPair[1], subjectUrl2)
      const [r1, r2] = await Promise.all([renderPng(p1), renderPng(p2)])

      // Upload both to storage in background (don't block UI)
      Promise.all([
        saveToHistory(r1.blob, brandId, headline.trim(), p1),
        saveToHistory(r2.blob, brandId, headline.trim(), p2),
      ]).catch(() => {})

      setSlides([
        { pngUrl: r1.blobUrl, baseParams: p1, editParams: { ...p1 }, iframeHtml: null, iframeLoading: false },
        { pngUrl: r2.blobUrl, baseParams: p2, editParams: { ...p2 }, iframeHtml: null, iframeLoading: false },
      ])

      if (userRole === 'user') await deductTokens(2)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPuppeteerLoading(false)
    }
  }

  async function enterEditMode(idx: 0 | 1) {
    const slide = slides[idx]
    if (!slide.editParams) return
    updateSlide(idx, { iframeLoading: true })
    setActiveIdx(idx)
    try {
      const html = await fetchHtml(slide.editParams)
      updateSlide(idx, { iframeHtml: html, iframeLoading: false })
    } catch (err) {
      setError((err as Error).message)
      updateSlide(idx, { iframeLoading: false })
      setActiveIdx(null)
    }
  }

  function sendToIframe(sel: string, value: string) {
    iframeRef.current?.contentWindow?.postMessage({ type: 'setText', sel, value }, '*')
  }

  async function copyStaticPostToFigma(idx: 0 | 1) {
    const slide = slides[idx]
    if (!slide.editParams) return
    setCopyingIdx(idx)
    const svgPromise = buildStaticPostSVG(slide.editParams)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': svgPromise.then(svg => new Blob([svg], { type: 'text/plain' })),
        }),
      ])
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch {
      try {
        const svg = await svgPromise
        const ta = document.createElement('textarea')
        ta.value = svg
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopiedIdx(idx)
        setTimeout(() => setCopiedIdx(null), 2000)
      } catch { /* silent */ }
    } finally {
      setCopyingIdx(null)
    }
  }

  function updateText(key: 'headline' | 'microcopy', value: string) {
    if (activeIdx === null) return
    updateEditParams(activeIdx, p => ({ ...p, [key]: value }))
    sendToIframe(`.${key}`, value)
  }

  function updateCtaText(value: string) {
    if (activeIdx === null) return
    updateEditParams(activeIdx, p => p.cta ? { ...p, cta: { ...p.cta, text: value } } : p)
    sendToIframe('[data-type="cta"]', value)
  }

  function updateAndRefetch(updater: (p: RenderParams) => RenderParams) {
    if (activeIdx === null) return
    const idx = activeIdx
    setSlides(s => {
      if (!s[idx].editParams) return s
      const next = updater(s[idx].editParams!)
      if (refetchDebounce.current) clearTimeout(refetchDebounce.current)
      refetchDebounce.current = setTimeout(async () => {
        updateSlide(idx, { iframeLoading: true })
        try { updateSlide(idx, { iframeHtml: await fetchHtml(next), iframeLoading: false }) } catch { updateSlide(idx, { iframeLoading: false }) }
      }, 500)
      const n: [SlideState, SlideState] = [{ ...s[0] }, { ...s[1] }]
      n[idx] = { ...n[idx], editParams: next }
      return n
    })
  }

  async function handleExportSlide() {
    if (activeIdx === null) return
    const idx = activeIdx
    const slide = slides[idx]
    if (!slide.editParams) return
    setExporting(true)
    try {
      const { blobUrl, blob } = await renderPng(slide.editParams)
      saveToHistory(blob, effectiveBrandId, slide.editParams.headline).catch(() => {})
      updateSlide(idx, { pngUrl: blobUrl, iframeHtml: null })
      setActiveIdx(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }
  
  function handleResetSlide() {
    if (activeIdx === null) return
    const idx = activeIdx
    const slide = slides[idx]
    if (!slide.baseParams) return
    updateSlide(idx, { editParams: { ...slide.baseParams } })
    fetchHtml(slide.baseParams).then(html => updateSlide(idx, { iframeHtml: html })).catch(() => {})
  }

  const exitEdit = useCallback(() => {
    if (activeIdx === null) return
    updateSlide(activeIdx, { iframeHtml: null })
    setActiveIdx(null)
  }, [activeIdx])

  const activeSlide = activeIdx !== null ? slides[activeIdx] : null
  const hasPuppeteerSlides = slides[0].pngUrl || slides[1].pngUrl
  const tokensLow = userTokens !== null && userTokens <= 10
  const noTokens = userRole === 'user' && (userTokens === null || userTokens < 2)

  return (
    <>
      <h1>Static Socials</h1>
      <p className="subtitle">Create a branded social post.</p>
      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div className="form-card">
          {!editMode ? (
            <>
              <h2>Settings</h2>

              {/* Brand */}
              {userRole === 'admin' ? (
                <div className="form-group">
                  <label>Brand</label>
                  <select value={selectedBrandId} onChange={e => { setSelectedBrandId(e.target.value); loadCategories(e.target.value) }}>
                    <option value="">Select a brand…</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label>Brand</label>
                  <div style={{ padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', color: 'var(--text)' }}>
                    {userBrandName}
                  </div>
                </div>
              )}

              {overlayTemplates.length > 0 && (
                <div className="form-group">
                  <label>Template <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(leave blank to pick randomly)</span></label>
                  <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                    <option value="">Random</option>
                    {overlayTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Headline */}
              <div className="form-group">
                <label>
                  Headline{' '}
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>(max {HEADLINE_MAX} chars)</span>
                </label>
                <textarea rows={2}
                  placeholder="e.g. STREAMLINE YOUR WORKFLOW"
                  value={headline} onChange={e => setHeadline(e.target.value)} />
                {headline.length > HEADLINE_MAX && (
                  <span style={{ fontSize: '12px', color: 'var(--error, #e53e3e)' }}>{headline.length}/{HEADLINE_MAX} - too long</span>
                )}
              </div>

              {/* Microcopy */}
              <div className="form-group">
                <label>Microcopy <span style={{ fontSize: '12px', color: 'var(--muted)' }}>(max {MICROCOPY_MAX} chars)</span></label>
                <textarea rows={2} placeholder="e.g. A short sentence supporting the headline."
                  value={microcopy} onChange={e => setMicrocopy(e.target.value)} />
                {microcopy.length > MICROCOPY_MAX && (
                  <span style={{ fontSize: '12px', color: 'var(--error, #e53e3e)' }}>{microcopy.length}/{MICROCOPY_MAX} - too long</span>
                )}
              </div>

              {/* CTA */}
              <div className="form-group">
                <label>
                  CTA<span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}> (max {CTA_MAX} chars)</span>
                </label>
                <input type="text" placeholder="e.g. Learn More"
                  value={cta} onChange={e => setCta(e.target.value)} />
                {cta.length > CTA_MAX && (
                  <span style={{ fontSize: '12px', color: 'var(--error, #e53e3e)' }}>{cta.length}/{CTA_MAX} - too long</span>
                )}
              </div>

              <button className="generate-btn"
                onClick={handlePuppeteerGenerate}
                disabled={generating || puppeteerLoading || noTokens || headline.length > HEADLINE_MAX || microcopy.length > MICROCOPY_MAX || cta.length > CTA_MAX}>
                {(generating || puppeteerLoading) ? 'Generating…' : 'Generate'}
              </button>

              {error && <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--error,#e74c3c)' }}>{error}</p>}

              {userRole === 'user' && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  {noTokens ? (
                    <span style={{ fontSize: '13px', color: 'var(--red)' }}>
                      {userTokens ?? 0} token{(userTokens ?? 0) !== 1 ? 's' : ''} left —{' '}
                      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                      <a href="#" style={{ color: 'var(--red)', textDecoration: 'underline' }} onClick={e => e.preventDefault()}>
                        request more tokens
                      </a>{' '}to keep generating.
                    </span>
                  ) : userTokens === null ? null : (
                    <span style={{ fontSize: '13px', color: tokensLow ? '#f59e0b' : 'var(--muted)' }}>
                      {userTokens} token{userTokens !== 1 ? 's' : ''} left
                    </span>
                  )}
                </div>
              )}
            </>
          ) : activeSlide?.editParams ? (
            /* ── Edit panel ──────────────────────────────────────────────── */
            <>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Edit — Slide {(activeIdx ?? 0) + 1}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Click any text on the image to edit it. Drag to reposition.
              </p>
              <div className="form-group">
                <label>Headline</label>
                <input type="text" value={activeSlide.editParams.headline} onChange={e => updateText('headline', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Headline Size</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="range" min={20} max={200} value={activeSlide.editParams.headlineSize}
                    style={{ flex: 1, accentColor: 'var(--primary,#6366f1)', cursor: 'pointer' }}
                    onChange={e => updateAndRefetch(p => ({ ...p, headlineSize: +e.target.value }))} />
                  <input type="number" min={20} max={200} value={activeSlide.editParams.headlineSize}
                    style={{ width: '58px', padding: '6px 8px', fontSize: '13px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', color: 'var(--text)' }}
                    onChange={e => updateAndRefetch(p => ({ ...p, headlineSize: +e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Microcopy</label>
                <textarea rows={2} value={activeSlide.editParams.microcopy} style={{ resize: 'vertical' }}
                  onChange={e => updateText('microcopy', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Microcopy Size</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="range" min={12} max={80} value={activeSlide.editParams.microcopySize}
                    style={{ flex: 1, accentColor: 'var(--primary,#6366f1)', cursor: 'pointer' }}
                    onChange={e => updateAndRefetch(p => ({ ...p, microcopySize: +e.target.value }))} />
                  <input type="number" min={12} max={80} value={activeSlide.editParams.microcopySize}
                    style={{ width: '58px', padding: '6px 8px', fontSize: '13px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', color: 'var(--text)' }}
                    onChange={e => updateAndRefetch(p => ({ ...p, microcopySize: +e.target.value }))} />
                </div>
              </div>
              {activeSlide.editParams.cta && (
                <div className="form-group">
                  <label>CTA Text</label>
                  <input type="text" value={activeSlide.editParams.cta.text} onChange={e => updateCtaText(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="generate-btn" onClick={handleExportSlide} disabled={exporting} style={{ flex: 1 }}>
                  {exporting ? 'Saving…' : 'Save edit'}
                </button>
                <button onClick={handleResetSlide}
                  style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', cursor: 'pointer' }}>
                  Reset
                </button>
              </div>
              <button onClick={exitEdit}
                style={{ width: '100%', marginTop: '8px', padding: '8px', border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>
                ← Back
              </button>
            </>
          ) : null}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div>
          <div className="output-area">

            {/* Editable mode output */}
            <>
              {puppeteerLoading && (
                  <div style={{ width: '100%' }}>
                    <div className="output-grid">
                      <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
                      <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
                    </div>
                    <div style={{ padding: '0 16px 16px' }}>
                      <GeneratingOverlay messages={PUPPETEER_MESSAGES} startTime={generationStartTime ?? Date.now()} />
                    </div>
                  </div>
                )}
                {!puppeteerLoading && !hasPuppeteerSlides && !editMode && (
                  <div className="output-placeholder">
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9l4-4 4 4 4-6 4 6"/>
                    </svg>
                    <p>Your editable posts will appear here</p>
                  </div>
                )}
                {/* PNG view */}
                {!editMode && hasPuppeteerSlides && (
                  <div className="output-grid">
                    {([0, 1] as const).map(idx => {
                      const slide = slides[idx]
                      if (!slide.pngUrl) return null
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => openLightbox(slide.pngUrl!)}>Click image to preview</span>
                            <button
                              disabled={copyingIdx === idx}
                              onClick={() => copyStaticPostToFigma(idx as 0 | 1)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '5px', border: '1px solid #6366f1', background: copiedIdx === idx ? '#6366f1' : 'transparent', color: copiedIdx === idx ? '#fff' : '#6366f1', fontSize: '11px', cursor: copyingIdx === idx ? 'wait' : 'pointer', fontWeight: 600, transition: 'all 0.15s', opacity: copyingIdx === idx ? 0.7 : 1, lineHeight: 1 }}>
                              {copyingIdx === idx ? 'Copying…' : copiedIdx === idx ? '✓ Copied!' : <>Copy to Figma <span style={{ fontSize: '8px', fontWeight: 700, background: copiedIdx === idx ? 'rgba(255,255,255,0.3)' : '#6366f1', color: '#fff', borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.05em' }}>BETA</span></>}
                            </button>
                          </div>
                          <div className="output-grid-item">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={slide.pngUrl} alt={`Post ${idx + 1}`} loading="lazy" style={{ width: '100%', cursor: 'zoom-in' }} onClick={() => openLightbox(slide.pngUrl!)} />
                            <div className="output-actions">
                              <button className="btn btn-secondary btn-sm" onClick={() => enterEditMode(idx)}>Edit</button>
                              <a href={slide.pngUrl} download={`post-${idx + 1}.png`} className="btn btn-secondary btn-sm">Download</a>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* iframe editor */}
                {editMode && (
                  <div className="output-grid">
                    <div className="output-grid-item">
                      <div ref={containerRef} style={{ width: '100%', paddingTop: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
                        {activeSlide?.iframeHtml && (
                          <iframe ref={iframeRef} srcDoc={activeSlide.iframeHtml} loading="lazy"
                            sandbox="allow-scripts allow-same-origin"
                            style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1080, border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left' }}
                          />
                        )}
                        {activeSlide?.iframeLoading && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                          </div>
                        )}
                      </div>
                      <div className="output-actions">
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Click text to edit · Drag to move</span>
                      </div>
                    </div>
                  </div>
                )}
            </>

          </div>
        </div>

      </div>
    </>
  )
}

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateContent />
    </Suspense>
  )
}
