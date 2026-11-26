/** Repeat an estimate reminder this often once the estimate has passed and the status has not changed. */
export const ESTIMATE_REPEAT_MS = 45 * 60 * 1000

export function estimateDurationMs (estimation) {
  const n = Number(estimation)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n < 1000 ? n * 60 * 60 * 1000 : n
}

export function trackEstimate (ticket, statusName, estimation, now) {
  const duration = estimateDurationMs(estimation)
  if (duration <= 0) return ticket
  if (ticket.estimate_status !== statusName || !ticket.estimate_due) {
    ticket.estimate_status = statusName
    ticket.estimate_due = new Date(now + duration).toISOString()
  }
  return ticket
}

export function reminderDelayMs (ticket, now, fallbackMs) {
  const due = Date.parse(ticket?.estimate_due || '')
  if (Number.isFinite(due) && now >= due) return ESTIMATE_REPEAT_MS
  return fallbackMs
}

export function rollupText (company, rows) {
  const open = rows.filter((row) => row.open)
  const due = open.filter((row) => row.due)
  const finished = rows.filter((row) => !row.open)
  const who = open.map((row) => `${row.identifier}: ${row.assignee || 'unassigned'}`).join(', ')
  return [
    `${company}: ${open.length} open, ${due.length} due, ${finished.length} finished.`,
    who === '' ? 'Nobody is assigned.' : who
  ].join(' ')
}
