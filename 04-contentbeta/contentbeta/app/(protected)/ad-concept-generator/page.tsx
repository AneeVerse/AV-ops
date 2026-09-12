'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { useLightbox } from '@/lib/lightbox'
import { useAdConceptGeneration } from '@/lib/ad-concept-generation'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'

interface Brand { id: string; name: string }
interface AdAngle { id: string; name: string; description: string | null }
interface LogoOption { url: string; label: string }

const AD_MESSAGES = [
  'Analyzing brand…',
  'Selecting visual reference…',
  'Generating ad image…',
  'Applying brand overlay…',
  'Refining composition…',
  'Almost there…',
]

const PROGRESS_CURVE: [number, number][] = [[0, 0], [23, 55], [41, 75], [52, 88], [58, 92]]

function interpolate(elapsed: number): number {
  for (let i = 1; i < PROGRESS_CURVE.length; i++) {
    const [t0, p0] = PROGRESS_CURVE[i - 1]
    const [t1, p1] = PROGRESS_CURVE[i]
    if (elapsed <= t1) return p0 + (p1 - p0) * (elapsed - t0) / (t1 - t0)
  }
  return PROGRESS_CURVE[PROGRESS_CURVE.length - 1][1]
}

function GeneratingOverlay({ startTime }: { startTime: number }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const msg = setInterval(() => setMsgIdx(i => (i + 1) % AD_MESSAGES.length), 5000)
    const prog = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      setPct(Math.round(interpolate(elapsed)))
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [startTime])

  return (
    <div style={{ padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{AD_MESSAGES[msgIdx]}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function AdConceptGeneratorPage() {
  const { userRole, userBrandId, userBrandName, userAllowedPages, userEmail } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (userRole === null) return
    const allowed = userRole === 'admin' || userAllowedPages.includes('ad-concept-generator')
    if (!allowed) router.replace('/generate')
  }, [userRole, userAllowedPages, router])

  const { showToast } = useToast()
  const { openLightbox } = useLightbox()
  const {
    generating, results,
    selectedBrandId, selectedAngleId,
    setSelectedBrandId, setSelectedAngleId,
    startGeneration, updateResultUrl,
  } = useAdConceptGeneration()

  const [brands, setBrands] = useState<Brand[]>([])
  const [angles, setAngles] = useState<AdAngle[]>([])
  const startTimeRef = useRef<number>(Date.now())

  // Logo editor state
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [logos, setLogos] = useState<LogoOption[]>([])
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(80)
  const [logoX, setLogoX] = useState<number | null>(null)
  const [logoY, setLogoY] = useState<number | null>(null)
  const [iframeHtml, setIframeHtml] = useState<string | null>(null)
  const [iframeLoading, setIframeLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const prevLogoRef = useRef<string | null>(null)
  const sizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editMode = editIdx !== null
  const effectiveBrandId = userRole === 'user' ? userBrandId : selectedBrandId

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
    }
    sb.from('ad_angles').select('*').order('created_at').then(({ data }) => setAngles(data || []))
  }, [userRole])

  // Fetch logos when entering edit mode
  useEffect(() => {
    if (editIdx === null || !effectiveBrandId) return
    const query = sb.from('brand_profiles').select('logo_url, brands(name)').not('logo_url', 'is', null).eq('brand_id', effectiveBrandId)
    query.then(({ data }) => {
      setLogos(
        (data || [])
          .filter(d => d.logo_url)
          .map(d => ({ url: d.logo_url!, label: (d.brands as unknown as { name: string } | null)?.name || 'Logo' }))
      )
    })
  }, [editIdx, effectiveBrandId, userRole])

  // Scale iframe to container width
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => setScale(entries[0].contentRect.width / 1080))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [editIdx])

  // postMessage listener for logo drag
  useEffect(() => {
    if (editIdx === null) return
    function onMsg(e: MessageEvent) {
      const d = e.data; if (!d?.type) return
      if (d.type === 'ready' && d.positions?.logo) { setLogoX(d.positions.logo.x); setLogoY(d.positions.logo.y) }
      if (d.type === 'move' && d.key === 'logo') { setLogoX(d.x); setLogoY(d.y) }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [editIdx])

  async function fetchIframeHtml(lx: number | null, ly: number | null, size: number, logo: string, bgUrl: string) {
    setIframeLoading(true)
    try {
      const res = await authedFetch('/api/test-render-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: '', microcopy: '',
          bgImageDataUrl: bgUrl,
          logoUrl: logo,
          logoSize: size,
          logoX: lx, logoY: ly,
          logoPosition: 'bottom-left',
          padding: 40, elements: [],
          hideText: true, returnHtml: true,
        }),
      })
      if (res.ok) setIframeHtml(await res.text())
    } finally {
      setIframeLoading(false)
    }
  }

  // When selected logo changes: reset position and fetch fresh HTML
  useEffect(() => {
    if (!selectedLogo || editIdx === null) { setIframeHtml(null); return }
    if (prevLogoRef.current !== selectedLogo) {
      prevLogoRef.current = selectedLogo
      setLogoX(null); setLogoY(null)
      const r = results?.[editIdx]
      if (r?.status === 'fulfilled') fetchIframeHtml(null, null, logoSize, selectedLogo, r.value.supabaseUrl || r.value.imageUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogo])

  function handleSizeChange(newSize: number) {
    setLogoSize(newSize)
    if (!selectedLogo || editIdx === null) return
    if (sizeDebounceRef.current) clearTimeout(sizeDebounceRef.current)
    sizeDebounceRef.current = setTimeout(() => {
      const r = results?.[editIdx]
      if (r?.status === 'fulfilled') fetchIframeHtml(logoX, logoY, newSize, selectedLogo, r.value.supabaseUrl || r.value.imageUrl)
    }, 400)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setLogos(prev => prev.find(l => l.url === url) ? prev : [{ url, label: file.name }, ...prev])
      setSelectedLogo(url)
    }
    reader.readAsDataURL(file)
  }

  function enterEdit(idx: number) {
    setEditIdx(idx)
    setSelectedLogo(null)
    setIframeHtml(null)
    setLogoX(null); setLogoY(null)
    setLogoSize(80)
    prevLogoRef.current = null
  }

  function exitEdit() {
    setEditIdx(null)
    setIframeHtml(null)
    setSelectedLogo(null)
  }

  async function handleApply() {
    if (!selectedLogo || editIdx === null) return
    const r = results?.[editIdx]
    if (r?.status !== 'fulfilled') return
    setApplying(true)
    try {
      const res = await authedFetch('/api/test-render-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: '', microcopy: '',
          bgImageDataUrl: r.value.supabaseUrl || r.value.imageUrl,
          logoUrl: selectedLogo,
          logoSize, logoX, logoY,
          logoPosition: 'bottom-left',
          padding: 40, elements: [],
          hideText: true, returnHtml: false,
        }),
      })
      if (!res.ok) throw new Error('Render failed')
      const blob = await res.blob()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`
      const uploaded = await uploadMedia(blob, { folder: 'generated-posts/ad-concepts', fileName })
      const publicUrl = uploaded.url
      await sb.from('generated_posts').insert({ output_url: publicUrl, is_ad_concept: true, brand_id: effectiveBrandId ?? null, ...(userEmail ? { created_by_email: userEmail } : {}) })
      showToast('Logo applied!')
      updateResultUrl(editIdx, publicUrl)
      exitEdit()
    } catch (err) {
      showToast('Failed to apply logo: ' + (err as Error).message, true)
    } finally {
      setApplying(false)
    }
  }

  async function handleGenerate() {
    const brandId = userRole === 'user' ? userBrandId! : selectedBrandId
    if (!brandId) { showToast('Please select a brand.', true); return }
    if (!selectedAngleId) { showToast('Please select an ad angle.', true); return }
    startTimeRef.current = Date.now()
    exitEdit()
    await startGeneration(brandId, selectedAngleId, userEmail)
  }

  return (
    <>
      <h1>Ad Concept Generator</h1>
      <p className="subtitle">Select an ad angle and generate concepts for your brand.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>

        {/* ── Left panel ── */}
        <div className="form-card">
          {!editMode ? (
            <>
              <h2>Settings</h2>
              {userRole === 'admin' ? (
                <div className="form-group">
                  <label>Brand</label>
                  <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}>
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
              <div className="form-group">
                <label>Ad Angle</label>
                <select value={selectedAngleId} onChange={e => setSelectedAngleId(e.target.value)}>
                  <option value="">Select an angle…</option>
                  {angles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <button className="generate-btn" onClick={handleGenerate}
                disabled={generating || !effectiveBrandId || !selectedAngleId}>
                {generating ? 'Generating…' : 'Generate Ad Concept'}
              </button>
            </>
          ) : (
            <>
              <h2>Add Logo — Variation {editIdx + 1}</h2>

              {/* Upload */}
              <div className="form-group">
                <label>Upload Logo</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', border: '1px dashed var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--muted)' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Upload image
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
                </label>
              </div>

              {/* Existing logos */}
              {logos.length > 0 && (
                <div className="form-group">
                  <label>Brand Logos</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {logos.map((logo, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedLogo(logo.url)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                          border: selectedLogo === logo.url ? '2px solid var(--red)' : '1px solid var(--border)',
                          background: selectedLogo === logo.url ? 'rgba(220,38,38,0.05)' : 'var(--bg)',
                          textAlign: 'left', width: '100%',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo.url} alt={logo.label} loading="lazy" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px', background: '#fff', padding: '2px', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{logo.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size slider */}
              {selectedLogo && (
                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Logo Size <span style={{ color: 'var(--text)', fontWeight: 400 }}>{logoSize}px</span>
                  </label>
                  <input
                    type="range" min={30} max={220} value={logoSize}
                    onChange={e => handleSizeChange(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--red)' }}
                  />
                </div>
              )}

              <button className="generate-btn" onClick={handleApply} disabled={!selectedLogo || applying}>
                {applying ? 'Applying…' : 'Apply Logo'}
              </button>
              <button onClick={exitEdit} style={{ width: '100%', marginTop: '8px', padding: '8px', border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>
                ← Back
              </button>
            </>
          )}
        </div>

        {/* ── Right panel ── */}
        <div style={{ minWidth: 0 }}>
          <div className="output-area">
            {generating && (
              <div style={{ width: '100%' }}>
                <div className="output-grid">
                  <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
                  <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                  <GeneratingOverlay startTime={startTimeRef.current} />
                </div>
              </div>
            )}

            {!generating && !results && !editMode && (
              <div className="output-placeholder">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <p>Your ad concepts will appear here</p>
              </div>
            )}

            {/* Results grid — normal view */}
            {!generating && results && !editMode && (
              <div className="output-grid">
                {results.map((r, i) =>
                  r.status === 'fulfilled' ? (
                    <div key={i} className="output-grid-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.value.imageUrl}
                        alt={`Ad Concept ${i + 1}`}
                        loading="lazy"
                        style={{ cursor: 'zoom-in' }}
                        onClick={() => openLightbox(r.value.imageUrl)}
                      />
                      <div className="output-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => enterEdit(i)}>Add Logo</button>
                        <a href={r.value.imageUrl} download={`ad_concept_${i + 1}.png`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Download</a>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="output-grid-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                        Variation {i + 1} failed: {r.reason}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Edit mode — iframe replaces selected image */}
            {!generating && results && editMode && (
              <div className="output-grid">
                <div className="output-grid-item">
                  <div ref={containerRef} style={{ width: '100%', paddingTop: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
                    {iframeHtml && (
                      <iframe
                        ref={iframeRef}
                        srcDoc={iframeHtml}
                        sandbox="allow-scripts allow-same-origin"
                        style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1080, border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left' }}
                      />
                    )}
                    {iframeLoading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      </div>
                    )}
                    {!iframeHtml && !iframeLoading && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Select a logo to preview</p>
                      </div>
                    )}
                  </div>
                  <div className="output-actions">
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Drag logo to reposition</span>
                  </div>
                </div>

                {/* Other image stays visible */}
                {(() => {
                  const otherIdx = editIdx === 0 ? 1 : 0
                  const other = results[otherIdx]
                  return other?.status === 'fulfilled' ? (
                    <div className="output-grid-item" style={{ opacity: 0.4 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={other.value.imageUrl} alt={`Ad Concept ${otherIdx + 1}`} loading="lazy" />
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
