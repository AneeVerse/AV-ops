'use client'
import { useEffect, useRef, useState } from 'react'
import type { RenderPlan } from '@/lib/ppt/types'
import { ElementRenderer, PptSlideMarkup } from '@/lib/ppt/render-html'

export function PptTemplateSlide({ plan, borderRadius = 8, native = false }: { plan: RenderPlan; borderRadius?: number; native?: boolean }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    if (native) return
    const el = outerRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1920))
    obs.observe(el)
    return () => obs.disconnect()
  }, [native])

  // Native mode: render at exactly 1920×1080, no CSS transform.
  // Used for PDF export (server-side, via lib/ppt/render-html + Puppeteer) so the
  // exact same markup this branch renders here is real HTML printed by real Chromium.
  if (native) {
    return <PptSlideMarkup plan={plan} />
  }

  return (
    <div ref={outerRef} style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius, border: '1px solid var(--border)' }}>
      {scale > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 1920, height: 1080,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          background: plan.background,
        }}>
          {plan.elements.map(el => <ElementRenderer key={el.id} el={el} />)}
        </div>
      )}
    </div>
  )
}
