export interface BrandTokens {
  primary: string        // e.g. "#E4001B"
  accent: string         // e.g. "#0047AB"
  dark: string           // e.g. "#1A1A1A"
  light: string          // e.g. "#F2F3F3"
  white: string          // "#FFFFFF"
  headlineFont: string   // e.g. "Arial Black"
  bodyFont: string       // e.g. "Calibri"
  logoUrl: string | null       // light-background logo
  logoDarkUrl?: string | null  // dark-background logo (optional, falls back to logoUrl)
  decorationUrl?: string | null
}

export interface Bounds { x: number; y: number; w: number; h: number }  // inches

export interface TextProps {
  content: string
  fontFamily: string
  fontSizePt: number
  fontWeight: 'normal' | 'bold'
  color: string
  align: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
  lineHeightMultiplier: number
  uppercase?: boolean
  overflow?: 'fitted' | 'clip' | 'visible'
  lines?: string[]         // filled by text-fit
  fittedSizePt?: number    // filled after text fitting
}

export interface ChartSeries {
  name: string
  values: number[]
  color: string  // resolved hex
}

export interface ChartData {
  type: 'bar' | 'doughnut'
  categories: string[]
  series: ChartSeries[]
  centerValue?: string
  centerLabel?: string
  unitSuffix?: string
  primaryColor: string
  textColor: string
  accentColors: string[]   // resolved palette for multi-series / doughnut segments
  headlineFont?: string    // titles, chart values, and important numbers only
  bodyFont?: string        // chart labels, legends, axes, and supporting copy
  segmentColors?: string[] // explicit per-segment color override (layout-specified)
  showLegend?: boolean     // false hides the built-in SVG legend
  svgCode?: string         // AI-generated SVG — if present, rendered directly
}

export interface ResolvedElement {
  id: string
  type: 'rect' | 'text' | 'image' | 'line' | 'chart'
  bounds: Bounds
  z: number
  visible: boolean
  text?: TextProps
  style?: { fill?: string; opacity?: number; stroke?: string; strokeWidth?: number; borderRadius?: number }
  assetId?: string
  imageFit?: 'contain' | 'cover' | 'stretch'
  chart?: ChartData
}

export interface RenderPlan {
  slideId: string
  background: string  // hex color
  elements: ResolvedElement[]
}

// ── Slide spec types (discriminated by role) ──────────────────────────────────
export type SlideRole =
  | 'cover_hero' | 'section_divider' | 'agenda'
  | 'bullets' | 'two_column' | 'stat_callout'
  | 'kpi_grid' | 'image_body' | 'quote_attribution'
  | 'timeline' | 'comparison' | 'closing_cta'
  | 'chart_bar' | 'chart_doughnut'
  | 'data_table' | 'card_grid'

export interface BaseSpec {
  id: string
  sequence: number
  role: SlideRole
  sourcePage?: number
  speakerNotes?: string
}

export interface CoverHeroSpec extends BaseSpec {
  role: 'cover_hero'
  title: string
  subtitle?: string
  tagline?: string
  date?: string
  imagePrompt?: string   // AI-written description of what image to generate
  heroImageUrl?: string  // filled in after image generation
}

export interface SectionDividerSpec extends BaseSpec {
  role: 'section_divider'
  sectionNumber?: string
  title: string
  subtitle?: string
}

export interface AgendaSpec extends BaseSpec {
  role: 'agenda'
  eyebrow?: string
  title: string
  items: string[]  // up to 8 agenda items
}

export interface BulletsSpec extends BaseSpec {
  role: 'bullets'
  eyebrow?: string
  title: string
  subtitle?: string
  bullets: string[]  // 3-5 bullets
}

export interface TwoColumnSpec extends BaseSpec {
  role: 'two_column'
  eyebrow?: string
  title: string
  leftHeading?: string
  leftBullets: string[]
  rightHeading?: string
  rightBullets: string[]
}

export interface StatCalloutSpec extends BaseSpec {
  role: 'stat_callout'
  eyebrow?: string
  title: string
  stat: string       // e.g. "$800B"
  statLabel: string  // e.g. "US freight market"
  body?: string
}

export interface KpiGridSpec extends BaseSpec {
  role: 'kpi_grid'
  eyebrow?: string
  title: string
  kpis: Array<{ value: string; label: string; sublabel?: string }>  // 4-6 items
}

export interface ImageBodySpec extends BaseSpec {
  role: 'image_body'
  eyebrow?: string
  title: string
  body: string
  imagePosition?: 'left' | 'right'
  imagePrompt?: string  // AI-written description of what image to generate
  imageUrl?: string     // filled in after image generation
}

export interface QuoteAttributionSpec extends BaseSpec {
  role: 'quote_attribution'
  quote: string
  attribution?: string
  role_title?: string
}

export interface TimelineSpec extends BaseSpec {
  role: 'timeline'
  eyebrow?: string
  title: string
  steps: Array<{ number: string; label: string; description?: string }>  // 3-5 steps
}

export interface ComparisonSpec extends BaseSpec {
  role: 'comparison'
  eyebrow?: string
  title: string
  leftHeading: string
  leftItems: string[]
  rightHeading: string
  rightItems: string[]
}

export interface ClosingCtaSpec extends BaseSpec {
  role: 'closing_cta'
  title: string
  subtitle?: string
  cta?: string
}

export interface ChartBarSpec extends BaseSpec {
  role: 'chart_bar'
  title: string
  eyebrow?: string
  categories: string[]   // x-axis labels: ["Q1", "Q2", "Q3"]
  values: number[]       // one value per category
  series?: Array<{ name?: string; values: number[]; color?: string }>
  seriesName?: string    // legend / axis label
  unitSuffix?: string    // "%" or "M" appended to value labels
  svgCode?: string       // filled after AI SVG generation
}

export interface ChartDoughnutSpec extends BaseSpec {
  role: 'chart_doughnut'
  title: string
  eyebrow?: string
  segments: { label: string; value: number }[]
  charts?: Array<{
    title?: string
    segments: { label: string; value: number }[]
    centerValue?: string
    centerLabel?: string
  }>
  centerValue?: string   // shown in center hole: "42%"
  centerLabel?: string   // sub-text in center hole
  insight?: string       // optional callout text below chart
  svgCode?: string       // filled after AI SVG generation
}

export interface DataTableSpec extends BaseSpec {
  role: 'data_table'
  title: string
  eyebrow?: string
  subtitle?: string
  rows: Array<Record<string, string | number>>
  insight?: string
  source?: string
}

export interface CardGridSpec extends BaseSpec {
  role: 'card_grid'
  title: string
  eyebrow?: string
  subtitle?: string
  cards: Array<{
    title: string
    value?: string
    description?: string
    bullets?: string[]
  }>
  footer?: string
}

export type SlideSpec =
  | CoverHeroSpec | SectionDividerSpec | AgendaSpec | BulletsSpec
  | TwoColumnSpec | StatCalloutSpec | KpiGridSpec | ImageBodySpec
  | QuoteAttributionSpec | TimelineSpec | ComparisonSpec | ClosingCtaSpec
  | ChartBarSpec | ChartDoughnutSpec | DataTableSpec | CardGridSpec

export interface DeckPlan {
  title: string
  slides: SlideSpec[]
}
