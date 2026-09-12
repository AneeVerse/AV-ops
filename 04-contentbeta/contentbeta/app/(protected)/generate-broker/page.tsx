'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MosaicLoader from '@/components/MosaicLoader'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { useLightbox } from '@/lib/lightbox'
import { useBrokerGeneration } from '@/lib/broker-generation'

const STEPS = [
  { text: 'Reading prompt… (10%)',       delay: 0 },
  { text: 'Building scene context… (20%)', delay: 8000 },
  { text: 'Rendering image… (40%)',      delay: 20000 },
  { text: 'Adding details… (60%)',       delay: 38000 },
  { text: 'Applying lighting… (75%)',    delay: 55000 },
  { text: 'Finalizing… (90%)',           delay: 68000 },
  { text: 'Almost done… (95%)',          delay: 78000 },
]

export default function GenerateBrokerPage() {
  const { userRole, userAllowedPages, userTokens, deductTokens } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (userRole === null) return
    const allowed = userRole === 'admin' || userAllowedPages.includes('generate-broker')
    if (!allowed) router.replace('/generate')
  }, [userRole, userAllowedPages, router])
  const { showToast } = useToast()
  const { openLightbox } = useLightbox()
  const { generating, imageUrl, error, startGeneration } = useBrokerGeneration()
  const [extraPrompt, setExtraPrompt] = useState('')
  const [mosaicLabel, setMosaicLabel] = useState(STEPS[0].text)
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const noTokens = userRole === 'user' && (userTokens === null || userTokens < 1)

  async function handleGenerate() {
    if (noTokens) { showToast('Not enough tokens to generate.', true); return }

    // Kick off timed label steps
    setMosaicLabel(STEPS[0].text)
    stepTimersRef.current = STEPS.slice(1).map(s =>
      setTimeout(() => setMosaicLabel(s.text), s.delay)
    )

    await startGeneration(extraPrompt)
    stepTimersRef.current.forEach(t => clearTimeout(t))

    if (!error) {
      showToast('Broker image generated!')
      if (userRole === 'user') await deductTokens(1)
    }
  }

  return (
    <>
      <h1>Create realistic freight broker visuals</h1>
      <p className="subtitle">Turn simple prompts into high-quality brokerage visuals</p>
      <div className="generate-layout">
        <div className="form-card">
          <h2>Scene Setup (Optional)</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            We generate a brokerage scene based on common workflows (sales floor, calls, wins, operations, etc.). Add context below to guide the output.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <textarea
              rows={3}
              placeholder="e.g. team covering multiple loads, busy brokerage floor, late-night dispatch operations, brokers coordinating calls with carriers and shippers"
              value={extraPrompt}
              onChange={e => setExtraPrompt(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <button className="generate-btn" onClick={handleGenerate} disabled={generating || noTokens}>
            {generating ? 'Generating…' : error ? 'Try Again' : 'Generate Image'}
          </button>

          {userRole === 'user' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              {noTokens ? (
                <span style={{ fontSize: '13px', color: 'var(--red)' }}>
                  {userTokens ?? 0} token{(userTokens ?? 0) !== 1 ? 's' : ''} left —{' '}
                  {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                  <a href="#" style={{ color: 'var(--red)', textDecoration: 'underline' }} onClick={e => e.preventDefault()}>
                    request more tokens
                  </a>
                  {' '}to keep generating.
                </span>
              ) : userTokens === null ? null : (
                <span style={{ fontSize: '13px', color: userTokens <= 5 ? '#f59e0b' : 'var(--muted)' }}>
                  {userTokens} token{userTokens !== 1 ? 's' : ''} left
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="output-area" style={!generating && imageUrl ? { alignItems: 'stretch', padding: 0, minHeight: 'unset' } : undefined}>
            {generating && <MosaicLoader label={mosaicLabel} />}
            {!generating && !imageUrl && !error && (
              <div className="output-placeholder">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9l4-4 4 4 4-6 4 6"/>
                  <circle cx="8.5" cy="13.5" r="1.5"/>
                </svg>
                <p>Broker image will appear here</p>
              </div>
            )}
            {!generating && error && (
              <div className="output-placeholder">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <p style={{ color: 'var(--red)', marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>Image generation failed</p>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>Something went wrong. Please try again.</p>
              </div>
            )}
            {!generating && imageUrl && (
              <div style={{ position: 'relative', width: '100%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${imageUrl}?t=${Date.now()}`}
                  alt="Broker Image"
                  loading="lazy"
                  style={{ width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'cover', display: 'block', borderRadius: '12px', cursor: 'zoom-in' }}
                  onClick={() => openLightbox(imageUrl)}
                />
                <div className="output-actions">
                  <a href={imageUrl} download="broker.png" target="_blank" className="btn btn-secondary btn-sm" rel="noreferrer">
                    Download
                  </a>
                </div>
              </div>
            )}
          </div>
          {!generating && imageUrl && (
            <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '8px' }}>
              Click image for full preview
            </p>
          )}
        </div>
      </div>
    </>
  )
}
