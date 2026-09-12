'use client'
import { authedFetch } from '@/lib/authed-fetch'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { sanitizeInfographicCode, drawBrandLogoOverlay, isSyntacticallyValidCode } from '@/lib/infographic-render'

const RemotionPreview = dynamic(() => import('@/components/RemotionPreview'), { ssr: false })

const INFOGRAPHIC_MESSAGES = [
  'Reading ad copy…',
  'Analysing brand guidelines…',
  'Selecting layout reference…',
  'Planning visual composition…',
  'Writing canvas code…',
  'Structuring animation logic…',
  'Applying brand colours…',
  'Finalising infographic…',
  'Almost there…',
]

const ANIMATE_MESSAGES = [
  'Analysing infographic…',
  'Planning animation sequence…',
  'Building frame-by-frame logic…',
  'Timing element entrances…',
  'Finalising motion…',
]

const ANALYSE_MESSAGES = [
  'Reading your copy…',
  'Identifying message angle…',
  'Matching creative direction…',
  'Almost ready…',
]

const INFOGRAPHIC_CURVE: [number, number][] = [[0,0],[20,35],[45,55],[80,70],[120,82],[160,90],[185,96]]
const ANIMATE_CURVE: [number, number][] = [[0,0],[10,40],[20,68],[30,84],[40,92]]
const ANALYSE_CURVE: [number, number][] = [[0,0],[2,50],[5,80],[9,95]]

const MESSAGE_FOCUS_OPTIONS = [
  { id: 'stat_lead', label: 'Data Insight / Stat Lead', description: 'Built around a key number, percentage, or metric' },
  { id: 'pain_point', label: 'Address Pain Point', description: 'Calls out a problem the audience faces' },
  { id: 'solution', label: 'Solution Capability', description: 'Highlights what the product/service does or enables' },
  { id: 'proof', label: 'Proof / Trust Signal', description: 'Uses testimonials, case studies, awards, or social proof' },
  { id: 'education', label: 'Education / How It Works', description: 'Explains a process, concept, or framework' },
]

const CREATIVE_HOOK_OPTIONS = [
  { id: 'hero_stat', label: 'Hero Stat', description: 'One giant number dominates the visual' },
  { id: 'multi_stat', label: 'Multi-Stat Grid', description: '2–4 stats in a card grid layout' },
  { id: 'headline_lead', label: 'Bold Headline Lead', description: 'Large typographic statement, minimal other elements' },
  { id: 'data_viz', label: 'Data Visualisation', description: 'Chart, bar, progress ring, or graph as the centrepiece' },
  { id: 'process_flow', label: 'Step / Process Flow', description: 'Sequential steps or timeline structure' },
]

function interpolatePct(elapsed: number, curve: [number, number][]): number {
  for (let i = 1; i < curve.length; i++) {
    const [t0, p0] = curve[i - 1]
    const [t1, p1] = curve[i]
    if (elapsed <= t1) return p0 + (p1 - p0) * (elapsed - t0) / (t1 - t0)
  }
  return curve[curve.length - 1][1]
}

function GeneratingOverlay({ messages, startTime, curve }: { messages: string[]; startTime: number; curve: [number, number][] }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const msg = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 4000)
    const prog = setInterval(() => {
      setPct(Math.round(interpolatePct((Date.now() - startTime) / 1000, curve)))
    }, 800)
    return () => { clearInterval(msg); clearInterval(prog) }
  }, [messages, startTime, curve])
  return (
    <div style={{ padding: '14px 0 2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{messages[msgIdx]}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary,#6366f1)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: 'var(--primary,#6366f1)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

function OptionChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        border: `1px solid ${selected ? 'var(--primary,#6366f1)' : 'var(--border)'}`,
        background: selected ? 'var(--primary,#6366f1)' : 'transparent',
        color: selected ? '#fff' : 'var(--muted)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

interface Brand { id: string; name: string }
interface LayoutRef { id: string; name: string; image_url: string | null; description: string | null; logo_url: string | null }

export default function InfographicGeneratorPage() {
  const { userRole, userBrandId, userBrandName, userAllowedPages } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (userRole === null) return
    const isAllowed = userAllowedPages.includes('infographic-generator')
    if (userRole !== 'admin' && !isAllowed) router.replace('/generate')
  }, [userRole, userAllowedPages, router])

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [adCopy, setAdCopy] = useState('')
  const [layoutRefs, setLayoutRefs] = useState<LayoutRef[]>([])
  const [selectedLayoutRefId, setSelectedLayoutRefId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [layoutRefUsed, setLayoutRefUsed] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const [animationStartTime, setAnimationStartTime] = useState<number | null>(null)
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null)
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null)
  const [brandFonts, setBrandFonts] = useState<Array<{name: string; url: string}>>([])

  // Analysis / direction state
  const [analysing, setAnalysing] = useState(false)
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null)
  const [showSelection, setShowSelection] = useState(false)
  const [selectedMessageFocus, setSelectedMessageFocus] = useState<string[]>([])
  const [selectedCreativeHook, setSelectedCreativeHook] = useState<string[]>([])

  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>('light')

  // Animation state
  const [animating, setAnimating] = useState(false)
  const [animatedCode, setAnimatedCode] = useState('')
  const [downloadingVideo, setDownloadingVideo] = useState(false)
  const [currentPostId, setCurrentPostId] = useState<string | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<'mp4' | 'mov' | 'gif' | 'webm'>('mp4')

  // Edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [editing, setEditing] = useState(false)
  const [originalCode, setOriginalCode] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logoImageLightRef = useRef<HTMLImageElement | null>(null)
  const logoImageDarkRef = useRef<HTMLImageElement | null>(null)
  const adCopyRef = useRef(adCopy)

  useEffect(() => { adCopyRef.current = adCopy }, [adCopy])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Clear selection if copy is edited after analysis
  useEffect(() => {
    if (showSelection) {
      setShowSelection(false)
      setSelectedMessageFocus([])
      setSelectedCreativeHook([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adCopy])

  useEffect(() => {
    if (userRole === 'admin') {
      sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
    } else if (userBrandId && userBrandName) {
      setBrands([{ id: userBrandId, name: userBrandName }])
      setSelectedBrandId(userBrandId)
    }
  }, [userRole, userBrandId, userBrandName])

  // Load brand logos (light + dark), fonts, and layout refs whenever brand changes
  useEffect(() => {
    logoImageLightRef.current = null
    logoImageDarkRef.current = null
    setLogoLightUrl(null)
    setLogoDarkUrl(null)
    setBrandFonts([])
    setLayoutRefs([])
    setSelectedLayoutRefId('')
    if (!selectedBrandId) return
    sb.from('brand_profiles')
      .select('infographic_logo_light_url,infographic_logo_dark_url,infographic_font_heading,infographic_font_heading_url,infographic_font_body,infographic_font_body_url')
      .eq('brand_id', selectedBrandId).single()
      .then(async ({ data }) => {
        const lightUrl = data?.infographic_logo_light_url || null
        const darkUrl = data?.infographic_logo_dark_url || null
        setLogoLightUrl(lightUrl)
        setLogoDarkUrl(darkUrl)
        if (lightUrl) {
          const img = new Image(); img.crossOrigin = 'anonymous'
          img.onload = () => { logoImageLightRef.current = img }
          img.src = lightUrl
        }
        if (darkUrl) {
          const img = new Image(); img.crossOrigin = 'anonymous'
          img.onload = () => { logoImageDarkRef.current = img }
          img.src = darkUrl
        }
        // Load brand fonts so canvas ctx.font calls resolve correctly
        const loadFont = async (name: string, url: string) => {
          if (!name || !url) return
          try {
            if (url.includes('fonts.googleapis.com')) {
              const id = `gf-${name.replace(/\s+/g, '-')}`
              if (!document.getElementById(id)) {
                const link = document.createElement('link')
                link.id = id; link.rel = 'stylesheet'; link.href = url
                document.head.appendChild(link)
              }
              await document.fonts.ready
            } else {
              const face = new FontFace(name, `url(${url})`, { weight: '100 900', style: 'normal' })
              await face.load()
              document.fonts.add(face)
            }
          } catch { /* font load failure is non-fatal */ }
        }
        const fontDefs = [
          { name: data?.infographic_font_heading || '', url: data?.infographic_font_heading_url || '' },
          { name: data?.infographic_font_body || '', url: data?.infographic_font_body_url || '' },
        ].filter(f => f.name && f.url)
        setBrandFonts(fontDefs)
        await Promise.all(fontDefs.map(f => loadFont(f.name, f.url)))
      })
    sb.from('infographic_layouts').select('id,name,image_url,description,logo_url').eq('brand_id', selectedBrandId).eq('is_active', true).order('name')
      .then(({ data, error }) => {
        if (error) { console.error('infographic_layouts fetch error:', error); setError('Could not load layouts: ' + error.message); return }
        setLayoutRefs(data || [])
      })
  }, [selectedBrandId])

  // Stop animation on unmount
  useEffect(() => () => stopAnimation(), [])

  // Render static frame when code is ready or theme toggles
  useEffect(() => {
    if (generatedCode && canvasRef.current) {
      const t = setTimeout(() => renderStaticFrame(generatedCode), 50)
      return () => { clearTimeout(t); stopAnimation() }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedCode, selectedTheme])

  async function handleAnalyse() {
    if (!selectedBrandId || !adCopy.trim()) { setError('Please select a brand and enter ad copy.'); return }
    setAnalysing(true)
    setAnalysisStartTime(Date.now())
    setError(null)
    setShowSelection(false)
    setSelectedMessageFocus([])
    setSelectedCreativeHook([])
    try {
    const res = await authedFetch('/api/infographic-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adCopy: adCopy.trim(), brandId: selectedBrandId }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`Analysis error: ${text}`)
      const data = JSON.parse(text)
      const result = Array.isArray(data) ? data[0] : data
      setSelectedMessageFocus(result.messageFocus || [])
      setSelectedCreativeHook(result.creativeHook || [])
      setShowSelection(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAnalysing(false)
      setAnalysisStartTime(null)
    }
  }

  function toggleMessageFocus(id: string) {
    setSelectedMessageFocus(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  function toggleCreativeHook(id: string) {
    setSelectedCreativeHook(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  async function handleGenerate() {
    if (!selectedBrandId || !adCopy.trim()) { setError('Please select a brand and enter ad copy.'); return }

    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    setShowSelection(false)
    setGenerating(true)
    setGenerationStartTime(Date.now())
    setError(null)
    setGeneratedCode('')
    setOriginalCode('')
    setLayoutRefUsed('')
    setAnimatedCode('')
    setCurrentPostId(null)
    stopAnimation()

    const jobId = `inf_${Date.now()}_${selectedBrandId}`

  let workflowFinished = false

  void authedFetch('/api/infographic-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: selectedBrandId,
        adCopy: adCopy.trim(),
        layoutReferenceId: selectedLayoutRefId || null,
        messageFocus: selectedMessageFocus,
        creativeHook: selectedCreativeHook,
        jobId,
      }),
  })
    .then(async (res) => {
      const text = await res.text()
      if (res.ok) return

      let message = text || `Generation workflow failed (${res.status}).`
      try {
        const payload = JSON.parse(text) as { error?: unknown }
        if (typeof payload.error === 'string' && payload.error) message = payload.error
      } catch {
        // Keep the response body when the workflow returned non-JSON error text.
      }
      throw new Error(message)
    })
    .catch((err: unknown) => {
      if (workflowFinished) return
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      setGenerating(false)
      setGenerationStartTime(null)
      setError(err instanceof Error ? err.message : 'Could not start infographic generation.')
    })

    const start = Date.now()
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await sb
          .from('infographic_jobs')
          .select('js_code,layout_ref_used')
          .eq('id', jobId)
          .maybeSingle()

      if (data?.js_code) {
        workflowFinished = true
        clearInterval(pollRef.current!)
          pollRef.current = null
          setGenerating(false)
          setGenerationStartTime(null)
          if (!isSyntacticallyValidCode(sanitizeInfographicCode(data.js_code), 'drawGraphic')) {
            setError('The generator produced invalid code for this ad copy. Please try generating again.')
            return
          }
          setLayoutRefUsed(data.layout_ref_used || '')
          setGeneratedCode(data.js_code)
          setOriginalCode(data.js_code)
          return
        }
      } catch { /* ignore poll errors */ }

      if (Date.now() - start > 15 * 60 * 1000) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setGenerating(false)
        setGenerationStartTime(null)
          setError('The workflow did not create an infographic in time. Check the latest n8n execution, then retry once.')
      }
    }, 5000)
  }

  const sanitizeCode = sanitizeInfographicCode

  function renderStaticFrame(code: string) {
    stopAnimation()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const clean = sanitizeCode(code)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const logoImg = selectedTheme === 'dark' ? logoImageDarkRef.current : logoImageLightRef.current
    const opts = { progress: 1.0, frame: 149, fps: 30, durationInFrames: 150, adCopy: String(adCopyRef.current ?? ''), theme: selectedTheme }
    try {
      const trimmed = clean.trimStart()
      if (trimmed.startsWith('(') || trimmed.startsWith('async ') || (trimmed.includes('=>') && !trimmed.startsWith('function'))) {
        // Arrow function expression style: ({ ctx, width, height, logoImg, options }) => { ... }
        const drawFn = new Function(`return (${clean})`)() as ((p: object) => void) | null
        if (typeof drawFn === 'function') drawFn({ ctx, width: canvas.width, height: canvas.height, logoImg: null, options: opts })
      } else {
        // Named function declaration style: function drawGraphic(ctx, ...) { ... }
        const fn = new Function('ctx', 'width', 'height', 'logoImg', 'options',
          `${clean}\nif(typeof drawGraphic==='function')drawGraphic(ctx,width,height,logoImg,options);`) as (...args: unknown[]) => void
        fn(ctx, canvas.width, canvas.height, null, opts)
      }
      drawBrandLogoOverlay(ctx, logoImg, canvas.width, canvas.height)
    } catch (err) {
      setError('Render error: ' + (err as Error).message)
    }
  }

  function stopAnimation() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }

  async function handleEdit() {
    if (!generatedCode || !editInstruction.trim()) return
    setEditing(true)
    try {
      const res = await authedFetch('/api/infographic-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: generatedCode, instruction: editInstruction.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Edit failed')
      if (data.jsCode) {
        if (!isSyntacticallyValidCode(sanitizeInfographicCode(data.jsCode), 'drawGraphic')) {
          throw new Error('The edit produced invalid code. Please try rephrasing the instruction.')
        }
        setGeneratedCode(data.jsCode)
        setAnimatedCode('')
        setEditInstruction('')
        setEditOpen(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEditing(false)
    }
  }

  async function handleAnimate() {
    if (!generatedCode) return
    setAnimating(true)
    setAnimationStartTime(Date.now())
    setError(null)
    setAnimatedCode('')

    try {
      const res = await authedFetch('/api/infographic-animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsCode: generatedCode, adCopy: adCopyRef.current ?? '', infographicId: null, theme: selectedTheme }),
      })

      const text = await res.text()
      if (!res.ok) throw new Error(`n8n error: ${text}`)
      const data = JSON.parse(text) as { animatedCode?: string; animationExplanation?: string }[] | { animatedCode?: string; animationExplanation?: string }
      const result = Array.isArray(data) ? data[0] : data
      if (!result?.animatedCode) throw new Error('No animatedCode in response')
      if (!isSyntacticallyValidCode(result.animatedCode, 'drawFrame')) {
        throw new Error('The animation service returned invalid code. Please try animating again.')
      }
      setAnimatedCode(result.animatedCode)

      // Save animated infographic to history then auto-record video
      let savedPostId: string | null = null
      try {
        const headline = adCopyRef.current.trim().split('\n')[0].replace(/^Headline:\s*/i, '').trim().substring(0, 100)
        const { data: { session } } = await sb.auth.getSession()
        const creatorEmail = session?.user?.email ?? null
        const { data: postData } = await sb.from('generated_posts').insert({
          brand_id: selectedBrandId,
          output_url: '',
          headline,
          is_infographic: true,
          remotion_code: result.animatedCode,
          infographic_theme: selectedTheme,
          ...(creatorEmail ? { created_by_email: creatorEmail } : {}),
        }).select('id').single()
        if (postData) { savedPostId = postData.id; setCurrentPostId(postData.id) }
      } catch (e) { console.error('[infographic] animate save failed:', e) }

      // Auto-download video and save animated_url to history
      setDownloadingVideo(true)
      try {
        const logoUrl = selectedTheme === 'dark' ? logoDarkUrl : logoLightUrl
        let logoImg: HTMLImageElement | null = null
        if (logoUrl) {
          logoImg = await new Promise(resolve => {
            const img = new Image(); img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = logoUrl
          })
        }
        await recordVideo(result.animatedCode, logoImg, selectedBrandId, savedPostId, false)
      } catch (e) {
        console.error('[infographic] auto video failed:', e)
        setError('Animation created, but recording the preview video failed: ' + (e as Error).message + '. Use the Download Video button to retry.')
      }
      finally { setDownloadingVideo(false) }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAnimating(false)
      setAnimationStartTime(null)
    }
  }

  async function recordVideo(animCode: string, logoImg: HTMLImageElement | null, brandId: string, postId: string | null, download: boolean, format: 'mp4' | 'mov' | 'gif' | 'webm' = 'mp4'): Promise<void> {
    if (format === 'gif') {
      return recordGif(animCode, logoImg, download)
    }

    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1080
    const ctx = canvas.getContext('2d')!
    const clean = sanitizeCode(animCode)
    const drawFrameFn = new Function(clean + '\nreturn typeof drawFrame==="function"?drawFrame:null;')() as ((ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null, frame: number, total: number) => void) | null
    if (!drawFrameFn) throw new Error('drawFrame not found')

    const TOTAL_FRAMES = 150
    const FPS = 30
    const mp4Mime = 'video/mp4;codecs=avc1'
    const mimeType = (format === 'mp4' || format === 'mov') && MediaRecorder.isTypeSupported(mp4Mime)
      ? mp4Mime
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const isActuallyMp4 = mimeType.startsWith('video/mp4')
    const ext = format === 'mov' ? 'mov' : format === 'mp4' && isActuallyMp4 ? 'mp4' : 'webm'
    const blobType = isActuallyMp4 ? 'video/mp4' : 'video/webm'

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    await new Promise<void>(resolve => {
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: blobType })
        if (download) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = `infographic-animation.${ext}`; a.click()
          URL.revokeObjectURL(url)
        }
        if (postId) {
          try {
            const fileName = `infographic_${brandId}_${Date.now()}_animated.${ext}`
            const uploaded = await uploadMedia(blob, { folder: 'generated-posts', fileName })
            await sb.from('generated_posts').update({ animated_url: uploaded.url }).eq('id', postId)
          } catch { /* non-critical */ }
        }
        resolve()
      }
      recorder.start()
      let frame = 0
      const interval = setInterval(() => {
        ctx.clearRect(0, 0, 1080, 1080)
        try {
          drawFrameFn(ctx, 1080, 1080, null, frame, TOTAL_FRAMES)
          drawBrandLogoOverlay(ctx, logoImg, 1080, 1080)
        } catch {}
        frame++
        if (frame >= TOTAL_FRAMES) { clearInterval(interval); recorder.stop() }
      }, 1000 / FPS)
    })
  }

  async function recordGif(animCode: string, logoImg: HTMLImageElement | null, download: boolean): Promise<void> {
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
    const SIZE = 540
    const TOTAL_FRAMES = 75 // 5s at 15fps
    const FPS = 15
    const DELAY = Math.round(100 / FPS) // centiseconds

    const canvas = document.createElement('canvas')
    canvas.width = SIZE; canvas.height = SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const clean = sanitizeCode(animCode)
    const drawFrameFn = new Function(clean + '\nreturn typeof drawFrame==="function"?drawFrame:null;')() as ((ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null, frame: number, total: number) => void) | null
    if (!drawFrameFn) throw new Error('drawFrame not found')

    const gif = GIFEncoder()
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      // sample from the full 150-frame timeline at 15fps
      const frame = Math.round(i * (150 / TOTAL_FRAMES))
      ctx.clearRect(0, 0, SIZE, SIZE)
      try {
        drawFrameFn(ctx, SIZE, SIZE, null, frame, 150)
        drawBrandLogoOverlay(ctx, logoImg, SIZE, SIZE)
      } catch {}
      const imageData = ctx.getImageData(0, 0, SIZE, SIZE)
      const palette = quantize(imageData.data, 256)
      const index = applyPalette(imageData.data, palette)
      gif.writeFrame(index, SIZE, SIZE, { palette, delay: DELAY })
    }
    gif.finish()

    if (download) {
      const blob = new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'infographic-animation.gif'; a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function handleDownloadVideo() {
    if (!animatedCode) return
    setDownloadingVideo(true)
    try {
      const logoUrl = selectedTheme === 'dark' ? logoDarkUrl : logoLightUrl
      let logoImg: HTMLImageElement | null = null
      if (logoUrl) {
        logoImg = await new Promise(resolve => {
          const img = new Image(); img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = logoUrl
        })
      }
      await recordVideo(animatedCode, logoImg, selectedBrandId, currentPostId, true, downloadFormat)
    } catch (err) {
      setError('Video download failed: ' + (err as Error).message)
    } finally {
      setDownloadingVideo(false)
    }
  }


  const canGenerate = showSelection && selectedMessageFocus.length > 0 && selectedCreativeHook.length > 0

  if (userRole !== 'admin' && !userAllowedPages.includes('infographic-generator')) return null

  return (
    <>
      <h1>Motion Infographics</h1>
      <p className="subtitle">Generate branded infographic images using AI-written Canvas code.</p>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>
          <div className="form-card">
            <h2>Settings</h2>

            {userRole === 'admin' ? (
              <div className="form-group">
                <label>Brand</label>
                <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)} disabled={analysing || generating}>
                  <option value="">Select a brand…</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Brand</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', color: 'var(--text)' }}>
                  {userBrandName}
                </div>
              </div>
            )}

            {userRole === 'admin' && (
              <div className="form-group">
                <label>Layout Reference</label>
                <select value={selectedLayoutRefId} onChange={e => setSelectedLayoutRefId(e.target.value)} disabled={analysing || generating}>
                  <option value="">Random layout</option>
                  {layoutRefs.map(ref => <option key={ref.id} value={ref.id}>{ref.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Ad Copy</label>
              <textarea
                rows={5}
                placeholder="Headline: Your headline here&#10;Subhead: Supporting text&#10;Body: Key points..."
                value={adCopy}
                onChange={e => setAdCopy(e.target.value)}
                style={{ resize: 'vertical' }}
                disabled={analysing || generating}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--error,#e74c3c)', marginBottom: 8 }}>
                {error}
              </div>
            )}

            <button className="generate-btn" onClick={handleAnalyse} disabled={analysing || generating || !selectedBrandId || !adCopy.trim()}>
              {analysing ? 'Analysing…' : 'Analyse Copy'}
            </button>
            {analysing && analysisStartTime && (
              <GeneratingOverlay messages={ANALYSE_MESSAGES} startTime={analysisStartTime} curve={ANALYSE_CURVE} />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Canvas preview */}
          <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Preview</h2>
                {layoutRefUsed && (
                  <span style={{ fontSize: 11, background: 'var(--bg-subtle, rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', color: 'var(--muted)' }}>
                    Layout: {layoutRefUsed}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {generatedCode && (
                  <div style={{ display: 'flex', gap: 2, background: 'var(--border)', borderRadius: 6, padding: 2 }}>
                    {(['light', 'dark'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTheme(t)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 4,
                          border: 'none',
                          background: selectedTheme === t ? 'var(--bg)' : 'transparent',
                          color: selectedTheme === t ? 'var(--foreground, var(--text-primary))' : 'var(--muted)',
                          fontSize: 11,
                          fontWeight: selectedTheme === t ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {generatedCode && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      if (!canvasRef.current) return
                      const a = document.createElement('a')
                      a.download = 'infographic.png'
                      a.href = canvasRef.current.toDataURL('image/png')
                      a.click()
                    }}>Download</button>
                    <button
                      className="btn btn-sm"
                      onClick={handleAnimate}
                      disabled={animating}
                      style={{ background: animating ? 'var(--border)' : '#7c3aed', color: '#fff', border: 'none' }}
                    >
                      {animating ? 'Animating…' : '✦ Animate'}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{
                aspectRatio: '1/1', background: 'var(--bg)', borderRadius: 8,
                border: '1px solid var(--border)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                maxWidth: 540, margin: '0 auto',
              }}>
                {generating || editing ? (
                  <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 8, minHeight: 300 }} />
                ) : generatedCode ? (
                  <canvas ref={canvasRef} width={1080} height={1080} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    Your infographic will appear here
                  </div>
                )}
              </div>
              {generating && generationStartTime && (
                <div style={{ maxWidth: 540, margin: '0 auto' }}>
                  <GeneratingOverlay messages={INFOGRAPHIC_MESSAGES} startTime={generationStartTime} curve={INFOGRAPHIC_CURVE} />
                </div>
              )}
              {generatedCode && !generating && (
                <div style={{ maxWidth: 540, margin: '12px auto 0' }}>
                  {!editOpen ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-flex' }} className="edit-info-wrap">
                        <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--muted)', color: 'var(--muted)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0, lineHeight: 1 }}>i</span>
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, width: 260, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, zIndex: 10, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }} className="edit-info-tooltip">
                          Type what you want to change - for example:<br /><br />
                          <span style={{ color: 'var(--muted)' }}>
                            "change the red box to blue"<br />
                            "change headline size to 52px"<br />
                            "change headline to Freight Moves Fast"<br />
                            "change accent color to #FF6B00"
                          </span><br /><br />
                          You can use hex codes for precise colors. If you don't like the result, click <strong>Reset</strong> to go back to the original.
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditOpen(true)}
                        style={{ flex: 1 }}
                      >
                        Edit
                      </button>
                      {originalCode && originalCode !== generatedCode && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setGeneratedCode(originalCode); setAnimatedCode('') }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={editInstruction}
                          onChange={e => setEditInstruction(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && editInstruction.length <= 60) handleEdit() }}
                          placeholder="change color of red box, move arrow a little left…"
                          disabled={editing}
                          style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: `1px solid ${editInstruction.length > 60 ? 'var(--error, #e53e3e)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                          autoFocus
                        />
                        <button
                          className="btn btn-sm"
                          onClick={handleEdit}
                          disabled={editing || !editInstruction.trim() || editInstruction.length > 60}
                          style={{ background: editing ? 'var(--border)' : '#7c3aed', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
                        >
                          {editing ? 'Updating…' : 'Regenerate'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEditOpen(false); setEditInstruction('') }}
                          disabled={editing}
                        >
                          ✕
                        </button>
                      </div>
                      {editInstruction.length > 60
                        ? <span style={{ fontSize: 12, color: 'var(--error, #e53e3e)' }}>{editInstruction.length}/60 - too long</span>
                        : <span style={{ fontSize: 12, color: 'var(--muted)' }}>{editInstruction.length}/60</span>
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Remotion animation preview */}
          {(animating || animatedCode) && (
            <div className="form-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #7c3aed' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>✦ Animation Preview</h2>
                {animatedCode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      value={downloadFormat}
                      onChange={e => setDownloadFormat(e.target.value as 'mp4' | 'mov' | 'gif' | 'webm')}
                      disabled={downloadingVideo}
                      style={{
                        padding: '5px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        cursor: 'pointer',
                        width: 'auto',
                      }}
                    >
                      <option value="mp4">MP4</option>
                      <option value="mov">MOV</option>
                      <option value="gif">GIF</option>
                      <option value="webm">WebM</option>
                    </select>
                    <button onClick={handleDownloadVideo} className="btn btn-secondary btn-sm" disabled={downloadingVideo}>
                      {downloadingVideo ? 'Preparing…' : 'Download'}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ padding: 18 }}>
                {animating && !animatedCode ? (
                  <div className="skeleton" style={{ aspectRatio: '1/1', maxWidth: 540, margin: '0 auto', borderRadius: 8, minHeight: 300 }} />
                ) : animatedCode ? (
                  <div style={{ maxWidth: 540, margin: '0 auto' }}>
                    <RemotionPreview animatedCode={animatedCode} logoUrl={selectedTheme === 'dark' ? logoDarkUrl : logoLightUrl} fonts={brandFonts} />
                  </div>
                ) : null}
                {animating && !animatedCode && animationStartTime && (
                  <div style={{ maxWidth: 540, margin: '0 auto' }}>
                    <GeneratingOverlay messages={ANIMATE_MESSAGES} startTime={animationStartTime} curve={ANIMATE_CURVE} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Creative Direction Modal */}
      <div
        className={`modal-overlay${(showSelection || analysing) ? ' open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget && !analysing) setShowSelection(false) }}
      >
        <div className="modal" style={{ width: 520, maxWidth: '92vw', padding: '28px 28px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Creative Direction</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)' }}>Choose what the infographic should say and how it looks</p>
            </div>
            {!analysing && (
              <button
                onClick={() => setShowSelection(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, lineHeight: 1 }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {analysing ? (
            <div style={{ padding: '24px 0' }}>
              {analysisStartTime && <GeneratingOverlay messages={ANALYSE_MESSAGES} startTime={analysisStartTime} curve={ANALYSE_CURVE} />}
            </div>
          ) : (
            <>
              {/* Message Focus */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Message Focus</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {MESSAGE_FOCUS_OPTIONS.map(opt => (
                    <OptionChip
                      key={opt.id}
                      label={opt.label}
                      selected={selectedMessageFocus.includes(opt.id)}
                      onClick={() => toggleMessageFocus(opt.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Creative Hook */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Creative Hook</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CREATIVE_HOOK_OPTIONS.map(opt => (
                    <OptionChip
                      key={opt.id}
                      label={opt.label}
                      selected={selectedCreativeHook.includes(opt.id)}
                      onClick={() => toggleCreativeHook(opt.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleAnalyse} disabled={analysing} style={{ fontSize: 12 }}>
                  Re-analyse
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={{ fontSize: 12 }}
                >
                  Confirm & Generate
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
