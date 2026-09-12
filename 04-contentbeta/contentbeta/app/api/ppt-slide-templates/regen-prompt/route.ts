import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export const maxDuration = 30

const OR_KEY = process.env.OPENROUTER_API_KEY!
const MODEL  = 'google/gemini-2.5-flash'

export async function POST(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const { templateName, layoutJson } = await req.json() as {
    templateName: string
    layoutJson: string
  }

  if (!templateName || !layoutJson) {
    return NextResponse.json({ error: 'templateName and layoutJson required' }, { status: 400 })
  }

  // Walk parsed JSON and collect {{token}} values only from content-type keys,
  // skipping styling keys (color, fill, fontFamily, src, etc.) which are brand tokens.
  const STYLE_KEYS = new Set([
    'color','fill','fontFamily','src','stroke','background',
    'headerFill','headerTextColor','alternateRowFill','borderColor',
    'highlightColor','segmentBorderColor','line','marker','colors',
  ])
  const SYSTEM_TOKENS = new Set([
    'primary','accent','dark','light','white',
    'headlineFont','bodyFont','titleFont',
    'logoUrl','logoForDark','decorationUrl','canvasW','canvasH',
  ])

  function extractContentTokens(val: unknown, parentKey = ''): string[] {
    if (typeof val === 'string') {
      if (STYLE_KEYS.has(parentKey)) return []
      return Array.from(val.matchAll(/\{\{([^}]+)\}\}/g), m => m[1].trim())
    }
    if (Array.isArray(val)) return val.flatMap(v => extractContentTokens(v, parentKey))
    if (val && typeof val === 'object') {
      return Object.entries(val as Record<string, unknown>)
        .flatMap(([k, v]) => extractContentTokens(v, k))
    }
    return []
  }

  let parsedLayout: unknown
  try { parsedLayout = JSON.parse(layoutJson) } catch { parsedLayout = null }

  const tokens = Array.from(new Set(
    (parsedLayout
      ? extractContentTokens(parsedLayout)
      : Array.from(layoutJson.matchAll(/\{\{([^}]+)\}\}/g), m => m[1].trim())
    ).filter(t => !SYSTEM_TOKENS.has(t))
  ))

  const userPrompt = `Template name: "${templateName}"

Layout JSON:
${layoutJson}

Content fields used in this layout: ${tokens.length ? tokens.join(', ') : '(none detected)'}

Write a slide content prompt for this template. The prompt will be injected into an AI planning system that generates slide-by-slide content for a presentation. The AI will read the prompt and know exactly what JSON fields to output for this slide type.

The prompt MUST:
- Briefly describe what this slide type is for (1 sentence)
- List every content field (from the fields above) by its EXACT field name in backticks, e.g. \`comparisonData\`, followed by a short description of the value to produce
- Mention data types where relevant (e.g. "array of strings", "short phrase", "number as string")
- Be written in second-person imperative style ("Provide \`fieldName\`...", "Include \`fieldName\`...")
- Be concise — 150–250 words max

IMPORTANT: Every field listed under "Content fields used in this layout" MUST appear verbatim (with exact casing) in the output, wrapped in backticks. Do not paraphrase or rename them.

Output only the prompt text. No markdown headers, no JSON.`

  const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://contentbeta.app',
      'X-Title': 'ContentBeta Prompt Regen',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [
        { role: 'system', content: 'You write concise AI prompts for presentation slide templates. Output only the prompt text.' },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!orRes.ok) {
    const t = await orRes.text().catch(() => '')
    return NextResponse.json({ error: `AI error (${orRes.status}): ${t.slice(0, 200)}` }, { status: 500 })
  }

  const data = await orRes.json() as { choices: { message: { content: string } }[] }
  const prompt = data.choices?.[0]?.message?.content?.trim() ?? ''

  return NextResponse.json({ prompt })
}
