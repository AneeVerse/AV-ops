'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'

interface Brand { id: string; name: string; created_at: string }

export default function BrandsPage() {
  const { userRole } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  const [brands, setBrands] = useState<Brand[]>([])
  const [logoMap, setLogoMap] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [brandDesc, setBrandDesc] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadBrands() }, [])

  async function loadBrands() {
    const { data: brandsData, error } = await sb.from('brands').select('*').order('created_at', { ascending: false })
    if (error) { showToast('Failed to load brands', true); return }
    const { data: profiles } = await sb.from('brand_profiles').select('brand_id,logo_url')
    const map: Record<string, string> = {}
      ; (profiles || []).forEach((p: { brand_id: string; logo_url: string }) => { if (p.logo_url) map[p.brand_id] = p.logo_url })
    setBrands(brandsData || [])
    setLogoMap(map)
  }

  function closeModal() {
    setModalOpen(false)
    setBrandName('')
    setBrandDesc('')
    setLogoFile(null)
    setProgress(0)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleSaveBrand() {
    if (!brandName.trim()) { showToast('Please enter a brand name.', true); return }
    setSaving(true)
    try {
      const { data: brand, error: brandErr } = await sb.from('brands').insert({ name: brandName.trim() }).select().single()
      if (brandErr) throw brandErr

      let logoUrl: string | null = null, logoPath: string | null = null
      if (logoFile) {
        const uploaded = await uploadMedia(logoFile, {
          folder: `brand-logos/${brand.id}`,
          fileName: `${Date.now()}_${logoFile.name}`,
        })
        logoUrl = uploaded.url
        logoPath = uploaded.filePath
      }

      await sb.from('brand_profiles').insert({ brand_id: brand.id, logo_url: logoUrl, logo_storage_path: logoPath })
      showToast(`Brand "${brandName.trim()}" created!`)
      closeModal()
      await loadBrands()
    } catch (err: unknown) {
      showToast((err as Error).message || 'Save failed', true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="brands-header">
        <div>
          <h1>Brand</h1>
          <p className="subtitle">Manage your brand assets and generate posts.</p>
        </div>
      </div>

      <div className="brand-grid">
        {brands.map(brand => (
          <div
            key={brand.id}
            className="brand-card"
            onClick={() => router.push(`/brands/${brand.id}`)}
          >
            <div className="brand-logo-thumb">
              {logoMap[brand.id]
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoMap[brand.id]} alt={brand.name} />
                : <span className="initials">{brand.name[0]}</span>
              }
            </div>
            <div className="brand-name">{brand.name}</div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={e => { e.stopPropagation(); router.push(`/generate?brand=${brand.id}`) }}
            >
              Generate Image
            </button>
          </div>
        ))}

        {userRole === 'admin' && (
          <div className="add-brand-card" onClick={() => setModalOpen(true)}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Brand
          </div>
        )}
      </div>

      {/* Add Brand Modal */}
      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
        <div className="modal">
          <h2>Add Brand</h2>
          <div className="form-group">
            <label>Brand Name</label>
            <input type="text" placeholder="e.g. Truckstop.com" value={brandName} onChange={e => setBrandName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Brand Description</label>
            <textarea rows={3} placeholder="Describe what this brand does, who they serve, their tone and values." value={brandDesc} onChange={e => setBrandDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Logo</label>
            <div className="upload-zone" onClick={() => logoInputRef.current?.click()}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>{logoFile ? logoFile.name : 'Click to upload logo'}</p>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          {progress > 0 && (
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveBrand} disabled={saving}>
              {saving ? 'Saving…' : 'Save Brand'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
