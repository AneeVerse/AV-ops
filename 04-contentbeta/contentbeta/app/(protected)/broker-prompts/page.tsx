'use client'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'

interface BrokerPrompt {
  id: string
  name: string
  prompt: string
  reference_image_urls?: string[] | null
  created_at: string
}

export default function BrokerPromptsPage() {
  const { showToast } = useToast()
  const [prompts, setPrompts] = useState<BrokerPrompt[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editRefFiles, setEditRefFiles] = useState<(File | null)[]>([null, null])
  const [savingEdit, setSavingEdit] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [newRefFiles, setNewRefFiles] = useState<(File | null)[]>([null, null])
  const [addSaving, setAddSaving] = useState(false)

  const editRef1 = useRef<HTMLInputElement>(null)
  const editRef2 = useRef<HTMLInputElement>(null)
  const newRef1 = useRef<HTMLInputElement>(null)
  const newRef2 = useRef<HTMLInputElement>(null)

  useEffect(() => { loadPrompts() }, [])

  async function loadPrompts() {
    const { data } = await sb.from('broker_prompts').select('*').order('created_at')
    setPrompts(data || [])
  }

  async function handleAdd() {
    if (!newName.trim()) { showToast('Name and prompt required.', true); return }
    if (!newPrompt.trim()) { showToast('Name and prompt required.', true); return }
    setAddSaving(true)
    try {
      const { data: inserted, error } = await sb.from('broker_prompts').insert({ name: newName.trim(), prompt: newPrompt.trim() }).select().single()
      if (error) throw error

      const refUrls: string[] = []
      for (let i = 0; i < 2; i++) {
        const file = newRefFiles[i]
        if (file) {
          try {
            const ext = file.name.split('.').pop() || 'bin'
            const uploaded = await uploadMedia(file, {
              folder: `broker-reference-images/${inserted.id}`,
              fileName: `ref${i + 1}.${ext}`,
            })
            refUrls.push(uploaded.url)
          } catch { /* skip failed upload */ }
        }
      }
      if (refUrls.length) {
        await sb.from('broker_prompts').update({ reference_image_urls: refUrls }).eq('id', inserted.id)
      }
      showToast('Prompt saved!')
      setModalOpen(false)
      setNewName('')
      setNewPrompt('')
      setNewRefFiles([null, null])
      loadPrompts()
    } catch (err: unknown) {
      showToast((err as Error).message || 'Save failed', true)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim() || !editPrompt.trim()) { showToast('Name and prompt required.', true); return }
    setSavingEdit(true)
    const { error } = await sb.from('broker_prompts').update({ name: editName.trim(), prompt: editPrompt.trim() }).eq('id', id)
    if (error) { showToast(error.message, true); setSavingEdit(false); return }

    const refUrls: string[] = []
    const files = [editRefFiles[0], editRefFiles[1]]
    let hasNew = false
    for (let i = 0; i < 2; i++) {
      const file = files[i]
      if (file) {
        hasNew = true
        try {
          const ext = file.name.split('.').pop() || 'bin'
          const uploaded = await uploadMedia(file, {
            folder: `broker-reference-images/${id}`,
            fileName: `ref${i + 1}.${ext}`,
          })
          refUrls[i] = uploaded.url
        } catch { /* skip failed upload */ }
      }
    }
    if (hasNew && refUrls.length) {
      await sb.from('broker_prompts').update({ reference_image_urls: refUrls }).eq('id', id)
    }
    setSavingEdit(false)
    showToast('Prompt updated.')
    setEditingId(null)
    loadPrompts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this prompt?')) return
    await sb.from('broker_prompts').delete().eq('id', id)
    showToast('Prompt deleted.')
    loadPrompts()
  }

  return (
    <>
      <div className="detail-header">
        <div className="detail-title">
          <h1>Broker Prompts</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>{prompts.length} prompt{prompts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary btn-sm" onClick={() => { setNewName(''); setNewPrompt(''); setNewRefFiles([null, null]); setModalOpen(true) }}>
            + Add Prompt
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {prompts.length === 0 && (
          <p className="empty-state">No broker prompts yet. Click &quot;+ Add Prompt&quot; to create one.</p>
        )}
        {prompts.map(l => (
          <div key={l.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
            {editingId === l.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Prompt</label>
                  <textarea rows={6} value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '120px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Reference Images</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[0, 1].map(i => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--muted)' }}>Image {i + 1}</label>
                        {l.reference_image_urls?.[i] && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={l.reference_image_urls[i]} alt="" loading="lazy"
                            style={{ width: '100%', height: '64px', objectFit: 'cover', borderRadius: '6px', marginBottom: '2px' }} />
                        )}
                        <input ref={i === 0 ? editRef1 : editRef2} type="file" accept="image/*"
                          onChange={e => { const f = [...editRefFiles]; f[i] = e.target.files?.[0] ?? null; setEditRefFiles(f) }}
                          style={{ fontSize: '11px', color: 'var(--text)', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 7px', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" disabled={savingEdit} onClick={() => handleSaveEdit(l.id)}>
                    {savingEdit ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{l.name}</div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                      onClick={() => { setEditingId(l.id); setEditName(l.name); setEditPrompt(l.prompt); setEditRefFiles([null, null]) }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                      onClick={() => handleDelete(l.id)}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{l.prompt}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add Prompt Modal */}
      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="modal">
          <h2>Add Prompt — Broker Prompts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Prompt name (e.g. Clean Center Layout)" value={newName} onChange={e => setNewName(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' }} />
            <textarea rows={6} placeholder="Describe the layout in detail..." value={newPrompt} onChange={e => setNewPrompt(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Reference Images (optional)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[0, 1].map(i => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Image {i + 1}</label>
                    <input ref={i === 0 ? newRef1 : newRef2} type="file" accept="image/*"
                      onChange={e => { const f = [...newRefFiles]; f[i] = e.target.files?.[0] ?? null; setNewRefFiles(f) }}
                      style={{ fontSize: '12px', color: 'var(--text)', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 8px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={addSaving}>
              {addSaving ? 'Saving…' : 'Save Prompt'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
