import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse'
import { jsonrepair } from 'jsonrepair'
import { PPT_SLIDE_TEMPLATES, getEnabledTemplates } from '@/lib/ppt/slide-templates'
import { publicUrlFromFilePath, deleteMedia } from '@/lib/imagekit'

// Common variations the AI uses instead of our exact template names
const TEMPLATE_ALIASES: Record<string, string> = {
  cover:             'cover_hero',
  cover_slide:       'cover_hero',
  hero:              'cover_hero',
  title:             'cover_hero',
  title_slide:       'cover_hero',
  section:           'section_divider',
  divider:           'section_divider',
  section_break:     'section_divider',
  bullet:            'bullets',
  bullet_points:     'bullets',
  bullets_list:      'bullets',
  key_points:        'bullets',
  two_columns:       'two_column',
  two_col:           'two_column',
  dual_column:       'two_column',
  split:             'two_column',
  stat:              'stat_callout',
  statistic:         'stat_callout',
  big_number:        'stat_callout',
  callout:           'stat_callout',
  kpi:               'kpi_grid',
  metrics:           'kpi_grid',
  kpis:              'kpi_grid',
  dashboard:         'kpi_grid',
  image:             'image_body',
  image_text:        'image_body',
  image_content:     'image_body',
  photo:             'image_body',
  quote:             'quote_attribution',
  testimonial:       'quote_attribution',
  chart:             'chart_bar',
  bar_chart:         'chart_bar',
  bar:               'chart_bar',
  vertical_bar:      'chart_bar',
  column_chart:      'chart_bar',
  doughnut:          'chart_doughnut',
  donut:             'chart_doughnut',
  pie:               'chart_doughnut',
  pie_chart:         'chart_doughnut',
  donut_chart:       'chart_doughnut',
  table:             'data_table',
  data_table_slide:  'data_table',
  matrix:            'data_table',
  comparison_table:  'data_table',
  cards:             'card_grid',
  card:              'card_grid',
  feature_grid:      'card_grid',
  icon_grid:         'card_grid',
  capability_grid:   'card_grid',
  closing:           'closing_cta',
  close:             'closing_cta',
  cta:               'closing_cta',
  conclusion:        'closing_cta',
  thank_you:         'closing_cta',
  end:               'closing_cta',
}

export const maxDuration = 300

const OR_KEY = process.env.OPENROUTER_API_KEY!
const MODEL  = 'google/gemini-2.5-flash'
const MAX_SLIDES = 20

const SOURCE_LAYOUT_RULES = `
## Source Page and Layout Fidelity

The uploaded PDF itself is attached to the request. Inspect its pages visually; do not rely only on extracted text.

1. Add "sourcePage" (1-based integer) to every slide.
2. Keep slides in the same order as their source pages.
3. If the PDF is already a presentation or uses slide-like 16:9 pages, preserve EXACTLY one output slide per source page. Every sourcePage from 1 through the PDF page count must appear exactly once. Do not merge, drop, duplicate, or invent pages.
4. Do not add an agenda, section divider, transition, summary, or closing slide unless that page actually exists in the source PDF. A source content page must never be preceded by an invented slide repeating the same title.
5. Match each source page's information architecture with the closest available template:
   - use data_table for real tables, matrices, and dense row/column comparisons;
   - use card_grid for feature, capability, ecosystem, roadmap, or process-card grids;
   - use kpi_grid for compact groups of numeric metrics;
   - use chart_bar or chart_doughnut only when the source page contains chartable numeric data;
   - use two_column only for a true two-part composition;
   - use bullets only when the source page is genuinely a simple list.
6. A page containing 2-6 prominent numeric metrics must use kpi_grid (or an appropriate chart), never an empty bullets slide. Put every visible number and its label into kpis.
7. Preserve the dominant visual hierarchy: title, section label, data grouping, callout, insight, and source note.
8. Never turn a table, metric group, or multi-card source page into a mostly empty stat_callout or generic bullets slide.
9. Every required array for the selected template must contain the visible source content. Never return bullets without bullets, kpi_grid without kpis, card_grid without cards, or a chart without data.
10. Do not invent imagery. For an existing presentation PDF, use image_body only when the source page itself is image-led. A page containing a chart, graph, table, KPI, percentage comparison, or other data visualisation must use a structured chart/table/KPI template. Never recreate source data, charts, tables, dashboards, or UI inside a generated image.
11. Use grouped bar-chart "series" for multiple comparable datasets. If one source page contains two unrelated charts, return a "charts" array with one complete chart object per panel so the backend can preserve both as a structured table.
12. Table rows must use no more than 8 concise logical columns. Never flatten cell coordinates or row labels into object property names.
13. For chart_doughnut, "doughnutData" or "segments" must be a flat array of {"label":"...","value":number}. If the layout also asks for "comparisonData", every cell in comparisonData must be a string or number; never put an array or object inside a table cell.
14. A requested comparisonData table must preserve every visible comparison column and value from the source. A one-column comparisonData table is incomplete and invalid.
15. A doughnut or pie chart must contain EVERY source slice and at least 2 segments. A one-segment doughnut is invalid. When centerValue is a percentage, the segments must describe the complete whole and sum to approximately 100.
16. If a source page contains two doughnut/pie panels, keep both on the same output slide using "charts": [{"title":"Panel title","segments":[{"label":"...","value":number}],"centerValue":"...","centerLabel":"..."}]. Never collapse two charts into one headline percentage.
17. Count repeated source blocks before choosing a template. Preserve every visible block as one card. If a page has 3-8 titled blocks, use card_grid and return the same number of cards; never flatten card titles, descriptions, and sub-bullets into long bullet strings.
`

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function loadPrompt(name: string) {
  return fs.readFileSync(path.join(process.cwd(), 'lib', 'ppt-prompts', name), 'utf8')
}

function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()

  // The model may return either {"slides":[...]} or a top-level slide array.
  // The old parser always cropped from the first "{" to the last "}", which
  // turned a valid top-level array into `object, object` and produced
  // "Unexpected character ','".
  const objectStart = cleaned.indexOf('{')
  const arrayStart = cleaned.indexOf('[')
  const starts = [objectStart, arrayStart].filter(index => index >= 0)
  const firstJsonStart = starts.length ? Math.min(...starts) : -1
  const opening = firstJsonStart >= 0 ? cleaned[firstJsonStart] : ''
  const closing = opening === '[' ? ']' : '}'
  const lastJsonEnd = opening ? cleaned.lastIndexOf(closing) : -1

  const candidates = Array.from(new Set([
    cleaned,
    firstJsonStart >= 0 && lastJsonEnd >= firstJsonStart
      ? cleaned.slice(firstJsonStart, lastJsonEnd + 1)
      : '',
  ].filter(Boolean)))

  let lastError: unknown
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch (error) {
      lastError = error
    }
    try {
      return JSON.parse(jsonrepair(candidate))
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`The generated slide plan was not valid JSON: ${String(lastError)}`)
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json() as { storagePath: string; brandId: string; brandName: string }
    const { storagePath, brandId = '', brandName = '' } = body
    if (!storagePath) return NextResponse.json({ error: 'storagePath required' }, { status: 400 })

    // Download PDF from ImageKit (client uploaded via /api/media/upload)
    const pdfUrl = publicUrlFromFilePath(storagePath)
    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) {
      return NextResponse.json({ error: `Failed to download PDF: ${pdfRes.status}` }, { status: 500 })
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    // Delete the temp upload regardless of outcome
    deleteMedia({ filePath: storagePath }).catch(() => {})

    // Fetch brand data server-side
    let brandGuidelines = ''
    let brandScrap = ''
    let enabledTemplateNames: string[] | null = null
    if (brandId) {
      const { data } = await supabase
        .from('brand_profiles')
        .select('ppt_md,style_prompt,brand_scrap,ppt_enabled_templates')
        .eq('brand_id', brandId)
        .maybeSingle()
      const row = data as { ppt_md?: string; style_prompt?: string; brand_scrap?: string; ppt_enabled_templates?: string[] | null } | null
      brandGuidelines = row?.ppt_md || row?.style_prompt || ''
      brandScrap = row?.brand_scrap || ''
      enabledTemplateNames = row?.ppt_enabled_templates ?? null
    }

    const templates = getEnabledTemplates(enabledTemplateNames)

    // Fetch per-brand prompt and layout overrides together. Returning layouts with
    // the plan prevents a converter tab from using stale admin JSON.
    let promptOverrides: Record<string, string> = {}
    let layoutOverrides: Record<string, unknown> = {}
    if (brandId) {
      const { data: overrideRows } = await supabase
        .from('ppt_slide_templates')
        .select('template_name,prompt_text,layout_config')
        .eq('brand_id', brandId)
      if (overrideRows) {
        for (const row of overrideRows as { template_name: string; prompt_text: string; layout_config?: string | Record<string, unknown> | null }[]) {
          if (row.prompt_text) promptOverrides[row.template_name] = row.prompt_text
          if (row.layout_config) {
            try {
              const parsed = typeof row.layout_config === 'string'
                ? JSON.parse(row.layout_config)
                : row.layout_config
              if (
                parsed
                && typeof parsed === 'object'
                && typeof (parsed as { background?: unknown }).background === 'string'
                && Array.isArray((parsed as { elements?: unknown }).elements)
              ) {
                layoutOverrides[row.template_name] = parsed
              }
            } catch (error) {
              console.error(`[plan] Ignoring invalid layout_config for ${row.template_name}:`, error)
            }
          }
        }
      }
    }

    const templatesText = templates
      .map(t => promptOverrides[t.name]
        ? `### ${t.name} — ${t.displayName}${t.isCover ? ' [COVER]' : ''}${t.isClosing ? ' [CLOSING]' : ''}\n${promptOverrides[t.name]}`
        : t.promptText)
      .join('\n\n')

    let pdfText = ''
    let pdfPageTexts: string[] = []
    let pdfPageItems: Array<Array<{ text: string; fontSize: number; x: number; y: number }>> = []
    let pageCount = 0
    try {
      const pdfData = await pdfParse(pdfBuffer, {
        pagerender: async (pageData: {
          getTextContent: (options: {
            normalizeWhitespace: boolean
            disableCombineTextItems: boolean
          }) => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>
        }) => {
          const textContent = await pageData.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false,
          })
          const pageItems = textContent.items
            .map(item => ({
              text: String(item.str ?? '').trim(),
              fontSize: Math.abs(Number(item.transform?.[3] ?? item.transform?.[0] ?? 0)),
              x: Number(item.transform?.[4] ?? 0),
              y: Number(item.transform?.[5] ?? 0),
            }))
            .filter(item => item.text)
          pdfPageItems.push(pageItems)
          const pageText = pageItems
            .map(item => item.text)
            .filter(Boolean)
            .join(' ')
          pdfPageTexts.push(pageText)
          return pageText
        },
      })
      pageCount = pdfData.numpages ?? 0
      pdfText = (pdfData.text ?? '')
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        // Collapse runs of 3+ blank lines to 2 (common in design-tool PDFs)
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim()
    } catch {
      pdfText = ''
      pdfPageTexts = []
      pdfPageItems = []
    }

    const wordCount = (pdfText.match(/[a-zA-Z]{2,}/g) ?? []).length
    const hasUsableText = wordCount >= 30

    // Cap at ~80 000 chars (~20 000 tokens) to stay well inside Gemini's attention window.
    // Beyond this the model starts losing content from the middle of the document.
    const TEXT_CAP = 80_000
    const textTruncated = pdfText.length > TEXT_CAP
    if (textTruncated) pdfText = pdfText.slice(0, TEXT_CAP)

    console.log(`[plan] PDF pages=${pageCount} extractedChars=${pdfText.length} words=${wordCount} truncated=${textTruncated} hasUsableText=${hasUsableText}`)

    // Brand-specific override → global DB override → file fallback.
    const { data: promptRow } = await supabase
      .from('ppt_system_prompts')
      .select('content')
      .eq('name', 'plan_system')
      .maybeSingle()
    const rawSystemPrompt = promptOverrides['_plan_system']
      || (promptRow as { content?: string } | null)?.content
      || loadPrompt('plan-v2.txt')

    const maxSlides = MAX_SLIDES

    const systemPrompt = rawSystemPrompt
      .replace('{{BRAND_NAME}}', brandName || 'Brand')
      .replace('{{BRAND_GUIDELINES}}', brandGuidelines || '')
      .replace('{{BRAND_SCRAP}}', brandScrap || '')
      .replace('{{MAX_SLIDES}}', String(maxSlides))
      .replace('{{TEMPLATES}}', templatesText)
      + SOURCE_LAYOUT_RULES

    const userContent = hasUsableText
      ? `The attached PDF has ${pageCount} pages. Here is extracted text to support exact copy and data fidelity${textTruncated ? ` (first ${TEXT_CAP} characters)` : ''}:\n\n${pdfText}\n\nInspect the attached PDF visually as well. Convert it into a presentation deck plan covering every meaningful source page. Return ONLY valid JSON.`
      : `The attached PDF has ${pageCount} pages. Inspect every page visually and convert it into a presentation deck plan. Return ONLY valid JSON.`

    const safeFilename = path.basename(storagePath).replace(/^\d+_/, '') || 'source.pdf'
    const messages: unknown[] = [{
      role: 'user',
      content: [
        { type: 'text', text: userContent },
        {
          type: 'file',
          file: {
            filename: safeFilename,
            file_data: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
          },
        },
      ],
    }]

    const payload = {
      model: MODEL,
      max_tokens: 16000,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://contentbeta.app',
        'X-Title': 'ContentBeta PDF to PPT',
      },
      body: JSON.stringify(payload),
    })

    if (!orRes.ok) {
      const t = await orRes.text().catch(() => '')
      throw new Error(`OpenRouter error (${orRes.status}): ${t.slice(0, 300)}`)
    }

    const orData = await orRes.json() as { choices: { message: { content: string } }[] }
    const content = orData.choices?.[0]?.message?.content ?? '{}'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = parseJson(content) as Record<string, any>

    const validTemplateNames = new Set(PPT_SLIDE_TEMPLATES.map(t => t.name))

    // AI sometimes wraps slides under an unexpected top-level key.
    // Walk all common locations, then fall back to scanning every root value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractSlides = (p: any): any[] => {
      if (!p) return []
      if (Array.isArray(p.slides)) return p.slides
      if (Array.isArray(p.deck?.slides)) return p.deck.slides
      if (Array.isArray(p.presentation?.slides)) return p.presentation.slides
      if (Array.isArray(p.plan?.slides)) return p.plan.slides
      if (Array.isArray(p)) return p
      // Scan every top-level object value for a nested "slides" array
      // (handles keys like "styled_presentation", "deck_plan", "output", etc.)
      for (const val of Object.values(p)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nested = (val as any).slides
          if (Array.isArray(nested) && nested.length > 0) return nested
        }
      }
      // Last resort: grab the only array-valued key at root
      const arrays = Object.values(p).filter(Array.isArray) as unknown[][]
      if (arrays.length === 1) return arrays[0] as any[]
      return []
    }

    const resolveTemplateName = (raw: string | undefined): string | null => {
      if (!raw) return null
      // Normalise spaces and dashes to underscores for fuzzy matching
      const lower = raw.toLowerCase().replace(/[-\s]/g, '_')
      if (validTemplateNames.has(lower)) return lower
      return TEMPLATE_ALIASES[lower] ?? null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getRaw = (s: any): string | undefined =>
      s.template || s.role || s.type || s.layout || s.archetype || s.layout_variant || s.slide_type || s.variant || s.kind

    const normaliseTitle = (value: unknown): string =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

    const plainNumber = (value: unknown): number => {
      if (typeof value === 'number') return value
      const cleaned = String(value ?? '').replace(/[^0-9.+-]/g, '')
      return cleaned ? Number(cleaned) : Number.NaN
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normaliseDoughnutSegments = (source: any): Array<{ label: string; value: number }> => {
      const nested = source?.chartData ?? source?.chart_data ?? source?.chart ?? source?.data ?? {}
      const candidates = source?.segments
        ?? source?.doughnutData
        ?? source?.doughnut_data
        ?? nested?.segments
        ?? nested?.doughnutData
        ?? nested?.doughnut_data
        ?? nested?.data
        ?? source?.items
        ?? source?.values
      if (!Array.isArray(candidates)) return []
      if (candidates.every(item => item && typeof item === 'object')) {
        return candidates.map((item: any) => ({
          label: String(item.label ?? item.category ?? item.name ?? ''),
          value: plainNumber(item.value ?? item.amount ?? item.percentage),
        })).filter((item: { label: string; value: number }) => item.label && Number.isFinite(item.value))
      }
      if (Array.isArray(source?.categories) && source.categories.length === candidates.length) {
        return candidates.map((value: unknown, index: number) => ({
          label: String(source.categories[index]),
          value: plainNumber(value),
        })).filter((item: { value: number }) => Number.isFinite(item.value))
      }
      return []
    }

    const humaniseKey = (value: string): string =>
      value
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b([a-z])/g, letter => letter.toUpperCase())
        .trim()

    // Rebuild cross-tabs when the model encodes every cell into a property key,
    // e.g. row_Under_$200,000_2025_Customers. Without this pass, a logical
    // four-column table becomes 20–30 unusably narrow columns.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reshapeEncodedRows = (rawRows: any[]): any[] | null => {
      const objectRows = rawRows.filter(row => row && typeof row === 'object' && !Array.isArray(row))
      if (objectRows.length !== rawRows.length || objectRows.length === 0) return null
      const allKeys = Array.from(new Set(objectRows.flatMap(row => Object.keys(row))))
      const headerKeys = allKeys.filter(key => key.startsWith('header_'))
      const rowKeys = allKeys.filter(key => key.startsWith('row_'))
      if (headerKeys.length === 0 || rowKeys.length === 0) return null

      const headers = headerKeys.map(key => {
        const token = key.slice('header_'.length)
        const value = objectRows.map(row => row[key]).find(Boolean)
        return { token, label: String(value ?? humaniseKey(token)) }
      }).sort((a, b) => b.token.length - a.token.length)

      const rows: Record<string, unknown>[] = []
      objectRows.forEach(row => {
        const category = String(row.category ?? row.Category ?? row.section ?? row.Section ?? '')
        const grouped = new Map<string, Record<string, unknown>>()
        Object.entries(row).forEach(([key, value]) => {
          if (!key.startsWith('row_')) return
          const encoded = key.slice('row_'.length)
          const header = headers.find(item => encoded.endsWith(`_${item.token}`))
          if (!header) return
          const metric = humaniseKey(encoded.slice(0, -(header.token.length + 1)))
          const target = grouped.get(metric) ?? { Category: category, Metric: metric }
          target[header.label] = value
          grouped.set(metric, target)
        })
        rows.push(...Array.from(grouped.values()))
      })
      return rows.length > 0 ? rows : null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normaliseBarChart = (s: any): void => {
      const nested = s.chartData ?? s.chart_data ?? s.chart ?? s.data ?? {}
      const rawRows = Array.isArray(nested) ? nested : null
      if (!Array.isArray(s.categories) || s.categories.length === 0) {
        s.categories = s.labels
          ?? nested.categories
          ?? nested.labels
          ?? nested.xAxis?.categories
          ?? nested.x_axis?.categories
          ?? (rawRows ? rawRows.map(row => row?.label ?? row?.category).filter(Boolean) : [])
      }

      const rawSeries = s.series
        ?? s.datasets
        ?? nested.series
        ?? nested.datasets
      if (Array.isArray(rawSeries) && rawSeries.length > 0) {
        s.series = rawSeries.map((series: any, index: number) => {
          const points = Array.isArray(series?.values)
            ? series.values
            : Array.isArray(series?.data) ? series.data : []
          if ((!Array.isArray(s.categories) || s.categories.length === 0) && points.every((point: any) => point && typeof point === 'object')) {
            s.categories = points.map((point: any) => point.label ?? point.category ?? '').filter(Boolean)
          }
          return {
            name: String(series?.name ?? series?.label ?? `Series ${index + 1}`),
            values: points
              .map((point: any) => plainNumber(point && typeof point === 'object' ? point.value : point))
              .filter(Number.isFinite),
            ...(series?.color ? { color: String(series.color) } : {}),
          }
        }).filter((series: { values: number[] }) => series.values.length > 0)
      }

      if (!Array.isArray(s.values) || s.values.length === 0) {
        const candidates = nested.values
          ?? nested.chartValues
          ?? s.chartValues
          ?? (rawRows ? rawRows.map(row => row?.value) : [])
        if (Array.isArray(candidates)) s.values = candidates.map(plainNumber).filter(Number.isFinite)
      } else {
        s.values = s.values.map(plainNumber).filter(Number.isFinite)
      }
      if ((!Array.isArray(s.values) || s.values.length === 0) && Array.isArray(s.series) && s.series.length > 0) {
        s.values = s.series[0].values
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartRows = (charts: any[]): Record<string, unknown>[] => {
      const rows: Record<string, unknown>[] = []
      charts.forEach((chart, chartIndex) => {
        const copy = { ...chart }
        normaliseBarChart(copy)
        const categories = Array.isArray(copy.categories) ? copy.categories.map(String) : []
        const series = Array.isArray(copy.series) && copy.series.length > 0
          ? copy.series
          : [{ name: copy.seriesName ?? 'Value', values: copy.values ?? [] }]
        categories.forEach((category: string, categoryIndex: number) => {
          const row: Record<string, unknown> = {
            Section: String(chart.title ?? chart.heading ?? `Chart ${chartIndex + 1}`),
            Category: category,
          }
          series.forEach((item: any, seriesIndex: number) => {
            row[String(item.name || `Series ${seriesIndex + 1}`)] = item.values?.[categoryIndex] ?? ''
          })
          rows.push(row)
        })
      })
      const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
      return rows.map(row => Object.fromEntries(columns.map(column => [column, row[column] ?? ''])))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normaliseSlideFields = (s: any, resolved: string): string => {
      if (resolved === 'agenda' && (!Array.isArray(s.items) || s.items.length === 0)) {
        s.items = s.sections ?? s.bullets ?? s.points ?? []
      }

      if (resolved === 'bullets' && (!Array.isArray(s.bullets) || s.bullets.length === 0)) {
        const aliases = [s.items, s.points, s.keyPoints, s.key_points, s.takeaways]
        const replacement = aliases.find(Array.isArray)
        if (replacement) s.bullets = replacement
      }

      if (resolved === 'two_column') {
        if (!Array.isArray(s.leftBullets)) {
          s.leftBullets = s.leftItems ?? s.left_items ?? s.columnOne ?? s.column_one ?? []
        }
        if (!Array.isArray(s.rightBullets)) {
          s.rightBullets = s.rightItems ?? s.right_items ?? s.columnTwo ?? s.column_two ?? []
        }
      }

      if (resolved === 'kpi_grid' && (!Array.isArray(s.kpis) || s.kpis.length === 0)) {
        s.kpis = s.metrics ?? s.stats ?? s.items ?? []
      }

      if (resolved === 'card_grid' && (!Array.isArray(s.cards) || s.cards.length === 0)) {
        s.cards = s.items ?? s.features ?? s.capabilities ?? []
      }

      if (resolved === 'timeline' && (!Array.isArray(s.steps) || s.steps.length === 0)) {
        s.steps = s.items ?? s.milestones ?? s.stages ?? []
      }

      if (resolved === 'comparison') {
        s.leftItems = s.leftItems ?? s.left_items ?? s.leftBullets ?? s.left_bullets ?? []
        s.rightItems = s.rightItems ?? s.right_items ?? s.rightBullets ?? s.right_bullets ?? []
      }

      if (resolved === 'stat_callout' && !String(s.stat ?? '').trim()) {
        s.stat = s.value ?? s.metric ?? s.number ?? ''
        s.statLabel = s.statLabel ?? s.label ?? s.metricLabel ?? s.metric_label
      }

      if (resolved === 'data_table') {
        if (!Array.isArray(s.rows) || s.rows.length === 0) {
          const nestedRows = s.tableData?.rows ?? s.table_data?.rows ?? s.data?.rows ?? s.data
          if (Array.isArray(nestedRows)) s.rows = nestedRows
        }
        if (Array.isArray(s.rows)) {
          const reshaped = reshapeEncodedRows(s.rows)
          if (reshaped) s.rows = reshaped
        }
      }

      if (resolved === 'chart_bar') {
        const nestedCharts = s.charts ?? s.chartGroups ?? s.chart_groups
        if (Array.isArray(nestedCharts) && nestedCharts.length > 1) {
          const rows = chartRows(nestedCharts)
          if (rows.length > 0) {
            s.rows = rows
            return 'data_table'
          }
        }
        normaliseBarChart(s)
      }

      if (resolved === 'chart_doughnut') {
        const nestedCharts = s.charts ?? s.chartGroups ?? s.chart_groups
        if (Array.isArray(nestedCharts) && nestedCharts.length > 1) {
          s.charts = nestedCharts.map((chart: any, index: number) => {
            const segments = normaliseDoughnutSegments(chart)
            return {
              title: String(chart.title ?? chart.heading ?? chart.label ?? `Chart ${index + 1}`),
              segments,
              centerValue: chart.centerValue ?? chart.centerKpi ?? chart.center_value,
              centerLabel: chart.centerLabel ?? chart.centerKpiLabel ?? chart.center_label,
            }
          })
          const firstCompleteChart = s.charts.find((chart: { segments?: unknown[] }) =>
            Array.isArray(chart.segments) && chart.segments.length > 0
          )
          if (firstCompleteChart) {
            s.segments = firstCompleteChart.segments
            s.doughnutData = firstCompleteChart.segments
          }
        }

        if (!Array.isArray(s.segments) || s.segments.length === 0) {
          // Per-brand layouts commonly use doughnutData because the same slide may
          // also contain a comparisonData table. Treat it as the canonical segment
          // array instead of rejecting an otherwise complete custom-layout slide.
          s.segments = normaliseDoughnutSegments(s)
        }

        if (Array.isArray(s.segments) && s.segments.length > 0) {
          // Keep both aliases in sync. Custom layouts can bind their chart or
          // legend to doughnutData while the standard layout reads segments.
          s.doughnutData = s.segments

          // A nested object/array in comparisonData becomes "[object Object]" in
          // both the browser preview and PowerPoint. Replace only malformed or
          // missing comparison tables with a clean scalar view of the chart data.
          const comparisonRows = Array.isArray(s.comparisonData) ? s.comparisonData : []
          const tableCellIsScalar = (value: unknown): boolean =>
            value === null
            || value === undefined
            || ['string', 'number', 'boolean'].includes(typeof value)
          const comparisonIsScalar = comparisonRows.length > 0 && comparisonRows.every((row: unknown) => {
            if (Array.isArray(row)) return row.every(tableCellIsScalar)
            if (!row || typeof row !== 'object') return false
            return Object.values(row as Record<string, unknown>).every(tableCellIsScalar)
          })
          if (!comparisonIsScalar) {
            s.comparisonData = s.segments.map((segment: { label: unknown; value: unknown }) => ({
              Response: String(segment.label ?? ''),
              Share: `${plainNumber(segment.value)}%`,
            }))
          }
        }
      }

      return resolved
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processSlides = (rawSlides: any[]): any[] => {
      // Gemini occasionally invents a transition immediately before the real
      // source slide and repeats its title. Prefer the richer source slide so an
      // actual PDF page is not pushed out by the slide cap.
      const transitionRoles = new Set(['section_divider', 'agenda'])
      const withoutDuplicateTransitions = rawSlides.filter((slide, i) => {
        const next = rawSlides[i + 1]
        if (!next) return true
        const currentRole = resolveTemplateName(getRaw(slide))
        const nextRole = resolveTemplateName(getRaw(next))
        const currentTitle = normaliseTitle(slide.title ?? slide.headline ?? slide.sectionTitle)
        const nextTitle = normaliseTitle(next.title ?? next.headline ?? next.sectionTitle)
        return !(
          currentTitle
          && currentTitle === nextTitle
          && currentRole
          && nextRole
          && transitionRoles.has(currentRole)
          && !transitionRoles.has(nextRole)
        )
      })

      // Find the closing slide anywhere in the raw list so it survives the slide cap.
      const closingIdx = (() => {
        for (let i = withoutDuplicateTransitions.length - 1; i >= 0; i--) {
          if (resolveTemplateName(getRaw(withoutDuplicateTransitions[i])) === 'closing_cta') return i
        }
        return -1
      })()
      const closingSlide = closingIdx !== -1 ? withoutDuplicateTransitions[closingIdx] : null
      const nonClosing = closingSlide
        ? withoutDuplicateTransitions.filter((_, i) => i !== closingIdx)
        : withoutDuplicateTransitions

      // Cap non-closing slides to leave room for closing
      const out = closingSlide
        ? [...nonClosing.slice(0, maxSlides - 1), closingSlide]
        : nonClosing.slice(0, maxSlides)

      out.forEach((s, i) => {
        // IDs and sequences describe the final deck, not the pre-cap AI result.
        s.id = `slide_${i + 1}`
        s.sequence = i + 1
        const sourcePage = Number(s.sourcePage ?? s.source_page ?? i + 1)
        s.sourcePage = Number.isFinite(sourcePage) && sourcePage > 0 ? Math.round(sourcePage) : i + 1
        let resolved = resolveTemplateName(getRaw(s))
        const metricAlias = [s.kpis, s.metrics, s.stats].find(
          value => Array.isArray(value) && value.length > 0
        )
        if (
          resolved === 'bullets'
          && (!Array.isArray(s.bullets) || s.bullets.length === 0)
          && metricAlias
        ) {
          resolved = 'kpi_grid'
          s.kpis = metricAlias
        }
        if (resolved) {
          resolved = normaliseSlideFields(s, resolved)
          s.role = resolved
          s.template = resolved
        }
      })
      return out.filter((s: { role: string }) => validTemplateNames.has(s.role))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const structuralSlideContentIssue = (s: any): string | null => {
      const nonEmpty = (value: unknown): boolean =>
        Array.isArray(value) && value.some(item => {
          if (item === null || item === undefined) return false
          if (typeof item === 'object') return Object.values(item as Record<string, unknown>).some(Boolean)
          return String(item).trim().length > 0
        })

      switch (s.role) {
        case 'agenda':
          return nonEmpty(s.items) ? null : 'agenda has no items'
        case 'bullets': {
          if (!nonEmpty(s.bullets)) return 'bullets slide has no bullets'
          const containsNestedBlocks = s.bullets.some((item: unknown) => {
            const copy = String(item ?? '')
            const lines = copy.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
            const words = copy.match(/[A-Za-z0-9]+/g)?.length ?? 0
            return lines.length >= 3 || words > 22
          })
          return containsNestedBlocks
            ? 'nested titled blocks were flattened into long bullets; use card_grid and preserve every source block as one card'
            : null
        }
        case 'two_column':
          return nonEmpty(s.leftBullets) || nonEmpty(s.rightBullets) ? null : 'two-column slide has no column content'
        case 'stat_callout':
          return String(s.stat ?? '').trim() ? null : 'stat callout has no statistic'
        case 'kpi_grid':
          return nonEmpty(s.kpis) ? null : 'KPI grid has no metrics'
        case 'data_table': {
          if (!nonEmpty(s.rows)) return 'table has no rows'
          const first = s.rows.find((row: unknown) => row && typeof row === 'object' && !Array.isArray(row))
          const colCount = first ? Object.keys(first).length : 0
          return colCount > 8 ? `table still has ${colCount} columns; reorganize to 8 or fewer` : null
        }
        case 'card_grid':
          return nonEmpty(s.cards) ? null : 'card grid has no cards'
        case 'timeline':
          return nonEmpty(s.steps) ? null : 'timeline has no steps'
        case 'comparison':
          return nonEmpty(s.leftItems ?? s.leftBullets) || nonEmpty(s.rightItems ?? s.rightBullets)
            ? null
            : 'comparison has no left or right items'
        case 'chart_bar': {
          const categories = nonEmpty(s.categories)
          const values = nonEmpty(s.values)
          const series = nonEmpty(s.series)
          return categories && (values || series) ? null : 'bar chart has no usable categories and numeric data'
        }
        case 'chart_doughnut': {
          const chartPanels = Array.isArray(s.charts) && s.charts.length > 1 ? s.charts : null
          const panels = chartPanels ?? [{
            segments: s.segments,
            centerValue: s.centerValue ?? s.centerKpi,
          }]
          for (let index = 0; index < panels.length; index++) {
            const segments = Array.isArray(panels[index]?.segments) ? panels[index].segments : []
            if (segments.length < 2) {
              return `${chartPanels ? `doughnut panel ${index + 1}` : 'doughnut chart'} has fewer than 2 segments; preserve every source slice`
            }
            const values = segments
              .map((segment: { value?: unknown }) => plainNumber(segment?.value))
              .filter(Number.isFinite)
            const total = values.reduce((sum: number, value: number) => sum + value, 0)
            const centerValue = String(panels[index]?.centerValue ?? '')
            if (centerValue.includes('%') && Math.abs(total - 100) > 1) {
              return `${chartPanels ? `doughnut panel ${index + 1}` : 'doughnut chart'} is incomplete; percentage segments total ${total} instead of 100`
            }
          }
          if (Array.isArray(s.comparisonData)) {
            if (!nonEmpty(s.comparisonData)) return 'comparison table has no rows'
            const maxColumns = s.comparisonData.reduce((max: number, row: unknown) => {
              if (Array.isArray(row)) return Math.max(max, row.length)
              if (!row || typeof row !== 'object') return max
              return Math.max(max, Object.keys(row as Record<string, unknown>).length)
            }, 0)
            if (maxColumns < 2) {
              return 'comparison table has only one column; preserve every source comparison column and value'
            }
          }

          const sourcePage = Math.max(1, Math.round(plainNumber(s.sourcePage) || 1))
          const sourcePageText = pdfPageTexts[sourcePage - 1] || ''
          const sourcePercentages = Array.from(
            new Set(
              Array.from(sourcePageText.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g))
                .map(match => Number(match[1]))
                .filter(Number.isFinite),
            ),
          )
          const sourcePercentageItems = (pdfPageItems[sourcePage - 1] ?? [])
            .filter(item => /-?\d+(?:\.\d+)?\s*%/.test(item.text))
          const sourceHasTwoPeerPercentagePanels =
            sourcePercentageItems.length >= 6 &&
            Math.max(...sourcePercentageItems.map(item => item.fontSize), 0) < 24 &&
            sourcePercentageItems.some(item => item.x < 400) &&
            sourcePercentageItems.some(item => item.x > 500)
          if (sourceHasTwoPeerPercentagePanels && !chartPanels) {
            return 'source page contains two peer percentage/doughnut panels; preserve both using the "charts" array rather than collapsing one panel into a table or single chart'
          }
          if (sourcePercentages.length >= 3) {
            const outputValues: number[] = []
            const collectNumbers = (value: unknown): void => {
              if (typeof value === 'number' && Number.isFinite(value)) {
                outputValues.push(value)
                return
              }
              if (typeof value === 'string') {
                for (const match of Array.from(value.matchAll(/-?\d+(?:\.\d+)?/g))) {
                  const parsed = Number(match[0])
                  if (Number.isFinite(parsed)) outputValues.push(parsed)
                }
                return
              }
              if (Array.isArray(value)) {
                value.forEach(collectNumbers)
                return
              }
              if (value && typeof value === 'object') {
                Object.values(value as Record<string, unknown>).forEach(collectNumbers)
              }
            }

            ;[
              s.segments,
              s.charts,
              s.doughnutData,
              s.comparisonData,
              s.centerValue,
              s.centerKpi,
              s.insight,
              s.subtitle,
            ].forEach(collectNumbers)

            const missingPercentages = sourcePercentages.filter(
              sourceValue =>
                !outputValues.some(outputValue => Math.abs(outputValue - sourceValue) < 0.05),
            )
            if (missingPercentages.length > 0) {
              return `doughnut slide is missing source percentage values (${missingPercentages
                .map(value => `${value}%`)
                .join(', ')}); preserve every chart panel, slice, comparison value, and percentage-based insight`
            }
          }
          return null
        }
        case 'image_body': {
          const copy = [
            s.title,
            s.subtitle,
            s.body,
            s.caption,
            s.imagePrompt,
          ].map(value => String(value ?? '')).join(' ')
          if (/\d+(?:\.\d+)?\s*%/.test(copy)) {
            return 'image-body is wrong for a percentage/data source page; use a structured chart, table, or KPI layout'
          }
          return String(s.body ?? '').trim() || String(s.imageUrl ?? '').trim()
            ? null
            : 'image/body slide has no body or image'
        }
        case 'quote_attribution':
          return String(s.quote ?? '').trim() ? null : 'quote slide has no quote'
        default:
          return null
      }
    }

    const normaliseSourceToken = (value: string): string =>
      value.toLowerCase().replace(/[^a-z0-9%$€£+×x.]+/g, ' ').replace(/\s+/g, ' ').trim()

    // Compare repair candidates quantitatively. This prevents a later model
    // attempt from replacing a detailed slide with a simpler but still
    // structurally valid divider/stat slide.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceFidelityScore = (s: any): number => {
      if (structuralSlideContentIssue(s)) return Number.NEGATIVE_INFINITY
      const sourcePage = Math.max(1, Math.round(plainNumber(s.sourcePage) || 1))
      const sourceItems = pdfPageItems[sourcePage - 1] ?? []
      if (sourceItems.length === 0) return 0

      const outputParts: string[] = []
      const ignoredKeys = new Set(['id', 'sequence', 'sourcePage', 'template', 'role', 'imagePrompt', 'imageUrl'])
      const collect = (value: unknown, key = ''): void => {
        if (ignoredKeys.has(key)) return
        if (typeof value === 'number' && Number.isFinite(value)) outputParts.push(String(value))
        else if (typeof value === 'string') outputParts.push(value)
        else if (Array.isArray(value)) value.forEach(item => collect(item, key))
        else if (value && typeof value === 'object') {
          Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => collect(child, childKey))
        }
      }
      collect(s)
      const outputText = normaliseSourceToken(outputParts.join(' '))
      const outputNumbers = Array.from(outputText.matchAll(/-?\d[\d,]*(?:\.\d+)?/g))
        .map(match => Number(match[0].replace(/,/g, '')))
        .filter(Number.isFinite)

      const metricValues = sourceItems.flatMap(item =>
        Array.from(item.text.matchAll(/(?:[$€£]\s*)?-?\d[\d,]*(?:\.\d+)?\s*(?:%|[x×]|[KMB]\+?|\+)?/gi))
          .map(match => {
            const raw = match[0].trim()
            const value = Number((raw.match(/-?\d[\d,]*(?:\.\d+)?/)?.[0] ?? '').replace(/,/g, ''))
            const hasUnit = /[%x×$€£KMB+]/i.test(raw)
            const looksLikeYear = value >= 1900 && value <= 2100
            const isPageNumber = value === sourcePage && item.fontSize < 12
            return Number.isFinite(value) && (hasUnit || (item.fontSize >= 16 && !looksLikeYear && !isPageNumber))
              ? value
              : Number.NaN
          })
          .filter(Number.isFinite),
      )
      const uniqueMetrics = Array.from(new Set(metricValues))
      const metricCoverage = uniqueMetrics.length === 0
        ? 1
        : uniqueMetrics.filter(sourceValue =>
            outputNumbers.some(outputValue => Math.abs(outputValue - sourceValue) < 0.05),
          ).length / uniqueMetrics.length

      const prominentPhrases = sourceItems
        .filter(item =>
          item.fontSize >= 12 &&
          item.text.length >= 7 &&
          item.text.length <= 100 &&
          item.text.split(/\s+/).length >= 2 &&
          item.text.split(/\s+/).length <= 10 &&
          !/^\d+$/.test(item.text),
        )
        .map(item => normaliseSourceToken(item.text))
        .filter((phrase, index, all) => phrase && all.indexOf(phrase) === index)
      const phraseCoverage = prominentPhrases.length === 0
        ? 1
        : prominentPhrases.filter(phrase => {
            const words = phrase.split(' ').filter(word => word.length > 2)
            return words.length === 0 || words.filter(word => outputText.includes(word)).length / words.length >= 0.72
          }).length / prominentPhrases.length

      const sourceIsDense = prominentPhrases.length >= 4 || uniqueMetrics.length >= 4
      const simplificationPenalty =
        sourceIsDense && ['section_divider', 'stat_callout', 'cover'].includes(String(s.role))
          ? 500
          : 0
      const densityBonus = Math.min(outputText.length, 3000) / 300
      return metricCoverage * 1000 + phraseCoverage * 300 + densityBonus - simplificationPenalty
    }

    const sourceFidelityIssue = (s: any): string | null => {
      const sourcePage = Math.max(1, Math.round(plainNumber(s.sourcePage) || 1))
      const sourceItems = pdfPageItems[sourcePage - 1] ?? []
      if (sourceItems.length === 0) return null

      const outputParts: string[] = []
      const ignoredKeys = new Set(['id', 'sequence', 'sourcePage', 'template', 'role', 'imagePrompt', 'imageUrl'])
      const collectOutput = (value: unknown, key = ''): void => {
        if (ignoredKeys.has(key)) return
        if (typeof value === 'number' && Number.isFinite(value)) {
          outputParts.push(String(value))
        } else if (typeof value === 'string') {
          outputParts.push(value)
        } else if (Array.isArray(value)) {
          value.forEach(item => collectOutput(item, key))
        } else if (value && typeof value === 'object') {
          Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => collectOutput(child, childKey))
        }
      }
      collectOutput(s)
      const outputText = normaliseSourceToken(outputParts.join(' '))
      const outputNumbers = Array.from(outputText.matchAll(/-?\d[\d,]*(?:\.\d+)?/g))
        .map(match => Number(match[0].replace(/,/g, '')))
        .filter(Number.isFinite)

      const sourceMetrics: Array<{ raw: string; value: number }> = []
      for (const item of sourceItems) {
        for (const match of Array.from(item.text.matchAll(/(?:[$€£]\s*)?-?\d[\d,]*(?:\.\d+)?\s*(?:%|[x×]|[KMB]\+?|\+)?/gi))) {
          const raw = match[0].trim()
          const numeric = Number((raw.match(/-?\d[\d,]*(?:\.\d+)?/)?.[0] ?? '').replace(/,/g, ''))
          if (!Number.isFinite(numeric)) continue
          const hasUnit = /[%x×$€£KMB+]/i.test(raw)
          const looksLikeYear = numeric >= 1900 && numeric <= 2100
          const isPageNumber = numeric === sourcePage && item.fontSize < 12
          if (hasUnit || (item.fontSize >= 16 && !looksLikeYear && !isPageNumber)) {
            sourceMetrics.push({ raw, value: numeric })
          }
        }
      }
      const uniqueMetrics = sourceMetrics.filter((metric, index, all) =>
        all.findIndex(candidate => candidate.raw.toLowerCase() === metric.raw.toLowerCase()) === index,
      )
      const missingMetrics = uniqueMetrics.filter(metric =>
        !outputNumbers.some(value => Math.abs(value - metric.value) < 0.05),
      )
      if (missingMetrics.length > 0) {
        return `slide is missing prominent source metrics (${missingMetrics.slice(0, 12).map(item => item.raw).join(', ')}); preserve every important number, comparison, and chart value`
      }

      if (s.role === 'chart_doughnut') {
        const groups = new Map<string, string[]>()
        for (const item of sourceItems) {
          const label = item.text.trim()
          if (
            item.fontSize < 8 || item.fontSize > 20 ||
            label.length < 2 || label.length > 44 ||
            /\d/.test(label) || label.split(/\s+/).length > 5
          ) continue
          const key = `${Math.round(item.x / 12)}:${Math.round(item.fontSize)}`
          const group = groups.get(key) ?? []
          if (!group.some(existing => normaliseSourceToken(existing) === normaliseSourceToken(label))) group.push(label)
          groups.set(key, group)
        }
        const sourceLabels = Array.from(groups.values())
          .filter(group => group.length >= 3)
          .sort((a, b) => b.length - a.length)[0] ?? []
        const panels = Array.isArray(s.charts) && s.charts.length
          ? s.charts
          : [{ segments: s.segments ?? s.doughnutData }]
        const outputLabels: string[] = panels.flatMap((panel: any): string[] =>
          Array.isArray(panel?.segments)
            ? panel.segments.map((segment: any) => String(segment?.label ?? segment?.name ?? '')).filter(Boolean)
            : [],
        )
        if (sourceLabels.length >= 3) {
          const missingLabels = sourceLabels.filter(sourceLabel =>
            !outputLabels.some(outputLabel => {
              const source = normaliseSourceToken(sourceLabel)
              const output = normaliseSourceToken(outputLabel)
              return source === output || source.includes(output) || output.includes(source)
            }),
          )
          if (missingLabels.length > Math.max(1, Math.floor(sourceLabels.length * 0.25))) {
            return `doughnut chart is missing source legend categories (${missingLabels.join(', ')}); preserve every visible slice and label`
          }
        }
      }

      const prominentPhrases = sourceItems
        .filter(item =>
          item.fontSize >= 12 &&
          item.text.length >= 7 &&
          item.text.length <= 100 &&
          item.text.split(/\s+/).length >= 2 &&
          item.text.split(/\s+/).length <= 10 &&
          !/^\d+$/.test(item.text),
        )
        .map(item => item.text)
        .filter((phrase, index, all) =>
          all.findIndex(candidate => normaliseSourceToken(candidate) === normaliseSourceToken(phrase)) === index,
        )
      if (prominentPhrases.length >= 4) {
        const covered = prominentPhrases.filter(phrase => {
          const words = normaliseSourceToken(phrase).split(' ').filter(word => word.length > 2)
          if (words.length === 0) return true
          const matched = words.filter(word => outputText.includes(word)).length
          return matched / words.length >= 0.72
        })
        if (covered.length / prominentPhrases.length < 0.58) {
          return `slide omits too many prominent source headings or blocks (${covered.length}/${prominentPhrases.length} retained); preserve all visible cards, labels, and key statements`
        }
      }
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slideContentIssue = (s: any): string | null =>
      structuralSlideContentIssue(s) ?? sourceFidelityIssue(s)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectContentIssues = (slides: any[]): Array<{ index: number; sourcePage: number; title: string; issue: string }> =>
      slides.flatMap((slide, index) => {
        const issue = slideContentIssue(slide)
        return issue ? [{
          index,
          sourcePage: Number(slide.sourcePage ?? index + 1),
          title: String(slide.title ?? ''),
          issue,
        }] : []
      })

    let validSlides = processSlides(extractSlides(parsed))

    // Retry once if the AI returned unrecognised template names
    if (validSlides.length === 0) {
      const rawSlides = extractSlides(parsed)
      console.error('[plan] 0 valid slides after alias resolution. parsed keys:', Object.keys(parsed),
        '| rawSlides count:', rawSlides.length,
        rawSlides[0]
          ? `| first slide keys: ${Object.keys(rawSlides[0]).join(',')} | template: ${rawSlides[0].template ?? rawSlides[0].role ?? rawSlides[0].type ?? rawSlides[0].layout ?? rawSlides[0].archetype ?? rawSlides[0].layout_variant ?? 'none'}`
          : '| (empty array)')
      if (rawSlides.length > 0) {
        console.error('[plan] all archetypes/templates:', rawSlides.map((s: any) =>
          s.template ?? s.role ?? s.archetype ?? s.layout_variant ?? s.type ?? s.layout ?? '?'
        ).join(', '))
      }

      const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OR_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://contentbeta.app',
          'X-Title': 'ContentBeta PDF to PPT',
        },
        body: JSON.stringify({
          ...payload,
          messages: [
            ...payload.messages as object[],
            { role: 'assistant', content },
            { role: 'user', content: `The slide "template" values must exactly match one of: ${Array.from(validTemplateNames).join(', ')}. Rewrite the JSON using only those exact template names.` },
          ],
        }),
      })
      if (retryRes.ok) {
        const retryData = await retryRes.json() as { choices: { message: { content: string } }[] }
        const retryContent = retryData.choices?.[0]?.message?.content ?? '{}'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const retryParsed = parseJson(retryContent) as Record<string, any>
        validSlides = processSlides(extractSlides(retryParsed))
        console.error('[plan] After retry: validSlides count:', validSlides.length)
      }
    }

    // A recognised template can still render as an empty slide when its required
    // content is missing or hidden under an unexpected field. Retry only those
    // malformed cases, keeping the PDF and original response in context.
    let contentIssues = collectContentIssues(validSlides)
    for (let repairAttempt = 1; validSlides.length > 0 && contentIssues.length > 0 && repairAttempt <= 3; repairAttempt++) {
      console.error(`[plan] Repair attempt ${repairAttempt} for incomplete slides:`, contentIssues)
      const correction = contentIssues
        .map(item => `- sourcePage ${item.sourcePage}, "${item.title}": ${item.issue}`)
        .join('\n')
      const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OR_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://contentbeta.app',
          'X-Title': 'ContentBeta PDF to PPT',
        },
        body: JSON.stringify({
          ...payload,
          messages: [
            ...payload.messages as object[],
            // Feed the latest accepted plan back on every pass. This lets later
            // repairs build on pages fixed by earlier passes instead of
            // repeatedly starting from the original incomplete response.
            { role: 'assistant', content: JSON.stringify({ slides: validSlides }) },
            {
              role: 'user',
              content: `The JSON is structurally incomplete or uses the wrong layout on these source pages:\n${correction}\n\nRewrite the full JSON. Preserve exactly the same source-page order and slide count, but change the selected template when the issue explicitly says it is wrong. Do not rewrite, simplify, or reinterpret pages that are not listed above; copy their JSON unchanged. For every listed page, inspect the attached PDF again and supply all required structured data. Count every visible card, table column, chart panel, chart slice, legend label, prominent number, and comparison before writing JSON. Never reduce a multi-block or data-rich source page to one statistic or a generic bullet list. Multi-series bar charts must use "categories" plus "series": [{"name":"...","values":[plain numbers]}]. A single doughnut chart must use flat "segments" or "doughnutData": [{"label":"...","value":plain number}] with at least 2 segments; when its center is a percentage, all slices must sum to approximately 100. A page with two doughnut/pie panels must use "charts": [{"title":"Panel title","segments":[{"label":"...","value":plain number}],"centerValue":"...","centerLabel":"..."}], preserving both panels and every slice. If comparisonData is requested, every table cell must be a string or number—never a nested array or object. A repeated-block page must use card_grid with one card for every visible source block; never flatten card titles, descriptions, and sub-bullets into long bullet strings. Tables must use concise logical columns (maximum 8); never encode individual cells into property names. Never recreate source data or charts inside a generated image. Return only valid JSON.`,
            },
          ],
        }),
      })
      if (retryRes.ok) {
        const retryData = await retryRes.json() as { choices: { message: { content: string } }[] }
        const retryContent = retryData.choices?.[0]?.message?.content ?? '{}'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const retryParsed = parseJson(retryContent) as Record<string, any>
        const retrySlides = processSlides(extractSlides(retryParsed))
        if (retrySlides.length === validSlides.length) {
          // Only replace pages that failed validation. This makes retries
          // non-destructive: already-correct slides remain byte-for-byte
          // equivalent at the JSON planning layer.
          const affectedPages = new Set(contentIssues.map(item => item.sourcePage))
          const retryByPage = new Map(
            retrySlides.map((slide: any, index: number) => [
              Number(slide.sourcePage ?? index + 1),
              slide,
            ]),
          )
          const mergedSlides = validSlides.map((slide: any, index: number) => {
            const sourcePage = Number(slide.sourcePage ?? index + 1)
            if (!affectedPages.has(sourcePage)) return slide
            const candidate = retryByPage.get(sourcePage)
            if (!candidate || structuralSlideContentIssue(candidate)) return slide
            return sourceFidelityScore(candidate) > sourceFidelityScore(slide)
              ? candidate
              : slide
          })
          const retryIssues = collectContentIssues(mergedSlides)
          validSlides = mergedSlides
          contentIssues = retryIssues
        }
      }
    }

    if (validSlides.length === 0) {
      return NextResponse.json({ error: 'Could not extract slides from this PDF.' }, { status: 422 })
    }
    const structuralIssues = validSlides.flatMap((slide: any, index: number) => {
      const issue = structuralSlideContentIssue(slide)
      return issue ? [{
        index,
        sourcePage: Number(slide.sourcePage ?? index + 1),
        title: String(slide.title ?? ''),
        issue,
      }] : []
    })
    if (structuralIssues.length > 0) {
      console.error('[plan] Pages still structurally invalid after targeted repairs:', structuralIssues)
      return NextResponse.json({
        error: 'Error reading pdf, please try again',
        details: structuralIssues.map(item => ({
          sourcePage: item.sourcePage,
          reason: item.issue,
        })),
      }, { status: 422 })
    }
    if (contentIssues.length > 0) {
      console.warn('[plan] Returning structurally complete deck with fidelity warnings:', contentIssues)
    }

    // Title may be nested under the same wrapper key the AI used
    const deckTitle = parsed.title
      ?? Object.values(parsed).map((v: any) => v?.title).find(Boolean)
      ?? brandName
    return NextResponse.json({
      title: deckTitle,
      slides: validSlides,
      layoutOverrides,
      warnings: contentIssues.map(item => ({
        sourcePage: item.sourcePage,
        reason: item.issue,
      })),
    })
  } catch (err) {
    console.error('Plan route error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
