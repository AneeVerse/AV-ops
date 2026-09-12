'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { TBA_GROUPS, TBA_SITES, type TbaGroup } from '@/lib/tba-sites'

function SiteIcon({ group }: { group: TbaGroup }) {
  const props = { width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' }
  if (group === 'websites') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 3 3.8 6 3.8 9s-1.3 6-3.8 9c-2.5-3-3.8-6-3.8-9s1.3-6 3.8-9z" />
      </svg>
    )
  }
  if (group === 'studio') {
    return (
      <svg {...props}>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 20h8" />
      </svg>
    )
  }
  if (group === 'business') {
    return (
      <svg {...props}>
        <path d="M4 20V8h6V4h4v4h6v12H4z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }
  return (
    <svg {...props}>
      <path d="M12 3v4M12 17v4M4.9 7.5l3.5 2M15.6 14.5l3.5 2M4.9 16.5l3.5-2M15.6 9.5l3.5-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function openSite(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer')
}

export default function TbaPage() {
  const { userRole, loading } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<TbaGroup | 'all'>('all')

  useEffect(() => {
    if (!loading && userRole !== 'admin') router.replace('/generate')
  }, [loading, userRole, router])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TBA_SITES.filter((site) => {
      if (group !== 'all' && site.group !== group) return false
      if (!q) return true
      return [site.name, site.host, site.description].join(' ').toLowerCase().includes(q)
    })
  }, [query, group])

  const grouped = useMemo(() => {
    return TBA_GROUPS.map((g) => ({
      ...g,
      sites: filtered.filter((s) => s.group === g.key),
    })).filter((g) => g.sites.length > 0)
  }, [filtered])

  if (userRole !== 'admin') return null

  return (
    <>
      <div className="brands-header">
        <div>
          <h1>Tools</h1>
          <p className="subtitle">Hosted Aneeverse tools. Click a card to open it.</p>
        </div>
      </div>

      <div className="tba-toolbar">
        <input
          type="text"
          className="tba-search"
          placeholder="Search tools or URLs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tba-filters">
          <button
            type="button"
            className={`tba-chip${group === 'all' ? ' active' : ''}`}
            onClick={() => setGroup('all')}
          >
            All
          </button>
          {TBA_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`tba-chip${group === g.key ? ' active' : ''}`}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="empty-state">No tools match that search.</div>
      )}

      {grouped.map((g) => (
        <section key={g.key} className="tba-section">
          <div className="tba-section-head">
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>{g.label}</h2>
            <span className="tba-section-hint">{g.hint}</span>
          </div>
          <div className="tba-grid">
            {g.sites.map((site) => (
              <article
                key={site.id}
                className="tba-card"
                onClick={() => openSite(site.href)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSite(site.href) } }}
                role="link"
                tabIndex={0}
                aria-label={`Open ${site.name}`}
              >
                <div className="tba-card-top">
                  <div className="tba-icon">
                    <SiteIcon group={site.group} />
                  </div>
                  <div className="tba-badges">
                    {site.current && <span className="tba-badge tba-badge-here">This app</span>}
                    <span className={`tba-badge${site.https ? '' : ' tba-badge-warn'}`}>
                      {site.https ? 'HTTPS' : 'HTTP'}
                    </span>
                  </div>
                </div>
                <div className="tba-name">{site.name}</div>
                <p className="tba-desc">{site.description}</p>
                <div className="tba-host">{site.host}</div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
