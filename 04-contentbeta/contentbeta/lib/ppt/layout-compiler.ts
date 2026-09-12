import type { SlideSpec, BrandTokens, RenderPlan } from './types'
import { getLayout } from './roles/index'
import { fitText } from './text-fit'
import type { JsonSlideLayout } from './layout-schema'

function isImportantNumber(content: string): boolean {
  const compact = content.trim().replace(/\s+/g, ' ')
  if (!compact || compact.length > 24) return false
  return /^(?:[+\-]?\s*)?(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:%|[x×]|[KMB]\+?|\+))?(?:\s*[–—-]\s*(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:%|[x×]|[KMB]\+?|\+))?)?$/i.test(compact)
}

function usesHeadlineFont(id: string, content: string): boolean {
  const key = id.toLowerCase()
  const supportingElement =
    /(card|panel|table|comparison|column|step|agenda|legend|label|body|copy|caption|eyebrow|kicker|subtitle|description|bullet|insight)/.test(key)
  const primaryHeading =
    !supportingElement && /(?:^|_)(?:title|headline|main_heading|main_title)(?:_|$)/.test(key)
  const numericValue =
    isImportantNumber(content) &&
    !/(label|body|copy|caption|description|bullet)/.test(key)
  return primaryHeading || numericValue
}

export async function compileSlide(
  spec: SlideSpec,
  tokens: BrandTokens,
  pageNumber: number,
  layoutOverride?: JsonSlideLayout
): Promise<RenderPlan> {
  const layoutDef = getLayout(spec.role)
  if (!layoutDef) throw new Error(`Unknown role: ${spec.role}`)

  const { background, elements } = layoutDef.compile(spec, tokens, spec.id, pageNumber, layoutOverride)

  // Enforce the brand's semantic two-font system centrally so every layout,
  // including AI-generated layouts, exports with the same typography rules.
  for (const el of elements) {
    if (el.type === 'chart' && el.chart) {
      el.chart.headlineFont = tokens.headlineFont
      el.chart.bodyFont = tokens.bodyFont
    }
    if (el.type === 'text' && el.text) {
      el.text.fontFamily = usesHeadlineFont(el.id, el.text.content)
        ? tokens.headlineFont
        : tokens.bodyFont
    }
  }

  // Run text fitting on all text elements
  for (const el of elements) {
    if (el.type === 'text' && el.text && el.text.overflow === 'fitted') {
      const result = await fitText({
        text: el.text.content,
        boundsW: el.bounds.w,
        boundsH: el.bounds.h,
        fontFamily: el.text.fontFamily,
        fontSizePt: el.text.fontSizePt,
        fontWeight: el.text.fontWeight,
        lineHeightMultiplier: el.text.lineHeightMultiplier,
        uppercase: el.text.uppercase,
      })
      el.text.fittedSizePt = result.fittedSizePt
      el.text.lines = result.lines
    }
  }

  // Sort by z-index
  elements.sort((a, b) => a.z - b.z)

  return { slideId: spec.id, background, elements }
}

export async function compileDeck(
  slides: SlideSpec[],
  tokens: BrandTokens,
  onProgress?: (done: number, total: number) => void,
  layoutOverrides?: Record<string, JsonSlideLayout>
): Promise<RenderPlan[]> {
  const plans: RenderPlan[] = []
  for (let i = 0; i < slides.length; i++) {
    const override = layoutOverrides?.[slides[i].role]
    plans.push(await compileSlide(slides[i], tokens, i + 1, override))
    onProgress?.(i + 1, slides.length)
  }
  return plans
}
