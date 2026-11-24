export const TEST_SPACE = 'spaces/AAQAOk6L6k8'
export const SECRET_SPACE = 'spaces/AAQACOxtNdo'
export const HHH_PROJECT = '6a8c53061ef180e2f642bee2'

const PROJECT_BY_NAME = {
  'av-ops': 'ANEES',
  'cultura jewels (website)': 'CULTU',
  'cultura jewels etsy': 'CULTU',
  ocean9: 'OCE9',
  'mercury amazon': 'MERC',
  '5starforyou amazon': 'AMAZO',
  'book my cooperate party (bmcp)': 'BMCP',
  horeca1: 'HHH',
  'jm visa services': 'JMVIS',
  'rocket singh': 'ROCKE'
}

export function isSensitive (name, id) {
  if (id === SECRET_SPACE) return true
  return /password|token|keys/i.test(name || '')
}

export function isDatedMeeting (name) {
  const value = String(name || '').trim()
  if (!value) return false
  if (/^AV[\s-]*Daily Sync/i.test(value)) return true
  if (/^AV\s*-\s*Evening Daily Sync/i.test(value)) return true
  if (/^Day Planing/i.test(value)) return true
  if (/^Lunch/i.test(value)) return true
  return / - \d{1,2} [A-Za-z]{3,9}$/.test(value)
}

export function classifySpace (space) {
  const name = space.display_name || space.displayName || ''
  const id = space.name || ''
  const type = space.type || space.spaceType || ''
  if (isSensitive(name, id)) {
    return { role: 'excluded', reason: 'space name indicates credentials' }
  }
  if (type === 'DIRECT_MESSAGE') {
    return { role: 'excluded', reason: 'direct message' }
  }
  if (type === 'GROUP_CHAT' || !name) {
    return { role: 'excluded', reason: 'unnamed group chat' }
  }
  if (type && type !== 'SPACE') {
    return { role: 'excluded', reason: 'not a named company space' }
  }
  if (!space.user_visible) {
    return { role: 'admin-only', reason: 'visible to the Chat admin search only; Anees is not a member' }
  }
  if (isDatedMeeting(name)) {
    return { role: 'history-only', reason: 'dated meeting room; the app is not added and tickets are not created' }
  }
  const project = PROJECT_BY_NAME[name.trim().toLowerCase()] || null
  return { role: 'operate', reason: 'standing company space', project }
}
