/** Read-only company grouping. This never deletes or updates a company. */

export function normalizeCompanyName (name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\bprivate\s+limited\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

function rawKey (name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export const SEED_GROUPS = [
  ['1fc'],
  ['horeca1'],
  ['linycon', 'linycon private limited'],
  ['eazyvisa', 'ezvisas1'],
  ['ocean9', 'ocean1']
]

export const TEST_NAMES = ['ssss', 'sv marines', 'saad services', 'maat', 'uroniyx']

function orgsInSeed (orgs, seeds) {
  const seedRaw = new Set(seeds.map(rawKey))
  const seedNorm = new Set(seeds.map(normalizeCompanyName))
  return orgs.filter((org) => seedRaw.has(rawKey(org.name)) || seedNorm.has(normalizeCompanyName(org.name)))
}

export function buildCompanyReport (orgs) {
  const byNorm = new Map()
  for (const org of orgs) {
    const key = normalizeCompanyName(org.name)
    if (key === '') continue
    const list = byNorm.get(key) ?? []
    list.push(org)
    byNorm.set(key, list)
  }
  const groups = []
  const seen = new Set()
  const addGroup = (list, reason) => {
    const ids = [...new Set(list.map((org) => org._id))].sort()
    if (ids.length < 2) return
    const key = ids.join('|')
    if (seen.has(key)) return
    seen.add(key)
    groups.push({
      reason,
      companies: ids.map((id) => list.find((org) => org._id === id))
    })
  }
  for (const list of byNorm.values()) addGroup(list, 'normalized name')
  for (const seeds of SEED_GROUPS) addGroup(orgsInSeed(orgs, seeds), 'seeded pair')
  const tests = orgs.filter((org) => TEST_NAMES.includes(rawKey(org.name)))
  return { groups, tests }
}
