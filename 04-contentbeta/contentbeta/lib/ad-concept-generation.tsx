'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { authedFetch } from '@/lib/authed-fetch'

interface PuppeteerConfig {
  logoPosition?: string
  logoSize?: number
  logoX?: number | null
  logoY?: number | null
  padding?: number
  elements?: Array<{ dataUrl: string; x: number; y: number; width: number; opacity: number; zIndex: number }>
}

type ConceptResult =
  | { status: 'fulfilled'; value: { imageUrl: string; supabaseUrl: string; visualReferenceUrl: string } }
  | { status: 'rejected'; reason: string }

interface AdConceptGenerationState {
  generating: boolean
  results: ConceptResult[] | null
  selectedBrandId: string
  selectedAngleId: string
  setSelectedBrandId: (id: string) => void
  setSelectedAngleId: (id: string) => void
  startGeneration: (brandId: string, adAngleId: string, userEmail?: string | null) => Promise<void>
  updateResultUrl: (idx: number, newUrl: string) => void
  clearResults: () => void
}

const AdConceptGenerationContext = createContext<AdConceptGenerationState | null>(null)

interface N8nResult {
  imageUrl: string
  visualReferenceUrl: string
  puppeteerConfig: PuppeteerConfig | null
  logoUrl: string | null
}

async function callN8n(payload: object): Promise<N8nResult> {
  const res = await authedFetch('/api/ad-concept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('Non-JSON: ' + text) }
  const data = (Array.isArray(parsed) ? parsed[0] : parsed) as {
    imageUrl?: string
    visualReferenceUrl?: string
    puppeteerConfig?: PuppeteerConfig
    logoUrl?: string
  }
  if (!data?.imageUrl) throw new Error('No imageUrl in response: ' + text)
  return {
    imageUrl: data.imageUrl,
    visualReferenceUrl: data.visualReferenceUrl || '',
    puppeteerConfig: data.puppeteerConfig || null,
    logoUrl: data.logoUrl || null,
  }
}

async function applyPuppeteerOverlay(
  bgImageUrl: string,
  _logoUrl: string | null,
  puppeteerConfig: PuppeteerConfig | null,
): Promise<{ blobUrl: string; blob: Blob }> {
  const res = await fetch('/api/test-render-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      headline: '',
      microcopy: '',
      bgImageDataUrl: bgImageUrl,
      logoUrl: '',
      logoPosition: puppeteerConfig?.logoPosition || 'bottom-left',
      logoSize: puppeteerConfig?.logoSize || 48,
      logoX: puppeteerConfig?.logoX ?? null,
      logoY: puppeteerConfig?.logoY ?? null,
      padding: puppeteerConfig?.padding || 40,
      elements: [],
      hideText: true,
    }),
  })
  if (!res.ok) throw new Error('Puppeteer overlay failed')
  const blob = await res.blob()
  return { blobUrl: URL.createObjectURL(blob), blob }
}

async function saveToHistory(blob: Blob, brandId: string, adAngleId: string, userEmail?: string | null): Promise<string> {
  const uploaded = await uploadMedia(blob, {
    folder: `generated-posts/${brandId}`,
    fileName: `${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  })
  const publicUrl = uploaded.url
  await Promise.all([
    sb.from('generated_posts').insert({
      brand_id: brandId,
      output_url: publicUrl,
      is_ad_concept: true,
      ...(userEmail ? { created_by_email: userEmail } : {}),
    }),
    sb.from('ad_concepts').insert({
      brand_id: brandId,
      ad_angle_id: adAngleId,
      output_url: publicUrl,
    }),
  ])
  return publicUrl
}

export function AdConceptGenerationProvider({ children }: { children: ReactNode }) {
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<ConceptResult[] | null>(null)
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedAngleId, setSelectedAngleId] = useState('')

  async function startGeneration(brandId: string, adAngleId: string, userEmail?: string | null) {
    setGenerating(true)
    setResults(null)

    const payload = { brandId, adAngleId }
    const n8nSettled = await Promise.allSettled([callN8n(payload), callN8n(payload)])

    const overlaySettled = await Promise.allSettled(
      n8nSettled.map(async r => {
        if (r.status === 'rejected') throw r.reason
        const { imageUrl, visualReferenceUrl, puppeteerConfig, logoUrl } = r.value
        const { blobUrl, blob } = await applyPuppeteerOverlay(imageUrl, logoUrl, puppeteerConfig)
        const supabaseUrl = await saveToHistory(blob, brandId, adAngleId, userEmail).catch(() => '')
        return { imageUrl: blobUrl, supabaseUrl, visualReferenceUrl }
      })
    )

    await new Promise(r => setTimeout(r, 800))

    const mapped: ConceptResult[] = overlaySettled.map(r =>
      r.status === 'fulfilled'
        ? { status: 'fulfilled', value: r.value }
        : { status: 'rejected', reason: r.reason instanceof Error ? r.reason.message : String(r.reason) }
    )
    setResults(mapped)
    setGenerating(false)
  }

  function updateResultUrl(idx: number, newUrl: string) {
    setResults(prev => {
      if (!prev) return prev
      const next = [...prev]
      const r = next[idx]
      if (r.status === 'fulfilled') {
        next[idx] = { status: 'fulfilled', value: { ...r.value, imageUrl: newUrl } }
      }
      return next
    })
  }

  function clearResults() { setResults(null) }

  return (
    <AdConceptGenerationContext.Provider value={{
      generating, results,
      selectedBrandId, selectedAngleId,
      setSelectedBrandId, setSelectedAngleId,
      startGeneration, updateResultUrl, clearResults,
    }}>
      {children}
    </AdConceptGenerationContext.Provider>
  )
}

export function useAdConceptGeneration() {
  const ctx = useContext(AdConceptGenerationContext)
  if (!ctx) throw new Error('useAdConceptGeneration must be within AdConceptGenerationProvider')
  return ctx
}
