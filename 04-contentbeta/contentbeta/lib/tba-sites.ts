export type TbaGroup = 'websites' | 'studio' | 'business' | 'tools'

export interface TbaSite {
  id: string
  name: string
  href: string
  host: string
  description: string
  group: TbaGroup
  https: boolean
  current?: boolean
}

export const TBA_GROUPS: { key: TbaGroup; label: string; hint: string }[] = [
  { key: 'websites', label: 'Websites', hint: 'Public storefronts' },
  { key: 'studio', label: 'Studio', hint: 'This app and workflows' },
  { key: 'business', label: 'Business apps', hint: 'ERP, CRM, and sales' },
  { key: 'tools', label: 'Bots & tools', hint: 'Automation and internal tools' },
]

export const TBA_SITES: TbaSite[] = [
  {
    id: 'cultura',
    name: 'Cultura Jewels',
    href: 'https://www.culturajewels.com',
    host: 'www.culturajewels.com',
    description: 'Jewelry storefront. Admin is at /app.',
    group: 'websites',
    https: true,
  },
  {
    id: 'studio',
    name: 'ContentBeta Studio',
    href: 'https://studio.aneeverse.com',
    host: 'studio.aneeverse.com',
    description: 'This Studio app for brand content generation.',
    group: 'studio',
    https: true,
    current: true,
  },
  {
    id: 'n8n',
    name: 'n8n',
    href: 'https://n8n.aneeverse.com',
    host: 'n8n.aneeverse.com',
    description: 'Workflow automation for Studio and other Aneeverse jobs.',
    group: 'studio',
    https: true,
  },
  {
    id: 'erp',
    name: 'ERPNext',
    href: 'https://erp.aneeverse.com',
    host: 'erp.aneeverse.com',
    description: 'Company ERP for sales, inventory, and operations.',
    group: 'business',
    https: true,
  },
  {
    id: 'crm',
    name: 'CRM',
    href: 'https://crm.aneeverse.com',
    host: 'crm.aneeverse.com',
    description: 'Frappe CRM for leads and customer follow-up.',
    group: 'business',
    https: true,
  },
  {
    id: 'sales1',
    name: 'Sales 1',
    href: 'https://sales1.aneeverse.com',
    host: 'sales1.aneeverse.com',
    description: 'Extra ERP hostname. Prefer erp.aneeverse.com.',
    group: 'business',
    https: true,
  },
  {
    id: 'chat',
    name: 'OpenClaw Chat',
    href: 'https://chat.aneeverse.com',
    host: 'chat.aneeverse.com',
    description: 'Simple chat UI for the OpenClaw gateway.',
    group: 'tools',
    https: true,
  },
  {
    id: 'bot',
    name: 'OpenClaw Gateway',
    href: 'https://bot.aneeverse.com',
    host: 'bot.aneeverse.com',
    description: 'Gateway dashboard. Paste the gateway token, then pair the device.',
    group: 'tools',
    https: true,
  },
  {
    id: 'sales-ui',
    name: 'Sales UI',
    href: 'https://bot.aneeverse.com/sales/',
    host: 'bot.aneeverse.com/sales',
    description: 'Sales Next.js app behind HTTP basic auth.',
    group: 'tools',
    https: true,
  },
  {
    id: 'bots',
    name: 'Jewelry Gemini',
    href: 'https://bots.aneeverse.com/jwel-gemini-browser/',
    host: 'bots.aneeverse.com',
    description: 'Remote browser for jewelry Gemini workflows.',
    group: 'tools',
    https: true,
  },
  {
    id: 'jwel-img',
    name: 'Jewelry Image Gen',
    href: 'https://bots.aneeverse.com/jwel-img-gen/',
    host: 'bots.aneeverse.com/jwel-img-gen',
    description: 'Jewelry image generation UI powered by n8n.',
    group: 'tools',
    https: true,
  },
  {
    id: 'md',
    name: 'Obsidian',
    href: 'https://md.aneeverse.com',
    host: 'md.aneeverse.com',
    description: 'Second-brain notes in Obsidian over noVNC.',
    group: 'tools',
    https: true,
  },
  {
    id: 'scrape',
    name: 'ScrapeGraphAI',
    href: 'https://scrape.aneeverse.com',
    host: 'scrape.aneeverse.com',
    description: 'Web scraping UI for research and extraction.',
    group: 'tools',
    https: true,
  },
]
