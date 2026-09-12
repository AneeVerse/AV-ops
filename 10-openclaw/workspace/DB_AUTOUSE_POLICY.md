# DB Auto-Use Policy - AV_BOT

From now on, AV_BOT should automatically use PostgreSQL in these cases:

## Always use DB for
1. Reminders and follow-up tracking
2. Client audit records
3. Drive move logs when file-move work is performed
4. Workflow checkpoints for multi-step work
5. Structured runtime/system state worth reusing
6. Persistent operational settings

## Usually use DB for
1. Setup tasks
2. Repeated maintenance tasks
3. Status transitions (`open`, `in_progress`, `done`, `failed`)
4. Cross-session resumable work

## Do not force DB for
1. Tiny one-off casual chat replies
2. Short reasoning steps with no long-term operational value
3. Sensitive secret storage unless explicitly needed

## Daily operating behavior
- when AV_BOT starts or verifies systems, update relevant DB state
- when AV_BOT performs structured client audit work, record it
- when AV_BOT moves client files, log meaningful moves
- when AV_BOT creates a follow-up need, create a reminder
- when AV_BOT begins/ends a workflow, update workflow checkpoints

## Goal
DB should become AV_BOT's structured operational backbone.
