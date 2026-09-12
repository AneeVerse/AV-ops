'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { authedFetch } from '@/lib/authed-fetch'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import type { UiWalkthroughGenerateResponse, WalkthroughScene } from '@/lib/ui-walkthrough/types'

const UiWalkthroughPreview = dynamic(() => import('@/components/UiWalkthroughPreview'), { ssr: false })

const MAX_SCREENS = 10
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const ANALYZE_MESSAGES = [
  'Reading uploaded screens…',
  'Recreating UI structure…',
  'Locating interactive elements…',
  'Almost there…',
]

interface ScreenDraft {
  file: File
  previewUrl: string
}

/** Elements detected for one screen, still editable/regeneratable before the final build. */
interface ReviewScene extends WalkthroughScene {
  storagePath: string
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

interface InteractionSummary {
  type: 'click' | 'type'
  text?: string
}

/** Client-side parse of the data-uiw markers embedded in the recreated HTML — no
 * separate structured data to keep in sync, just read back what's already there. */
function extractInteractions(html: string): InteractionSummary[] {
  if (typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return Array.from(doc.querySelectorAll('[data-uiw]')).slice(0, 3).map(el => {
      const raw = el.getAttribute('data-uiw') || ''
      return raw.startsWith('type:') ? { type: 'type' as const, text: raw.slice(5) } : { type: 'click' as const }
    })
  } catch {
    return []
  }
}

/**
 * Renders the AI-recreated HTML/CSS (sandboxed, since it's arbitrary AI output), with a
 * CSS highlight on whatever elements the recreation itself marked as interactive
 * (data-uiw), so the user can verify both the recreation quality and the interaction
 * targeting in one view. Rendered at the same fixed 1920x1080 stage the final walkthrough
 * uses (see lib/ui-walkthrough/stitch-engine.ts), scaled to fit this card — so what's
 * reviewed here matches the actual output, not some other size.
 */
function RecreatedScenePreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current) return
    const safeHtml = html.replace(/<\/script/gi, '<\\/script')
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #e2e8f0; }
      #stageWrap { position: relative; width: 100%; aspect-ratio: 1920 / 1080; overflow: hidden; }
      #stage { position: absolute; top: 0; left: 0; width: 1920px; height: 1080px; transform-origin: top left; }
      #content { width: 1920px; max-height: 1080px; overflow: hidden; }
      [data-uiw] { outline: 2px solid #1d70f5 !important; outline-offset: 1px; background-color: rgba(29,112,245,0.10) !important; }
    </style></head><body>
      <div id="stageWrap"><div id="stage"><div id="content">${safeHtml}</div></div></div>
      <script>
        function rescale() {
          const w = document.getElementById('stageWrap').getBoundingClientRect().width;
          if (w > 0) document.getElementById('stage').style.transform = 'scale(' + (w / 1920) + ')';
        }
        new ResizeObserver(rescale).observe(document.getElementById('stageWrap'));
        rescale();
      </script>
    </body></html>`
    const blob = new Blob([doc], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      loading="lazy"
      sandbox="allow-scripts"
      style={{ width: '100%', aspectRatio: '1920 / 1080', border: '1px solid var(--border)', borderRadius: 6, display: 'block' }}
    />
  )
}

export default function UiWalkthroughPage() {
  const { userRole, userBrandId, userAllowedPages } = useAuth()
  const { showToast } = useToast()

  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [screens, setScreens] = useState<ScreenDraft[]>([])
  const [title, setTitle] = useState('')
  const [narration, setNarration] = useState('')

  const [jobId, setJobId] = useState<string | null>(null)
  const [reviewScenes, setReviewScenes] = useState<ReviewScene[] | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectMsgIdx, setDetectMsgIdx] = useState(0)
  const [regeneratingOrder, setRegeneratingOrder] = useState<number | null>(null)
  const [building, setBuilding] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UiWalkthroughGenerateResponse | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [editing, setEditing] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState<'mp4' | 'mov' | 'gif'>('mp4')
  const [downloading, setDownloading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // This feature doesn't use brand style/guidelines to generate anything (it just
  // recreates the uploaded screenshots), so there's no reason to make the user pick a
  // brand. brand_id is still attached under the hood — it's what makes the result show
  // up in that brand's history and keeps RLS/storage-path scoping working — it's just
  // picked automatically instead of shown as a dropdown.
  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => {
        setSelectedBrandId(current => current || data?.[0]?.id || '')
      })
    } else if (userBrandId) {
      setSelectedBrandId(userBrandId)
    }
  }, [userRole, userBrandId])

  useEffect(() => () => screens.forEach(s => URL.revokeObjectURL(s.previewUrl)), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!detecting) return
    const t = setInterval(() => setDetectMsgIdx(i => (i + 1) % ANALYZE_MESSAGES.length), 3000)
    return () => clearInterval(t)
  }, [detecting])

  function resetOutputs() {
    setReviewScenes(null)
    setJobId(null)
    setResult(null)
    setSaved(false)
  }

  function selectFiles(files: FileList | null) {
    const incoming = Array.from(files || []).filter(f => f.type.startsWith('image/'))
    if (incoming.length === 0) return
    if (screens.length + incoming.length > MAX_SCREENS) {
      showToast(`You can upload up to ${MAX_SCREENS} screens total.`, true)
      return
    }
    const oversized = incoming.find(f => f.size > MAX_IMAGE_BYTES)
    if (oversized) { showToast(`${oversized.name} is larger than 8 MB.`, true); return }

    const drafts: ScreenDraft[] = incoming.map(file => ({ file, previewUrl: URL.createObjectURL(file) }))
    setScreens(prev => [...prev, ...drafts])
    resetOutputs()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeScreen(index: number) {
    setScreens(prev => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    resetOutputs()
  }

  function moveScreen(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= screens.length) return
    setScreens(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleAnalyze() {
    if (!selectedBrandId) { setError('No brand is set up for this account yet.'); return }
    if (screens.length === 0) { setError('Upload at least one screen.'); return }
    if (!narration.trim()) { setError('Describe what this walkthrough is showing.'); return }

    setDetecting(true)
    setError(null)
    resetOutputs()
    setDetectMsgIdx(0)

    try {
      const runId = crypto.randomUUID()
      const newJobId = `uiw_${Date.now()}_${selectedBrandId}`
      const trimmedNarration = narration.trim()

      const screenPayload = await Promise.all(screens.map(async (screen, index) => {
        const fileName = `screen_${index + 1}_${sanitizeFilename(screen.file.name)}`
        const uploaded = await uploadMedia(screen.file, {
          folder: `generated-posts/ui-walkthrough-inputs/${selectedBrandId}/${runId}`,
          fileName,
        })
        return { storagePath: uploaded.filePath, order: index, narration: trimmedNarration }
      }))

      const res = await authedFetch('/api/ui-walkthrough/analyze-screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screens: screenPayload }),
      })
      const text = await res.text()
      if (!res.ok) {
        let message = text || `Analysis failed (${res.status}).`
        try {
          const payload = JSON.parse(text) as { error?: unknown }
          if (typeof payload.error === 'string' && payload.error) message = payload.error
        } catch { /* keep raw text */ }
        throw new Error(message)
      }
      const data = JSON.parse(text) as { scenes: WalkthroughScene[] }
      const merged: ReviewScene[] = data.scenes
        .sort((a, b) => a.order - b.order)
        .map((scene, i) => ({ ...scene, storagePath: screenPayload[i].storagePath }))
      setReviewScenes(merged)
      setJobId(newJobId)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDetecting(false)
    }
  }

  async function handleRegenerateScreen(order: number) {
    if (!reviewScenes) return
    const scene = reviewScenes.find(s => s.order === order)
    if (!scene) return

    setRegeneratingOrder(order)
    try {
      const res = await authedFetch('/api/ui-walkthrough/analyze-screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screens: [{ storagePath: scene.storagePath, order: scene.order, narration: narration.trim() }] }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Regenerate failed')
      const updated = (data.scenes as WalkthroughScene[])[0]
      setReviewScenes(prev => prev && prev.map(s => s.order === order ? { ...s, recreatedHtml: updated.recreatedHtml } : s))
    } catch (err) {
      showToast((err as Error).message, true)
    } finally {
      setRegeneratingOrder(null)
    }
  }

  async function handleBuild() {
    if (!reviewScenes || !jobId) return
    setBuilding(true)
    setError(null)
    try {
      const scenes: WalkthroughScene[] = reviewScenes.map(({ storagePath: _storagePath, ...scene }) => scene)
      const res = await authedFetch('/api/ui-walkthrough/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: selectedBrandId, jobId, scenes }),
      })
      const text = await res.text()
      if (!res.ok) {
        let message = text || `Build failed (${res.status}).`
        try {
          const payload = JSON.parse(text) as { error?: unknown }
          if (typeof payload.error === 'string' && payload.error) message = payload.error
        } catch { /* keep raw text */ }
        throw new Error(message)
      }
      setResult(JSON.parse(text) as UiWalkthroughGenerateResponse)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBuilding(false)
    }
  }

  async function handleEdit() {
    if (!result || !editInstruction.trim()) return
    setEditing(true)
    try {
      const res = await authedFetch('/api/infographic-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.code, instruction: editInstruction.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Edit failed')
      if (data.jsCode) {
        setResult({ ...result, code: data.jsCode })
        setEditInstruction('')
        setEditOpen(false)
        setSaved(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEditing(false)
    }
  }

  async function handleSaveToHistory() {
    if (!result) return
    setSaving(true)
    try {
      const headline = (title.trim() || narration || 'UI Walkthrough').split('\n')[0].substring(0, 100)
      const { error: insertError } = await sb.from('generated_posts').insert({
        brand_id: selectedBrandId,
        output_url: '',
        headline,
        is_ui_walkthrough: true,
        remotion_code: result.code,
        render_params: { job_id: result.jobId },
      })
      if (insertError) throw new Error(insertError.message)
      setSaved(true)
      showToast('Saved to history')
    } catch (err) {
      showToast((err as Error).message, true)
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    if (!result) return
    setDownloading(true)
    try {
      const { recordWalkthroughVideo, recordWalkthroughGif } = await import('@/lib/ui-walkthrough/record-export')
      const params = { code: result.code }
      if (downloadFormat === 'gif') {
        await recordWalkthroughGif(params)
      } else {
        await recordWalkthroughVideo(params, downloadFormat)
      }
    } catch (err) {
      showToast((err as Error).message, true)
    } finally {
      setDownloading(false)
    }
  }

  if (userRole !== 'admin' && !userAllowedPages.includes('ui-walkthrough')) return null

  return (
    <>
      <h1>UI Walkthrough</h1>
      <p className="subtitle">Upload up to {MAX_SCREENS} UI screens and generate an animated walkthrough — AI recreates each screen's structure, with a simulated cursor/typing overlay stitched between them.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>
          <div className="form-card">
            <h2>Settings</h2>

            <div className="form-group">
              <label>Title (optional)</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Onboarding walkthrough" disabled={detecting} />
            </div>

            <div className="form-group">
              <label>Narration</label>
              <textarea
                rows={4}
                placeholder="What's happening across this walkthrough? e.g. The user searches for a product, adds it to cart, and checks out."
                value={narration}
                onChange={e => setNarration(e.target.value)}
                style={{ resize: 'vertical' }}
                disabled={detecting}
              />
            </div>

            <div className="form-group">
              <label>Screens ({screens.length}/{MAX_SCREENS})</label>
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                Click to add screenshots
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.avif"
                multiple
                style={{ display: 'none' }}
                onChange={e => selectFiles(e.target.files)}
                disabled={detecting}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--error,#e74c3c)', marginBottom: 8 }}>
                {error}
              </div>
            )}

            <button className="generate-btn" onClick={handleAnalyze} disabled={detecting || !selectedBrandId || screens.length === 0}>
              {detecting ? 'Analyzing…' : reviewScenes ? 'Re-analyze All Screens' : 'Analyze Screens'}
            </button>
            {detecting && (
              <div style={{ padding: '14px 0 2px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                {ANALYZE_MESSAGES[detectMsgIdx]}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {screens.length > 0 && !reviewScenes && (
            <div className="form-card">
              <h2>Screens</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {screens.map((screen, index) => (
                  <div key={screen.previewUrl} style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screen.previewUrl} alt={`Screen ${index + 1}`} loading="lazy" style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)' }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)' }}>Screen {index + 1}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => moveScreen(index, -1)} disabled={index === 0 || detecting}>↑</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => moveScreen(index, 1)} disabled={index === screens.length - 1 || detecting}>↓</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => removeScreen(index)} disabled={detecting}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewScenes && !result && (
            <div className="form-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ margin: 0 }}>Review recreated screens</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setReviewScenes(null)}>← Edit screens</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, marginBottom: 16 }}>
                Compare the AI recreation against your original screenshot. Blue boxes show what it'll click/type into. If either looks wrong, regenerate just that screen.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {reviewScenes.map(scene => (
                  <div key={scene.order} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Screen {scene.order + 1}</div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRegenerateScreen(scene.order)}
                        disabled={regeneratingOrder !== null}
                      >
                        {regeneratingOrder === scene.order ? 'Regenerating…' : 'Regenerate this screen'}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Original</div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={scene.imageUrl} alt={`Original screen ${scene.order + 1}`} loading="lazy" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>AI recreation</div>
                          <RecreatedScenePreview html={scene.recreatedHtml} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                        {(() => {
                          const interactions = extractInteractions(scene.recreatedHtml)
                          return interactions.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No interactive elements marked — this screen will just show as a static frame.</div>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {interactions.map((it, i) => (
                                <li key={i}>{i + 1}. {it.type === 'type' ? `types "${it.text}"` : 'clicks'}</li>
                              ))}
                            </ul>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="generate-btn" onClick={handleBuild} disabled={building || regeneratingOrder !== null} style={{ marginTop: 16 }}>
                {building ? 'Building…' : 'Build Walkthrough'}
              </button>
            </div>
          )}

          <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Preview</h2>
              {result && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditOpen(v => !v)}>Edit</button>
              )}
            </div>

            {editOpen && result && (
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  placeholder="e.g. Slow down the typing on screen 2"
                  style={{ flex: 1 }}
                  disabled={editing}
                />
                <button className="btn btn-primary btn-sm" onClick={handleEdit} disabled={editing || !editInstruction.trim()}>
                  {editing ? 'Applying…' : 'Apply'}
                </button>
              </div>
            )}

            <div className="output-area" style={{ minHeight: 320 }}>
              {result ? (
                <UiWalkthroughPreview code={result.code} />
              ) : building ? (
                <div className="spinner" />
              ) : (
                <div className="output-placeholder">
                  {reviewScenes ? 'Review the recreated screens above, then build the walkthrough.' : 'Upload screens and analyze them to get started.'}
                </div>
              )}
            </div>

            {result && (
              <div className="output-actions" style={{ position: 'static', padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <select
                  value={downloadFormat}
                  onChange={e => setDownloadFormat(e.target.value as 'mp4' | 'mov' | 'gif')}
                  disabled={downloading}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, width: 'auto' }}
                >
                  <option value="mp4">MP4</option>
                  <option value="mov">MOV</option>
                  <option value="gif">GIF</option>
                </select>
                <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? 'Preparing…' : 'Download'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveToHistory} disabled={saving || saved}>
                  {saved ? 'Saved' : saving ? 'Saving…' : 'Save to History'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
