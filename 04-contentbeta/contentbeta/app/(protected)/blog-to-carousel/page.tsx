'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useLightbox } from '@/lib/lightbox'
import { useCarouselGeneration } from '@/lib/carousel-generation'
import { sb } from '@/lib/supabase'

interface Brand { id: string; name: string }

const CAROUSEL_MESSAGES = [
  'Scraping article…',
  'Extracting key insights…',
  'Writing slide copy…',
  'Generating slide backgrounds…',
  'Applying brand overlay…',
  'Almost there…',
]

// Piecewise curve tuned for ~6 minute generation
const PROGRESS_CURVE: [number, number][] = [[0,0],[60,25],[150,50],[240,70],[300,82],[340,90],[360,93]]

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
    const msg = setInterval(() => setMsgIdx(i => (i + 1) % CAROUSEL_MESSAGES.length), 8000)
    const prog = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      setPct(Math.round(interpolate(elapsed)))
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [startTime])

  return (
    <div style={{ padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{CAROUSEL_MESSAGES[msgIdx]}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function BlogToCarouselPage() {
  const { userRole, userBrandId, userBrandName } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (userRole === null) return
    const allowed = userRole === 'admin'
    if (!allowed) router.replace('/generate')
  }, [userRole, userBrandName, router])
  const { openLightbox } = useLightbox()
  const {
    generating, imageUrls, errorMsg, generationStartTime,
    selectedBrandId, url,
    setSelectedBrandId, setUrl,
    startGeneration,
  } = useCarouselGeneration()

  const [brands, setBrands] = useState<Brand[]>([])

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
    }
  }, [userRole])

  const effectiveBrandId = userRole === 'user' ? userBrandId : selectedBrandId

  function handleGenerate() {
    if (!effectiveBrandId || !url.trim()) return
    startGeneration(effectiveBrandId, url.trim())
  }

  return (
    <>
      <h1>Blog to Carousel</h1>
      <p className="subtitle">Paste a blog or article URL to generate carousel images from the content.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        <div className="form-card">
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
            <label>Article URL</label>
            <input
              type="text"
              placeholder="https://example.com/your-blog-post"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
            />
          </div>

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={generating || !effectiveBrandId || !url.trim()}
          >
            {generating ? 'Generating…' : 'Generate Carousel'}
          </button>
        </div>

        <div>
          <div className="output-area">
            {generating && (
              <div style={{ width: '100%' }}>
                <div className="output-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="output-grid-item skeleton" style={{ minHeight: '200px' }} />
                  ))}
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                  <GeneratingOverlay startTime={generationStartTime ?? Date.now()} />
                </div>
              </div>
            )}

            {!generating && errorMsg && (
              <div className="output-placeholder">
                <p style={{ color: 'var(--error, #e74c3c)' }}>{errorMsg}</p>
              </div>
            )}

            {!generating && !imageUrls && !errorMsg && (
              <div className="output-placeholder">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
                <p>Your carousel images will appear here</p>
              </div>
            )}

            {!generating && imageUrls && (
              <div className="output-grid">
                {imageUrls.map((imgUrl, i) => (
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
                      <a href={imgUrl} download={`carousel_slide_${i + 1}.png`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
