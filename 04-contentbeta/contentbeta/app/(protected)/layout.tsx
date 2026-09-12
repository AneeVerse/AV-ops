'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'
import { GenerateStoreProvider } from '@/lib/generate-store'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, accessDenied } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login' + (accessDenied ? '?error=access_denied' : ''))
    }
  }, [loading, user, accessDenied, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--muted)', fontSize: '14px' }}>
        Loading…
      </div>
    )
  }

  if (!user) return null

  return (
    <GenerateStoreProvider>
      <div className="app-shell">
        <Sidebar />
        <main>{children}</main>
      </div>
    </GenerateStoreProvider>
  )
}
