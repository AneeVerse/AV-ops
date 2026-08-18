#!/usr/bin/env bash
set -euo pipefail
docker exec -i huly_v7-transactor-1 node <<'NODE'
const fs = require('fs')
const model = JSON.parse(fs.readFileSync('model.json', 'utf8'))
const docs = Array.isArray(model) ? model : (model.docs || model.transactions || model)
function walk(x, acc) {
  if (x == null) return
  if (Array.isArray(x)) { x.forEach(v => walk(v, acc)); return }
  if (typeof x === 'object') {
    if (x._id === 'tracker:viewlet:IssueList' || x._id === 'lead:viewlet:TableLead' || x._id === 'lead:viewlet:DashboardLead' || x._id === 'task:viewlet:StatusTable') acc.push(x)
    if (x.objectId === 'tracker:viewlet:IssueList' || x.objectId === 'lead:viewlet:TableLead') acc.push(x)
    for (const k of Object.keys(x)) walk(x[k], acc)
  }
}
const acc = []
walk(docs, acc)
const seen = new Set()
for (const d of acc) {
  const key = JSON.stringify(d).slice(0, 80)
  if (seen.has(key)) continue
  seen.add(key)
  console.log(JSON.stringify(d, null, 2).slice(0, 1500))
  console.log('----')
}
console.log('keys', model && typeof model === 'object' && !Array.isArray(model) ? Object.keys(model) : 'array len ' + (docs && docs.length))
NODE
