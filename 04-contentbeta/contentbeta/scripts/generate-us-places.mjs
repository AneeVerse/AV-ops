import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const input = process.argv[2]
const output = process.argv[3]
if (!input || !output) {
  throw new Error('Usage: node scripts/generate-us-places.mjs <gazetteer.txt> <output.json>')
}

const text = await readFile(input, 'utf8')
const rows = text.trim().split(/\r?\n/)
const places = new Map()

for (const row of rows.slice(1)) {
  const fields = row.split('|')
  const state = fields[0]
  if (state === 'PR') continue

  const rawName = fields[4]
  const latitude = Number(fields[11])
  const longitude = Number(fields[12])
  if (!rawName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue

  const name = rawName.replace(
    /\s+(city|town|village|borough|municipality|CDP|balance|urban county|unified government|consolidated government|metro government)$/i,
    '',
  )
  const label = `${name}, ${state}`
  if (!places.has(label)) places.set(label, [label, longitude, latitude])
}

const sorted = Array.from(places.values()).sort((a, b) => a[0].localeCompare(b[0]))
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(sorted))
console.log(`Wrote ${sorted.length} US places to ${output}`)
