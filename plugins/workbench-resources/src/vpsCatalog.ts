//
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//

/** Snapshot of the VPS / AV-ops layout. Not a live listing. */

export type VpsNodeKind = 'folder' | 'file'

export interface VpsNode {
  id: string
  name: string
  kind: VpsNodeKind
  href?: string
  note?: string
  children?: VpsNode[]
}

export const VPS_CATALOG: VpsNode[] = [
  {
    id: 'apps',
    name: 'Apps',
    kind: 'folder',
    note: 'Hosted services',
    children: [
      {
        id: 'huly',
        name: 'Huly',
        kind: 'file',
        href: 'https://app.aneeverse.com',
        note: '/opt/huly-selfhost · huly_v7'
      },
      {
        id: 'contentbeta',
        name: 'Contentbeta',
        kind: 'file',
        href: 'https://studio.aneeverse.com',
        note: '/opt/contentbeta'
      },
      {
        id: 'crm',
        name: 'CRM',
        kind: 'file',
        href: 'https://crm.aneeverse.com',
        note: '/opt/frappe-crm'
      },
      {
        id: 'erpnext',
        name: 'ERPNext',
        kind: 'file',
        href: 'https://erp.aneeverse.com',
        note: 'erp.aneeverse.com'
      },
      {
        id: 'n8n',
        name: 'n8n',
        kind: 'file',
        href: 'https://n8n.aneeverse.com',
        note: '/var/lib/n8n'
      },
      {
        id: 'scrape',
        name: 'Scrape',
        kind: 'file',
        href: 'https://scrape.aneeverse.com',
        note: '/opt/scrapegraphai'
      },
      {
        id: 'chat',
        name: 'Chat',
        kind: 'file',
        href: 'https://chat.aneeverse.com',
        note: 'OpenClaw chat UI'
      },
      {
        id: 'obsidian',
        name: 'Obsidian',
        kind: 'file',
        href: 'https://md.aneeverse.com',
        note: '/opt/obsidian-web'
      },
      {
        id: 'codex',
        name: 'Codex',
        kind: 'file',
        href: 'https://codex.aneeverse.com',
        note: '/opt/codex-proxy'
      },
      {
        id: 'sales',
        name: 'Sales',
        kind: 'folder',
        note: 'ERP + sales UI',
        children: [
          {
            id: 'sales-erp',
            name: 'Sales 1',
            kind: 'file',
            href: 'https://sales1.aneeverse.com',
            note: 'Extra ERP hostname'
          },
          {
            id: 'sales-ui',
            name: 'Sales UI',
            kind: 'file',
            href: 'https://bot.aneeverse.com/sales/',
            note: 'Next.js behind basic auth'
          }
        ]
      },
      {
        id: 'studio',
        name: 'Studio',
        kind: 'file',
        href: 'https://studio.aneeverse.com',
        note: 'ContentBeta Studio'
      },
      {
        id: 'bots',
        name: 'Bots',
        kind: 'folder',
        note: 'Gateway and jewelry jobs',
        children: [
          {
            id: 'bot-gateway',
            name: 'OpenClaw Gateway',
            kind: 'file',
            href: 'https://bot.aneeverse.com',
            note: 'Gateway dashboard'
          },
          {
            id: 'bots-gemini',
            name: 'Jewelry Gemini',
            kind: 'file',
            href: 'https://bots.aneeverse.com/jwel-gemini-browser/',
            note: 'Remote browser'
          },
          {
            id: 'bots-img',
            name: 'Jewelry Image Gen',
            kind: 'file',
            href: 'https://bots.aneeverse.com/jwel-img-gen/',
            note: 'n8n image UI'
          }
        ]
      }
    ]
  },
  {
    id: 'config',
    name: 'Config',
    kind: 'folder',
    note: 'Names only — not live /etc',
    children: [
      {
        id: 'nginx',
        name: 'nginx',
        kind: 'file',
        note: '/etc/nginx/sites-available'
      },
      {
        id: 'systemd',
        name: 'systemd',
        kind: 'file',
        note: 'Host service units'
      },
      {
        id: 'huly-compose',
        name: 'Huly compose',
        kind: 'file',
        note: '/opt/huly-selfhost · huly_v7'
      },
      {
        id: 'scripts',
        name: 'scripts',
        kind: 'file',
        note: 'Deploy and host scripts'
      }
    ]
  },
  {
    id: 'data',
    name: 'Data',
    kind: 'folder',
    note: 'AV-ops 18-data-json',
    children: [
      {
        id: 'data-huly',
        name: 'Huly',
        kind: 'folder',
        note: 'Workspace backup snapshot',
        children: [{ id: 'data-huly-snap', name: 'workspace snapshot', kind: 'file', note: '18-data-json/huly' }]
      },
      {
        id: 'data-crm',
        name: 'CRM',
        kind: 'folder',
        note: 'Frappe CRM JSON',
        children: [{ id: 'data-crm-json', name: 'frappe-crm.json', kind: 'file', note: '18-data-json/crm' }]
      },
      {
        id: 'data-erp',
        name: 'ERPNext',
        kind: 'folder',
        note: 'ERP JSON / SQL',
        children: [{ id: 'data-erp-sql', name: 'erp.sql', kind: 'file', note: '18-data-json/erp' }]
      },
      {
        id: 'data-supabase',
        name: 'Supabase',
        kind: 'folder',
        note: 'Contentbeta Supabase',
        children: [{ id: 'data-supabase-dump', name: 'supabase dump', kind: 'file', note: '18-data-json/supabase' }]
      },
      {
        id: 'data-postgres',
        name: 'Postgres',
        kind: 'folder',
        note: 'Table JSON + SQL dumps',
        children: [
          { id: 'data-pg-index', name: 'index.json', kind: 'file', note: '18-data-json/postgres/index.json' },
          { id: 'data-pg-medusa', name: 'onecarat_medusa', kind: 'file', note: '18-data-json/postgres/onecarat_medusa' }
        ]
      },
      {
        id: 'data-n8n',
        name: 'n8n workflows',
        kind: 'folder',
        note: '18-data-json/n8n',
        children: [{ id: 'data-n8n-wf', name: 'workflows.json', kind: 'file', note: '18-data-json/n8n/workflows.json' }]
      }
    ]
  }
]

export function findVpsNode (id: string, nodes: VpsNode[] = VPS_CATALOG): VpsNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children !== undefined) {
      const found = findVpsNode(id, node.children)
      if (found !== undefined) return found
    }
  }
  return undefined
}

export function vpsPathTo (id: string | undefined): VpsNode[] {
  if (id === undefined) return []
  const walk = (nodes: VpsNode[], trail: VpsNode[]): VpsNode[] | undefined => {
    for (const node of nodes) {
      const next = [...trail, node]
      if (node.id === id) return next
      if (node.children !== undefined) {
        const found = walk(node.children, next)
        if (found !== undefined) return found
      }
    }
    return undefined
  }
  return walk(VPS_CATALOG, []) ?? []
}
