'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'

interface Layout { id: string; name: string; prompt: string; created_at: string }
interface Category { id: string; label: string }

export default function CategoryDetailPage() {
  const { id: brandId, catId } = useParams<{ id: string; catId: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [category, setCategory] = useState<Category | null>(null)
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Add prompt modal
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => { loadData() }, [catId])

  async function loadData() {
    const [{ data: cat }, { data: layoutData }] = await Promise.all([
      sb.from('reference_categories').select('*').eq('id', catId).single(),
      sb.from('reference_layouts').select('*').eq('category_id', catId).order('created_at'),
    ])
    setCategory(cat)
    setLayouts(layoutData || [])
  }

  async function handleAdd() {
    if (!newName.trim()) { showToast('Please enter a prompt name.', true); return }
    if (!newPrompt.trim()) { showToast('Please enter the layout prompt.', true); return }
    setAddSaving(true)
    const { error } = await sb.from('reference_layouts').insert({ category_id: catId, name: newName.trim(), prompt: newPrompt.trim() })
    setAddSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast('Prompt saved!')
    setModalOpen(false)
    setNewName('')
    setNewPrompt('')
    loadData()
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim() || !editPrompt.trim()) { showToast('Name and prompt are required.', true); return }
    setSavingEdit(true)
    const { error } = await sb.from('reference_layouts').update({ name: editName.trim(), prompt: editPrompt.trim() }).eq('id', id)
    setSavingEdit(false)
    if (error) { showToast(error.message, true); return }
    showToast('Prompt updated.')
    setEditingId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this prompt?')) return
    await sb.from('reference_layouts').delete().eq('id', id)
    showToast('Prompt deleted.')
    loadData()
  }

  if (!category) return null

  return (
    <>
      <button className="back-btn" onClick={() => router.push(`/brands/${brandId}`)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to Brand
      </button>

      <div className="detail-header">
        <div className="detail-title">
          <h1>{category.label}</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>{layouts.length} prompt{layouts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary btn-sm" onClick={() => { setNewName(''); setNewPrompt(''); setModalOpen(true) }}>+ Add Prompt</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {layouts.length === 0 && (
          <p className="empty-state">No prompts yet. Click &quot;+ Add Prompt&quot; to create one.</p>
        )}
        {layouts.map(l => (
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
                  <textarea rows={7} value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '140px' }} />
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
                      onClick={() => { setEditingId(l.id); setEditName(l.name); setEditPrompt(l.prompt) }}>
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
          <h2>Add Prompt — {category.label}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Prompt name (e.g. Clean Center Layout)" value={newName} onChange={e => setNewName(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' }} />
            <textarea rows={6} placeholder="Describe the layout in detail..." value={newPrompt} onChange={e => setNewPrompt(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit' }} />
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
