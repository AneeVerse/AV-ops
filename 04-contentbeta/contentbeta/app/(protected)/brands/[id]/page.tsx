'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast'
import { sb } from '@/lib/supabase'
import BannerPreview, {
  BANNER_SIZES, DEFAULT_BANNER_TEMPLATES,
  injectCustomFont, migrateTemplate,
  type BannerSizeTemplate, type TemplateElement,
  type BannerCopy,
} from '@/components/BannerPreview'
import { PPT_SLIDE_TEMPLATES } from '@/lib/ppt/slide-templates'
import { authedFetch } from '@/lib/authed-fetch'
import { uploadMedia, deleteMediaClient } from '@/lib/media-upload'

interface Brand { id: string; name: string }
interface BrandProfile { logo_url: string | null; logo_storage_path: string | null; style_prompt: string | null; brand_scrap: string | null; infographic_md: string | null; infographic_logo_light_url: string | null; infographic_logo_dark_url: string | null; infographic_font_heading: string | null; infographic_font_heading_url: string | null; infographic_font_body: string | null; infographic_font_body_url: string | null; ppt_md: string | null; banner_bg_prompt: string | null; ppt_font_heading: string | null; ppt_font_heading_url: string | null; ppt_font_body: string | null; ppt_font_body_url: string | null; blog_plan_prompt: string | null; blog_canvas_prompt: string | null }
interface Category { id: string; label: string; brand_id: string; created_at: string }
interface BrokerPrompt { id: string; name: string; prompt: string; reference_image_urls?: string[] | null }
interface CarouselLayout { id: string; name: string; brand_id: string; created_at: string }
interface InfographicLayout { id: string; name: string; brand_id: string; description: string | null; image_url: string | null; logo_url: string | null; is_active: boolean; created_at: string }
interface BlogLayoutGroup { id: string; brand_id: string; name: string; description: string | null; is_active: boolean; created_at: string }
interface BlogLayoutSlot { id: string; group_id: string; slot_index: number; name: string; description: string | null; layout_json: string | null; created_at: string }
interface PptLayout { id: string; name: string; brand_id: string; description: string | null; image_url: string | null; is_active: boolean; created_at: string }
interface OverlayTemplate { id: string; name: string; brand_id: string; bg_prompt: string | null; puppeteer_config: Record<string, unknown> | null; created_at: string }
interface IllustrationLayout { id: string; brand_id: string; name: string; prompt: string; created_at: string }

// Detect layout content tokens not covered by a prompt (mirrors regen-prompt API logic)
const _PPT_STYLE_KEYS = new Set([
  'color','fill','fontFamily','src','stroke','background',
  'headerFill','headerTextColor','alternateRowFill','borderColor',
  'highlightColor','segmentBorderColor','line','marker','colors',
])
const _PPT_SYSTEM_TOKENS = new Set([
  'primary','accent','dark','light','white',
  'headlineFont','bodyFont','titleFont',
  'logoUrl','logoForDark','decorationUrl','canvasW','canvasH',
])
function _pptContentTokens(val: unknown, parentKey = ''): string[] {
  if (typeof val === 'string') {
    if (_PPT_STYLE_KEYS.has(parentKey)) return []
    return Array.from(val.matchAll(/\{\{([^}]+)\}\}/g), m => m[1].trim())
  }
  if (Array.isArray(val)) return val.flatMap(v => _pptContentTokens(v, parentKey))
  if (val && typeof val === 'object') {
    return Object.entries(val as Record<string, unknown>).flatMap(([k, v]) => _pptContentTokens(v, k))
  }
  return []
}
function _tokenCoveredByPrompt(token: string, prompt: string): boolean {
  // Exact match (catches backtick-wrapped names that regen now produces)
  if (prompt.includes(token)) return true
  // Case-insensitive fallback: camelCase → space-separated words e.g. centerKpi → center kpi
  const words = token.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return prompt.toLowerCase().includes(words)
}
function getLayoutPromptMismatches(layoutJson: string, promptText: string): string[] {
  let parsed: unknown
  try { parsed = JSON.parse(layoutJson) } catch { return [] }
  const tokens = Array.from(new Set(_pptContentTokens(parsed).filter(t => !_PPT_SYSTEM_TOKENS.has(t))))
  return tokens.filter(t => !_tokenCoveredByPrompt(t, promptText))
}

const PRESET_FONTS = [
  { label: 'Default (inherit)', value: '' },
  { label: 'Inter',            value: 'Inter' },
  { label: 'Roboto',           value: 'Roboto' },
  { label: 'Open Sans',        value: 'Open Sans' },
  { label: 'Lato',             value: 'Lato' },
  { label: 'Poppins',          value: 'Poppins' },
  { label: 'Montserrat',       value: 'Montserrat' },
  { label: 'Nunito',           value: 'Nunito' },
  { label: 'DM Sans',          value: 'DM Sans' },
  { label: 'Raleway',          value: 'Raleway' },
  { label: 'Oswald',           value: 'Oswald' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Merriweather',     value: 'Merriweather' },
  { label: 'Georgia',          value: 'Georgia' },
  { label: 'Arial',            value: 'Arial' },
  { label: 'Trebuchet MS',     value: 'Trebuchet MS' },
]

function extractPrimaryColor(prompt: string): string {
  const match = prompt.match(/#([0-9a-fA-F]{6})\b/)
  return match ? '#' + match[1] : '#1e40af'
}

async function uploadBannerElement(file: File): Promise<string> {
  const uploaded = await uploadMedia(file, { folder: 'generated-posts/banner-elements', fileName: file.name })
  return uploaded.url
}


export default function BrandDetailPage() {
  const { id: brandId } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [profile, setProfile] = useState<BrandProfile | null>(null)
  const [stylePrompt, setStylePrompt] = useState('')
  const [brandScrap, setBrandScrap] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [countMap, setCountMap] = useState<Record<string, number>>({})
  const [savingDesc, setSavingDesc] = useState(false)
  const [savingScrap, setSavingScrap] = useState(false)
  const [infographicMd, setInfographicMd] = useState('')
  const [infographicMdFileName, setInfographicMdFileName] = useState('')
  const [savingMd, setSavingMd] = useState(false)
  const mdInputRef = useRef<HTMLInputElement>(null)

  const [pptMd, setPptMd] = useState('')
  const [pptMdFileName, setPptMdFileName] = useState('')
  const [savingPptMd, setSavingPptMd] = useState(false)
  const pptMdInputRef = useRef<HTMLInputElement>(null)

  const [bannerBgPrompt, setBannerBgPrompt] = useState('')
  const [savingBannerBgPrompt, setSavingBannerBgPrompt] = useState(false)

  // Infographic brand logos (light + dark)
  const [infographicLogoLightUrl, setInfographicLogoLightUrl] = useState<string | null>(null)
  const [infographicLogoDarkUrl, setInfographicLogoDarkUrl] = useState<string | null>(null)
  const [infographicLogoLightFile, setInfographicLogoLightFile] = useState<File | null>(null)
  const [infographicLogoDarkFile, setInfographicLogoDarkFile] = useState<File | null>(null)
  const [savingInfographicLogos, setSavingInfographicLogos] = useState(false)
  const infographicLogoLightInputRef = useRef<HTMLInputElement>(null)
  const infographicLogoDarkInputRef = useRef<HTMLInputElement>(null)

  // Infographic fonts
  const [infographicFontHeading, setInfographicFontHeading] = useState('')
  const [infographicFontHeadingUrl, setInfographicFontHeadingUrl] = useState('')
  const [infographicFontBody, setInfographicFontBody] = useState('')
  const [infographicFontBodyUrl, setInfographicFontBodyUrl] = useState('')
  const [infographicFontHeadingFile, setInfographicFontHeadingFile] = useState<File | null>(null)
  const [infographicFontBodyFile, setInfographicFontBodyFile] = useState<File | null>(null)
  const [savingInfographicFonts, setSavingInfographicFonts] = useState(false)
  const infographicFontHeadingInputRef = useRef<HTMLInputElement>(null)
  const infographicFontBodyInputRef = useRef<HTMLInputElement>(null)

  // PPT fonts
  const [pptFontHeading, setPptFontHeading] = useState('')
  const [pptFontHeadingUrl, setPptFontHeadingUrl] = useState('')
  const [pptFontBody, setPptFontBody] = useState('')
  const [pptFontBodyUrl, setPptFontBodyUrl] = useState('')
  const [pptFontHeadingFile, setPptFontHeadingFile] = useState<File | null>(null)
  const [pptFontBodyFile, setPptFontBodyFile] = useState<File | null>(null)
  const [savingPptFonts, setSavingPptFonts] = useState(false)
  const pptFontHeadingInputRef = useRef<HTMLInputElement>(null)
  const pptFontBodyInputRef = useRef<HTMLInputElement>(null)

  // PPT slide template selection (which templates AI can use for this brand)
  const [pptEnabledTemplates, setPptEnabledTemplates] = useState<string[] | null>(null)
  const [savingPptTemplates, setSavingPptTemplates] = useState(false)
  // PPT template prompt overrides (per-brand custom prompts)
  const [pptTemplateOverrides, setPptTemplateOverrides] = useState<Record<string, string>>({})
  const [pptLayoutOverrides, setPptLayoutOverrides] = useState<Record<string, string>>({})
  const [editingPptTemplate, setEditingPptTemplate] = useState<string | null>(null)
  const [editPptPrompt, setEditPptPrompt] = useState('')
  const [editPptLayout, setEditPptLayout] = useState('')
  const [pptModalTab, setPptModalTab] = useState<'prompt' | 'layout'>('prompt')
  const [savingPptEdit, setSavingPptEdit] = useState(false)
  const [layoutJsonError, setLayoutJsonError] = useState<string | null>(null)
  const [regenPromptLoading, setRegenPromptLoading] = useState(false)
  const [promptMismatches, setPromptMismatches] = useState<string[]>([])
  const [pptPlanSystemPrompt, setPptPlanSystemPrompt] = useState('')
  const [savingPptPlanPrompt, setSavingPptPlanPrompt] = useState(false)

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catName, setCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  // Category rename state
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Carousel layouts state
  const [carouselLayouts, setCarouselLayouts] = useState<CarouselLayout[]>([])
  const [carouselModalOpen, setCarouselModalOpen] = useState(false)
  const [carouselNewName, setCarouselNewName] = useState('')
  const [carouselAddSaving, setCarouselAddSaving] = useState(false)
  const [editingCarousel, setEditingCarousel] = useState<string | null>(null)
  const [carouselEditName, setCarouselEditName] = useState('')
  const [carouselRenameSaving, setCarouselRenameSaving] = useState(false)

  // Infographic layouts state
  const [infographicLayouts, setInfographicLayouts] = useState<InfographicLayout[]>([])
  const [infographicModalOpen, setInfographicModalOpen] = useState(false)
  const [infographicNewName, setInfographicNewName] = useState('')
  const [infographicNewDescription, setInfographicNewDescription] = useState('')
  const [infographicNewImageUrl, setInfographicNewImageUrl] = useState('')
  const [infographicImageFile, setInfographicImageFile] = useState<File | null>(null)
  const [infographicImagePreview, setInfographicImagePreview] = useState<string | null>(null)
  const [infographicAddSaving, setInfographicAddSaving] = useState(false)
  const [editingInfographicLayout, setEditingInfographicLayout] = useState<InfographicLayout | null>(null)

  // Blog JSON Layout Groups + Slots state
  const [blogLayoutGroups, setBlogLayoutGroups] = useState<BlogLayoutGroup[]>([])
  const [blogGroupModalOpen, setBlogGroupModalOpen] = useState(false)
  const [blogGroupNewName, setBlogGroupNewName] = useState('')
  const [blogGroupNewDescription, setBlogGroupNewDescription] = useState('')
  const [blogGroupAddSaving, setBlogGroupAddSaving] = useState(false)
  const [editingBlogGroup, setEditingBlogGroup] = useState<BlogLayoutGroup | null>(null)
  const [managingSlotsGroup, setManagingSlotsGroup] = useState<BlogLayoutGroup | null>(null)
  const [blogSlots, setBlogSlots] = useState<BlogLayoutSlot[]>([])
  const [blogSlotsLoading, setBlogSlotsLoading] = useState(false)
  const [blogSlotDrafts, setBlogSlotDrafts] = useState<Record<string, { name: string; description: string; layout_json: string }>>({})
  const [blogSlotJsonErrors, setBlogSlotJsonErrors] = useState<Record<string, string>>({})
  const [blogSlotSaving, setBlogSlotSaving] = useState<Record<string, boolean>>({})

  // Blog workflow prompts (admin-editable overrides for the n8n plan/canvas system prompts)
  const [blogPlanPrompt, setBlogPlanPrompt] = useState('')
  const [savingBlogPlanPrompt, setSavingBlogPlanPrompt] = useState(false)
  const [blogCanvasPrompt, setBlogCanvasPrompt] = useState('')
  const [savingBlogCanvasPrompt, setSavingBlogCanvasPrompt] = useState(false)

  // PPT layouts state
  const [pptLayouts, setPptLayouts] = useState<PptLayout[]>([])
  const [pptLayoutModalOpen, setPptLayoutModalOpen] = useState(false)
  const [pptLayoutNewName, setPptLayoutNewName] = useState('')
  const [pptLayoutNewDescription, setPptLayoutNewDescription] = useState('')
  const [pptLayoutNewImageUrl, setPptLayoutNewImageUrl] = useState('')
  const [pptLayoutImageFile, setPptLayoutImageFile] = useState<File | null>(null)
  const [pptLayoutImagePreview, setPptLayoutImagePreview] = useState<string | null>(null)
  const [pptLayoutAddSaving, setPptLayoutAddSaving] = useState(false)
  const [editingPptLayout, setEditingPptLayout] = useState<PptLayout | null>(null)
  const pptLayoutFileInputRef = useRef<HTMLInputElement>(null)

  // Overlay templates state
  const [overlayTemplates, setOverlayTemplates] = useState<OverlayTemplate[]>([])

  // Illustration layouts state
  const [illustrationLayouts, setIllustrationLayouts] = useState<IllustrationLayout[]>([])
  const [illustrationModalOpen, setIllustrationModalOpen] = useState(false)
  const [illustrationNewName, setIllustrationNewName] = useState('')
  const [illustrationNewPrompt, setIllustrationNewPrompt] = useState('')
  const [illustrationAddSaving, setIllustrationAddSaving] = useState(false)
  const [editingIllustration, setEditingIllustration] = useState<string | null>(null)
  const [illustrationEditName, setIllustrationEditName] = useState('')
  const [illustrationEditPrompt, setIllustrationEditPrompt] = useState('')
  const [illustrationEditSaving, setIllustrationEditSaving] = useState(false)

  // Broker prompts state
  const [brokerPrompts, setBrokerPrompts] = useState<BrokerPrompt[]>([])
  const [editingBroker, setEditingBroker] = useState<string | null>(null)
  const [brokerEditName, setBrokerEditName] = useState('')
  const [brokerEditPrompt, setBrokerEditPrompt] = useState('')
  const [brokerEditFiles, setBrokerEditFiles] = useState<(File | null)[]>([null, null])
  const [brokerEditSaving, setBrokerEditSaving] = useState(false)
  const [brokerModalOpen, setBrokerModalOpen] = useState(false)
  const [brokerNewName, setBrokerNewName] = useState('')
  const [brokerNewPrompt, setBrokerNewPrompt] = useState('')
  const [brokerNewFiles, setBrokerNewFiles] = useState<(File | null)[]>([null, null])
  const [brokerAddSaving, setBrokerAddSaving] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const infographicFileInputRef = useRef<HTMLInputElement>(null)

  const [bannerTemplates, setBannerTemplates] = useState<Record<string, BannerSizeTemplate>>({})
  const bannerTemplatesRef = useRef<Record<string, BannerSizeTemplate>>({})
  bannerTemplatesRef.current = bannerTemplates
  const [bannerSaving, setBannerSaving] = useState<string | null>(null)
  const [bannerExpanded, setBannerExpanded] = useState<string | null>(null)
  const [bannerPreviewOpen, setBannerPreviewOpen] = useState<string | null>(null)
  const [bannerPreviewCopy, setBannerPreviewCopy] = useState<BannerCopy>({ heading: 'Your headline here', subheading: 'Supporting subheading', cta: 'Get Started' })
  const [elementUploading, setElementUploading] = useState<string | null>(null)

  const isTruckstop = brand?.name?.toLowerCase() === 'truckstop'

  useEffect(() => { loadData() }, [brandId])

  async function loadData() {
    const [{ data: b }, { data: p }] = await Promise.all([
      sb.from('brands').select('*').eq('id', brandId).single(),
      sb.from('brand_profiles').select('*').eq('brand_id', brandId).single(),
    ])
    setBrand(b)
    setProfile(p)
    setStylePrompt(p?.style_prompt || '')
    setBrandScrap(p?.brand_scrap || '')
    setInfographicMd(p?.infographic_md || '')
    setInfographicMdFileName('')
    setPptMd(p?.ppt_md || '')
    setPptMdFileName('')
    setBannerBgPrompt(p?.banner_bg_prompt || '')
    setInfographicLogoLightUrl(p?.infographic_logo_light_url || null)
    setInfographicLogoDarkUrl(p?.infographic_logo_dark_url || null)
    setInfographicFontHeading(p?.infographic_font_heading || '')
    setInfographicFontHeadingUrl(p?.infographic_font_heading_url || '')
    setInfographicFontBody(p?.infographic_font_body || '')
    setInfographicFontBodyUrl(p?.infographic_font_body_url || '')
    setPptFontHeading(p?.ppt_font_heading || '')
    setPptFontHeadingUrl(p?.ppt_font_heading_url || '')
    setPptFontBody(p?.ppt_font_body || '')
    setPptFontBodyUrl(p?.ppt_font_body_url || '')
    setPptEnabledTemplates((p as { ppt_enabled_templates?: string[] | null } | null)?.ppt_enabled_templates ?? null)
    setBlogPlanPrompt(p?.blog_plan_prompt || '')
    setBlogCanvasPrompt(p?.blog_canvas_prompt || '')
    await Promise.all([loadCategories(), loadCarouselLayouts(), loadInfographicLayouts(), loadBlogLayoutGroups(), loadPptLayouts(), loadOverlayTemplates(), loadBannerTemplates(), loadIllustrationLayouts(), loadPptTemplateOverrides()])
    if (b?.name?.toLowerCase() === 'truckstop') await loadBrokerPrompts()
  }

  async function loadPptTemplateOverrides() {
    // Use API route (service role key) — anon client is blocked by RLS on this table
    const res = await authedFetch(`/api/ppt-slide-templates?brandId=${brandId}`)
    if (!res.ok) return
    const rows = await res.json() as { template_name: string; prompt_text: string; layout_config?: string | unknown }[]
    if (!Array.isArray(rows)) return
    const promptMap: Record<string, string> = {}
    const layoutMap: Record<string, string> = {}
    for (const row of rows) {
      promptMap[row.template_name] = row.prompt_text ?? ''
      if (row.layout_config) {
        // layout_config may be a string (text column) or already-parsed object (jsonb column)
        layoutMap[row.template_name] = typeof row.layout_config === 'string'
          ? row.layout_config
          : JSON.stringify(row.layout_config, null, 2)
      }
    }
    setPptTemplateOverrides(promptMap)
    setPptLayoutOverrides(layoutMap)
    setPptPlanSystemPrompt(promptMap['_plan_system'] ?? '')
  }

  async function loadOverlayTemplates() {
    const { data } = await sb.from('overlay_templates').select('*').eq('brand_id', brandId).order('created_at')
    setOverlayTemplates(data || [])
  }

  async function loadCarouselLayouts() {
    const { data } = await sb.from('carousel_layouts').select('*').eq('brand_id', brandId).order('created_at')
    setCarouselLayouts(data || [])
  }

  async function loadInfographicLayouts() {
    const { data } = await sb.from('infographic_layouts').select('*').eq('brand_id', brandId).order('created_at')
    setInfographicLayouts(data || [])
  }

  async function loadPptLayouts() {
    const { data } = await sb.from('ppt_layouts').select('*').eq('brand_id', brandId).order('created_at')
    setPptLayouts(data || [])
  }

  async function loadBlogLayoutGroups() {
    const { data } = await sb.from('blog_layout_groups').select('*').eq('brand_id', brandId).order('created_at')
    setBlogLayoutGroups(data || [])
  }

  async function loadBlogSlots(groupId: string) {
    setBlogSlotsLoading(true)
    const { data } = await sb.from('blog_layout_slots').select('*').eq('group_id', groupId).order('slot_index')
    const slots = data || []
    setBlogSlots(slots)
    const drafts: Record<string, { name: string; description: string; layout_json: string }> = {}
    for (const s of slots) {
      drafts[s.id] = { name: s.name, description: s.description || '', layout_json: s.layout_json || '' }
    }
    setBlogSlotDrafts(drafts)
    setBlogSlotJsonErrors({})
    setBlogSlotsLoading(false)
  }

  async function loadCategories() {
    const { data: cats } = await sb.from('reference_categories').select('*').eq('brand_id', brandId).order('created_at')
    const { data: layouts } = await sb.from('reference_layouts').select('category_id')
    const map: Record<string, number> = {}
    ;(layouts || []).forEach((r: { category_id: string }) => { map[r.category_id] = (map[r.category_id] || 0) + 1 })
    setCategories(cats || [])
    setCountMap(map)
  }

  async function loadBrokerPrompts() {
    const { data } = await sb.from('broker_prompts').select('*').order('created_at')
    setBrokerPrompts(data || [])
  }

  async function loadIllustrationLayouts() {
    const { data } = await sb.from('illustration_layouts').select('*').eq('brand_id', brandId).order('created_at')
    setIllustrationLayouts(data || [])
  }

  async function handleIllustrationAdd() {
    if (!illustrationNewName.trim() || !illustrationNewPrompt.trim()) return
    setIllustrationAddSaving(true)
    const { error } = await sb.from('illustration_layouts').insert({ brand_id: brandId, name: illustrationNewName.trim(), prompt: illustrationNewPrompt.trim() })
    setIllustrationAddSaving(false)
    if (error) { showToast('Failed to add layout.', true); return }
    showToast('Layout added!')
    setIllustrationModalOpen(false)
    setIllustrationNewName('')
    setIllustrationNewPrompt('')
    await loadIllustrationLayouts()
  }

  async function handleIllustrationSaveEdit(id: string) {
    if (!illustrationEditName.trim() || !illustrationEditPrompt.trim()) return
    setIllustrationEditSaving(true)
    const { error } = await sb.from('illustration_layouts').update({ name: illustrationEditName.trim(), prompt: illustrationEditPrompt.trim() }).eq('id', id)
    setIllustrationEditSaving(false)
    if (error) { showToast('Failed to save.', true); return }
    showToast('Layout saved!')
    setEditingIllustration(null)
    await loadIllustrationLayouts()
  }

  async function handleIllustrationDelete(id: string) {
    if (!confirm('Delete this illustration layout?')) return
    const { error } = await sb.from('illustration_layouts').delete().eq('id', id)
    if (error) { showToast('Failed to delete.', true); return }
    showToast('Layout deleted.')
    await loadIllustrationLayouts()
  }

  async function loadBannerTemplates() {
    const { data } = await sb.from('banner_templates').select('*').eq('brand_id', brandId)
    const map: Record<string, BannerSizeTemplate> = {}
    for (const row of (data || [])) {
      const tmpl = migrateTemplate(row.config)
      if (row.size_key === 'smartphone' && tmpl.image?.size === 'none') tmpl.image = { size: 'full' }
      map[row.size_key] = tmpl
    }
    setBannerTemplates(map)
  }

  function updateBannerTemplate(sizeKey: string, element: string, field: string, value: unknown) {
    setBannerTemplates(prev => {
      const cur = prev[sizeKey] || DEFAULT_BANNER_TEMPLATES[sizeKey]
      const el = (cur as unknown as Record<string, Record<string, unknown>>)[element]
      return { ...prev, [sizeKey]: { ...cur, [element]: { ...el, [field]: value } } }
    })
  }

  function updateTemplateElements(sizeKey: string, elements: TemplateElement[]) {
    setBannerTemplates(prev => {
      const cur = prev[sizeKey] || DEFAULT_BANNER_TEMPLATES[sizeKey]
      return { ...prev, [sizeKey]: { ...cur, elements } }
    })
  }

  async function handleUploadElement(sizeKey: string, file: File) {
    setElementUploading(sizeKey)
    try {
      const url = await uploadBannerElement(file)
      const newEl: TemplateElement = {
        id: Date.now().toString(),
        url,
        x: 5,
        y: 5,
        scale: 20,
        layer: 'background',
      }
      setBannerTemplates(prev => {
        const cur = prev[sizeKey] || DEFAULT_BANNER_TEMPLATES[sizeKey]
        return { ...prev, [sizeKey]: { ...cur, elements: [...(cur.elements ?? []), newEl] } }
      })
    } catch {
      showToast('Failed to upload element.', true)
    } finally {
      setElementUploading(null)
    }
  }

  async function handleSaveBannerTemplate(sizeKey: string) {
    setBannerSaving(sizeKey)
    const config = bannerTemplates[sizeKey] || DEFAULT_BANNER_TEMPLATES[sizeKey]
    const { error } = await sb.from('banner_templates').upsert(
      { brand_id: brandId, size_key: sizeKey, config },
      { onConflict: 'brand_id,size_key' }
    )
    setBannerSaving(null)
    if (error) { showToast(error.message, true); return }
    setBannerTemplates(prev => ({ ...prev, [sizeKey]: config }))
    showToast('Banner template saved.')
  }

  async function handleSaveDesc() {
    setSavingDesc(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, style_prompt: stylePrompt.trim() }, { onConflict: 'brand_id' })
    setSavingDesc(false)
    if (error) { showToast(error.message, true); return }
    showToast('Brand style saved.')
  }

  async function handleSaveScrap() {
    setSavingScrap(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, brand_scrap: brandScrap.trim() }, { onConflict: 'brand_id' })
    setSavingScrap(false)
    if (error) { showToast(error.message, true); return }
    showToast('Brand scrap saved.')
  }

  async function handleSaveMd() {
    setSavingMd(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, infographic_md: infographicMd || null }, { onConflict: 'brand_id' })
    setSavingMd(false)
    if (error) { showToast(error.message, true); return }
    showToast('Infographic guidelines saved.')
  }

  async function handleClearMd() {
    if (!confirm('Clear infographic guidelines?')) return
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, infographic_md: null }, { onConflict: 'brand_id' })
    if (error) { showToast(error.message, true); return }
    setInfographicMd('')
    setInfographicMdFileName('')
    showToast('Infographic guidelines cleared.')
  }

  async function handleSavePptMd() {
    setSavingPptMd(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, ppt_md: pptMd || null }, { onConflict: 'brand_id' })
    setSavingPptMd(false)
    if (error) { showToast(error.message, true); return }
    showToast('PPT guidelines saved.')
  }

  async function handleClearPptMd() {
    if (!confirm('Clear PPT guidelines?')) return
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, ppt_md: null }, { onConflict: 'brand_id' })
    if (error) { showToast(error.message, true); return }
    setPptMd('')
    setPptMdFileName('')
    showToast('PPT guidelines cleared.')
  }

  async function handleSaveBannerBgPrompt() {
    setSavingBannerBgPrompt(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, banner_bg_prompt: bannerBgPrompt.trim() || null }, { onConflict: 'brand_id' })
    setSavingBannerBgPrompt(false)
    if (error) { showToast(error.message, true); return }
    showToast('Multi-size Ads prompt saved.')
  }

  async function handleSaveBlogPlanPrompt(value: string | null) {
    setSavingBlogPlanPrompt(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, blog_plan_prompt: value }, { onConflict: 'brand_id' })
    setSavingBlogPlanPrompt(false)
    if (error) { showToast(error.message, true); return }
    setBlogPlanPrompt(value || '')
    showToast(value ? 'Plan prompt saved.' : 'Plan prompt reset to default.')
  }

  async function handleSaveBlogCanvasPrompt(value: string | null) {
    setSavingBlogCanvasPrompt(true)
    const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, blog_canvas_prompt: value }, { onConflict: 'brand_id' })
    setSavingBlogCanvasPrompt(false)
    if (error) { showToast(error.message, true); return }
    setBlogCanvasPrompt(value || '')
    showToast(value ? 'Canvas prompt saved.' : 'Canvas prompt reset to default.')
  }

  // ── PPT layout handlers ───────────────────────────────────────────────────

  function openPptLayoutModal(layout?: PptLayout) {
    setEditingPptLayout(layout || null)
    setPptLayoutNewName(layout?.name || '')
    setPptLayoutNewDescription(layout?.description || '')
    setPptLayoutNewImageUrl('')
    setPptLayoutImageFile(null)
    setPptLayoutImagePreview(layout?.image_url || null)
    setPptLayoutModalOpen(true)
  }

  async function handlePptLayoutSave() {
    if (!pptLayoutNewName.trim()) { showToast('Please enter a layout name.', true); return }
    setPptLayoutAddSaving(true)

    let imageUrl: string | null = pptLayoutImageFile
      ? null
      : (pptLayoutImagePreview || pptLayoutNewImageUrl.trim() || null)
    if (pptLayoutImageFile) {
      try {
        const __up = await uploadMedia(pptLayoutImageFile, { folder: 'generated-posts', fileName: pptLayoutImageFile.name })
        imageUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setPptLayoutAddSaving(false); return
      }
    }

    const payload = {
      name: pptLayoutNewName.trim(),
      description: pptLayoutNewDescription.trim() || null,
      image_url: imageUrl,
    }

    let error
    if (editingPptLayout) {
      ({ error } = await sb.from('ppt_layouts').update(payload).eq('id', editingPptLayout.id))
    } else {
      ({ error } = await sb.from('ppt_layouts').insert({ ...payload, brand_id: brandId, is_active: true }))
    }

    setPptLayoutAddSaving(false)
    if (error) { showToast(error.message, true); return }
    setPptLayoutModalOpen(false)
    setEditingPptLayout(null)
    showToast(editingPptLayout ? 'Layout updated.' : 'PPT layout created.')
    loadPptLayouts()
  }

  async function handlePptLayoutToggle(layout: PptLayout) {
    const { error } = await sb.from('ppt_layouts').update({ is_active: !layout.is_active }).eq('id', layout.id)
    if (error) { showToast(error.message, true); return }
    setPptLayouts(prev => prev.map(l => l.id === layout.id ? { ...l, is_active: !l.is_active } : l))
  }

  async function handlePptLayoutDelete(layout: PptLayout) {
    if (!confirm(`Delete layout "${layout.name}"?`)) return
    await sb.from('ppt_layouts').delete().eq('id', layout.id)
    showToast('Layout deleted.')
    loadPptLayouts()
  }

  async function handleUploadLogo() {
    const input = logoInputRef.current
    if (!input) return
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const __up = await uploadMedia(file, { folder: 'brand-logos', fileName: file.name })
        const { error } = await sb.from('brand_profiles').upsert({ brand_id: brandId, logo_url: __up.url, logo_storage_path: __up.filePath }, { onConflict: 'brand_id' })
        if (error) { showToast(error.message, true); return }
        showToast('Logo uploaded!')
        loadData()
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true)
      }
    }
    input.click()
  }

  async function handleDeleteLogo() {
    if (!confirm('Delete logo?')) return
    if (profile?.logo_storage_path) await deleteMediaClient({ filePath: profile.logo_storage_path }).catch(() => {})
    await sb.from('brand_profiles').update({ logo_url: null, logo_storage_path: null }).eq('brand_id', brandId)
    showToast('Logo deleted.')
    loadData()
  }

  async function handleCreateCategory() {
    if (!catName.trim()) { showToast('Please enter a category name.', true); return }
    setCatSaving(true)
    const { error } = await sb.from('reference_categories').insert({ label: catName.trim(), brand_id: brandId })
    setCatSaving(false)
    if (error) { showToast(error.message, true); return }
    setCatModalOpen(false); setCatName('')
    showToast('Category created.')
    loadCategories()
  }

  async function handleRenameCategory(catId: string, newLabel: string) {
    if (!newLabel.trim()) { showToast('Name cannot be empty.', true); return }
    setRenameSaving(true)
    const { error } = await sb.from('reference_categories').update({ label: newLabel.trim() }).eq('id', catId)
    setRenameSaving(false)
    if (error) { showToast(error.message, true); return }
    setEditingCat(null)
    showToast('Category renamed.')
    loadCategories()
  }

  async function handleDeleteCategory(cat: Category) {
    if (!confirm(`Delete category "${cat.label}" and all its prompts?`)) return
    await sb.from('reference_layouts').delete().eq('category_id', cat.id)
    await sb.from('reference_categories').delete().eq('id', cat.id)
    showToast('Category deleted.')
    loadCategories()
  }

  // ── Carousel layout handlers ──────────────────────────────────────────────

  async function handleCarouselAdd() {
    if (!carouselNewName.trim()) { showToast('Please enter a layout name.', true); return }
    setCarouselAddSaving(true)
    const { error } = await sb.from('carousel_layouts').insert({ brand_id: brandId, name: carouselNewName.trim() })
    setCarouselAddSaving(false)
    if (error) { showToast(error.message, true); return }
    setCarouselModalOpen(false); setCarouselNewName('')
    showToast('Carousel layout created.')
    loadCarouselLayouts()
  }

  async function handleCarouselRename(id: string, newName: string) {
    if (!newName.trim()) { showToast('Name cannot be empty.', true); return }
    setCarouselRenameSaving(true)
    const { error } = await sb.from('carousel_layouts').update({ name: newName.trim() }).eq('id', id)
    setCarouselRenameSaving(false)
    if (error) { showToast(error.message, true); return }
    setEditingCarousel(null)
    showToast('Layout renamed.')
    loadCarouselLayouts()
  }

  async function handleCarouselDelete(layout: CarouselLayout) {
    if (!confirm(`Delete layout "${layout.name}" and all its slide prompts?`)) return
    await sb.from('carousel_slide_prompts').delete().eq('layout_id', layout.id)
    await sb.from('carousel_layouts').delete().eq('id', layout.id)
    showToast('Layout deleted.')
    loadCarouselLayouts()
  }

  async function handleSaveInfographicLogos() {
    setSavingInfographicLogos(true)
    let lightUrl = infographicLogoLightUrl
    let darkUrl = infographicLogoDarkUrl

    if (infographicLogoLightFile) {
      try {
        const __up = await uploadMedia(infographicLogoLightFile, { folder: 'generated-posts', fileName: infographicLogoLightFile.name })
        lightUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setSavingInfographicLogos(false); return
      }
    }

    if (infographicLogoDarkFile) {
      try {
        const __up = await uploadMedia(infographicLogoDarkFile, { folder: 'generated-posts', fileName: infographicLogoDarkFile.name })
        darkUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setSavingInfographicLogos(false); return
      }
    }

    const { error } = await sb.from('brand_profiles').upsert(
      { brand_id: brandId, infographic_logo_light_url: lightUrl, infographic_logo_dark_url: darkUrl },
      { onConflict: 'brand_id' }
    )
    setSavingInfographicLogos(false)
    if (error) { showToast(error.message, true); return }
    setInfographicLogoLightUrl(lightUrl)
    setInfographicLogoDarkUrl(darkUrl)
    setInfographicLogoLightFile(null)
    setInfographicLogoDarkFile(null)
    showToast('Infographic logos saved.')
  }

  async function handleSaveInfographicFonts() {
    setSavingInfographicFonts(true)
    let headingUrl = infographicFontHeadingUrl
    let bodyUrl = infographicFontBodyUrl

    if (infographicFontHeadingFile) {
      try {
        const __up = await uploadMedia(infographicFontHeadingFile, { folder: 'generated-posts', fileName: infographicFontHeadingFile.name })
        headingUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setSavingInfographicFonts(false); return
      }
    }

    if (infographicFontBodyFile) {
      try {
        const __up = await uploadMedia(infographicFontBodyFile, { folder: 'generated-posts', fileName: infographicFontBodyFile.name })
        bodyUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setSavingInfographicFonts(false); return
      }
    }

    const { error } = await sb.from('brand_profiles').upsert(
      {
        brand_id: brandId,
        infographic_font_heading: infographicFontHeading.trim() || null,
        infographic_font_heading_url: headingUrl.trim() || null,
        infographic_font_body: infographicFontBody.trim() || null,
        infographic_font_body_url: bodyUrl.trim() || null,
      },
      { onConflict: 'brand_id' }
    )
    setSavingInfographicFonts(false)
    if (error) { showToast(error.message, true); return }
    setInfographicFontHeadingUrl(headingUrl)
    setInfographicFontBodyUrl(bodyUrl)
    setInfographicFontHeadingFile(null)
    setInfographicFontBodyFile(null)
    showToast('Infographic fonts saved.')
  }

  async function handleSavePptFonts() {
    setSavingPptFonts(true)
    let headingUrl = pptFontHeadingUrl
    let bodyUrl = pptFontBodyUrl

    if (pptFontHeadingFile) {
      try {
        const __up = await uploadMedia(pptFontHeadingFile, { folder: 'generated-posts', fileName: pptFontHeadingFile.name })
        headingUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setSavingPptFonts(false); return
      }
    }

    if (pptFontBodyFile) {
      try {
        const __up = await uploadMedia(pptFontBodyFile, { folder: 'generated-posts', fileName: pptFontBodyFile.name })
        bodyUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setSavingPptFonts(false); return
      }
    }

    const { error } = await sb.from('brand_profiles').upsert(
      {
        brand_id: brandId,
        ppt_font_heading: pptFontHeading.trim() || null,
        ppt_font_heading_url: headingUrl.trim() || null,
        ppt_font_body: pptFontBody.trim() || null,
        ppt_font_body_url: bodyUrl.trim() || null,
      },
      { onConflict: 'brand_id' }
    )
    setSavingPptFonts(false)
    if (error) { showToast(error.message, true); return }
    setPptFontHeadingUrl(headingUrl)
    setPptFontBodyUrl(bodyUrl)
    setPptFontHeadingFile(null)
    setPptFontBodyFile(null)
    showToast('PPT fonts saved.')
  }

  async function handleSavePptTemplates(enabled: string[] | null) {
    setSavingPptTemplates(true)
    const { error } = await sb.from('brand_profiles').upsert(
      { brand_id: brandId, ppt_enabled_templates: enabled },
      { onConflict: 'brand_id' }
    )
    setSavingPptTemplates(false)
    if (error) { showToast(error.message, true); return }
    setPptEnabledTemplates(enabled)
    showToast('PPT template selection saved.')
  }

  async function handleSavePptTemplatePrompt() {
    if (!editingPptTemplate) return
    setSavingPptEdit(true)
    const res = await authedFetch('/api/ppt-slide-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, templateName: editingPptTemplate, promptText: editPptPrompt.trim() }),
    })
    const json = await res.json() as { error?: string }
    setSavingPptEdit(false)
    if (json.error) { showToast(json.error, true); return }
    setPptTemplateOverrides(prev => ({ ...prev, [editingPptTemplate]: editPptPrompt.trim() }))
    const remaining = getLayoutPromptMismatches(editPptLayout, editPptPrompt.trim())
    setPromptMismatches(remaining)
    showToast(remaining.length ? 'Prompt saved — some layout fields still not covered.' : 'Template prompt saved.')
  }

  async function handleSavePptTemplateLayout() {
    if (!editingPptTemplate) return
    setLayoutJsonError(null)
    let parsed: unknown
    try { parsed = JSON.parse(editPptLayout) } catch (e) {
      setLayoutJsonError(`Invalid JSON: ${(e as Error).message}`)
      return
    }
    if (
      !parsed
      || typeof parsed !== 'object'
      || typeof (parsed as { background?: unknown }).background !== 'string'
      || !Array.isArray((parsed as { elements?: unknown }).elements)
    ) {
      setLayoutJsonError('Layout must be a JSON object with a "background" string and "elements" array.')
      return
    }
    setSavingPptEdit(true)
    const res = await authedFetch('/api/ppt-slide-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, templateName: editingPptTemplate, layoutConfig: editPptLayout.trim() }),
    })
    const json = await res.json() as { error?: string }
    setSavingPptEdit(false)
    if (json.error) { showToast(json.error, true); return }
    setPptLayoutOverrides(prev => ({ ...prev, [editingPptTemplate]: editPptLayout.trim() }))
    const mismatches = getLayoutPromptMismatches(editPptLayout, editPptPrompt)
    if (mismatches.length > 0) {
      setPromptMismatches(mismatches)
      setPptModalTab('prompt')
      showToast('Layout saved — some fields are missing from your AI prompt.')
    } else {
      setPromptMismatches([])
      setEditingPptTemplate(null)
      showToast('Layout JSON saved.')
    }
  }

  async function handleResetPptTemplateLayout() {
    if (!editingPptTemplate) return
    setSavingPptEdit(true)
    const res = await authedFetch('/api/ppt-slide-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, templateName: editingPptTemplate, layoutConfig: null }),
    })
    const json = await res.json() as { error?: string }
    setSavingPptEdit(false)
    if (json.error) { showToast(json.error, true); return }
    setPptLayoutOverrides(prev => { const n = { ...prev }; delete n[editingPptTemplate]; return n })
    setEditingPptTemplate(null)
    showToast('Reset to default layout.')
  }

  async function handleSavePptPlanPrompt(value: string | null) {
    setSavingPptPlanPrompt(true)
    const res = await authedFetch('/api/ppt-slide-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, templateName: '_plan_system', promptText: value }),
    })
    const json = await res.json() as { error?: string }
    setSavingPptPlanPrompt(false)
    if (json.error) { showToast(json.error, true); return }
    showToast(value ? 'Plan prompt saved.' : 'Plan prompt reset to default.')
  }

  async function handleResetPptTemplatePrompt() {
    if (!editingPptTemplate) return
    setSavingPptEdit(true)
    const res = await authedFetch(
      `/api/ppt-slide-templates?brandId=${brandId}&templateName=${encodeURIComponent(editingPptTemplate)}`,
      { method: 'DELETE' }
    )
    const json = await res.json() as { error?: string }
    setSavingPptEdit(false)
    if (json.error) { showToast(json.error, true); return }
    setPptTemplateOverrides(prev => { const n = { ...prev }; delete n[editingPptTemplate]; return n })
    setPptLayoutOverrides(prev => { const n = { ...prev }; delete n[editingPptTemplate]; return n })
    setEditingPptTemplate(null)
    showToast('Reset to default prompt.')
  }

  // ── Infographic layout handlers ───────────────────────────────────────────

  function openInfographicModal(layout?: InfographicLayout) {
    setEditingInfographicLayout(layout || null)
    setInfographicNewName(layout?.name || '')
    setInfographicNewDescription(layout?.description || '')
    setInfographicNewImageUrl('')
    setInfographicImageFile(null)
    setInfographicImagePreview(layout?.image_url || null)
    setInfographicModalOpen(true)
  }

  async function handleInfographicSave() {
    if (!infographicNewName.trim()) { showToast('Please enter a layout name.', true); return }
    setInfographicAddSaving(true)

    // Upload new reference image if a file was chosen, otherwise keep existing URL or preview
    let imageUrl: string | null = infographicImageFile
      ? null
      : (infographicImagePreview || infographicNewImageUrl.trim() || null)
    if (infographicImageFile) {
      try {
        const __up = await uploadMedia(infographicImageFile, { folder: 'generated-posts', fileName: infographicImageFile.name })
        imageUrl = __up.url
      } catch (err: unknown) {
        showToast((err as Error).message || 'Upload failed', true); setInfographicAddSaving(false); return
      }
    }

    const payload = {
      name: infographicNewName.trim(),
      description: infographicNewDescription.trim() || null,
      image_url: imageUrl,
    }

    let error
    if (editingInfographicLayout) {
      ({ error } = await sb.from('infographic_layouts').update(payload).eq('id', editingInfographicLayout.id))
    } else {
      ({ error } = await sb.from('infographic_layouts').insert({ ...payload, brand_id: brandId, is_active: true }))
    }

    setInfographicAddSaving(false)
    if (error) { showToast(error.message, true); return }
    setInfographicModalOpen(false)
    setEditingInfographicLayout(null)
    showToast(editingInfographicLayout ? 'Layout updated.' : 'Infographic layout created.')
    loadInfographicLayouts()
  }

  async function handleInfographicToggle(layout: InfographicLayout) {
    const { error } = await sb.from('infographic_layouts').update({ is_active: !layout.is_active }).eq('id', layout.id)
    if (error) { showToast(error.message, true); return }
    setInfographicLayouts(prev => prev.map(l => l.id === layout.id ? { ...l, is_active: !l.is_active } : l))
  }

  async function handleInfographicDelete(layout: InfographicLayout) {
    if (!confirm(`Delete layout "${layout.name}"?`)) return
    await sb.from('infographic_layouts').delete().eq('id', layout.id)
    showToast('Layout deleted.')
    loadInfographicLayouts()
  }

  // ── Blog JSON Layout Group handlers ───────────────────────────────────────

  function openBlogGroupModal(group?: BlogLayoutGroup) {
    setEditingBlogGroup(group || null)
    setBlogGroupNewName(group?.name || '')
    setBlogGroupNewDescription(group?.description || '')
    setBlogGroupModalOpen(true)
  }

  async function handleBlogGroupSave() {
    if (!blogGroupNewName.trim()) { showToast('Please enter a layout group name.', true); return }
    setBlogGroupAddSaving(true)

    const payload = {
      name: blogGroupNewName.trim(),
      description: blogGroupNewDescription.trim() || null,
    }

    let error
    if (editingBlogGroup) {
      ({ error } = await sb.from('blog_layout_groups').update(payload).eq('id', editingBlogGroup.id))
    } else {
      ({ error } = await sb.from('blog_layout_groups').insert({ ...payload, brand_id: brandId, is_active: true }))
    }

    setBlogGroupAddSaving(false)
    if (error) { showToast(error.message, true); return }
    setBlogGroupModalOpen(false)
    setEditingBlogGroup(null)
    showToast(editingBlogGroup ? 'Layout group updated.' : 'Layout group created.')
    loadBlogLayoutGroups()
  }

  async function handleBlogGroupToggle(group: BlogLayoutGroup) {
    const { error } = await sb.from('blog_layout_groups').update({ is_active: !group.is_active }).eq('id', group.id)
    if (error) { showToast(error.message, true); return }
    setBlogLayoutGroups(prev => prev.map(g => g.id === group.id ? { ...g, is_active: !g.is_active } : g))
  }

  async function handleBlogGroupDelete(group: BlogLayoutGroup) {
    if (!confirm(`Delete layout group "${group.name}"? This also deletes all its slots.`)) return
    await sb.from('blog_layout_groups').delete().eq('id', group.id)
    showToast('Layout group deleted.')
    loadBlogLayoutGroups()
  }

  // ── Blog JSON Layout Slot handlers ────────────────────────────────────────

  async function openManageSlots(group: BlogLayoutGroup) {
    setManagingSlotsGroup(group)
    await loadBlogSlots(group.id)
  }

  async function handleAddBlogSlot() {
    if (!managingSlotsGroup) return
    const nextIndex = blogSlots.length ? Math.max(...blogSlots.map(s => s.slot_index)) + 1 : 1
    const { data, error } = await sb.from('blog_layout_slots').insert({
      group_id: managingSlotsGroup.id,
      slot_index: nextIndex,
      name: `Slide ${nextIndex}`,
      description: '',
      layout_json: '',
    }).select().single()
    if (error) { showToast(error.message, true); return }
    setBlogSlots(prev => [...prev, data])
    setBlogSlotDrafts(prev => ({ ...prev, [data.id]: { name: data.name, description: '', layout_json: '' } }))
  }

  async function handleAddDefaultSixSlots() {
    if (!managingSlotsGroup) return
    const rows = Array.from({ length: 6 }, (_, i) => ({
      group_id: managingSlotsGroup.id,
      slot_index: i + 1,
      name: `Slide ${i + 1}`,
      description: '',
      layout_json: '',
    }))
    const { error } = await sb.from('blog_layout_slots').insert(rows)
    if (error) { showToast(error.message, true); return }
    await loadBlogSlots(managingSlotsGroup.id)
    showToast('Added 6 slots.')
  }

  function updateBlogSlotDraft(slotId: string, field: 'name' | 'description' | 'layout_json', value: string) {
    setBlogSlotDrafts(prev => ({ ...prev, [slotId]: { ...prev[slotId], [field]: value } }))
    if (field === 'layout_json') {
      setBlogSlotJsonErrors(prev => { const n = { ...prev }; delete n[slotId]; return n })
    }
  }

  async function handleSaveBlogSlot(slot: BlogLayoutSlot) {
    const draft = blogSlotDrafts[slot.id]
    if (!draft) return
    if (draft.layout_json.trim()) {
      try { JSON.parse(draft.layout_json) }
      catch (e) {
        setBlogSlotJsonErrors(prev => ({ ...prev, [slot.id]: `Invalid JSON: ${(e as Error).message}` }))
        return
      }
    }
    setBlogSlotSaving(prev => ({ ...prev, [slot.id]: true }))
    const { error } = await sb.from('blog_layout_slots').update({
      name: draft.name.trim() || slot.name,
      description: draft.description.trim() || null,
      layout_json: draft.layout_json.trim() || null,
    }).eq('id', slot.id)
    setBlogSlotSaving(prev => ({ ...prev, [slot.id]: false }))
    if (error) { showToast(error.message, true); return }
    setBlogSlots(prev => prev.map(s => s.id === slot.id ? { ...s, name: draft.name.trim() || s.name, description: draft.description.trim() || null, layout_json: draft.layout_json.trim() || null } : s))
    showToast('Slot saved.')
  }

  async function handleDeleteBlogSlot(slot: BlogLayoutSlot) {
    if (!confirm(`Delete "${slot.name}"?`)) return
    await sb.from('blog_layout_slots').delete().eq('id', slot.id)
    setBlogSlots(prev => prev.filter(s => s.id !== slot.id))
    setBlogSlotDrafts(prev => { const n = { ...prev }; delete n[slot.id]; return n })
    showToast('Slot deleted.')
  }

  // ── Overlay template handlers ─────────────────────────────────────────────

  async function handleOverlayDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return
    await sb.from('overlay_templates').delete().eq('id', id)
    showToast('Template deleted.')
    loadOverlayTemplates()
  }

  // ── Broker prompt handlers ────────────────────────────────────────────────

  async function handleBrokerAdd() {
    if (!brokerNewName.trim() || !brokerNewPrompt.trim()) { showToast('Name and prompt required.', true); return }
    setBrokerAddSaving(true)
    try {
      const { data: inserted, error } = await sb.from('broker_prompts').insert({ name: brokerNewName.trim(), prompt: brokerNewPrompt.trim() }).select().single()
      if (error) throw error
      const refUrls: string[] = []
      for (let i = 0; i < 2; i++) {
        const file = brokerNewFiles[i]
        if (file) {
          try {
            const __up = await uploadMedia(file, {
              folder: 'broker-reference-images',
              fileName: `${inserted.id}-ref${i + 1}.${file.name.split('.').pop() || 'bin'}`,
            })
            refUrls.push(__up.url)
          } catch { /* skip failed ref upload */ }
        }
      }
      if (refUrls.length) await sb.from('broker_prompts').update({ reference_image_urls: refUrls }).eq('id', inserted.id)
      showToast('Broker prompt saved!')
      setBrokerModalOpen(false); setBrokerNewName(''); setBrokerNewPrompt(''); setBrokerNewFiles([null, null])
      loadBrokerPrompts()
    } catch (err: unknown) {
      showToast((err as Error).message || 'Save failed', true)
    } finally {
      setBrokerAddSaving(false)
    }
  }

  async function handleBrokerSaveEdit(id: string) {
    if (!brokerEditName.trim() || !brokerEditPrompt.trim()) { showToast('Name and prompt required.', true); return }
    setBrokerEditSaving(true)
    const { error } = await sb.from('broker_prompts').update({ name: brokerEditName.trim(), prompt: brokerEditPrompt.trim() }).eq('id', id)
    if (error) { showToast(error.message, true); setBrokerEditSaving(false); return }
    const refUrls: string[] = []
    let hasNew = false
    for (let i = 0; i < 2; i++) {
      const file = brokerEditFiles[i]
      if (file) {
        hasNew = true
        try {
          const __up = await uploadMedia(file, {
            folder: 'broker-reference-images',
            fileName: `${id}-ref${i + 1}.${file.name.split('.').pop() || 'bin'}`,
          })
          refUrls[i] = __up.url
        } catch { /* skip failed ref upload */ }
      }
    }
    if (hasNew && refUrls.length) await sb.from('broker_prompts').update({ reference_image_urls: refUrls }).eq('id', id)
    setBrokerEditSaving(false)
    showToast('Prompt updated.')
    setEditingBroker(null)
    loadBrokerPrompts()
  }

  async function handleBrokerDelete(id: string) {
    if (!confirm('Delete this broker prompt?')) return
    await sb.from('broker_prompts').delete().eq('id', id)
    showToast('Prompt deleted.')
    loadBrokerPrompts()
  }

  if (!brand) return null

  return (
    <>
      <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} />

      <button className="back-btn" onClick={() => router.push('/brands')}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to Brands
      </button>

      <div className="detail-header">
        <div className="detail-logo">
          {profile?.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profile.logo_url} alt="logo" loading="lazy" />
            : <span className="initials" style={{ fontSize: '24px' }}>{brand.name[0]}</span>
          }
        </div>
        <div className="detail-title">
          <h1>{brand.name}</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>{profile?.logo_url ? 'Logo uploaded' : 'No logo'}</p>
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleUploadLogo}>Upload Logo</button>
          <button className="btn btn-primary btn-sm" onClick={() => router.push(`/generate?brand=${brandId}`)}>Generate Image</button>
        </div>
      </div>

      {/* Brand Description */}
      <div style={{ marginBottom: '24px' }}>
        <p className="section-title" style={{ marginTop: 0 }}>Brand Description</p>
        <textarea rows={14} style={{ marginBottom: '8px', resize: 'vertical', minHeight: '220px' }}
          placeholder="Describe what this brand does, who they serve, their tone and values..."
          value={stylePrompt} onChange={e => setStylePrompt(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={handleSaveDesc} disabled={savingDesc}>
          {savingDesc ? 'Saving…' : 'Save Description'}
        </button>
      </div>

      {/* Brand Scrap */}
      <div style={{ marginBottom: '24px' }}>
        <p className="section-title" style={{ marginTop: 0 }}>Brand Scrap</p>
        <textarea rows={14} style={{ marginBottom: '8px', resize: 'vertical', minHeight: '220px' }}
          placeholder="Paste scraped brand context here — what they do, target audience, competitors, colors, CTA..."
          value={brandScrap} onChange={e => setBrandScrap(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={handleSaveScrap} disabled={savingScrap}>
          {savingScrap ? 'Saving…' : 'Save Scrap'}
        </button>
      </div>

      {/* Infographic Guidelines */}
      <div style={{ marginBottom: '24px' }}>
        <p className="section-title" style={{ marginTop: 0 }}>Infographic Guidelines</p>
        <p className="subtitle" style={{ marginBottom: '12px' }}>Upload a .md or .txt file with brand guidelines. Used directly by the infographic generator.</p>

        <input
          ref={mdInputRef}
          type="file"
          accept=".md,.txt"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            setInfographicMdFileName(file.name)
            file.text().then(text => setInfographicMd(text))
            e.target.value = ''
          }}
        />

        {infographicMd ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                {infographicMdFileName || 'Guidelines loaded'}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => mdInputRef.current?.click()}>Replace file</button>
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error, #e74c3c)' }} onClick={handleClearMd}>Clear</button>
            </div>
            <textarea
              rows={10}
              style={{ marginBottom: '8px', resize: 'vertical', minHeight: '180px', fontFamily: 'monospace', fontSize: '12px' }}
              value={infographicMd}
              onChange={e => setInfographicMd(e.target.value)}
            />
          </>
        ) : (
          <>
            <textarea
              rows={8}
              placeholder="Paste infographic design guidelines here — brand colors, font rules, layout preferences, do's and don'ts…"
              style={{ marginBottom: '8px', resize: 'vertical', minHeight: '140px', fontFamily: 'monospace', fontSize: '12px' }}
              onChange={e => setInfographicMd(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>or</span>
              <button className="btn btn-secondary btn-sm" onClick={() => mdInputRef.current?.click()}>Upload .md / .txt file</button>
            </div>
          </>
        )}

        <button className="btn btn-secondary btn-sm" onClick={handleSaveMd} disabled={savingMd || !infographicMd}>
          {savingMd ? 'Saving…' : 'Save Guidelines'}
        </button>

        {/* Infographic Logos */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Infographic Logos</p>
          <p className="subtitle" style={{ marginBottom: 12 }}>Upload separate logos for light and dark theme infographics.</p>
          <input ref={infographicLogoLightInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setInfographicLogoLightFile(f); e.target.value = '' } }} />
          <input ref={infographicLogoDarkInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setInfographicLogoDarkFile(f); e.target.value = '' } }} />
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Light logo */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>Light Theme</p>
              <div
                onClick={() => infographicLogoLightInputRef.current?.click()}
                style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '12px', textAlign: 'center', cursor: 'pointer', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}
              >
                {infographicLogoLightFile
                  ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>{infographicLogoLightFile.name}</span>
                  : infographicLogoLightUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={infographicLogoLightUrl} alt="light logo" loading="lazy" style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 12, color: 'var(--muted)' }}>Click to upload</span>
                }
              </div>
            </div>
            {/* Dark logo */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>Dark Theme</p>
              <div
                onClick={() => infographicLogoDarkInputRef.current?.click()}
                style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '12px', textAlign: 'center', cursor: 'pointer', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}
              >
                {infographicLogoDarkFile
                  ? <span style={{ fontSize: 12, color: '#aaa' }}>{infographicLogoDarkFile.name}</span>
                  : infographicLogoDarkUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={infographicLogoDarkUrl} alt="dark logo" loading="lazy" style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 12, color: '#aaa' }}>Click to upload</span>
                }
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 10 }}
            onClick={handleSaveInfographicLogos}
            disabled={savingInfographicLogos || (!infographicLogoLightFile && !infographicLogoDarkFile)}
          >
            {savingInfographicLogos ? 'Saving…' : 'Save Logos'}
          </button>
        </div>
      </div>

      {/* ── Infographic Fonts ── */}
      <div style={{ marginTop: 24, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
        <input ref={infographicFontHeadingInputRef} type="file" accept=".woff,.woff2,.ttf,.otf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setInfographicFontHeadingFile(f); if (!infographicFontHeading) setInfographicFontHeading(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())); e.target.value = '' } }} />
        <input ref={infographicFontBodyInputRef} type="file" accept=".woff,.woff2,.ttf,.otf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setInfographicFontBodyFile(f); if (!infographicFontBody) setInfographicFontBody(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())); e.target.value = '' } }} />
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Infographic Fonts</p>
        <p className="subtitle" style={{ marginBottom: 14 }}>Pick from popular fonts or use a custom one (paste a Google Fonts / .woff2 URL, or upload a file).</p>
        <div style={{ display: 'flex', gap: 16 }}>
          {([
            { label: 'Heading Font', sublabel: '(headlines, big numbers)', nameVal: infographicFontHeading, setName: setInfographicFontHeading, urlVal: infographicFontHeadingUrl, setUrl: setInfographicFontHeadingUrl, fileVal: infographicFontHeadingFile, setFile: setInfographicFontHeadingFile, inputRef: infographicFontHeadingInputRef },
            { label: 'Body Font', sublabel: '(subheadlines, labels, small text)', nameVal: infographicFontBody, setName: setInfographicFontBody, urlVal: infographicFontBodyUrl, setUrl: setInfographicFontBodyUrl, fileVal: infographicFontBodyFile, setFile: setInfographicFontBodyFile, inputRef: infographicFontBodyInputRef },
          ] as const).map(slot => (
            <div key={slot.label} style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: '0 0 8px' }}>{slot.label} <span style={{ fontWeight: 400 }}>{slot.sublabel}</span></p>
              {/* Preset picker */}
              <select
                value={PRESET_FONTS.some(p => p.value === slot.nameVal) ? slot.nameVal : '__custom__'}
                onChange={e => {
                  const v = e.target.value
                  if (v && v !== '__custom__') {
                    const url = `https://fonts.googleapis.com/css2?family=${v.replace(/ /g, '+')}:wght@400;500;600;700;900&display=swap`
                    slot.setName(v); slot.setUrl(url); slot.setFile(null)
                  } else {
                    slot.setName(''); slot.setUrl('')
                  }
                }}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 6, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="__custom__">— Custom font —</option>
                {PRESET_FONTS.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {/* Custom name + URL only shown when not a preset */}
              {!PRESET_FONTS.filter(p => p.value).some(p => p.value === slot.nameVal) && (
                <>
                  <input
                    type="text"
                    placeholder="Font family name, e.g. MyBrandFont"
                    value={slot.nameVal}
                    onChange={e => slot.setName(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 6, background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Paste URL (Google Fonts or .woff2)"
                      value={slot.fileVal ? slot.fileVal.name : slot.urlVal}
                      onChange={e => { slot.setUrl(e.target.value); slot.setFile(null) }}
                      readOnly={!!slot.fileVal}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--text)' }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => slot.inputRef.current?.click()} style={{ whiteSpace: 'nowrap' }}>Upload</button>
                  </div>
                </>
              )}
              {/* Show active font name when preset selected */}
              {PRESET_FONTS.filter(p => p.value).some(p => p.value === slot.nameVal) && (
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>Using Google Fonts · <span style={{ color: 'var(--text)' }}>{slot.nameVal}</span></p>
              )}
            </div>
          ))}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 12 }}
          onClick={handleSaveInfographicFonts}
          disabled={savingInfographicFonts}
        >
          {savingInfographicFonts ? 'Saving…' : 'Save Fonts'}
        </button>
      </div>

      {/* ── PPT Guidelines ── */}
      <div style={{ marginBottom: '24px', marginTop: '32px' }}>
        <p className="section-title" style={{ marginTop: 0 }}>PPT Guidelines</p>
        <p className="subtitle" style={{ marginBottom: '12px' }}>Upload a .md or .txt file with brand PPT design rules. Used by the PDF-to-PPT generator.</p>

        <input
          ref={pptMdInputRef}
          type="file"
          accept=".md,.txt"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            setPptMdFileName(file.name)
            file.text().then(text => setPptMd(text))
            e.target.value = ''
          }}
        />

        {pptMd ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                {pptMdFileName || 'Guidelines loaded'}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => pptMdInputRef.current?.click()}>Replace file</button>
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error, #e74c3c)' }} onClick={handleClearPptMd}>Clear</button>
            </div>
            <textarea
              rows={10}
              style={{ marginBottom: '8px', resize: 'vertical', minHeight: '180px', fontFamily: 'monospace', fontSize: '12px' }}
              value={pptMd}
              onChange={e => setPptMd(e.target.value)}
            />
          </>
        ) : (
          <>
            <textarea
              rows={8}
              placeholder="Paste PPT design guidelines here — brand colors, font rules, slide style preferences, layout hints…"
              style={{ marginBottom: '8px', resize: 'vertical', minHeight: '140px', fontFamily: 'monospace', fontSize: '12px' }}
              onChange={e => setPptMd(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>or</span>
              <button className="btn btn-secondary btn-sm" onClick={() => pptMdInputRef.current?.click()}>Upload .md / .txt file</button>
            </div>
          </>
        )}

        <button className="btn btn-secondary btn-sm" onClick={handleSavePptMd} disabled={savingPptMd || !pptMd}>
          {savingPptMd ? 'Saving…' : 'Save PPT Guidelines'}
        </button>
      </div>

      {/* ── PPT Fonts ── */}
      <div style={{ marginTop: 24, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
        <input ref={pptFontHeadingInputRef} type="file" accept=".woff,.woff2,.ttf,.otf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setPptFontHeadingFile(f); if (!pptFontHeading) setPptFontHeading(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())); e.target.value = '' } }} />
        <input ref={pptFontBodyInputRef} type="file" accept=".woff,.woff2,.ttf,.otf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setPptFontBodyFile(f); if (!pptFontBody) setPptFontBody(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())); e.target.value = '' } }} />
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>PPT Fonts</p>
        <p className="subtitle" style={{ marginBottom: 14 }}>Choose from popular fonts or upload a custom font file (.woff2 / .ttf). Used for slide previews and PPTX export.</p>
        <div style={{ display: 'flex', gap: 16 }}>
          {([
            { label: 'Heading Font', sublabel: '(slide titles, big numbers)', nameVal: pptFontHeading, setName: setPptFontHeading, urlVal: pptFontHeadingUrl, setUrl: setPptFontHeadingUrl, fileVal: pptFontHeadingFile, setFile: setPptFontHeadingFile, inputRef: pptFontHeadingInputRef },
            { label: 'Body Font', sublabel: '(bullets, labels, body text)', nameVal: pptFontBody, setName: setPptFontBody, urlVal: pptFontBodyUrl, setUrl: setPptFontBodyUrl, fileVal: pptFontBodyFile, setFile: setPptFontBodyFile, inputRef: pptFontBodyInputRef },
          ] as const).map(slot => (
            <div key={slot.label} style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: '0 0 8px' }}>{slot.label} <span style={{ fontWeight: 400 }}>{slot.sublabel}</span></p>
              <select
                value={PRESET_FONTS.some(p => p.value === slot.nameVal) ? slot.nameVal : '__custom__'}
                onChange={e => {
                  const v = e.target.value
                  if (v && v !== '__custom__') {
                    const url = `https://fonts.googleapis.com/css2?family=${v.replace(/ /g, '+')}:wght@400;500;600;700;900&display=swap`
                    slot.setName(v); slot.setUrl(url); slot.setFile(null)
                  } else {
                    slot.setName(''); slot.setUrl('')
                  }
                }}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 6, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="__custom__">— Custom / upload —</option>
                {PRESET_FONTS.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {!PRESET_FONTS.filter(p => p.value).some(p => p.value === slot.nameVal) && (
                <>
                  <input
                    type="text"
                    placeholder="Font family name, e.g. Industry"
                    value={slot.nameVal}
                    onChange={e => slot.setName(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 6, background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Paste URL (Google Fonts or .woff2)"
                      value={slot.fileVal ? slot.fileVal.name : slot.urlVal}
                      onChange={e => { slot.setUrl(e.target.value); slot.setFile(null) }}
                      readOnly={!!slot.fileVal}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--text)' }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => slot.inputRef.current?.click()} style={{ whiteSpace: 'nowrap' }}>Upload</button>
                  </div>
                </>
              )}
              {PRESET_FONTS.filter(p => p.value).some(p => p.value === slot.nameVal) && (
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>Using Google Fonts · <span style={{ color: 'var(--text)' }}>{slot.nameVal}</span></p>
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={handleSavePptFonts} disabled={savingPptFonts}>
          {savingPptFonts ? 'Saving…' : 'Save PPT Fonts'}
        </button>
      </div>

      {/* ── PPT Slide Templates ── */}
      <div style={{ marginTop: 32 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>PPT Slide Templates</p>
        <p className="subtitle" style={{ marginBottom: 14 }}>
          Select which slide types the AI can use when building presentations for this brand.
          {' '}<span style={{ color: 'var(--muted)' }}>All enabled by default.</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {PPT_SLIDE_TEMPLATES.map(tmpl => {
            const isEnabled = pptEnabledTemplates === null || pptEnabledTemplates.includes(tmpl.name)
            const isLocked = tmpl.isCover || tmpl.isClosing
            const hasOverride = !!pptTemplateOverrides[tmpl.name] || !!pptLayoutOverrides[tmpl.name]
            return (
              <div key={tmpl.name} style={{
                border: '1px solid var(--border)', borderRadius: 8,
                background: isEnabled ? 'var(--surface)' : 'transparent',
                opacity: isEnabled ? 1 : 0.5,
                overflow: 'hidden',
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', cursor: isLocked ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={isLocked}
                    style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
                    onChange={() => {
                      if (isLocked) return
                      const allNames = PPT_SLIDE_TEMPLATES.map(t => t.name)
                      const current = pptEnabledTemplates ?? allNames
                      const next = isEnabled
                        ? current.filter(n => n !== tmpl.name)
                        : [...current, tmpl.name]
                      setPptEnabledTemplates(next.length === allNames.length ? null : next)
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tmpl.displayName}
                      {isLocked && <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>required</span>}
                      {hasOverride && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: 4 }}>custom</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{tmpl.description}</div>
                  </div>
                </label>
                <div style={{ borderTop: '1px solid var(--border)', padding: '6px 12px', background: 'rgba(0,0,0,0.02)' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 10px', width: '100%' }}
                    onClick={async () => {
                      const { DEFAULT_LAYOUTS } = await import('@/lib/ppt/slide-layouts')
                      const promptText = pptTemplateOverrides[tmpl.name] || tmpl.promptText
                      const layoutText = pptLayoutOverrides[tmpl.name] ?? JSON.stringify(DEFAULT_LAYOUTS[tmpl.name] ?? {}, null, 2)
                      setEditingPptTemplate(tmpl.name)
                      setEditPptPrompt(promptText)
                      setEditPptLayout(layoutText)
                      setLayoutJsonError(null)
                      const mismatches = getLayoutPromptMismatches(layoutText, promptText)
                      setPromptMismatches(mismatches)
                      setPptModalTab('prompt')
                    }}
                  >
                    {hasOverride ? 'Edit custom template' : 'Customize template'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => handleSavePptTemplates(pptEnabledTemplates)}
          disabled={savingPptTemplates}
        >
          {savingPptTemplates ? 'Saving…' : 'Save Template Selection'}
        </button>
      </div>

      {/* ── PPT Plan System Prompt ── */}
      <div style={{ marginTop: 24, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>PPT Plan System Prompt</p>
        <p className="subtitle" style={{ marginBottom: 10 }}>
          Override the master AI instructions used when converting a PDF into a slide deck plan for this brand. Controls slide count rules, variety requirements, and overall structure. Leave blank to use the global default.
        </p>
        <textarea
          rows={12}
          placeholder="Paste your custom plan system prompt here… (leave blank to use the global default from plan-v2.txt)"
          style={{ marginBottom: '8px', resize: 'vertical', minHeight: '180px', fontFamily: 'monospace', fontSize: '12px' }}
          value={pptPlanSystemPrompt}
          onChange={e => setPptPlanSystemPrompt(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSavePptPlanPrompt(pptPlanSystemPrompt.trim() || null)} disabled={savingPptPlanPrompt}>
            {savingPptPlanPrompt ? 'Saving…' : 'Save Plan Prompt'}
          </button>
          {pptPlanSystemPrompt && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error, #e74c3c)' }} disabled={savingPptPlanPrompt}
              onClick={() => { setPptPlanSystemPrompt(''); handleSavePptPlanPrompt(null) }}>
              Reset to default
            </button>
          )}
        </div>
      </div>

      {/* ── Infographic Layouts ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '4px' }}>
        <p className="section-title" style={{ margin: 0 }}>Infographic Layouts</p>
        <button className="btn btn-secondary btn-sm" onClick={() => openInfographicModal()}>+ Add Layout</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '16px' }}>Each layout provides a visual reference for the AI. A random active layout is used when generating unless one is selected.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {infographicLayouts.length === 0 && (
          <p className="empty-state" style={{ color: 'var(--muted)', fontSize: '13px', gridColumn: '1/-1' }}>
            No layouts yet. Click &quot;+ Add Layout&quot; to create one.
          </p>
        )}
        {infographicLayouts.map(layout => (
          <div key={layout.id} style={{
            border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
            background: 'var(--surface)', opacity: layout.is_active ? 1 : 0.5,
          }}>
            {layout.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layout.image_url} alt={layout.name} loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: 64, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🖼</div>
            )}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: layout.description ? '4px' : '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layout.name}</span>
                {layout.logo_url && (
                  <span title="Has custom logo" style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600, flexShrink: 0 }}>Logo</span>
                )}
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0,
                  background: layout.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  color: layout.is_active ? '#22c55e' : 'var(--muted)',
                }}>
                  {layout.is_active ? 'Active' : 'Off'}
                </span>
              </div>
              {layout.description && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {layout.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => openInfographicModal(layout)}>
                  Edit
                </button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }} onClick={() => handleInfographicToggle(layout)}>
                  {layout.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                  title="Delete"
                  onClick={() => handleInfographicDelete(layout)}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Blog JSON Layouts ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '4px' }}>
        <p className="section-title" style={{ margin: 0 }}>Blog JSON Layouts</p>
        <button className="btn btn-secondary btn-sm" onClick={() => openBlogGroupModal()}>+ Add Layout Group</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '16px' }}>
        A layout group is a named set of slides (starting at 6, add more anytime). Each slide slot has a content
        purpose and an admin-authored JSON structure that guides the AI precisely. Pick one group per generation job.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {blogLayoutGroups.length === 0 && (
          <p className="empty-state" style={{ color: 'var(--muted)', fontSize: '13px', gridColumn: '1/-1' }}>
            No layout groups yet. Click &quot;+ Add Layout Group&quot; to create one (e.g. &quot;default&quot;).
          </p>
        )}
        {blogLayoutGroups.map(group => (
          <div key={group.id} style={{
            border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
            background: 'var(--surface)', opacity: group.is_active ? 1 : 0.5,
          }}>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: group.description ? '4px' : '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0,
                  background: group.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  color: group.is_active ? '#22c55e' : 'var(--muted)',
                }}>
                  {group.is_active ? 'Active' : 'Off'}
                </span>
              </div>
              {group.description && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {group.description}
                </p>
              )}
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', fontSize: '11px', marginBottom: '6px' }} onClick={() => openManageSlots(group)}>
                Manage Slots
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => openBlogGroupModal(group)}>Edit</button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }} onClick={() => handleBlogGroupToggle(group)}>
                  {group.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                  title="Delete"
                  onClick={() => handleBlogGroupDelete(group)}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Blog Plan Prompt ── */}
      <div style={{ marginTop: 24, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Blog Plan Prompt (GPT-5)</p>
        <p className="subtitle" style={{ marginBottom: 10 }}>
          Overrides the system prompt used to plan slide content from the PDF. Supports tokens{' '}
          <code style={{ fontSize: 11 }}>{'{{slideCount}}'}</code> and <code style={{ fontSize: 11 }}>{'{{slotLines}}'}</code>{' '}
          (the numbered list of each slide&apos;s purpose, built from the selected Layout Group&apos;s slots). Leave blank to use the built-in default.
        </p>
        <textarea
          rows={12}
          placeholder={"You are a content strategist analyzing PDF documents to plan visual blog image slide decks.\n\nAnalyze the PDF and plan exactly {{slideCount}} blog image slides, in this exact order:\n{{slotLines}}\n\nRules:\n  - Exactly {{slideCount}} slides, in the order given above — do not reorder or skip any.\n  - Extract content ONLY from the PDF. Do not invent data.\n\nReturn ONLY a valid JSON object - no markdown, no code fences."}
          style={{ marginBottom: '8px', resize: 'vertical', minHeight: '180px', fontFamily: 'monospace', fontSize: '12px' }}
          value={blogPlanPrompt}
          onChange={e => setBlogPlanPrompt(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSaveBlogPlanPrompt(blogPlanPrompt.trim() || null)} disabled={savingBlogPlanPrompt}>
            {savingBlogPlanPrompt ? 'Saving…' : 'Save Plan Prompt'}
          </button>
          {blogPlanPrompt && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error, #e74c3c)' }} disabled={savingBlogPlanPrompt}
              onClick={() => handleSaveBlogPlanPrompt(null)}>
              Reset to default
            </button>
          )}
        </div>
      </div>

      {/* ── Blog Canvas Prompt ── */}
      <div style={{ marginTop: 16, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Blog Canvas Prompt (Gemini)</p>
        <p className="subtitle" style={{ marginBottom: 10 }}>
          Overrides the system prompt used to write each slide&apos;s drawing code. Supports tokens{' '}
          <code style={{ fontSize: 11 }}>{'{{slideCount}}'}</code>, <code style={{ fontSize: 11 }}>{'{{structureReferences}}'}</code>{' '}
          (per-slide Layout JSON, when a slot has one), <code style={{ fontSize: 11 }}>{'{{headingFontLine}}'}</code>, and{' '}
          <code style={{ fontSize: 11 }}>{'{{bodyFontLine}}'}</code>. Leave blank to use the built-in default.
        </p>
        <textarea
          rows={12}
          placeholder={"You are a Creative Technologist generating JavaScript Canvas API code for branded static blog images.\nGenerate exactly {{slideCount}} distinct 1080x1080 blog image slides from the content plan.\n\n{{structureReferences}}\nTYPOGRAPHY:\n{{headingFontLine}}\n{{bodyFontLine}}"}
          style={{ marginBottom: '8px', resize: 'vertical', minHeight: '180px', fontFamily: 'monospace', fontSize: '12px' }}
          value={blogCanvasPrompt}
          onChange={e => setBlogCanvasPrompt(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSaveBlogCanvasPrompt(blogCanvasPrompt.trim() || null)} disabled={savingBlogCanvasPrompt}>
            {savingBlogCanvasPrompt ? 'Saving…' : 'Save Canvas Prompt'}
          </button>
          {blogCanvasPrompt && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error, #e74c3c)' }} disabled={savingBlogCanvasPrompt}
              onClick={() => handleSaveBlogCanvasPrompt(null)}>
              Reset to default
            </button>
          )}
        </div>
      </div>

      {/* ── PPT Layouts ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '4px' }}>
        <p className="section-title" style={{ margin: 0 }}>PPT Layouts</p>
        <button className="btn btn-secondary btn-sm" onClick={() => openPptLayoutModal()}>+ Add Layout</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '16px' }}>Reference slide layouts for the PDF-to-PPT generator. A random active layout is used as a visual style reference.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {pptLayouts.length === 0 && (
          <p className="empty-state" style={{ color: 'var(--muted)', fontSize: '13px', gridColumn: '1/-1' }}>
            No layouts yet. Click &quot;+ Add Layout&quot; to create one.
          </p>
        )}
        {pptLayouts.map(layout => (
          <div key={layout.id} style={{
            border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
            background: 'var(--surface)', opacity: layout.is_active ? 1 : 0.5,
          }}>
            {layout.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layout.image_url} alt={layout.name} loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: 64, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🖼</div>
            )}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: layout.description ? '4px' : '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layout.name}</span>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0,
                  background: layout.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  color: layout.is_active ? '#22c55e' : 'var(--muted)',
                }}>
                  {layout.is_active ? 'Active' : 'Off'}
                </span>
              </div>
              {layout.description && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {layout.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => openPptLayoutModal(layout)}>Edit</button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }} onClick={() => handlePptLayoutToggle(layout)}>
                  {layout.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                  title="Delete"
                  onClick={() => handlePptLayoutDelete(layout)}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Logo Section */}
      <p className="section-title">Logo</p>
      {profile?.logo_url ? (
        <div className="assets-grid">
          <div className="asset-card">
            <div className="asset-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.logo_url} alt="logo" loading="lazy" />
            </div>
            <div className="asset-name">Brand Logo</div>
            <button className="delete-btn" onClick={handleDeleteLogo}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <p className="empty-state">No logo uploaded.</p>
      )}

      {/* Reference Categories */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '4px' }}>
        <p className="section-title" style={{ margin: 0 }}>Reference Prompts</p>
        <button className="btn btn-secondary btn-sm" onClick={() => { setCatName(''); setCatModalOpen(true) }}>+ Add Category</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '16px' }}>Brand-specific prompt categories. One prompt per category is randomly picked when generating.</p>

      <div className="brand-grid">
        {categories.length === 0 && (
          <p className="empty-state" style={{ color: 'var(--muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>
            No categories yet. Click &quot;+ Add Category&quot; to create one.
          </p>
        )}
        {categories.map(cat => (
          <div key={cat.id} className="brand-card" style={{ position: 'relative' }}
            onClick={() => { if (editingCat !== cat.id) router.push(`/brands/${brandId}/categories/${cat.id}`) }}
          >
            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px', zIndex: 1 }}>
              <button title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                onClick={e => { e.stopPropagation(); setEditingCat(cat.id); setEditLabel(cat.label) }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                onClick={e => { e.stopPropagation(); handleDeleteCategory(cat) }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="brand-logo-thumb" style={{ background: '#222', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📝</div>
            {editingCat === cat.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text)', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); setEditingCat(null) }}>Cancel</button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={renameSaving}
                    onClick={e => { e.stopPropagation(); handleRenameCategory(cat.id, editLabel) }}>
                    {renameSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="brand-name">{cat.label}</div>
                <div className="brand-assets-count">{countMap[cat.id] || 0} prompt{(countMap[cat.id] || 0) !== 1 ? 's' : ''}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Carousel Layouts ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '48px', marginBottom: '4px' }}>
        <p className="section-title" style={{ margin: 0 }}>Carousel Layouts</p>
        <button className="btn btn-secondary btn-sm" onClick={() => { setCarouselNewName(''); setCarouselModalOpen(true) }}>+ Add Layout</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '16px' }}>Each layout has 6 slide prompts. A random layout is picked when generating a carousel.</p>

      <div className="brand-grid">
        {carouselLayouts.length === 0 && (
          <p className="empty-state" style={{ color: 'var(--muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>
            No layouts yet. Click &quot;+ Add Layout&quot; to create one.
          </p>
        )}
        {carouselLayouts.map(layout => (
          <div key={layout.id} className="brand-card" style={{ position: 'relative' }}
            onClick={() => { if (editingCarousel !== layout.id) router.push(`/brands/${brandId}/carousel-layouts/${layout.id}`) }}
          >
            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px', zIndex: 1 }}>
              <button title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                onClick={e => { e.stopPropagation(); setEditingCarousel(layout.id); setCarouselEditName(layout.name) }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                onClick={e => { e.stopPropagation(); handleCarouselDelete(layout) }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="brand-logo-thumb" style={{ background: '#222', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎠</div>
            {editingCarousel === layout.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                <input type="text" value={carouselEditName} onChange={e => setCarouselEditName(e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text)', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); setEditingCarousel(null) }}>Cancel</button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={carouselRenameSaving}
                    onClick={e => { e.stopPropagation(); handleCarouselRename(layout.id, carouselEditName) }}>
                    {carouselRenameSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="brand-name">{layout.name}</div>
                <div className="brand-assets-count">6 slide prompts</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Editable Generation Templates ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '48px', marginBottom: '4px' }}>
        <p className="section-title" style={{ margin: 0 }}>Editable Generation</p>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/brands/${brandId}/overlay-templates/new`)}>+ Add Layout</button>
      </div>
      <p className="subtitle" style={{ marginBottom: '16px' }}>AI background + Puppeteer overlay templates. Each has a background prompt and an overlay config.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {overlayTemplates.length === 0 && (
          <p className="empty-state">No templates yet. Click &quot;+ Add Layout&quot; to create one.</p>
        )}
        {overlayTemplates.map(t => (
          <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px', cursor: 'pointer' }}
            onClick={() => router.push(`/brands/${brandId}/overlay-templates/${t.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</div>
              <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); handleOverlayDelete(t.id, t.name) }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {t.bg_prompt && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {t.bg_prompt}
              </div>
            )}
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
              {t.puppeteer_config ? '✓ Overlay config set' : 'No overlay config yet'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Broker Prompts (Truckstop only) ── */}
      {isTruckstop && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '48px', marginBottom: '4px' }}>
            <p className="section-title" style={{ margin: 0 }}>Broker Prompts</p>
            <button className="btn btn-secondary btn-sm" onClick={() => { setBrokerNewName(''); setBrokerNewPrompt(''); setBrokerNewFiles([null, null]); setBrokerModalOpen(true) }}>
              + Add Prompt
            </button>
          </div>
          <p className="subtitle" style={{ marginBottom: '16px' }}>Prompts used when generating broker scene images. One is randomly selected each time.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
            {brokerPrompts.length === 0 && (
              <p className="empty-state">No broker prompts yet. Click &quot;+ Add Prompt&quot; to create one.</p>
            )}
            {brokerPrompts.map(l => (
              <div key={l.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
                {editingBroker === l.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Name</label>
                      <input type="text" value={brokerEditName} onChange={e => setBrokerEditName(e.target.value)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Prompt</label>
                      <textarea rows={6} value={brokerEditPrompt} onChange={e => setBrokerEditPrompt(e.target.value)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '120px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Reference Images</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {[0, 1].map(i => (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--muted)' }}>Image {i + 1}</label>
                            {l.reference_image_urls?.[i] && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={l.reference_image_urls[i]!} alt="" loading="lazy"
                                style={{ width: '100%', height: '64px', objectFit: 'cover', borderRadius: '6px', marginBottom: '2px' }} />
                            )}
                            <input type="file" accept="image/*"
                              onChange={e => { const f = [...brokerEditFiles]; f[i] = e.target.files?.[0] ?? null; setBrokerEditFiles(f) }}
                              style={{ fontSize: '11px', color: 'var(--text)', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 7px', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingBroker(null)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" disabled={brokerEditSaving} onClick={() => handleBrokerSaveEdit(l.id)}>
                        {brokerEditSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{l.name}</div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                          onClick={() => { setEditingBroker(l.id); setBrokerEditName(l.name); setBrokerEditPrompt(l.prompt); setBrokerEditFiles([null, null]) }}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                          onClick={() => handleBrokerDelete(l.id)}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{l.prompt}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}


      {/* ── Illustration Layouts ── */}
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '48px', marginBottom: '4px' }}>
          <p className="section-title" style={{ margin: 0 }}>Illustration Layouts</p>
          <button className="btn btn-secondary btn-sm" onClick={() => { setIllustrationNewName(''); setIllustrationNewPrompt(''); setIllustrationModalOpen(true) }}>
            + Add Layout
          </button>
        </div>
        <p className="subtitle" style={{ marginBottom: '16px' }}>Layouts used when generating illustrations. Two are randomly selected each time.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
          {illustrationLayouts.length === 0 && (
            <p className="empty-state">No illustration layouts yet. Click &quot;+ Add Layout&quot; to create one.</p>
          )}
          {illustrationLayouts.map(l => (
            <div key={l.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
              {editingIllustration === l.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Name</label>
                    <input type="text" value={illustrationEditName} onChange={e => setIllustrationEditName(e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Prompt</label>
                    <textarea rows={6} value={illustrationEditPrompt} onChange={e => setIllustrationEditPrompt(e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '120px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingIllustration(null)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" disabled={illustrationEditSaving} onClick={() => handleIllustrationSaveEdit(l.id)}>
                      {illustrationEditSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{l.name}</div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                        onClick={() => { setEditingIllustration(l.id); setIllustrationEditName(l.name); setIllustrationEditPrompt(l.prompt) }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                        onClick={() => handleIllustrationDelete(l.id)}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{l.prompt}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </>

      {/* Add Illustration Layout Modal */}
      <div className={`modal-overlay${illustrationModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setIllustrationModalOpen(false) }}>
        <div className="modal">
          <h2>Add Illustration Layout</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Layout Name</label>
            <input type="text" placeholder="e.g. Flat Minimal, Isometric, Line Art…" value={illustrationNewName} onChange={e => setIllustrationNewName(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
          </div>
          <div className="form-group">
            <label>Prompt</label>
            <textarea rows={5} placeholder="Describe the illustration style and visual rules…" value={illustrationNewPrompt} onChange={e => setIllustrationNewPrompt(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setIllustrationModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleIllustrationAdd} disabled={illustrationAddSaving || !illustrationNewName.trim() || !illustrationNewPrompt.trim()}>
              {illustrationAddSaving ? 'Creating…' : 'Create Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Carousel Layout Modal */}
      <div className={`modal-overlay${carouselModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setCarouselModalOpen(false) }}>
        <div className="modal">
          <h2>Add Carousel Layout</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Layout Name</label>
            <input type="text" placeholder="e.g. Bold Minimal" value={carouselNewName} onChange={e => setCarouselNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCarouselAdd() }}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setCarouselModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCarouselAdd} disabled={carouselAddSaving}>
              {carouselAddSaving ? 'Creating…' : 'Create Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Blog Layout Group Modal */}
      <div className={`modal-overlay${blogGroupModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) { setBlogGroupModalOpen(false); setEditingBlogGroup(null) } }}>
        <div className="modal">
          <h2>{editingBlogGroup ? 'Edit Layout Group' : 'Add Layout Group'}</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Group Name</label>
            <input type="text" placeholder="e.g. default, editorial, bold-stat…"
              value={blogGroupNewName} onChange={e => setBlogGroupNewName(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
          </div>
          <div className="form-group">
            <label>Description <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
            <textarea rows={3} placeholder="Describe this style/family of slides…"
              value={blogGroupNewDescription} onChange={e => setBlogGroupNewDescription(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', outline: 'none', resize: 'vertical' }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setBlogGroupModalOpen(false); setEditingBlogGroup(null) }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBlogGroupSave} disabled={blogGroupAddSaving || !blogGroupNewName.trim()}>
              {blogGroupAddSaving ? 'Saving…' : editingBlogGroup ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>

      {/* Manage Blog Layout Slots Modal */}
      <div className={`modal-overlay${managingSlotsGroup ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setManagingSlotsGroup(null) }}>
        <div className="modal" style={{ maxWidth: 820 }}>
          <h2 style={{ marginBottom: 4 }}>Slots — {managingSlotsGroup?.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Each slot becomes one slide, in order. &quot;Content Purpose&quot; tells the AI what to pull from the PDF for
            that slide; &quot;Layout JSON&quot; is a structural reference (positions, elements, colors) the AI follows
            closely when writing that slide&apos;s drawing code. Include a top-level{' '}
            <code style={{ fontSize: 11 }}>{'"canvas": { "width": 1080, "height": 1080 }'}</code>{' '}
            to control that specific slide&apos;s actual image size — each slide can be a different size (default 1080 × 1080 if omitted).
          </p>

          {blogSlotsLoading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>}

          {!blogSlotsLoading && blogSlots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>No slots yet.</p>
              <button className="btn btn-primary btn-sm" onClick={handleAddDefaultSixSlots}>+ Add 6 Slots</button>
            </div>
          )}

          {!blogSlotsLoading && blogSlots.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
              {blogSlots.map((slot, i) => {
                const draft = blogSlotDrafts[slot.id] || { name: slot.name, description: slot.description || '', layout_json: slot.layout_json || '' }
                const jsonError = blogSlotJsonErrors[slot.id]
                return (
                  <div key={slot.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slide {i + 1}</span>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                        title="Delete slot"
                        onClick={() => handleDeleteBlogSlot(slot)}
                      >
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Slot Name</label>
                      <input type="text" value={draft.name} onChange={e => updateBlogSlotDraft(slot.id, 'name', e.target.value)}
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 13, width: '100%', outline: 'none' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Content Purpose</label>
                      <textarea rows={2} placeholder="e.g. Opening hero slide introducing the main topic"
                        value={draft.description} onChange={e => updateBlogSlotDraft(slot.id, 'description', e.target.value)}
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 13, width: '100%', outline: 'none', resize: 'vertical' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: jsonError ? 4 : 0 }}>
                      <label style={{ fontSize: 12 }}>Layout JSON <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                      <textarea rows={8} placeholder={'{\n  "theme": "dark",\n  "background": { "color": "#111827" },\n  "logo": { "enabled": true, "variant": "dark", "x": 72, "y": 72, "height": 40 },\n  "elements": []\n}'} spellCheck={false}
                        value={draft.layout_json} onChange={e => updateBlogSlotDraft(slot.id, 'layout_json', e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--surface)', border: `1px solid ${jsonError ? '#ef4444' : 'var(--border)'}`, borderRadius: 6, padding: '7px 10px', color: 'var(--text)', width: '100%', outline: 'none', resize: 'vertical' }} />
                      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.4 }}>
                        Logo is omitted unless this JSON includes an enabled logo. Set variant to light or dark to select that saved brand-logo asset.
                      </p>
                    </div>
                    {jsonError && <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 8px' }}>{jsonError}</p>}
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, fontSize: 11 }}
                      onClick={() => handleSaveBlogSlot(slot)} disabled={blogSlotSaving[slot.id]}>
                      {blogSlotSaving[slot.id] ? 'Saving…' : 'Save Slot'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 16 }}>
            {blogSlots.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleAddBlogSlot}>+ Add Slot</button>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => setManagingSlotsGroup(null)}>Close</button>
          </div>
        </div>
      </div>

      {/* Add Infographic Layout Modal */}
      <div className={`modal-overlay${infographicModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) { setInfographicModalOpen(false); setEditingInfographicLayout(null) } }}>
        <div className="modal">
          <h2>{editingInfographicLayout ? 'Edit Infographic Layout' : 'Add Infographic Layout'}</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Layout Name</label>
            <input type="text" placeholder="e.g. Split Editorial, Single Stat, 3-Column Grid…"
              value={infographicNewName} onChange={e => setInfographicNewName(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
          </div>
          <div className="form-group">
            <label>Description <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
            <textarea rows={3} placeholder="Describe the layout composition and visual rules for the AI…"
              value={infographicNewDescription} onChange={e => setInfographicNewDescription(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', outline: 'none', resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Reference Image <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
            <input ref={infographicFileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                setInfographicImageFile(file)
                setInfographicNewImageUrl('')
                const reader = new FileReader()
                reader.onloadend = () => setInfographicImagePreview(reader.result as string)
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
            {infographicImagePreview ? (
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={infographicImagePreview} alt="preview" loading="lazy" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                <button onClick={() => { setInfographicImageFile(null); setInfographicImagePreview(null) }}
                  style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: '12px' }}>
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div onClick={() => infographicFileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px' }}>
                  Click to upload image
                </div>
                <input type="url" placeholder="Or paste an image URL…"
                  value={infographicNewImageUrl} onChange={e => setInfographicNewImageUrl(e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', outline: 'none' }} />
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setInfographicModalOpen(false); setEditingInfographicLayout(null) }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleInfographicSave} disabled={infographicAddSaving || !infographicNewName.trim()}>
              {infographicAddSaving ? 'Saving…' : editingInfographicLayout ? 'Save Changes' : 'Create Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* PPT Layout Modal */}
      <div className={`modal-overlay${pptLayoutModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) { setPptLayoutModalOpen(false); setEditingPptLayout(null) } }}>
        <div className="modal">
          <h2>{editingPptLayout ? 'Edit PPT Layout' : 'Add PPT Layout'}</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Layout Name</label>
            <input type="text" placeholder="e.g. Title Cover, Stat Grid, Hero Split…"
              value={pptLayoutNewName} onChange={e => setPptLayoutNewName(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
          </div>
          <div className="form-group">
            <label>Description <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
            <textarea rows={3} placeholder="Describe the slide layout and design style for the AI…"
              value={pptLayoutNewDescription} onChange={e => setPptLayoutNewDescription(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', outline: 'none', resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Reference Image <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
            <input ref={pptLayoutFileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                setPptLayoutImageFile(file)
                setPptLayoutNewImageUrl('')
                const reader = new FileReader()
                reader.onloadend = () => setPptLayoutImagePreview(reader.result as string)
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
            {pptLayoutImagePreview ? (
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pptLayoutImagePreview} alt="preview" loading="lazy" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                <button onClick={() => { setPptLayoutImageFile(null); setPptLayoutImagePreview(null) }}
                  style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: '12px' }}>
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div onClick={() => pptLayoutFileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px' }}>
                  Click to upload image
                </div>
                <input type="url" placeholder="Or paste an image URL…"
                  value={pptLayoutNewImageUrl} onChange={e => setPptLayoutNewImageUrl(e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', width: '100%', outline: 'none' }} />
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setPptLayoutModalOpen(false); setEditingPptLayout(null) }}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePptLayoutSave} disabled={pptLayoutAddSaving || !pptLayoutNewName.trim()}>
              {pptLayoutAddSaving ? 'Saving…' : editingPptLayout ? 'Save Changes' : 'Create Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* PPT Template Prompt Edit Modal */}
      <div className={`modal-overlay${editingPptTemplate ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setEditingPptTemplate(null) }}>
        <div className="modal" style={{ maxWidth: 820 }}>
          <h2 style={{ marginBottom: 4 }}>
            {PPT_SLIDE_TEMPLATES.find(t => t.name === editingPptTemplate)?.displayName ?? editingPptTemplate}
          </h2>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {(['prompt', 'layout'] as const).map(tab => (
              <button key={tab} onClick={() => setPptModalTab(tab)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px 14px',
                fontSize: 13, fontWeight: pptModalTab === tab ? 600 : 400,
                color: pptModalTab === tab ? 'var(--primary)' : 'var(--muted)',
                borderBottom: pptModalTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}>
                {tab === 'prompt' ? 'AI Prompt' : 'Layout JSON'}
              </button>
            ))}
          </div>

          {pptModalTab === 'prompt' && (<>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              This prompt tells the AI what fields to fill in when it picks this slide type.
            </p>

            {promptMismatches.length > 0 && (
              <div style={{ fontSize: 12, marginBottom: 14, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.25)', display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ color: '#b45309', fontWeight: 600, whiteSpace: 'nowrap' }}>⚠ Layout fields not in prompt:</span>
                <code style={{ fontFamily: 'monospace', color: '#92400e', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 3 }}>{promptMismatches.join(', ')}</code>
                <span style={{ color: '#b45309' }}>— use &ldquo;Regen AI Prompt&rdquo; (in the Layout tab) or update manually, then save.</span>
              </div>
            )}

            {/* Available fields */}
            {(() => {
              const tmpl = PPT_SLIDE_TEMPLATES.find(t => t.name === editingPptTemplate)
              if (!tmpl) return null
              return (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available fields</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tmpl.fields.map(f => (
                      <span key={f.name} style={{
                        fontSize: 11, fontFamily: 'monospace',
                        background: f.required ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.05)',
                        color: f.required ? 'var(--primary)' : 'var(--muted)',
                        border: `1px solid ${f.required ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                        borderRadius: 4, padding: '2px 7px',
                      }}>
                        {f.name} <span style={{ opacity: 0.6 }}>{f.type}</span>{f.required ? '' : '?'}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>AI Prompt</span>
                {pptTemplateOverrides[editingPptTemplate ?? ''] && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={handleResetPptTemplatePrompt} disabled={savingPptEdit}>
                    Reset to default
                  </button>
                )}
              </label>
              <textarea rows={16} value={editPptPrompt} onChange={e => setEditPptPrompt(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12, width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', resize: 'vertical', outline: 'none' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditingPptTemplate(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePptTemplatePrompt} disabled={savingPptEdit}>
                {savingPptEdit ? 'Saving…' : 'Save Prompt'}
              </button>
            </div>
          </>)}

          {pptModalTab === 'layout' && (<>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              JSON config that controls every element&apos;s position, size, font, and colour on this slide type.
              Uses <code style={{ fontSize: 11 }}>{'{{token}}'}</code> for brand colours/fonts and <code style={{ fontSize: 11 }}>{'{{spec.field}}'}</code> for AI-generated content.
            </p>
            {layoutJsonError && (
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                {layoutJsonError}
              </p>
            )}
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Layout JSON</span>
                {pptLayoutOverrides[editingPptTemplate ?? ''] && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={handleResetPptTemplateLayout} disabled={savingPptEdit}>
                    Reset to default
                  </button>
                )}
              </label>
              <textarea rows={22} value={editPptLayout} onChange={e => { setEditPptLayout(e.target.value); setLayoutJsonError(null) }}
                spellCheck={false}
                style={{ fontFamily: 'monospace', fontSize: 11, width: '100%', background: 'var(--bg)', border: `1px solid ${layoutJsonError ? '#ef4444' : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', color: 'var(--text)', resize: 'vertical', outline: 'none' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditingPptTemplate(null)}>Cancel</button>
              <button
                className="btn btn-secondary"
                disabled={savingPptEdit || regenPromptLoading}
                title="AI reads the layout's {{field}} tokens and rewrites the prompt to match"
                onClick={async () => {
                  setRegenPromptLoading(true)
                  try {
                    const res = await authedFetch('/api/ppt-slide-templates/regen-prompt', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ templateName: editingPptTemplate, layoutJson: editPptLayout }),
                    })
                    const json = await res.json() as { prompt?: string; error?: string }
                    if (json.error) { showToast(json.error, true); return }
                    if (json.prompt) {
                      setEditPptPrompt(json.prompt)
                      setPptModalTab('prompt')
                      showToast('Prompt regenerated — review and save.')
                    }
                  } catch (e) {
                    showToast((e as Error).message, true)
                  } finally {
                    setRegenPromptLoading(false)
                  }
                }}
              >
                {regenPromptLoading ? 'Regenerating…' : '✦ Regen AI Prompt'}
              </button>
              <button className="btn btn-primary" onClick={handleSavePptTemplateLayout} disabled={savingPptEdit}>
                {savingPptEdit ? 'Saving…' : 'Save Layout'}
              </button>
            </div>
          </>)}
        </div>
      </div>

      {/* Add Category Modal */}
      <div className={`modal-overlay${catModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setCatModalOpen(false) }}>
        <div className="modal">
          <h2>Add Category</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Category Name</label>
            <input type="text" placeholder="e.g. Product Shots" value={catName} onChange={e => setCatName(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', width: '100%', outline: 'none' }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setCatModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateCategory} disabled={catSaving}>
              {catSaving ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Multi-size Ads Prompts ── */}
      <div style={{ marginTop: '48px', marginBottom: '32px' }}>
        <p className="section-title" style={{ margin: '0 0 4px' }}>Multi-size Ads Prompts</p>
        <p className="subtitle" style={{ marginBottom: '12px' }}>Default background image prompt used when the user leaves the field blank on the Multi-size Ads page.</p>
        <textarea
          rows={4}
          style={{ marginBottom: '8px', resize: 'vertical', minHeight: '80px' }}
          placeholder="e.g. modern tech office, soft blue tones, clean and minimal"
          value={bannerBgPrompt}
          onChange={e => setBannerBgPrompt(e.target.value)}
        />
        <button className="btn btn-secondary btn-sm" onClick={handleSaveBannerBgPrompt} disabled={savingBannerBgPrompt}>
          {savingBannerBgPrompt ? 'Saving…' : 'Save Prompt'}
        </button>
      </div>

      {/* ── Banner Templates ── */}
      <div style={{ marginTop: '48px', marginBottom: '32px' }}>
        <p className="section-title" style={{ margin: '0 0 4px' }}>Banner Templates</p>
        <p className="subtitle" style={{ marginBottom: '16px' }}>Configure typography, visibility, and layout per banner size. All 7 sizes must be saved before generation is allowed.</p>
        {BANNER_SIZES.map(size => {
          const cfg = bannerTemplates[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]
          const isSaved = !!bannerTemplates[size.key]
          const isExpanded = bannerExpanded === size.key
          return (
            <div key={size.key} style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: isExpanded ? 'var(--surface)' : 'transparent' }}
                onClick={() => setBannerExpanded(isExpanded ? null : size.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{size.label}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'monospace' }}>{size.w}×{size.h}</span>
                  {isSaved
                    ? <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>✓ Saved</span>
                    : <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>Not configured</span>}
                </div>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              {isExpanded && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(['heading', 'subheading'] as const).map(el => (
                    <div key={el}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'capitalize', cursor: 'pointer' }}>
                        <input type="checkbox" checked={cfg[el].visible} onChange={e => updateBannerTemplate(size.key, el, 'visible', e.target.checked)} />
                        {el}
                      </label>
                      {cfg[el].visible && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingLeft: '22px' }}>
                          <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Font size (px)
                            <input type="number" min={5} max={72} value={cfg[el].fontSize} style={{ width: '72px' }}
                              onChange={e => updateBannerTemplate(size.key, el, 'fontSize', Number(e.target.value))} />
                          </label>
                          <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Font weight
                            <select value={cfg[el].fontWeight} onChange={e => updateBannerTemplate(size.key, el, 'fontWeight', e.target.value)}>
                              <option value="400">Regular (400)</option>
                              <option value="500">Medium (500)</option>
                              <option value="600">Semibold (600)</option>
                              <option value="700">Bold (700)</option>
                            </select>
                          </label>
                          <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Align
                            <select value={cfg[el].textAlign} onChange={e => updateBannerTemplate(size.key, el, 'textAlign', e.target.value)}>
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </label>
                          <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Font family
                            <select value={cfg[el].fontFamily ?? ''} style={{ minWidth: '140px' }}
                              onChange={e => updateBannerTemplate(size.key, el, 'fontFamily', e.target.value)}>
                              {PRESET_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              {(cfg.customFonts ?? []).map(f => <option key={f.name} value={f.name}>{f.name} (custom)</option>)}
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* CTA */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cfg.cta.visible} onChange={e => updateBannerTemplate(size.key, 'cta', 'visible', e.target.checked)} />
                      CTA Button
                    </label>
                    {cfg.cta.visible && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingLeft: '22px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Font size (px)
                          <input type="number" min={5} max={24} value={cfg.cta.fontSize} style={{ width: '72px' }}
                            onChange={e => updateBannerTemplate(size.key, 'cta', 'fontSize', Number(e.target.value))} />
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Font weight
                          <select value={cfg.cta.fontWeight} onChange={e => updateBannerTemplate(size.key, 'cta', 'fontWeight', e.target.value)}>
                            <option value="400">Regular</option>
                            <option value="600">Semibold</option>
                            <option value="700">Bold</option>
                          </select>
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Button size
                          <select value={cfg.cta.size} onChange={e => updateBannerTemplate(size.key, 'cta', 'size', e.target.value)}>
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                          </select>
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Text case
                          <select value={cfg.cta.textTransform ?? 'uppercase'} onChange={e => updateBannerTemplate(size.key, 'cta', 'textTransform', e.target.value)}>
                            <option value="uppercase">UPPERCASE</option>
                            <option value="capitalize">Title Case</option>
                            <option value="none">Sentence case</option>
                          </select>
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Font family
                          <select value={cfg.cta.fontFamily ?? ''} style={{ minWidth: '140px' }}
                            onChange={e => updateBannerTemplate(size.key, 'cta', 'fontFamily', e.target.value)}>
                            {PRESET_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            {(cfg.customFonts ?? []).map(f => <option key={f.name} value={f.name}>{f.name} (custom)</option>)}
                          </select>
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Padding horizontal (px)
                          <input type="number" min={0} max={80} value={cfg.cta.paddingH ?? 12} style={{ width: '72px' }}
                            onChange={e => updateBannerTemplate(size.key, 'cta', 'paddingH', Number(e.target.value))} />
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Padding vertical (px)
                          <input type="number" min={0} max={80} value={cfg.cta.paddingV ?? 8} style={{ width: '72px' }}
                            onChange={e => updateBannerTemplate(size.key, 'cta', 'paddingV', Number(e.target.value))} />
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Border radius (px)
                          <input type="number" min={0} max={50} value={cfg.cta.borderRadius ?? 4} style={{ width: '72px' }}
                            onChange={e => updateBannerTemplate(size.key, 'cta', 'borderRadius', Number(e.target.value))} />
                        </label>
                        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          Border width (px)
                          <input type="number" min={0} max={10} value={cfg.cta.borderWidth ?? 0} style={{ width: '72px' }}
                            onChange={e => updateBannerTemplate(size.key, 'cta', 'borderWidth', Number(e.target.value))} />
                        </label>
                        {(cfg.cta.borderWidth ?? 0) > 0 && (
                          <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Border color
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input type="color" value={cfg.cta.borderColor ?? '#000000'} style={{ width: '36px', height: '28px', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer' }}
                                onChange={e => updateBannerTemplate(size.key, 'cta', 'borderColor', e.target.value)} />
                              <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{cfg.cta.borderColor ?? '#000000'}</span>
                            </div>
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Layout & Position */}
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px' }}>Layout &amp; Position</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                        Logo size — {cfg.logoSize ?? 52}px
                        <input type="range" min={8} max={200} value={cfg.logoSize ?? 52}
                          onChange={e => setBannerTemplates(prev => {
                            const cur = prev[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]
                            return { ...prev, [size.key]: { ...cur, logoSize: Number(e.target.value) } }
                          })} />
                      </label>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Padding left (px)
                        <input type="number" min={0} max={200} value={cfg.layout?.paddingLeft ?? 16} style={{ width: '72px' }}
                          onChange={e => updateBannerTemplate(size.key, 'layout', 'paddingLeft', Number(e.target.value))} />
                      </label>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Padding right (px)
                        <input type="number" min={0} max={200} value={cfg.layout?.paddingRight ?? 12} style={{ width: '72px' }}
                          onChange={e => updateBannerTemplate(size.key, 'layout', 'paddingRight', Number(e.target.value))} />
                      </label>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Padding top (px)
                        <input type="number" min={0} max={200} value={cfg.layout?.paddingTop ?? 0} style={{ width: '72px' }}
                          onChange={e => updateBannerTemplate(size.key, 'layout', 'paddingTop', Number(e.target.value))} />
                      </label>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Padding bottom (px)
                        <input type="number" min={0} max={200} value={cfg.layout?.paddingBottom ?? 8} style={{ width: '72px' }}
                          onChange={e => updateBannerTemplate(size.key, 'layout', 'paddingBottom', Number(e.target.value))} />
                      </label>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Element spacing (gap px)
                        <input type="number" min={0} max={40} value={cfg.layout?.gap ?? 6} style={{ width: '72px' }}
                          onChange={e => updateBannerTemplate(size.key, 'layout', 'gap', Number(e.target.value))} />
                      </label>
                      <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Vertical align
                        <select value={cfg.layout?.justify ?? 'center'} onChange={e => updateBannerTemplate(size.key, 'layout', 'justify', e.target.value)}>
                          <option value="start">Top</option>
                          <option value="center">Center</option>
                          <option value="end">Bottom</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* Image */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      Background image area
                      <select value={cfg.image.size} style={{ maxWidth: '180px' }}
                        onChange={e => updateBannerTemplate(size.key, 'image', 'size', e.target.value)}>
                        <option value="none">None (solid background)</option>
                        <option value="small">Small (~20%)</option>
                        <option value="medium">Medium (~30%)</option>
                        <option value="large">Large (~40%)</option>
                        <option value="full">Full background</option>
                      </select>
                    </label>
                  </div>


                  {/* Custom Fonts */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Custom Fonts</p>
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" accept=".woff,.woff2,.ttf,.otf" style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const fontName = file.name.replace(/\.[^.]+$/, '')
                            try {
                              const __font = await uploadMedia(file, { folder: 'brand-logos', fileName: file.name })
                              const url = __font.url
                              setBannerTemplates(prev => {
                                const cur = prev[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]
                                return { ...prev, [size.key]: { ...cur, customFonts: [...(cur.customFonts ?? []), { name: fontName, url }] } }
                              })
                              injectCustomFont(fontName, url)
                            } catch { showToast('Failed to upload font.', true) }
                            e.target.value = ''
                          }} />
                        <span className="btn btn-secondary btn-sm">+ Upload Font</span>
                      </label>
                    </div>
                    {(cfg.customFonts ?? []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(cfg.customFonts ?? []).map((f, i) => (
                          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '12px' }}>
                            <span style={{ fontFamily: `'${f.name}', sans-serif` }}>{f.name}</span>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 2px', fontSize: '14px', lineHeight: 1 }}
                              onClick={() => setBannerTemplates(prev => {
                                const cur = prev[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]
                                return { ...prev, [size.key]: { ...cur, customFonts: (cur.customFonts ?? []).filter((_, j) => j !== i) } }
                              })}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {(cfg.customFonts ?? []).length === 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Upload .woff/.woff2/.ttf files to use custom brand fonts in this template.</p>
                    )}
                  </div>

                  {/* Custom Elements */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Custom Graphic Elements</p>
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" accept="image/*,image/svg+xml" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) { handleUploadElement(size.key, f); e.target.value = '' } }} />
                        <span className="btn btn-secondary btn-sm" style={{ pointerEvents: elementUploading === size.key ? 'none' : 'auto', opacity: elementUploading === size.key ? 0.6 : 1 } as React.CSSProperties}>
                          {elementUploading === size.key ? 'Uploading…' : '+ Upload Element'}
                        </span>
                      </label>
                    </div>
                    {(cfg.elements ?? []).length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--muted)' }}>No custom elements. Upload PNG/SVG graphics to layer behind or in front of banner content.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(cfg.elements ?? []).map((el, idx) => (
                          <div key={el.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={el.url} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0, borderRadius: '4px', background: '#f8fafc', border: '1px solid var(--border)' }} />
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
                              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                Layer
                                <select value={el.layer} style={{ fontSize: '11px' }}
                                  onChange={e => updateTemplateElements(size.key, (cfg.elements ?? []).map((x, i) => i === idx ? { ...x, layer: e.target.value as 'background' | 'foreground' } : x))}>
                                  <option value="background">Behind content</option>
                                  <option value="foreground">In front of content</option>
                                </select>
                              </label>
                              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '140px' }}>
                                Size — {el.scale ?? 20}% of banner width
                                <input type="range" min={5} max={100} step={1} value={el.scale ?? 20}
                                  onChange={e => updateTemplateElements(size.key, (cfg.elements ?? []).map((x, i) => i === idx ? { ...x, scale: Number(e.target.value) } : x))} />
                              </label>
                              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                X (%)
                                <input type="number" step={0.5} value={el.x ?? 0} style={{ width: '64px', fontSize: '11px' }}
                                  onChange={e => updateTemplateElements(size.key, (cfg.elements ?? []).map((x, i) => i === idx ? { ...x, x: Number(e.target.value) } : x))} />
                              </label>
                              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                Y (%)
                                <input type="number" step={0.5} value={el.y ?? 0} style={{ width: '64px', fontSize: '11px' }}
                                  onChange={e => updateTemplateElements(size.key, (cfg.elements ?? []).map((x, i) => i === idx ? { ...x, y: Number(e.target.value) } : x))} />
                              </label>
                            </div>
                            <button title="Remove element" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', flexShrink: 0 }}
                              onClick={() => updateTemplateElements(size.key, (cfg.elements ?? []).filter((_, i) => i !== idx))}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveBannerTemplate(size.key)} disabled={bannerSaving === size.key}>
                      {bannerSaving === size.key ? 'Saving…' : 'Save Template'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setBannerPreviewOpen(bannerPreviewOpen === size.key ? null : size.key)}>
                      {bannerPreviewOpen === size.key ? 'Hide Preview' : 'Preview'}
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => {
                      if (!confirm('Reset this template to defaults?')) return
                      setBannerTemplates(prev => ({ ...prev, [size.key]: JSON.parse(JSON.stringify(DEFAULT_BANNER_TEMPLATES[size.key])) }))
                    }}>
                      Reset
                    </button>
                  </div>

                  {bannerPreviewOpen === size.key && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview Copy</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {([
                          { key: 'heading',    ph: 'Headline' },
                          { key: 'subheading', ph: 'Subheading' },
                          { key: 'cta',        ph: 'CTA' },
                        ] as const).map(f => (
                          <input key={f.key} value={bannerPreviewCopy[f.key]} placeholder={f.ph}
                            onChange={e => setBannerPreviewCopy(p => ({ ...p, [f.key]: e.target.value }))}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', minWidth: '140px', flex: 1 }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                          Drag any element to reposition it. Changes are saved with the template.
                        </p>
                        {Object.keys(cfg.pinned ?? {}).length > 0 && (
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: '11px', flexShrink: 0 }}
                            onClick={() => setBannerTemplates(prev => {
                              const cur = prev[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]
                              // eslint-disable-next-line @typescript-eslint/no-unused-vars
                              const { pinned: _, ...rest } = cur
                              return { ...prev, [size.key]: rest }
                            })}>
                            Reset positions
                          </button>
                        )}
                      </div>
                      <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
                        {(() => {
                          const maxW = 700
                          const scale = Math.min(1, maxW / size.w)
                          return (
                            <div style={{ display: 'inline-block', width: Math.round(size.w * scale), height: Math.round(size.h * scale), overflow: 'hidden', borderRadius: '6px' }}>
                              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: size.w, height: size.h }}>
                                <BannerPreview
                                  size={BANNER_SIZES.find(s => s.key === size.key)!}
                                  copy={bannerPreviewCopy}
                                  assets={{
                                    colors: {
                                      primaryColor: extractPrimaryColor(stylePrompt),
                                      secondaryColor: '#374151',
                                      accentColor: extractPrimaryColor(stylePrompt),
                                      backgroundColor: '#ffffff',
                                      textColor: '#1f2937',
                                      visualTheme: 'light',
                                    },
                                    bgImageUrl: '',
                                    logoUrl: profile?.logo_url ?? null,
                                  }}
                                  template={cfg}
                                  onElementMove={(type, xPct, yPct) => {
                                    setBannerTemplates(prev => {
                                      const cur = prev[size.key] || DEFAULT_BANNER_TEMPLATES[size.key]
                                      return { ...prev, [size.key]: { ...cur, pinned: { ...(cur.pinned ?? {}), [type]: { xPct, yPct } } } }
                                    })
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Broker Prompt Modal */}
      <div className={`modal-overlay${brokerModalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setBrokerModalOpen(false) }}>
        <div className="modal">
          <h2>Add Broker Prompt</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Prompt name (e.g. Office Scene)" value={brokerNewName} onChange={e => setBrokerNewName(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' }} />
            <textarea rows={6} placeholder="Describe the scene in detail..." value={brokerNewPrompt} onChange={e => setBrokerNewPrompt(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', width: '100%', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Reference Images (optional)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[0, 1].map(i => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Image {i + 1}</label>
                    <input type="file" accept="image/*"
                      onChange={e => { const f = [...brokerNewFiles]; f[i] = e.target.files?.[0] ?? null; setBrokerNewFiles(f) }}
                      style={{ fontSize: '12px', color: 'var(--text)', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 8px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setBrokerModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBrokerAdd} disabled={brokerAddSaving}>
              {brokerAddSaving ? 'Saving…' : 'Save Prompt'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
