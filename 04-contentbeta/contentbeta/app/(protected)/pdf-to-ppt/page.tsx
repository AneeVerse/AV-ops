'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { PptTemplateSlide } from '@/components/PptTemplateRenderer'
import { compileDeck } from '@/lib/ppt/layout-compiler'
import { buildTokens } from '@/lib/ppt/design-tokens'
import { exportToPptx } from '@/lib/ppt/pptx-exporter'
import type { DeckPlan, RenderPlan, BrandTokens, SlideSpec, SlideRole } from '@/lib/ppt/types'
import { PPT_SLIDE_TEMPLATES } from '@/lib/ppt/slide-templates'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Brand { id: string; name: string }

interface BrandProfile {
  style_prompt?: string   // general brand guidelines — contains hex colors
  ppt_md?: string         // PPT-specific guidelines
  brand_scrap?: string
  ppt_font_heading?: string
  ppt_font_heading_url?: string
  ppt_font_body?: string
  ppt_font_body_url?: string
  infographic_logo_light_url?: string
  infographic_logo_dark_url?: string
  logo_url?: string
}

// Sum of R+G+B channels (0–765)
function lum(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  return ((n >> 16) & 0xff) + ((n >> 8) & 0xff) + (n & 0xff)
}

// Extract brand palette from style_prompt text
function paletteFromStylePrompt(text: string): Record<string, string> {
  if (!text) return {}
  const allHex = Array.from(new Set(text.match(/#[0-9a-fA-F]{6}\b/g) ?? []))
  if (!allHex.length) return {}

  // Primary: hex on a line containing "primary" keyword
  const primaryLine = text.match(/primary[^#\n]{0,40}(#[0-9a-fA-F]{6})/i)
  const primary = primaryLine?.[1] ?? allHex[0]

  // Dark: first near-black (lum < 60)
  const dark = allHex.find(h => lum(h) < 60) ?? '#1a1a1a'

  // Light: lightest that isn't pure white, for slide backgrounds
  const light = allHex.find(h => h !== '#FFFFFF' && lum(h) > 500) ?? '#F5F5F5'

  // Accent: first mid-lum color that isn't primary/dark/light/white/black
  const accent = allHex.find(h => {
    if ([primary, dark, light, '#FFFFFF', '#000000'].includes(h)) return false
    const l = lum(h)
    return l > 60 && l < 500
  }) ?? primary

  // Fonts: "Headline: FontName bold/semibold" or "Heading font: FontName"
  const headingFont =
    text.match(/headline[:\s]+([A-Za-z][A-Za-z\s]{1,25}?)(?:bold|semibold|regular|,|;|\n)/i)?.[1]?.trim() ??
    text.match(/heading\s*font[:\s]+([A-Za-z][A-Za-z\s]{2,25}?)(?:,|;|\n|$)/i)?.[1]?.trim() ?? null

  const bodyFont =
    text.match(/\bbody[:\s]+([A-Za-z][A-Za-z\s]{1,25}?)(?:bold|semibold|regular|,|;|\n)/i)?.[1]?.trim() ??
    text.match(/body\s*font[:\s]+([A-Za-z][A-Za-z\s]{2,25}?)(?:,|;|\n|$)/i)?.[1]?.trim() ?? null

  return {
    primary_color: primary,
    accent_color:  accent,
    dark_color:    dark,
    light_color:   light,
    ...(headingFont ? { heading_font: headingFont } : {}),
    ...(bodyFont    ? { body_font:    bodyFont    } : {}),
  }
}

type Step = 'upload' | 'planning' | 'review' | 'imaging' | 'compiling' | 'done'

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function PdfToPptPage() {
  const { userRole, userBrandId, userBrandName, userAllowedPages, userEmail } = useAuth()
  const router = useRouter()
  // Non-admin users on this page always have exactly one (their own) brand pre-selected.
  const isSingleBrandUser = userRole !== 'admin'

  useEffect(() => {
    if (userRole === null) return
    if (userRole !== 'admin' && !userAllowedPages.includes('pdf-to-ppt')) router.replace('/generate')
  }, [userRole, userAllowedPages, router])

  // Brand / upload state
  const [brands,          setBrands]         = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId]= useState('')
  const [brandProfile,    setBrandProfile]   = useState<BrandProfile | null>(null)
  const [layoutOverrides, setLayoutOverrides]= useState<Record<string, unknown>>({})
  const [pdfFile,         setPdfFile]        = useState<File | null>(null)
  const [logoUrl,         setLogoUrl]        = useState<string | null>(null)
  const [logoDarkUrl,     setLogoDarkUrl]    = useState<string | null>(null)
  const [dragOver,        setDragOver]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pipeline state
  const [step,            setStep]           = useState<Step>('upload')
  const [error,           setError]          = useState<string | null>(null)
  const [deckPlan,        setDeckPlan]       = useState<DeckPlan | null>(null)
  const [renderPlans,     setRenderPlans]    = useState<RenderPlan[] | null>(null)
  const [compileProgress, setCompileProgress]= useState(0)
  const [tokens,          setTokens]         = useState<BrandTokens | null>(null)
  const [activeSlide,     setActiveSlide]    = useState(0)
  const [downloading,     setDownloading]    = useState(false)
  const [savedJobId,      setSavedJobId]     = useState<string | null>(null)
  const [previewOpen,     setPreviewOpen]    = useState(false)
  const [reviewSlideIdx,  setReviewSlideIdx] = useState<number | null>(null)
  const [changedSlides,   setChangedSlides]  = useState<Set<number>>(new Set())
  const [regenSlides,     setRegenSlides]    = useState<Set<number>>(new Set())
  const [imageTasks,      setImageTasks]     = useState<{ label: string; status: 'pending' | 'done' | 'error' }[]>([])

  // Load brands
  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
    } else if (userBrandId && userBrandName) {
      setBrands([{ id: userBrandId, name: userBrandName }])
      setSelectedBrandId(userBrandId)
    }
  }, [userRole, userBrandId, userBrandName])

  // Load brand profile — split into two queries so missing ppt_font_* columns
  // (before SQL migration runs) don't kill the core color/guidelines fetch
  useEffect(() => {
    setBrandProfile(null); setLogoUrl(null); setLogoDarkUrl(null); setLayoutOverrides({})
    if (!selectedBrandId) return
    async function load() {
      const { data: core } = await sb.from('brand_profiles')
        .select('style_prompt,ppt_md,brand_scrap,infographic_logo_light_url,infographic_logo_dark_url,logo_url')
        .eq('brand_id', selectedBrandId).single()
      const { data: fonts } = await sb.from('brand_profiles')
        .select('ppt_font_heading,ppt_font_heading_url,ppt_font_body,ppt_font_body_url')
        .eq('brand_id', selectedBrandId).single()
      if (core) {
        setBrandProfile({ ...core, ...(fonts ?? {}) })
        setLogoUrl(core.infographic_logo_light_url || core.logo_url || null)
        setLogoDarkUrl(core.infographic_logo_dark_url || null)
      }
      // Load per-template layout overrides via API (anon client blocked by RLS on this table)
      try {
        const tmplRes = await authedFetch(`/api/ppt-slide-templates?brandId=${selectedBrandId}`)
        if (tmplRes.ok) {
          const rows = await tmplRes.json() as { template_name: string; layout_config?: string | unknown }[]
          if (Array.isArray(rows)) {
            const overrides: Record<string, unknown> = {}
            for (const t of rows) {
              if (t.layout_config) {
                // layout_config may be a string (text col) or already-parsed object (jsonb col)
                overrides[t.template_name] = typeof t.layout_config === 'string'
                  ? JSON.parse(t.layout_config)
                  : t.layout_config
              }
            }
            setLayoutOverrides(overrides)
          }
        }
      } catch { /* ignore — no overrides means default layouts are used */ }
    }
    load()
  }, [selectedBrandId])

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const count = renderPlans?.length ?? 0
      if (!count) return
      if (e.key === 'ArrowLeft')  setActiveSlide(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setActiveSlide(i => Math.min(count - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const brandCtx = useCallback(() => ({
    brandName:       brands.find(b => b.id === selectedBrandId)?.name || '',
    brandGuidelines: brandProfile?.ppt_md || brandProfile?.style_prompt || '',
    brandScrap:      brandProfile?.brand_scrap || '',
    brandPalette:    paletteFromStylePrompt(brandProfile?.style_prompt || ''),
  }), [brands, selectedBrandId, brandProfile])

  function handleFile(file: File) {
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return }
    setPdfFile(file); setError(null)
  }

  // ── Main pipeline ──────────────────────────────────────────────────────────
  async function runPlan() {
    if (!selectedBrandId) { setError(isSingleBrandUser ? 'Still loading your brand — try again in a moment.' : 'Select a brand and choose a PDF.'); return }
    if (!pdfFile) { setError('Choose a PDF to continue.'); return }
    setStep('planning'); setError(null); setActiveSlide(0)
    setDeckPlan(null); setRenderPlans(null); setCompileProgress(0)

    try {
      // 1. Upload PDF to ImageKit (bypasses Vercel's 4.5MB body limit)
      const ctx = brandCtx()
      const fileName = `${Date.now()}_${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const uploaded = await uploadMedia(pdfFile, {
        folder: `generated-posts/ppt-uploads/${selectedBrandId}`,
        fileName,
      })
      const storagePath = uploaded.filePath

      // 2. Send path to plan route (small JSON payload — no PDF bytes through Vercel)
      const res = await authedFetch('/api/pdf-to-ppt/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, brandId: selectedBrandId, brandName: ctx.brandName }),
      })
      const text = await res.text()
      let data: { title?: string; slides?: SlideSpec[]; error?: string }
      try { data = JSON.parse(text) } catch {
        throw new Error(`Plan failed (${res.status}) — server returned non-JSON response.`)
      }
      if (!res.ok) throw new Error(data.error || 'Plan failed')

      const plan: DeckPlan = { title: data.title || ctx.brandName, slides: data.slides || [] }
      if (plan.slides.length === 0) throw new Error('No slides could be extracted from this PDF.')
      setDeckPlan(plan)

      // 2. Build tokens and store — generation runs after user reviews the plan
      const tokenPalette = { ...ctx.brandPalette }
      if (brandProfile?.ppt_font_heading) tokenPalette.heading_font = brandProfile.ppt_font_heading
      if (brandProfile?.ppt_font_body)    tokenPalette.body_font    = brandProfile.ppt_font_body
      const isTruckstop = ctx.brandName.toLowerCase() === 'truckstop'
      const decorationUrl = isTruckstop ? '/truckmark-pattern.svg' : null
      const builtTokens = buildTokens(tokenPalette, logoUrl, decorationUrl, logoDarkUrl)
      setTokens(builtTokens)
      setStep('review')
    } catch (err) {
      setError((err as Error).message)
      setStep('upload')
    }
  }

  // ── Proceed from review → generate images → compile ───────────────────────
  async function proceedToGenerate() {
    if (!deckPlan || !tokens) return
    setError(null)
    try {
      setStep('imaging')
      const builtTokens = tokens

      const imageSlides = deckPlan.slides
        .filter((s): s is typeof s & { imagePrompt: string } => !!(s as any).imagePrompt)
        .slice(0, 4)
      const chartSlides = deckPlan.slides.filter(s => s.role === 'chart_bar')

      const CHART_W = Math.round(12.23 * 144)
      const CHART_H = Math.round(4.85 * 144)
      const chartPalette = [builtTokens.primary, builtTokens.accent, builtTokens.dark, '#747875', '#d9dddd']

      // Initialise task list for progress display
      const tasks: { label: string; status: 'pending' | 'done' | 'error' }[] = [
        ...imageSlides.map(sl => ({ label: `Image — ${(sl as any).title ?? sl.id}`, status: 'pending' as const })),
        ...chartSlides.map(sl => ({ label: `Chart — ${(sl as any).title ?? sl.id}`, status: 'pending' as const })),
      ]
      setImageTasks([...tasks])

      const tickTask = (i: number, status: 'done' | 'error') => {
        tasks[i].status = status
        setImageTasks([...tasks])
      }

      await Promise.all([
        ...imageSlides.map(async (slide, ti) => {
          try {
            const prompt = (slide as any).imagePrompt as string
            const res = await authedFetch('/api/pdf-to-ppt/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, slideId: slide.id, brandId: selectedBrandId }),
            })
            if (res.ok) {
              const { url } = await res.json() as { url: string }
              if (slide.role === 'cover_hero') (slide as any).heroImageUrl = url
              else if (slide.role === 'image_body') (slide as any).imageUrl = url
              tickTask(ti, 'done')
            } else {
              const errBody = await res.json().catch(() => ({})) as { error?: string }
              console.error('[PPT image] generation failed:', res.status, errBody.error)
              tickTask(ti, 'error')
            }
          } catch (e) { console.error('[PPT image] network error:', e); tickTask(ti, 'error') }
        }),
        ...chartSlides.map(async (slide, ci) => {
          const ti = imageSlides.length + ci
          try {
            const s = slide as any
            const body = {
              type: 'bar',
              title: s.title ?? '',
              categories: s.categories ?? [],
              values: s.values ?? [],
              unitSuffix: s.unitSuffix,
              primaryColor: builtTokens.primary,
              accentColors: chartPalette.slice(1),
              textColor: builtTokens.dark,
              bgColor: builtTokens.light,
              w: CHART_W, h: CHART_H,
            }
            const res = await authedFetch('/api/pdf-to-ppt/generate-chart', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            if (res.ok) {
              const { svgCode } = await res.json() as { svgCode: string }
              if (svgCode) s.svgCode = svgCode
            }
            tickTask(ti, 'done')
          } catch (e) { console.error('[PPT chart] network error:', e); tickTask(ti, 'error') }
        }),
      ])

      const failedImages = tasks.filter(t => t.status === 'error').length
      if (failedImages > 0) {
        setError(`${failedImages} image${failedImages > 1 ? 's' : ''} failed to generate — those slides will be missing images.`)
      }

      const loadFont = async (role: 'heading' | 'body', name: string, url: string): Promise<void> => {
        if (url.includes('fonts.googleapis.com') || url.endsWith('.css')) {
          const linkId = `ppt-font-link-${role}`
          let link = document.getElementById(linkId) as HTMLLinkElement | null
          if (!link) { link = document.createElement('link') as HTMLLinkElement; link.rel = 'stylesheet'; link.id = linkId; document.head.appendChild(link) }
          if (link.href !== url) { link.href = url; await new Promise<void>(res => { link!.onload = () => res(); link!.onerror = () => res() }) }
          try { await document.fonts.load(`400 48px "${name}"`) } catch { /* best-effort */ }
          return
        }
        const styleId = `ppt-font-${role}`
        let style = document.getElementById(styleId) as HTMLStyleElement | null
        if (!style) { style = document.createElement('style') as HTMLStyleElement; style.id = styleId; document.head.appendChild(style) }
        style.textContent = `@font-face { font-family: '${name}'; src: url('${url}'); font-display: block; }`
        try { await Promise.all([document.fonts.load(`400 48px "${name}"`), document.fonts.load(`700 48px "${name}"`)]) }
        catch (e) { console.warn(`[PPT] ${role} font load failed for "${name}":`, e) }
      }
      const fontLoads: Promise<void>[] = []
      if (brandProfile?.ppt_font_heading && brandProfile?.ppt_font_heading_url)
        fontLoads.push(loadFont('heading', brandProfile.ppt_font_heading, brandProfile.ppt_font_heading_url))
      if (brandProfile?.ppt_font_body && brandProfile?.ppt_font_body_url)
        fontLoads.push(loadFont('body', brandProfile.ppt_font_body, brandProfile.ppt_font_body_url))
      if (fontLoads.length) await Promise.all(fontLoads)

      setStep('compiling')
      const plans = await compileDeck(deckPlan.slides, builtTokens, (done, total) => {
        setCompileProgress(Math.round((done / total) * 100))
      }, layoutOverrides as Record<string, import('@/lib/ppt/layout-schema').JsonSlideLayout>)

      // Warn about slides whose required data fields are empty
      const emptySlides = deckPlan.slides
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s, i) => ({ s: s as any, n: i + 1 }))
        .filter(({ s }) => {
          if (s.role === 'kpi_grid')   return !Array.isArray(s.kpis)    || s.kpis.length    === 0
          if (s.role === 'comparison') return !Array.isArray(s.leftItems) || s.leftItems.length === 0
          if (s.role === 'two_column') return !Array.isArray(s.leftItems) || s.leftItems.length === 0
          if (s.role === 'timeline')   return !Array.isArray(s.steps)    || s.steps.length    === 0
          if (s.role === 'bullets')    return !Array.isArray(s.bullets)   || s.bullets.length  === 0
          if (s.role === 'agenda')     return !Array.isArray(s.items)     || s.items.length    === 0
          return false
        })
        .map(({ n }) => n)

      if (emptySlides.length > 0) {
        const prev = failedImages > 0 ? `${failedImages} image${failedImages > 1 ? 's' : ''} also failed. ` : ''
        setError(`${prev}Slide${emptySlides.length > 1 ? 's' : ''} ${emptySlides.join(', ')} appear empty — the AI may have used unexpected field names. Review and regenerate if needed.`)
      }

      setRenderPlans(plans)
      setStep('done')
      saveJob(deckPlan, plans).catch(() => {/* non-fatal */})
    } catch (err) {
      setError((err as Error).message)
      setStep('review')
    }
  }

  // ── Regenerate a single slide for a new template ──────────────────────────
  async function regenSlide(idx: number) {
    if (!deckPlan) return
    const slide = deckPlan.slides[idx]
    setRegenSlides(prev => new Set(prev).add(idx))
    try {
      const res = await authedFetch('/api/pdf-to-ppt/regen-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRole: slide.role,
          originalSlide: slide,
          deckTitle: deckPlan.title,
          brandId: selectedBrandId,
          allSlides: deckPlan.slides,
        }),
      })
      const json = await res.json() as { slide?: Record<string, unknown>; error?: string }
      if (json.error) throw new Error(json.error)
      if (json.slide) {
        setDeckPlan(prev => {
          if (!prev) return prev
          const slides = prev.slides.map((s, i) =>
            i === idx ? { ...json.slide, id: s.id, sequence: s.sequence, role: s.role } as SlideSpec : s
          ) as SlideSpec[]
          return { ...prev, slides }
        })
        setChangedSlides(prev => { const n = new Set(prev); n.delete(idx); return n })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRegenSlides(prev => { const n = new Set(prev); n.delete(idx); return n })
    }
  }

  // ── Save / History ─────────────────────────────────────────────────────────
  async function saveJob(plan: DeckPlan, plans: RenderPlan[]) {
    if (!selectedBrandId) return
    const { brandName, brandPalette } = brandCtx()
    const jobId = crypto.randomUUID()
    try {
      const res = await authedFetch('/api/ppt-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          brandId: selectedBrandId,
          brandName,
          title: plan.title,
          theme: brandPalette,
          slides: plans,
          slideCount: plans.length,
          userEmail: userEmail ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        console.error('[saveJob] failed:', err.error)
        return
      }
      setSavedJobId(jobId)
    } catch (err) {
      console.error('[saveJob] network error:', err)
    }
  }

  // ── PDF export: server renders the deck with a real headless browser (Puppeteer)
  // and prints it via Chromium's own page.pdf(), reusing the exact same PptTemplateSlide
  // component the editor renders — no separate client-side rendering path (html2canvas)
  // left to drift out of sync with what the app actually shows.
  async function handleDownloadPdf() {
    if (!renderPlans || !deckPlan || downloading) return
    setDownloading(true)
    try {
      const res = await authedFetch('/api/pdf-to-ppt/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plans: renderPlans,
          title: deckPlan.title,
          fonts: {
            heading: brandProfile?.ppt_font_heading && brandProfile?.ppt_font_heading_url
              ? { name: brandProfile.ppt_font_heading, url: brandProfile.ppt_font_heading_url } : undefined,
            body: brandProfile?.ppt_font_body && brandProfile?.ppt_font_body_url
              ? { name: brandProfile.ppt_font_body, url: brandProfile.ppt_font_body_url } : undefined,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        console.error('[PDF export] failed:', res.status, err.error)
        setError('PDF export failed. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deckPlan.title.replace(/[^a-z0-9\s]/gi, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[PDF export] network error:', err)
      setError('PDF export failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // ── Download ───────────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!renderPlans || !deckPlan) return
    setDownloading(true)
    try {
      await exportToPptx(renderPlans, deckPlan.title)
    } catch (err) { setError('PPTX failed: ' + (err as Error).message) }
    finally { setDownloading(false) }
  }

  // ── Sidebar steps ──────────────────────────────────────────────────────────
  const STEPS: [Step | Step[], string, string][] = [
    ['upload',                      '1', 'Upload'],
    [['planning'],                  '2', 'AI Plan'],
    [['review'],                    '3', 'Review'],
    [['imaging'],                   '4', 'Generate Images'],
    [['compiling', 'done'],         '5', 'Compile & Export'],
  ]
  const stepOrder: Step[] = ['upload', 'planning', 'review', 'imaging', 'compiling', 'done']
  function stepStatus(keys: Step | Step[]): 'active' | 'done' | 'pending' {
    const arr = Array.isArray(keys) ? keys : [keys]
    if (arr.includes(step)) return 'active'
    const curIdx = stepOrder.indexOf(step)
    const minIdx = Math.min(...arr.map(k => stepOrder.indexOf(k)))
    return curIdx > minIdx ? 'done' : 'pending'
  }

  const slideCount = renderPlans?.length ?? 0
  const curPlan    = renderPlans?.[activeSlide] ?? null

  // Suppress unused warning for tokens (used in slide role display)
  void tokens

  if (userRole !== 'admin' && userBrandName?.toLowerCase() !== 'truckstop') return null

  return (
    <>
    <div style={{ display: 'flex', gap: 0, minHeight: '80vh' }}>

      {/* ── Left Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0, paddingRight: 28,
        borderRight: '1px solid var(--border)', marginRight: 36,
      }}>
        {STEPS.map(([keys, num, label], si) => {
          const st = stepStatus(keys)
          const isLast = si === STEPS.length - 1
          return (
            <div key={label} style={{ display: 'flex', gap: 12 }}>
              {/* Track column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: st === 'active' ? 'var(--primary,#6366f1)'
                    : st === 'done' ? 'var(--primary,#6366f1)'
                    : 'var(--surface)',
                  color: st === 'pending' ? 'var(--muted)' : '#fff',
                  border: st === 'pending' ? '2px solid var(--border)' : '2px solid var(--primary,#6366f1)',
                  boxShadow: st === 'active' ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {st === 'done' ? '✓' : num}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 20, margin: '4px 0',
                    background: st === 'done' ? 'var(--primary,#6366f1)' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
              {/* Label */}
              <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 20 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: st === 'active' ? 600 : 400,
                  color: st === 'pending' ? 'var(--muted)' : st === 'active' ? 'var(--text)' : 'var(--text)',
                  opacity: st === 'pending' ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}>{label}</div>
                {st === 'active' && (
                  <div style={{ fontSize: 11, color: 'var(--primary,#6366f1)', marginTop: 1, fontWeight: 500 }}>
                    In progress…
                  </div>
                )}
                {st === 'done' && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Done</div>
                )}
              </div>
            </div>
          )
        })}

        {step === 'done' && (
          <div style={{ marginTop: 8 }}>
            <button onClick={handleDownload} disabled={downloading}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 8,
                background: 'var(--primary,#6366f1)', color: '#fff',
                fontSize: 13, fontWeight: 600, border: 'none',
                cursor: downloading ? 'not-allowed' : 'pointer',
                opacity: downloading ? 0.7 : 1,
              }}>
              {downloading ? 'Building…' : '↓ Download PPTX'}
            </button>
            {savedJobId && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#22c55e', textAlign: 'center', fontWeight: 500 }}>
                ✓ Saved to history
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* ══ STEP: Upload ══════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <div className="form-card" style={{ maxWidth: 560 }}>
            <h2>Generate Presentation</h2>

            {!isSingleBrandUser && (
              <div className="form-group">
                <label>Brand</label>
                <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}>
                  <option value="">Select a brand…</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>PDF Document</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--primary,#6366f1)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(99,102,241,0.06)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {pdfFile ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{pdfFile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{(pdfFile.size / 1024).toFixed(0)} KB · click to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>⬆</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Drop PDF here or click to upload</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Any size — uploaded directly to storage</div>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>{error}</div>}

            <button className="generate-btn" style={{ width: '100%' }}
              onClick={runPlan} disabled={!pdfFile || !selectedBrandId}>
              Generate Presentation
            </button>
          </div>
        )}

        {/* ══ STEP: Planning ════════════════════════════════════════════════ */}
        {step === 'planning' && (
          <PlanningSkeletonView />
        )}

        {/* ══ STEP: Review ══════════════════════════════════════════════════ */}
        {step === 'review' && deckPlan && (
          <div style={{ width: '100%', maxWidth: 720 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{deckPlan.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                {deckPlan.slides.length} slides · Click any slide to see full content · Change template then regenerate if needed
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
              {deckPlan.slides.map((slide, idx) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const s = slide as any
                const title: string = s.title ?? s.quote ?? ''
                const preview = (() => {
                  switch (slide.role) {
                    case 'bullets':          return (s.bullets as string[] | undefined)?.slice(0, 2).join(' · ') ?? ''
                    case 'agenda':           return (s.items as string[] | undefined)?.slice(0, 2).join(' · ') ?? ''
                    case 'two_column':       return [s.leftHeading, s.rightHeading].filter(Boolean).join(' vs ')
                    case 'stat_callout':     return s.stat ? `${s.stat} — ${s.statLabel ?? ''}` : ''
                    case 'kpi_grid':         return (s.kpis as {value:string;label:string}[] | undefined)?.slice(0, 3).map((k: {value:string;label:string}) => `${k.value} ${k.label}`).join(' · ') ?? ''
                    case 'image_body':       return s.body ?? s.imagePrompt ?? ''
                    case 'quote_attribution':return s.quote ?? ''
                    case 'timeline':         return (s.steps as {label:string}[] | undefined)?.map((st: {label:string}) => st.label).join(' → ') ?? ''
                    case 'comparison':       return [s.leftHeading, s.rightHeading].filter(Boolean).join(' vs ')
                    case 'chart_bar':        return (s.categories as string[] | undefined)?.join(', ') ?? ''
                    case 'chart_doughnut':   return (s.segments as {label:string}[] | undefined)?.map((sg: {label:string}) => sg.label).join(', ') ?? ''
                    default:                 return s.subtitle ?? s.tagline ?? ''
                  }
                })()
                const roleLabel = (slide.role as string).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                const isChanged = changedSlides.has(idx)
                const isRegen = regenSlides.has(idx)

                return (
                  <div key={slide.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr auto',
                    gap: '0 12px',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${isChanged ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                    background: isChanged ? 'rgba(99,102,241,0.03)' : 'var(--surface)',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                    {/* Number */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: isChanged ? 'var(--primary,#6366f1)' : 'var(--bg)',
                      border: isChanged ? 'none' : '1.5px solid var(--border)',
                      color: isChanged ? '#fff' : 'var(--muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      transition: 'all 0.15s',
                    }}>{idx + 1}</div>

                    {/* Content (clickable) */}
                    <div onClick={() => setReviewSlideIdx(idx)} style={{ cursor: 'pointer', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {title || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No title</span>}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, flexShrink: 0,
                          background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)',
                        }}>{roleLabel}</span>
                      </div>
                      {preview && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preview}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <select
                        value={slide.role}
                        onChange={e => {
                          const newRole = e.target.value as SlideRole
                          setDeckPlan(prev => {
                            if (!prev) return prev
                            const slides = prev.slides.map((sl, i) => i === idx ? { ...sl, role: newRole } : sl) as SlideSpec[]
                            return { ...prev, slides }
                          })
                          setChangedSlides(prev => new Set(prev).add(idx))
                        }}
                        style={{
                          fontSize: 11, padding: '4px 6px', borderRadius: 6,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          color: 'var(--text)', maxWidth: 140,
                        }}
                      >
                        {PPT_SLIDE_TEMPLATES.map(t => (
                          <option key={t.name} value={t.name}>
                            {t.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </option>
                        ))}
                      </select>

                      {isChanged && (
                        <button
                          onClick={() => regenSlide(idx)}
                          disabled={isRegen}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                            border: 'none', background: 'var(--primary,#6366f1)', color: '#fff',
                            cursor: isRegen ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap', opacity: isRegen ? 0.65 : 1,
                          }}
                        >
                          {isRegen ? '…' : '↺ Regen'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>{error}</div>}

            <button className="generate-btn" style={{ width: '100%' }} onClick={proceedToGenerate}>
              Generate Presentation →
            </button>
          </div>
        )}

        {/* ══ STEP: Imaging ═════════════════════════════════════════════════ */}
        {step === 'imaging' && deckPlan && (
          <ImagingSkeletonView tasks={imageTasks} />
        )}

        {/* ══ STEP: Compiling ═══════════════════════════════════════════════ */}
        {step === 'compiling' && deckPlan && (
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Compiling slides…</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                {deckPlan.slides.length} slides · Building layouts
              </p>
            </div>
            <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, marginBottom: 8 }} />
            <div style={{ marginTop: 16, padding: '0 2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Compiling slide {Math.max(1, Math.ceil(compileProgress / 100 * deckPlan.slides.length))} of {deckPlan.slides.length}…
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: 36, textAlign: 'right' }}>{compileProgress}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'var(--primary,#6366f1)', width: `${compileProgress}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP: Done ════════════════════════════════════════════════════ */}
        {step === 'done' && renderPlans && deckPlan && (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Thumbnail strip (left column) */}
            <div style={{ width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '75vh' }}>
              {renderPlans.map((plan, i) => (
                <button key={plan.slideId} onClick={() => setActiveSlide(i)}
                  style={{
                    width: '100%', aspectRatio: '16/9', borderRadius: 4, overflow: 'hidden',
                    border: i === activeSlide ? '2px solid var(--primary,#6366f1)' : '2px solid var(--border)',
                    background: plan.background, cursor: 'pointer', padding: 0, flexShrink: 0,
                    position: 'relative',
                  }}>
                  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                    <PptTemplateSlide plan={plan} borderRadius={0} />
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 2, right: 3,
                    fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    zIndex: 10,
                  }}>{i + 1}</div>
                </button>
              ))}
            </div>

            {/* Main canvas */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{deckPlan.title}</h2>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                    {slideCount} slides · Ready to download
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleDownloadPdf} disabled={downloading}
                    className="generate-btn"
                    style={{ width: 'auto', padding: '8px 20px', opacity: downloading ? 0.7 : 1, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                    {downloading ? 'Generating…' : '↓ PDF'}
                  </button>
                  <button onClick={handleDownload} disabled={downloading}
                    className="generate-btn"
                    style={{ width: 'auto', padding: '8px 20px', opacity: downloading ? 0.7 : 1 }}>
                    {downloading ? 'Building…' : '↓ PPTX'}
                  </button>
                </div>
              </div>

              {error && <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>{error}</div>}

              {curPlan && (
                <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => setPreviewOpen(true)}>
                  <PptTemplateSlide plan={curPlan} />
                  <NavArrow dir="left"  disabled={activeSlide === 0}             onClick={() => setActiveSlide(i => i - 1)} />
                  <NavArrow dir="right" disabled={activeSlide === slideCount - 1} onClick={() => setActiveSlide(i => i + 1)} />
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
                {activeSlide + 1} / {slideCount}
                {deckPlan.slides[activeSlide] && (
                  <> · <span style={{ color: 'var(--primary,#6366f1)' }}>{deckPlan.slides[activeSlide].role}</span></>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

    {/* ── Slide content preview modal (review step) ── */}
    {reviewSlideIdx !== null && deckPlan && (() => {
      const slide = deckPlan.slides[reviewSlideIdx]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = slide as any
      const roleLabel = (slide.role as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

      const Field = ({ label, value }: { label: string; value?: string | null }) =>
        value ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{value}</div>
          </div>
        ) : null

      const List = ({ label, items }: { label: string; items?: string[] | null }) =>
        items?.length ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {items.map((item, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{item}</li>)}
            </ul>
          </div>
        ) : null

      const content = (() => {
        switch (slide.role) {
          case 'cover_hero': return (<>
            <Field label="Title" value={s.title} /><Field label="Subtitle" value={s.subtitle} />
            <Field label="Tagline" value={s.tagline} /><Field label="Date" value={s.date} />
            <Field label="Image prompt" value={s.imagePrompt} />
          </>)
          case 'section_divider': return (<>
            <Field label="Section number" value={s.sectionNumber} />
            <Field label="Title" value={s.title} /><Field label="Subtitle" value={s.subtitle} />
          </>)
          case 'agenda': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <List label="Items" items={s.items} />
          </>)
          case 'bullets': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Subtitle" value={s.subtitle} /><List label="Bullets" items={s.bullets} />
          </>)
          case 'two_column': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Left heading" value={s.leftHeading} /><List label="Left bullets" items={s.leftBullets} />
            <Field label="Right heading" value={s.rightHeading} /><List label="Right bullets" items={s.rightBullets} />
          </>)
          case 'stat_callout': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Stat" value={s.stat} /><Field label="Stat label" value={s.statLabel} />
            <Field label="Body" value={s.body} />
          </>)
          case 'kpi_grid': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            {(s.kpis as {value:string;label:string;sublabel?:string}[] | undefined)?.map((k, i) => (
              <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{k.value}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>{k.label}</span>
                {k.sublabel && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>· {k.sublabel}</span>}
              </div>
            ))}
          </>)
          case 'image_body': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Body" value={s.body} /><Field label="Image position" value={s.imagePosition} />
            <Field label="Image prompt" value={s.imagePrompt} />
          </>)
          case 'quote_attribution': return (<>
            <Field label="Quote" value={s.quote} /><Field label="Attribution" value={s.attribution} />
            <Field label="Role / title" value={s.role_title} />
          </>)
          case 'timeline': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            {(s.steps as {number:string;label:string;description?:string}[] | undefined)?.map((st, i) => (
              <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{st.number}. {st.label}</span>
                {st.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{st.description}</div>}
              </div>
            ))}
          </>)
          case 'comparison': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Left heading" value={s.leftHeading} /><List label="Left items" items={s.leftItems} />
            <Field label="Right heading" value={s.rightHeading} /><List label="Right items" items={s.rightItems} />
          </>)
          case 'closing_cta': return (<>
            <Field label="Title" value={s.title} /><Field label="Subtitle" value={s.subtitle} />
            <Field label="CTA" value={s.cta} />
          </>)
          case 'chart_bar': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Series name" value={s.seriesName} /><Field label="Unit suffix" value={s.unitSuffix} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Data</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(s.categories as string[] | undefined)?.map((cat: string, i: number) => (
                  <div key={i} style={{ padding: '5px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{s.values?.[i]}{s.unitSuffix ?? ''}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)
          case 'chart_doughnut': return (<>
            <Field label="Eyebrow" value={s.eyebrow} /><Field label="Title" value={s.title} />
            <Field label="Center value" value={s.centerValue} /><Field label="Center label" value={s.centerLabel} />
            <Field label="Insight" value={s.insight} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Segments</div>
              {(s.segments as {label:string;value:number}[] | undefined)?.map((seg: {label:string;value:number}, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                  <span>{seg.label}</span><span style={{ fontWeight: 600 }}>{seg.value}</span>
                </div>
              ))}
            </div>
          </>)
          default: return <Field label="Title" value={s.title} />
        }
      })()

      return (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setReviewSlideIdx(null)}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{reviewSlideIdx + 1}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: 'var(--primary,#6366f1)' }}>{roleLabel}</span>
                </div>
              </div>
              <button onClick={() => setReviewSlideIdx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)', lineHeight: 1 }}>✕</button>
            </div>
            {content}
            {s.speakerNotes && <Field label="Speaker notes" value={s.speakerNotes} />}
          </div>
        </div>
      )
    })()}

    {/* ── Fullscreen preview modal ── */}
    {previewOpen && renderPlans && (
      <FullscreenPreview
        plans={renderPlans}
        initialSlide={activeSlide}
        onClose={() => setPreviewOpen(false)}
      />
    )}
    </>
  )
}

// ─── Fullscreen preview ───────────────────────────────────────────────────────
function FullscreenPreview({ plans, initialSlide, onClose }: {
  plans: RenderPlan[]
  initialSlide: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialSlide)
  const total = plans.length

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  setIdx(i => Math.min(total - 1, i + 1))
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    setIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Slide */}
      <div
        style={{ width: '88vw', maxWidth: 1280 }}
        onClick={e => e.stopPropagation()}
      >
        <PptTemplateSlide plan={plans[idx]} borderRadius={6} />
      </div>

      {/* Controls */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', fontSize: 18, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.35 : 1 }}
        >‹</button>

        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, minWidth: 70, textAlign: 'center' }}>
          {idx + 1} / {total}
        </span>

        <button
          onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
          disabled={idx === total - 1}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', fontSize: 18, cursor: idx === total - 1 ? 'not-allowed' : 'pointer', opacity: idx === total - 1 ? 0.35 : 1 }}
        >›</button>

        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 14px', fontSize: 13, cursor: 'pointer', marginLeft: 8 }}
        >✕ Close</button>
      </div>

      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 10 }}>
        ← → arrow keys to navigate · Esc to close
      </div>
    </div>
  )
}

// ─── Imaging skeleton ─────────────────────────────────────────────────────────
function ImagingSkeletonView({ tasks }: { tasks: { label: string; status: 'pending' | 'done' | 'error' }[] }) {
  const [fakePct, setFakePct] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      setFakePct(Math.round(85 * (1 - Math.exp(-elapsed / 30))))
    }, 600)
    return () => clearInterval(id)
  }, [])

  const total    = tasks.length
  const done     = tasks.filter(t => t.status === 'done' || t.status === 'error').length
  const realPct  = total > 0 ? Math.round((done / total) * 100) : 0
  const pct      = Math.max(fakePct, realPct)
  const active   = tasks.find(t => t.status === 'pending')
  const msg      = active ? `Generating ${active.label}…` : total === 0 ? 'Preparing visuals…' : 'Finishing up…'

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, opacity: 0.4 }}>Generating visuals…</h2>
      </div>
      <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
        {Array.from({ length: Math.max(total, 6) }).map((_, i) => (
          <div key={i} className="skeleton" style={{ flexShrink: 0, width: 72, height: 40, borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '0 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: 36, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.6s ease' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Planning skeleton ────────────────────────────────────────────────────────
const PLANNING_MESSAGES = [
  'Reading your PDF…',
  'Analyzing content structure…',
  'Planning slide roles…',
  'Building deck outline…',
  'Almost there…',
]

function PlanningSkeletonView() {
  const [msgIdx, setMsgIdx] = useState(0)
  const [pct,    setPct]    = useState(0)

  useEffect(() => {
    const start = Date.now()
    const msg  = setInterval(() => setMsgIdx(i => (i + 1) % PLANNING_MESSAGES.length), 4000)
    const prog = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      // Asymptotic curve: approaches 90% over ~60s
      const p = Math.round(90 * (1 - Math.exp(-elapsed / 40)))
      setPct(p)
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [])

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, opacity: 0.4 }}>Planning your deck…</h2>
      </div>
      <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ flexShrink: 0, width: 72, height: 40, borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '0 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{PLANNING_MESSAGES[msgIdx]}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
        </div>
      </div>
    </div>
  )
}

function NavArrow({ dir, disabled, onClick }: {
  dir: 'left' | 'right'; disabled: boolean; onClick: () => void
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} disabled={disabled} style={{
      position: 'absolute', [dir]: -16,
      top: '50%', transform: 'translateY(-50%)',
      width: 32, height: 32, borderRadius: '50%',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      color: 'currentColor',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    }}>
      <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}
