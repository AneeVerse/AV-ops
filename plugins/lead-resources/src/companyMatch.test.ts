import { organizationsMatching, uniqueProjectIdentifier } from './companyMatch'

describe('company search', () => {
  const orgs = [{ name: 'Chheda Ply & Laminate' }, { name: 'HORECA1' }]

  it('matches a company by part of its name', () => {
    expect(organizationsMatching(orgs, 'chheda').map((org) => org.name)).toEqual(['Chheda Ply & Laminate'])
  })

  it('returns nothing for a blank search', () => {
    expect(organizationsMatching(orgs, '  ')).toEqual([])
  })
})

describe('project identifier', () => {
  it('keeps the identifier to five characters and skips ones already used', () => {
    expect(uniqueProjectIdentifier('Chheda Ply', [])).toBe('CHHED')
    expect(uniqueProjectIdentifier('Chheda Ply', ['CHHED'])).toBe('CHHE2')
  })
})
