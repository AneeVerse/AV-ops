'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { authedFetch } from '@/lib/authed-fetch'
import { sb } from '@/lib/supabase'
import { useToast } from '@/lib/toast'
import { uploadMedia, deleteMediaClient } from '@/lib/media-upload'
import type { BrandSetupResult, BrandSetupSourceSummary } from '@/lib/brand-setup-types'
import {
  BRAND_SYSTEM_SCHEMA_VERSION,
  type BrandSystemAssetManifestItem,
} from '@/lib/brand-system/feature-registry'

interface Brand { id: string; name: string }
type ApplyAction = 'add' | 'replace' | 'skip'
type ApplyOptions = {
  brandDescription: ApplyAction
  infographicGuidelines: ApplyAction
  infographicLayouts: ApplyAction
  staticLayouts: ApplyAction
  editableTemplates: ApplyAction
  carouselLayouts: ApplyAction
}

const defaultApplyOptions: ApplyOptions = {
  brandDescription: 'add',
  infographicGuidelines: 'add',
  infographicLayouts: 'add',
  staticLayouts: 'add',
  editableTemplates: 'add',
  carouselLayouts: 'add',
}

const MAX_STATIC_REFERENCE_IMAGES = 10
const REQUIRED_CAROUSEL_IMAGES = 6
const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  font: 'inherit',
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Jobs created by earlier versions of Brand Setup can legitimately lack fields
// introduced later (for example palette and visual evidence). Never let an
// older or partially recovered result take down the review screen.
function normalizeBrandSetupResult(value: BrandSetupResult | null | undefined): BrandSetupResult | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<BrandSetupResult>
  const palette = (candidate.palette && typeof candidate.palette === 'object' ? candidate.palette : {}) as Partial<BrandSetupResult['palette']>
  const typography = (candidate.typography && typeof candidate.typography === 'object' ? candidate.typography : {}) as Partial<BrandSetupResult['typography']>
  const sourceEvidence = (candidate.sourceEvidence && typeof candidate.sourceEvidence === 'object' ? candidate.sourceEvidence : {}) as Partial<BrandSetupResult['sourceEvidence']>
  const visualBlueprints = (candidate.visualBlueprints && typeof candidate.visualBlueprints === 'object' ? candidate.visualBlueprints : {}) as Partial<BrandSetupResult['visualBlueprints']>
  const emptyBlueprint = {
    referenceIndexes: [], canvas: [], zones: [], recurringComponents: [], colorAndContrast: [],
    typographyBehavior: [], imageryAndDepth: [], densityAndRhythm: [], invariants: [], prohibitedDrift: [],
  }

  return {
    ...candidate,
    brandName: typeof candidate.brandName === 'string' ? candidate.brandName : 'Brand',
    brandDescription: typeof candidate.brandDescription === 'string' ? candidate.brandDescription : '',
    infographicGuidelines: typeof candidate.infographicGuidelines === 'string' ? candidate.infographicGuidelines : '',
    palette: palette as BrandSetupResult['palette'],
    typography: {
      headingFont: '', bodyFont: '', headingWeight: 0, bodyWeight: 0,
      ...(typography as Partial<BrandSetupResult['typography']>),
    },
    sourceEvidence: {
      sourcePriority: Array.isArray(sourceEvidence.sourcePriority) ? sourceEvidence.sourcePriority : [],
      references: Array.isArray(sourceEvidence.references) ? sourceEvidence.references : [],
      repeatedPatterns: Array.isArray(sourceEvidence.repeatedPatterns) ? sourceEvidence.repeatedPatterns : [],
      uncertainties: Array.isArray(sourceEvidence.uncertainties) ? sourceEvidence.uncertainties : [],
    },
    visualBlueprints: {
      staticSystem: emptyBlueprint,
      carouselSystem: { ...emptyBlueprint, slides: [] },
      ...(visualBlueprints as Partial<BrandSetupResult['visualBlueprints']>),
    },
    infographicLayouts: Array.isArray(candidate.infographicLayouts) ? candidate.infographicLayouts : [],
    staticLayouts: Array.isArray(candidate.staticLayouts) ? candidate.staticLayouts : [],
    editableTemplates: Array.isArray(candidate.editableTemplates) ? candidate.editableTemplates : [],
    carouselLayouts: Array.isArray(candidate.carouselLayouts) ? candidate.carouselLayouts : [],
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings : [],
  } as BrandSetupResult
}

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    throw new Error(`The server returned an empty response (${response.status}). Check the terminal and latest n8n execution.`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`The server returned incomplete JSON (${response.status}). Retry once; if it repeats, inspect the latest n8n execution.`)
  }
}

function OutputCard({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{title}</h2>
        {count != null && (
          <span style={{ fontSize: 11, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 8px' }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

export default function BrandSetupPage() {
  const { userRole } = useAuth()
  const { showToast } = useToast()
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandId, setBrandId] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [carouselFiles, setCarouselFiles] = useState<File[]>([])
  const [guidelineFile, setGuidelineFile] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState('')
  const [generationStartedAt, setGenerationStartedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<BrandSetupResult | null>(null)
  const [sourceSummary, setSourceSummary] = useState<BrandSetupSourceSummary | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [applyOptions, setApplyOptions] = useState<ApplyOptions>(defaultApplyOptions)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (userRole !== 'admin') return
    sb.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
  }, [userRole])

  useEffect(() => {
    if (!generating || !brandId || !generationStartedAt) return
    let active = true
    const refreshProgress = async () => {
      const { data } = await sb
        .from('brand_system_jobs')
        .select('id,status,current_stage,progress,error,result,created_at')
        .eq('brand_id', brandId)
        .gte('created_at', generationStartedAt)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!active || !data) return
      setJobId(data.id)
      const label = data.current_stage || data.status || 'Working'
      setGenerationStatus(`${data.progress ?? 0}% · ${label}${data.error ? ` · ${data.error}` : ''}`)
      if (data.status === 'review' && data.result) {
        setResult(normalizeBrandSetupResult(data.result as BrandSetupResult))
        setGenerating(false)
        setGenerationStartedAt(null)
        showToast('Brand setup generated. Review it before saving.')
      } else if (data.status === 'failed') {
        setGenerating(false)
        setGenerationStartedAt(null)
        showToast(data.error || 'Brand setup generation failed.', true)
      }
    }
    void refreshProgress()
    const interval = window.setInterval(() => void refreshProgress(), 2500)
    return () => { active = false; window.clearInterval(interval) }
  }, [brandId, generating, generationStartedAt])

  const previews = useMemo(() => referenceFiles.map(file => ({ file, url: URL.createObjectURL(file) })), [referenceFiles])
  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews])
  const carouselPreviews = useMemo(() => carouselFiles.map(file => ({ file, url: URL.createObjectURL(file) })), [carouselFiles])
  useEffect(() => () => carouselPreviews.forEach(preview => URL.revokeObjectURL(preview.url)), [carouselPreviews])

  function changeBrand(nextBrandId: string) {
    if (nextBrandId === brandId) return
    setBrandId(nextBrandId)
    setWebsiteUrl('')
    setReferenceFiles([])
    setCarouselFiles([])
    setGuidelineFile(null)
    setResult(null)
    setSourceSummary(null)
    setJobId(null)
    setGenerationStatus('')
    setGenerationStartedAt(null)
    setConfirmOverwrite(false)
    setApplyOptions(defaultApplyOptions)
    setSaved(false)
  }

  function selectReferences(files: FileList | null) {
    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length > MAX_STATIC_REFERENCE_IMAGES) {
      showToast(`Choose up to ${MAX_STATIC_REFERENCE_IMAGES} standalone static reference images.`, true)
      return
    }
    const selected = imageFiles.slice(0, MAX_STATIC_REFERENCE_IMAGES)
    const oversized = selected.find(file => file.size > MAX_REFERENCE_IMAGE_BYTES)
    if (oversized) { showToast(`${oversized.name} is larger than 8 MB.`, true); return }
    setReferenceFiles(selected)
    setResult(null)
    setSaved(false)
  }

  function selectCarouselImages(files: FileList | null) {
    const selected = Array.from(files || [])
    if (selected.length !== REQUIRED_CAROUSEL_IMAGES) {
      showToast(`Choose exactly ${REQUIRED_CAROUSEL_IMAGES} carousel slide images in slide order.`, true)
      return
    }
    const nonImage = selected.find(file => !file.type.startsWith('image/'))
    if (nonImage) {
      showToast(`${nonImage.name} is not an image. Export each carousel page as PNG or JPG.`, true)
      return
    }
    const oversized = selected.find(file => file.size > MAX_REFERENCE_IMAGE_BYTES)
    if (oversized) {
      showToast(`${oversized.name} is larger than 8 MB.`, true)
      return
    }
    setCarouselFiles(selected)
    setResult(null)
    setSaved(false)
  }

  function moveCarouselSlide(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= carouselFiles.length) return
    setCarouselFiles(current => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setResult(null)
    setSaved(false)
  }

  function selectGuidelineDocument(file: File | null) {
    if (!file) { setGuidelineFile(null); return }
    const lowerName = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf')
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')
    if (!isPdf && !isDocx) {
      showToast('Please choose a PDF or DOCX file.', true)
      return
    }
    if (file.size > 60 * 1024 * 1024) {
      showToast('The guideline document must be 60 MB or smaller.', true)
      return
    }
    setGuidelineFile(file)
    setResult(null)
    setSaved(false)
  }

  async function uploadInputs(runId: string): Promise<{
    imagePaths: string[]
    guidelinePath: string | null
    assets: BrandSystemAssetManifestItem[]
    allPaths: string[]
  }> {
    const imagePaths: string[] = []
    const assets: BrandSystemAssetManifestItem[] = []
    const allPaths: string[] = []
    for (let index = 0; index < referenceFiles.length; index++) {
      setGenerationStatus(`Uploading reference image ${index + 1} of ${referenceFiles.length}…`)
      const file = referenceFiles[index]
      const fileName = `reference_${index + 1}_${sanitizeFilename(file.name)}`
      const uploaded = await uploadMedia(file, {
        folder: `brand-setup-inputs/${brandId}/${runId}`,
        fileName,
      })
      const path = uploaded.filePath
      imagePaths.push(path)
      allPaths.push(path)
      assets.push({
        id: `static-${index + 1}`,
        feature: 'static',
        role: 'standalone-composition',
        order: index + 1,
        storagePath: path,
        mediaType: 'image',
        mimeType: file.type,
        originalName: file.name,
      })
    }

    if (carouselFiles.length !== REQUIRED_CAROUSEL_IMAGES) throw new Error(`Choose exactly ${REQUIRED_CAROUSEL_IMAGES} carousel slide images.`)
    for (let index = 0; index < carouselFiles.length; index++) {
      setGenerationStatus(`Uploading carousel slide ${index + 1} of ${REQUIRED_CAROUSEL_IMAGES}…`)
      const file = carouselFiles[index]
      const fileName = `carousel_slide_${index + 1}_${sanitizeFilename(file.name)}`
      const uploaded = await uploadMedia(file, {
        folder: `brand-setup-inputs/${brandId}/${runId}`,
        fileName,
      })
      const path = uploaded.filePath
      imagePaths.push(path)
      allPaths.push(path)
      assets.push({
        id: `carousel-${index + 1}`,
        feature: 'carousel',
        role: 'sequence-slide',
        order: index + 1,
        storagePath: path,
        mediaType: 'image',
        mimeType: file.type,
        originalName: file.name,
      })
    }

    let guidelinePath: string | null = null
    if (guidelineFile) {
      setGenerationStatus('Uploading brand-guideline document…')
      const contentType = guidelineFile.name.toLowerCase().endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf'
      const fileName = `brand_guidelines_${sanitizeFilename(guidelineFile.name)}`
      const uploaded = await uploadMedia(guidelineFile, {
        folder: `brand-setup-inputs/${brandId}/${runId}`,
        fileName,
      })
      guidelinePath = uploaded.filePath
      allPaths.push(guidelinePath)
      assets.push({
        id: 'brand-guideline-1',
        feature: 'core',
        role: 'brand-guideline',
        order: 1,
        storagePath: guidelinePath,
        mediaType: contentType === 'application/pdf' ? 'pdf' : 'docx',
        mimeType: contentType,
        originalName: guidelineFile.name,
      })
    }
    return { imagePaths, guidelinePath, assets, allPaths }
  }

  async function handleGenerate() {
    if (!brandId) { showToast('Select a brand.', true); return }
    if (!/^https?:\/\//i.test(websiteUrl.trim())) { showToast('Enter a complete website URL beginning with http:// or https://.', true); return }
    if (referenceFiles.length < 1 || referenceFiles.length > MAX_STATIC_REFERENCE_IMAGES) { showToast(`Upload 1–${MAX_STATIC_REFERENCE_IMAGES} standalone static reference images.`, true); return }
    if (carouselFiles.length !== REQUIRED_CAROUSEL_IMAGES) { showToast(`Upload exactly ${REQUIRED_CAROUSEL_IMAGES} carousel slide images in order.`, true); return }

    setGenerating(true)
    setResult(null)
    setSourceSummary(null)
    setJobId(null)
    setSaved(false)
    setConfirmOverwrite(false)
    setApplyOptions(defaultApplyOptions)
    setGenerationStartedAt(new Date().toISOString())
    let cleanupPaths: string[] = []
    let queuedForBackground = false
    try {
      const runId = crypto.randomUUID()
      const uploaded = await uploadInputs(runId)
      cleanupPaths = uploaded.allPaths
      setGenerationStatus('Measuring reference layouts, then compiling production prompts… This quality pass can take 2–4 minutes.')
      const res = await authedFetch('/api/brand-setup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: BRAND_SYSTEM_SCHEMA_VERSION,
          brandId,
          websiteUrl: websiteUrl.trim(),
          requestedFeatures: ['static', 'carousel'],
          assets: uploaded.assets,
          guidelineStoragePath: uploaded.guidelinePath,
          referenceImagePaths: uploaded.imagePaths,
          referenceImageTypes: ['static-creative', ...carouselFiles.map(() => 'carousel-slide')],
        }),
      })
      const json = await readApiJson<{ jobId?: string; result?: BrandSetupResult; sourceSummary?: BrandSetupSourceSummary; error?: string }>(res)
      if (res.status === 202 && json.jobId) {
        queuedForBackground = true
        setJobId(json.jobId)
        setGenerationStatus('5% · queued for background deep research. This can take up to 10 minutes.')
        return
      }
      if (!res.ok || !json.result) throw new Error(json.error || 'Brand setup generation failed.')
      setJobId(json.jobId || null)
      setResult(normalizeBrandSetupResult(json.result))
      setSourceSummary(json.sourceSummary || null)
      showToast('Brand setup generated. Review it before saving.')
    } catch (error) {
      showToast((error as Error).message, true)
    } finally {
      if (!queuedForBackground) {
        if (cleanupPaths.length) {
          await Promise.all(
            cleanupPaths.map((filePath) => deleteMediaClient({ filePath }).catch(() => {}))
          )
        }
        setGenerationStatus('')
        setGenerationStartedAt(null)
        setGenerating(false)
      }
    }
  }

  async function handleApply() {
    if (!result || !confirmOverwrite) return
    setSaving(true)
    try {
      const res = await authedFetch('/api/brand-setup/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, jobId, result, applyOptions }),
      })
      const json = await readApiJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(json.error || 'Could not save brand setup.')
      setSaved(true)
      showToast('Brand setup saved successfully.')
    } catch (error) {
      showToast((error as Error).message, true)
    } finally {
      setSaving(false)
    }
  }

  function downloadJson() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.brandName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-brand-setup.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (userRole !== 'admin') {
    return <div style={cardStyle}>This tool is available to administrators only.</div>
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
      <div className="detail-header" style={{ marginBottom: 22 }}>
        <div className="detail-title">
          <h1>AI Brand Setup</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Turn a website, brand guideline, one static image, and six ordered carousel images into production-ready prompts and editable layouts.
          </p>
        </div>
      </div>

      <section style={{ ...cardStyle, marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 7 }}>1. Brand</label>
            <select value={brandId} onChange={event => changeBrand(event.target.value)} disabled={generating} style={inputStyle}>
              <option value="">Select a brand…</option>
              {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 7 }}>2. Website URL</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={event => { setWebsiteUrl(event.target.value); setResult(null); setSourceSummary(null); setSaved(false) }}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 7 }}>3. Brand-guideline PDF or DOCX <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
            <label style={{ ...inputStyle, display: 'block', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {guidelineFile ? guidelineFile.name : 'Choose PDF or DOCX…'}
              <input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" hidden onChange={event => selectGuidelineDocument(event.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginTop: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 7 }}>4. Static reference images <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(1–10 images, up to 8 MB each)</span></label>
            <label style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 82, cursor: 'pointer', borderStyle: 'dashed', color: 'var(--muted)' }}>
              Choose standalone static creatives
              <input key={referenceFiles.map(file => file.lastModified).join('-') || 'empty-static'} type="file" accept="image/*" multiple hidden onChange={event => selectReferences(event.target.files)} />
            </label>
            {previews.map(({ file, url }) => (
              <div key={`${file.name}-${file.lastModified}`} style={{ position: 'relative', width: 132, marginTop: 12, border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: 'var(--bg)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Static reference" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setReferenceFiles(current => current.filter(candidate => candidate !== file))}
                  style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, border: 0, borderRadius: 999, background: 'rgba(0,0,0,.72)', color: '#fff', cursor: 'pointer' }}
                >×</button>
                <div style={{ borderTop: '1px solid var(--border)', padding: '7px 8px', fontSize: 10, color: 'var(--muted)' }}>Standalone static</div>
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 7 }}>5. Carousel slide images <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(exactly six PNG/JPG images, up to 8 MB each)</span></label>
            <label style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 82, cursor: 'pointer', borderStyle: 'dashed', color: 'var(--muted)', textAlign: 'center' }}>
              {carouselFiles.length === REQUIRED_CAROUSEL_IMAGES ? 'Replace six carousel images' : 'Choose six images together in slide order'}
              <input key={carouselFiles.map(file => file.lastModified).join('-') || 'empty-carousel'} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => selectCarouselImages(event.target.files)} />
            </label>
            {carouselPreviews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))', gap: 8, marginTop: 12 }}>
                {carouselPreviews.map(({ file, url }, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Carousel slide ${index + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '6px 7px', fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                      <strong>Slide {index + 1}</strong>
                      <span style={{ display: 'flex', gap: 3 }}>
                        <button type="button" aria-label={`Move slide ${index + 1} left`} disabled={index === 0} onClick={() => moveCarouselSlide(index, -1)} style={{ border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', cursor: index === 0 ? 'default' : 'pointer' }}>←</button>
                        <button type="button" aria-label={`Move slide ${index + 1} right`} disabled={index === carouselFiles.length - 1} onClick={() => moveCarouselSlide(index, 1)} style={{ border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', cursor: index === carouselFiles.length - 1 ? 'default' : 'pointer' }}>→</button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {carouselFiles.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCarouselFiles([])} style={{ marginTop: 10 }}>
                Remove carousel images
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>
            The guideline controls brand rules; the standalone image teaches static composition; six numbered images preserve the carousel sequence; the website supplies product context.
          </p>
          <button className="generate-btn" onClick={handleGenerate} disabled={generating} style={{ width: 'auto', minWidth: 210 }}>
            {generating ? 'Building brand system…' : 'Generate Brand Setup'}
          </button>
        </div>
        {generating && (
          <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', fontSize: 12 }}>
            {generationStatus || 'Preparing inputs…'}
          </div>
        )}
      </section>

      {result && (
        <div style={{ display: 'grid', gap: 18 }}>
          <section style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>{result.brandName} setup</h2>
              {sourceSummary && (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Analyzed {referenceFiles.length} static reference{referenceFiles.length === 1 ? '' : 's'}, {sourceSummary.carouselPages || 0} ordered carousel page{sourceSummary.carouselPages === 1 ? '' : 's'}, {sourceSummary.websitePages || 1} website page{(sourceSummary.websitePages || 1) === 1 ? '' : 's'}, {sourceSummary.websiteCharacters.toLocaleString()} website characters, {sourceSummary.guidelineCharacters.toLocaleString()} guideline-document characters, and {sourceSummary.verifiedFacts || 0} verified source fact{sourceSummary.verifiedFacts === 1 ? '' : 's'}.
                </div>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadJson}>Download JSON</button>
          </section>

          <OutputCard title="Brand palette & typography">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {Object.entries(result.palette).map(([name, color]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px', fontSize: 11 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 5, background: color, border: '1px solid rgba(127,127,127,.25)' }} />
                  <span><strong>{name}</strong><br /><span style={{ color: 'var(--muted)' }}>{color}</span></span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Heading: <strong style={{ color: 'var(--text)' }}>{result.typography.headingFont} {result.typography.headingWeight}</strong>
              {' · '}Body: <strong style={{ color: 'var(--text)' }}>{result.typography.bodyFont} {result.typography.bodyWeight}</strong>
            </div>
          </OutputCard>

          <OutputCard title="Reference evidence used" count={result.sourceEvidence.references.length}>
            <div style={{ display: 'grid', gap: 10 }}>
              {result.sourceEvidence.references.map(reference => (
                <details key={reference.referenceIndex} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '11px 13px', background: 'var(--bg)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>
                    Reference {reference.referenceIndex} · {reference.classifiedType}
                  </summary>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
                    <strong style={{ color: 'var(--text)' }}>Observed traits</strong>
                    <ul style={{ margin: '5px 0 10px', paddingLeft: 20 }}>
                      {reference.observedTraits.map((trait, index) => <li key={index}>{trait}</li>)}
                    </ul>
                    <div><strong style={{ color: 'var(--text)' }}>May influence:</strong> {reference.allowedInfluence.join('; ')}</div>
                    <div style={{ marginTop: 4 }}><strong style={{ color: 'var(--text)' }}>Must not influence:</strong> {reference.prohibitedInferences.join('; ')}</div>
                  </div>
                </details>
              ))}
            </div>
          </OutputCard>

          <OutputCard title="Brand description">
            <textarea
              value={result.brandDescription}
              onChange={event => setResult(current => current ? { ...current, brandDescription: event.target.value } : current)}
              rows={18}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            />
          </OutputCard>

          <OutputCard title="Infographic guidelines">
            <textarea
              value={result.infographicGuidelines}
              onChange={event => setResult(current => current ? { ...current, infographicGuidelines: event.target.value } : current)}
              rows={18}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            />
          </OutputCard>

          <OutputCard title="Motion infographic layouts" count={result.infographicLayouts.length}>
            <div style={{ display: 'grid', gap: 12 }}>
              {result.infographicLayouts.map((layout, index) => (
                <details key={`${layout.name}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '12px 13px', background: 'var(--bg)' }} open={index === 0}>
                  <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>
                    {index + 1}. {layout.name} · {layout.isActive ? 'Active' : 'Inactive'}
                  </summary>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)', fontSize: 12, lineHeight: 1.55, margin: '11px 0 0' }}>{layout.description}</p>
                </details>
              ))}
            </div>
          </OutputCard>

          <OutputCard title="Static AI layouts" count={result.staticLayouts.length}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
              {result.staticLayouts.map((layout, index) => (
                <details key={`${layout.name}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '12px 13px', background: 'var(--bg)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>{index + 1}. {layout.name}</summary>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)', fontSize: 12, lineHeight: 1.55, margin: '11px 0 0' }}>{layout.prompt}</p>
                </details>
              ))}
            </div>
          </OutputCard>

          <OutputCard title="Editable static templates" count={result.editableTemplates.length}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
              {result.editableTemplates.map((template, index) => (
                <details key={`${template.name}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '12px 13px', background: 'var(--bg)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>{index + 1}. {template.name}</summary>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)', fontSize: 12, lineHeight: 1.55 }}>{template.bgPrompt}</p>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 10, lineHeight: 1.5, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {JSON.stringify(template.puppeteerConfig, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </OutputCard>

          <OutputCard title="Carousel layout families" count={result.carouselLayouts.length}>
            <div style={{ display: 'grid', gap: 12 }}>
              {result.carouselLayouts.map((layout, layoutIndex) => (
                <details key={`${layout.name}-${layoutIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '13px 14px', background: 'var(--bg)' }} open={layoutIndex === 0}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>{layout.name} · 6 slides</summary>
                  <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
                    {layout.slides.map(slide => (
                      <details key={slide.slideIndex} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '9px 11px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 650 }}>Slide {slide.slideIndex} · {slide.role}</summary>
                        <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)', fontSize: 11, lineHeight: 1.55 }}>{slide.prompt}</p>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </OutputCard>

          {result.warnings.length > 0 && (
            <OutputCard title="Warnings and quality review" count={result.warnings.length}>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)', fontSize: 12, lineHeight: 1.65 }}>
                {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            </OutputCard>
          )}

          <OutputCard title="Choose what to save">
            <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12, lineHeight: 1.55 }}>
              Add new keeps existing setup and saves only new items. Replace existing removes the previous items in that section. Don&apos;t save leaves that section unchanged.
            </p>
            <div style={{ display: 'grid', gap: 9 }}>
              {([
                ['brandDescription', 'Brand description'],
                ['infographicGuidelines', 'Infographic guidelines'],
                ['infographicLayouts', 'Motion infographic layouts'],
                ['staticLayouts', 'Static reference layouts'],
                ['editableTemplates', 'Editable static templates'],
                ['carouselLayouts', 'Carousel layout families'],
              ] as Array<[keyof ApplyOptions, string]>).map(([key, label]) => (
                <label key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 190px', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <span>{label}</span>
                  <select value={applyOptions[key]} onChange={event => setApplyOptions(current => ({ ...current, [key]: event.target.value as ApplyAction }))} style={{ ...inputStyle, padding: '8px 10px' }}>
                    <option value="add">Add new / keep existing</option>
                    <option value="replace">Replace existing</option>
                    <option value="skip">Don&apos;t save this section</option>
                  </select>
                </label>
              ))}
            </div>
          </OutputCard>

          <section style={{ ...cardStyle, borderColor: saved ? '#22c55e' : 'var(--border)' }}>
            {saved ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <strong>Brand setup saved.</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>The new prompts and editable layouts are now available to the generation tools.</div>
                </div>
                <Link href={`/brands/${brandId}`} className="btn btn-primary btn-sm">Open brand settings</Link>
              </div>
            ) : (
              <>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={confirmOverwrite} onChange={event => setConfirmOverwrite(event.target.checked)} style={{ marginTop: 3 }} />
                  <span>I reviewed the save choices above. Only sections set to Replace existing will remove previous setup.</span>
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={handleApply} disabled={!confirmOverwrite || saving}>
                    {saving ? 'Saving setup…' : 'Save to Brand'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
