#!/usr/bin/env node
/**
 * Print a `<sha1>  <relative/path>` manifest for a directory, byte-for-byte
 * comparable with `find . -type f -exec sha1sum {} +` on the VPS.
 *
 *   node scripts/huly-dist-manifest.mjs dev/prod/dist
 *
 * Used to upload only the files production is actually missing.
 */
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join, posix, resolve } from 'path'

const root = resolve(process.argv[2] ?? '.')

async function walk (dir, prefix, out) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    const rel = prefix === '' ? entry.name : posix.join(prefix, entry.name)
    if (entry.isDirectory()) await walk(abs, rel, out)
    else if (entry.isFile()) out.push({ abs, rel })
  }
  return out
}

function sha1 (file) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha1')
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolvePromise(hash.digest('hex')))
  })
}

try {
  await stat(root)
} catch {
  process.exit(0)
}

const files = await walk(root, '', [])
files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))

const lines = []
for (const file of files) {
  lines.push(`${await sha1(file.abs)}  ./${file.rel}`)
}
process.stdout.write(lines.join('\n') + (lines.length > 0 ? '\n' : ''))
