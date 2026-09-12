const OR_KEY = process.env.OPENROUTER_API_KEY!
const MODEL = 'google/gemini-3.6-flash'

// Verbatim, per explicit instruction — do not rephrase or extend this prompt without
// re-confirming, it's a deliberately strict spec (structural recreation only, text
// placeholders instead of any recreated imagery/logos).
const RECREATE_SYSTEM_PROMPT = `You are an expert Front-End Engineer and UI/UX Designer specializing in pixel-perfect web interfaces and DOM animation preparation. Your task is to inspect the uploaded UI screenshot(s) and recreate their UI structures into clean code with exact precision.

---

### CRITICAL RULE: STRICT SEPARATION OF UI vs. GRAPHICS

1. **Recreate UI Elements ONLY:**
   - You MUST ONLY code standard structural UI elements (containers, cards, navigation bars, search inputs, buttons, borders, shadows, layout grids, text, skeleton loader bars, and UI icons/cursors).
   - Do NOT add any extra UI elements, additional text, or menu items that are not explicitly present in the original screenshot.

2. **ABSOLUTELY NO GRAPHIC/IMAGE RECREATION:**
   - NEVER attempt to recreate, draw, trace, or simulate photos, artwork, human imagery, product images, illustrations, or logos using CSS shapes, complex SVGs, HTML Canvas, or pseudo-elements.
   - Do NOT use missing image tags (<img src="...">) or broken file URLs.
   - **Text-Only Replacement Rule:** Any graphic, logo, photo, or illustration MUST be represented strictly by a clean, flat container containing simple, descriptive text (e.g., <div class="image-placeholder">Placeholder</div> or <div class="logo-placeholder">Logo name</div>). Ensure this placeholder container matches the exact width, height, and layout position of the original graphic asset.

3. **Output Format & Architecture:**
   - Output your response strictly as a single, valid, runnable HTML/CSS/JS code block.
   - Use clean, modular CSS classes (Flexbox/Grid) so that UI components, panels, and buttons are isolated, clean, and immediately ready for JavaScript animation libraries (e.g., GSAP, Framer, or native JS).
   - Do NOT include conversational filler, preambles, or markdown explanations—return the code file directly.

---

### Input Provided:
attached image`

function stripCodeFences(code: string): string {
  const trimmed = code.trim()
  const wrapped = trimmed.match(/^```[\w-]*\n?([\s\S]*?)\n?```$/)
  if (wrapped) return wrapped[1]
  return trimmed.replace(/^```[\w-]*\n?/, '').replace(/\n?```\s*$/, '')
}

export async function recreateScreen(imageUrl: string, narration: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://contentbeta.app',
      'X-Title': 'UI Walkthrough',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: RECREATE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: (narration ? `Context on what this screen is for: ${narration}\n\n` : '') +
                'The final output canvas is a fixed 1920x1080 area. Design the recreation to fill that width (1920px) at a proportional scale to the original screenshot, so it renders at full size without extra empty margins.\n\n' +
                'Additionally: based on the context above, mark the 1-3 most important interactive elements a person would click or type into to act out that context, by adding a data-uiw attribute directly on that element in your HTML (this is just an attribute on an element you are already creating — it is not an extra UI element). Use exactly one of these two forms:\n' +
                '- data-uiw="click" on a button or link that gets clicked\n' +
                '- data-uiw="type:SHORT REALISTIC TEXT" on a text input, where SHORT REALISTIC TEXT is short, plausible example content a user would actually type there (a question, a search term, a name) — invent this yourself, do NOT copy or paraphrase the context text above into it. If you cannot invent realistic content, use data-uiw="click" instead.\n' +
                'Only mark genuinely interactive controls, never containers or panels. If nothing in the screen is interactive, add no data-uiw attributes at all.',
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Recreation request failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('No recreation returned')
  return stripCodeFences(String(raw))
}
