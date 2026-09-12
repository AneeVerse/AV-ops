'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function RootPage() {
  const { user, userRole, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (userRole === 'admin') {
      router.replace('/brands')
    } else {
      router.replace('/generate')
    }
  }, [loading, user, userRole, router])

  return null
}

