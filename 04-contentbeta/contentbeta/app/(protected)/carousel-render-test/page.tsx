'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { sb } from '@/lib/supabase'

interface Brand { id: string; name: string }
interface OverlayTemplate { id: string; name: string; puppeteer_config: Record<string, unknown> }

interface CtaConfig {
  text: string; bgColor: string; textColor: string
  fontSize: number; paddingX: number; paddingY: number
  borderRadius: number; x: number; y: number
  fontFamily?: string | null
}

interface RenderParams {
  headline: string
  microcopy: string
  logoUrl: string
  bgImageDataUrl: string
  cta: CtaConfig | null
  textPosition: { x: number; y: number } | null
  headlineSize: number
  microcopySize: number
  logoX?: number | null
  logoY?: number | null
  headlineX?: number | null
  headlineY?: number | null
  microcopyX?: number | null
  microcopyY?: number | null
  logoPosition?: string
  logoSize?: number
  padding?: number
  verticalAlign?: string
  [key: string]: unknown
}

interface SlideState {
  pngUrl: string | null
  baseParams: RenderParams | null
  editParams: RenderParams | null
  editMode: boolean
  iframeHtml: string | null
  iframeLoading: boolean
}

const emptySlide = (): SlideState => ({
  pngUrl: null, baseParams: null, editParams: null,
  editMode: false, iframeHtml: null, iframeLoading: false,
})

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function CarouselRenderTestPage() {
  const { userRole } = useAuth()
  const router = useRouter()

  if (userRole && userRole !== 'admin') {
    router.replace('/generate')
    return null
  }

  const [brands, setBrands] = useState<Brand[]>([])
  const [brandId, setBrandId] = useState('')
  const [templates, setTemplates] = useState<OverlayTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [headline, setHeadline] = useState('')
  const [microcopy, setMicrocopy] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [slides, setSlides] = useState<[SlideState, SlideState]>([emptySlide(), emptySlide()])
  // which slide is currently open in edit mode (null = none)
  const [activeIdx, setActiveIdx] = useState<0 | 1 | null>(null)
  const [exporting, setExporting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)
  const refetchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    sb.from('brands').select('id,name').order('name')
      .then(({ data }: { data: Brand[] | null }) => setBrands(data || []))
  }, [])

  useEffect(() => {
    if (!brandId) { setTemplates([]); setSelectedTemplateId(''); return }
    sb.from('overlay_templates').select('id,name,puppeteer_config').eq('brand_id', brandId).order('name')
      .then(({ data }: { data: OverlayTemplate[] | null }) => { setTemplates(data || []); setSelectedTemplateId('') })
  }, [brandId])

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      setScale(entries[0].contentRect.width / 1080)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [activeIdx])

  const editMode = activeIdx !== null

  function updateSlide(idx: 0 | 1, patch: Partial<SlideState>) {
    setSlides(s => {
      const next: [SlideState, SlideState] = [{ ...s[0] }, { ...s[1] }]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  function updateEditParams(idx: 0 | 1, updater: (p: RenderParams) => RenderParams) {
    setSlides(s => {
      const slide = s[idx]
      if (!slide.editParams) return s
      const next: [SlideState, SlideState] = [{ ...s[0] }, { ...s[1] }]
      next[idx] = { ...next[idx], editParams: updater(slide.editParams) }
      return next
    })
  }

  // postMessages from active iframe
  useEffect(() => {
    if (activeIdx === null) return
    const idx = activeIdx
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d?.type) return
      if (d.type === 'ready') {
        updateEditParams(idx, p => {
          const next = { ...p }
          if (d.positions?.headline) { next.headlineX = d.positions.headline.x; next.headlineY = d.positions.headline.y }
          if (d.positions?.microcopy) { next.microcopyX = d.positions.microcopy.x; next.microcopyY = d.positions.microcopy.y }
          if (d.positions?.cta && next.cta) next.cta = { ...next.cta, x: d.positions.cta.x, y: d.positions.cta.y }
          if (d.positions?.logo) { next.logoX = d.positions.logo.x; next.logoY = d.positions.logo.y }
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, returnHtml: true }),
    })
    if (!res.ok) throw new Error('Failed to load editor')
    return res.text()
  }

  async function renderPng(params: RenderParams): Promise<string> {
    const res = await authedFetch('/api/test-render-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Render failed') }
    return URL.createObjectURL(await res.blob())
  }

  function buildParams(cfg: Record<string, unknown>, bgImageUrl: string, logoUrl: string, cta: CtaConfig | null): RenderParams {
    return {
      ...cfg,
      headline: headline.trim(), microcopy: microcopy.trim(),
      logoUrl: logoUrl || (cfg.logoUrl as string) || '',
      bgImageDataUrl: bgImageUrl, cta,
      textPosition: (cfg.textPosition as { x: number; y: number } | null) ?? null,
      headlineSize: (cfg.headlineSize as number) || 86,
      microcopySize: (cfg.microcopySize as number) || 32,
      headlineX: null, headlineY: null,
      microcopyX: null, microcopyY: null,
    }
  }

  async function handleGenerate() {
    if (!brandId) { setError('Please select a brand'); return }
    if (!headline.trim()) { setError('Headline is required'); return }
    setLoading(true); setError(null); setStatus(null)
    setActiveIdx(null)
    setSlides([emptySlide(), emptySlide()])

    try {
      setStatus('Fetching overlay templates…')
      const { data: allTemplates, error: tErr } = await sb
        .from('overlay_templates').select('id,name,puppeteer_config').eq('brand_id', brandId)
      if (tErr) throw new Error(tErr.message)
      if (!allTemplates?.length) throw new Error('No overlay templates found for this brand.')

      // Pick 2 templates: if admin chose one use it for both, else pick 2 random (allow repeats if only 1 exists)
      const t1: OverlayTemplate = selectedTemplateId
        ? (allTemplates.find(t => t.id === selectedTemplateId) ?? pickRandom(allTemplates))
        : pickRandom(allTemplates)
      const rest = allTemplates.length > 1 ? allTemplates.filter(t => t.id !== t1.id) : allTemplates
      const t2: OverlayTemplate = selectedTemplateId
        ? t1
        : pickRandom(rest)

      setStatus('Generating backgrounds…')
      const [bg1, bg2] = await Promise.all([
        authedFetch('/api/generate-bg', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, overlayTemplateId: t1.id }),
        }).then(r => r.ok ? r.json() : r.text().then(t => { throw new Error('n8n error: ' + t) })),
        authedFetch('/api/generate-bg', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, overlayTemplateId: t2.id }),
        }).then(r => r.ok ? r.json() : r.text().then(t => { throw new Error('n8n error: ' + t) })),
      ])
      if (!bg1.bgImageUrl || !bg2.bgImageUrl) throw new Error('n8n did not return background image URLs')

      setStatus('Rendering…')
      let cta: CtaConfig | null = null
      const cfg1 = t1.puppeteer_config || {}
      const cfg2 = t2.puppeteer_config || {}
      if (ctaText.trim()) cta = { ...((cfg1.cta as CtaConfig | null) ?? {}), text: ctaText.trim() } as CtaConfig

      const params1 = buildParams(cfg1, bg1.bgImageUrl, bg1.logoUrl, cta)
      const cta2 = ctaText.trim() ? { ...((cfg2.cta as CtaConfig | null) ?? {}), text: ctaText.trim() } as CtaConfig : null
      const params2 = buildParams(cfg2, bg2.bgImageUrl, bg2.logoUrl, cta2)

      const [url1, url2] = await Promise.all([renderPng(params1), renderPng(params2)])

      setSlides([
        { pngUrl: url1, baseParams: params1, editParams: { ...params1 }, editMode: false, iframeHtml: null, iframeLoading: false },
        { pngUrl: url2, baseParams: params2, editParams: { ...params2 }, editMode: false, iframeHtml: null, iframeLoading: false },
      ])
      setStatus(null)
    } catch (err) {
      setError((err as Error).message); setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  async function enterEditMode(idx: 0 | 1) {
    const slide = slides[idx]
    if (!slide.editParams) return
    updateSlide(idx, { iframeLoading: true, editMode: true })
    setActiveIdx(idx)
    try {
      const html = await fetchHtml(slide.editParams)
      updateSlide(idx, { iframeHtml: html, iframeLoading: false })
    } catch (err) {
      setError((err as Error).message)
      updateSlide(idx, { editMode: false, iframeLoading: false })
      setActiveIdx(null)
    }
  }

  function sendToIframe(sel: string, value: string) {
    iframeRef.current?.contentWindow?.postMessage({ type: 'setText', sel, value }, '*')
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
      const slide = s[idx]
      if (!slide.editParams) return s
      const next = updater(slide.editParams)
      if (refetchDebounce.current) clearTimeout(refetchDebounce.current)
      refetchDebounce.current = setTimeout(async () => {
        updateSlide(idx, { iframeLoading: true })
        try { updateSlide(idx, { iframeHtml: await fetchHtml(next), iframeLoading: false }) } catch { updateSlide(idx, { iframeLoading: false }) }
      }, 500)
      const nextSlides: [SlideState, SlideState] = [{ ...s[0] }, { ...s[1] }]
      nextSlides[idx] = { ...nextSlides[idx], editParams: next }
      return nextSlides
    })
  }

  async function handleExport() {
    if (activeIdx === null) return
    const idx = activeIdx
    const slide = slides[idx]
    if (!slide.editParams) return
    setExporting(true)
    try {
      const url = await renderPng(slide.editParams)
      updateSlide(idx, { pngUrl: url, editMode: false, iframeHtml: null })
      setActiveIdx(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  function handleReset() {
    if (activeIdx === null) return
    const idx = activeIdx
    const slide = slides[idx]
    if (!slide.baseParams) return
    updateSlide(idx, { editParams: { ...slide.baseParams } })
    fetchHtml(slide.baseParams).then(html => updateSlide(idx, { iframeHtml: html })).catch(() => {})
  }

  const exitEdit = useCallback(() => {
    if (activeIdx === null) return
    updateSlide(activeIdx, { editMode: false, iframeHtml: null })
    setActiveIdx(null)
  }, [activeIdx])

  const activeSlide = activeIdx !== null ? slides[activeIdx] : null
  const hasSlides = slides[0].pngUrl || slides[1].pngUrl

  return (
    <>
      <h1>Puppeteer Test</h1>
      <p className="subtitle">Generate posts using a brand&apos;s overlay templates — AI background + Puppeteer overlay.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>

        {/* Left panel */}
        <div className="form-card">
          {!editMode ? (
            <>
              <div className="form-group">
                <label>Brand</label>
                <select value={brandId} onChange={e => setBrandId(e.target.value)}>
                  <option value="">Select a brand…</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {templates.length > 0 && (
                <div className="form-group">
                  <label>Template <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                  <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                    <option value="">Random</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Headline</label>
                <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. STREAMLINE YOUR WORKFLOW" />
              </div>
              <div className="form-group">
                <label>Microcopy</label>
                <textarea rows={3} value={microcopy} onChange={e => setMicrocopy(e.target.value)} placeholder="Supporting text…" style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label>CTA Text <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="e.g. Learn More" />
              </div>
              <button className="generate-btn" style={{ marginTop: '8px' }} onClick={handleGenerate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate'}
              </button>
              {status && <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--muted)' }}>{status}</p>}
              {error && <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--error,#e74c3c)' }}>{error}</p>}
            </>
          ) : activeSlide?.editParams ? (
            <>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Edit — Slide {(activeIdx ?? 0) + 1}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Click any text on the image to edit it. Drag to reposition.
              </p>

              <div className="form-group">
                <label>Headline</label>
                <input type="text" value={activeSlide.editParams.headline}
                  onChange={e => updateText('headline', e.target.value)} />
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
                  <input type="text" value={activeSlide.editParams.cta.text}
                    onChange={e => updateCtaText(e.target.value)} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="generate-btn" onClick={handleExport} disabled={exporting} style={{ flex: 1 }}>
                  {exporting ? 'Saving…' : 'Save edit'}
                </button>
                <button onClick={handleReset}
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

        {/* Right panel */}
        <div>
          <div className="output-area" style={{ minHeight: '420px' }}>
            {loading && (
              <div className="output-grid">
                <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
                <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
              </div>
            )}
            {!loading && !hasSlides && !editMode && !error && (
              <div className="output-placeholder">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-6 4 6"/>
                </svg>
                <p>Generated posts will appear here</p>
              </div>
            )}

            {/* PNG view — both slides */}
            {!editMode && hasSlides && (
              <div className="output-grid">
                {([0, 1] as const).map(idx => {
                  const slide = slides[idx]
                  if (!slide.pngUrl) return null
                  return (
                    <div key={idx} className="output-grid-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slide.pngUrl} alt={`Generated post ${idx + 1}`} loading="lazy" style={{ width: '100%' }} />
                      <div className="output-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => enterEditMode(idx)}>Edit image</button>
                        <a href={slide.pngUrl} download={`post-${idx + 1}.png`} className="btn btn-secondary btn-sm">Download</a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* iframe editor — active slide */}
            {editMode && (
              <div className="output-grid">
                <div className="output-grid-item">
                  <div
                    ref={containerRef}
                    style={{ width: '100%', paddingTop: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}
                  >
                    {activeSlide?.iframeHtml && (
                      <iframe
                        ref={iframeRef}
                        srcDoc={activeSlide.iframeHtml}
                        loading="lazy"
                        sandbox="allow-scripts allow-same-origin"
                        style={{
                          position: 'absolute', top: 0, left: 0,
                          width: 1080, height: 1080,
                          border: 'none',
                          transform: `scale(${scale})`,
                          transformOrigin: 'top left',
                        }}
                      />
                    )}
                    {activeSlide?.iframeLoading && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          width: 32, height: 32,
                          border: '3px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff', borderRadius: '50%',
                          animation: 'spin 0.7s linear infinite',
                        }} />
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      </div>
                    )}
                  </div>
                  <div className="output-actions">
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Click text to edit · Drag to move
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
