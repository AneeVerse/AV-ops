# DB Workflows - AV_BOT

## Rule from now on
AV_BOT should use PostgreSQL as part of daily operational workflows for structured state, auditability, and resumable work.

## Use DB for these daily workflows

### 1. Runtime state tracking
Store/update in DB:
- active model/profile snapshot
- important setup state
- current workflow focus
- important system status snapshots

Primary tables:
- `state_store`
- `persistent_settings`
- `session_facts`

### 2. Operational logging
Store meaningful operational actions in DB:
- setup tasks
- maintenance tasks
- failed tasks
- completed workflows
- important decisions that benefit from structure

Primary table:
- `task_log`

### 3. Drive/client audit work
Store:
- client audit summaries
- sensitive-file decisions
- file move logs
- unresolved audit findings

Primary tables:
- `client_audits`
- `drive_moves`
- `workflow_checkpoints`

### 4. Reminder/follow-up work
Store:
- reminders
- due dates
- follow-up status
- reminder metadata

Primary table:
- `reminders`

## DB-first operating rule
When work is:
- structured
- repeatable
- resumable
- worth tracking over time

prefer PostgreSQL over ad-hoc temporary memory.

## File memory vs DB memory
Use file memory for:
- narrative continuity
- human-readable long-term notes
- cross-session context summaries

Use DB for:
- structured operational state
- audit logs
- reminders
- checkpoints
- queryable workflow data

## Current systems to build on DB
1. Client Audit Tracker
2. Reminder System

## Implementation order chosen
1. Use DB in daily workflows from now on
2. Add more helper commands for real operations
3. Start building specific AV_BOT systems on top of it
4. Build Client Audit Tracker
5. Build Reminder System
