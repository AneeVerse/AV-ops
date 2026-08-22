#!/usr/bin/env node
/**
 * Pre-build gate for Huly plugin id declarations.
 *
 * `mergeIds(pluginId, base, { ... })` throws at module-eval time if a key it
 * declares already exists in `base` ("'identify' overwrites 'X' for y:string").
 * That kills the whole plugin bundle at runtime and the platform LoadHelpe
 * turns it into an endless reload loop, so it must never reach production.
 *
 *   node scripts/huly-check-plugin-ids.mjs
 *
 * Exits non-zero when a collision or a duplicate key is found.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoots = ['plugins', 'packages', 'models', 'server-plugins', 'plugins-extra']

function readJson (file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** Map of npm package name -> absolute package directory. */
function indexPackages () {
  const index = new Map()
  for (const root of packageRoots) {
    const rootDir = join(repoRoot, root)
    if (!existsSync(rootDir)) continue
    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(rootDir, entry.name)
      const pkg = readJson(join(dir, 'package.json'))
      if (pkg?.name !== undefined) index.set(pkg.name, dir)
    }
  }
  return index
}

/**
 * Strip comments and string bodies so brace/colon scanning is not confused by
 * punctuation inside them. Replaced text keeps its length and newlines.
 */
function neutralize (src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    if (c === '/' && next === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      out += ' '
      i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') { out += ' '; i++ }
        if (i < n) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      }
      out += ' '
      i++
      continue
    }
    out += c
    i++
  }
  return out
}

/** Index of the `{` that opens the last object argument of `call(` at `callIdx`. */
function findObjectArgStart (src, callIdx) {
  let i = src.indexOf('(', callIdx)
  if (i < 0) return -1
  let depth = 0
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return -1
    } else if (c === '{' && depth === 1) return i
  }
  return -1
}

/**
 * Collect `section.key` names from an object literal, plus duplicates found
 * inside a single section.
 */
function collectKeys (src, objStart) {
  const keys = new Map()
  const duplicates = []
  let depth = 0
  let paren = 0
  let bracket = 0
  let section
  let i = objStart

  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '{') { depth++; continue }
    if (c === '}') {
      depth--
      if (depth === 0) break
      if (depth === 1) section = undefined
      continue
    }
    if (c === '(') { paren++; continue }
    if (c === ')') { paren--; continue }
    if (c === '[') { bracket++; continue }
    if (c === ']') { bracket--; continue }
    // Colons inside type annotations, e.g. `Resource<(doc: Doc) => void>`, are
    // not object keys.
    if (c !== ':' || paren > 0 || bracket > 0) continue

    let end = i - 1
    while (end >= 0 && /\s/.test(src[end])) end--
    let start = end
    while (start >= 0 && /[A-Za-z0-9_$]/.test(src[start])) start--
    const name = src.slice(start + 1, end + 1)
    if (name === '') continue

    const line = src.slice(0, i).split('\n').length
    if (depth === 1) {
      section = name
    } else if (depth === 2 && section !== undefined) {
      const full = `${section}.${name}`
      if (keys.has(full)) duplicates.push({ key: full, line })
      else keys.set(full, line)
    }
  }
  return { keys, duplicates }
}

function namespaceOf (file, callNames) {
  if (!existsSync(file)) return undefined
  const src = neutralize(readFileSync(file, 'utf8'))
  for (const call of callNames) {
    const idx = src.indexOf(`${call}(`)
    if (idx < 0) continue
    const objStart = findObjectArgStart(src, idx)
    if (objStart < 0) continue
    return collectKeys(src, objStart)
  }
  return undefined
}

function findSourceFiles (dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === 'dist') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) findSourceFiles(p, out)
    else if (entry.name.endsWith('.ts')) out.push(p)
  }
  return out
}

const packages = indexPackages()
const problems = []
let checked = 0

for (const root of packageRoots) {
  const rootDir = join(repoRoot, root)
  if (!existsSync(rootDir)) continue
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const srcDir = join(rootDir, entry.name, 'src')
    if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) continue

    for (const file of findSourceFiles(srcDir)) {
      const raw = readFileSync(file, 'utf8')
      if (!raw.includes('mergeIds(')) continue
      const src = neutralize(raw)
      const callIdx = src.indexOf('mergeIds(')
      const objStart = findObjectArgStart(src, callIdx)
      if (objStart < 0) continue

      const rel = file.slice(repoRoot.length + 1).replace(/\\/g, '/')
      const merged = collectKeys(src, objStart)
      checked++

      for (const dup of merged.duplicates) {
        problems.push(`${rel}:${dup.line}  duplicate key '${dup.key}' in the same object`)
      }

      // Second argument of mergeIds is the base namespace binding.
      const args = raw.slice(raw.indexOf('(', callIdx), raw.indexOf('{', raw.indexOf('(', callIdx)))
      const baseBinding = args.split(',')[1]?.trim()
      if (baseBinding === undefined || baseBinding === '') continue

      const importRe = new RegExp(`import\\s+${baseBinding}\\s*(?:,\\s*\\{[^}]*\\})?\\s*from\\s*['"]([^'"]+)['"]`)
      const importMatch = raw.match(importRe)
      if (importMatch === null) continue

      const basePkgDir = packages.get(importMatch[1])
      if (basePkgDir === undefined) continue

      const base =
        namespaceOf(join(basePkgDir, 'src', 'index.ts'), ['plugin']) ??
        namespaceOf(join(basePkgDir, 'src', 'plugin.ts'), ['plugin'])
      if (base === undefined) continue

      const baseRel = basePkgDir.slice(repoRoot.length + 1).replace(/\\/g, '/')
      for (const [key, line] of merged.keys) {
        if (base.keys.has(key)) {
          problems.push(
            `${rel}:${line}  '${key}' already declared in ${baseRel}/src/index.ts:${base.keys.get(key)} ` +
              '— mergeIds will throw at runtime'
          )
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`plugin id check FAILED (${problems.length} problem(s)):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('\nRemove the duplicate declaration from the mergeIds block (the base plugin keeps it).')
  process.exit(1)
}

console.log(`plugin id check OK (${checked} mergeIds blocks)`)
