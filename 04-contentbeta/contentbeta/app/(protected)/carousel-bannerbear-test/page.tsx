'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useState, useEffect, useRef } from 'react'
import { useLightbox } from '@/lib/lightbox'
import { sb } from '@/lib/supabase'

interface Modification {
  id: number
  name: string
  text: string
  imageUrl: string
  type: 'text' | 'image'
  uploading?: boolean
}

interface BBTemplate {
  uid: string
  name: string
  preview_url: string | null
  available_modifications: { name: string; type?: string }[]
}

let nextModId = 1

export default function CarouselBannerBearTestPage() {
  const [templates, setTemplates] = useState<BBTemplate[]>([])
  const { openLightbox } = useLightbox()
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  const [templateUid, setTemplateUid] = useState('')
  const [modifications, setModifications] = useState<Modification[]>([
    { id: nextModId++, name: '', text: '', imageUrl: '', type: 'text' },
  ])

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ image_url: string; image_url_png: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authedFetch('/api/test-bannerbear')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setTemplatesError(data.error); return }
        setTemplates(data)
      })
      .catch(() => setTemplatesError('Failed to load templates'))
      .finally(() => setTemplatesLoading(false))
  }, [])

  // When a template is selected, pre-fill modification rows from its available_modifications
  function handleTemplateSelect(uid: string) {
    setTemplateUid(uid)
    const tpl = templates.find(t => t.uid === uid)
    if (tpl?.available_modifications?.length) {
      setModifications(tpl.available_modifications.map(m => ({
        id: nextModId++,
        name: m.name,
        text: '',
        imageUrl: '',
        type: (m.type === 'image' ? 'image' : 'text') as 'text' | 'image',
      })))
    }
  }

  function addMod() {
    setModifications(prev => [...prev, { id: nextModId++, name: '', text: '', imageUrl: '', type: 'text' }])
  }

  function updateMod(id: number, patch: Partial<Modification>) {
    setModifications(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function removeMod(id: number) {
    setModifications(prev => prev.filter(m => m.id !== id))
  }

  async function handleRender() {
    if (!templateUid.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const mods = modifications
        .filter(m => m.name.trim())
        .map(m => m.type === 'image'
          ? { name: m.name, image_url: m.imageUrl }
          : { name: m.name, text: m.text }
        )
      const res = await authedFetch('/api/test-bannerbear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateUid: templateUid.trim(), modifications: mods }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed')
      setResult(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const sectionTitle = (title: string) => (
    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '20px 0 10px' }}>{title}</p>
  )

  const selectedTemplate = templates.find(t => t.uid === templateUid)

  return (
    <>
      <h1>BannerBear Render Test</h1>
      <p className="subtitle">Test BannerBear template rendering — separate from the live workflow.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        <div className="form-card" style={{ overflowY: 'auto', maxHeight: '85vh' }}>

          {sectionTitle('Template')}

          {templatesLoading && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading templates…</p>}
          {templatesError && <p style={{ fontSize: '13px', color: 'var(--error, #e74c3c)' }}>{templatesError}</p>}

          {!templatesLoading && !templatesError && (
            <div className="form-group">
              <label>Select Template</label>
              <select value={templateUid} onChange={e => handleTemplateSelect(e.target.value)}>
                <option value="">— pick a template —</option>
                {templates.map(t => (
                  <option key={t.uid} value={t.uid}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Template UID (or paste manually)</label>
            <input
              type="text"
              placeholder="e.g. B0Np4K..."
              value={templateUid}
              onChange={e => setTemplateUid(e.target.value)}
            />
          </div>

          {selectedTemplate?.preview_url && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>Template Preview</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedTemplate.preview_url} alt="template preview" loading="lazy"
                style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
          )}

          {sectionTitle('Modifications')}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
            Match the layer names exactly as defined in your BannerBear template.
          </p>

          {modifications.map((mod, idx) => (
            <div key={mod.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Layer {idx + 1}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => removeMod(mod.id)}>Remove</button>
              </div>

              <div className="form-group" style={{ margin: '0 0 8px' }}>
                <label style={{ fontSize: '11px' }}>Layer Name</label>
                <input type="text" placeholder="e.g. headline" value={mod.name} onChange={e => updateMod(mod.id, { name: e.target.value })} />
              </div>

              <div className="form-group" style={{ margin: '0 0 8px' }}>
                <label style={{ fontSize: '11px' }}>Type</label>
                <select value={mod.type} onChange={e => updateMod(mod.id, { type: e.target.value as 'text' | 'image' })}>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                </select>
              </div>

              {mod.type === 'text' ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Text Value</label>
                  <textarea rows={2} value={mod.text} onChange={e => updateMod(mod.id, { text: e.target.value })} style={{ resize: 'vertical' }} />
                </div>
              ) : (
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Image URL</label>
                  <input type="text" placeholder="https://..." value={mod.imageUrl} onChange={e => updateMod(mod.id, { imageUrl: e.target.value })} />
                </div>
              )}
            </div>
          ))}

          <button className="btn btn-secondary btn-sm" onClick={addMod} style={{ marginBottom: '4px' }}>
            + Add Layer
          </button>

          <button
            className="generate-btn"
            style={{ marginTop: '16px' }}
            onClick={handleRender}
            disabled={loading || !templateUid.trim()}
          >
            {loading ? 'Rendering…' : 'Render with BannerBear'}
          </button>
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="output-area" style={{ minHeight: '420px' }}>
            {loading && (
              <div className="output-grid">
                <div className="output-grid-item skeleton" style={{ minHeight: '400px' }} />
              </div>
            )}
            {!loading && error && (
              <div className="output-placeholder">
                <p style={{ color: 'var(--error, #e74c3c)', fontSize: '13px' }}>{error}</p>
              </div>
            )}
            {!loading && !result && !error && (
              <div className="output-placeholder">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9l4-4 4 4 4-6 4 6"/>
                </svg>
                <p>Rendered image will appear here</p>
              </div>
            )}
            {!loading && result && (
              <div className="output-grid">
                <div className="output-grid-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.image_url_png || result.image_url} alt="BannerBear render" loading="lazy" style={{ width: '100%', height: 'auto', display: 'block', cursor: 'zoom-in' }} onClick={() => openLightbox(result.image_url_png || result.image_url)} />
                  <div className="output-actions">
                    <a href={result.image_url_png || result.image_url} download="bannerbear_slide.png" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      Download
                    </a>
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
