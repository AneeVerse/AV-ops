import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

// Strip **...** markers and normalize whitespace for comparison
function stripMarkers(text: string) {
  return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// If GPT wrapped more than 2 words in **...**, trim to the first word only
function clampAccent(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, (_, phrase: string) => {
    const words = phrase.trim().split(/\s+/)
    return `**${words[0]}**`
  })
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const { headline, microcopy } = await req.json()

  if (!headline) {
    return NextResponse.json({ headline: headline || '', microcopy: microcopy || '' })
  }

  const prompt = `You are a visual design assistant. Wrap exactly 1 key word in **double asterisks** for accent coloring.

STRICT RULES — failure to follow means your response is rejected:
- Return the EXACT same text as input — do NOT change, rephrase, reorder, capitalize, or retype any words
- Wrap exactly 1 impactful word in **asterisks**
- Never wrap more than 1 word
- Return valid JSON only, no explanation, no markdown fences

Input JSON:
${JSON.stringify({ headline })}

Output JSON (same format, same words, only **asterisks** added):
{"headline": "..."}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[accent-copy] OpenAI error:', res.status, errBody)
      throw new Error(`OpenAI error: ${res.status}`)
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim() || ''
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    // Safety check: stripped text must exactly match original (case-insensitive)
    const rawHeadline = stripMarkers(parsed.headline || '') === stripMarkers(headline)
      ? parsed.headline
      : headline
    // Clamp any multi-word accent spans to 1 word
    const safeHeadline = clampAccent(rawHeadline)

    return NextResponse.json({ headline: safeHeadline, microcopy: microcopy || '' })
  } catch {
    return NextResponse.json({ headline, microcopy: microcopy || '' })
  }
}
