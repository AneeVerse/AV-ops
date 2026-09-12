import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const maxDuration = 60

const OR_KEY = process.env.OPENROUTER_API_KEY!
const MODEL  = 'google/gemini-2.5-flash'

interface ChartRequest {
  type: 'bar' | 'doughnut'
  title: string
  categories: string[]
  values: number[]
  centerValue?: string
  centerLabel?: string
  unitSuffix?: string
  insight?: string
  primaryColor: string
  accentColors: string[]
  textColor: string
  bgColor: string
  w: number   // viewBox width  (pixels at 144dpi)
  h: number   // viewBox height (pixels at 144dpi)
}

function buildPrompt(req: ChartRequest): string {
  const palette = [req.primaryColor, ...req.accentColors].slice(0, 6)

  const doughnutSpec = req.type === 'doughnut' ? `
Segments (label → value):
${req.categories.map((c, i) => `  "${c}": ${req.values[i]}`).join('\n')}
${req.centerValue ? `Center value: ${req.centerValue}` : ''}
${req.centerLabel ? `Center label: ${req.centerLabel}` : ''}
${req.insight    ? `Insight text (render below chart): "${req.insight}"` : ''}
` : ''

  const barSpec = req.type === 'bar' ? `
Bars (label → value):
${req.categories.map((c, i) => `  "${c}": ${req.values[i]}${req.unitSuffix ?? ''}`).join('\n')}
` : ''

  const barW_approx  = Math.round(req.w * 0.07)
  const padL = Math.round(req.w * 0.08)
  const padR = Math.round(req.w * 0.03)
  const padT = Math.round(req.h * 0.12)
  const padB = Math.round(req.h * 0.18)
  const chartH = req.h - padT - padB
  const fVal = Math.round(req.h * 0.040)
  const fCat = Math.round(req.h * 0.032)
  const fAxis = Math.round(req.h * 0.026)

  // Cap radius so ring outer edge (r + strokeWidth/2) stays within viewBox with margin
  const doughnutR = Math.round(Math.min(req.w * 0.34, req.h * 0.36))
  const cx = Math.round(req.w * 0.38)
  const cy = Math.round(req.h * 0.50)
  const strokeW = Math.round(doughnutR * 0.40)
  const legendX = Math.round(req.w * 0.70)
  const fLeg = Math.round(req.h * 0.032)

  return `You are a data-visualization engineer. Generate a single self-contained SVG for a ${req.type} chart.

SVG dimensions: viewBox="0 0 ${req.w} ${req.h}" width="${req.w}" height="${req.h}"
Transparent root background — do NOT add a background rect.

## BRAND COLORS — use ONLY these exact hex values, no others
- Brand primary (main bar fill / first segment): ${req.primaryColor}
- Segment palette (doughnut only, in order): ${palette.join(', ')}
- Text / labels: ${req.textColor}
- Slide background: ${req.bgColor}

## Data
${req.type === 'doughnut' ? doughnutSpec : barSpec}

${req.type === 'bar' ? `## Bar chart — exact specs
Layout:
  padLeft=${padL}px  padRight=${padR}px  padTop=${padT}px  padBottom=${padB}px
  Chart area height: ${chartH}px
  Approx bar width: ${barW_approx}px each, centered in equal-width groups

Bars:
- ALL bars fill: ${req.primaryColor} (same color for every bar — do NOT use different colors per bar)
- Alternate bars at opacity 0.78 for visual rhythm, primary bars at 1.0
- Rounded top corners rx=${Math.round(barW_approx * 0.08)}
- Bars grow from bottom (y = padTop + chartHeight) upward

Gridlines:
- 4 horizontal grid lines at 25%, 50%, 75%, 100% of max value
- Stroke: rgba(0,0,0,0.08), strokeWidth=1.5
- Y-axis tick labels left of padLeft, fontSize=${fAxis}, color=${req.textColor} opacity=0.45
- Y-axis values: nice round numbers up to ~15% above max data value

Labels:
- Value labels ABOVE each bar: bold, fontSize=${fVal}, color=${req.primaryColor}
- Category labels BELOW x-axis: fontSize=${fCat}, color=${req.textColor} opacity=0.65
- Baseline: a horizontal line at bottom of chart area, stroke=${req.textColor} opacity=0.15 width=2

No legend needed. No border or frame. No drop shadows.` : `## Doughnut chart — exact specs
Ring:
- Center: (${cx}, ${cy})
- Radius: ${doughnutR}px
- Ring strokeWidth: ${strokeW}px (thick ring style)
- Track circle: stroke=rgba(0,0,0,0.07), same radius and strokeWidth
- Use strokeLinecap="butt", small gap between segments (~0.8% of circumference)
- Start first segment at top (strokeDashoffset = circumference/4)
- Colors in order: ${palette.join(', ')}

Center hole text (if provided):
- centerValue: bold, fontSize=${Math.round(req.h * 0.07)}, fill=${req.textColor}, centered at (${cx}, ${cy})
- centerLabel: below value, fontSize=${fLeg}, fill=${req.textColor} opacity=0.55

Right-side legend at x=${legendX}:
- One row per segment, row height ~${Math.round(req.h * 0.09)}px
- Colored square (${Math.round(fLeg * 0.72)}px) + segment name + right-aligned value
- fontSize=${fLeg}, fill=${req.textColor}

${req.insight ? `Insight text at bottom center: "${req.insight}"
- fontSize=${fAxis}, fill=${req.textColor} opacity=0.55, fontStyle=italic` : ''}`}

Rules:
- Clean, minimal — no gradients, no drop shadows, no decorative borders
- All text legible against ${req.bgColor} background
- font-family: sans-serif on all text elements
- Do NOT include <title>, <desc>, XML declaration, DOCTYPE, or namespace attributes beyond xmlns
- Output ONLY the raw SVG element. No markdown fences. No explanation.`
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json() as ChartRequest

    const prompt = buildPrompt(body)

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://contentbeta.app',
        'X-Title': 'ContentBeta PDF to PPT Chart',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!orRes.ok) {
      const t = await orRes.text().catch(() => '')
      throw new Error(`OpenRouter error (${orRes.status}): ${t.slice(0, 200)}`)
    }

    const data = await orRes.json() as { choices: { message: { content: string } }[] }
    let svg = data.choices?.[0]?.message?.content?.trim() ?? ''

    // Strip markdown fences if AI wrapped it
    svg = svg.replace(/^```(?:svg|xml)?\n?/i, '').replace(/\n?```$/i, '').trim()

    // Must start with <svg
    if (!svg.startsWith('<svg')) {
      const start = svg.indexOf('<svg')
      if (start !== -1) svg = svg.slice(start)
      else throw new Error('AI did not return valid SVG')
    }

    return NextResponse.json({ svgCode: svg })
  } catch (err) {
    console.error('generate-chart error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
