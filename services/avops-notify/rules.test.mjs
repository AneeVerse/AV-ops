import assert from 'node:assert/strict'
import test from 'node:test'
import { estimationMs, reminderDue, rollupDue } from './rules.mjs'

const hour = 60 * 60 * 1000
// Wednesday 26 Nov 2026 12:00 IST = 06:30 UTC
const noon = Date.parse('2026-11-26T06:30:00Z')

test('an estimate of 1 hour is not due before 1 hour 45', () => {
  const issue = { estimation: 1, assignee: 'p', assignedAt: noon - (1 * hour), done: false }
  assert.equal(reminderDue(issue, noon), false)
})

test('a reminder is due after the estimate plus 45 minutes', () => {
  const issue = { estimation: 1, assignee: 'p', assignedAt: noon - (2 * hour), done: false }
  assert.equal(reminderDue(issue, noon), true)
})

test('a status update stops the next reminder', () => {
  const assignedAt = noon - (2 * hour)
  const issue = { estimation: 1, assignee: 'p', assignedAt, assigneeUpdatedOn: assignedAt + 1000, done: false }
  assert.equal(reminderDue(issue, noon), false)
})

test('a second run inside 4 hours does not send', () => {
  const issue = {
    estimation: 1,
    assignee: 'p',
    assignedAt: noon - (3 * hour),
    lastRemindedOn: noon - hour,
    done: false
  }
  assert.equal(reminderDue(issue, noon), false)
})

test('an estimate of 0 never sends', () => {
  assert.equal(estimationMs(0), 0)
  assert.equal(reminderDue({ estimation: 0, assignee: 'p', assignedAt: noon - hour, done: false }, noon), false)
})

test('the weekday rollup runs once after 10:15 IST', () => {
  assert.equal(rollupDue(Date.parse('2026-11-26T04:40:00Z'), null), false)
  assert.equal(rollupDue(noon, null), true)
  assert.equal(rollupDue(noon, noon - hour), false)
  assert.equal(rollupDue(Date.parse('2026-11-28T06:30:00Z'), null), false)
})
