// JSON-serialisable slide layout schema.
// Admins can store per-brand overrides of these in the DB and edit them in the UI.

export interface JsonRect {
  type: 'rect'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  fill: string          // hex or "{{primary}}", "{{dark}}", etc.
  opacity?: number
  radius?: number       // border-radius in inches
  if?: string           // only rendered when spec[if] is truthy
}

export interface JsonText {
  type: 'text'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  content: string                              // "{{title}}", "$item", or literal
  fontFamily: string                           // "{{headlineFont}}", "{{bodyFont}}", or literal name
  fontSizePt: number
  fontWeight?: 'bold' | 'normal'
  color: string                                // "{{primary}}", hex, or rgba(...)
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeightMultiplier?: number
  overflow?: 'fitted' | 'clip' | 'visible'
  uppercase?: boolean
  if?: string
}

export interface JsonImage {
  type: 'image'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  src: string          // "{{logoUrl}}", "{{heroImageUrl}}", "{{imageUrl}}"
  fit?: 'contain' | 'cover' | 'stretch' // preserve media aspect ratio unless stretch is explicitly requested
  if?: string
}

export interface JsonChart {
  type: 'chart'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  chartType: 'bar' | 'doughnut'
  data?: string          // "{{fieldName}}" — spec field holding chart data
  centerValue?: string   // "{{fieldName}}" or literal — text shown in doughnut hole
  centerLabel?: string   // "{{fieldName}}" or literal — sub-text shown in doughnut hole
  style?: {
    colors?: string[]         // per-segment colors, resolved at runtime
    showLegend?: boolean      // false hides the built-in SVG legend
    showLabels?: boolean
    holeSize?: number
    startAngle?: number
    segmentBorderColor?: string
    segmentBorderWidth?: number
  }
  if?: string
}

// Shape — layout JSON uses "type": "shape"; treated as a filled rectangle
export interface JsonShape {
  type: 'shape'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  shape?: string  // 'rect' etc. — only rect supported
  fill: string
  line?: string   // 'none' disables border
  opacity?: number
  if?: string
}

// Table — renders an array-of-objects spec field as a styled grid
export interface JsonTable {
  type: 'table'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  data: string    // "{{fieldName}}" — spec field holding Array<Record<string,unknown>>
  style?: {
    headerFill?: string
    headerTextColor?: string
    headerFontSizePt?: number
    bodyFontSizePt?: number
    bodyTextColor?: string
    bodyFill?: string
    alternateRowFill?: string
    borderColor?: string
    highlightColor?: string
    highlightRules?: string
  }
  if?: string
}

// Legend — renders colored marker + label for each item in a spec data array
export interface JsonLegend {
  type: 'legend'
  id: string
  x: number; y: number; w: number; h: number
  z?: number
  data: string         // "{{fieldName}}" — spec field holding [{label, value}]
  marker?: 'square' | 'circle'
  fontFamily?: string
  fontSizePt?: number
  colors?: string[]    // "{{primary}}", hex, etc.
  if?: string
}

// Injects the standard master chrome: left accent bar + logo + page number
export interface JsonMaster {
  type: 'master'
  theme: 'light' | 'dark'
}

// Injects the standard eyebrow / title / optional subtitle header block
export interface JsonHeader {
  type: 'header'
  theme: 'light' | 'dark'
  eyebrow?: string   // "{{eyebrow}}" or literal
  title: string      // "{{title}}"
  subtitle?: string  // "{{subtitle}}"
  titleWidth?: number
}

// Loops over a spec array field and repeats children with step-based offsets.
// Within children: $i = index, $item = current item (string) or use $item.key for objects
export interface JsonRepeat {
  type: 'repeat'
  source: string         // spec field name, e.g. "bullets", "items"
  baseX: number
  baseY: number
  stepX?: number         // x added per iteration
  stepY?: number         // y added per iteration (0 = use autoStepY)
  autoStepY?: boolean    // compute stepY = availableH / count
  availableH?: number    // used when autoStepY = true
  maxItems?: number
  children: JsonPositionedElement[]
}

// KPI metric grid — auto-computes column count and card sizes
export interface JsonKpiGrid {
  type: 'kpi_grid'
  baseX?: number          // default 0.55
  baseY?: number          // default 2.2
  availableW?: number     // default 11.5 (ends before side decoration)
  availableH?: number     // default 4.6
  gapX?: number           // default 0.25
  gapY?: number           // default 0.2
  maxItems?: number       // default 6
  cardAccentH?: number    // top accent stripe height, default 0.06
  valueFontSize?: number  // default 38
  labelFontSize?: number  // default 12
  sublabelFontSize?: number // default 9
}

// Horizontal timeline — auto-spaces steps across slide width
export interface JsonTimelineSteps {
  type: 'timeline_steps'
  source?: string         // spec field, default "steps"
  lineY?: number          // default 3.8
  lineX?: number          // default 0.55
  lineW?: number          // default 11.5
  maxItems?: number       // default 5
  circleR?: number        // default 0.22
  numberFontSize?: number // default 11
  labelFontSize?: number  // default 13
  descFontSize?: number   // default 11
}

// Two-column list — renders leftBullets / rightBullets with a divider
export interface JsonTwoColumnList {
  type: 'two_column_list'
  dividerX?: number       // default 6.7
  leftX?: number          // default 0.55
  rightX?: number         // default 7.0
  colW?: number           // default 5.8
  startY?: number         // default 2.15
  availableH?: number     // default 4.55
  headingFontSize?: number // default 15
  itemFontSize?: number   // default 14
  suppressHeadings?: boolean // skip heading rendering (used when headings are already drawn as static elements)
}

// Agenda item list — auto 1- or 2-column depending on item count
export interface JsonAgendaList {
  type: 'agenda_list'
  startX?: number         // default 0.55
  startY?: number         // default 2.15
  maxItems?: number       // default 8
  itemFontSize?: number   // default 15
  dotSize?: number        // default 0.14
}

// Dense feature/capability cards — supports a title, optional value, description,
// and compact bullets per card.
export interface JsonCardGrid {
  type: 'card_grid'
  source?: string
  baseX?: number
  baseY?: number
  availableW?: number
  availableH?: number
  gapX?: number
  gapY?: number
  maxItems?: number
  maxColumns?: number
  titleFontSize?: number
  valueFontSize?: number
  bodyFontSize?: number
}

// Elements that have x/y/w/h coordinates — valid as repeat children
export type JsonPositionedElement = JsonRect | JsonText | JsonImage | JsonChart | JsonShape | JsonTable | JsonLegend

export type JsonStaticElement = JsonPositionedElement | JsonMaster | JsonHeader

export type JsonElement =
  | JsonStaticElement
  | JsonRepeat
  | JsonKpiGrid
  | JsonTimelineSteps
  | JsonTwoColumnList
  | JsonAgendaList
  | JsonCardGrid

export interface JsonSlideLayout {
  background: string     // "{{dark}}", "{{light}}", or hex
  elements: JsonElement[]
}
