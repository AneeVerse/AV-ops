'use client'
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { sb } from './supabase'

export type UserRole = 'admin' | 'user' | null

export interface AuthContextType {
  user: User | null
  userRole: UserRole
  userBrandId: string | null
  userBrandName: string | null
  userAllowedPages: string[]
  userEmail: string | null
  userTokens: number | null
  loading: boolean
  accessDenied: boolean
  signOut: () => Promise<void>
  deductTokens: (count: number) => Promise<void>
  refreshTokens: () => Promise<void>
  setUserTokens: (n: number | null) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [userBrandId, setUserBrandId] = useState<string | null>(null)
  const [userBrandName, setUserBrandName] = useState<string | null>(null)
  const [userAllowedPages, setUserAllowedPages] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userTokens, setUserTokens] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const initialized = useRef(false)

  async function resolveUser(u: User) {
    const email = u.email!

    const { data: adminData } = await sb.from('admins').select('id').eq('email', email).limit(1).maybeSingle()

    if (adminData) {
      setUser(u)
      setUserRole('admin')
      setUserEmail(email)
      setLoading(false)
      if (typeof window !== 'undefined') {
        window.$crisp?.push(['do', 'chat:show'])
      }
      return
    }

    const { data: userData } = await sb
      .from('users')
      .select('brand_id, tokens, brands(name)')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (userData) {
      const { data: accessRows } = await sb
        .from('brand_page_access')
        .select('page_key')
        .eq('brand_id', userData.brand_id)

      setUser(u)
      setUserRole('user')
      setUserBrandId(userData.brand_id)
      setUserBrandName((userData.brands as unknown as { name: string } | null)?.name ?? null)
      setUserAllowedPages((accessRows || []).map(r => r.page_key))
      setUserEmail(email)
      setUserTokens(userData.tokens ?? 0)
      setLoading(false)
      if (typeof window !== 'undefined') {
        window.$crisp?.push(['do', 'chat:show'])
      }
      return
    }

    // No access
    initialized.current = false
    setAccessDenied(true)
    await sb.auth.signOut()
    setLoading(false)
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session && !initialized.current) {
        initialized.current = true
        resolveUser(session.user)
      }
      // Don't set loading=false here when no session — onAuthStateChange handles it
      // to avoid a race where getSession returns empty before the OAuth redirect completes
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !initialized.current) {
        initialized.current = true
        resolveUser(session.user)
      } else if (event === 'INITIAL_SESSION' && !session) {
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        initialized.current = false
        setUser(null)
        setUserRole(null)
        setUserBrandId(null)
        setUserBrandName(null)
        setUserAllowedPages([])
        setUserEmail(null)
        setUserTokens(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await sb.auth.signOut()
    if (typeof window !== 'undefined') {
      window.$crisp?.push(['do', 'chat:hide'])
    }
  }

  async function deductTokens(count: number) {
    const newTokens = Math.max(0, (userTokens ?? 0) - count)
    setUserTokens(newTokens)
    await sb.from('users').update({ tokens: newTokens }).eq('email', userEmail!)
  }

  async function refreshTokens() {
    if (!userEmail) return
    const { data } = await sb.from('users').select('tokens').eq('email', userEmail).limit(1).maybeSingle()
    setUserTokens(data?.tokens ?? null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        userBrandId,
        userBrandName,
        userAllowedPages,
        userEmail,
        userTokens,
        loading,
        accessDenied,
        signOut,
        deductTokens,
        refreshTokens,
        setUserTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
