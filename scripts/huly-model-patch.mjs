#!/usr/bin/env node
// Turn fork edits under models/** into model_tx override transactions.
//
// Why this exists: the model is compiled to model.json and baked into the
// transactor image (see pods/server/src/server.ts). Local and production both run
// the official hardcoreeng images, so editing models/** changes nothing on its own.
// The transactor builds its model as `systemTx.concat(userTx)` — bundled model
// first, then whatever sits in model_tx (foundations/server/packages/middleware/src/model.ts).
// So we diff our built model against the image's model and write the difference
// into model_tx as override transactions.
//
// Usage:
//   node scripts/huly-model-patch.mjs --base <base model.json> --fork <fork model.json> --out patch.sql
//
// Options:
//   --max <n>    refuse to emit more than n transactions (default 60). A large diff
//                usually means base and fork are different upstream versions.
//   --json <f>   also write the patch transactions as JSON, for inspection.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

// model_tx rows we generate are tagged by this _id prefix so a later run can drop
// the ones that are no longer part of the patch.
const ID_PREFIX = 'fp-'

// Patch transactions must sort after every bundled transaction (max ~1783051570973)
// and before any workspace runtime transactions (min ~1786956673777), so user
// configuration changes (e.g. disabling a plugin) sort after and are not overwritten.
const PATCH_EPOCH = 1785000000000

function parseArgs (argv) {
  const out = { max: 60 }
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`)
    const value = argv[++i]
    if (value === undefined) throw new Error(`missing value for ${key}`)
    out[key.slice(2)] = value
  }
  for (const required of ['base', 'fork', 'out']) {
    if (out[required] === undefined) throw new Error(`missing --${required}`)
  }
  out.max = Number(out.max)
  return out
}

function load (path) {
  const txes = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(txes)) throw new Error(`${path} is not a transaction array`)
  return txes
}

// Docs created without an explicit id get a fresh random id on every model build, so
// they cannot be matched between two builds. Diffing them would recreate them endlessly.
const isNamed = (objectId) => typeof objectId === 'string' && (objectId.includes(':') || objectId.startsWith('plugin-configuration-'))

const stable = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
    .join(',')}}`
}

const patchId = (kind, key) => ID_PREFIX + createHash('sha1').update(`${kind}\u0000${key}`).digest('hex').slice(0, 21)

function index (txes) {
  const creates = new Map()
  const mixins = new Map()
  for (const tx of txes) {
    if (!isNamed(tx.objectId)) continue
    if (tx._class === 'core:class:TxCreateDoc') {
      creates.set(tx.objectId, tx)
    } else if (tx._class === 'core:class:TxMixin') {
      mixins.set(`${tx.objectId}|${tx.mixin}`, tx)
    }
  }
  return { creates, mixins }
}

// Only top-level attribute keys are compared. An Application's whole navigatorModel is
// one such key, so a nav tweak becomes a single replacement of that key.
function diffAttributes (baseAttrs = {}, forkAttrs = {}) {
  const operations = {}
  let changed = false
  for (const key of Object.keys(forkAttrs)) {
    if (stable(forkAttrs[key]) !== stable(baseAttrs[key])) {
      operations[key] = forkAttrs[key]
      changed = true
    }
  }
  const removed = Object.keys(baseAttrs).filter((key) => !(key in forkAttrs))
  if (removed.length > 0) {
    operations.$unset = Object.fromEntries(removed.map((key) => [key, true]))
    changed = true
  }
  return changed ? operations : undefined
}

// Never patch version metadata — fork MODEL_VERSION (0.6.0) differs from the
// transactor image (0.7.426) and pushing it triggers a full workspace migration.
const SKIP_OBJECT_IDS = new Set(['core:version:Model'])

function buildPatch (base, fork) {
  const b = index(base)
  const f = index(fork)
  const patch = []
  const notes = []

  for (const [objectId, forkTx] of f.creates) {
    if (SKIP_OBJECT_IDS.has(objectId)) continue
    const baseTx = b.creates.get(objectId)
    if (baseTx === undefined) {
      patch.push({
        _id: patchId('create', objectId),
        _class: 'core:class:TxCreateDoc',
        objectId,
        objectClass: forkTx.objectClass,
        data: { objectClass: forkTx.objectClass, attributes: forkTx.attributes ?? {} }
      })
      notes.push(`add    ${objectId} (${forkTx.objectClass})`)
      continue
    }
    const operations = diffAttributes(baseTx.attributes, forkTx.attributes)
    if (operations === undefined) continue
    if (SKIP_OBJECT_IDS.has(objectId)) continue
    patch.push({
      _id: patchId('update', objectId),
      _class: 'core:class:TxUpdateDoc',
      objectId,
      objectClass: baseTx.objectClass,
      data: { objectClass: baseTx.objectClass, operations }
    })
    notes.push(`update ${objectId} -> ${Object.keys(operations).join(', ')}`)
  }

  // Re-applying a TxMixin overwrites exactly the attribute keys it carries, so the
  // fork transaction can be replayed as-is.
  for (const [key, forkTx] of f.mixins) {
    const baseTx = b.mixins.get(key)
    if (baseTx !== undefined && stable(baseTx.attributes) === stable(forkTx.attributes)) continue
    patch.push({
      _id: patchId('mixin', key),
      _class: 'core:class:TxMixin',
      objectId: forkTx.objectId,
      objectClass: forkTx.objectClass,
      data: {
        objectClass: forkTx.objectClass,
        mixin: forkTx.mixin,
        attributes: forkTx.attributes ?? {}
      }
    })
    notes.push(`${baseTx === undefined ? 'add   ' : 'update'} mixin ${key}`)
  }

  // Docs the fork deleted are reported but never removed here: dropping a doc the
  // running bundle still references is what black-screens the workbench.
  const dropped = [...b.creates.keys()].filter((objectId) => !f.creates.has(objectId))

  return { patch, notes, dropped }
}

function dollarQuote (json) {
  if (json.includes('$json$')) throw new Error('transaction data contains the SQL quote delimiter')
  return `$json$${json}$json$`
}

function toSql (patch) {
  const lines = [
    '-- Generated by scripts/huly-model-patch.mjs. Do not edit by hand.',
    '-- Applies fork model edits on top of the model baked into the transactor image.',
    '-- Idempotent: re-running replaces the same rows and drops patch rows that are gone.',
    'BEGIN;',
    ''
  ]

  const keep = patch.map((tx) => `'${tx._id}'`).join(', ')
  lines.push('-- retire patch rows that are no longer generated')
  lines.push(
    keep.length > 0
      ? `DELETE FROM model_tx WHERE _id LIKE '${ID_PREFIX}%' AND _id NOT IN (${keep});`
      : `DELETE FROM model_tx WHERE _id LIKE '${ID_PREFIX}%';`
  )
  lines.push('')

  // An early fork bootstrap created this named viewlet after PATCH_EPOCH.
  // Its duplicate TxCreateDoc resets the patched defaults during model replay.
  // Retire only that obsolete definition; retain user preferences and updates.
  if (patch.some((tx) => tx.objectId === 'tracker:viewlet:IssueStatusTable' && tx._class === 'core:class:TxCreateDoc')) {
    lines.push("DELETE FROM model_tx WHERE \"objectId\" = 'tracker:viewlet:IssueStatusTable' AND _class = 'core:class:TxCreateDoc' AND _id NOT LIKE 'fp-%';")
    lines.push('')
  }

  patch.forEach((tx, i) => {
    const modifiedOn = PATCH_EPOCH + i
    // Fanned out across every workspace, which is what the transactor reads per workspace.
    lines.push(`-- ${tx._class} ${tx.objectId}`)
    lines.push(
      'UPSERT INTO model_tx ("workspaceId", _id, _class, space, "modifiedBy", "createdBy",',
      '  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data)',
      'SELECT',
      '  w.uuid,',
      `  '${tx._id}',`,
      `  '${tx._class}',`,
      "  'core:space:Tx',",
      "  'core:account:System',",
      "  'core:account:System',",
      `  ${modifiedOn},`,
      `  ${modifiedOn},`,
      '  NULL,',
      '  NULL,',
      "  'core:space:Model',",
      `  '${tx.objectId}',`,
      `  ${dollarQuote(JSON.stringify(tx.data))}::jsonb`,
      'FROM global_account.workspace w;',
      ''
    )
  })

  lines.push('COMMIT;')
  return lines.join('\n') + '\n'
}

function main () {
  const args = parseArgs(process.argv)
  const base = load(args.base)
  const fork = load(args.fork)
  const { patch, notes, dropped } = buildPatch(base, fork)

  console.log(`base ${base.length} transactions, fork ${fork.length} transactions`)
  for (const note of notes) console.log(`  ${note}`)

  if (dropped.length > 0) {
    console.log(`  ${dropped.length} doc(s) exist in the image model but not in ours; left in place:`)
    for (const objectId of dropped.slice(0, 10)) console.log(`    ${objectId}`)
    if (dropped.length > 10) console.log(`    ... and ${dropped.length - 10} more`)
  }

  if (patch.length > args.max) {
    console.error(
      `\nrefusing to emit ${patch.length} transactions (limit ${args.max}).\n` +
        'A diff this large usually means the base model and this checkout are different\n' +
        'upstream versions. Re-extract the base model from the running transactor, or\n' +
        'raise the limit with --max if the diff is genuinely expected.'
    )
    process.exit(1)
  }

  writeFileSync(args.out, toSql(patch))
  if (args.json !== undefined) writeFileSync(args.json, JSON.stringify(patch, null, 2) + '\n')
  console.log(`\n${patch.length} transaction(s) written to ${args.out}`)
}

main()
