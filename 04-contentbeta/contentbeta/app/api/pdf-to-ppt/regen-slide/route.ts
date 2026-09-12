import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { PPT_SLIDE_TEMPLATES } from '@/lib/ppt/slide-templates'
import { createClient } from '@supabase/supabase-js'
import { jsonrepair } from 'jsonrepair'

export const maxDuration = 60

const OR_KEY = process.env.OPENROUTER_API_KEY!
const MODEL  = 'google/gemini-2.5-flash'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseJson(text: string): unknown {
  let t = text.trim()
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const s = t.indexOf('{'); const e = t.lastIndexOf('}')
  if (s !== -1 && e !== -1) t = t.slice(s, e + 1)
  try { return JSON.parse(t) } catch { return JSON.parse(jsonrepair(t)) }
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const { newRole, originalSlide, deckTitle, brandId, allSlides } = await req.json() as {
      newRole: string
      originalSlide: Record<string, unknown>
      deckTitle: string
      brandId?: string
      allSlides?: Array<Record<string, unknown>>
    }

    if (!newRole || !originalSlide) {
      return NextResponse.json({ error: 'newRole and originalSlide required' }, { status: 400 })
    }

    const template = PPT_SLIDE_TEMPLATES.find(t => t.name === newRole)
    if (!template) {
      return NextResponse.json({ error: `Unknown template: ${newRole}` }, { status: 400 })
    }

    // Load brand-specific prompt override — this is critical for custom layouts
    // that use different field names than the default template prompt
    let promptText = template.promptText
    if (brandId) {
      const { data } = await supabase
        .from('ppt_slide_templates')
        .select('prompt_text')
        .eq('brand_id', brandId)
        .eq('template_name', newRole)
        .maybeSingle()
      if ((data as { prompt_text?: string } | null)?.prompt_text) {
        promptText = (data as { prompt_text: string }).prompt_text
      }
    }

    // Build a compact deck summary so the AI knows the full narrative
    const deckSummary = allSlides?.length
      ? allSlides.map((s, i) => {
          const role = String(s.role ?? s.template ?? '')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const title = String((s as any).title ?? (s as any).quote ?? (s as any).stat ?? '')
          return `  ${i + 1}. [${role}] ${title}`
        }).join('\n')
      : null

    const systemPrompt = `You are an expert presentation designer. Rewrite a single slide's content to fit a new slide template, drawing from the full presentation context provided.

Rules:
- Output ONLY a valid JSON object with the content fields listed in the template spec
- Every field mentioned in the template spec MUST be present in your output with real, meaningful content — never null, never empty string
- Do NOT include "template", "id", "sequence", "role", or any structural keys
- Field names must exactly match those in the template spec (including backtick-wrapped names if shown)
- For array fields, always output a non-empty array
- A doughnut/pie chart must preserve every source slice and contain at least 2 segments; a one-segment solid ring is invalid
- When a source slide contains two doughnut/pie panels, preserve both in a "charts" array with one complete object per panel`

    const userPrompt = `Deck title: "${deckTitle}"
${deckSummary ? `\nFull slide outline:\n${deckSummary}\n` : ''}
Original slide being replaced:
${JSON.stringify(originalSlide, null, 2)}

Target template: ${newRole}
Template spec (defines exactly which fields to output):
${promptText}

Rewrite the slide to fit the target template. Use the full deck context above to write relevant, specific content — not placeholder text. Output ONLY the JSON object.`

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://contentbeta.app',
        'X-Title': 'ContentBeta Slide Regen',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    })

    if (!orRes.ok) {
      const t = await orRes.text().catch(() => '')
      throw new Error(`OpenRouter error (${orRes.status}): ${t.slice(0, 300)}`)
    }

    const orData = await orRes.json() as { choices: { message: { content: string } }[] }
    const content = orData.choices?.[0]?.message?.content ?? '{}'
    const parsed = parseJson(content) as Record<string, unknown>

    if (newRole === 'chart_doughnut') {
      const parseSegments = (value: unknown): Array<{ label: string; value: number }> => {
        const rawSegments = Array.isArray(value) ? value as Array<Record<string, unknown>> : []
        return rawSegments.map(item => {
          const numeric = Number(String(item.value ?? item.amount ?? item.percentage ?? '').replace(/[^0-9.+-]/g, ''))
          return {
            label: String(item.label ?? item.category ?? item.name ?? ''),
            value: numeric,
          }
        }).filter(item => item.label && Number.isFinite(item.value))
      }

      const rawCharts = Array.isArray(parsed.charts) ? parsed.charts as Array<Record<string, unknown>> : []
      const charts = rawCharts.map((chart, index) => ({
        title: String(chart.title ?? chart.heading ?? chart.label ?? `Chart ${index + 1}`),
        segments: parseSegments(chart.segments ?? chart.doughnutData ?? chart.data),
        centerValue: chart.centerValue ?? chart.centerKpi,
        centerLabel: chart.centerLabel ?? chart.centerKpiLabel,
      }))

      if (charts.length > 1) {
        if (charts.some(chart => chart.segments.length < 2)) {
          return NextResponse.json({
            error: 'The regenerated slide lost doughnut segments. Each chart panel needs at least two source slices.',
          }, { status: 422 })
        }
        parsed.charts = charts
        parsed.segments = charts[0].segments
        parsed.doughnutData = charts[0].segments
      }

      const segments = charts.length > 1
        ? charts[0].segments
        : parseSegments(
          Array.isArray(parsed.doughnutData) ? parsed.doughnutData
            : Array.isArray(parsed.segments) ? parsed.segments
              : []
        )

      if (segments.length < 2) {
        return NextResponse.json({
          error: 'The regenerated slide produced a one-color doughnut. Run it again so every source slice is preserved.',
        }, { status: 422 })
      }

      parsed.segments = segments
      parsed.doughnutData = segments
      const rows = Array.isArray(parsed.comparisonData) ? parsed.comparisonData : []
      const scalar = (value: unknown) =>
        value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value)
      const scalarComparison = rows.length > 0 && rows.every(row => {
        if (Array.isArray(row)) return row.every(scalar)
        if (!row || typeof row !== 'object') return false
        return Object.values(row as Record<string, unknown>).every(scalar)
      })
      const maxColumns = rows.reduce((max, row) => {
        if (Array.isArray(row)) return Math.max(max, row.length)
        if (!row || typeof row !== 'object') return max
        return Math.max(max, Object.keys(row as Record<string, unknown>).length)
      }, 0)
      const validComparison = scalarComparison && maxColumns >= 2
      if (!validComparison) {
        parsed.comparisonData = segments.map(item => ({
          Response: item.label,
          Share: `${item.value}%`,
        }))
      }
    }

    return NextResponse.json({ slide: parsed })
  } catch (err) {
    console.error('Regen slide error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
