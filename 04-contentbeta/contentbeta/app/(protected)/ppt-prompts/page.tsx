'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { authedFetch } from '@/lib/authed-fetch'
import { useToast } from '@/lib/toast'

// ── Default prompt content (mirrors the files / code) ───────────────────────

const PLAN_DEFAULT = `You are an expert presentation designer working for {{BRAND_NAME}}.

Analyze the provided PDF content and produce a structured deck plan as JSON. Output ONLY valid JSON — no markdown fences, no explanations, no extra text.

## Brand Context
- Brand: {{BRAND_NAME}}
- Brand Guidelines: {{BRAND_GUIDELINES}}
- Additional Context: {{BRAND_SCRAP}}

## Output Format

The JSON root object MUST have exactly two keys: "title" and "slides". No other wrapper, no nested objects, no extra keys.

{
  "title": "Presentation Title",
  "slides": [
    {
      "template": "template_name",
      "id": "slide_1",
      "sequence": 1,
      "sourcePage": 1,
      ...content fields for that template...
    }
  ]
}

CRITICAL: Do NOT wrap this in any outer key (e.g. do NOT use "styled_presentation", "deck", "presentation", "output", or any other wrapper). The root object IS the deck.

## Slide Count
Let the content and source format dictate the length.
- Simple topic or short PDF (1-5 pages): 6-10 slides
- Medium content (5-15 pages): 10-14 slides
- Rich / multi-section PDF (15+ pages): up to {{MAX_SLIDES}} slides maximum
If the PDF is already a slide deck, preserve one output slide per meaningful source page.
Do NOT pad with extra bullets slides to reach a target count. Only include a slide if it adds genuine value.

## Available Templates

{{TEMPLATES}}

## Rules

1. NEVER include positions, coordinates, colors, or layout instructions — only content fields and sourcePage.
2. The first slide MUST use the template marked [COVER].
3. The last slide MUST use the template marked [CLOSING].
4. SLIDE VARIETY — strictly enforced:
   • Text slides (bullets, two_column): MAX 2 per deck total. bullets is a last resort — only when no visual template fits.
   • NEVER place two text slides (bullets or two_column) consecutively. Always insert a visual/data slide between them.
   • Visual/data slides (chart_bar, chart_doughnut, data_table, card_grid, kpi_grid, stat_callout, comparison, timeline, image_body): minimum 40% of total slides.
   • Transition slides (section_divider, agenda, quote_attribution): 0-3 total.
   • Pattern check before finalising: scan your slide list — if you see bullets → bullets or two_column → two_column anywhere, replace one with a visual alternative.
5. Keep all text concise — bullets under 15 words, titles under 10 words.
6. Use stat_callout for a single dramatic number. Use kpi_grid for 4-6 metrics. Use timeline for sequences. Use comparison for before/after or options.
   Use data_table for real tables or matrices. Use card_grid for repeated features, capabilities, process blocks, integrations, or roadmap cards.
7. For cover_hero slides: include an "imagePrompt" field — a vivid 1-2 sentence description of a photorealistic image that reflects the brand and presentation topic. No text, no logos, no UI.
8. For image_body slides: include an "imagePrompt" field — a 1-2 sentence description of a photorealistic image that visually reinforces the slide's content. No text, no logos, no UI. Use at most 3 image_body slides per deck.
9. CHARTS — MANDATORY: you MUST include chart slides whenever the content contains ANY of: numbers, percentages, statistics, comparisons, survey results, market share, revenue, growth metrics, rankings, or KPIs. Include AT LEAST 1 chart_bar AND 1 chart_doughnut if the content supports both. Rules for chart data:
   - values MUST be plain numbers — NEVER strings (use 42 not "42%")
   - chart_bar: best for comparing values across categories or time (quarters, years, regions, products)
   - chart_doughnut: best for part-to-whole splits (market share, budget allocation, survey breakdowns)
   - chart_bar example: {"template":"chart_bar","id":"slide_7","sequence":7,"title":"Revenue by Quarter","eyebrow":"Financial Performance","categories":["Q1","Q2","Q3","Q4"],"values":[42,58,71,95],"unitSuffix":"M"}
   - chart_doughnut example: {"template":"chart_doughnut","id":"slide_8","sequence":8,"title":"Market Share by Segment","segments":[{"label":"Enterprise","value":48},{"label":"Mid-Market","value":32},{"label":"SMB","value":20}],"centerValue":"48%","centerLabel":"Enterprise","insight":"Enterprise segment leads with nearly half of total market share"}
10. Return ONLY the JSON object. No preamble, no explanation, no markdown fences.`

const IMAGE_STYLE_DEFAULT = ``

// ── Prompt definitions ───────────────────────────────────────────────────────

interface PromptDef {
  name: string
  title: string
  description: string
  model: string
  placeholders: { token: string; desc: string }[]
  defaultContent: string
}

const PROMPTS: PromptDef[] = [
  {
    name: 'plan_system',
    title: 'Deck Plan Prompt',
    description: 'System prompt sent to the AI when converting a PDF into a slide deck plan. Controls slide count, variety rules, template selection, and image prompt generation (rules 7 & 8). Model: Gemini 2.5 Flash via OpenRouter.',
    model: 'Gemini 2.5 Flash',
    placeholders: [
      { token: '{{BRAND_NAME}}',       desc: 'Brand name' },
      { token: '{{BRAND_GUIDELINES}}', desc: 'Brand style prompt / guidelines text' },
      { token: '{{BRAND_SCRAP}}',      desc: 'Additional brand context (brand scrap field)' },
      { token: '{{MAX_SLIDES}}',       desc: 'Dynamic max based on source pages (hard cap 40)' },
      { token: '{{TEMPLATES}}',        desc: 'Auto-injected list of enabled slide templates with their fields and prompts' },
    ],
    defaultContent: PLAN_DEFAULT,
  },
  {
    name: 'image_style',
    title: 'Image Style Suffix',
    description: 'Text appended to every AI-written imagePrompt before sending it to OpenAI gpt-image-2. Use this to enforce consistent photography style, lighting, or mood across all generated images. Leave blank to use the AI\'s prompt as-is.',
    model: 'OpenAI gpt-image-2',
    placeholders: [],
    defaultContent: IMAGE_STYLE_DEFAULT,
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PptPromptsPage() {
  const { userRole } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [contents, setContents]   = useState<Record<string, string>>({})
  const [originals, setOriginals] = useState<Record<string, string>>({})
  const [saving, setSaving]       = useState<Record<string, boolean>>({})
  const [loaded, setLoaded]       = useState(false)

  useEffect(() => {
    if (userRole === null) return
    if (userRole !== 'admin') { router.replace('/generate'); return }
    loadPrompts()
  }, [userRole, router])

  async function loadPrompts() {
    const res = await authedFetch('/api/ppt-prompts')
    const rows = (await res.json()) as { name: string; content: string }[]
    const map: Record<string, string> = {}
    for (const row of rows ?? []) {
      map[row.name] = row.content
    }
    for (const p of PROMPTS) {
      if (!(p.name in map)) map[p.name] = p.defaultContent
    }
    setContents(map)
    setOriginals({ ...map })
    setLoaded(true)
  }

  async function handleSave(name: string) {
    setSaving(s => ({ ...s, [name]: true }))
    const content = contents[name] ?? ''
    const res = await authedFetch('/api/ppt-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    })
    const json = await res.json() as { error?: string }
    setSaving(s => ({ ...s, [name]: false }))
    if (!res.ok || json.error) { showToast(json.error ?? 'Save failed', true); return }
    setOriginals(o => ({ ...o, [name]: content }))
    showToast('Prompt saved.')
  }

  async function handleReset(name: string, defaultContent: string) {
    await authedFetch(`/api/ppt-prompts?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    setContents(c => ({ ...c, [name]: defaultContent }))
    setOriginals(o => ({ ...o, [name]: defaultContent }))
    showToast('Reset to default.')
  }

  if (!loaded) return (
    <div style={{ padding: 40, color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>PPT System Prompts</h1>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 40 }}>
        Global prompts used during PDF → PPT generation. Changes apply immediately to all future decks.
      </p>

      {PROMPTS.map(p => {
        const current  = contents[p.name] ?? p.defaultContent
        const original = originals[p.name] ?? p.defaultContent
        const isDirty  = current !== original
        const isCustom = original !== p.defaultContent

        return (
          <div key={p.name} style={{
            marginBottom: 48,
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{p.title}</h2>
                    <span style={{
                      fontSize: 11, fontFamily: 'monospace', padding: '2px 8px',
                      background: 'rgba(99,102,241,0.1)', color: 'var(--primary)',
                      border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4,
                    }}>{p.name}</span>
                    {isCustom && !isDirty && (
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 4,
                        background: 'rgba(234,179,8,0.1)', color: '#92400e',
                        border: '1px solid rgba(234,179,8,0.3)',
                      }}>customised</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{p.description}</p>
                </div>
                <span style={{
                  fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                  background: 'rgba(0,0,0,0.04)', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 6,
                }}>Model: {p.model}</span>
              </div>

              {/* Placeholders */}
              {p.placeholders.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>Placeholders</span>
                  <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {p.placeholders.map(pl => (
                      <span key={pl.token} title={pl.desc} style={{
                        fontSize: 11, fontFamily: 'monospace', padding: '2px 7px',
                        background: 'rgba(0,0,0,0.04)', color: 'var(--text)',
                        border: '1px solid var(--border)', borderRadius: 4, cursor: 'default',
                      }}>{pl.token}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                rows={p.name === 'plan_system' ? 35 : 6}
                value={current}
                onChange={e => setContents(c => ({ ...c, [p.name]: e.target.value }))}
                spellCheck={false}
                placeholder={p.name === 'image_style' ? 'e.g. Style: professional business photography, cinematic lighting, no people.' : ''}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  fontFamily: 'monospace', fontSize: 12, lineHeight: 1.55,
                  padding: '16px 20px',
                  background: 'var(--bg)', color: 'var(--text)',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  resize: 'vertical', outline: 'none',
                  minHeight: p.name === 'plan_system' ? 480 : 100,
                }}
              />
            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--bg)' }}>
              <div>
                {isCustom && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 12 }}
                    onClick={() => handleReset(p.name, p.defaultContent)}
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isDirty && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Unsaved changes</span>}
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 13 }}
                  disabled={!isDirty || saving[p.name]}
                  onClick={() => handleSave(p.name)}
                >
                  {saving[p.name] ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
