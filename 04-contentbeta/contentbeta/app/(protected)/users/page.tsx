'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useState } from 'react'
import { sb } from '@/lib/supabase'
import { useToast } from '@/lib/toast'
import { RESTRICTED_PAGES } from '@/lib/page-access'

interface UserEntry {
  email: string
  brand_id: string
  brand_name: string
  tokens: number
}

interface Brand { id: string; name: string }

export default function UsersPage() {
  const { showToast } = useToast()
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({})
  const [toppingUp, setToppingUp] = useState<Record<string, boolean>>({})
  const [brandFilter, setBrandFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [brands, setBrands] = useState<Brand[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newBrandId, setNewBrandId] = useState('')
  const [newTokens, setNewTokens] = useState('20')
  const [saving, setSaving] = useState(false)
  const [access, setAccess] = useState<Set<string>>(new Set())
  const [accessPending, setAccessPending] = useState<Set<string>>(new Set())
  const [brandSearchQuery, setBrandSearchQuery] = useState('')

  function accessKey(brandId: string, pageKey: string) {
    return `${brandId}:${pageKey}`
  }

  async function loadAccess() {
    const { data } = await sb.from('brand_page_access').select('brand_id, page_key')
    setAccess(new Set((data || []).map(r => accessKey(r.brand_id, r.page_key))))
  }

  async function toggleAccess(brandId: string, pageKey: string) {
    const key = accessKey(brandId, pageKey)
    const hasAccess = access.has(key)
    setAccessPending(prev => new Set(prev).add(key))

    if (hasAccess) {
      const { error } = await sb.from('brand_page_access').delete().eq('brand_id', brandId).eq('page_key', pageKey)
      if (error) {
        showToast('Failed to revoke access.', true)
      } else {
        setAccess(prev => { const next = new Set(prev); next.delete(key); return next })
      }
    } else {
      const { error } = await sb.from('brand_page_access').insert({ brand_id: brandId, page_key: pageKey })
      if (error) {
        showToast('Failed to grant access.', true)
      } else {
        setAccess(prev => new Set(prev).add(key))
      }
    }

    setAccessPending(prev => { const next = new Set(prev); next.delete(key); return next })
  }

  async function loadUsers() {
    const { data } = await sb
      .from('users')
      .select('email, brand_id, tokens, brands(name)')
      .eq('role', 'user')
      .order('email')
    const entries: UserEntry[] = (data || []).map((row) => ({
      email: row.email,
      brand_id: row.brand_id,
      brand_name: (row.brands as unknown as { name: string } | null)?.name ?? 'Unknown',
      tokens: row.tokens ?? 0,
    }))
    setUsers(entries)
    setLoading(false)
  }

  async function loadBrands() {
    const { data } = await sb.from('brands').select('id, name').order('name')
    setBrands(data || [])
  }

  useEffect(() => {
    loadUsers()
    loadBrands()
    loadAccess()
  }, [])

  async function handleTopUp(email: string) {
    const amount = parseInt(topUpAmounts[email] || '0', 10)
    if (!amount || amount <= 0) { showToast('Enter a valid amount.', true); return }

    setToppingUp(prev => ({ ...prev, [email]: true }))
    const user = users.find(u => u.email === email)
    const newTotal = (user?.tokens ?? 0) + amount

    const { error } = await sb.from('users').update({ tokens: newTotal }).eq('email', email)

    setToppingUp(prev => ({ ...prev, [email]: false }))

    if (!error) {
      setUsers(prev => prev.map(u => u.email === email ? { ...u, tokens: newTotal } : u))
      setTopUpAmounts(prev => ({ ...prev, [email]: '' }))
      showToast(`Added ${amount} tokens for ${email}`)
    } else {
      showToast('Failed to top up tokens.', true)
    }
  }

  async function handleAddUser() {
    if (!newEmail.trim()) { showToast('Enter an email address.', true); return }
    if (!newPassword.trim()) { showToast('Enter a password.', true); return }
    if (newPassword.length < 6) { showToast('Password must be at least 6 characters.', true); return }
    if (!newBrandId) { showToast('Select a brand.', true); return }
    const tokens = parseInt(newTokens, 10)
    if (isNaN(tokens) || tokens < 0) { showToast('Enter a valid token count.', true); return }

    setSaving(true)

    const res = await authedFetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        brand_id: newBrandId,
        tokens,
      }),
    })

    let result: { error?: string; success?: boolean } = {}
    try { result = await res.json() } catch { /* non-JSON response */ }
    setSaving(false)

    if (!res.ok) {
      showToast(result.error || `Server error (${res.status}). Check SUPABASE_SERVICE_ROLE_KEY in .env.local`, true)
      return
    }

    showToast(`User created with ${tokens} tokens.`)
    setAddModalOpen(false)
    setNewEmail('')
    setNewPassword('')
    setNewBrandId('')
    setNewTokens('20')
    setLoading(true)
    loadUsers()
  }

  const filtered = users
    .filter(u => !brandFilter || u.brand_id === brandFilter)
    .filter(u => !searchQuery.trim() || u.email.toLowerCase().includes(searchQuery.trim().toLowerCase()))

  const filteredBrands = brands
    .filter(b => !brandSearchQuery.trim() || b.name.toLowerCase().includes(brandSearchQuery.trim().toLowerCase()))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1>Users</h1>
          <p className="subtitle">Manage brand users and their token balances.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add User
        </button>
      </div>

      {!loading && users.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search by email…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 'auto', minWidth: '240px' }}
          />
          {brands.length > 0 && (
            <select
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading…</p>
      ) : users.length === 0 ? (
        <p className="empty-state">No users yet. Add one to get started.</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No users match your search.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Brand</th>
                <th>Tokens</th>
                <th>Top Up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.email}>
                  <td className="users-email">{u.email}</td>
                  <td><span className="users-brand-tag">{u.brand_name}</span></td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '14px',
                      color: u.tokens <= 0 ? 'var(--red)' : u.tokens <= 5 ? '#f59e0b' : 'var(--text)',
                    }}>
                      {u.tokens}
                    </span>
                  </td>
                  <td>
                    <div className="topup-row">
                      <input
                        type="number"
                        min="1"
                        placeholder="Add"
                        value={topUpAmounts[u.email] || ''}
                        onChange={e => setTopUpAmounts(prev => ({ ...prev, [u.email]: e.target.value }))}
                        className="topup-input"
                        onKeyDown={e => { if (e.key === 'Enter') handleTopUp(u.email) }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleTopUp(u.email)}
                        disabled={toppingUp[u.email]}
                      >
                        {toppingUp[u.email] ? '…' : 'Add'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '48px', marginBottom: '20px' }}>
        <h2>Brand Access</h2>
        <p className="subtitle" style={{ marginBottom: 0 }}>Control which brands can access which restricted features.</p>
      </div>

      {!loading && brands.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search by brand…"
            value={brandSearchQuery}
            onChange={e => setBrandSearchQuery(e.target.value)}
            style={{ width: 'auto', minWidth: '240px' }}
          />
        </div>
      )}

      {!loading && brands.length > 0 && (
        <div className="brand-access-table-wrap">
          <table className="brand-access-table">
            <thead>
              <tr>
                <th className="brand-access-brand-col">Brand</th>
                {RESTRICTED_PAGES.map(p => (
                  <th key={p.key} className="brand-access-page-col">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={RESTRICTED_PAGES.length + 1} className="empty-state">No brands match your search.</td>
                </tr>
              ) : filteredBrands.map(brand => (
                <tr key={brand.id}>
                  <td className="brand-access-brand-col users-email">{brand.name}</td>
                  {RESTRICTED_PAGES.map(p => {
                    const key = accessKey(brand.id, p.key)
                    return (
                      <td key={p.key} className="brand-access-page-col">
                        <input
                          type="checkbox"
                          checked={access.has(key)}
                          disabled={accessPending.has(key)}
                          onChange={() => toggleAccess(brand.id, p.key)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      <div className={`modal-overlay${addModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setAddModalOpen(false) }}>
        <div className="modal">
          <h2>Add User</h2>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="user@company.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="text"
              placeholder="Min. 6 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Brand</label>
            <select value={newBrandId} onChange={e => setNewBrandId(e.target.value)}>
              <option value="">Select a brand…</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Initial Tokens</label>
            <input
              type="number"
              min="0"
              value={newTokens}
              onChange={e => setNewTokens(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setAddModalOpen(false); setNewPassword('') }} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddUser} disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
