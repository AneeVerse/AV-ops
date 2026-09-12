'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface LightboxContextType {
  openLightbox: (url: string) => void
  openLightboxMany: (urls: string[], startIndex?: number) => void
}

const LightboxContext = createContext<LightboxContextType | null>(null)

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [urls, setUrls] = useState<string[]>([])
  const [idx, setIdx] = useState(0)

  const openLightbox = useCallback((url: string) => { setUrls([url]); setIdx(0) }, [])
  const openLightboxMany = useCallback((u: string[], startIndex = 0) => { setUrls(u); setIdx(startIndex) }, [])
  const closeLightbox = useCallback(() => setUrls([]), [])
  const prev = useCallback(() => setIdx(i => (i - 1 + urls.length) % urls.length), [urls.length])
  const next = useCallback(() => setIdx(i => (i + 1) % urls.length), [urls.length])

  useEffect(() => {
    if (!urls.length) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [urls.length, closeLightbox, prev, next])

  const imgUrl = urls[idx] ?? null

  return (
    <LightboxContext.Provider value={{ openLightbox, openLightboxMany }}>
      {children}
      {imgUrl && (
        <div
          style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) closeLightbox() }}
        >
          {urls.length > 1 && (
            <button onClick={prev} style={{ position: 'fixed', left: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="" style={{ maxWidth: '88vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
          {urls.length > 1 && (
            <button onClick={next} style={{ position: 'fixed', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          )}
          {urls.length > 1 && (
            <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
              {urls.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} style={{ width: '8px', height: '8px', borderRadius: '50%', border: 'none', background: i === idx ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          )}
          {urls.length > 1 && (
            <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              {idx + 1} / {urls.length}
            </div>
          )}
          <button onClick={closeLightbox} style={{ position: 'fixed', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
      )}
    </LightboxContext.Provider>
  )
}

export function useLightbox() {
  const ctx = useContext(LightboxContext)
  if (!ctx) throw new Error('useLightbox must be used within LightboxProvider')
  return ctx
}
