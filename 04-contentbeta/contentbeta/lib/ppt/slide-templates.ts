export interface PptSlideField {
  name: string
  type: 'text' | 'text[]' | 'kpi[]' | 'step[]' | 'row[]' | 'card[]' | 'chart[]'
  label: string
  required: boolean
  description?: string
  maxItems?: number
}

export interface PptSlideTemplate {
  name: string
  displayName: string
  description: string
  promptText: string
  isCover?: boolean
  isClosing?: boolean
  sortOrder: number
  fields: PptSlideField[]
}

export const PPT_SLIDE_TEMPLATES: PptSlideTemplate[] = [
  {
    name: 'cover_hero',
    displayName: 'Cover Slide',
    description: 'Full-bleed opening cover with title, subtitle, and logo.',
    isCover: true,
    sortOrder: 0,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'subtitle', type: 'text', label: 'Subtitle', required: false },
      { name: 'tagline', type: 'text', label: 'Tagline', required: false, description: 'Short label shown in caps above the title' },
      { name: 'date', type: 'text', label: 'Date', required: false },
    ],
    promptText: `### cover_hero — Cover Slide [COVER]
Use as the FIRST slide only.
Required: title (string — main presentation title)
Optional: subtitle (string), tagline (string — short label shown above title in caps), date (string)
Image: imagePrompt (string — vivid 1-2 sentence photorealistic scene, no text/logos, fills right half of slide)`,
  },
  {
    name: 'section_divider',
    displayName: 'Section Divider',
    description: 'Dark transition slide between major sections of the deck.',
    sortOrder: 1,
    fields: [
      { name: 'title', type: 'text', label: 'Section Title', required: true },
      { name: 'sectionNumber', type: 'text', label: 'Section Number', required: false, description: 'e.g. "01", "02"' },
      { name: 'subtitle', type: 'text', label: 'Subtitle', required: false },
    ],
    promptText: `### section_divider — Section Divider
Dark transition slide. Use between major sections of the deck.
Required: title (string — section name)
Optional: sectionNumber (string — e.g. "01"), subtitle (string — brief section description)`,
  },
  {
    name: 'agenda',
    displayName: 'Agenda',
    description: 'Table of contents with up to 8 agenda items.',
    sortOrder: 2,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'items', type: 'text[]', label: 'Agenda Items', required: true, maxItems: 8 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
    ],
    promptText: `### agenda — Agenda / Table of Contents
Presentation outline. Use once near the start of the deck.
Required: title (string — e.g. "Agenda"), items (array of strings — up to 8 topics)
Optional: eyebrow (string — small label above title)`,
  },
  {
    name: 'bullets',
    displayName: 'Bullet Points',
    description: 'Title with 3–5 concise key points. Most versatile content slide.',
    sortOrder: 3,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'bullets', type: 'text[]', label: 'Bullet Points', required: true, maxItems: 5 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'subtitle', type: 'text', label: 'Subtitle', required: false },
    ],
    promptText: `### bullets — Bullet Points
Content slide with 3-5 key points. Use sparingly (max 4 per deck) — prefer chart_bar, chart_doughnut, kpi_grid, or comparison when data exists.
Required: title (string), bullets (array of 3-5 strings — each under 15 words)
Optional: eyebrow (string), subtitle (string)`,
  },
  {
    name: 'two_column',
    displayName: 'Two Column',
    description: 'Split layout for comparing or grouping related points.',
    sortOrder: 4,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'leftBullets', type: 'text[]', label: 'Left Column Items', required: true, maxItems: 5 },
      { name: 'rightBullets', type: 'text[]', label: 'Right Column Items', required: true, maxItems: 5 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'leftHeading', type: 'text', label: 'Left Heading', required: false },
      { name: 'rightHeading', type: 'text', label: 'Right Heading', required: false },
    ],
    promptText: `### two_column — Two Column Layout
Side-by-side content. Good for grouping related points or features.
Required: title (string), leftBullets (array of 2-5 strings), rightBullets (array of 2-5 strings)
Optional: eyebrow (string), leftHeading (string), rightHeading (string)`,
  },
  {
    name: 'stat_callout',
    displayName: 'Stat Callout',
    description: 'Single dramatic statistic or number as the focal point.',
    sortOrder: 5,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'stat', type: 'text', label: 'Statistic', required: true, description: 'e.g. "$800B", "47%", "3.2M"' },
      { name: 'statLabel', type: 'text', label: 'Stat Label', required: true },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'body', type: 'text', label: 'Body Text', required: false },
    ],
    promptText: `### stat_callout — Stat Callout
Highlights one dramatic number. Use for key metrics and market stats.
Required: title (string — context), stat (string — the big number e.g. "$800B", "47%"), statLabel (string — what it measures)
Optional: eyebrow (string), body (string — 1-2 sentence supporting context)`,
  },
  {
    name: 'chart_bar',
    displayName: 'Bar Chart',
    description: 'Vertical bar chart for comparing values across categories.',
    sortOrder: 6,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'categories', type: 'text[]', label: 'Categories (X-axis)', required: true, maxItems: 8 },
      { name: 'values', type: 'text[]', label: 'Values', required: true, maxItems: 8 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'seriesName', type: 'text', label: 'Series Name', required: false },
      { name: 'unitSuffix', type: 'text', label: 'Unit Suffix', required: false, description: 'e.g. "%", "M", "K"' },
    ],
    promptText: `### chart_bar — Bar Chart
Vertical grouped bar chart. Use when comparing numeric values across discrete categories (e.g. revenue by quarter, survey answers by audience, year-over-year growth).
Required: title (string), categories (array of 2-8 label strings — x-axis), plus either values (array of PLAIN NUMBERS matching categories) for one series OR series (array of 2-4 objects: { "name": string, "values": number[] } with one plain number per category) for grouped bars.
Optional: eyebrow (string), seriesName (string — legend label), unitSuffix (string — appended to values e.g. "%" or "M")
Examples:
{"template":"chart_bar","title":"Revenue by Quarter","categories":["Q1","Q2","Q3","Q4"],"values":[42,58,71,95],"unitSuffix":"M"}
{"template":"chart_bar","title":"Tools Used","categories":["Brand only","1","2","3+"],"series":[{"name":"2025 Customers","values":[8,38,22,32]},{"name":"2023 Customers","values":[11,54,21,15]}],"unitSuffix":"%"}`,
  },
  {
    name: 'chart_doughnut',
    displayName: 'Doughnut Chart',
    description: 'Doughnut chart for showing part-to-whole composition.',
    sortOrder: 7,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'segments', type: 'text[]', label: 'Segments', required: true, maxItems: 6 },
      { name: 'charts', type: 'chart[]', label: 'Multiple Doughnut Panels', required: false, maxItems: 2 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'centerValue', type: 'text', label: 'Center Value', required: false },
      { name: 'centerLabel', type: 'text', label: 'Center Label', required: false },
      { name: 'insight', type: 'text', label: 'Insight Text', required: false },
    ],
    promptText: `### chart_doughnut — Doughnut Chart
Doughnut chart for part-to-whole relationships (e.g. market share, budget breakdown, survey results, category splits).
Required: title (string), segments (array of 2-6 objects: { "label": string, "value": number } — values MUST be plain numbers, should sum to 100 or a natural total)
For a source page containing two separate doughnut/pie panels, use charts instead of collapsing them: charts (array of 2 objects: { title: string, segments: 2-6 segment objects, centerValue?: string, centerLabel?: string }). Preserve every panel and every source slice.
One-segment doughnuts are invalid. When centerValue is a percentage, the segments must sum to approximately 100.
Optional: eyebrow (string), centerValue (string — shown in hole e.g. "42%"), centerLabel (string — sub-text in hole), insight (string — 1-sentence takeaway shown below chart)
Example: {"template":"chart_doughnut","title":"Market Share","segments":[{"label":"Our Brand","value":42},{"label":"Competitor A","value":31},{"label":"Others","value":27}],"centerValue":"42%","centerLabel":"Market Share"}`,
  },
  {
    name: 'kpi_grid',
    displayName: 'KPI Grid',
    description: 'Grid of 4–6 KPI cards — values, labels, optional sublabels.',
    sortOrder: 8,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'kpis', type: 'kpi[]', label: 'KPIs', required: true, maxItems: 6 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
    ],
    promptText: `### kpi_grid — KPI Grid
Shows 4-6 metrics in a card grid. Use for results, performance, or dashboard slides.
Required: title (string), kpis (array of 4-6 objects: { value: string, label: string, sublabel?: string })
Optional: eyebrow (string)`,
  },
  {
    name: 'data_table',
    displayName: 'Data Table / Matrix',
    description: 'Editable table or matrix for dense row-and-column comparisons.',
    sortOrder: 9,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'rows', type: 'row[]', label: 'Table Rows', required: true, maxItems: 10 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'subtitle', type: 'text', label: 'Subtitle', required: false },
      { name: 'insight', type: 'text', label: 'Key Insight', required: false },
      { name: 'source', type: 'text', label: 'Source Note', required: false },
    ],
    promptText: `### data_table — Data Table / Matrix
Use when the source page contains a real table, matrix, survey cross-tab, or dense row-and-column comparison. Preserve the source columns and values.
Required: title (string), rows (array of 2-16 objects; every object MUST use the same concise keys as column headers, maximum 8 logical columns)
Optional: eyebrow (string), subtitle (string), insight (string — one concise takeaway), source (string)
For cross-tabs, make each source row a separate object. Never encode individual cells into property names such as "row_Category_Audience".
Example: {"template":"data_table","title":"Revenue by Segment","rows":[{"Segment":"SMB","2024":"$12M","2025":"$15M"},{"Segment":"Enterprise","2024":"$24M","2025":"$31M"}]}`,
  },
  {
    name: 'card_grid',
    displayName: 'Feature / Capability Grid',
    description: 'Grid of 3–8 editable cards for features, capabilities, partners, processes, or roadmap items.',
    sortOrder: 10,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'cards', type: 'card[]', label: 'Cards', required: true, maxItems: 8 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'subtitle', type: 'text', label: 'Subtitle', required: false },
      { name: 'footer', type: 'text', label: 'Footer / Takeaway', required: false },
    ],
    promptText: `### card_grid — Feature / Capability Grid
Use when the source page contains 3-8 repeated cards, features, capabilities, integrations, process blocks, roadmap items, or product modules. Preserve the source grouping.
Required: title (string), cards (array of 3-8 objects: { title: string, value?: string, description?: string, bullets?: string[] })
Optional: eyebrow (string), subtitle (string), footer (string — concise takeaway)
Keep each card concise. Do not invent icons, values, or features.`,
  },
  {
    name: 'image_body',
    displayName: 'Image + Body',
    description: 'Half image placeholder, half body text layout.',
    sortOrder: 7,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'body', type: 'text', label: 'Body Text', required: true },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
      { name: 'imagePosition', type: 'text', label: 'Image Position', required: false, description: '"left" or "right"' },
    ],
    promptText: `### image_body — Image + Body Text
Split slide with an image area on one side and body text on the other.
Required: title (string), body (string — 2-4 sentences of supporting text)
Optional: eyebrow (string), imagePosition ("left" or "right", default "right")
Image: imagePrompt (string — 1-2 sentence photorealistic scene that reinforces the slide content, no text/logos)`,
  },
  {
    name: 'quote_attribution',
    displayName: 'Quote',
    description: 'Dark slide featuring a testimonial or impactful quote.',
    sortOrder: 8,
    fields: [
      { name: 'quote', type: 'text', label: 'Quote', required: true },
      { name: 'attribution', type: 'text', label: 'Speaker Name', required: false },
      { name: 'role_title', type: 'text', label: 'Speaker Title', required: false },
    ],
    promptText: `### quote_attribution — Quote Slide
Features a testimonial or notable quote on a dark background.
Required: quote (string — 20-60 words of quoted text)
Optional: attribution (string — speaker name), role_title (string — their title or company)`,
  },
  {
    name: 'timeline',
    displayName: 'Timeline',
    description: 'Horizontal timeline showing 3–5 steps, phases, or milestones.',
    sortOrder: 9,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'steps', type: 'step[]', label: 'Steps', required: true, maxItems: 5 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
    ],
    promptText: `### timeline — Timeline
Horizontal timeline for sequences, phases, or milestones.
Required: title (string), steps (array of 3-5 objects: { number: string, label: string, description?: string })
Optional: eyebrow (string)`,
  },
  {
    name: 'comparison',
    displayName: 'Comparison',
    description: 'Side-by-side comparison of two options with distinct headers.',
    sortOrder: 10,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'leftHeading', type: 'text', label: 'Left Heading', required: true },
      { name: 'leftItems', type: 'text[]', label: 'Left Items', required: true, maxItems: 5 },
      { name: 'rightHeading', type: 'text', label: 'Right Heading', required: true },
      { name: 'rightItems', type: 'text[]', label: 'Right Items', required: true, maxItems: 5 },
      { name: 'eyebrow', type: 'text', label: 'Eyebrow', required: false },
    ],
    promptText: `### comparison — Comparison
Two-column comparison with labeled headers. Good for before/after, options, pros/cons.
Required: title (string), leftHeading (string), leftItems (array of 2-5 strings), rightHeading (string), rightItems (array of 2-5 strings)
Optional: eyebrow (string)`,
  },
  {
    name: 'closing_cta',
    displayName: 'Closing / CTA',
    description: 'Dark closing slide with headline and call-to-action.',
    isClosing: true,
    sortOrder: 11,
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'subtitle', type: 'text', label: 'Subtitle', required: false },
      { name: 'cta', type: 'text', label: 'Call to Action', required: false },
    ],
    promptText: `### closing_cta — Closing Slide [CLOSING]
Use as the LAST slide only. Dark background with closing headline and CTA.
Required: title (string — closing headline or question)
Optional: subtitle (string — supporting context), cta (string — specific next step e.g. "Schedule a demo")`,
  },
]

export function getEnabledTemplates(enabledNames: string[] | null): PptSlideTemplate[] {
  if (!enabledNames || enabledNames.length === 0) return PPT_SLIDE_TEMPLATES
  const set = new Set(enabledNames)
  const filtered = PPT_SLIDE_TEMPLATES.filter(t => set.has(t.name))
  if (!filtered.some(t => t.isCover)) filtered.unshift(PPT_SLIDE_TEMPLATES.find(t => t.isCover)!)
  if (!filtered.some(t => t.isClosing)) filtered.push(PPT_SLIDE_TEMPLATES.find(t => t.isClosing)!)
  return filtered
}
