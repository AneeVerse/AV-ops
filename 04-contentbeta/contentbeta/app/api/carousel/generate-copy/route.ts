import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OPENAI_KEY = process.env.OPENAI_API_KEY!

const SYSTEM_PROMPT = `You are a world-class LinkedIn carousel designer and copywriter. Your output must be a single valid JSON object — no markdown, no explanation.

You will be given a blog article and brand guidelines. Your job is:
1. Extract 3 brand colors from the guidelines (primaryColor for backgrounds/CTA bg, accentColor for highlights/eyebrow, textColor for body text on light backgrounds)
2. Write carousel copy for 6 slides following the exact structure below

Slide structure:
- Slide 1 (title): Hook the reader. Strong opening statement.
- Slide 2 (problem): Name the core problem or tension.
- Slide 3 (insight): Deliver the key insight or surprising truth.
- Slide 4 (shift): Show the mindset or approach shift needed.
- Slide 5 (action): Give concrete, actionable takeaways.
- Slide 6 (cta): Drive engagement. Direct call to action.

Output JSON format:
{
  "colors": {
    "primaryColor": "#hex",
    "accentColor": "#hex",
    "textColor": "#hex"
  },
  "slides": [
    {
      "slideType": "title",
      "eyebrow": "2-3 word label in sentence case",
      "headline": "Punchy headline with 1-2 words wrapped in **double asterisks** for emphasis",
      "subhead": "One supporting sentence with 1 key phrase in **double asterisks**",
      "bullets": [],
      "ctaText": null,
      "carouselTitle": null,
      "splitPercent": 65,
      "logoPos": "top-left",
      "visualContext": "Describe the ideal background photo for this slide in 1-2 sentences. Focus on mood, composition, and what should be in the right 35% of frame since text occupies the left 65%."
    },
    {
      "slideType": "problem",
      "eyebrow": null,
      "headline": "Headline with **emphasis**",
      "subhead": "Supporting sentence with **key phrase**",
      "bullets": ["First bullet with **bold term**", "Second bullet"],
      "ctaText": null,
      "carouselTitle": "Shared carousel series title (same for slides 2-5, sentence case)",
      "splitPercent": 50,
      "logoPos": "bottom-left",
      "visualContext": "Background photo description. Right 50% should have visual interest, left 50% relatively clean."
    },
    {
      "slideType": "insight",
      "eyebrow": null,
      "headline": "Headline with **emphasis**",
      "subhead": "Supporting sentence",
      "bullets": ["Insight point with **bold**", "Second insight"],
      "ctaText": null,
      "carouselTitle": "Same carouselTitle as slide 2",
      "splitPercent": 50,
      "logoPos": "bottom-left",
      "visualContext": "Background photo description."
    },
    {
      "slideType": "shift",
      "eyebrow": null,
      "headline": "Headline with **emphasis**",
      "subhead": "Supporting sentence",
      "bullets": ["Shift point with **bold**", "Second point"],
      "ctaText": null,
      "carouselTitle": "Same carouselTitle as slide 2",
      "splitPercent": 50,
      "logoPos": "bottom-left",
      "visualContext": "Background photo description."
    },
    {
      "slideType": "action",
      "eyebrow": null,
      "headline": "Headline with **emphasis**",
      "subhead": "Supporting sentence",
      "bullets": ["Action step with **bold**", "Second action"],
      "ctaText": null,
      "carouselTitle": "Same carouselTitle as slide 2",
      "splitPercent": 50,
      "logoPos": "bottom-left",
      "visualContext": "Background photo description."
    },
    {
      "slideType": "cta",
      "eyebrow": null,
      "headline": "CTA headline with **emphasis**",
      "subhead": "One-line supporting text",
      "bullets": [],
      "ctaText": "Read the full article",
      "carouselTitle": null,
      "splitPercent": 80,
      "logoPos": "top-center",
      "visualContext": "Background for CTA slide. Full bleed, text in center. Can be more abstract or atmospheric."
    }
  ]
}`

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req)
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId, blogUrl } = await req.json()
  if (!brandId || !blogUrl) {
    return NextResponse.json({ error: 'Missing brandId or blogUrl' }, { status: 400 })
  }

  // Fetch brand profile
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('style_prompt,logo_url,brands(name)')
    .eq('brand_id', brandId)
    .single()

  const brandName = (brand?.brands as { name?: string } | null)?.name || 'Brand'
  const stylePrompt = (brand?.style_prompt as string | null) || ''
  const logoUrl = (brand?.logo_url as string | null) || null

  // Scrape blog via Jina AI
  let blogText = ''
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${blogUrl}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(30000),
    })
    blogText = await jinaRes.text()
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch blog content. Please check the URL and try again.' },
      { status: 422 }
    )
  }

  if (!blogText || blogText.length < 100) {
    return NextResponse.json(
      { error: 'Could not extract content from this URL. Try a different article link.' },
      { status: 422 }
    )
  }

  // Call OpenAI GPT-4o
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `BRAND: ${brandName}\n\nBRAND GUIDELINES:\n${stylePrompt.substring(0, 3000)}\n\nBLOG CONTENT:\n${blogText.substring(0, 7000)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    return NextResponse.json(
      { error: 'AI generation failed: ' + errText.substring(0, 200) },
      { status: 500 }
    )
  }

  const aiData = await openaiRes.json()
  const content = aiData.choices?.[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'No content from AI' }, { status: 500 })
  }

  let parsed: { slides?: unknown[]; colors?: unknown }
  try {
    parsed = JSON.parse(content)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    return NextResponse.json({ error: 'No slides generated' }, { status: 500 })
  }

  return NextResponse.json({
    slides: parsed.slides,
    colors: parsed.colors || { primaryColor: '#1a1a2e', accentColor: '#3b82f6', textColor: '#ffffff' },
    logoUrl,
  })
}
