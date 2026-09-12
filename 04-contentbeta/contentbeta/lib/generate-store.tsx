'use client'
import { createContext, useContext, useState, useRef, ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CtaConfig {
  text: string; bgColor: string; textColor: string
  fontSize: number; paddingX: number; paddingY: number
  borderRadius: number; x: number; y: number
  fontFamily?: string | null
}

export interface RenderParams {
  headline: string; microcopy: string; logoUrl: string; bgImageDataUrl: string
  cta: CtaConfig | null; textPosition: { x: number; y: number } | null
  headlineSize: number; microcopySize: number
  logoX?: number | null; logoY?: number | null
  headlineX?: number | null; headlineY?: number | null
  microcopyX?: number | null; microcopyY?: number | null
  headlineLines?: string[] | null; microcopyLines?: string[] | null
  logoPosition?: string; logoSize?: number; padding?: number; verticalAlign?: string
  [key: string]: unknown
}

export type GenerationResult =
  | { status: 'fulfilled'; value: { imageUrl: string } }
  | { status: 'rejected'; reason: { message?: string } | string }

export interface SlideState {
  pngUrl: string | null; baseParams: RenderParams | null; editParams: RenderParams | null
  iframeHtml: string | null; iframeLoading: boolean
}

export const emptySlide = (): SlideState => ({
  pngUrl: null, baseParams: null, editParams: null, iframeHtml: null, iframeLoading: false,
})

// ── Store interface ───────────────────────────────────────────────────────────

interface GenerateStore {
  // Form
  mode: 'ai' | 'puppeteer'
  setMode: (v: 'ai' | 'puppeteer') => void
  selectedBrandId: string
  setSelectedBrandId: (v: string) => void
  headline: string
  setHeadline: (v: string) => void
  microcopy: string
  setMicrocopy: (v: string) => void
  cta: string
  setCta: (v: string) => void
  selectedCatId: string
  setSelectedCatId: (v: string) => void

  // AI mode
  generating: boolean
  setGenerating: (v: boolean) => void
  aiResults: GenerationResult[] | null
  setAiResults: (v: GenerationResult[] | null) => void

  // Puppeteer mode
  slides: [SlideState, SlideState]
  setSlides: (v: [SlideState, SlideState] | ((prev: [SlideState, SlideState]) => [SlideState, SlideState])) => void
  activeIdx: 0 | 1 | null
  setActiveIdx: (v: 0 | 1 | null) => void
  puppeteerLoading: boolean
  setPuppeteerLoading: (v: boolean) => void

  // Shared
  error: string | null
  setError: (v: string | null) => void

  // Debounce ref (shared so it persists across re-renders)
  refetchDebounce: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  // Generation start time (persists across navigation so progress bar doesn't reset)
  generationStartTime: number | null
  setGenerationStartTime: (v: number | null) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const GenerateStoreContext = createContext<GenerateStore | null>(null)

export function GenerateStoreProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'ai' | 'puppeteer'>('ai')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [headline, setHeadline] = useState('')
  const [microcopy, setMicrocopy] = useState('')
  const [cta, setCta] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiResults, setAiResults] = useState<GenerationResult[] | null>(null)
  const [slides, setSlides] = useState<[SlideState, SlideState]>([emptySlide(), emptySlide()])
  const [activeIdx, setActiveIdx] = useState<0 | 1 | null>(null)
  const [puppeteerLoading, setPuppeteerLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const refetchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <GenerateStoreContext.Provider value={{
      mode, setMode,
      selectedBrandId, setSelectedBrandId,
      headline, setHeadline,
      microcopy, setMicrocopy,
      cta, setCta,
      selectedCatId, setSelectedCatId,
      generating, setGenerating,
      aiResults, setAiResults,
      slides, setSlides,
      activeIdx, setActiveIdx,
      puppeteerLoading, setPuppeteerLoading,
      error, setError,
      refetchDebounce,
      generationStartTime, setGenerationStartTime,
    }}>
      {children}
    </GenerateStoreContext.Provider>
  )
}

export function useGenerateStore() {
  const ctx = useContext(GenerateStoreContext)
  if (!ctx) throw new Error('useGenerateStore must be used inside GenerateStoreProvider')
  return ctx
}
