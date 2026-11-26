/** Pure timing rules for staff Chat reminders. Asia/Kolkata. No network. */

const FORTY_FIVE_MIN = 45 * 60 * 1000
const FOUR_HOURS = 4 * 60 * 60 * 1000

export function estimationMs (estimation) {
  const n = Number(estimation)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n < 1000 ? n * 60 * 60 * 1000 : n
}

export function kolkataParts (now) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map((part) => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday
  }
}

export function inReminderWindow (now) {
  const { hour } = kolkataParts(now)
  return hour >= 10 && hour < 19
}

export function reminderDue (issue, now) {
  if (!inReminderWindow(now)) return false
  const duration = estimationMs(issue.estimation)
  if (duration <= 0 || !issue.assignee || !issue.assignedAt) return false
  if (issue.done) return false
  if (issue.assigneeUpdatedOn != null && issue.assigneeUpdatedOn >= issue.assignedAt) return false
  if (now < issue.assignedAt + duration + FORTY_FIVE_MIN) return false
  if (issue.lastRemindedOn != null && now - issue.lastRemindedOn < FOUR_HOURS) return false
  const day = kolkataParts(now).date
  const count = issue.reminderDay === day ? Number(issue.reminderCount) || 0 : 0
  return count < 3
}

export function rollupDue (now, lastRollupOn) {
  const parts = kolkataParts(now)
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return false
  if (parts.hour < 10 || (parts.hour === 10 && parts.minute < 15)) return false
  if (lastRollupOn == null) return true
  return kolkataParts(lastRollupOn).date !== parts.date
}

export function staffEmail (value) {
  const email = String(value || '').trim().toLowerCase()
  return email.endsWith('@aneeverse.com') ? email : ''
}

export function assignText (issue) {
  const due = issue.dueDate
    ? new Date(issue.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'no due date'
  return `${issue.identifier || issue._id}: ${issue.title || 'Task'} is assigned to you. Due ${due}.`
}

export function rollupBody (company, issues, now) {
  const day = kolkataParts(now).date
  const open = issues.filter((issue) => !issue.done)
  const due = open.filter((issue) => issue.dueDate && kolkataParts(issue.dueDate).date <= day)
  const finished = issues.filter((issue) => issue.done && issue.modifiedOn && kolkataParts(issue.modifiedOn).date === day)
  const lines = [`${company}: ${open.length} open, ${due.length} due or overdue, ${finished.length} finished today, ${open.length} remaining.`]
  const grouped = new Map()
  for (const issue of open) {
    const key = issue.assigneeEmail || 'unassigned'
    const list = grouped.get(key) || []
    list.push(issue.identifier || issue.title || issue._id)
    grouped.set(key, list)
  }
  for (const [person, titles] of grouped) {
    lines.push(`${person}: ${titles.join(', ')}. Please post a status update.`)
  }
  return lines.join('\n').slice(0, 900)
}
