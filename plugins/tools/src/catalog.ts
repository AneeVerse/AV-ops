export type ToolGroup = string

export interface ToolSite {
  id: string
  name: string
  href: string
  host: string
  description: string
  group: ToolGroup
  https: boolean
  current?: boolean
  openMode?: 'popup' | 'tab' | 'window'
}

export interface ToolGroupDefinition {
  id: string
  name: string
  hint?: string
  icon?: string
  color?: string
  isDefault?: boolean
  order?: number
}

export const DEFAULT_GROUPS: ToolGroupDefinition[] = [
  { id: 'websites', name: 'Websites', hint: 'Public storefronts', color: '#10b981', order: 10 },
  { id: 'studio', name: 'Studio', hint: 'This app and workflows', color: '#3b82f6', order: 20 },
  { id: 'business', name: 'Business apps', hint: 'ERP, CRM, and sales', color: '#f59e0b', order: 30 },
  { id: 'tools', name: 'Bots & tools', hint: 'Automation and internal tools', color: '#8b5cf6', order: 40 }
]

export const TOOL_GROUPS: ToolGroup[] = ['websites', 'studio', 'business', 'tools']

export const OBSOLETE_TOOL_HOSTS: string[] = [
  'erp.aneeverse.com',
  'crm.aneeverse.com',
  'sales1.aneeverse.com',
  'chat.aneeverse.com',
  'bot.aneeverse.com',
  'scrape.aneeverse.com'
]

export const OBSOLETE_TOOL_IDS: string[] = [
  'erp',
  'crm',
  'sales1',
  'chat',
  'bot',
  'sales-ui',
  'scrape'
]

export function isValidToolHref (href: string): boolean {
  try {
    const url = new URL(href.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function hostFromHref (href: string): { host: string, https: boolean } {
  try {
    const url = new URL(href.trim())
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
    return {
      host: path === '' ? url.host : `${url.host}${path}`,
      https: url.protocol === 'https:'
    }
  } catch {
    return { host: href.trim(), https: href.trim().startsWith('https://') }
  }
}

export const TOOL_SITES: ToolSite[] = [
  {
    id: 'cultura',
    name: 'Cultura Jewels',
    href: 'https://www.culturajewels.com',
    host: 'www.culturajewels.com',
    description: 'Jewelry storefront. Admin is at /app.',
    group: 'websites',
    https: true,
    openMode: 'window'
  },
  {
    id: 'aneeverse',
    name: 'Aneeverse',
    href: 'https://app.aneeverse.com',
    host: 'app.aneeverse.com',
    description: 'This ops workspace. Tracker, leads, and company files.',
    group: 'studio',
    https: true,
    current: true,
    openMode: 'window'
  },
  {
    id: 'studio',
    name: 'ContentBeta Studio',
    href: 'https://studio.aneeverse.com',
    host: 'studio.aneeverse.com',
    description: 'Studio app for brand content generation.',
    group: 'studio',
    https: true,
    openMode: 'popup'
  },
  {
    id: 'n8n',
    name: 'n8n',
    href: 'https://n8n.aneeverse.com',
    host: 'n8n.aneeverse.com',
    description: 'Workflow automation and forms for Studio and other Aneeverse jobs.',
    group: 'studio',
    https: true,
    openMode: 'popup'
  },
  {
    id: 'bots',
    name: 'Jewelry Gemini',
    href: 'https://bots.aneeverse.com/jwel-gemini-browser/',
    host: 'bots.aneeverse.com',
    description: 'Remote browser for jewelry Gemini workflows.',
    group: 'tools',
    https: true,
    openMode: 'popup'
  },
  {
    id: 'jwel-img',
    name: 'Jewelry Image Gen',
    href: 'https://bots.aneeverse.com/jwel-img-gen/',
    host: 'bots.aneeverse.com/jwel-img-gen',
    description: 'Jewelry image generation UI powered by n8n.',
    group: 'tools',
    https: true,
    openMode: 'popup'
  },
  {
    id: 'md',
    name: 'Obsidian',
    href: 'https://md.aneeverse.com',
    host: 'md.aneeverse.com',
    description: 'Second-brain notes in Obsidian over noVNC.',
    group: 'tools',
    https: true,
    openMode: 'popup'
  }
]
