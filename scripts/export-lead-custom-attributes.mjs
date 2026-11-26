// Read-only list of lead attributes that are not in the source model.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withHuly } from './lib/huly-read.mjs'

const SOURCE = new Set([
  'title', 'status', 'attachedTo', 'attachedToClass', 'collection', 'startDate',
  'assignee', 'dueDate', 'rank', 'kind', 'identifier', 'number', 'labels',
  'comments', 'attachments', 'description', 'priority', 'isDone', 'parent',
  'estimation', 'remainingTime', 'reportedTime', 'component', 'milestone',
  'space', 'createdOn', 'modifiedOn', 'createdBy', 'modifiedBy'
])

function filled (value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

const report = []
await withHuly(async (client) => {
  const attributes = await client.findAll('core:class:Attribute', { attributeOf: 'lead:class:Lead' })
  const leads = await client.findAll('lead:class:Lead')
  for (const attribute of attributes) {
    if (SOURCE.has(attribute.name)) continue
    const used = leads.filter((lead) => filled(lead[attribute.name])).length
    report.push({
      label: attribute.label ?? '',
      name: attribute.name,
      type: attribute.type?._class ?? attribute.type ?? '',
      _id: attribute._id,
      leadsWithValue: used
    })
  }
})
report.sort((a, b) => String(a.name).localeCompare(String(b.name)))
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'lead-custom-attributes.json')
fs.writeFileSync(file, JSON.stringify(report, null, 2))
for (const row of report) {
  console.log([row.name, row._id, 'values=' + row.leadsWithValue].join(' '))
}
console.log('Wrote ' + file)
console.log('Database was not changed.')
