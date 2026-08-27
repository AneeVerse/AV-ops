import { AccountRole, AccountUuid, PersonId, Ref, Timestamp, generateId } from '@hcengineering/core'
import calendar from './index'
import type {
  Calendar,
  PrimaryCalendar,
  Event,
  ExternalCalendar,
  ReccuringEvent,
  ReccuringInstance,
  RecurringRule
} from './index'

function getInstance (event: ReccuringEvent, date: Timestamp): ReccuringInstance {
  const diff = event.dueDate - event.date
  return {
    ...event,
    recurringEventId: event.eventId,
    date,
    dueDate: date + diff,
    originalStartTime: date,
    _class: calendar.class.ReccuringInstance,
    eventId: generateEventId(),
    _id: generateId(),
    virtual: true
  }
}

export function generateRecurringValues (
  rule: RecurringRule,
  startDate: Timestamp,
  from: Timestamp,
  to: Timestamp
): Timestamp[] {
  const currentDate = new Date(startDate)
  switch (rule.freq) {
    case 'DAILY':
      return generateDailyValues(rule, currentDate, from, to)
    case 'WEEKLY':
      return generateWeeklyValues(rule, currentDate, from, to)
    case 'MONTHLY':
      return generateMonthlyValues(rule, currentDate, from, to)
    case 'YEARLY':
      return generateYearlyValues(rule, currentDate, from, to)
    default:
      throw new Error('Invalid recurring rule frequency')
  }
}

function generateDailyValues (rule: RecurringRule, currentDate: Date, from: Timestamp, to: Timestamp): Timestamp[] {
  const values: Timestamp[] = []
  const { count, endDate, interval } = rule
  const { bySetPos } = rule
  let i = 0

  while (true) {
    if (bySetPos == null || bySetPos.includes(getSetPos(currentDate))) {
      const res = currentDate.getTime()
      if (currentDate.getTime() > to) break
      if (endDate != null && currentDate.getTime() > endDate) break
      if (res >= from && res <= to) {
        values.push(res)
      }
      i++
    }

    currentDate.setDate(currentDate.getDate() + (interval ?? 1))
    if (count !== undefined && i === count) break
  }
  return values
}

function generateWeeklyValues (rule: RecurringRule, currentDate: Date, from: Timestamp, to: Timestamp): Timestamp[] {
  const values: Timestamp[] = []
  const { count, endDate, interval } = rule
  let { byDay, bySetPos } = rule
  let i = 0

  if (byDay === undefined) {
    byDay = [getWeekday(currentDate)]
  }

  while (true) {
    const next = new Date(currentDate).setDate(currentDate.getDate() + (interval ?? 1) * 7)
    const end = new Date(new Date(currentDate).setDate(currentDate.getDate() + 7))
    let date = currentDate
    while (date < end) {
      if (endDate != null && date.getTime() > endDate) return values
      if (date.getTime() > to) return values
      if ((byDay == null || matchesByDay(date, byDay)) && (bySetPos == null || bySetPos.includes(getSetPos(date)))) {
        const res = date.getTime()
        if (res >= from && res <= to) {
          values.push(res)
        }
        i++
      }
      date = new Date(date.setDate(date.getDate() + 1))
      if (count !== undefined && i === count) return values
    }

    currentDate = new Date(next)
  }
}

function matchesByDay (date: Date, byDay: string[]): boolean {
  const weekday = getWeekday(date)
  const dayOfMonth = Math.floor((date.getDate() - 1) / 7) + 1

  for (const byDayItem of byDay) {
    if (byDayItem === weekday) {
      return true
    }

    const pos = parseInt(byDayItem)
    if (isNaN(pos)) continue

    if (pos > 0 && dayOfMonth === pos) {
      return true
    }

    if (pos < 0 && dayOfMonth === getNegativePosition(date, weekday, pos)) {
      return true
    }
  }

  return false
}

function getNegativePosition (date: Date, weekday: string, pos: number): number | undefined {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const occurrences = []
  for (let day = lastDayOfMonth; day >= 1; day--) {
    const tempDate = new Date(date.getFullYear(), date.getMonth(), day)
    if (getWeekday(tempDate) === weekday) {
      occurrences.push(day)
    }
    if (occurrences.length === Math.abs(pos)) {
      return occurrences.pop()
    }
  }
  throw new Error(`Unable to calculate negative position ${pos}`)
}

function generateMonthlyValues (rule: RecurringRule, currentDate: Date, from: Timestamp, to: Timestamp): Timestamp[] {
  const values: Timestamp[] = []
  const { count, endDate, interval } = rule
  let { byDay, byMonthDay, bySetPos } = rule
  let i = 0

  if (byDay == null && byMonthDay == null) {
    byMonthDay = [currentDate.getDate()]
  }

  while (true) {
    const next = new Date(currentDate).setMonth(currentDate.getMonth() + (interval ?? 1), 1)
    const end = new Date(new Date(currentDate).setMonth(currentDate.getMonth() + 1, 1))
    let date = currentDate
    const candidates: Date[] = []

    // If no specific rules are set except byMonthDay (simple monthly recurrence)
    if (byDay == null && bySetPos == null && byMonthDay != null) {
      for (const day of byMonthDay) {
        const originalDate = new Date(currentDate.getTime())
        const sameDate = new Date(
          Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth(),
            day,
            originalDate.getUTCHours(),
            originalDate.getUTCMinutes(),
            originalDate.getUTCSeconds(),
            originalDate.getUTCMilliseconds()
          )
        )
        if (sameDate.getUTCMonth() === currentDate.getUTCMonth()) {
          // Valid day for this month
          candidates.push(sameDate)
        }
      }
    } else {
      while (date < end) {
        if (
          (byDay == null || matchesByDay(date, byDay)) &&
          (byMonthDay == null || byMonthDay.includes(date.getDate()))
        ) {
          candidates.push(new Date(date))
        }
        date = new Date(date.setDate(date.getDate() + 1))
      }
    }

    let filtered: Date[] = candidates
    if (bySetPos != null) {
      filtered = bySetPos
        .map((pos) => {
          if (pos === 0) return null // invalid
          const index = pos > 0 ? pos - 1 : candidates.length + pos
          return candidates[index] ?? null
        })
        .filter((d): d is Date => d != null)
    }

    for (const d of filtered) {
      const res = d.getTime()
      if (res >= from && res <= to) {
        values.push(res)
        i++
        if (count !== undefined && i === count) return values
      }
    }
    if (endDate != null && next > endDate) return values
    if (next >= to) return values
    currentDate = new Date(next)
  }
}

function generateYearlyValues (rule: RecurringRule, currentDate: Date, from: Timestamp, to: Timestamp): Timestamp[] {
  const values: Timestamp[] = []
  const { count, endDate, interval } = rule
  const { byDay, byMonthDay, byYearDay, byWeekNo, byMonth, bySetPos } = rule
  let i = 0

  while (true) {
    const next = new Date(currentDate).setFullYear(currentDate.getFullYear() + (interval ?? 1), 0, 1)
    const end = new Date(new Date(currentDate).setFullYear(currentDate.getFullYear() + 1, 0, 1))
    let date = currentDate
    const candidates: Date[] = []

    // If no specific rules are set, only generate an event for the same month/day each year
    if (
      byDay == null &&
      byMonthDay == null &&
      byYearDay == null &&
      byWeekNo == null &&
      byMonth == null &&
      bySetPos == null
    ) {
      const originalDate = new Date(currentDate.getTime())
      const sameDate = new Date(
        Date.UTC(
          currentDate.getUTCFullYear(),
          originalDate.getUTCMonth(),
          originalDate.getUTCDate(),
          originalDate.getUTCHours(),
          originalDate.getUTCMinutes(),
          originalDate.getUTCSeconds(),
          originalDate.getUTCMilliseconds()
        )
      )
      candidates.push(sameDate)
    } else {
      while (date < end) {
        if (
          (byDay == null || matchesByDay(date, byDay)) &&
          (byMonthDay == null || byMonthDay.includes(date.getDate())) &&
          (byYearDay == null || byYearDay.includes(getYearDay(date))) &&
          (byWeekNo == null || byWeekNo.includes(getWeekNumber(date))) &&
          (byMonth == null || byMonth.includes(date.getMonth()))
        ) {
          const res = date.getTime()
          if (res >= from && res <= to) {
            candidates.push(new Date(res))
          }
          i++
        }
        date = new Date(date.setDate(date.getDate() + 1))
      }
    }

    let filtered: Date[] = candidates
    if (bySetPos != null) {
      filtered = bySetPos
        .map((pos) => {
          if (pos === 0) return null // invalid
          const index = pos > 0 ? pos - 1 : candidates.length + pos
          return candidates[index] ?? null
        })
        .filter((d): d is Date => d != null)
    }

    for (const d of filtered) {
      const res = d.getTime()
      if (res >= from && res <= to) {
        values.push(res)
        i++
        if (count !== undefined && i === count) return values
      }
    }
    if (endDate != null && next > endDate) return values
    if (next >= to) return values
    currentDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + (interval ?? 1)))
  }
}

function getSetPos (date: Date): number {
  const month = date.getMonth()
  const year = date.getFullYear()
  const firstOfMonth = new Date(year, month, 1)
  const daysOffset = firstOfMonth.getDay()
  const day = date.getDate()

  return Math.ceil((day + daysOffset) / 7)
}

/**
 * @public
 */
export function getWeekday (date: Date): string {
  const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
  const weekday = weekdays[date.getDay()]

  return weekday
}

function getWeekNumber (date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const daysOffset = firstDayOfYear.getDay()
  const diff = (date.getTime() - firstDayOfYear.getTime()) / 86400000

  return Math.floor((diff + daysOffset + 1) / 7)
}

function getYearDay (date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - startOfYear.getTime()

  return Math.floor(diff / 86400000)
}

function getReccuringEventInstances (
  event: ReccuringEvent,
  instances: ReccuringInstance[],
  from: Timestamp,
  to: Timestamp
): ReccuringInstance[] {
  let res: ReccuringInstance[] = []
  for (const rule of event.rules ?? []) {
    const values = generateRecurringValues(rule, event.date, from, to)
    for (const val of values) {
      const instance = getInstance(event, val)
      res.push(instance)
    }
  }
  for (const date of event.rdate ?? []) {
    if (date < from || date > to) continue
    const instance = getInstance(event, date)
    const exists = res.find((p) => p.date === instance.date)
    if (exists === undefined) res.push(instance)
  }

  const excludes = new Set(event.exdate ?? [])
  res = res.filter((p) => !excludes.has(p.date))
  res = res.filter((i) => {
    const override = instances.find((p) => p.originalStartTime === i.originalStartTime)
    return override === undefined
  })
  return res
}

/**
 * @public
 */
export function getAllEvents (events: Event[], from: Timestamp, to: Timestamp): Event[] {
  const base: Event[] = []
  const recur: ReccuringEvent[] = []
  const instances: ReccuringInstance[] = []
  const recurData: ReccuringInstance[] = []
  const instancesMap = new Map<string, ReccuringInstance[]>()
  for (const event of events) {
    if (event._class === calendar.class.ReccuringEvent) {
      recur.push(event as ReccuringEvent)
    } else if (event._class === calendar.class.ReccuringInstance) {
      const instance = event as ReccuringInstance
      instances.push(instance)
      const arr = instancesMap.get(instance.recurringEventId) ?? []
      arr.push(instance)
      instancesMap.set(instance.recurringEventId, arr)
    } else {
      if (from >= event.dueDate) continue
      if (event.date >= to) continue

      base.push(event)
    }
  }
  for (const rec of recur) {
    const recEvents = getReccuringEventInstances(rec, instancesMap.get(rec.eventId) ?? [], from, to)
    recurData.push(...recEvents)
  }
  const res = [
    ...base,
    ...recurData,
    ...instances.filter((p) => {
      return from <= p.dueDate && p.date <= to && p.isCancelled !== true
    })
  ].map((it) => ({ ...it, date: Math.max(from, it.date), dueDate: Math.min(to, it.dueDate) }))
  res.sort((a, b) => a.date - b.date)
  return res
}

/**
 * Placeholder written when the user asks for a video meeting before Google
 * has assigned a Meet URL. The calendar service turns this into conferenceData
 * and replaces it with the real hangoutLink.
 *
 * @public
 */
export const GOOGLE_MEET_PLACEHOLDER = 'https://meet.google.com'

/**
 * Google Calendar event IDs must be base32hex (`[a-v0-9]{5,1024}`). Huly's
 * generateId() is already hex; prefix a letter because Google rejects some
 * digit-leading ids with "Invalid resource id value".
 *
 * @public
 */
export function generateEventId (): string {
  const body = generateId()
    .toLowerCase()
    .replace(/[^0-9a-v]/g, '')
  const id = (body.length >= 5 ? body : (body + '00000').slice(0, 5)).slice(0, 1024)
  return /^[0-9]/.test(id) ? `e${id}`.slice(0, 1024) : id
}

/**
 * @public
 */
export function isGoogleMeetPlaceholder (location?: string | null): boolean {
  if (location == null) return false
  const normalized = location.trim().replace(/\/+$/, '')
  return normalized === GOOGLE_MEET_PLACEHOLDER || normalized === `${GOOGLE_MEET_PLACEHOLDER}/new`
}

/**
 * First joinable meeting URL found in the given strings (location, description, …).
 * The Meet placeholder is not joinable yet.
 *
 * @public
 */
export function getMeetingJoinUrl (...texts: Array<string | null | undefined>): string | undefined {
  for (const text of texts) {
    if (text == null || text === '') continue
    if (isGoogleMeetPlaceholder(text)) continue
    const meet = text.match(/https?:\/\/meet\.google\.com\/[a-z0-9][a-z0-9-]+/i)
    if (meet != null) return meet[0]
    const zoom = text.match(/https?:\/\/[\w.-]*zoom\.us\/j\/[^\s<"']+/i)
    if (zoom != null) return zoom[0].replace(/[)">\]]+$/, '')
    const teams = text.match(/https?:\/\/teams\.(microsoft|live)\.com\/[^\s<"']+/i)
    if (teams != null) return teams[0].replace(/[)">\]]+$/, '')
  }
  const location = texts[0]
  if (
    location != null &&
    /^https?:\/\//i.test(location.trim()) &&
    !isGoogleMeetPlaceholder(location)
  ) {
    return location.trim()
  }
  return undefined
}

/**
 * @public
 */
export function isJoinableMeetingUrl (location?: string | null): boolean {
  return getMeetingJoinUrl(location) !== undefined
}

export function getPrimaryCalendar (
  calendars: Calendar[],
  preference: PrimaryCalendar | undefined,
  acc: AccountUuid
): Ref<Calendar> {
  const googleDefault = calendars.find(
    (c) => c._class === calendar.class.ExternalCalendar && !c.hidden && (c as ExternalCalendar).default
  )
  if (googleDefault !== undefined) return googleDefault._id
  const google = calendars.find((c) => c._class === calendar.class.ExternalCalendar && !c.hidden)
  if (google !== undefined) return google._id
  if (preference?.attachedTo !== undefined) {
    const pref = calendars.find((p) => p._id === preference.attachedTo)
    if (pref !== undefined) return pref._id
  }
  return `${acc}_calendar` as Ref<Calendar>
}

/**
 * Calendars this account can use: personal Huly calendar, calendars they own,
 * Google calendars whose email matches theirs, or (workspace owner/maintainer)
 * any writable Google calendar in the workspace.
 *
 * @public
 */
export function isAccountCalendar (
  _calendar: Calendar,
  acc: {
    uuid: AccountUuid
    socialIds: PersonId[]
    fullSocialIds?: Array<{ value?: string, key?: string, displayValue?: string, _id?: PersonId }>
    role?: AccountRole
  }
): boolean {
  const ids = new Set(acc.socialIds ?? [])
  const emails = new Set<string>()
  for (const s of acc.fullSocialIds ?? []) {
    if (s._id !== undefined) ids.add(s._id)
    if (s.value != null && s.value !== '') emails.add(s.value.toLowerCase())
    if (s.displayValue != null && s.displayValue !== '') emails.add(s.displayValue.toLowerCase())
    const key = s.key?.toLowerCase() ?? ''
    const fromKey = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key
    if (fromKey.includes('@')) emails.add(fromKey)
  }
  if (_calendar._id === (`${acc.uuid}_calendar` as Ref<Calendar>)) return true
  if (ids.has(_calendar.user)) return true
  if (_calendar.createdBy !== undefined && ids.has(_calendar.createdBy)) return true
  const externalUser = (_calendar as ExternalCalendar).externalUser
  if (externalUser != null && emails.has(externalUser.toLowerCase())) return true
  const isAdmin = acc.role === AccountRole.Owner || acc.role === AccountRole.Maintainer
  if (isAdmin && _calendar._class === calendar.class.ExternalCalendar) {
    const access = _calendar.access
    if (access === 'owner' || access === 'writer' || access === 'reader' || access === 'freeBusyReader') {
      return true
    }
  }
  return false
}
