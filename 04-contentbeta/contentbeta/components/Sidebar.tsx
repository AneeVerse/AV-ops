'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, userRole, userBrandName, userAllowedPages, signOut } = useAuth()
  const { isLight, toggleTheme } = useTheme()

  const isActive = (base: string) => pathname === base || pathname.startsWith(base + '/')

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  const logoSrc = isLight ? '/CB New Logo Black.png' : '/CB New logo White Just Text (1).png'

  return (
    <aside>
      <div className="logo-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          loading="lazy"
          id="sidebar-logo-img"
          src={logoSrc}
          alt="ContentBeta"
          style={{ height: '34px', width: '130px', objectFit: 'contain', objectPosition: 'left center' }}
        />
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {isLight ? (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
      </div>

      <nav>
        {userRole === 'admin' && (
          <Link href="/brands" className={isActive('/brands') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Brands
          </Link>
        )}

        {userRole === 'admin' && (
          <Link href="/brand-setup" className={isActive('/brand-setup') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 3l1.8 4.4L18 9.2l-4.2 1.8L12 15.5 10.2 11 6 9.2l4.2-1.8L12 3z"/>
              <path d="M5 15l.9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15z"/>
              <path d="M19 14l.8 1.8 1.7.7-1.7.8L19 19l-.7-1.7-1.8-.8 1.8-.7L19 14z"/>
            </svg>
            AI Brand Setup
          </Link>
        )}

        {userRole === 'admin' && (
          <Link href="/ad-angles" className={isActive('/ad-angles') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Ad Angles
          </Link>
        )}

        {userRole === 'admin' && (
          <Link href="/ppt-prompts" className={isActive('/ppt-prompts') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 10h16M4 14h10" />
            </svg>
            PPT Prompts
          </Link>
        )}

        <Link href="/generate" className={pathname === '/generate' ? 'active' : ''}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Static Socials
        </Link>

        {(userRole === 'admin' || userAllowedPages.includes('generate-broker')) && (
          <Link href="/generate-broker" className={pathname === '/generate-broker' ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Stock Imagery
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('generate-illustrations')) && (
          <Link href="/generate-illustrations" className={pathname === '/generate-illustrations' ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Illustrations
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('carousel-v2')) && (
          <Link href="/carousel-v2" className={isActive('/carousel-v2') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Blog to Carousel
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('ad-concept-generator')) && (
          <Link href="/ad-concept-generator" className={isActive('/ad-concept-generator') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ad Concepts
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('generate-banner')) && (
          <Link href="/generate-banner" className={isActive('/generate-banner') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Multi-size Ads
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('map-graphics')) && (
          <Link href="/map-graphics" className={isActive('/map-graphics') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Map Graphics
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('infographic-generator')) && (
          <Link href="/infographic-generator" className={isActive('/infographic-generator') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Motion Infographics
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('blog-images')) && (
          <Link href="/blog-images" className={isActive('/blog-images') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Blog Images
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('pdf-to-ppt')) && (
          <Link href="/pdf-to-ppt" className={isActive('/pdf-to-ppt') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            PDF to PPT
          </Link>
        )}

        {(userRole === 'admin' || userAllowedPages.includes('ui-walkthrough')) && (
          <Link href="/ui-walkthrough" className={isActive('/ui-walkthrough') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            UI Walkthrough
          </Link>
        )}

        <Link href="/history" className={pathname === '/history' ? 'active' : ''}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9l4-4 4 4 4-6 4 6" />
            <circle cx="8.5" cy="13.5" r="1.5" />
          </svg>
          History
        </Link>

        {userRole === 'admin' && (
          <Link href="/tba" className={isActive('/tba') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 3 3.8 6 3.8 9s-1.3 6-3.8 9c-2.5-3-3.8-6-3.8-9s1.3-6 3.8-9z" />
            </svg>
            Tools
          </Link>
        )}

        {userRole === 'admin' && (
          <Link href="/users" className={isActive('/users') ? 'active' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              <path d="M16 3.13a4 4 0 010 7.75" /><path d="M21 21v-2a4 4 0 00-3-3.85" />
            </svg>
            Admin Panel
          </Link>
        )}
      </nav>

      {user && (
        <div className="user-section">
          <div className="user-avatar">
            {user.user_metadata?.avatar_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.user_metadata.avatar_url} alt="" loading="lazy" />
            )}
          </div>
          <div className="user-details">
            <div className="user-name">{user.user_metadata?.full_name || user.email}</div>
            <div className="user-role">{userRole === 'admin' ? 'Admin' : userBrandName || 'Brand User'}</div>
          </div>
          <button className="signout-btn" onClick={handleSignOut} title="Sign out">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  )
}
