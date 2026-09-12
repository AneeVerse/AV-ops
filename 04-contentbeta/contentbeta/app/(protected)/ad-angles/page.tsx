'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'

interface AdAngle { id: string; name: string; description: string | null; created_at: string }

export default function AdAnglesPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [angles, setAngles] = useState<AdAngle[]>([])
  const [countMap, setCountMap] = useState<Record<string, number>>({})

  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: a }, { data: imgs }] = await Promise.all([
      sb.from('ad_angles').select('*').order('created_at'),
      sb.from('ad_angle_images').select('angle_id'),
    ])
    const map: Record<string, number> = {}
    ;(imgs || []).forEach((r: { angle_id: string }) => { map[r.angle_id] = (map[r.angle_id] || 0) + 1 })
    setAngles(a || [])
    setCountMap(map)
  }

  async function handleCreate() {
    if (!newName.trim()) { showToast('Please enter an angle name.', true); return }
    setSaving(true)
    const { error } = await sb.from('ad_angles').insert({ name: newName.trim(), description: newDesc.trim() || null })
    setSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast('Ad angle created.')
    setModalOpen(false); setNewName(''); setNewDesc('')
    loadData()
  }

  async function handleDelete(angle: AdAngle) {
    if (!confirm(`Delete "${angle.name}" and all its images?`)) return
    // images are cascade deleted via FK
    await sb.from('ad_angles').delete().eq('id', angle.id)
    showToast('Ad angle deleted.')
    loadData()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h1 style={{ margin: 0 }}>Ad Angles</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => { setNewName(''); setNewDesc(''); setModalOpen(true) }}>+ Add Angle</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '24px' }}>Global ad angle references. Each angle holds visual examples used to guide ad concept generation.</p>

      <div className="brand-grid">
        {angles.length === 0 && (
          <p className="empty-state" style={{ color: 'var(--muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>
            No ad angles yet. Click &quot;+ Add Angle&quot; to create one.
          </p>
        )}
        {angles.map(angle => (
          <div key={angle.id} className="brand-card" style={{ position: 'relative' }}
            onClick={() => router.push(`/ad-angles/${angle.id}`)}>
            <button title="Delete" style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', zIndex: 1 }}
              onClick={e => { e.stopPropagation(); handleDelete(angle) }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="brand-logo-thumb" style={{ background: '#222', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
            <div className="brand-name">{angle.name}</div>
            <div className="brand-assets-count">{countMap[angle.id] || 0} image{(countMap[angle.id] || 0) !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="modal">
          <h2>Add Ad Angle</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            <input type="text" placeholder="Angle name (e.g. Social Math)" value={newName} onChange={e => setNewName(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
            <textarea rows={3} placeholder="Short description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create Angle'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
