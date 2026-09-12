'use client'
import { createContext, useContext, useState, useRef, ReactNode } from 'react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { authedFetch } from '@/lib/authed-fetch'

interface BrokerGenerationState {
  generating: boolean
  imageUrl: string | null
  error: string | null
  startGeneration: (extraPrompt: string) => Promise<void>
  clearImage: () => void
}

const BrokerGenerationContext = createContext<BrokerGenerationState | null>(null)

export function BrokerGenerationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startTimeRef = useRef<number>(0)

  async function brokerCall(extraPrompt: string, startTime: number): Promise<{ imageUrl: string }> {
    let url: string | null = null
    try {
      const res = await authedFetch('/api/generate-broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraPrompt: extraPrompt.trim(), createdByEmail: user?.email ?? null }),
      })
      const text = await res.text()
      let data: { imageUrl?: string; output_url?: string } | Array<{ imageUrl?: string; output_url?: string }>
      try { data = JSON.parse(text) } catch { data = {} }
      const item = Array.isArray(data) ? data[0] : data
      url = item?.imageUrl || item?.output_url || null
    } catch {
      // Webhook timed out — fall through to polling
    }

    if (url) {
      if (extraPrompt.trim()) {
        await sb.from('generated_posts')
          .update({ headline: extraPrompt.trim().substring(0, 255) })
          .eq('output_url', url)
      }
      return { imageUrl: url }
    }

    // Poll DB for up to 3 minutes
    const deadline = startTime + 3 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000))
      const { data: posts } = await sb
        .from('generated_posts')
        .select('output_url, headline')
        .eq('is_broker', true)
        .gte('created_at', new Date(startTime - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
      if (posts?.length && posts[0].output_url) {
        if (extraPrompt.trim() && !posts[0].headline) {
          await sb.from('generated_posts')
            .update({ headline: extraPrompt.trim().substring(0, 255) })
            .eq('output_url', posts[0].output_url)
        }
        return { imageUrl: posts[0].output_url }
      }
    }
    throw new Error('Image generation timed out')
  }

  async function startGeneration(extraPrompt: string): Promise<void> {
    const startTime = Date.now()
    startTimeRef.current = startTime
    setGenerating(true)
    setImageUrl(null)
    setError(null)

    try {
      const result = await brokerCall(extraPrompt, startTime)
      setImageUrl(result.imageUrl)
      if (user?.email) {
        await sb.from('generated_posts').update({ created_by_email: user.email }).eq('output_url', result.imageUrl)
      }
    } catch (err) {
      setError((err as Error).message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function clearImage() {
    setImageUrl(null)
    setError(null)
  }

  return (
    <BrokerGenerationContext.Provider value={{ generating, imageUrl, error, startGeneration, clearImage }}>
      {children}
    </BrokerGenerationContext.Provider>
  )
}

export function useBrokerGeneration() {
  const ctx = useContext(BrokerGenerationContext)
  if (!ctx) throw new Error('useBrokerGeneration must be used within BrokerGenerationProvider')
  return ctx
}
