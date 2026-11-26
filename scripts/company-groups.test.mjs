import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCompanyReport, normalizeCompanyName } from './company-groups.mjs'

test('private limited collapses onto the short name', () => {
  assert.equal(normalizeCompanyName('LINYCON PRIVATE LIMITED'), normalizeCompanyName('LINYCON'))
})

test('seeded pairs group even when the letters differ', () => {
  const report = buildCompanyReport([
    { _id: 'a', name: 'EAZYVISA' },
    { _id: 'b', name: 'ezvisas1' },
    { _id: 'c', name: 'OCEAN9' },
    { _id: 'd', name: 'ocean1' },
    { _id: 'e', name: '1FC' },
    { _id: 'f', name: '1FC' },
    { _id: 'g', name: 'ssss' }
  ])
  const names = report.groups.map((group) => group.companies.map((org) => org.name).sort())
  assert.deepEqual(names.find((group) => group.includes('EAZYVISA')), ['EAZYVISA', 'ezvisas1'])
  assert.deepEqual(names.find((group) => group.includes('OCEAN9')), ['OCEAN9', 'ocean1'])
  assert.equal(report.groups.filter((group) => group.companies.some((org) => org.name === '1FC')).length, 1)
  assert.deepEqual(report.tests.map((org) => org.name), ['ssss'])
})
