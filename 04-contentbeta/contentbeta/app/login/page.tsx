'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { sb } from '@/lib/supabase'
import { Suspense } from 'react'

function LoginContent() {
  const { user, loading } = useAuth()
  const { isLight, toggleTheme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
    const err = searchParams.get('error')
    if (err === 'access_denied') {
      setError('Access denied. Contact your admin to get access.')
    }
  }, [loading, user, router, searchParams])

  const logoSrc = isLight ? '/CB New Logo Black.png' : '/CB New logo White Just Text (1).png'

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError('')
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function handleEmailSignIn() {
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setEmailLoading(true)
    setError('')
    const { error: authError } = await sb.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setEmailLoading(false)
    }
    // on success, onAuthStateChange fires and resolveUser runs, then root page redirects
  }

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {isLight ? (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          )}
        </button>
      </div>

      <div className="login-card">
        <div className="login-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="ContentBeta" style={{ height: '64px', width: '220px', objectFit: 'contain' }} />
        </div>
        <h2>Welcome back</h2>
        <p>Sign in to access your workspace</p>

        <button className="google-btn" onClick={handleGoogleSignIn} disabled={googleLoading}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
        </button>

        <div className="login-divider">or</div>

        <input
          className="login-input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <div style={{ position: 'relative' }}>
          <input
            className="login-input"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            ref={passwordRef}
            onKeyDown={e => { if (e.key === 'Enter') handleEmailSignIn() }}
            style={{ paddingRight: '40px', marginBottom: 0 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        <button className="login-submit" onClick={handleEmailSignIn} disabled={emailLoading}>
          {emailLoading ? 'Signing in…' : 'Sign in'}
        </button>

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
