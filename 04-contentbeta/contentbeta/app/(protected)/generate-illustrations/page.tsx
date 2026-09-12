'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { useLightbox } from '@/lib/lightbox'
import { useIllustrationGeneration } from '@/lib/illustration-generation'
import { sb } from '@/lib/supabase'

const ILLUS_MESSAGES = [
  'Reading your context…',
  'Selecting illustration styles…',
  'Generating illustration 1…',
  'Generating illustration 2…',
  'Adding details and textures…',
  'Finalizing artwork…',
  'Almost there…',
]

// keyframe points [elapsed_seconds, percent]
const PROGRESS_CURVE: [number, number][] = [[0, 0], [20, 38], [45, 62], [65, 78], [80, 87], [90, 93]]

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
    const msg = setInterval(() => setMsgIdx(i => (i + 1) % ILLUS_MESSAGES.length), 5000)
    const prog = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      setPct(Math.round(interpolate(elapsed)))
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [startTime])

  return (
    <div style={{ padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{ILLUS_MESSAGES[msgIdx]}</span>
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

interface Brand { id: string; name: string }
interface IllustrationLayout { id: string; name: string }

export default function GenerateIllustrationsPage() {
  const { userRole, userBrandId, userBrandName, userAllowedPages } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const { openLightbox } = useLightbox()
  const { generating, imageUrls, error, startGeneration } = useIllustrationGeneration()

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [layouts, setLayouts] = useState<IllustrationLayout[]>([])
  const [layoutsLoading, setLayoutsLoading] = useState(false)
  const [layoutId, setLayoutId] = useState('')
  const [context, setContext] = useState('')
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)

  useEffect(() => {
    if (userRole === null) return
    if (userRole !== 'admin' && !userAllowedPages.includes('generate-illustrations')) router.replace('/generate')
  }, [userRole, userAllowedPages, router])

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => {
        setBrands(data || [])
        if (data?.length) setSelectedBrandId(data[0].id)
      })
    } else if (userBrandId && userBrandName) {
      setBrands([{ id: userBrandId, name: userBrandName }])
      setSelectedBrandId(userBrandId)
    }
  }, [userRole, userBrandId, userBrandName])

  useEffect(() => {
    if (!selectedBrandId) { setLayouts([]); setLayoutId(''); return }
    setLayoutsLoading(true)
    sb.from('illustration_layouts')
      .select('id,name')
      .eq('brand_id', selectedBrandId)
      .order('created_at')
      .then(({ data }) => {
        const list = (data || []) as IllustrationLayout[]
        setLayouts(list)
        setLayoutId(list[0]?.id || '')
        setLayoutsLoading(false)
      })
  }, [selectedBrandId])

  async function handleGenerate() {
    if (!selectedBrandId) { showToast('Select a brand first.', true); return }
    if (!context.trim()) { showToast('Context is required.', true); return }
    if (!layoutId) { showToast('Select a layout first.', true); return }

    setGenerationStartTime(Date.now())
    await startGeneration(selectedBrandId, context, layoutId, layoutId)

    if (!error) showToast('Illustrations generated!')
  }

  const hasImages = imageUrls.length > 0

  return (
    <>
      <h1>Create Illustrations</h1>
      <p className="subtitle">Generate two AI illustrations from your brand&apos;s defined layouts</p>

      <div className="generate-layout">
        <div className="form-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Brand</label>
            <select
              value={selectedBrandId}
              onChange={e => setSelectedBrandId(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
            >
              <option value="">Select a brand…</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {selectedBrandId && !layoutsLoading && layouts.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
              No illustration layouts found for this brand. Add them in brand settings first.
            </div>
          )}

          {layouts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Illustration Layout</label>
              <select
                value={layoutId}
                onChange={e => setLayoutId(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
              >
                {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
              Context <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 6px' }}>
              Describe the scene or theme for the illustrations. This is used together with the brand&apos;s illustration layouts.
            </p>
            <textarea
              rows={4}
              placeholder="e.g. a team collaborating in a modern office, reviewing charts on a large screen"
              value={context}
              onChange={e => setContext(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={generating || !selectedBrandId || !context.trim() || !layoutId}
          >
            {generating ? 'Generating…' : error ? 'Try Again' : 'Generate Illustrations'}
          </button>
        </div>

        <div className="output-area">
          {generating && (
            <div style={{ width: '100%' }}>
              <div className="output-grid">
                <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
                <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <GeneratingOverlay startTime={generationStartTime ?? Date.now()} />
              </div>
            </div>
          )}

          {!generating && !hasImages && !error && (
            <div className="output-placeholder">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9l4-4 4 4 4-6 4 6"/>
                <circle cx="8.5" cy="13.5" r="1.5"/>
              </svg>
              <p>Two illustrations will appear here</p>
            </div>
          )}

          {!generating && error && (
            <div className="output-placeholder">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <p style={{ color: 'var(--red)', marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>Generation failed</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                {error.includes('No illustration layouts') ? error : 'Something went wrong. Please try again.'}
              </p>
            </div>
          )}

          {!generating && hasImages && (
            <div style={{ width: '100%' }}>
              <div className="output-grid" style={{ gridTemplateColumns: imageUrls.length >= 2 ? '1fr 1fr' : '1fr' }}>
                {imageUrls.map((url, i) => (
                  <div key={i} className="output-grid-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${url}?t=${Date.now()}`}
                      alt={`Illustration ${i + 1}`}
                      loading="lazy"
                      style={{ cursor: 'zoom-in' }}
                      onClick={() => openLightbox(url)}
                    />
                    <div className="output-actions">
                      <a href={url} download={`illustration-${i + 1}.png`} target="_blank" className="btn btn-secondary btn-sm" rel="noreferrer">
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '4px 16px 16px' }}>
                Click image for full preview
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
