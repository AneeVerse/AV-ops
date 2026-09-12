# Reminder System - AV_BOT

## Purpose
Use PostgreSQL reminders as AV_BOT's structured reminder/task-followup store.

## Core reminder fields
- `title`
- `detail`
- `due_at`
- `status`
- `source`
- `metadata`

## Reminder statuses
- `pending`
- `in_progress`
- `done`
- `cancelled`
- `missed`

## Rules
1. Create reminders for important future follow-up.
2. Use `metadata` for context, not for the main reminder sentence.
3. Mark reminders done/cancelled when resolved.
4. Query pending reminders regularly.
5. Use DB reminders as the structured layer; cron/chat reminders can still exist separately.

## Typical uses
- business follow-ups
- audit follow-ups
- callback/checkback items
- internal admin reminders
- setup/deployment follow-ups
