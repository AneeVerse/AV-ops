// Read-only export of leftover aneerequestId values. Does not unset or delete anything.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withHuly } from './lib/huly-read.mjs'

const classes = [
  'contact:class:Organization',
  'contact:class:Person',
  'tracker:class:Project',
  'tracker:class:Issue',
  'lead:class:Lead'
]

const rows = []
await withHuly(async (client) => {
  for (const className of classes) {
    const docs = await client.findAll(className)
    for (const doc of docs) {
      if (doc.aneerequestId == null || doc.aneerequestId === '') continue
      rows.push({
        class: className,
        _id: doc._id,
        name: doc.name ?? doc.title ?? doc.identifier ?? '',
        aneerequestId: doc.aneerequestId
      })
    }
  }
})
rows.sort((a, b) => String(a._id).localeCompare(String(b._id)))
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'aneerequest-id-export.json')
fs.writeFileSync(file, JSON.stringify(rows, null, 2))
console.log('Wrote ' + rows.length + ' rows to ' + file)
console.log('Database was not changed.')
