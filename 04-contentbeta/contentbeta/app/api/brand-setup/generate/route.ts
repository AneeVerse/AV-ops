import { NextResponse } from 'next/server'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import pdfParse from 'pdf-parse'
import { jsonrepair } from 'jsonrepair'
import { requireAdmin } from '@/lib/api-auth'
import { publicUrlFromFilePath } from '@/lib/imagekit'
import {
  getBlockingBrandSetupIssues,
  lockBrandSetupOverlayLayout,
  normalizeBrandSetupResult,
  validateBrandSetupResult,
} from '@/lib/brand-setup-normalize'
import {
  BRAND_SETUP_CAROUSEL_COMPILER_PROMPT,
  BRAND_SETUP_BRAND_DESCRIPTION_AUDIT_PROMPT,
  BRAND_SETUP_FACT_CONSOLIDATION_PROMPT,
  BRAND_SETUP_FACT_EXTRACTION_PROMPT,
  BRAND_SETUP_INFOGRAPHIC_REPAIR_PROMPT,
  BRAND_SETUP_SINGLE_ASSET_EVIDENCE_PROMPT,
  BRAND_SETUP_STATIC_COMPILER_PROMPT,
  BRAND_SETUP_SYSTEM_PROMPT,
  BRAND_SETUP_VISUAL_EVIDENCE_PROMPT,
} from '@/lib/brand-setup-prompt'
import type {
  BrandSetupOverlayConfig,
  BrandSetupReferenceEvidence,
  BrandSetupReferenceType,
  BrandSetupResult,
  BrandSetupSourceEvidence,
  BrandSetupVisualBlueprint,
  BrandSetupCarouselSlideBlueprint,
  BrandSetupVisualBlueprints,
} from '@/lib/brand-setup-types'
import {
  BRAND_SYSTEM_SCHEMA_VERSION,
  validateBrandSystemManifest,
  type BrandSystemAssetManifestItem,
  type BrandSystemFeatureId,
} from '@/lib/brand-system/feature-registry'
import { toVersionedBrandSystemDocument } from '@/lib/brand-system/result-adapters'
import {
  BRAND_SETUP_DEEP_RESEARCH_PROMPT,
  BRAND_SETUP_NINE_SECTION_GUIDE_PROMPT,
  BRAND_DESCRIPTION_COMPACTION_PROMPT,
  BRAND_DESCRIPTION_SECTION_PROMPTS,
  BRAND_DESCRIPTION_SECTIONS as HARDCODED_BRAND_DESCRIPTION_SECTIONS,
  NINE_SECTION_BRAND_GUIDE_SECTIONS,
  type BrandDescriptionSection,
} from '@/lib/brand-description-section-prompts'

// The browser receives its job immediately. The internal worker can then wait
// for the dedicated n8n research execution without the browser/webhook limit.
export const maxDuration = 900

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const N8N_BRAND_SETUP_WEBHOOK = process.env.N8N_BRAND_SETUP_WEBHOOK
  || 'https://n8n.aneeverse.com/webhook/brand-setup'
const N8N_DEEP_RESEARCH_WEBHOOK = process.env.N8N_BRAND_SETUP_DEEP_RESEARCH_WEBHOOK
  || 'https://n8n.aneeverse.com/webhook/brand-setup-deep-research'
const N8N_API_URL = process.env.N8N_API_URL?.replace(/\/$/, '') || ''
const N8N_API_KEY = process.env.N8N_API_KEY || ''
const N8N_DEEP_RESEARCH_WORKFLOW_ID = process.env.N8N_DEEP_RESEARCH_WORKFLOW_ID || 'LNq4eWk0JoYSqpGa'

function dispatchBackgroundWorker(
  url: string,
  headers: Record<string, string>,
  body: string,
  onError: (error: Error) => void
) {
  const target = new URL(url)
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest
  const workerRequest = send({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    path: `${target.pathname}${target.search}`,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Length': Buffer.byteLength(body).toString(),
    },
    timeout: 0,
  }, response => {
    response.resume()
  })
  workerRequest.on('error', onError)
  workerRequest.end(body)
}
// Brand Setup is deliberately single-model: every AI stage uses Sol so that
// research, source extraction, visual interpretation, synthesis, and the
// final guide all apply the same quality bar. The workflow runs asynchronously
// and its route timeout is intentionally long, so Sol is never replaced by a
// faster model simply to meet a request deadline.
const SOL_MODEL = 'gpt-5.6-sol'
const MODEL = SOL_MODEL
const WRITING_MODEL = SOL_MODEL
const VISUAL_ANALYSIS_MODEL = SOL_MODEL
const FACT_EXTRACTION_MODEL = SOL_MODEL
// Up to ten standalone static references plus the six required carousel pages.
const MAX_REFERENCE_IMAGES = 16
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024
const MAX_CAROUSEL_PDF_BYTES = 30 * 1024 * 1024
const REQUIRED_CAROUSEL_PAGES = 6
// Source text is never discarded. Large sources are split into model-sized
// chunks later so every relevant page and guideline passage is processed.
const SOURCE_CHUNK_TARGET = 24_000
const SOURCE_EXTRACTION_CONCURRENCY = 2
const SOURCE_EXTRACTION_MAX_ATTEMPTS = 3
const WEBSITE_FETCH_CONCURRENCY = 6

interface RequestBody {
  schemaVersion?: number
  brandId: string
  websiteUrl: string
  requestedFeatures?: BrandSystemFeatureId[]
  assets?: BrandSystemAssetManifestItem[]
  guidelineStoragePath?: string | null
  carouselPdfStoragePath?: string | null
  // Backward compatibility for already-open clients using the original PDF-only field.
  pdfStoragePath?: string | null
  referenceImagePaths: string[]
  referenceImageTypes?: BrandSetupReferenceType[]
  // Internal-only fields used after the initial request has safely created a
  // durable job. They are accepted solely from the server worker header.
  backgroundJobId?: string
  deepResearchOverride?: BrandDeepResearchResult
}

const REFERENCE_TYPES: BrandSetupReferenceType[] = ['auto', 'static-creative', 'carousel-slide', 'logo-palette', 'campaign-creative', 'product-ui', 'photography']

function cleanText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
}

function wordXmlToText(xml: string): string {
  return cleanText(decodeXmlText(xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<[^>]+>/g, '')))
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const orderedParts = Object.keys(zip.files)
    .filter(name => /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name))
    .sort((a, b) => {
      if (a === 'word/document.xml') return -1
      if (b === 'word/document.xml') return 1
      return a.localeCompare(b)
    })
  if (!orderedParts.includes('word/document.xml')) throw new Error('The DOCX is missing word/document.xml.')
  const sections = await Promise.all(orderedParts.map(async name => wordXmlToText(await zip.file(name)!.async('string'))))
  return cleanText(sections.filter(Boolean).join('\n\n'))
}

function guidelineFormat(path: string, mimeType: string): 'pdf' | 'docx' | null {
  const lowerPath = path.toLowerCase()
  if (lowerPath.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf'
  if (lowerPath.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return null
}

function isPublicWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isOwnedInputPath(path: string, brandId: string): boolean {
  const normalized = path
    .replace(/^https?:\/\/[^/]+\/?/, '')
    .replace(/^\//, '')
  return normalized.startsWith(`brand-setup-inputs/${brandId}/`) && !normalized.includes('..')
}

async function downloadStorageBlob(path: string): Promise<Blob> {
  const url = publicUrlFromFilePath(path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not read uploaded input: ${res.status} ${path}`)
  return res.blob()
}

function mediaAnalysisUrl(path: string): string {
  return publicUrlFromFilePath(path)
}

interface WebsiteExtractionResult {
  text: string
  pages: string[]
}

async function fetchWebsiteReader(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`Website extraction failed (${res.status})`)
  return cleanText(await res.text())
}

async function extractWebsitePage(url: string): Promise<string> {
  return fetchWebsiteReader(url)
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), Math.max(items.length, 1)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      try {
        results[index] = { status: 'fulfilled', value: await mapper(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  })
  await Promise.all(workers)
  return results
}

function scoreWebsiteCandidate(candidateUrl: string, label: string, rootUrl: string): number | null {
  const root = new URL(rootUrl)
  const rootHost = root.hostname.replace(/^www\./i, '').toLowerCase()
  const relevantPattern = /\b(?:about|platform|products?|solutions?|services?|features?|industr(?:y|ies)|dealers?|websites?|marketing|inventory|analytics|customers?|success|why|what-we-do)\b/i
  const excludedPattern = /\b(?:privacy|terms|legal|cookie|careers?|jobs?|contact|login|support|blog|news|events?|webinars?|thank[\s-]?you|sitemap|wp[\s-]?content|uploads?|template)\b/i
  try {
    const candidate = new URL(candidateUrl, root)
    if (!['http:', 'https:'].includes(candidate.protocol)) return null
    if (candidate.hostname.replace(/^www\./i, '').toLowerCase() !== rootHost) return null
    candidate.hash = ''
    candidate.search = ''
    const normalizedRootPath = root.pathname.replace(/\/+$/, '') || '/'
    const normalizedPath = candidate.pathname.replace(/\/+$/, '') || '/'
    if (normalizedPath === normalizedRootPath || normalizedPath.endsWith('.xml')) return null
    const searchText = `${label} ${normalizedPath.replace(/[-_/]+/g, ' ')}`
    if (excludedPattern.test(searchText)) return null
    const relevanceMatches = searchText.match(new RegExp(relevantPattern.source, 'gi'))?.length || 0
    if (!relevanceMatches) return null
    const depth = normalizedPath.split('/').filter(Boolean).length
    let score = relevanceMatches * 10 - depth
    if (/^\/about\/?$/i.test(normalizedPath)) score += 100
    if (/^\/(?:solutions?|solutions-overview|platform)\/?$/i.test(normalizedPath)) score += 90
    if (/^\/(?:products?|services?)\/?$/i.test(normalizedPath)) score += 80
    if (/^\/industr(?:y|ies)\/?$/i.test(normalizedPath)) score += 70
    if (/digital-marketing-strategy|what-we-do|why-/i.test(normalizedPath)) score += 55
    return score
  } catch {
    return null
  }
}

function websiteLinkCandidates(markdown: string, rootUrl: string): string[] {
  const candidates = new Map<string, number>()
  const linkPattern = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi
  let match: RegExpExecArray | null
  while ((match = linkPattern.exec(markdown)) !== null) {
    try {
      const candidate = new URL(match[2], rootUrl)
      candidate.hash = ''
      candidate.search = ''
      const score = scoreWebsiteCandidate(candidate.toString(), match[1], rootUrl)
      if (score === null) continue
      candidates.set(candidate.toString(), Math.max(score, candidates.get(candidate.toString()) || 0))
    } catch {
      // Ignore malformed links from the reader output.
    }
  }
  return Array.from(candidates.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([candidate]) => candidate)
}

async function sitemapWebsiteCandidates(rootUrl: string): Promise<string[]> {
  try {
    const sitemapUrl = new URL('/sitemap.xml', rootUrl).toString()
    const sitemapIndex = await fetchWebsiteReader(sitemapUrl)
    const sitemapLinks = Array.from(sitemapIndex.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+\.xml)\)/gi))
      .map(match => match[1])
      .filter(link => /(?:page|product|service|solution|industry).*sitemap/i.test(link))
      .filter(link => !/(?:post|category|tag|author|partner|testimonial|case-study)/i.test(link))
    const sitemapPages = sitemapLinks.length
      ? await mapWithConcurrency(sitemapLinks, WEBSITE_FETCH_CONCURRENCY, link => fetchWebsiteReader(link))
      : [{ status: 'fulfilled' as const, value: sitemapIndex }]
    const pageLinks = sitemapPages.flatMap(result => result.status === 'fulfilled'
      ? Array.from(result.value.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi)).map(match => match[1])
      : [])
    const scored = pageLinks.flatMap(link => {
      const score = scoreWebsiteCandidate(link, '', rootUrl)
      return score === null ? [] : [{ link, score }]
    })
    return Array.from(new Map(
      scored
        .sort((a, b) => b.score - a.score || a.link.localeCompare(b.link))
        .map(candidate => [candidate.link, candidate.link])
    ).values())
  } catch {
    return []
  }
}

async function extractWebsite(url: string): Promise<WebsiteExtractionResult> {
  const homepage = await extractWebsitePage(url)
  const visibleCandidates = websiteLinkCandidates(homepage, url)
  const sitemapCandidates = await sitemapWebsiteCandidates(url)
  const candidates = Array.from(new Set([...visibleCandidates, ...sitemapCandidates]))
  const linkedPages = await mapWithConcurrency(candidates, WEBSITE_FETCH_CONCURRENCY, async candidate => ({
    url: candidate,
    text: await extractWebsitePage(candidate),
  }))
  const pages = [
    { url, text: homepage },
    ...linkedPages.flatMap(result => result.status === 'fulfilled' && result.value.text
      ? [result.value]
      : []),
  ]
  const text = cleanText(pages
    .map(page => `SOURCE PAGE: ${page.url}\n\n${page.text}`)
    .join('\n\n---\n\n'))
  return { text, pages: pages.map(page => page.url) }
}

function parseModelJson(content: string): BrandSetupResult {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as BrandSetupResult
  } catch {
    return JSON.parse(jsonrepair(cleaned)) as BrandSetupResult
  }
}

interface StaticCompilerResult {
  staticLayouts?: Array<{ prompt?: string }>
}

interface CarouselCompilerResult {
  slides?: Array<{ prompt?: string }>
}

interface VisualEvidenceResult {
  sourceEvidence?: BrandSetupSourceEvidence
  visualBlueprints?: BrandSetupVisualBlueprints
}

interface SingleAssetEvidenceResult {
  canvasMeasurement?: {
    aspectRatio?: string
    orientation?: string
    background?: string
    dominantColors?: string[]
    outerMarginPercent?: number
  }
  elements?: Array<{
    name?: string
    kind?: string
    x?: number
    y?: number
    width?: number
    height?: number
    layer?: string
    appearance?: string
  }>
  reference?: {
    observedTraits?: string[]
    allowedInfluence?: string[]
    prohibitedInferences?: string[]
  }
  blueprint?: Partial<BrandSetupVisualBlueprint>
  slide?: {
    role?: string
    uniqueStructure?: string[]
    retainedFamilyRules?: string[]
  }
}

interface AnalyzedManifestAsset {
  reference: BrandSetupReferenceEvidence
  blueprint: BrandSetupVisualBlueprint
  slide?: BrandSetupCarouselSlideBlueprint
}

function uniqueEvidenceStrings(...groups: Array<unknown>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    for (const value of group) {
      if (typeof value !== 'string') continue
      const cleaned = cleanText(value)
      if (!cleaned || seen.has(cleaned.toLowerCase())) continue
      seen.add(cleaned.toLowerCase())
      result.push(cleaned)
    }
  }
  return result
}

function normalizeAssetBlueprint(
  input: Partial<BrandSetupVisualBlueprint> | undefined,
  referenceIndex: number
): BrandSetupVisualBlueprint {
  return {
    referenceIndexes: [referenceIndex],
    canvas: uniqueEvidenceStrings(input?.canvas),
    zones: uniqueEvidenceStrings(input?.zones),
    recurringComponents: uniqueEvidenceStrings(input?.recurringComponents),
    colorAndContrast: uniqueEvidenceStrings(input?.colorAndContrast),
    typographyBehavior: uniqueEvidenceStrings(input?.typographyBehavior),
    imageryAndDepth: uniqueEvidenceStrings(input?.imageryAndDepth),
    densityAndRhythm: uniqueEvidenceStrings(input?.densityAndRhythm),
    invariants: uniqueEvidenceStrings(input?.invariants),
    prohibitedDrift: uniqueEvidenceStrings(input?.prohibitedDrift),
  }
}

function normalizeAnalyzedAsset(
  input: SingleAssetEvidenceResult,
  referenceIndex: number,
  declaredType: 'static-creative' | 'carousel-slide',
  slideNumber?: number
): AnalyzedManifestAsset {
  const measurement = input.canvasMeasurement
  const measuredElements = (Array.isArray(input.elements) ? input.elements : [])
    .map(element => {
      const numeric = [element.x, element.y, element.width, element.height].map(value => Number(value))
      if (numeric.some(value => !Number.isFinite(value))) return null
      const [x, y, width, height] = numeric.map(value => Math.round(Math.max(0, Math.min(100, value))))
      if (!width || !height) return null
      const name = cleanText(element.name || element.kind || 'visible element')
      const kind = cleanText(element.kind || 'element')
      const layer = cleanText(element.layer || 'midground')
      const appearance = cleanText(element.appearance || 'literal observed treatment')
      return `${name} (${kind}): x=${x}%, y=${y}%, width=${width}%, height=${height}%; ${layer}; ${appearance}`
    })
    .filter((value): value is string => Boolean(value))
  const measuredCanvas = measurement ? [
    `Canvas: ${cleanText(measurement.orientation || 'unknown orientation')}, aspect ${cleanText(measurement.aspectRatio || 'unverified')}, ${cleanText(measurement.background || 'background construction unverified')}`,
    Array.isArray(measurement.dominantColors) && measurement.dominantColors.length
      ? `Dominant visible colors: ${measurement.dominantColors.map(color => cleanText(color)).filter(Boolean).join(', ')}`
      : '',
    Number.isFinite(Number(measurement.outerMarginPercent))
      ? `Outer margin is approximately ${Math.round(Math.max(0, Math.min(40, Number(measurement.outerMarginPercent))))}% of canvas width`
      : '',
  ].filter(Boolean) : []
  const blueprint = normalizeAssetBlueprint({
    ...input.blueprint,
    canvas: uniqueEvidenceStrings(measuredCanvas, input.blueprint?.canvas),
    zones: uniqueEvidenceStrings(measuredElements, input.blueprint?.zones),
  }, referenceIndex)
  const observedTraits = uniqueEvidenceStrings(
    measuredCanvas,
    measuredElements,
    input.reference?.observedTraits,
    blueprint.canvas,
    blueprint.zones,
    blueprint.recurringComponents,
    blueprint.imageryAndDepth
  ).slice(0, 24)
  return {
    reference: {
      referenceIndex,
      declaredType,
      classifiedType: 'campaign-creative',
      observedTraits,
      allowedInfluence: uniqueEvidenceStrings(input.reference?.allowedInfluence, [
        declaredType === 'static-creative'
          ? 'May control the standalone-static composition, hierarchy, module anatomy, and visual treatment.'
          : 'May control this ordered carousel slide and evidence repeated across its six-slide family.',
      ]),
      prohibitedInferences: uniqueEvidenceStrings(input.reference?.prohibitedInferences, [
        'Do not invent visual objects, product capabilities, claims, colors, layouts, or audiences that are not visibly supported.',
        'Do not promote a small supporting icon into the dominant hero unless its measured bounding box proves it is dominant.',
      ]),
    },
    blueprint,
    slide: declaredType === 'carousel-slide' ? {
      referenceIndex,
      slideNumber: slideNumber || referenceIndex - 1,
      role: cleanText(input.slide?.role || 'observed sequence slide'),
      uniqueStructure: uniqueEvidenceStrings(measuredElements, input.slide?.uniqueStructure, observedTraits).slice(0, 20),
      retainedFamilyRules: uniqueEvidenceStrings(input.slide?.retainedFamilyRules, blueprint.invariants).slice(0, 12),
    } : undefined,
  }
}

function fallbackAggregateAssetEvidence(assets: AnalyzedManifestAsset[]): VisualEvidenceResult {
  const staticAsset = assets.find(asset => asset.reference.declaredType === 'static-creative')
  const carouselAssets = assets
    .filter(asset => asset.reference.declaredType === 'carousel-slide')
    .sort((a, b) => a.reference.referenceIndex - b.reference.referenceIndex)
  // A single empty model response must not discard every successful visual
  // measurement. Keep the partial, explicitly grounded evidence and let the
  // downstream production-readiness check record a warning instead.
  if (!staticAsset || carouselAssets.length === 0) return {}

  const carouselField = (field: keyof BrandSetupVisualBlueprint) => uniqueEvidenceStrings(
    ...carouselAssets.map(asset => asset.blueprint[field])
  ).slice(0, 24)
  const retainedRules = uniqueEvidenceStrings(...carouselAssets.map(asset => asset.slide?.retainedFamilyRules)).slice(0, 16)
  const recurringComponents = carouselField('recurringComponents')
  return {
    sourceEvidence: {
      sourcePriority: ['brand-guideline document', 'reference images', 'website'],
      references: assets.map(asset => asset.reference).sort((a, b) => a.referenceIndex - b.referenceIndex),
      repeatedPatterns: uniqueEvidenceStrings(retainedRules, recurringComponents).slice(0, 16),
      uncertainties: ['Cross-slide family rules are compiled from independent page measurements; confirm any rule that is not visibly repeated across the ordered source pages.'],
    },
    visualBlueprints: {
      staticSystem: staticAsset.blueprint,
      carouselSystem: {
        referenceIndexes: carouselAssets.map(asset => asset.reference.referenceIndex),
        canvas: carouselField('canvas'),
        zones: carouselField('zones'),
        recurringComponents,
        colorAndContrast: carouselField('colorAndContrast'),
        typographyBehavior: carouselField('typographyBehavior'),
        imageryAndDepth: carouselField('imageryAndDepth'),
        densityAndRhythm: carouselField('densityAndRhythm'),
        invariants: uniqueEvidenceStrings(retainedRules, carouselField('invariants')).slice(0, 20),
        prohibitedDrift: carouselField('prohibitedDrift'),
        slides: carouselAssets.map(asset => asset.slide!),
      },
    },
  }
}

async function analyzeManifestAsset(
  signedUrl: string,
  referenceIndex: number,
  declaredType: 'static-creative' | 'carousel-slide',
  slideNumber?: number,
  metadata?: Record<string, unknown>
): Promise<AnalyzedManifestAsset | null> {
  const label = declaredType === 'static-creative'
    ? 'standalone static reference'
    : `ordered carousel slide ${slideNumber}`
  const requestBody = {
    metadata,
    model: VISUAL_ANALYSIS_MODEL,
    systemPrompt: BRAND_SETUP_SINGLE_ASSET_EVIDENCE_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Analyze Reference ${referenceIndex}, the ${label}. Measure this canvas independently. Return JSON only.` },
        { type: 'image_url', image_url: { url: signedUrl, detail: 'high' } },
      ],
    }],
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(N8N_BRAND_SETUP_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        // GPT-5.6 Sol's high-reasoning visual analysis can take more than a
        // minute for a reference image. Do not cancel a still-running n8n
        // request before it has a chance to return its completed JSON result.
      })
      const responseText = await response.text()
      if (!response.ok) {
        console.warn('[brand-setup] reference analysis request failed', {
          referenceIndex,
          declaredType,
          attempt: attempt + 1,
          status: response.status,
          response: responseText.slice(0, 240),
        })
        continue
      }
      if (!responseText.trim()) {
        console.warn('[brand-setup] reference analysis returned an empty response', {
          referenceIndex,
          declaredType,
          attempt: attempt + 1,
        })
        continue
      }
      const envelope = JSON.parse(responseText) as { result?: SingleAssetEvidenceResult | string }
      if (!envelope.result) {
        console.warn('[brand-setup] reference analysis returned no result field', {
          referenceIndex,
          declaredType,
          attempt: attempt + 1,
          response: responseText.slice(0, 240),
        })
        continue
      }
      const parsed = (typeof envelope.result === 'string'
        ? JSON.parse(jsonrepair(envelope.result))
        : envelope.result) as SingleAssetEvidenceResult
      if (!parsed.reference || !parsed.blueprint) {
        console.warn('[brand-setup] reference analysis returned the wrong JSON shape', {
          referenceIndex,
          declaredType,
          attempt: attempt + 1,
          resultKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 12) : [],
        })
        continue
      }
      return normalizeAnalyzedAsset(parsed, referenceIndex, declaredType, slideNumber)
    } catch (error) {
      console.warn('[brand-setup] reference analysis threw before producing evidence', {
        referenceIndex,
        declaredType,
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
      })
      // Retry once. A failed reference remains explicit and never contaminates a
      // different feature's evidence.
    }
  }
  return null
}

async function aggregateManifestEvidence(
  assets: AnalyzedManifestAsset[],
  _metadata?: Record<string, unknown>
): Promise<VisualEvidenceResult> {
  const fallback = fallbackAggregateAssetEvidence(assets)
  // Keep the independent, page-level measurements intact. A second generative
  // summarization pass previously converted x/y/width/height evidence back into
  // generic phrases such as "text and illustration balance", which made every
  // compiled layout look the same and added another two-minute failure point.
  return fallback
}

/**
 * The vision pass sometimes places page measurements in visualBlueprints.slides
 * without repeating the same facts in sourceEvidence.references. Consolidate those
 * two grounded sections before validating instead of rejecting useful analysis for
 * a purely representational schema mismatch.
 */
function consolidateVisualEvidence(
  evidence: VisualEvidenceResult,
  hasOrderedCarousel: boolean
): VisualEvidenceResult {
  const blueprints = evidence.visualBlueprints
  if (!blueprints?.staticSystem || !blueprints.carouselSystem) return evidence

  const source = evidence.sourceEvidence || {
    sourcePriority: ['brand-guideline document', 'reference images', 'website'],
    references: [],
    repeatedPatterns: [],
    uncertainties: [],
  }
  const existingByIndex = new Map<number, BrandSetupReferenceEvidence>(
    (Array.isArray(source.references) ? source.references : [])
      .filter(reference => Number.isInteger(reference?.referenceIndex))
      .map(reference => [reference.referenceIndex, reference])
  )
  const staticSystem = blueprints.staticSystem
  const carouselSystem = blueprints.carouselSystem
  const staticFacts = uniqueEvidenceStrings(
    staticSystem.canvas,
    staticSystem.zones,
    staticSystem.recurringComponents,
    staticSystem.colorAndContrast,
    staticSystem.typographyBehavior,
    staticSystem.imageryAndDepth,
    staticSystem.densityAndRhythm,
    staticSystem.invariants
  )
  const carouselSharedFacts = uniqueEvidenceStrings(
    carouselSystem.canvas,
    carouselSystem.zones,
    carouselSystem.recurringComponents,
    carouselSystem.colorAndContrast,
    carouselSystem.typographyBehavior,
    carouselSystem.imageryAndDepth,
    carouselSystem.densityAndRhythm,
    carouselSystem.invariants
  )
  const expectedIndexes = hasOrderedCarousel
    ? Array.from({ length: REQUIRED_CAROUSEL_PAGES + 1 }, (_, index) => index + 1)
    : Array.from(new Set([
      ...Array.from(existingByIndex.keys()),
      ...staticSystem.referenceIndexes,
      ...carouselSystem.referenceIndexes,
    ])).sort((a, b) => a - b)

  const references = expectedIndexes.map(referenceIndex => {
    const existing = existingByIndex.get(referenceIndex)
    const isStatic = hasOrderedCarousel ? referenceIndex === 1 : staticSystem.referenceIndexes.includes(referenceIndex)
    const slide = carouselSystem.slides.find(item => item.referenceIndex === referenceIndex)
      || (hasOrderedCarousel ? carouselSystem.slides[referenceIndex - 2] : undefined)
    const observedTraits = uniqueEvidenceStrings(
      existing?.observedTraits,
      slide?.uniqueStructure,
      slide?.retainedFamilyRules,
      isStatic ? staticFacts : carouselSharedFacts
    ).slice(0, 18)

    return {
      referenceIndex,
      declaredType: isStatic ? 'static-creative' : 'carousel-slide',
      classifiedType: 'campaign-creative',
      observedTraits,
      allowedInfluence: uniqueEvidenceStrings(existing?.allowedInfluence, [
        isStatic
          ? 'May control standalone-static grid, hierarchy, safe zones, module anatomy, palette placement, and illustration scale.'
          : 'May control this ordered carousel page geometry and the repeated family system shared across the six-page sequence.',
      ]),
      prohibitedInferences: uniqueEvidenceStrings(existing?.prohibitedInferences, [
        'Do not infer product capabilities, claims, audiences, photography, or interface behavior that is not visibly supported.',
        'Do not enlarge a minor icon or decorative motif into the primary hero unless the measured blueprint records it as dominant.',
      ]),
    } satisfies BrandSetupReferenceEvidence
  })

  return {
    sourceEvidence: {
      sourcePriority: uniqueEvidenceStrings(source.sourcePriority).length
        ? uniqueEvidenceStrings(source.sourcePriority)
        : ['brand-guideline document', 'reference images', 'website'],
      references,
      repeatedPatterns: uniqueEvidenceStrings(
        source.repeatedPatterns,
        carouselSystem.invariants,
        carouselSystem.recurringComponents
      ),
      uncertainties: uniqueEvidenceStrings(source.uncertainties),
    },
    visualBlueprints: blueprints,
  }
}

function creativePromptCore(prompt: string): string {
  return prompt.split(/\n\nTechnical production contract:/i)[0].trim()
}

function rendererLayoutContract(config: BrandSetupOverlayConfig): string {
  const textPercent = config.splitPercent ?? (config.splitLayout === 'free' ? 40 : 100 - config.splitRatio)
  const visualPercent = 100 - textPercent
  const fixedOverlay = `Puppeteer owns the overlay coordinates: text (${config.textX ?? 0}, ${config.textY ?? 0}), logo (${config.logoX ?? 60}, ${config.logoY ?? 48}), CTA (${config.ctaStyle?.x ?? 60}, ${config.ctaStyle?.y ?? 900}). The background must not draw a boundary, panel, card, banner, box, or placeholder around those coordinates.`
  if (config.splitLayout === 'right-image') {
    return `Keep the left ${textPercent}% as continuous quiet negative space and the right ${visualPercent}% as the visual zone. The primary visual must remain on the right; deterministic text renders on the left. ${fixedOverlay}`
  }
  if (config.splitLayout === 'left-image') {
    return `Keep the right ${textPercent}% as continuous quiet negative space and the left ${visualPercent}% as the visual zone. The primary visual must remain on the left; deterministic text renders on the right. ${fixedOverlay}`
  }
  if (config.verticalAlign === 'top') {
    return `Keep the top ${textPercent}% as continuous quiet negative space and the bottom ${visualPercent}% as the visual zone in a free composition. ${fixedOverlay}`
  }
  if (config.verticalAlign === 'bottom') {
    return `Keep the bottom ${textPercent}% as continuous quiet negative space and the top ${visualPercent}% as the visual zone in a free composition. ${fixedOverlay}`
  }
  return `Keep the central ${textPercent}% as continuous quiet negative space and use the outer ${visualPercent}% as a controlled visual zone in a free composition. ${fixedOverlay}`
}

async function runCompiler<T>(systemPrompt: string, input: unknown, metadata?: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(N8N_BRAND_SETUP_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata,
        model: MODEL,
        reasoningEffort: 'low',
        maxOutputTokens: 8_000,
        systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
      }),
      // n8n's OpenAI HTTP node allows 120 seconds. Leave a small margin so the
      // application, rather than an intermediate 80-second abort, owns errors.
    })
    if (!response.ok) return null
    const responseText = await response.text()
    if (!responseText.trim()) return null
    const envelope = JSON.parse(responseText) as { result?: T | string }
    if (!envelope.result) return null
    return (typeof envelope.result === 'string'
      ? JSON.parse(jsonrepair(envelope.result))
      : envelope.result) as T
  } catch {
    return null
  }
}

function hasCompletePromptStructure(result: BrandSetupResult): boolean {
  return result.staticLayouts.length === 5
    && result.editableTemplates.length === 5
    && result.carouselLayouts.length === 2
    && result.carouselLayouts.every(layout => layout.slides.length === 6)
}

async function tryRepairPromptStructure(result: BrandSetupResult): Promise<BrandSetupResult | null> {
  type StaticStructure = {
    staticLayouts?: Array<{ name: string; prompt: string }>
    editableTemplates?: Array<{ name: string; bgPrompt?: string; puppeteerConfig?: Partial<BrandSetupOverlayConfig> }>
  }
  type CarouselStructure = {
    name?: string
    slides?: Array<{
      slideIndex: number
      role: 'title' | 'problem' | 'insight' | 'shift' | 'action' | 'cta'
      prompt: string
      puppeteerConfig?: Partial<BrandSetupOverlayConfig>
    }>
  }
  const staticReferences = result.sourceEvidence.references.filter(reference => reference.declaredType === 'static-creative')
  const carouselReferences = result.sourceEvidence.references.filter(reference => reference.declaredType === 'carousel-slide')
  const shared = {
    brandName: result.brandName,
    brandDescription: result.brandDescription,
    infographicGuidelines: result.infographicGuidelines,
    palette: result.palette,
    typography: result.typography,
    repeatedPatterns: result.sourceEvidence.repeatedPatterns,
    visualBlueprints: result.visualBlueprints,
  }
  const staticSystemPrompt = `You recover only the missing static-layout structure for ContentBeta. Return JSON only:
{"staticLayouts":[{"name":"","prompt":""}],"editableTemplates":[{"name":"","bgPrompt":"","puppeteerConfig":{}}]}
Return exactly five staticLayouts and five editableTemplates in matching order. Use only the supplied standalone-static evidence. Each prompt is a 90-130 word reusable square 1:1 background concept seed with atomic evidence, copy-analysis logic, an exact text-safe zone, complementary visual zone, subject anatomy, palette, depth, density, and restrictions. Adapt a vertical reference into square without calling the final output vertical. Do not request rendered marketing text or a logo. Each config needs splitLayout (free, left-image, or right-image), splitRatio (30-65), splitPercent (30-75), bgColor, headlineColor, microcopyColor, accentColor, textAccentColor, textAlign, verticalAlign, logoPosition, and ctaPosition. Use materially different compositions grounded in the same reference. Set every bgPrompt to an empty string.`
  const carouselSystemPrompt = `You recover one missing six-slide carousel structure for ContentBeta. Return JSON only:
{"name":"","slides":[{"slideIndex":1,"role":"title","prompt":"","puppeteerConfig":{}}]}
Return exactly six slides in this order: title, problem, insight, shift, action, cta. Each prompt is a 70-100 word reusable square 1:1 background concept seed with atomic evidence, copy-analysis logic, exact safe/visual zones, scene anatomy, palette, depth, density, and restrictions. Do not request rendered marketing text or a logo. Each config needs splitLayout (free, left-image, or right-image), splitRatio (30-65), splitPercent (30-75), bgColor, headlineColor, microcopyColor, accentColor, textAccentColor, textAlign, verticalAlign, logoPosition, and ctaPosition. Preserve supported brand facts only; never invent photography, UI, claims, or capabilities.`

  const needsStatic = result.staticLayouts.length !== 5 || result.editableTemplates.length !== 5
  const needsCarousels = result.carouselLayouts.length !== 2 || result.carouselLayouts.some(layout => layout.slides.length !== 6)
  const [staticRepair, referenceCarousel, alternateCarousel] = await Promise.all([
    needsStatic
      ? runCompiler<StaticStructure>(staticSystemPrompt, {
        ...shared,
        sourceEvidence: staticReferences.length ? staticReferences : result.sourceEvidence.references,
        instruction: 'Create five square static compositions primarily from the standalone-static reference group.',
      })
      : Promise.resolve(null),
    needsCarousels
      ? runCompiler<CarouselStructure>(carouselSystemPrompt, {
        ...shared,
        sourceEvidence: carouselReferences.length ? carouselReferences : result.sourceEvidence.references,
        instruction: 'Create the reference-led family. Preserve the supplied carousel references in exact input order and preserve their repeated template, grid, hierarchy, illustration language, and progression.',
      })
      : Promise.resolve(null),
    needsCarousels
      ? runCompiler<CarouselStructure>(carouselSystemPrompt, {
        ...shared,
        sourceEvidence: carouselReferences.length ? carouselReferences : result.sourceEvidence.references,
        instruction: 'Create a second evidence-backed data-and-illustration family that is materially different from the reference-led family. Do not invent photography or product UI.',
      })
      : Promise.resolve(null),
  ])

  const repairedStaticLayouts = staticRepair?.staticLayouts?.length === 5 ? staticRepair.staticLayouts : result.staticLayouts
  const repairedEditableTemplates = staticRepair?.editableTemplates?.length === 5 ? staticRepair.editableTemplates : result.editableTemplates
  const repairedCarouselLayouts = referenceCarousel?.slides?.length === 6 && alternateCarousel?.slides?.length === 6
    ? [referenceCarousel, alternateCarousel]
    : result.carouselLayouts
  const normalized = normalizeBrandSetupResult({
    ...result,
    brandName: result.brandName,
    staticLayouts: repairedStaticLayouts,
    editableTemplates: repairedEditableTemplates,
    carouselLayouts: repairedCarouselLayouts,
    warnings: [...result.warnings, 'Incomplete AI schema was rebuilt in smaller bounded calls before prompt compilation.'],
  }, result.brandName)
  return hasCompletePromptStructure(normalized) ? normalized : null
}

function localEvidence(reference: BrandSetupReferenceEvidence | undefined, fallback: string): string[] {
  const traits = reference?.observedTraits
    ?.filter(Boolean)
    .map(trait => trait.replace(/\breference\s+\d+\b/gi, 'the uploaded creative'))
    .slice(0, 8) || []
  return traits.length >= 6
    ? traits.slice(0, 8)
    : [...traits, fallback, 'preserve the measured safe-zone boundary', 'preserve the observed component scale', 'preserve the observed whitespace rhythm'].slice(0, 8)
}

function localProductionPromptLibrary(result: BrandSetupResult): BrandSetupResult | null {
  if (!hasCompletePromptStructure(result)) return null
  const staticReference = result.sourceEvidence.references.find(reference => reference.declaredType === 'static-creative')
  const carouselReferences = result.sourceEvidence.references.filter(reference => reference.declaredType === 'carousel-slide')
  if (!staticReference || carouselReferences.length < 6) return null

  const staticBlueprint = result.visualBlueprints.staticSystem
  const carouselBlueprint = result.visualBlueprints.carouselSystem
  const staticTraits = localEvidence(staticReference, 'retain the standalone creative composition')
  const staticBlueprintFacts = uniqueEvidenceStrings(
    staticBlueprint.canvas,
    staticBlueprint.zones,
    staticBlueprint.recurringComponents,
    staticBlueprint.colorAndContrast,
    staticBlueprint.typographyBehavior,
    staticBlueprint.imageryAndDepth,
    staticBlueprint.densityAndRhythm,
    staticBlueprint.invariants
  ).slice(0, 16).map(item => item.replace(/\breference\s+\d+\b/gi, 'the uploaded static creative'))
  const staticRestrictions = [
    'Do not replace the uploaded composition with a generic topic symbol or cinematic wallpaper.',
    'Do not promote a minor reference icon into the primary hero.',
    'Do not put visual modules, texture, glow, or illustrations inside the renderer text-safe zone.',
    'Do not invent claims, customer metrics, product capabilities, certifications, or interfaces.',
    'Do not change a light reference into a dark neon canvas or a flat reference into photorealism.',
    'Do not add people, devices, shields, locks, circuits, dashboards, or charts unless the reference supports them.',
    'Do not increase the observed subject, icon, chart, or illustration count merely to fill space. An evidence-backed dashboard may remain one complete hero subject.',
    'Do not imitate long source copy; reproduce only the visible design grammar and subject or scene anatomy.',
    'Do not render headline, body copy, CTA, logo, watermark, brand name, or decorative fake text.',
    'Do not crop the primary visual, break the outer margin, or cover the deterministic overlay reserve.',
    'Do not draw a blank card, empty panel, placeholder rectangle, banner, text-holder box, callout box, or framed copy area; negative space must remain part of the continuous background.',
    'Every visual-side module must be complete and meaningful: no blank white cards, empty rounded tiles, vacant UI rows, skeleton widgets, unused list panels, or containers waiting for copy. A module is allowed only when its interior is fully occupied by one coherent nonverbal illustration, icon, product view, or abstract unlabeled visualization; otherwise remove it.',
    'A real product dashboard, report, device, or application screen may appear only as the evidence-backed hero subject in the visual zone, never as a container for overlay copy.',
  ]

  const configPreset = (
    base: BrandSetupOverlayConfig,
    preset: Partial<BrandSetupOverlayConfig>,
    mode: 'editable' | 'carousel',
    role?: 'title' | 'problem' | 'insight' | 'shift' | 'action' | 'cta'
  ): BrandSetupOverlayConfig => {
    const next = { ...base, ...preset }
    return lockBrandSetupOverlayLayout(next, mode, role)
  }

  const staticModes: Array<{
    name: string
    purpose: string
    adaptation: string
    hierarchy: string
    preset: Partial<BrandSetupOverlayConfig>
  }> = [
    {
      name: `${result.brandName} Right-Side Hero`,
      purpose: 'Create a right-weighted hero background with a permanently clear left copy zone.',
      adaptation: 'Retain one evidence-backed person, product screen, device, vehicle, illustration, or object cluster on the right. Use crop, lighting, blur, or a natural gradient to transition into an open left field; never manufacture a copy container.',
      hierarchy: 'One primary subject on the right, optional subtle environmental context, and uninterrupted negative space on the left.',
      preset: { splitLayout: 'right-image', splitPercent: 50, verticalAlign: 'top', textAlign: 'left', bgColor: result.palette.light, headlineColor: result.palette.dark, microcopyColor: result.palette.dark },
    },
    {
      name: `${result.brandName} Left-Side Hero`,
      purpose: 'Create a left-weighted hero background with a permanently clear right copy zone.',
      adaptation: 'Place one evidence-backed primary subject on the left and preserve the source medium and crop. Fade the environment naturally into the open right field without drawing a dividing panel or edge.',
      hierarchy: 'One primary subject on the left and a broad, continuous right-side copy reserve with no secondary cards.',
      preset: { splitLayout: 'left-image', splitPercent: 50, verticalAlign: 'top', textAlign: 'left', bgColor: result.palette.light, headlineColor: result.palette.dark, microcopyColor: result.palette.dark },
    },
    {
      name: `${result.brandName} Lower Visual`,
      purpose: 'Create an editorial background with fixed copy at the top and the subject anchored below.',
      adaptation: 'Crop one evidence-backed visual across the lower portion of the square. The upper field stays naturally open through sky, wall, atmosphere, soft color, or brand field—not through an empty box.',
      hierarchy: 'One lower focal subject with calm upper negative space and no floating copy panels.',
      preset: { splitLayout: 'free', splitPercent: 44, verticalAlign: 'top', textAlign: 'left', bgColor: result.palette.light, headlineColor: result.palette.dark, microcopyColor: result.palette.dark },
    },
    {
      name: `${result.brandName} Upper Visual`,
      purpose: 'Create an editorial background with the subject anchored above and a fixed lower copy zone.',
      adaptation: 'Keep one evidence-backed visual across the upper portion and transition into a broad lower brand field. The transition must be photographic, atmospheric, or color-based, never a blank information panel.',
      hierarchy: 'One upper focal subject and uninterrupted lower negative space suitable for deterministic text and CTA overlays.',
      preset: { splitLayout: 'free', splitPercent: 44, verticalAlign: 'bottom', textAlign: 'left', bgColor: result.palette.light, headlineColor: result.palette.dark, microcopyColor: result.palette.dark },
    },
    {
      name: `${result.brandName} Corner Focus`,
      purpose: 'Create a spacious brand field with one compact evidence-backed subject cluster confined to a corner.',
      adaptation: 'Reduce the supported person, product, UI screen, device, or illustration to one art-directed corner focal point. Keep the remaining canvas continuous, quiet, and unframed for fixed overlays.',
      hierarchy: 'One compact corner subject and the largest negative-space reserve of the five layouts; no callout shapes or text placeholders.',
      preset: { splitLayout: 'right-image', splitPercent: 58, verticalAlign: 'center', textAlign: 'left', bgColor: result.palette.secondary, headlineColor: result.palette.light, microcopyColor: result.palette.light },
    },
  ]

  const compiledStaticConfigs = staticModes.map((mode, index) => configPreset(
    result.editableTemplates[index].puppeteerConfig,
    mode.preset,
    'editable'
  ))
  const staticLayouts = staticModes.map((mode, index) => {
    const config = compiledStaticConfigs[index]
    const prompt = [
      `PURPOSE: ${mode.purpose} Create a square 1:1, 1080x1080 full-bleed AI background for ${result.brandName}. The result is not a finished poster: deterministic HTML overlays add all real copy, logo, and CTA.`,
      `EVIDENCE BASIS: Reference ${staticReference.referenceIndex} — ${staticTraits.join('; ')}.`,
      `REFERENCE BLUEPRINT: ${staticBlueprintFacts.join('; ') || 'Preserve the measured standalone canvas, zones, component scale, and whitespace.'} These measurements are authoritative. Preserve the source brightness, component vocabulary, scale relationships, illustration treatment, and outer margin before adapting its aspect ratio.`,
      `COPY ANALYSIS: Analyze the supplied copy for the main message, content type, number of facts, emotional tone, and strongest proof. Route the content into this layout only when its information shape fits; never let a topic cliché override the uploaded visual evidence.`,
      `SCENE SELECTION: product or software benefit → use one evidence-backed device, report, dashboard, or UI as the hero subject in the visual zone; people or physical service → use one evidence-backed person, vehicle, workplace, or environmental subject; metric or research finding → use one abstract unlabeled visual motif only when supported; short benefit statement → simplify to one focal reference-supported object; no clear match → preserve this layout's geometry and reduce visual density rather than inventing a scene.`,
      `ADAPTATION BLUEPRINT: ${mode.adaptation} ${mode.hierarchy}`,
      `LAYOUT: ${rendererLayoutContract(config)} Keep every generated object outside the quiet overlay reserve. Preserve observed crop, overlap, whitespace rhythm, and edge alignment. The reserve stays visually continuous with the canvas and has no border, fill patch, card, or panel.`,
      `VISUAL EXECUTION: Use saved palette roles ${result.palette.primary}, ${result.palette.secondary}, and ${result.palette.accent} only where the evidence supports them. Reproduce the observed flat-versus-dimensional balance, corner radii, border weight, shadows, illustration geometry, and foreground/midground/background order.`,
      `DENSITY AND LEGIBILITY: ${mode.hierarchy} Retain one decisive focal point and enough continuous negative space to understand the visual in three seconds. Tiny functional marks may be abstract shapes only; they must not resemble generated marketing text or empty UI.`,
      `RESTRICTIONS: ${staticRestrictions.map((rule, ruleIndex) => `${ruleIndex + 1}. ${rule}`).join(' ')}`,
      'FINAL OUTPUT: One continuous full-bleed, reference-faithful square background with a deliberately empty overlay region and one clearly art-directed visual system—no rendered marketing copy and no logo.',
    ].join('\n\n')
    return { name: mode.name, prompt }
  })

  const referenceFamilyPresets: Partial<BrandSetupOverlayConfig>[] = [
    { splitLayout: 'right-image', splitPercent: 62, verticalAlign: 'top', textAlign: 'left' },
    { splitLayout: 'free', splitPercent: 46, verticalAlign: 'top', textAlign: 'left' },
    { splitLayout: 'free', splitPercent: 48, verticalAlign: 'top', textAlign: 'left' },
    { splitLayout: 'free', splitPercent: 48, verticalAlign: 'top', textAlign: 'left' },
    { splitLayout: 'free', splitPercent: 48, verticalAlign: 'top', textAlign: 'left' },
    { splitLayout: 'free', splitPercent: 44, verticalAlign: 'top', textAlign: 'left' },
  ]
  const alternateFamilyPresets: Partial<BrandSetupOverlayConfig>[] = [
    { splitLayout: 'free', splitPercent: 40, verticalAlign: 'top', textAlign: 'center' },
    { splitLayout: 'right-image', splitPercent: 50, verticalAlign: 'center', textAlign: 'left' },
    { splitLayout: 'left-image', splitPercent: 48, verticalAlign: 'center', textAlign: 'left' },
    { splitLayout: 'free', splitPercent: 38, verticalAlign: 'bottom', textAlign: 'left' },
    { splitLayout: 'right-image', splitPercent: 46, verticalAlign: 'center', textAlign: 'left' },
    { splitLayout: 'left-image', splitPercent: 54, verticalAlign: 'bottom', textAlign: 'left' },
  ]
  const roleDirections = [
    'Cover: use one restrained evidence-backed hero subject in the visual zone and leave the fixed headline area open.',
    'Problem: use one evidence-backed tension subject or symbolic focal object; no response panel and no statistic card.',
    'Insight: use one evidence-backed product, person, device, or abstract visual with a different crop; no recommendation boxes.',
    'Shift: use one evidence-backed transformation or contrast expressed by subject placement, light, color, or motion; no implication panel.',
    'Action: use one evidence-backed practical subject or product view; supporting detail remains environmental rather than boxed.',
    'CTA: use the simplest evidence-backed closing visual and the largest continuous empty field for deterministic summary and CTA overlays.',
  ]
  const alternateDirections = [
    'Use bold negative space and one small reference-derived subject cluster; omit all bands, cards, and navigation graphics.',
    'Use one larger evidence-backed subject with an alternate crop and a calm continuous copy reserve.',
    'Reverse the visual side while preserving the family palette, medium, and fixed overlay clearance.',
    'Use one upper visual subject and an open lower field; express contrast through lighting and crop only.',
    'Use a diagonal subject progression made from real evidence-backed objects, not modules or response panels.',
    'Use one restrained closing subject and more negative space than every previous slide.',
  ]
  const carouselRestrictions = [
    'Do not promote a minor reference icon into the primary hero.',
    'Do not invent claims, metrics, people, photography, UI, or product capabilities.',
    'Do not replace the measured family background with generic neon cybersecurity art.',
    'Do not move generated visuals into the deterministic text-safe zone.',
    'Do not render headline, paragraph, CTA, logo, watermark, brand name, or decorative fake text.',
    'Do not change the observed illustration medium, depth, subject construction, or palette placement. Preserve real product UI only when it is the evidence-backed hero subject.',
    'Do not reuse the same visual scene on another role; each page keeps its own measured anatomy.',
    'Do not break the shared outer margin, navigation anchor, or recurring family rhythm.',
    'Do not draw blank cards, empty panels, placeholder rectangles, statistic boxes, text-holder banners, fake forms, or framed copy areas.',
    'A real evidence-backed product UI may be the hero subject in the visual zone, but it may not be simplified into an empty box for later text.',
  ]

  const carouselLayouts = result.carouselLayouts.map((layout, layoutIndex) => ({
    ...layout,
    name: layoutIndex === 0
      ? `${result.brandName} Reference-Faithful Sequence`
      : `${result.brandName} Alternate Visual Sequence`,
    slides: layout.slides.map((slide, slideIndex) => {
      const reference = carouselReferences[slideIndex]
      const pageBlueprint = carouselBlueprint.slides.find(item => item.referenceIndex === reference.referenceIndex)
      const traits = localEvidence(reference, 'retain the corresponding carousel page structure')
      const pageStructure = uniqueEvidenceStrings(
        pageBlueprint?.uniqueStructure,
        pageBlueprint?.retainedFamilyRules,
      ).slice(0, 14).map(item => item.replace(/\breference\s+\d+\b/gi, 'the matching carousel slide'))
      const sharedFamilyFacts = uniqueEvidenceStrings(
        carouselBlueprint.canvas,
        carouselBlueprint.colorAndContrast,
        carouselBlueprint.recurringComponents,
        carouselBlueprint.typographyBehavior,
        carouselBlueprint.imageryAndDepth,
        carouselBlueprint.invariants,
        result.sourceEvidence.repeatedPatterns
      ).slice(0, 12)
      const config = configPreset(
        slide.puppeteerConfig,
        {
          ...(layoutIndex === 0 ? referenceFamilyPresets[slideIndex] : alternateFamilyPresets[slideIndex]),
          bgColor: result.palette.secondary,
          headlineColor: result.palette.light,
          microcopyColor: result.palette.light,
          accentColor: result.palette.accent,
          textAccentColor: result.palette.dark,
          accentBgEnabled: false,
          accentBgColor: null,
        },
        'carousel',
        slide.role
      )
      const familyDirection = layoutIndex === 0 ? roleDirections[slideIndex] : alternateDirections[slideIndex]
      const prompt = [
        `PURPOSE: Build the ${slide.role} page of the ${layoutIndex === 0 ? 'reference-faithful' : 'alternate reference-led'} ${result.brandName} carousel as a square 1:1, 1080x1080 full-bleed background. Deterministic HTML overlays add every real word, logo, and CTA.`,
        `EVIDENCE BASIS: Reference ${reference.referenceIndex} — ${traits.join('; ')}.`,
        `REFERENCE BLUEPRINT: ${pageStructure.join('; ') || 'Preserve this page-specific measured composition.'} SHARED FAMILY EVIDENCE: ${sharedFamilyFacts.join('; ') || 'Preserve only the repeated anchors proven across the ordered six-page sequence.'}`,
        `COPY ANALYSIS: Analyze the supplied ${slide.role} copy for message length, whether it contains a statistic, comparison, list, process, or action, and its strongest proof. Adapt the content density to this page; never invent an extra message merely to occupy a reference module.`,
        `SCENE SELECTION: product or software copy → use one evidence-backed device, dashboard, report, or UI as the hero subject; people or service copy → use one evidence-backed person, workplace, vehicle, or environmental subject; statistic or proof → use one unlabeled abstract motif only if the reference supports it; risk or problem → use one tension object; action or process → use one practical subject; short title → use one small visual cluster and generous negative space; no clear match → preserve page geometry and reduce detail.`,
        `ROLE-SPECIFIC ANATOMY: ${familyDirection}`,
        `LAYOUT: ${rendererLayoutContract(config)} Preserve the measured crop, outer margin, and subject scale. Generated subjects and subtle patterns stay in the complementary visual zone. Do not generate navigation arrows, text bands, cards, or panels; the application adds functional overlays later.`,
        `VISUAL EXECUTION: Retain the evidence-backed canvas brightness, palette placement, continuous background construction, illustration or photographic medium, shadow language, and recurring family rhythm. Evidence-backed product UI may remain inside the hero subject; never reproduce a band, card, or panel as a holder for renderer copy. The ${slide.role} page must remain recognizably related to the other five pages while its subject hierarchy stays unique.`,
        `DENSITY: Use one focal subject grouping plus at most two small evidence-backed supporting objects. Maintain a clear foreground, restrained midground, quiet continuous background, and immediate three-second comprehension.`,
        `RESTRICTIONS: ${carouselRestrictions.map((rule, ruleIndex) => `${ruleIndex + 1}. ${rule}`).join(' ')}`,
        'FINAL OUTPUT: One continuous full-bleed carousel background with a deliberately empty renderer-aligned copy reserve, exact reference-derived page anatomy, no rendered marketing copy, and no logo.',
      ].join('\n\n')
      return { ...slide, prompt, puppeteerConfig: config }
    }),
  }))

  return normalizeBrandSetupResult({
    ...result,
    staticLayouts,
    editableTemplates: result.editableTemplates.map((template, index) => ({
      ...template,
      name: staticModes[index].name,
      bgPrompt: '',
      puppeteerConfig: compiledStaticConfigs[index],
    })),
    carouselLayouts,
    warnings: [...result.warnings, 'Production prompt programs were rebuilt into five distinct static adaptations and two role-specific carousel families from page-level evidence.'],
  }, result.brandName)
}

async function tryCompilePromptLibraryWithN8n(result: BrandSetupResult): Promise<BrandSetupResult | null> {
  if (!hasCompletePromptStructure(result)) return null
  const sharedBrandSystem = {
    brandName: result.brandName,
    sourceEvidence: result.sourceEvidence,
    visualBlueprints: result.visualBlueprints,
    brandDescription: result.brandDescription,
    infographicGuidelines: result.infographicGuidelines,
    palette: result.palette,
    typography: result.typography,
    warnings: result.warnings,
  }
  const staticInput = {
    ...sharedBrandSystem,
    staticLayouts: result.staticLayouts.map((layout, index) => ({
      name: layout.name,
      conceptSeed: creativePromptCore(layout.prompt),
      rendererLayoutContract: rendererLayoutContract(result.editableTemplates[index].puppeteerConfig),
      rendererConfig: result.editableTemplates[index].puppeteerConfig,
    })),
  }
  const orderedCarouselReferenceIndexes = result.sourceEvidence.references
    .filter(reference => reference.declaredType === 'carousel-slide')
    .map(reference => reference.referenceIndex)
  const carouselInputs = result.carouselLayouts.map((layout, layoutIndex) => ({
    ...sharedBrandSystem,
    familyName: layout.name,
    familyMode: layoutIndex === 0 ? 'reference-led' : 'alternate',
    orderedCarouselReferenceIndexes,
    slides: layout.slides.map(slide => ({
      role: slide.role,
      conceptSeed: creativePromptCore(slide.prompt),
      rendererLayoutContract: rendererLayoutContract(slide.puppeteerConfig),
      rendererConfig: slide.puppeteerConfig,
    })),
  }))
  const [staticCompiled, firstCarousel, secondCarousel] = await Promise.all([
    runCompiler<StaticCompilerResult>(BRAND_SETUP_STATIC_COMPILER_PROMPT, staticInput),
    runCompiler<CarouselCompilerResult>(BRAND_SETUP_CAROUSEL_COMPILER_PROMPT, carouselInputs[0]),
    runCompiler<CarouselCompilerResult>(BRAND_SETUP_CAROUSEL_COMPILER_PROMPT, carouselInputs[1]),
  ])
  let validStatic = staticCompiled?.staticLayouts?.length === 5 ? staticCompiled.staticLayouts : null
  let compiledCarousels = [firstCarousel, secondCarousel].map(compiled => compiled?.slides?.length === 6 ? compiled.slides : null)
  if (!validStatic && !compiledCarousels.some(Boolean)) return null

  const mergeCompiledPrompts = (retryApplied = false): BrandSetupResult => normalizeBrandSetupResult({
      ...result,
      staticLayouts: result.staticLayouts.map((layout, index) => ({
        ...layout,
        prompt: validStatic?.[index]?.prompt?.trim() || layout.prompt,
      })),
      editableTemplates: result.editableTemplates.map(template => ({ ...template, bgPrompt: '' })),
      carouselLayouts: result.carouselLayouts.map((layout, layoutIndex) => ({
        ...layout,
        slides: layout.slides.map((slide, slideIndex) => ({
          ...slide,
          prompt: compiledCarousels[layoutIndex]?.[slideIndex]?.prompt?.trim() || slide.prompt,
        })),
      })),
      warnings: [
        ...result.warnings,
        'Concept seeds were compiled into separate production-grade static and carousel prompt programs.',
        ...(retryApplied ? ['Prompt compilers automatically rewrote output that failed the evidence and consistency gate.'] : []),
      ],
    }, result.brandName)

  let merged = mergeCompiledPrompts()
  const firstPassIssues = validateBrandSetupResult(merged)
  const staticIssues = firstPassIssues.filter(issue => /^(static layout|editable template)/.test(issue))
  const carouselIssues = [0, 1].map(layoutIndex => firstPassIssues.filter(issue => issue.startsWith(`carousel ${layoutIndex + 1},`)))
  if (staticIssues.length || carouselIssues.some(issues => issues.length)) {
    const retryInstruction = `\n\nREWRITE AFTER REJECTION: The previous attempt failed mandatory checks. Correct every supplied rejection item. Do not defend or repeat the rejected output. Evidence lists, topic → scene rules, numbered restrictions, overlay exclusions, and the renderer direction must follow the required grammar exactly.`
    const [retriedStatic, retriedFirstCarousel, retriedSecondCarousel] = await Promise.all([
      staticIssues.length
        ? runCompiler<StaticCompilerResult>(BRAND_SETUP_STATIC_COMPILER_PROMPT + retryInstruction, {
          ...staticInput,
          rejectionFeedback: staticIssues,
          rejectedPrompts: validStatic,
        })
        : Promise.resolve(null),
      carouselIssues[0].length
        ? runCompiler<CarouselCompilerResult>(BRAND_SETUP_CAROUSEL_COMPILER_PROMPT + retryInstruction, {
          ...carouselInputs[0],
          rejectionFeedback: carouselIssues[0],
          rejectedPrompts: compiledCarousels[0],
        })
        : Promise.resolve(null),
      carouselIssues[1].length
        ? runCompiler<CarouselCompilerResult>(BRAND_SETUP_CAROUSEL_COMPILER_PROMPT + retryInstruction, {
          ...carouselInputs[1],
          rejectionFeedback: carouselIssues[1],
          rejectedPrompts: compiledCarousels[1],
        })
        : Promise.resolve(null),
    ])
    if (retriedStatic?.staticLayouts?.length === 5) validStatic = retriedStatic.staticLayouts
    if (retriedFirstCarousel?.slides?.length === 6) compiledCarousels[0] = retriedFirstCarousel.slides
    if (retriedSecondCarousel?.slides?.length === 6) compiledCarousels[1] = retriedSecondCarousel.slides
    merged = mergeCompiledPrompts(true)
  }
  return merged
}

async function tryCompilePromptLibrary(result: BrandSetupResult): Promise<BrandSetupResult | null> {
  // The deterministic compiler keeps generation reliable when n8n has already
  // completed the visual pass but its long follow-up calls exceed the webhook
  // response window. It uses only the saved evidence and renderer geometry.
  return localProductionPromptLibrary(result)
}

function buildInfographicLayouts(result: BrandSetupResult): BrandSetupResult['infographicLayouts'] {
  const { primary, secondary, accent, dark, light, text } = result.palette
  const heading = result.typography.headingFont || 'Inter'
  const body = result.typography.bodyFont || 'Inter'
  const shared = [
    `TYPOGRAPHY AND COLOR APPLICATION: Use ${heading} at weight ${result.typography.headingWeight} for headlines, hero numbers, and section anchors; use ${body} at weight ${result.typography.bodyWeight} for labels and explanations. Build the palette from primary ${primary}, secondary ${secondary}, accent ${accent}, dark ${dark}, light ${light}, and text ${text}. Select foreground/background pairs only when they remain legible; the saved infographic brand guide is authoritative when it defines a stricter pairing.`,
    'OVERFLOW/FITTING RULES: Measure every line before drawing. Reduce font size in 2px steps only after trying a shorter line break; never drop below 52px for the headline, 72px for the hero metric, 24px for supporting copy, or 18px for labels. Limit headlines to three lines, labels to two lines, and body modules to four lines. If content still overflows, reduce module count or switch to the next compatible layout instead of clipping.',
    'RESTRICTIONS: Do not invent claims, statistics, categories, comparisons, steps, CTA text, or product capabilities. Do not use random colors, decorative charts, generic neon technology styling, dense microtext, simultaneous entrances, uncontrolled glow, or a logo drawn by AI. Keep every animated layer independently addressable for future motion export.',
  ]
  const make = (name: string, purpose: string, routing: string, zones: string, anatomy: string, data: string, motion: string, output: string) => ({
    name: `${result.brandName} ${name}`,
    isActive: true,
    description: [
      `PURPOSE: ${purpose}`,
      `CONTENT ROUTING: ${routing}`,
      `CANVAS ZONES: ${zones}`,
      `COMPONENT ANATOMY: ${anatomy}`,
      `DATA/CHART BEHAVIOR: ${data}`,
      ...shared,
      `MOTION SEQUENCE: ${motion}`,
      `FINAL OUTPUT: ${output}`,
    ].join('\n\n'),
  })
  return [
    make('Hero Metric', 'Create a single-insight 1080x1080 motion infographic in which one verified number, percentage, ratio, or short proof statement is the dominant object.', 'Use only when the supplied copy contains one clearly dominant metric or proof point. Route supporting facts into no more than two secondary callouts. If no numeric fact exists, use the strongest supplied short statement as a typographic hero without fabricating a number.', 'Use 72px safe margins. Reserve the top 16% for logo and eyebrow, the next 22% for the headline, the central 38% for the hero metric and its visual encoding, and the bottom 18% for explanation or an explicit CTA. Keep at least 4% breathing room between zones.', 'Construct one hero-number group, one directly labelled visual indicator, zero to two supporting callouts, and an optional CTA/end card. Cards use the radii, borders, padding, and motif rules from the saved guide.', 'Prefer a count-up, progress ring, single horizontal bar, or one-category comparison. The visual must encode only the supplied value and must remain understandable without a legend.', 'Background settles from 0-12%; logo/eyebrow enters at 8-20%; headline reveals at 15-34%; hero metric counts from 28-62%; the chart draws from 38-70%; supporting callouts stagger by 80ms from 58-78%; CTA enters at 74-88%. Use cubic ease-out, hold the completed state for the final 12%, and replace all transforms with a single opacity transition under reduced motion.', 'One brand-specific, data-first composition that communicates the main insight within two seconds and finishes on a stable, exportable end frame.'),
    make('Modular Insight Grid', 'Create a balanced multi-stat, multi-benefit, or capability infographic using a small repeatable module system.', 'Use for two to four parallel facts, benefits, risks, categories, or proof points of comparable importance. If one fact is materially stronger, promote it to a double-width lead module and keep the remaining modules secondary.', 'Use 72px outer margins and a 24px gutter. Reserve 18% for the header, 64% for a 2x2 or lead-plus-support grid, and 14% for a footer insight or explicit CTA. Never exceed four information modules.', 'Every module contains one icon or small data mark, one metric or short heading, and one concise explanation. Apply consistent padding and alignment while allowing a lead module to span two columns. Use direct labels rather than detached legends.', 'Use mini bars, compact rings, ordinal markers, or text-led KPI cards. All modules share one scale logic; do not mix unrelated chart types merely for variety.', 'Reveal the header at 10-28%; draw the grid frame at 20-36%; introduce modules in reading order with 90ms stagger from 30-72%; count metrics or draw mini charts within each module after its card appears; reveal the footer at 72-88%. Hold the complete grid. Reduced motion uses sequential fades with no scale, bounce, or parallax.', 'One coherent modular infographic whose modules can be animated separately while retaining a stable grid and clear mobile-scale hierarchy.'),
    make('Process Flow', 'Explain a supplied sequence, workflow, timeline, or cause-and-effect chain as an unmistakable ordered progression.', 'Use only when the copy provides two to five explicit steps, stages, dates, or transitions. Preserve the supplied order and wording. If the content is not sequential, route it to the modular or comparison layout.', 'Reserve 18% for the header, 66% for the flow, and 12% for the conclusion or CTA inside 72px safe margins. Use a horizontal path for two or three short steps and a vertical or serpentine path for four or five steps. Maintain at least 28px between step modules.', 'Each step contains an ordinal marker, short title, concise explanation, and optional evidence-backed icon. Connectors must indicate direction without crossing text. The final step may receive the accent treatment but must not imply an invented outcome.', 'Use progress lines, milestone dots, or stage cards rather than quantitative charts unless the copy supplies a value for a specific stage. Never manufacture durations or completion percentages.', 'Reveal the headline at 10-28%; draw the connector progressively from 24-64%; introduce each milestone immediately after the line reaches it with 100ms stagger; animate supplied numbers locally; emphasize the final stage at 68-82%; reveal the conclusion at 76-90%. Reduced motion shows the complete connector and fades milestones in reading order.', 'One motion-ready process composition with explicit reading order, independently addressable steps, and a stable final state that preserves the supplied sequence.'),
    make('Comparison Story', 'Present a supplied before/after, option-versus-option, problem/solution, or editorial contrast without biasing or inventing either side.', 'Use when the copy contains two explicit states, groups, periods, approaches, or outcomes. Use a 50/50 comparison for equal weight, 42/58 when one side is the stated resolution, and an editorial stacked story when the copy contains context followed by evidence and conclusion.', 'Use 72px safe margins. Reserve 18% for the shared headline, 64% for two columns or two stacked bands separated by a 24px gutter, and 14% for the verified takeaway or explicit CTA. Keep corresponding elements aligned across both sides.', 'Each side contains a label, one dominant fact or statement, up to three matched attributes, and an evidence-backed visual mark. Use shared row heights and direct labels. Apply accent emphasis only to the side the supplied copy explicitly prioritizes.', 'Use matched bars, paired KPI cards, delta arrows only when a real change is stated, or a two-state diagram. Use identical quantitative scales across both sides and show missing data honestly.', 'Reveal the common headline at 8-24%; introduce the baseline/divider at 20-34%; reveal the first state at 28-52% and the second at 42-68%; draw matched data marks together from 52-74%; emphasize only the supplied difference at 70-84%; reveal the takeaway at 78-92%. Reduced motion uses paired opacity fades and no sliding sides.', 'One comparison or editorial composition with fair scales, aligned evidence, clear brand expression, and no unsupported superiority claim.'),
  ]
}

interface BrandSourceContext {
  websiteUrl: string
  websiteText: string
  guidelineType: 'pdf' | 'docx' | null
  guidelineText: string
}

interface BrandFact {
  id: string
  category: string
  statement: string
  source: 'brand-guideline' | 'website'
  evidence: string
  importance: 'required' | 'supporting'
}

interface BrandFactBank {
  sourceIdentity: {
    selectedBrandName: string
    verifiedBrandNames: string[]
    hasIdentityMismatch: boolean
    notes: string[]
  }
  facts: BrandFact[]
  uncertainties: string[]
  ignoredContent: string[]
}

interface ConsolidatedBrandFact extends BrandFact {
  mergedFromFactIds?: string[]
}

interface BrandFactConsolidationResult extends Omit<BrandFactBank, 'facts'> {
  facts: ConsolidatedBrandFact[]
}

interface BrandDescriptionResult {
  brandDescription?: unknown
  factPlacement?: BrandDescriptionFactPlacement[]
}

interface BrandDescriptionFactPlacement {
  factId?: string
  heading?: string
  finalSentence?: string
}

interface BrandDescriptionAuditResult {
  brandDescription?: unknown
  factPlacement?: BrandDescriptionFactPlacement[]
  coveredRequiredFactIds?: string[]
  missingRequiredFactIds?: string[]
  unsupportedClaimsRemoved?: string[]
  unresolvedConflicts?: string[]
}

interface BrandDeepResearchResult {
  researchDossier?: unknown
  sources?: Array<{
    title?: unknown
    url?: unknown
    sourceType?: unknown
    supportedTopics?: unknown
  }>
  conflicts?: unknown
  uncertainties?: unknown
}

interface InfographicRepairResult {
  infographicGuidelines?: unknown
}

async function requestStructuredWorkflow<T>(
  systemPrompt: string,
  input: unknown,
  stage: string,
  model = MODEL,
  options: { reasoningEffort?: 'none' | 'low' | 'medium' | 'high'; maxOutputTokens?: number } = {}
): Promise<T | null> {
  try {
    const response = await fetch(N8N_BRAND_SETUP_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoningEffort: options.reasoningEffort || 'low',
        maxOutputTokens: options.maxOutputTokens || 8_000,
        systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
      }),
    })
    if (!response.ok) {
      console.warn(`[brand-setup] ${stage} returned ${response.status}`)
      return null
    }
    const responseText = await response.text()
    if (!responseText.trim()) return null
    const envelope = JSON.parse(responseText) as { result?: T | string }
    if (!envelope.result) return null
    return (typeof envelope.result === 'string'
      ? JSON.parse(jsonrepair(envelope.result))
      : envelope.result) as T
  } catch (error) {
    console.warn(`[brand-setup] ${stage} failed`, error)
    return null
  }
}

async function requestBrandDeepResearch(
  selectedBrandName: string,
  sourceContext: BrandSourceContext,
  jobId: string,
  onProgress?: (progress: number, stage: string) => Promise<void>
): Promise<BrandDeepResearchResult | null> {
  try {
    if (!N8N_API_URL || !N8N_API_KEY) {
      console.warn('[brand-setup] n8n execution API is not configured for background deep research')
      return null
    }
    const sourcePacket = {
      backgroundJobId: jobId,
      selectedBrandName,
      officialWebsiteUrl: sourceContext.websiteUrl,
      extractedOfficialWebsiteText: sourceContext.websiteText,
      uploadedGuidelineType: sourceContext.guidelineType,
      extractedUploadedGuidelineText: sourceContext.guidelineText,
      requiredGuideSections: NINE_SECTION_BRAND_GUIDE_SECTIONS,
    }
    const researchStartedAt = Date.now()
    const response = await fetch(N8N_DEEP_RESEARCH_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiMode: 'responses',
        model: WRITING_MODEL,
        reasoningEffort: 'high',
        maxOutputTokens: 16_000,
        tools: [{ type: 'web_search' }],
        systemPrompt: BRAND_SETUP_DEEP_RESEARCH_PROMPT,
        input: [{
          role: 'user',
          content: [{
            type: 'input_text',
            text: JSON.stringify(sourcePacket),
          }],
        }],
      }),
    })
    if (!response.ok) {
      console.warn('[brand-setup] deep research returned', response.status)
      return null
    }
    // The webhook acknowledges immediately. Poll the durable n8n execution
    // instead of holding the webhook response open for a long Sol request.
    // Twelve minutes leaves room for queueing while staying inside this
    // dedicated phase's fifteen-minute route allowance.
    const deadline = Date.now() + 12 * 60 * 1000
    let lastReportedProgress = 20
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 5_000))
      const elapsedMinutes = Math.floor((Date.now() - researchStartedAt) / 60_000)
      const reportedProgress = Math.min(27, 20 + elapsedMinutes)
      if (reportedProgress > lastReportedProgress) {
        lastReportedProgress = reportedProgress
        await onProgress?.(reportedProgress, `deep research running (${elapsedMinutes} min)`)
      }
      const executionsResponse = await fetch(
        `${N8N_API_URL}/api/v1/executions?workflowId=${encodeURIComponent(N8N_DEEP_RESEARCH_WORKFLOW_ID)}&limit=100`,
        { headers: { 'X-N8N-API-KEY': N8N_API_KEY } }
      )
      if (!executionsResponse.ok) continue
      const executions = await executionsResponse.json() as { data?: Array<{ id?: string; status?: string }> }
      for (const execution of executions.data || []) {
        if (!execution.id) continue
        const detailResponse = await fetch(`${N8N_API_URL}/api/v1/executions/${execution.id}?includeData=true`, {
          headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        })
        if (!detailResponse.ok) continue
        const detail = await detailResponse.json() as {
          status?: string
          data?: { status?: string; resultData?: { runData?: Record<string, any[]> } }
        }
        const runs = detail.data?.resultData?.runData || {}
        const webhookItem = runs['Deep Research Webhook']?.[0]?.data?.main?.[0]?.[0]?.json
        const receivedJobId = (webhookItem?.body as { input?: Array<{ content?: Array<{ text?: string }> }> } | undefined)
          ?.input?.[0]?.content?.[0]?.text
        if (!receivedJobId?.includes(jobId)) continue
        // n8n's public execution API returns status at the top level. Accept
        // the nested form as well for compatibility with older deployments.
        const executionStatus = detail.status || detail.data?.status
        if (executionStatus === 'error' || executionStatus === 'canceled' || executionStatus === 'crashed') {
          console.warn('[brand-setup] deep research execution failed', { executionId: execution.id, executionStatus })
          return null
        }
        if (executionStatus !== 'success') continue
        const validationJson = runs['Validate Research Dossier']?.[0]?.data?.main?.[0]?.[0]?.json
        const output = validationJson?.result ?? validationJson
        const parsed = (typeof output === 'string' ? JSON.parse(jsonrepair(output)) : output) as BrandDeepResearchResult
        const dossier = typeof parsed?.researchDossier === 'string' ? cleanText(parsed.researchDossier) : ''
        if (dossier.length < 1_000) return null
        return {
          researchDossier: dossier,
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
          conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
          uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [],
        }
      }
    }
    console.warn('[brand-setup] deep research timed out after twelve minutes')
    return null
  } catch (error) {
    console.warn('[brand-setup] deep research failed', error)
    return null
  }
}

function normalizeBrandFactBank(input: BrandFactBank, selectedBrandName: string): BrandFactBank | null {
  const usedIds = new Set<string>()
  const facts = (Array.isArray(input?.facts) ? input.facts : []).flatMap((fact, index) => {
    const statement = cleanText(fact?.statement || '')
    const evidence = cleanText(fact?.evidence || '')
    if (!statement || !evidence) return []
    let id = cleanText(fact?.id || `F${String(index + 1).padStart(2, '0')}`)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
    if (!id || usedIds.has(id)) id = `F${String(index + 1).padStart(2, '0')}`
    while (usedIds.has(id)) id = `${id}_${index + 1}`
    usedIds.add(id)
    return [{
      id,
      category: cleanText(fact?.category || 'brand-summary').toLowerCase(),
      statement,
      source: fact?.source === 'website' ? 'website' as const : 'brand-guideline' as const,
      evidence,
      importance: fact?.importance === 'supporting' ? 'supporting' as const : 'required' as const,
    }]
  })
  if (!facts.length) return null
  const identity = input?.sourceIdentity
  return {
    sourceIdentity: {
      selectedBrandName,
      verifiedBrandNames: uniqueEvidenceStrings(identity?.verifiedBrandNames),
      hasIdentityMismatch: Boolean(identity?.hasIdentityMismatch),
      notes: uniqueEvidenceStrings(identity?.notes),
    },
    facts,
    uncertainties: uniqueEvidenceStrings(input?.uncertainties),
    ignoredContent: uniqueEvidenceStrings(input?.ignoredContent),
  }
}

function exactValueTokens(value: string): string[] {
  return Array.from(new Set([
    ...(value.match(/\b\d+(?:\.\d+)?%?\b/g) || []),
    ...(value.match(/#[0-9a-f]{6}\b/gi) || []).map(token => token.toUpperCase()),
  ]))
}

async function tryConsolidateBrandFactBank(bank: BrandFactBank): Promise<BrandFactBank> {
  if (bank.facts.length < 2) return bank
  const consolidated = await requestStructuredWorkflow<BrandFactConsolidationResult>(
    BRAND_SETUP_FACT_CONSOLIDATION_PROMPT,
    { rawFactBank: bank },
    'semantic source fact consolidation',
    FACT_EXTRACTION_MODEL
  )
  if (!consolidated || !Array.isArray(consolidated.facts) || !consolidated.facts.length) return bank
  const rawById = new Map(bank.facts.map(fact => [fact.id, fact]))
  const mappedIds = new Set<string>()
  const canonicalFacts: BrandFact[] = []
  for (const proposed of consolidated.facts) {
    const sourceIds = Array.from(new Set(Array.isArray(proposed.mergedFromFactIds)
      ? proposed.mergedFromFactIds.filter(id => rawById.has(id) && !mappedIds.has(id))
      : []))
    if (!sourceIds.length) continue
    const sourceFacts = sourceIds.map(id => rawById.get(id)!)
    const statement = cleanText(proposed.statement || '')
    if (!statement) continue
    const supportedValues = new Set(exactValueTokens(sourceFacts.map(fact => `${fact.statement} ${fact.evidence}`).join(' ')))
    if (exactValueTokens(statement).some(value => !supportedValues.has(value))) continue
    sourceIds.forEach(id => mappedIds.add(id))
    canonicalFacts.push({
      id: `F${String(canonicalFacts.length + 1).padStart(2, '0')}`,
      category: cleanText(proposed.category || sourceFacts[0].category).toLowerCase(),
      statement,
      source: sourceFacts.some(fact => fact.source === 'brand-guideline') ? 'brand-guideline' : 'website',
      evidence: uniqueEvidenceStrings(...sourceFacts.map(fact => fact.evidence)).join(' | '),
      importance: sourceFacts.some(fact => fact.importance === 'required') ? 'required' : 'supporting',
    })
  }
  for (const fact of bank.facts) {
    if (mappedIds.has(fact.id)) continue
    canonicalFacts.push({
      ...fact,
      id: `F${String(canonicalFacts.length + 1).padStart(2, '0')}`,
    })
  }
  return {
    sourceIdentity: bank.sourceIdentity,
    facts: canonicalFacts,
    uncertainties: uniqueEvidenceStrings(bank.uncertainties, consolidated.uncertainties),
    ignoredContent: uniqueEvidenceStrings(bank.ignoredContent, consolidated.ignoredContent),
  }
}

// A website may contain the same capability repeated for every vertical it serves.
// Keep the complete bank for production prompts and auditability, but give the
// reader-facing Brand Description a deliberately editorial scope. This prevents a
// brand guide from turning into a page-by-page crawl export while retaining the
// core identity, proof, offering, and visual rules needed for a useful guide.
const BRAND_DESCRIPTION_CATEGORY_LIMITS: Record<string, number> = {
  'brand-summary': 10,
  'positioning-audience': 12,
  'offering-capability': 12,
  'proof-point': 10,
  'voice-messaging': 8,
  'visual-identity': 10,
  color: 14,
  typography: 10,
  logo: 10,
  cta: 8,
  background: 8,
  photography: 10,
  'product-ui': 12,
  'ui-scene-selection': 10,
  'icons-illustration': 8,
  composition: 8,
  'text-safe': 8,
  restriction: 10,
}

function buildBrandDescriptionFactBank(bank: BrandFactBank): BrandFactBank {
  const categoryCount = new Map<string, number>()
  const selected: BrandFact[] = []
  const prioritized = [...bank.facts].sort((left, right) => {
    // The guideline is the primary source for reader-facing brand rules.
    if (left.source !== right.source) return left.source === 'brand-guideline' ? -1 : 1
    if (left.importance !== right.importance) return left.importance === 'required' ? -1 : 1
    return left.statement.length - right.statement.length
  })
  for (const fact of prioritized) {
    const category = fact.category.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const limit = BRAND_DESCRIPTION_CATEGORY_LIMITS[category] ?? 4
    const count = categoryCount.get(category) ?? 0
    if (count >= limit || selected.length >= 60) continue
    categoryCount.set(category, count + 1)
    selected.push({ ...fact, importance: 'required' })
  }
  const requiredIds = new Set(selected.map(fact => fact.id))
  return {
    ...bank,
    // Give the writer the complete research bank. The editorially selected core is
    // required; the remaining facts are supporting context it may use to enrich or
    // derive recommendations without being forced into a crawl-style inventory.
    facts: bank.facts.map(fact => ({
      ...fact,
      importance: requiredIds.has(fact.id) ? 'required' as const : 'supporting' as const,
    })),
  }
}

function splitSourceText(value: string): string[] {
  const source = cleanText(value)
  if (!source) return []
  const chunks: string[] = []
  let current = ''
  const flush = () => {
    const cleaned = cleanText(current)
    if (cleaned) chunks.push(cleaned)
    current = ''
  }
  for (const paragraph of source.split(/\n{2,}/)) {
    if (!paragraph.trim()) continue
    if (paragraph.length > SOURCE_CHUNK_TARGET) {
      flush()
      let offset = 0
      while (offset < paragraph.length) {
        let end = Math.min(offset + SOURCE_CHUNK_TARGET, paragraph.length)
        if (end < paragraph.length) {
          const boundary = paragraph.lastIndexOf(' ', end)
          if (boundary > offset + SOURCE_CHUNK_TARGET * 0.7) end = boundary
        }
        chunks.push(cleanText(paragraph.substring(offset, end)))
        offset = end
        while (paragraph[offset] === ' ') offset += 1
      }
      continue
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length > SOURCE_CHUNK_TARGET) flush()
    current = current ? `${current}\n\n${paragraph}` : paragraph
  }
  flush()
  return chunks
}

async function tryExtractBrandFactBank(
  selectedBrandName: string,
  sourceContext: BrandSourceContext
): Promise<BrandFactBank | null> {
  const websiteChunks = splitSourceText(sourceContext.websiteText)
  const guidelineChunks = splitSourceText(sourceContext.guidelineText)
  const extractionChecklist = [
    'verified brand, parent-family identity, history, market position, audiences, industries, differentiators, voice, and messaging',
    'every metric, guarantee, scale claim, partnership count, performance result, experience claim, award, and certification',
    'every named product, service, platform, marketing channel, workflow, integration, and operational capability',
    'every explicit CTA, conversion phrase, product experience, supported device, interface, UI example, and scene-selection rule',
    'primary, secondary, vertical, and mark-only logos; clear space; minimum size; color; background; distortion; rotation; and modification rules',
    'every named color and associated HEX, RGB, CMYK, Pantone, gradient, role, contrast pair, dominance rule, and accessibility constraint',
    'every primary, alternate, headline, body, callout, and KPI typeface, weight, hierarchy, casing, and usage rule',
    'backgrounds, watermarks, patterns, photography, imagery, icons, illustration, composition, applications, examples, and restrictions',
  ]
  const requiredCategories = [
    'brand-summary',
    'positioning-audience',
    'proof-point',
    'voice-messaging',
    'offering-capability',
    'cta',
    'product-ui',
    'ui-scene-selection',
    'visual-identity',
    'logo',
    'color',
    'typography',
    'text-safe',
    'background',
    'photography',
    'icons-illustration',
    'composition',
    'restriction',
  ]
  const extractionPasses = [
    ...websiteChunks.map((content, index) => ({
      stage: `website fact extraction ${index + 1} of ${websiteChunks.length}`,
      websiteContent: content,
      guidelineContent: '',
      sourceScope: `Website chunk ${index + 1} of ${websiteChunks.length}. This is one lossless segment of the full crawled website corpus.`,
    })),
    ...guidelineChunks.map((content, index) => ({
      stage: `guideline fact extraction ${index + 1} of ${guidelineChunks.length}`,
      websiteContent: '',
      guidelineContent: content,
      sourceScope: `Brand-guideline chunk ${index + 1} of ${guidelineChunks.length}. This is one lossless segment of the full uploaded document.`,
    })),
  ]
  const extractionResults = await mapWithConcurrency(
    extractionPasses,
    SOURCE_EXTRACTION_CONCURRENCY,
    async pass => {
      for (let attempt = 1; attempt <= SOURCE_EXTRACTION_MAX_ATTEMPTS; attempt++) {
        const extracted = await requestStructuredWorkflow<BrandFactBank>(
          BRAND_SETUP_FACT_EXTRACTION_PROMPT,
          {
            selectedBrandName,
            sourcePriority: ['brand-guideline', 'website'],
            sourceScope: pass.sourceScope,
            website: {
              url: sourceContext.websiteUrl,
              content: pass.websiteContent,
            },
            brandGuidelineDocument: {
              type: sourceContext.guidelineType,
              content: pass.guidelineContent,
            },
            extractionFocus: 'Extract every atomic, relevant, source-supported brand fact in this chunk. Do not summarize, sample, or stop after representative facts.',
            requiredCategories,
            extractionChecklist,
          },
          `${pass.stage} (attempt ${attempt} of ${SOURCE_EXTRACTION_MAX_ATTEMPTS})`,
          FACT_EXTRACTION_MODEL
        )
        if (extracted) return extracted
      }
      console.warn(`[brand-setup] ${pass.stage} returned no usable facts after ${SOURCE_EXTRACTION_MAX_ATTEMPTS} attempts; continuing with an empty chunk`)
      return null
    }
  )
  const rawBanks = extractionResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  const banks = rawBanks
    .map(raw => raw ? normalizeBrandFactBank(raw, selectedBrandName) : null)
    .filter((bank): bank is BrandFactBank => Boolean(bank))
  // A transient blank model response must not cancel the entire setup. Failed
  // chunks contribute no facts; later stages keep their factual constraints and
  // leave unsupported sections empty rather than inventing content.
  if (!banks.length) {
    return {
      sourceIdentity: {
        selectedBrandName,
        verifiedBrandNames: [],
        hasIdentityMismatch: false,
        notes: ['No source chunks returned usable facts after retrying.'],
      },
      facts: [],
      uncertainties: ['Source fact extraction returned no usable chunks.'],
      ignoredContent: [],
    }
  }
  const seenStatements = new Set<string>()
  const facts = banks
    .flatMap(bank => bank.facts)
    .filter(fact => {
      const key = `${fact.source}:${fact.statement.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
      if (seenStatements.has(key)) return false
      seenStatements.add(key)
      return true
    })
    .map((fact, index) => ({
      ...fact,
      id: `F${String(index + 1).padStart(2, '0')}`,
    }))
  const rawBank: BrandFactBank = {
    sourceIdentity: {
      selectedBrandName,
      verifiedBrandNames: uniqueEvidenceStrings(...banks.map(bank => bank.sourceIdentity.verifiedBrandNames)),
      hasIdentityMismatch: banks.some(bank => bank.sourceIdentity.hasIdentityMismatch),
      notes: uniqueEvidenceStrings(...banks.map(bank => bank.sourceIdentity.notes)),
    },
    facts,
    uncertainties: uniqueEvidenceStrings(...banks.map(bank => bank.uncertainties)),
    ignoredContent: uniqueEvidenceStrings(...banks.map(bank => bank.ignoredContent)),
  }
  return tryConsolidateBrandFactBank(rawBank)
}

const BRAND_DESCRIPTION_SECTIONS = [...NINE_SECTION_BRAND_GUIDE_SECTIONS]
const MIN_BRAND_DESCRIPTION_CHARS = 4_500
const MAX_BRAND_DESCRIPTION_CHARS = 15_000

function brandDescriptionSectionText(value: unknown): string {
  if (typeof value === 'string') return cleanText(value)
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? `- ${cleanText(item)}` : `- ${cleanText(JSON.stringify(item))}`)
      .filter(item => item !== '- ')
      .join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        const rendered = Array.isArray(item)
          ? item.map(entry => cleanText(String(entry))).filter(Boolean).join('; ')
          : cleanText(String(item ?? ''))
        return rendered ? `- **${cleanText(key)}:** ${rendered}` : ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function normalizeBrandDescriptionHeading(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function brandDescriptionEntries(value: unknown): Array<[string, unknown]> {
  if (typeof value === 'string') {
    const source = value.trim()
    if (!source) return []
    // Models commonly return either Markdown headings (`## Heading`) or bold-only
    // headings (`**Heading**`). Both carry the same section structure and should be
    // normalized instead of causing an otherwise valid guide to be discarded.
    const headingPattern = /^(?:#{1,6}\s+(.+?)|\*\*(.+?)\*\*)\s*$/gm
    const headings = Array.from(source.matchAll(headingPattern))
    if (!headings.length) return []
    return headings.map((match, index) => {
      const contentStart = (match.index || 0) + match[0].length
      const contentEnd = headings[index + 1]?.index ?? source.length
      return [match[1] || match[2], source.slice(contentStart, contentEnd).trim()]
    })
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
}

function findBrandDescriptionSection(
  entries: Array<[string, unknown]>,
  heading: string
): unknown {
  const expected = normalizeBrandDescriptionHeading(heading)
  const matching = entries.find(([key]) => {
    const candidate = normalizeBrandDescriptionHeading(key)
    return candidate === expected
      || candidate.startsWith(`${expected} `)
      || expected.startsWith(`${candidate} `)
  })
  return matching?.[1]
}

function normalizeBrandDescriptionValue(value: unknown, fallbackValue?: unknown): string | null {
  const entries = brandDescriptionEntries(value)
  if (!entries.length) return null
  const fallbackEntries = brandDescriptionEntries(fallbackValue)
  const sections = BRAND_DESCRIPTION_SECTIONS.map(heading => {
    const content = brandDescriptionSectionText(findBrandDescriptionSection(entries, heading))
      || brandDescriptionSectionText(findBrandDescriptionSection(fallbackEntries, heading))
    return content ? `## ${heading}\n${content}` : `## ${heading}`
  })
  return sections.join('\n\n')
}

function factHeading(fact: BrandFact): string {
  const category = fact.category.toLowerCase()
  if (/brand.summary|proof|position|audience|offer|service|capabilit|voice|messag/.test(category)) return 'Brand summary'
  if (/visual.identity/.test(category)) return 'Visual identity'
  if (/color|palette/.test(category)) return 'Color palette'
  if (/type|font/.test(category)) return 'Typography'
  if (/cta|call.to.action/.test(category)) return 'CTA'
  if (/background/.test(category)) return 'Background imagery'
  if (/product|mockup|ui|scene/.test(category)) return 'UI mockup'
  if (/icon|illustration/.test(category)) return 'Icons and illustration'
  if (/logo/.test(category)) return 'Visual identity'
  return 'Style'
}

function canonicalBrandDescriptionHeading(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = normalizeBrandDescriptionHeading(value)
  return BRAND_DESCRIPTION_SECTIONS.find(heading => normalizeBrandDescriptionHeading(heading) === normalized) || null
}

function normalizeComparableText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const FACT_COVERAGE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to', 'use',
  'uses', 'when', 'with',
])

function factCoverageTokens(value: string): string[] {
  return normalizeComparableText(value)
    .split(' ')
    .filter(token => token && (!FACT_COVERAGE_STOP_WORDS.has(token) || /\d/.test(token)))
}

function sentenceCoversFact(sentence: string, factStatement: string): boolean {
  const sentenceText = normalizeComparableText(sentence)
  const factText = normalizeComparableText(factStatement)
  if (!sentenceText || !factText) return false
  if (sentenceText.includes(factText)) return true
  const factTokens = factCoverageTokens(factStatement)
  const sentenceTokens = new Set(factCoverageTokens(sentence))
  const numericTokens = factTokens.filter(token => /\d/.test(token))
  if (numericTokens.some(token => !sentenceTokens.has(token))) return false
  const distinctFactTokens = Array.from(new Set(factTokens))
  const overlap = distinctFactTokens.filter(token => sentenceTokens.has(token)).length
  return overlap >= Math.max(2, Math.ceil(distinctFactTokens.length * 0.7))
}

function textContainsFact(value: string, factStatement: string): boolean {
  if (normalizeComparableText(value).includes(normalizeComparableText(factStatement))) return true
  return value
    .split(/\n+|[.!?]\s+/)
    .some(sentence => sentenceCoversFact(sentence, factStatement))
}

function reconcileBrandDescriptionCoverage(
  description: string,
  factBank: BrandFactBank,
  placements: unknown
): string {
  const placementByFactId = new Map<string, BrandDescriptionFactPlacement>()
  if (Array.isArray(placements)) {
    for (const placement of placements) {
      if (!placement || typeof placement !== 'object' || typeof placement.factId !== 'string') continue
      placementByFactId.set(placement.factId, placement)
    }
  }
  const sections = new Map<string, string>()
  for (const heading of BRAND_DESCRIPTION_SECTIONS) {
    sections.set(heading, brandDescriptionSectionText(findBrandDescriptionSection(brandDescriptionEntries(description), heading)))
  }
  const additions = new Map<string, string[]>()
  for (const fact of factBank.facts.filter(candidate => candidate.importance === 'required')) {
    const placement = placementByFactId.get(fact.id)
    const claimedSentence = typeof placement?.finalSentence === 'string' ? placement.finalSentence.trim() : ''
    const factAlreadyPresent = textContainsFact(description, fact.statement)
    const claimedSentencePresent = claimedSentence
      && normalizeComparableText(description).includes(normalizeComparableText(claimedSentence))
      && sentenceCoversFact(claimedSentence, fact.statement)
    if (factAlreadyPresent || Boolean(claimedSentencePresent)) continue
    const heading = canonicalBrandDescriptionHeading(placement?.heading) || factHeading(fact)
    additions.set(heading, [...(additions.get(heading) || []), fact.statement])
  }
  return BRAND_DESCRIPTION_SECTIONS.map(heading => {
    const existing = sections.get(heading) || ''
    const appended = additions.get(heading) || []
    const content = [
      existing,
      appended.length ? appended.map(statement => `- ${statement}`).join('\n') : '',
    ].filter(Boolean).join('\n')
    return content ? `## ${heading}\n${content}` : `## ${heading}`
  }).join('\n\n')
}

const BRAND_DESCRIPTION_SECTION_CONTEXT_TERMS: Record<BrandDescriptionSection, string[]> = {
  'Brand summary': ['brand', 'company', 'platform', 'service', 'audience', 'industry', 'positioning', 'mission', 'value', 'differentiator'],
  'Positioning and audience': ['audience', 'customer', 'dealer', 'industry', 'market', 'positioning', 'persona', 'buyer', 'vertical', 'differentiator'],
  'Voice and messaging': ['voice', 'tone', 'messaging', 'headline', 'copy', 'language', 'phrase', 'tagline', 'claim', 'cta'],
  'Visual identity': ['visual', 'identity', 'design', 'logo', 'color', 'typography', 'pattern', 'photography', 'icon', 'layout'],
  'Color palette with exact roles': ['color', 'colour', 'palette', 'hex', 'rgb', 'cmyk', 'pantone', 'contrast', 'background', 'accent'],
  'Typography hierarchy': ['typography', 'font', 'typeface', 'heading', 'headline', 'body', 'weight', 'tracking', 'line height', 'text'],
  'Logo rules': ['logo', 'lockup', 'mark', 'clear space', 'minimum size', 'distort', 'background', 'monochrome', 'wordmark'],
  'CTA system': ['cta', 'call to action', 'button', 'demo', 'contact', 'learn more', 'get started', 'conversion', 'action'],
  'Background system': ['background', 'surface', 'gradient', 'pattern', 'texture', 'overlay', 'canvas', 'panel', 'dark', 'light'],
  'Photography and imagery': ['photography', 'photo', 'image', 'imagery', 'subject', 'lighting', 'crop', 'people', 'environment', 'lifestyle'],
  'Product/UI mockups': ['product', 'ui', 'interface', 'dashboard', 'screen', 'mockup', 'device', 'workflow', 'feature', 'software'],
  'UI scene-selection rules': ['ui', 'scene', 'screen', 'workflow', 'dashboard', 'feature', 'product', 'selection', 'state', 'interface'],
  'Icons and illustration': ['icon', 'illustration', 'graphic', 'stroke', 'outline', 'vector', 'shape', 'symbol', 'motif'],
  'Composition patterns': ['composition', 'layout', 'grid', 'hierarchy', 'alignment', 'spacing', 'module', 'card', 'zone', 'placement'],
  'Text-safe zones': ['safe zone', 'safe area', 'margin', 'padding', 'clear space', 'text placement', 'crop', 'overlay', 'legibility'],
  'Restrictions': ['restriction', 'avoid', 'never', 'do not', 'prohibited', 'misuse', 'incorrect', 'forbidden', 'must not'],
  'Evidence and uncertainties': ['evidence', 'source', 'uncertain', 'conflict', 'missing', 'gap', 'verified', 'guideline', 'website'],
}

function sectionRelevanceScore(value: string, terms: string[]): number {
  const normalized = value.toLowerCase()
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0)
}

function relevantSourceExcerpts(value: string, terms: string[], maxCharacters = 18_000): string {
  const chunks = splitSourceText(value)
  if (!chunks.length) return ''
  const ranked = chunks
    .map((chunk, index) => ({ chunk, index, score: sectionRelevanceScore(chunk, terms) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
  const selected: string[] = []
  let used = 0
  for (const candidate of ranked) {
    if (used >= maxCharacters) break
    const remaining = maxCharacters - used
    const excerpt = candidate.chunk.slice(0, remaining)
    if (!excerpt) continue
    selected.push(excerpt)
    used += excerpt.length
  }
  return selected.join('\n\n--- RELEVANT SOURCE EXCERPT ---\n\n')
}

function relevantSectionFactBank(factBank: BrandFactBank, terms: string[]): BrandFactBank {
  const facts = factBank.facts
    .map((fact, index) => ({
      fact,
      index,
      score: sectionRelevanceScore(`${fact.category} ${fact.statement} ${fact.evidence}`, terms)
        + (fact.importance === 'required' ? 2 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 70)
    .map(entry => entry.fact)
  return { ...factBank, facts }
}

function brandDescriptionSectionSourcePacket(
  heading: BrandDescriptionSection,
  factBank: BrandFactBank,
  sourceContext: BrandSourceContext,
  result: BrandSetupResult
) {
  const terms = BRAND_DESCRIPTION_SECTION_CONTEXT_TERMS[heading]
  return {
    verifiedFactBank: relevantSectionFactBank(factBank, terms),
    primarySources: {
      websiteUrl: sourceContext.websiteUrl,
      websiteResearch: relevantSourceExcerpts(sourceContext.websiteText, terms),
      uploadedGuidelineType: sourceContext.guidelineType,
      uploadedGuidelineText: relevantSourceExcerpts(sourceContext.guidelineText, terms),
    },
    observedVisualSystem: {
      palette: result.palette,
      typography: result.typography,
      sourceEvidence: result.sourceEvidence,
      visualBlueprints: result.visualBlueprints,
    },
  }
}

async function tryGeneratePromptedBrandDescriptionSections(
  factBank: BrandFactBank,
  sourceContext: BrandSourceContext,
  result: BrandSetupResult
): Promise<Map<string, string>> {
  const promptedSections: Array<[BrandDescriptionSection, string]> = []
  for (const heading of HARDCODED_BRAND_DESCRIPTION_SECTIONS) {
    const prompt = BRAND_DESCRIPTION_SECTION_PROMPTS[heading]
    if (prompt) promptedSections.push([heading, prompt])
  }

  const generated = await Promise.all(promptedSections.map(async ([heading, prompt]) => {
    const sectionSources = brandDescriptionSectionSourcePacket(heading, factBank, sourceContext, result)
    const writeSection = (isRetry: boolean) => requestStructuredWorkflow<{ section?: unknown }>(
      `${prompt}\n\nSYNTHESIS REQUIREMENTS:\n- Research and synthesize; do not copy-paste or merely inventory the source text.\n- Use explicit website and guideline facts wherever available.\n- For qualitative design decisions not stated verbatim, reason from the verified audience, industry, positioning, palette, typography, uploaded images, repeated visual patterns, and layout blueprints. Produce concrete, brand-specific derived guidance.\n- Never invent factual claims, metrics, customer names, product capabilities, exact colors, font names, or official logo measurements. Exact values must come from the sources.\n- Do not leave the whole section empty. When an exact official rule is unavailable, provide a useful qualitative conclusion supported by the observed brand system. For the Evidence and uncertainties section, document the gap instead of inventing a rule.\n- Separate confirmed rules from derived guidance when that distinction materially prevents a conclusion from being mistaken for an official specification.\n${isRetry ? '- The previous attempt returned no usable section. Complete the section now using evidence-based reasoning from all supplied sources.' : ''}\n\nReturn exactly one JSON object: {"section":"the complete Markdown content for this section only"}. Do not include the section heading in section.`,
      { requestedSection: heading, ...sectionSources },
      `brand description section${isRetry ? ' retry' : ''}: ${heading}`,
      WRITING_MODEL,
      { reasoningEffort: 'low', maxOutputTokens: 4_000 }
    )
    let response = await writeSection(false)
    let content = typeof response?.section === 'string' ? response.section.trim() : ''
    if (!content) {
      response = await writeSection(true)
      content = typeof response?.section === 'string' ? response.section.trim() : ''
    }
    return [heading, content] as const
  }))
  return new Map(generated.filter((entry) => Boolean(entry[1])))
}

function renderPromptedBrandDescriptionSections(prompted: Map<string, string>): string {
  return BRAND_DESCRIPTION_SECTIONS.map(heading => {
    const content = prompted.get(heading)
    return content ? `## ${heading}\n${content}` : `## ${heading}`
  }).join('\n\n')
}

function hasCompleteCompactBrandDescription(value: string): boolean {
  if (value.length < MIN_BRAND_DESCRIPTION_CHARS || value.length > MAX_BRAND_DESCRIPTION_CHARS) return false
  const entries = brandDescriptionEntries(value)
  return BRAND_DESCRIPTION_SECTIONS.every(heading => Boolean(
    brandDescriptionSectionText(findBrandDescriptionSection(entries, heading))
  ))
}

function hasAllNineBrandGuideHeadings(value: string): boolean {
  return NINE_SECTION_BRAND_GUIDE_SECTIONS.every(heading => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (value.match(new RegExp(`^##\\s+${escaped}\\s*$`, 'gmi')) || []).length === 1
  })
}

async function writeNineSectionBrandGuide(
  factBank: BrandFactBank,
  research: BrandDeepResearchResult,
  sourceContext: BrandSourceContext,
  result: BrandSetupResult
): Promise<string | null> {
  const compactCompleteDraft = async (draft: string): Promise<string | null> => {
    const response = await requestStructuredWorkflow<{ brandDescription?: unknown }>(
      `You are the final editor for a source-grounded nine-section brand guide. The supplied draft is complete but too long. Compress it without losing unique verified facts, exact values, practical production rules, restrictions, or the distinction between official rules and Derived direction. Remove repetition and generic wording only.\n\nReturn exactly one JSON object: {"brandDescription":"complete Markdown guide"}. The Markdown must retain these headings exactly once and in order: Brand summary; Visual identity; Color palette; Typography; Style; CTA; Background imagery; UI mockup; Icons and illustration. It must be 4,500–15,000 characters including headings. Return no Markdown fence.`,
      { completeDraft: draft },
      'nine-section brand guide compaction',
      WRITING_MODEL,
      { reasoningEffort: 'medium', maxOutputTokens: 6_000 }
    )
    const compacted = normalizeBrandDescriptionValue(response?.brandDescription)
    return compacted && hasCompleteCompactBrandDescription(compacted) ? compacted : null
  }
  const write = (retry: boolean) => requestStructuredWorkflow<{ brandDescription?: unknown }>(
    `${BRAND_SETUP_NINE_SECTION_GUIDE_PROMPT}${retry
      ? `\n\nREPAIR: The previous response did not contain all nine headings exactly once or was outside the ${MIN_BRAND_DESCRIPTION_CHARS.toLocaleString()}–${MAX_BRAND_DESCRIPTION_CHARS.toLocaleString()} character range. Return a complete corrected guide now.`
      : ''}`,
    {
      primarySourceExtracts: {
        officialWebsiteUrl: sourceContext.websiteUrl,
        extractedOfficialWebsiteText: sourceContext.websiteText,
        uploadedGuidelineType: sourceContext.guidelineType,
        extractedUploadedGuidelineText: sourceContext.guidelineText,
      },
      verifiedFactBank: factBank,
      completeDeepResearch: research,
      measuredVisualEvidence: buildVisualAuditSummary(result),
    },
    `nine-section brand guide${retry ? ' repair' : ''}`,
    WRITING_MODEL,
    { reasoningEffort: 'high', maxOutputTokens: 6_000 }
  )

  let response = await write(false)
  let guide = normalizeBrandDescriptionValue(response?.brandDescription)
  if (guide && hasCompleteCompactBrandDescription(guide)) return guide
  if (guide && hasAllNineBrandGuideHeadings(guide)) {
    const compacted = await compactCompleteDraft(guide)
    if (compacted) return compacted
  }

  response = await write(true)
  guide = normalizeBrandDescriptionValue(response?.brandDescription)
  if (guide && hasCompleteCompactBrandDescription(guide)) return guide
  return guide && hasAllNineBrandGuideHeadings(guide) ? compactCompleteDraft(guide) : null
}

async function tryCompactBrandDescription(
  factBank: BrandFactBank,
  draft: string,
  result: BrandSetupResult
): Promise<string | null> {
  const write = (retry: boolean) => requestStructuredWorkflow<{ brandDescription?: unknown }>(
    `${BRAND_DESCRIPTION_COMPACTION_PROMPT}${retry
      ? '\n\nRETRY: The prior response did not satisfy the 5,000–20,000 character range or omitted a required heading. Return a complete compliant guide now.'
      : ''}`,
    {
      verifiedFactBank: factBank,
      observedVisualSystem: buildVisualAuditSummary(result),
      detailedDraft: draft,
    },
    `brand description compaction${retry ? ' retry' : ''}`,
    WRITING_MODEL,
    { reasoningEffort: 'low', maxOutputTokens: 6_000 }
  )
  let response = await write(false)
  let compacted = normalizeBrandDescriptionValue(response?.brandDescription)
  if (compacted && hasCompleteCompactBrandDescription(compacted)) return compacted
  response = await write(true)
  compacted = normalizeBrandDescriptionValue(response?.brandDescription)
  return compacted && hasCompleteCompactBrandDescription(compacted) ? compacted : null
}

function buildVisualAuditSummary(result: BrandSetupResult) {
  return {
    authority: 'Lower than the verified fact bank. Use only literal repeated visual observations.',
    palette: result.palette,
    typography: result.typography,
    repeatedPatterns: result.sourceEvidence.repeatedPatterns.slice(0, 12),
    references: result.sourceEvidence.references.map(reference => ({
      referenceIndex: reference.referenceIndex,
      declaredType: reference.declaredType,
      observedTraits: reference.observedTraits.slice(0, 6),
    })),
  }
}

async function tryAuditBrandDescription(
  factBank: BrandFactBank,
  draft: string,
  result: BrandSetupResult
): Promise<BrandDescriptionAuditResult | null> {
  const requiredIds = factBank.facts
    .filter(fact => fact.importance === 'required')
    .map(fact => fact.id)
  const auditInput = {
    factBank,
    brandDescriptionDraft: draft,
    visualEvidenceAddedAfterFactualDraft: buildVisualAuditSummary(result),
  }
  const normalizeAudit = (audited: BrandDescriptionAuditResult | null) => {
    const normalizedDescription = normalizeBrandDescriptionValue(
      (audited as { brandDescription?: unknown } | null)?.brandDescription,
      draft
    )
    if (!audited || !normalizedDescription) return null
    const coverageCheckedDescription = reconcileBrandDescriptionCoverage(
      normalizedDescription,
      factBank,
      audited.factPlacement
    )
    // The model's ID ledger is useful diagnostics, but it is not reliable enough to
    // be the acceptance criterion: it can omit IDs while the finished prose does
    // cover them. Reconciliation above appends any genuinely uncovered statements,
    // so validate the resulting reader-facing description itself.
    const missing = factBank.facts
      .filter(fact => fact.importance === 'required')
      .filter(fact => !textContainsFact(coverageCheckedDescription, fact.statement))
      .map(fact => fact.id)
    const emptySections = BRAND_DESCRIPTION_SECTIONS.filter(heading => {
      const section = findBrandDescriptionSection(brandDescriptionEntries(coverageCheckedDescription), heading)
      return !brandDescriptionSectionText(section)
    })
    const qualityIssues = [
      ...(coverageCheckedDescription.length < MIN_BRAND_DESCRIPTION_CHARS
        ? [`Brand Description has ${coverageCheckedDescription.length} characters; minimum is ${MIN_BRAND_DESCRIPTION_CHARS}.`]
        : []),
      ...(emptySections.length ? [`Empty sections: ${emptySections.join(', ')}`] : []),
    ]
    return {
      value: {
        ...audited,
        brandDescription: coverageCheckedDescription,
        coveredRequiredFactIds: requiredIds.filter(id => !missing.includes(id)),
        missingRequiredFactIds: missing,
      },
      missing,
      qualityIssues,
    }
  }
  const firstAudit = await requestStructuredWorkflow<BrandDescriptionAuditResult>(
    BRAND_SETUP_BRAND_DESCRIPTION_AUDIT_PROMPT,
    auditInput,
    'brand description coverage audit',
    WRITING_MODEL,
    { reasoningEffort: 'low', maxOutputTokens: 16_000 }
  )
  const firstResult = normalizeAudit(firstAudit)
  if (firstResult && !firstResult.missing.length && !firstResult.qualityIssues.length) return firstResult.value
  const retryAudit = await requestStructuredWorkflow<BrandDescriptionAuditResult>(
    `${BRAND_SETUP_BRAND_DESCRIPTION_AUDIT_PROMPT}\n\nREPAIR RETRY: The previous result failed its factual-coverage or editorial-completeness gate. Rewrite the complete guide so every missing required fact is covered once, every required section contains brand-specific content, and the result exceeds 4,000 substantive characters without repetition. For sections lacking an explicit sourced rule, provide a clearly labelled evidence-based Recommended direction. Return the complete coveredRequiredFactIds array and an empty missingRequiredFactIds array.`,
    {
      ...auditInput,
      previousAudit: firstAudit,
      requiredFactIdsStillMissing: firstResult?.missing || requiredIds,
      editorialQualityIssues: firstResult?.qualityIssues || ['No usable first audit was returned.'],
    },
    'brand description coverage audit retry',
    WRITING_MODEL,
    { reasoningEffort: 'low', maxOutputTokens: 16_000 }
  )
  const retryResult = normalizeAudit(retryAudit)
  return retryResult && !retryResult.missing.length && !retryResult.qualityIssues.length
    ? retryResult.value
    : null
}

function normalizeInfographicGuidelines(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const renderValue = (item: unknown): string => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      return String(item).trim()
    }
    if (Array.isArray(item)) {
      return item.map(entry => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const parts = Object.entries(entry)
            .map(([key, nested]) => {
              const rendered = renderValue(nested)
              return rendered ? `**${cleanText(key)}:** ${rendered}` : ''
            })
            .filter(Boolean)
          return parts.length ? `- ${parts.join('; ')}` : ''
        }
        const rendered = renderValue(entry)
        return rendered ? `- ${rendered}` : ''
      }).filter(Boolean).join('\n')
    }
    if (item && typeof item === 'object') {
      return Object.entries(item)
        .map(([key, nested]) => {
          const rendered = renderValue(nested)
          return rendered ? `- **${cleanText(key)}:** ${rendered}` : ''
        })
        .filter(Boolean)
        .join('\n')
    }
    return ''
  }

  const sections = Object.entries(value)
    .map(([heading, content]) => {
      const rendered = renderValue(content)
      return rendered ? `### ${cleanText(heading)}\n${rendered}` : `### ${cleanText(heading)}`
    })
    .filter(Boolean)
  return sections.length ? sections.join('\n\n') : null
}

async function tryExpandInfographicGuide(
  result: BrandSetupResult,
  factBank: BrandFactBank
): Promise<string | null> {
  const repaired = await requestStructuredWorkflow<InfographicRepairResult>(
    BRAND_SETUP_INFOGRAPHIC_REPAIR_PROMPT,
    {
      brandName: result.brandName,
      verifiedFactBank: factBank,
      infographicGuidelinesDraft: result.infographicGuidelines,
      palette: result.palette,
      typography: result.typography,
      sourceEvidence: result.sourceEvidence,
      visualBlueprints: result.visualBlueprints,
      layoutNames: result.staticLayouts.map(layout => layout.name),
      carouselFamilies: result.carouselLayouts.map(layout => layout.name),
    },
    'infographic guide expansion'
  )
  const guideline = normalizeInfographicGuidelines(repaired?.infographicGuidelines)
  if (!guideline) return null
  const relevantFacts = factBank.facts.filter(fact => !/proof.point/i.test(fact.category))
  const missingFacts = relevantFacts.filter(fact => !textContainsFact(guideline, fact.statement))
  if (!missingFacts.length) return guideline
  const integrated = await requestStructuredWorkflow<InfographicRepairResult>(
    `${BRAND_SETUP_INFOGRAPHIC_REPAIR_PROMPT}

INTEGRATION REPAIR: The previous guide omitted source-backed rules listed in missingRelevantFacts. Integrate each missing fact exactly once into its proper reader-facing section. Consolidate related facts into clean prose or compact bullets. Do not append a fact inventory, evidence appendix, audit log, or repeated crawl list. Remove generic or unsupported guidance while editing.`,
    {
      brandName: result.brandName,
      infographicGuidelinesDraft: guideline,
      missingRelevantFacts: missingFacts,
      sourceEvidence: result.sourceEvidence,
      visualBlueprints: result.visualBlueprints,
    },
    'infographic guide evidence integration'
  )
  return normalizeInfographicGuidelines(integrated?.infographicGuidelines) || guideline
}

export async function POST(req: Request) {
  const workerSecret = process.env.BRAND_SETUP_WORKER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const workerRequest = Boolean(workerSecret && req.headers.get('x-brand-setup-worker') === workerSecret)
  const auth = workerRequest ? { user: null, error: null } : await requireAdmin(req)
  if (auth.error) return auth.error
  const user = auth.user

  const body = await req.json() as RequestBody
  const suppliedJobId = body.backgroundJobId || ''
  const jobId = workerRequest && /^[0-9a-f-]{36}$/i.test(suppliedJobId)
    ? suppliedJobId
    : crypto.randomUUID()
  let jobPersisted = false
  const updateJob = async (values: Record<string, unknown>) => {
    if (!jobPersisted) return
    await supabase.from('brand_system_jobs').update(values).eq('id', jobId).then(() => undefined, () => undefined)
  }

  try {
    const brandId = body.brandId?.trim()
    const websiteUrl = body.websiteUrl?.trim()
    const usesFeatureManifest = body.schemaVersion === BRAND_SYSTEM_SCHEMA_VERSION && Array.isArray(body.assets)
    const requestedFeatures = usesFeatureManifest && Array.isArray(body.requestedFeatures)
      ? body.requestedFeatures
      : ['static', 'carousel'] as BrandSystemFeatureId[]
    const manifestAssets = usesFeatureManifest ? body.assets! : []
    if (usesFeatureManifest) {
      const manifestValidation = validateBrandSystemManifest(requestedFeatures, manifestAssets)
      if (!manifestValidation.valid) {
        return NextResponse.json({ error: manifestValidation.errors.join(' ') }, { status: 400 })
      }
    }
    const staticManifestAssets = manifestAssets
      .filter(asset => asset.feature === 'static' && asset.mediaType === 'image')
      .sort((a, b) => a.order - b.order)
    const carouselManifestAssets = manifestAssets
      .filter(asset => asset.feature === 'carousel' && asset.mediaType === 'image')
      .sort((a, b) => a.order - b.order)
    const submittedImagePaths = usesFeatureManifest
      ? [...staticManifestAssets, ...carouselManifestAssets].map(asset => asset.storagePath)
      : Array.isArray(body.referenceImagePaths) ? body.referenceImagePaths : []
    const carouselPdfStoragePath = usesFeatureManifest ? null : body.carouselPdfStoragePath?.trim() || null
    const manifestGuideline = manifestAssets.find(asset => asset.feature === 'core' && asset.role === 'brand-guideline')
    const guidelineStoragePath = manifestGuideline?.storagePath || body.guidelineStoragePath || body.pdfStoragePath || null
    if (submittedImagePaths.length > MAX_REFERENCE_IMAGES) {
      return NextResponse.json({ error: `Upload no more than ${MAX_REFERENCE_IMAGES} reference images.` }, { status: 400 })
    }
    if (carouselPdfStoragePath && submittedImagePaths.length !== 1) {
      return NextResponse.json({ error: 'Upload exactly one standalone static image when using a carousel PDF.' }, { status: 400 })
    }
    const imagePaths = submittedImagePaths.slice(0, MAX_REFERENCE_IMAGES)
    const imageTypes = usesFeatureManifest
      ? [
          ...staticManifestAssets.map((): BrandSetupReferenceType => 'static-creative'),
          ...carouselManifestAssets.map((): BrandSetupReferenceType => 'carousel-slide'),
        ]
      : carouselPdfStoragePath
      ? imagePaths.map((): BrandSetupReferenceType => 'static-creative')
      : imagePaths.map((_, index): BrandSetupReferenceType => {
          const type = body.referenceImageTypes?.[index]
          return type && REFERENCE_TYPES.includes(type) ? type : 'auto'
        })
    const staticReferenceIndexes = imageTypes.flatMap((type, index) => type === 'static-creative' ? [index + 1] : [])
    const carouselReferenceIndexes = carouselPdfStoragePath
      ? Array.from({ length: REQUIRED_CAROUSEL_PAGES }, (_, index) => index + 2)
      : imageTypes.flatMap((type, index) => type === 'carousel-slide' ? [index + 1] : [])
    const hasImageCarousel = !carouselPdfStoragePath
      && staticReferenceIndexes.length >= 1
      && staticReferenceIndexes.length <= 10
      && imagePaths.length === REQUIRED_CAROUSEL_PAGES + staticReferenceIndexes.length
      && staticReferenceIndexes.every((referenceIndex, index) => referenceIndex === index + 1)
      && carouselReferenceIndexes.length === REQUIRED_CAROUSEL_PAGES
      && carouselReferenceIndexes.every((referenceIndex, index) => referenceIndex === staticReferenceIndexes.length + index + 1)
    const hasOrderedCarousel = Boolean(carouselPdfStoragePath) || hasImageCarousel

    if (!brandId) return NextResponse.json({ error: 'Select a brand.' }, { status: 400 })
    if (!isPublicWebsiteUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Enter a valid http(s) website URL.' }, { status: 400 })
    }
    if (imagePaths.length === 0) {
      return NextResponse.json({ error: 'Upload at least one reference image.' }, { status: 400 })
    }
    if (imagePaths.some(path => !isOwnedInputPath(path, brandId))) {
      return NextResponse.json({ error: 'Invalid reference image path.' }, { status: 400 })
    }
    if (guidelineStoragePath && !isOwnedInputPath(guidelineStoragePath, brandId)) {
      return NextResponse.json({ error: 'Invalid brand-guideline document path.' }, { status: 400 })
    }
    if (carouselPdfStoragePath && !isOwnedInputPath(carouselPdfStoragePath, brandId)) {
      return NextResponse.json({ error: 'Invalid carousel PDF path.' }, { status: 400 })
    }
    if (!carouselPdfStoragePath && !hasImageCarousel) {
      return NextResponse.json({
        error: 'Upload 1–10 standalone static images followed by exactly six ordered carousel slides.',
      }, { status: 400 })
    }

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id,name')
      .eq('id', brandId)
      .maybeSingle()
    if (brandError || !brand) return NextResponse.json({ error: 'Brand not found.' }, { status: 404 })

    if (workerRequest) {
      jobPersisted = true
    } else {
      const { error: jobInsertError } = await supabase.from('brand_system_jobs').insert({
        id: jobId,
        brand_id: brandId,
        requested_by: user?.id || null,
        requested_by_email: user?.email || null,
        schema_version: BRAND_SYSTEM_SCHEMA_VERSION,
        requested_features: requestedFeatures,
        asset_manifest: usesFeatureManifest ? manifestAssets : imagePaths.map((storagePath, index) => ({
          id: `legacy-${index + 1}`,
          feature: index === 0 ? 'static' : 'carousel',
          role: index === 0 ? 'standalone-composition' : 'sequence-slide',
          order: index === 0 ? 1 : index,
          storagePath,
          mediaType: 'image',
        })),
        website_url: websiteUrl,
        status: 'analyzing',
        current_stage: 'queued for background research',
        progress: 5,
      })
      jobPersisted = !jobInsertError
    }
    const workflowMetadata = {
      jobId,
      brandId,
      requestedByUserId: user?.id || null,
      requestedByEmail: user?.email || null,
      schemaVersion: BRAND_SYSTEM_SCHEMA_VERSION,
      requestedFeatures,
    }

    if (!workerRequest) {
      const workerBody = JSON.stringify({ ...body, backgroundJobId: jobId })
      dispatchBackgroundWorker(new URL(req.url).toString(), {
          'Content-Type': 'application/json',
          'x-brand-setup-worker': workerSecret,
        }, workerBody, error => {
        void updateJob({ status: 'failed', current_stage: 'background worker failed to start', error: error.message })
      })
      return NextResponse.json({ jobId, status: 'queued' }, { status: 202 })
    }

    const warnings: string[] = []
    let websiteText = ''
    let websitePages: string[] = []
    try {
      const websiteExtraction = await extractWebsite(websiteUrl)
      websiteText = websiteExtraction.text
      websitePages = websiteExtraction.pages
    } catch (error) {
      warnings.push((error as Error).message)
    }

    let guidelineText = ''
    let guidelineType: 'pdf' | 'docx' | null = null
    if (guidelineStoragePath) {
      try {
        const guidelineBlob = await downloadStorageBlob(guidelineStoragePath)
        guidelineType = guidelineFormat(guidelineStoragePath, guidelineBlob.type)
        if (!guidelineType) throw new Error('Only PDF and DOCX brand-guideline documents are supported.')
        const guidelineBuffer = Buffer.from(await guidelineBlob.arrayBuffer())
        guidelineText = guidelineType === 'pdf'
          ? cleanText((await pdfParse(guidelineBuffer)).text || '')
          : await extractDocxText(guidelineBuffer)
        if (guidelineText.length < 200) warnings.push(`The uploaded ${guidelineType.toUpperCase()} contained very little extractable text.`)
      } catch (error) {
        warnings.push(`Brand-guideline document warning: ${(error as Error).message}`)
      }
    }

    const sourceContext: BrandSourceContext = {
      websiteUrl,
      websiteText,
      guidelineType,
      guidelineText,
    }

    await updateJob(body.deepResearchOverride
      ? {
          current_stage: 'loading completed research dossier',
          progress: 29,
        }
      : {
          current_stage: 'deep researching brand sources',
          progress: 20,
        })
    const deepResearch = workerRequest && body.deepResearchOverride
      ? body.deepResearchOverride
      : await requestBrandDeepResearch(
          brand.name,
          sourceContext,
          jobId,
          async (progress, currentStage) => updateJob({ progress, current_stage: currentStage })
        )
    if (!deepResearch) {
      const researchError = 'The initial deep-research pass did not return a complete source dossier. Nothing was saved; please retry.'
      await updateJob({
        status: 'failed',
        current_stage: 'deep research failed',
        error: researchError,
      })
      return NextResponse.json({ error: researchError }, { status: 502 })
    }

    // Deep research gets its own background request. Resume the remaining Sol
    // stages in a fresh worker request so a legitimate 8–12 minute research
    // run cannot consume the time budget needed for visual analysis, synthesis,
    // and final writing.
    if (workerRequest && !body.deepResearchOverride) {
      await updateJob({
        status: 'analyzing',
        current_stage: 'deep research complete; starting visual analysis',
        progress: 28,
        error: null,
      })
      const continuationBody = JSON.stringify({
        ...body,
        backgroundJobId: jobId,
        deepResearchOverride: deepResearch,
      })
      dispatchBackgroundWorker(new URL(req.url).toString(), {
        'Content-Type': 'application/json',
        'x-brand-setup-worker': workerSecret,
      }, continuationBody, error => {
        void updateJob({
          status: 'failed',
          current_stage: 'post-research worker failed to start',
          error: error.message,
        })
      })
      return NextResponse.json({ jobId, status: 'deep-research-complete' }, { status: 202 })
    }

    let carouselPdfPages = 0
    let carouselPdfSignedUrl = ''
    if (carouselPdfStoragePath) {
      const carouselBlob = await downloadStorageBlob(carouselPdfStoragePath)
      if (carouselBlob.size > MAX_CAROUSEL_PDF_BYTES) {
        return NextResponse.json({ error: 'The carousel PDF must be 30 MB or smaller.' }, { status: 400 })
      }
      if (carouselBlob.type && carouselBlob.type !== 'application/pdf' && !carouselPdfStoragePath.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'The carousel reference must be a PDF.' }, { status: 400 })
      }
      const carouselBuffer = Buffer.from(await carouselBlob.arrayBuffer())
      const carouselDocument = await pdfParse(carouselBuffer)
      carouselPdfPages = carouselDocument.numpages || 0
      if (carouselPdfPages !== REQUIRED_CAROUSEL_PAGES) {
        return NextResponse.json({
          error: `The carousel PDF must contain exactly ${REQUIRED_CAROUSEL_PAGES} ordered pages; this file contains ${carouselPdfPages}.`,
        }, { status: 400 })
      }
      carouselPdfSignedUrl = mediaAnalysisUrl(carouselPdfStoragePath)
    }

    const referenceContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
    > = []
    const responsesReferenceContent: Array<
      | { type: 'input_text'; text: string }
      | { type: 'input_image'; image_url: string; detail: 'high' }
    > = []
    const signedImageUrls: Array<string | null> = Array(imagePaths.length).fill(null)

    for (let index = 0; index < imagePaths.length; index++) {
      const blob = await downloadStorageBlob(imagePaths[index])
      if (blob.size > MAX_REFERENCE_BYTES) {
        warnings.push(`Reference image ${index + 1} was skipped because it is larger than 8 MB.`)
        continue
      }
      let analysisUrl: string
      try {
        analysisUrl = mediaAnalysisUrl(imagePaths[index])
      } catch {
        warnings.push(`Reference image ${index + 1} was skipped because an analysis URL could not be created.`)
        continue
      }
      signedImageUrls[index] = analysisUrl
      referenceContent.push({
        type: 'text',
        text: `REFERENCE IMAGE ${index + 1} — DECLARED TYPE: ${imageTypes[index]}. If auto, classify it before using it. A logo/palette reference controls identity evidence only and must never be treated as layout or composition evidence.`,
      })
      responsesReferenceContent.push({
        type: 'input_text',
        text: imageTypes[index] === 'static-creative'
          ? `REFERENCE ${index + 1} — DECLARED TYPE: static-creative. This is the standalone static composition reference. Analyze only visible evidence.`
          : `REFERENCE ${index + 1} — DECLARED TYPE: carousel-slide. This is ordered carousel slide ${index}. Analyze this exact slide's visible geometry and preserve its sequence position.`,
      })
      referenceContent.push({
        type: 'image_url',
        image_url: { url: analysisUrl, detail: 'high' },
      })
      responsesReferenceContent.push({
        type: 'input_image',
        image_url: analysisUrl,
        detail: 'high',
      })
    }

    const usableImageCount = referenceContent.filter(item => item.type === 'image_url').length
    if (usableImageCount === 0) {
      return NextResponse.json({ error: 'No usable reference images were found.' }, { status: 422 })
    }

    const evidenceText = [
      `TARGET BRAND: ${brand.name}`,
      `WEBSITE URL: ${websiteUrl}`,
      'OUTPUT REQUIREMENT: Return exactly one valid JSON object and no Markdown fences or commentary.',
      '',
      'SOURCE PROCESSING NOTE: Complete website and guideline text is processed separately in lossless chunks. Use only the verified fact bank supplied during synthesis for factual claims; this visual-analysis prompt contains no raw source corpus.',
      '',
      carouselPdfStoragePath
        ? `VISUAL REFERENCE CONTRACT: Reference 1 is the supplied standalone static image. References 2–7 are pages 1–6 of the supplied carousel PDF in exact page order. Create one sourceEvidence entry for each of these seven visual references. Treat Reference 1 as declaredType static-creative and References 2–7 as declaredType carousel-slide. Both roles classify as campaign-creative, but their production groups must never be mixed.`
        : `VISUAL REFERENCE CONTRACT: Exactly seven images follow in authoritative order. Reference 1 is the standalone static creative. References 2–7 are carousel slides 1–6 in exact sequence. Create one sourceEvidence entry for each image and one page-specific blueprint for every carousel slide. Do not merge, average, or reorder them.`,
      staticReferenceIndexes.length ? `AUTHORITATIVE STATIC GROUP: Reference ${staticReferenceIndexes.join(', ')} ${staticReferenceIndexes.length === 1 ? 'is a standalone static creative' : 'are standalone static creatives'}. Use this group as the primary composition evidence for staticLayouts.` : '',
      carouselReferenceIndexes.length ? `AUTHORITATIVE CAROUSEL GROUP: References ${carouselReferenceIndexes.join(', ')} are one ordered carousel sequence${carouselPdfStoragePath ? ' corresponding to PDF pages 1–6' : ''}. Preserve their order, recurring template, shared grid, and slide-to-slide progression in carousel family one. Do not mix standalone static references into this family.` : '',
    ].join('\n')

    await updateJob({ current_stage: 'analyzing visual references', progress: 30 })

    const carouselMappingText = 'CAROUSEL PDF — PDF page 1 is Reference 2, page 2 is Reference 3, continuing through page 6 as Reference 7. Inspect every page visually and preserve this order.'
    const buildWorkflowBody = (systemPrompt: string, promptText: string) => carouselPdfStoragePath
      ? {
          metadata: workflowMetadata,
          apiMode: 'responses',
          model: VISUAL_ANALYSIS_MODEL,
          systemPrompt,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: promptText },
              ...responsesReferenceContent,
              { type: 'input_text', text: carouselMappingText },
              { type: 'input_file', file_url: carouselPdfSignedUrl },
            ],
          }],
        }
      : {
          metadata: workflowMetadata,
          model: VISUAL_ANALYSIS_MODEL,
          systemPrompt,
          messages: [
            { role: 'user', content: [{ type: 'text', text: promptText }, ...referenceContent] },
          ],
        }

    const runCombinedVisualAnalysis = async (): Promise<VisualEvidenceResult | null> => {
      try {
        const response = await fetch(N8N_BRAND_SETUP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildWorkflowBody(
            BRAND_SETUP_VISUAL_EVIDENCE_PROMPT,
            `${evidenceText}\n\nANALYSIS MODE: Measure the supplied references before proposing any creative direction. Geometry, module anatomy, and hierarchy are the only deliverable.`
          )),
        })
        const responseText = await response.text()
        if (!response.ok) {
          console.warn('[brand-setup] combined visual analysis request failed', {
            status: response.status,
            response: responseText.slice(0, 300),
          })
          return null
        }
        if (!responseText.trim()) {
          console.warn('[brand-setup] combined visual analysis returned an empty response')
          return null
        }
        const envelope = JSON.parse(responseText) as { result?: VisualEvidenceResult | string }
        if (!envelope.result) {
          console.warn('[brand-setup] combined visual analysis returned no result field', {
            response: responseText.slice(0, 300),
          })
          return null
        }
        const parsed = (typeof envelope.result === 'string'
          ? JSON.parse(jsonrepair(envelope.result))
          : envelope.result) as VisualEvidenceResult
        if (!parsed?.sourceEvidence || !parsed?.visualBlueprints) {
          console.warn('[brand-setup] combined visual analysis returned the wrong JSON shape', {
            resultKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 12) : [],
          })
          return null
        }
        return parsed
      } catch (error) {
        console.warn('[brand-setup] combined visual analysis threw before producing evidence', {
          error: error instanceof Error ? error.message : String(error),
        })
        return null
      }
    }

    let visualEvidence: VisualEvidenceResult | null = null
    if (usesFeatureManifest && hasImageCarousel) {
      const analyzedAssets = await Promise.all(signedImageUrls.map((signedUrl, index) => {
        if (!signedUrl) return Promise.resolve(null)
        const isStaticReference = index < staticReferenceIndexes.length
        return analyzeManifestAsset(
          signedUrl,
          index + 1,
          isStaticReference ? 'static-creative' : 'carousel-slide',
          isStaticReference ? undefined : index - staticReferenceIndexes.length + 1,
          { ...workflowMetadata, stage: `visual-reference-${index + 1}` }
        )
      }))
      const usableAnalyses = analyzedAssets.filter((asset): asset is AnalyzedManifestAsset => Boolean(asset))
      if (usableAnalyses.length > 0) {
        visualEvidence = await aggregateManifestEvidence(usableAnalyses, { ...workflowMetadata, stage: 'visual-evidence-aggregation' })
        if (usableAnalyses.length < imagePaths.length) {
          warnings.push(`Independent visual analysis completed for ${usableAnalyses.length} of ${imagePaths.length} references. The available measured evidence was retained; missing references were not invented.`)
        }
      }
    }
    if (!visualEvidence?.sourceEvidence || !visualEvidence.visualBlueprints) {
      visualEvidence = await runCombinedVisualAnalysis()
    }
    if (!visualEvidence?.sourceEvidence || !visualEvidence.visualBlueprints) {
      return NextResponse.json({
        error: 'Visual reference analysis returned no usable evidence after automatic retry and fallback. Check the latest n8n execution.',
      }, { status: 502 })
    }
    visualEvidence = consolidateVisualEvidence(visualEvidence, hasOrderedCarousel)
    const expectedReferenceCount = usableImageCount
    const measuredReferences = visualEvidence.sourceEvidence?.references || []
    const staticBlueprint = visualEvidence.visualBlueprints?.staticSystem
    const carouselBlueprint = visualEvidence.visualBlueprints?.carouselSystem
    const evidenceIsProductionReady = measuredReferences.length === expectedReferenceCount
      && measuredReferences.every(reference => Array.isArray(reference.observedTraits) && reference.observedTraits.length >= 8)
      && Boolean(
        staticBlueprint
        && Array.isArray(staticBlueprint.zones)
        && staticBlueprint.zones.length >= 2
        && Array.isArray(staticBlueprint.invariants)
        && staticBlueprint.invariants.length >= 1
      )
      && (!hasOrderedCarousel || Boolean(
        carouselBlueprint
        && Array.isArray(carouselBlueprint.slides)
        && carouselBlueprint.slides.length === REQUIRED_CAROUSEL_PAGES
        && Array.isArray(carouselBlueprint.recurringComponents)
        && carouselBlueprint.recurringComponents.length >= 1
        && (visualEvidence.sourceEvidence && Array.isArray(visualEvidence.sourceEvidence.repeatedPatterns)
          ? visualEvidence.sourceEvidence.repeatedPatterns.length
          : 0) >= 2
      ))
    const hasUsableEvidenceShape = measuredReferences.length > 0
      && Boolean(staticBlueprint)
      && Boolean(carouselBlueprint)
    if (!hasUsableEvidenceShape) {
      console.warn('[brand-setup] visual evidence gate rejected analysis', {
        expectedReferenceCount,
        measuredReferenceCount: measuredReferences.length,
        observedTraitCounts: measuredReferences.map(reference => Array.isArray(reference.observedTraits) ? reference.observedTraits.length : 0),
        staticZones: Array.isArray(staticBlueprint?.zones) ? staticBlueprint.zones.length : 0,
        staticInvariants: Array.isArray(staticBlueprint?.invariants) ? staticBlueprint.invariants.length : 0,
        carouselSlides: Array.isArray(carouselBlueprint?.slides) ? carouselBlueprint.slides.length : 0,
        carouselComponents: Array.isArray(carouselBlueprint?.recurringComponents) ? carouselBlueprint.recurringComponents.length : 0,
        repeatedPatterns: Array.isArray(visualEvidence.sourceEvidence?.repeatedPatterns) ? visualEvidence.sourceEvidence.repeatedPatterns.length : 0,
      })
      return NextResponse.json({
        error: 'The visual analyst returned no usable reference blueprint. Retry generation; the incomplete analysis was not saved.',
      }, { status: 422 })
    }
    if (!evidenceIsProductionReady) {
      warnings.push('The visual evidence pass was incomplete in places; missing fields were consolidated from the measured slide blueprints instead of discarding the generation.')
    }

    const authoritativeVisualEvidence = {
      sourceEvidence: visualEvidence.sourceEvidence,
      visualBlueprints: visualEvidence.visualBlueprints,
    }
    // The full raw source can be hundreds of thousands of characters. Convert
    // it to a lossless, deduplicated fact bank before synthesis so n8n never
    // receives the raw corpus and the same source information twice.
    const factBank = await tryExtractBrandFactBank(brand.name, sourceContext)
    if (!factBank) {
      const factError = 'The website and guideline could not be converted into a verified brand fact bank. Nothing was saved; please retry.'
      await updateJob({
        status: 'failed',
        current_stage: 'source fact extraction failed',
        error: factError,
      })
      return NextResponse.json({ error: factError }, { status: 502 })
    }
    await updateJob({ status: 'compiling', current_stage: 'compiling feature outputs', progress: 60 })
    const editorialFactBank = buildBrandDescriptionFactBank(factBank)
    const synthesisFactBank: BrandFactBank = {
      ...editorialFactBank,
      facts: editorialFactBank.facts.filter(fact => fact.importance === 'required'),
    }
    const synthesisText = `${evidenceText}\n\nCURATED VERIFIED FACTS FOR THIS COMPACT STRUCTURAL PASS — DO NOT INVENT BEYOND THEM:\n${JSON.stringify(synthesisFactBank)}\n\nAUTHORITATIVE VISUAL EVIDENCE JSON — USE THIS AS THE SPATIAL SOURCE OF TRUTH. THE SERVER PRESERVES IT, SO DO NOT REPEAT sourceEvidence OR visualBlueprints IN YOUR RESPONSE:\n${JSON.stringify(authoritativeVisualEvidence)}`
    // The visual pass already inspected the image and every PDF page. Re-sending
    // those files makes the synthesis request unnecessarily multimodal and prone
    // to exceeding n8n's HTTP-node timeout. The measured JSON is sufficient here;
    // dedicated compiler calls expand the compact concepts afterward.
    const workflowBody = {
      metadata: { ...workflowMetadata, stage: 'brand-system-synthesis' },
      model: MODEL,
      reasoningEffort: 'low',
      maxOutputTokens: 12_000,
      systemPrompt: BRAND_SETUP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: synthesisText }],
    }

    const workflowRes = await fetch(N8N_BRAND_SETUP_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowBody),
    })

    const workflowText = await workflowRes.text().catch(() => '')
    if (!workflowRes.ok) {
      const workflowError = `Brand setup workflow failed (${workflowRes.status})${workflowText ? `: ${workflowText.slice(0, 300)}` : '. Check the latest n8n execution.'}`
      await updateJob({
        status: 'failed',
        current_stage: 'brand system synthesis failed',
        error: workflowError,
      })
      return NextResponse.json(
        { error: workflowError },
        { status: 502 }
      )
    }

    if (!workflowText.trim()) {
      console.error('[brand-setup] n8n returned an empty synthesis response', {
        status: workflowRes.status,
        contentType: workflowRes.headers.get('content-type'),
      })
      const emptyError = 'The n8n workflow returned an empty response. Check the latest n8n execution.'
      await updateJob({
        status: 'failed',
        current_stage: 'brand system synthesis failed',
        error: emptyError,
      })
      return NextResponse.json({ error: emptyError }, { status: 502 })
    }
    let workflowData: { result?: BrandSetupResult | string }
    try {
      workflowData = JSON.parse(workflowText) as { result?: BrandSetupResult | string }
    } catch {
      return NextResponse.json({
        error: 'The n8n workflow returned incomplete JSON. This normally means the AI response was truncated; retry once and inspect the latest n8n execution if it repeats.',
      }, { status: 502 })
    }
    if (!workflowData.result) {
      return NextResponse.json({ error: 'Brand setup workflow returned no result.' }, { status: 502 })
    }
    let rawResult: BrandSetupResult
    try {
      rawResult = typeof workflowData.result === 'string'
        ? parseModelJson(workflowData.result)
        : workflowData.result
    } catch {
      return NextResponse.json({
        error: 'The AI response ended before its JSON was complete. The generation was not saved; please retry.',
      }, { status: 502 })
    }
    rawResult = {
      ...rawResult,
      sourceEvidence: authoritativeVisualEvidence.sourceEvidence!,
      visualBlueprints: authoritativeVisualEvidence.visualBlueprints!,
    }
    let result = normalizeBrandSetupResult(rawResult, brand.name)
    result = { ...result, infographicLayouts: buildInfographicLayouts(result) }
    result.warnings = [...(Array.isArray(result.warnings) ? result.warnings : []), ...warnings]
    if (!hasCompletePromptStructure(result)) {
      const structurallyRepaired = await tryRepairPromptStructure(result)
      if (structurallyRepaired) result = structurallyRepaired
    }
    await updateJob({
      current_stage: 'writing nine-section brand guide',
      progress: 72,
    })
    const brandDescriptionFactBank = editorialFactBank
    let validationIssues = validateBrandSetupResult(result)
    const needsPromptExpansion = validationIssues.some(issue => issue.includes('layout') || issue.includes('template') || issue.includes('carousel'))
    const [compiledResult, finalBrandGuide, expandedInfographicGuide] = await Promise.all([
      needsPromptExpansion ? tryCompilePromptLibrary(result) : Promise.resolve(null),
      writeNineSectionBrandGuide(brandDescriptionFactBank, deepResearch, sourceContext, result),
      tryExpandInfographicGuide(result, factBank),
    ])
    if (compiledResult) result = compiledResult
    if (!finalBrandGuide) {
      const compactError = `The Brand Description could not be written with all nine required sections inside the ${MIN_BRAND_DESCRIPTION_CHARS.toLocaleString()}–${MAX_BRAND_DESCRIPTION_CHARS.toLocaleString()} character range. Nothing was saved; please retry.`
      await updateJob({
        status: 'failed',
        current_stage: 'nine-section brand guide failed',
        error: compactError,
      })
      return NextResponse.json({ error: compactError }, { status: 502 })
    }
    const requiredFactCount = brandDescriptionFactBank.facts.filter(fact => fact.importance === 'required').length
    const supportingFactCount = brandDescriptionFactBank.facts.length - requiredFactCount
    const guideWarnings = [
      `Initial deep research combined the uploaded guideline, official website extraction, and ${Array.isArray(deepResearch.sources) ? deepResearch.sources.length : 0} reported web source(s).`,
      `Brand Description was generated from ${requiredFactCount} editorially selected verified facts; ${supportingFactCount} additional facts remain available to production prompts.`,
      `Brand Description contains ${finalBrandGuide.length.toLocaleString()} characters across all nine required sections.`,
      ...(factBank.sourceIdentity.hasIdentityMismatch
        ? [`Source identity mismatch: the selected record "${brand.name}" differs from ${factBank.sourceIdentity.verifiedBrandNames.join(', ') || 'the verified source identity'}.`]
        : []),
      ...(expandedInfographicGuide
        ? ['Infographic guidelines were expanded in a separate production pass.']
        : ['Infographic guideline expansion did not complete; the source-grounded draft remains available for review.']),
    ]
    result = normalizeBrandSetupResult({
      ...result,
      brandDescription: finalBrandGuide,
      infographicGuidelines: expandedInfographicGuide || result.infographicGuidelines,
      warnings: [...result.warnings, ...guideWarnings],
    }, brand.name)
    validationIssues = validateBrandSetupResult(result)
    const blockingIssues = getBlockingBrandSetupIssues(validationIssues)
    const advisoryIssues = validationIssues.filter(issue => !blockingIssues.includes(issue))
    if (advisoryIssues.length) {
      result.warnings = [
        ...result.warnings,
        `Automated quality review found ${advisoryIssues.length} advisory item(s); the result remains structurally valid and reviewable.`,
        ...advisoryIssues.slice(0, 5).map(issue => `Quality advisory: ${issue}`),
      ]
    }
    if (blockingIssues.length) {
      console.error('[brand-setup] validation rejected AI output', {
        blockingIssues,
        allValidationIssues: validationIssues,
        structure: {
          staticLayouts: result.staticLayouts.length,
          editableTemplates: result.editableTemplates.length,
          carouselLayouts: result.carouselLayouts.length,
          carouselSlides: result.carouselLayouts.map(layout => layout.slides.length),
        },
      })
      await updateJob({
        status: 'failed',
        current_stage: 'quality check failed',
        error: blockingIssues.slice(0, 5).join('; '),
      })
      return NextResponse.json(
        {
          error: `The AI output failed ${blockingIssues.length} required check(s). ${blockingIssues.slice(0, 3).join('; ')}${blockingIssues.length > 3 ? '. Retry generation.' : ''}`,
          validationIssues,
        },
        { status: 422 }
      )
    }

    result = {
      ...result,
      brandSystem: toVersionedBrandSystemDocument(result, requestedFeatures),
    }

    await updateJob({
      status: 'review',
      current_stage: 'ready for review',
      progress: 100,
      // Keep the complete review payload so a background job can restore the
      // same review screen the synchronous path previously returned.
      result,
      error: null,
    })

    return NextResponse.json({
      jobId,
      result,
      sourceSummary: {
        websiteCharacters: websiteText.length,
        websitePages: websitePages.length,
        guidelineCharacters: guidelineText.length,
        verifiedFacts: factBank.facts.length,
        referenceImages: usableImageCount,
        carouselPages: carouselReferenceIndexes.length || carouselPdfPages,
      },
      // Kept in the live review response only. It lets the section-by-section
      // prompt workshop test user-authored prompts against the full verified
      // research bank without storing a second copy in the published profile.
      sectionSourceContext: {
        sourceIdentity: factBank.sourceIdentity,
        facts: factBank.facts,
        uncertainties: factBank.uncertainties,
      },
    })
  } catch (error) {
    await updateJob({
      status: 'failed',
      current_stage: 'failed',
      error: (error as Error).message || 'Unexpected error',
    })
    return NextResponse.json({ error: (error as Error).message || 'Unexpected error' }, { status: 500 })
  }
}
