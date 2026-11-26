/**
 * Group company names that collapse to the same letters and digits.
 * This report never deletes a company.
 */
export function normalizeCompanyName (name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function duplicateCompanyGroups (names: string[]): string[][] {
  const groups = new Map<string, string[]>()
  for (const name of names) {
    const key = normalizeCompanyName(name)
    if (key === '') continue
    const list = groups.get(key) ?? []
    list.push(name)
    groups.set(key, list)
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

/** Case-insensitive name search. The caller must confirm use-this or create-new. */
export function organizationsMatching<T extends { name: string }> (orgs: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  return orgs.filter((org) => org.name.toLowerCase().includes(needle))
}

/** Tracker identifiers are at most 5 letters or digits. */
export function uniqueProjectIdentifier (name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((id) => id.toUpperCase()))
  const base = (name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 5) || 'PRJ')
  if (!used.has(base)) return base
  for (let n = 2; n < 1000; n++) {
    const suffix = String(n)
    const candidate = (base.slice(0, Math.max(1, 5 - suffix.length)) + suffix).slice(0, 5)
    if (!used.has(candidate)) return candidate
  }
  return 'PRJ'
}
