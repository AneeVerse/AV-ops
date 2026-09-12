import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'
import {
  getBlockingBrandSetupIssues,
  normalizeBrandSetupResult,
  validateBrandSetupResult,
} from '@/lib/brand-setup-normalize'
import type { BrandSetupResult } from '@/lib/brand-setup-types'
import { hydrateLegacyBrandSetupFields } from '@/lib/brand-system/result-adapters'
import { sanitizeBackgroundAssetPrompt } from '@/lib/background-prompt-safety'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function safeName(value: string, fallback: string): string {
  return (value || fallback).trim().slice(0, 120)
}

function normalizeCarouselConfig(config: BrandSetupResult['carouselLayouts'][number]['slides'][number]['puppeteerConfig']) {
  const cta = config.cta
  const ctaStyle = config.ctaStyle || (cta ? {
    bgColor: cta.bgColor,
    textColor: cta.textColor,
    fontSize: cta.fontSize,
    paddingX: cta.paddingX,
    paddingY: cta.paddingY,
    borderRadius: cta.borderRadius,
    x: cta.x,
    y: cta.y,
  } : null)
  return {
    ...config,
    splitPercent: config.splitPercent ?? config.splitRatio ?? null,
    ctaStyle,
    ctaPosition: config.ctaPosition || cta?.align || 'center',
  }
}

export async function POST(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const createdCategoryIds: string[] = []
  const createdOverlayIds: string[] = []
  const createdCarouselIds: string[] = []
  const createdInfographicIds: string[] = []
  let previousProfile: { style_prompt: string | null; infographic_md: string | null } | null = null
  let profileExisted = false
  let brandId = ''

  try {
    const body = await req.json() as { brandId: string; jobId?: string | null; result: BrandSetupResult; applyOptions?: Partial<Record<'brandDescription' | 'infographicGuidelines' | 'infographicLayouts' | 'staticLayouts' | 'editableTemplates' | 'carouselLayouts', 'add' | 'replace' | 'skip'>> }
    brandId = body.brandId?.trim()
    if (!brandId) return NextResponse.json({ error: 'Select a brand.' }, { status: 400 })

    const { data: brand } = await supabase.from('brands').select('id,name').eq('id', brandId).maybeSingle()
    if (!brand) return NextResponse.json({ error: 'Brand not found.' }, { status: 404 })

    const result = normalizeBrandSetupResult(hydrateLegacyBrandSetupFields(body.result), brand.name)
    const validationIssues = validateBrandSetupResult(result)
    const blockingIssues = getBlockingBrandSetupIssues(validationIssues)
    if (blockingIssues.length) {
      return NextResponse.json({
        error: `This setup failed ${blockingIssues.length} required check(s). ${blockingIssues.slice(0, 3).join('; ')}`,
        validationIssues,
      }, { status: 400 })
    }
    const action = (key: keyof NonNullable<typeof body.applyOptions>) => body.applyOptions?.[key] || 'add'

    const { data: oldProfile } = await supabase
      .from('brand_profiles')
      .select('style_prompt,infographic_md')
      .eq('brand_id', brandId)
      .maybeSingle()
    profileExisted = Boolean(oldProfile)
    previousProfile = oldProfile || null

    if (action('brandDescription') !== 'skip' || action('infographicGuidelines') !== 'skip') {
      const { error: profileError } = await supabase.from('brand_profiles').upsert({
        brand_id: brandId,
        style_prompt: action('brandDescription') === 'skip' ? oldProfile?.style_prompt || null : result.brandDescription.trim(),
        infographic_md: action('infographicGuidelines') === 'skip' ? oldProfile?.infographic_md || null : result.infographicGuidelines.trim(),
      }, { onConflict: 'brand_id' })
      if (profileError) throw profileError
    }

    if (action('infographicLayouts') === 'replace') {
      const { error } = await supabase.from('infographic_layouts').delete().eq('brand_id', brandId)
      if (error) throw error
    }
    if (action('staticLayouts') === 'replace') {
      const { data: categories, error } = await supabase.from('reference_categories').select('id').eq('brand_id', brandId)
      if (error) throw error
      const ids = (categories || []).map(row => row.id)
      if (ids.length) {
        const { error: layoutsError } = await supabase.from('reference_layouts').delete().in('category_id', ids)
        if (layoutsError) throw layoutsError
      }
      const { error: categoriesError } = await supabase.from('reference_categories').delete().eq('brand_id', brandId)
      if (categoriesError) throw categoriesError
    }
    if (action('editableTemplates') === 'replace') {
      const { error } = await supabase.from('overlay_templates').delete().eq('brand_id', brandId)
      if (error) throw error
    }
    if (action('carouselLayouts') === 'replace') {
      const { data: layouts, error } = await supabase.from('carousel_layouts').select('id').eq('brand_id', brandId)
      if (error) throw error
      const ids = (layouts || []).map(row => row.id)
      if (ids.length) {
        const { error: slidesError } = await supabase.from('carousel_slide_prompts').delete().in('layout_id', ids)
        if (slidesError) throw slidesError
      }
      const { error: layoutsError } = await supabase.from('carousel_layouts').delete().eq('brand_id', brandId)
      if (layoutsError) throw layoutsError
    }
    if (action('infographicLayouts') === 'skip') result.infographicLayouts = []
    if (action('staticLayouts') === 'skip') result.staticLayouts = []
    if (action('editableTemplates') === 'skip') result.editableTemplates = []
    if (action('carouselLayouts') === 'skip') result.carouselLayouts = []

    const requestedInfographicRows = result.infographicLayouts.map((layout, index) => ({
      brand_id: brandId,
      name: safeName(layout.name, `${brand.name} Infographic Layout ${index + 1}`),
      description: layout.description.trim(),
      image_url: null,
      logo_url: null,
      is_active: layout.isActive,
    }))
    const { data: existingInfographicRows, error: existingInfographicError } = await supabase
      .from('infographic_layouts')
      .select('name,description')
      .eq('brand_id', brandId)
    if (existingInfographicError) throw existingInfographicError

    const existingInfographicKeys = new Set(
      (existingInfographicRows || []).map(row => `${row.name}\u0000${row.description || ''}`)
    )
    const infographicRows = requestedInfographicRows.filter(
      row => !existingInfographicKeys.has(`${row.name}\u0000${row.description}`)
    )
    if (requestedInfographicRows.some(row => !row.description)) throw new Error('An infographic layout description is empty.')
    if (infographicRows.length) {
      const { data: infographicData, error: infographicError } = await supabase
        .from('infographic_layouts')
        .insert(infographicRows)
        .select('id')
      if (infographicError) throw infographicError
      createdInfographicIds.push(...(infographicData || []).map(row => row.id))
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
    const requestedStaticRows = result.staticLayouts.map((layout, index) => ({
      name: safeName(layout.name, `Static Layout ${index + 1}`),
      prompt: sanitizeBackgroundAssetPrompt(
        layout.prompt.trim(),
        result.editableTemplates[index]?.puppeteerConfig,
        { requireCompleteVisualModules: true }
      ),
    }))
    if (requestedStaticRows.some(row => !row.prompt)) throw new Error('A static layout prompt is empty.')
    const { data: existingStaticRows, error: existingStaticError } = await supabase
      .from('reference_layouts')
      .select('name,prompt,reference_categories!inner(brand_id)')
      .eq('reference_categories.brand_id', brandId)
    if (existingStaticError) throw existingStaticError
    const existingStaticKeys = new Set(
      (existingStaticRows || []).map(row => `${row.name}\u0000${row.prompt || ''}`)
    )
    const staticRows = requestedStaticRows.filter(
      row => !existingStaticKeys.has(`${row.name}\u0000${row.prompt}`)
    )
    let category: { id: string } | null = null
    if (staticRows.length) {
      const { data: newCategory, error: categoryError } = await supabase
        .from('reference_categories')
        .insert({ label: `AI Brand Setup ${timestamp}`, is_global: false, brand_id: brandId })
        .select('id')
        .single()
      if (categoryError || !newCategory) throw categoryError || new Error('Could not create static layout category.')
      category = newCategory
      createdCategoryIds.push(category.id)
      const { error: staticError } = await supabase.from('reference_layouts').insert(
        staticRows.map(row => ({ ...row, category_id: category!.id }))
      )
      if (staticError) throw staticError
    }

    const requestedEditableRows = result.editableTemplates.map((template, index) => ({
      brand_id: brandId,
      name: safeName(`AI ${timestamp} · ${template.name}`, `AI ${timestamp} · Editable Layout ${index + 1}`),
      bg_prompt: sanitizeBackgroundAssetPrompt(
        template.bgPrompt,
        template.puppeteerConfig,
        { requireCompleteVisualModules: true }
      ),
      puppeteer_config: {
        ...template.puppeteerConfig,
        brandSetupVersion: 3,
        brandSetupGeneratedAt: timestamp,
      },
    }))
    if (requestedEditableRows.some(row => !row.bg_prompt)) throw new Error('An editable background prompt is empty.')
    const { data: existingEditableRows, error: existingEditableError } = await supabase
      .from('overlay_templates')
      .select('name,bg_prompt')
      .eq('brand_id', brandId)
    if (existingEditableError) throw existingEditableError
    const baseTemplateName = (name: string) => name.replace(/^AI\s+[^·]+\s+·\s*/, '').trim().toLowerCase()
    const existingEditableKeys = new Set(
      (existingEditableRows || []).map(row => `${baseTemplateName(row.name)}\u0000${row.bg_prompt || ''}`)
    )
    const editableRows = requestedEditableRows.filter(
      row => !existingEditableKeys.has(`${baseTemplateName(row.name)}\u0000${row.bg_prompt}`)
    )
    if (editableRows.length) {
      const { data: editableData, error: editableError } = await supabase
        .from('overlay_templates')
        .insert(editableRows)
        .select('id')
      if (editableError) throw editableError
      createdOverlayIds.push(...(editableData || []).map(row => row.id))
    }

    const { data: existingCarouselRows, error: existingCarouselError } = await supabase
      .from('carousel_layouts')
      .select('name')
      .eq('brand_id', brandId)
    if (existingCarouselError) throw existingCarouselError
    const baseCarouselName = (name: string) => name.replace(/^AI\s+[^·]+\s+·\s*/, '').trim().toLowerCase()
    const existingCarouselNames = new Set(
      (existingCarouselRows || []).map(row => baseCarouselName(row.name))
    )

    for (let layoutIndex = 0; layoutIndex < result.carouselLayouts.length; layoutIndex++) {
      const layout = result.carouselLayouts[layoutIndex]
      const layoutName = safeName(layout.name, `Carousel ${layoutIndex + 1}`)
      if (existingCarouselNames.has(baseCarouselName(layoutName))) continue
      const { data: carousel, error: carouselError } = await supabase
        .from('carousel_layouts')
        .insert({ brand_id: brandId, name: layoutName })
        .select('id')
        .single()
      if (carouselError || !carousel) throw carouselError || new Error('Could not create carousel layout.')
      createdCarouselIds.push(carousel.id)

      const slideRows = [...layout.slides]
        .sort((a, b) => a.slideIndex - b.slideIndex)
        .map((slide, slideIndex) => ({
          layout_id: carousel.id,
          slide_index: slideIndex + 1,
          prompt: sanitizeBackgroundAssetPrompt(slide.prompt, slide.puppeteerConfig),
          puppeteer_config: normalizeCarouselConfig(slide.puppeteerConfig),
        }))
      if (slideRows.some(row => !row.prompt)) throw new Error('A carousel slide prompt is empty.')
      const { error: slidesError } = await supabase.from('carousel_slide_prompts').insert(slideRows)
      if (slidesError) throw slidesError
    }

    if (body.jobId && /^[0-9a-f-]{36}$/i.test(body.jobId)) {
      await supabase.from('brand_system_jobs').update({
        status: 'complete',
        current_stage: 'saved to brand',
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq('id', body.jobId).eq('brand_id', brandId)
    }

    return NextResponse.json({
      ok: true,
      brandId,
      created: {
        staticCategoryId: category?.id || null,
        staticLayouts: staticRows.length,
        infographicLayouts: createdInfographicIds.length,
        editableTemplates: editableRows.length,
        carouselLayouts: createdCarouselIds.length,
        carouselSlides: result.carouselLayouts.reduce((sum, layout) => sum + layout.slides.length, 0),
      },
    })
  } catch (error) {
    // Roll back only rows created by this request. Existing brand configuration is restored.
    if (createdCarouselIds.length) {
      await supabase.from('carousel_slide_prompts').delete().in('layout_id', createdCarouselIds)
      await supabase.from('carousel_layouts').delete().in('id', createdCarouselIds)
    }
    if (createdInfographicIds.length) await supabase.from('infographic_layouts').delete().in('id', createdInfographicIds)
    if (createdOverlayIds.length) await supabase.from('overlay_templates').delete().in('id', createdOverlayIds)
    if (createdCategoryIds.length) {
      await supabase.from('reference_layouts').delete().in('category_id', createdCategoryIds)
      await supabase.from('reference_categories').delete().in('id', createdCategoryIds)
    }
    if (brandId) {
      if (profileExisted && previousProfile) {
        await supabase.from('brand_profiles').update(previousProfile).eq('brand_id', brandId)
      } else {
        await supabase.from('brand_profiles').delete().eq('brand_id', brandId)
      }
    }
    return NextResponse.json({ error: (error as Error).message || 'Could not save brand setup.' }, { status: 500 })
  }
}
