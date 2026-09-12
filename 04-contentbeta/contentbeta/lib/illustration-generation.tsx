'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { authedFetch } from '@/lib/authed-fetch'

interface IllustrationGenerationState {
  generating: boolean
  imageUrls: string[]
  error: string | null
  startGeneration: (brandId: string, context: string, layout1Id: string, layout2Id: string) => Promise<void>
  clearImages: () => void
}

const IllustrationGenerationContext = createContext<IllustrationGenerationState | null>(null)

export function IllustrationGenerationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function illustrationCall(brandId: string, context: string, layout1Id: string, layout2Id: string, startTime: number): Promise<{ imageUrls: string[] }> {
    let urls: string[] = []
    try {
      const callOne = (layoutId: string) =>
        authedFetch('/api/generate-illustrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, context: context.trim(), layoutId }),
        }).then(r => r.json().catch(() => ({}))).catch(() => ({}))

      const [data1, data2] = await Promise.all([callOne(layout1Id), callOne(layout2Id)])

      const extractUrl = (d: unknown): string => {
        const obj = d as { imageUrl?: string; output_url?: string }
        return obj?.imageUrl || obj?.output_url || ''
      }
      const url1 = extractUrl(data1)
      const url2 = extractUrl(data2)
      urls = [url1, url2].filter(Boolean)
    } catch {
      // Webhook timed out — fall through to polling
    }

    if (urls.length > 0) return { imageUrls: urls }

    // Poll DB for up to 3 minutes (same pattern as broker)
    const deadline = startTime + 3 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000))
      const { data: posts } = await sb
        .from('generated_posts')
        .select('output_url')
        .eq('is_illustration', true)
        .gte('created_at', new Date(startTime - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(2)
      if (posts?.length) {
        return { imageUrls: (posts as { output_url: string }[]).map(p => p.output_url).filter(Boolean) }
      }
    }
    throw new Error('Image generation timed out')
  }

  async function startGeneration(brandId: string, context: string, layout1Id: string, layout2Id: string): Promise<void> {
    const startTime = Date.now()
    setGenerating(true)
    setImageUrls([])
    setError(null)

    try {
      const result = await illustrationCall(brandId, context, layout1Id, layout2Id, startTime)
      setImageUrls(result.imageUrls)
      if (user?.email) {
        await Promise.all(
          result.imageUrls.map(url =>
            sb.from('generated_posts').update({ created_by_email: user.email }).eq('output_url', url)
          )
        )
      }
    } catch (err) {
      setError((err as Error).message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function clearImages() {
    setImageUrls([])
    setError(null)
  }

  return (
    <IllustrationGenerationContext.Provider value={{ generating, imageUrls, error, startGeneration, clearImages }}>
      {children}
    </IllustrationGenerationContext.Provider>
  )
}

export function useIllustrationGeneration() {
  const ctx = useContext(IllustrationGenerationContext)
  if (!ctx) throw new Error('useIllustrationGeneration must be used within IllustrationGenerationProvider')
  return ctx
}
