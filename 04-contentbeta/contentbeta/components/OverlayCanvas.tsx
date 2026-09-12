'use client'
import { authedFetch } from '@/lib/authed-fetch'
import {
  OVERLAY_LAYER_LABELS,
  overlayStyleKey,
  type OverlayLayerKey,
} from '@/lib/overlay-positions'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export interface OverlayCanvasProps {
  payload: Record<string, unknown>
  onMove: (key: OverlayLayerKey, x: number, y: number) => void
  onReset?: (key: OverlayLayerKey) => void
  padding?: number
  emptyHint?: string
}

interface LayerBox {
  x: number
  y: number
  w: number
  h: number
}

const LAYERS: OverlayLayerKey[] = ['stack', 'eyebrow', 'headline', 'microcopy', 'bullets', 'logo', 'cta']

export default function OverlayCanvas({
  payload,
  onMove,
  onReset,
  padding = 60,
  emptyHint = 'Canvas loads with sample text. Drag to position.',
}: OverlayCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(0.4)
  const [selected, setSelected] = useState<OverlayLayerKey>('stack')
  const [boxes, setBoxes] = useState<Partial<Record<OverlayLayerKey, LayerBox>>>({})
  const [reloadToken, setReloadToken] = useState(0)
  const styleKey = useMemo(() => overlayStyleKey(payload), [payload])
  const payloadRef = useRef(payload)
  payloadRef.current = payload
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => setScale(Math.max(0.2, el.clientWidth / 1080))
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [html])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await authedFetch('/api/test-render-slide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payloadRef.current, returnHtml: true }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Render failed' }))
          throw new Error(err.error || 'Render failed')
        }
        const text = await res.text()
        if (!cancelled) setHtml(text)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 280)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [styleKey, reloadToken])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      const d = e.data
      if (!d?.type) return
      if (d.type === 'select' && LAYERS.includes(d.key)) setSelected(d.key)
      if (d.type === 'ready' && d.positions) {
        const next: Partial<Record<OverlayLayerKey, LayerBox>> = {}
        for (const key of LAYERS) {
          const p = d.positions[key]
          if (p && typeof p.x === 'number') next[key] = { x: p.x, y: p.y, w: p.w ?? 200, h: p.h ?? 40 }
        }
        setBoxes(next)
        if (next.stack) setSelected('stack')
      }
      if (d.type === 'move' && LAYERS.includes(d.key)) {
        setBoxes(prev => {
          const cur = prev[d.key as OverlayLayerKey]
          return { ...prev, [d.key]: { x: d.x, y: d.y, w: cur?.w ?? 200, h: cur?.h ?? 40 } }
        })
        onMoveRef.current(d.key, d.x, d.y)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const post = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  function align(side: 'left' | 'center' | 'right') {
    const box = boxes[selected]
    const width = box?.w ?? 400
    const y = box?.y ?? padding
    const x = side === 'left'
      ? padding
      : side === 'right'
        ? Math.max(padding, 1080 - padding - width)
        : Math.round((1080 - width) / 2)
    post({ type: 'moveTo', key: selected, x, y })
  }

  function nudge(dx: number, dy: number) {
    post({ type: 'nudge', key: selected, dx, dy })
  }

  function resetSelected() {
    if (!onReset) return
    onReset(selected)
    setReloadToken(n => n + 1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(e.shiftKey ? -10 : -1, 0) }
    if (e.key === 'ArrowRight') { e.preventDefault(); nudge(e.shiftKey ? 10 : 1, 0) }
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, e.shiftKey ? -10 : -1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, e.shiftKey ? 10 : 1) }
  }

  const presentLayers = LAYERS.filter(key => boxes[key] || key === 'stack')

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        {presentLayers.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => { setSelected(key); post({ type: 'select', key }) }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 6,
              border: selected === key ? '1px solid #6366f1' : '1px solid var(--border)',
              background: selected === key ? 'rgba(99,102,241,0.15)' : 'var(--surface)',
              color: selected === key ? '#818cf8' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {OVERLAY_LAYER_LABELS[key]}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {(['left', 'center', 'right'] as const).map(side => (
          <button
            key={side}
            type="button"
            title={`Align ${side}`}
            onClick={() => align(side)}
            style={{
              fontSize: 11,
              fontWeight: 700,
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {side === 'left' ? '⇤' : side === 'right' ? '⇥' : '↔'}
          </button>
        ))}
        {onReset && (
          <button
            type="button"
            onClick={resetSelected}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px' }}>
        Drag the stack, or click a line to move just that layer. Shift-drag moves the stack. Arrow keys nudge 1px (Shift = 10px).
      </p>
      <div
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {loading && !html && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
            Loading canvas…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error, #e74c3c)', fontSize: 12, padding: 16, textAlign: 'center' }}>
            {error}
          </div>
        )}
        {!loading && !html && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12, padding: 16, textAlign: 'center' }}>
            {emptyHint}
          </div>
        )}
        {html && (
          <iframe
            ref={iframeRef}
            title="Overlay canvas"
            srcDoc={html}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1080,
              height: 1080,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'auto',
            }}
          />
        )}
      </div>
    </div>
  )
}
