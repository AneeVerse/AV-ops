'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast'
import { useLightbox } from '@/lib/lightbox'
import { sb } from '@/lib/supabase'
import { uploadMedia, deleteMediaClient } from '@/lib/media-upload'

interface AdAngle {
  id: string
  name: string
  description: string | null
  prompt: string | null
  puppeteer_config: PuppeteerConfig | null
}
interface AngleImage { id: string; image_url: string; storage_path: string }

interface PuppeteerElement {
  dataUrl: string
  x: number
  y: number
  width: number
  opacity: number
  zIndex: number
}

interface PuppeteerConfig {
  logoPosition: string
  logoSize: number
  logoX: number | null
  logoY: number | null
  padding: number
  elements: PuppeteerElement[]
}

const DEFAULT_CONFIG: PuppeteerConfig = {
  logoPosition: 'bottom-left',
  logoSize: 48,
  logoX: null,
  logoY: null,
  padding: 40,
  elements: [],
}

const LOGO_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

export default function AdAngleDetailPage() {
  const { id: angleId } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const { openLightbox } = useLightbox()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const elementInputRef = useRef<HTMLInputElement>(null)
  const testBgInputRef = useRef<HTMLInputElement>(null)
  const testLogoInputRef = useRef<HTMLInputElement>(null)

  const [angle, setAngle] = useState<AdAngle | null>(null)
  const [images, setImages] = useState<AngleImage[]>([])
  const [uploading, setUploading] = useState(false)

  // Generation settings state
  const [prompt, setPrompt] = useState('')
  const [config, setConfig] = useState<PuppeteerConfig>(DEFAULT_CONFIG)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingElement, setUploadingElement] = useState(false)
  const [testBgUrl, setTestBgUrl] = useState<string | null>(null)
  const [testLogoUrl, setTestLogoUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => { loadData() }, [angleId])

  async function loadData() {
    const [{ data: a }, { data: imgs }] = await Promise.all([
      sb.from('ad_angles').select('*').eq('id', angleId).single(),
      sb.from('ad_angle_images').select('*').eq('angle_id', angleId).order('created_at'),
    ])
    setAngle(a)
    setImages(imgs || [])
    if (a) {
      setPrompt(a.prompt || '')
      setConfig(a.puppeteer_config ? { ...DEFAULT_CONFIG, ...a.puppeteer_config } : DEFAULT_CONFIG)
    }
  }

  async function handleUpload() {
    const input = fileInputRef.current
    if (!input) return
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (!files.length) return
      setUploading(true)
      for (const file of files) {
        try {
          const uploaded = await uploadMedia(file, {
            folder: `ad-angle-images/${angleId}`,
            fileName: `${Date.now()}_${file.name}`,
          })
          await sb.from('ad_angle_images').insert({
            angle_id: angleId,
            image_url: uploaded.url,
            storage_path: uploaded.filePath,
          })
        } catch (err) {
          showToast((err as Error).message, true)
        }
      }
      setUploading(false)
      showToast('Image(s) uploaded!')
      input.value = ''
      loadData()
    }
    input.click()
  }

  async function handleDeleteImage(img: AngleImage) {
    if (!confirm('Delete this image?')) return
    await deleteMediaClient({ filePath: img.storage_path, url: img.image_url }).catch(() => {})
    await sb.from('ad_angle_images').delete().eq('id', img.id)
    showToast('Image deleted.')
    loadData()
  }

  async function handleElementUpload() {
    const input = elementInputRef.current
    if (!input) return
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploadingElement(true)
      try {
        const uploaded = await uploadMedia(file, {
          folder: `ad-angle-images/${angleId}`,
          fileName: `element_${Date.now()}_${file.name}`,
        })
        setConfig(c => ({
          ...c,
          elements: [{ dataUrl: uploaded.url, x: 0, y: 0, width: 200, opacity: 100, zIndex: 2 }],
        }))
        showToast('Element uploaded.')
      } catch (err) {
        showToast((err as Error).message, true)
      }
      setUploadingElement(false)
      input.value = ''
    }
    input.click()
  }

  function handleTestBgUpload() {
    const input = testBgInputRef.current
    if (!input) return
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => { setTestBgUrl(ev.target?.result as string); setPreviewUrl(null) }
      reader.readAsDataURL(file)
      input.value = ''
    }
    input.click()
  }

  function handleTestLogoUpload() {
    const input = testLogoInputRef.current
    if (!input) return
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => { setTestLogoUrl(ev.target?.result as string); setPreviewUrl(null) }
      reader.readAsDataURL(file)
      input.value = ''
    }
    input.click()
  }

  async function handlePreview() {
    if (!testBgUrl) { showToast('Upload a test background first.', true); return }
    setPreviewing(true)
    setPreviewUrl(null)
    try {
      const res = await authedFetch('/api/test-render-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: '', microcopy: '',
          bgImageDataUrl: testBgUrl,
          logoUrl: testLogoUrl || '',
          logoPosition: config.logoPosition,
          logoSize: config.logoSize,
          logoX: config.logoX ?? null,
          logoY: config.logoY ?? null,
          padding: config.padding,
          elements: config.elements,
          hideText: true,
        }),
      })
      if (!res.ok) throw new Error('Preview failed')
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      showToast((err as Error).message, true)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSaveSettings() {
    if (!prompt.trim()) { showToast('Please enter a generation prompt.', true); return }
    setSavingSettings(true)
    const { error } = await sb.from('ad_angles').update({
      prompt: prompt.trim(),
      puppeteer_config: config,
    }).eq('id', angleId)
    setSavingSettings(false)
    if (error) { showToast(error.message, true); return }
    showToast('Settings saved.')
  }

  const el = config.elements[0] ?? null

  if (!angle) return null

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} />
      <input ref={elementInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
      <input ref={testBgInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
      <input ref={testLogoInputRef} type="file" accept="image/*" style={{ display: 'none' }} />

      <button className="back-btn" onClick={() => router.push('/ad-angles')}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to Ad Angles
      </button>

      <div className="detail-header">
        <div className="detail-title">
          <h1>{angle.name}</h1>
          {angle.description && <p className="subtitle" style={{ marginBottom: 0 }}>{angle.description}</p>}
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : '+ Add Images'}
          </button>
        </div>
      </div>

      <p className="section-title" style={{ marginTop: 0 }}>Visual References</p>

      {images.length === 0 ? (
        <p className="empty-state">No images yet. Click &quot;+ Add Images&quot; to upload visual references for this angle.</p>
      ) : (
        <div className="assets-grid">
          {images.map(img => (
            <div key={img.id} className="asset-card">
              <div className="asset-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" loading="lazy" style={{ cursor: 'zoom-in' }} onClick={() => openLightbox(img.image_url)} />
              </div>
              <button className="delete-btn" onClick={() => handleDeleteImage(img)}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Generation Settings ──────────────────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: '32px' }}>Generation Settings</p>
      <div className="form-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>

          {/* Left col: settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Generation Prompt</label>
              <textarea rows={5} placeholder="Describe how images should be generated for this ad angle…"
                value={prompt} onChange={e => setPrompt(e.target.value)}
                style={{ resize: 'vertical' }} />
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
                Brand name and brand style are automatically appended at generation time.
              </p>
            </div>

            <div>
              <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>Logo Overlay</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Position</label>
                  <select value={config.logoPosition} onChange={e => setConfig(c => ({ ...c, logoPosition: e.target.value, logoX: null, logoY: null }))}>
                    {LOGO_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Size (px)</label>
                  <input type="number" min={20} max={200} value={config.logoSize}
                    onChange={e => setConfig(c => ({ ...c, logoSize: +e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Padding (px)</label>
                  <input type="number" min={0} max={200} value={config.padding}
                    onChange={e => setConfig(c => ({ ...c, padding: +e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>X <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(overrides position)</span></label>
                  <input type="number" placeholder="auto"
                    value={config.logoX ?? ''}
                    onChange={e => setConfig(c => ({ ...c, logoX: e.target.value === '' ? null : +e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Y <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(overrides position)</span></label>
                  <input type="number" placeholder="auto"
                    value={config.logoY ?? ''}
                    onChange={e => setConfig(c => ({ ...c, logoY: e.target.value === '' ? null : +e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>Element Overlay</p>
                <button className="btn btn-secondary btn-sm" onClick={handleElementUpload} disabled={uploadingElement}>
                  {uploadingElement ? 'Uploading…' : el ? 'Replace' : '+ Upload Element'}
                </button>
              </div>
              {el ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={el.dataUrl} alt="element" loading="lazy" style={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>X</label>
                        <input type="number" value={el.x} onChange={e => setConfig(c => ({ ...c, elements: [{ ...c.elements[0], x: +e.target.value }] }))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Y</label>
                        <input type="number" value={el.y} onChange={e => setConfig(c => ({ ...c, elements: [{ ...c.elements[0], y: +e.target.value }] }))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Width (px)</label>
                        <input type="number" min={1} value={el.width} onChange={e => setConfig(c => ({ ...c, elements: [{ ...c.elements[0], width: +e.target.value }] }))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Opacity (%)</label>
                        <input type="number" min={0} max={100} value={el.opacity} onChange={e => setConfig(c => ({ ...c, elements: [{ ...c.elements[0], opacity: +e.target.value }] }))} />
                      </div>
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label>Layer</label>
                        <select value={el.zIndex} onChange={e => setConfig(c => ({ ...c, elements: [{ ...c.elements[0], zIndex: +e.target.value }] }))}>
                          <option value={3}>Above logo</option>
                          <option value={1}>Below logo</option>
                        </select>
                      </div>
                    </div>
                    <button
                      style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                      onClick={() => setConfig(c => ({ ...c, elements: [] }))}>
                      Remove element
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>No element uploaded. Upload an image to overlay on top of generated ads.</p>
              )}
            </div>

            {/* Test inputs */}
            <div>
              <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>Test Inputs</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleTestBgUpload}>
                  {testBgUrl ? 'Change BG' : 'Upload Test BG'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleTestLogoUpload}>
                  {testLogoUrl ? 'Change Logo' : 'Upload Test Logo'}
                </button>
              </div>
              {testLogoUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={testLogoUrl} alt="test logo" loading="lazy" style={{ height: 24, maxWidth: 80, objectFit: 'contain', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px' }} />
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>test logo loaded</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
              <button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !testBgUrl}
                style={{ flex: 1, padding: '10px', fontSize: '14px', opacity: testBgUrl ? 1 : 0.4, textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
                {previewing ? 'Rendering…' : 'Preview'}
              </button>
              <button className="generate-btn" onClick={handleSaveSettings} disabled={savingSettings} style={{ flex: 1 }}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Right col: preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>Preview</p>

            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="preview" loading="lazy" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
            ) : testBgUrl ? (
              <div style={{ position: 'relative', width: '100%', paddingTop: '100%', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testBgUrl} alt="test bg" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                  <span style={{ color: '#fff', fontSize: '13px' }}>Click Preview to render</span>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', paddingTop: '100%', position: 'relative', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Upload a background to preview</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
