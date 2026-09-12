# AV_BOT DB Usage Convention

## Purpose
This PostgreSQL database is AV_BOT's structured operational memory/state store.

## Connection source
Read credentials from `/root/.env` using these keys:
- `AV_BOT_PGHOST`
- `AV_BOT_PGPORT`
- `AV_BOT_PGDATABASE`
- `AV_BOT_PGUSER`
- `AV_BOT_PGPASSWORD`

## Table conventions

### `persistent_settings`
Use for durable system preferences and global settings.
- key = stable setting name
- value = jsonb payload

Examples:
- `model_policy`
- `drive_rules`
- `assistant_preferences`

### `state_store`
Use for small mutable key-value runtime state.
- key = unique state key
- value = jsonb

Examples:
- `postgres_connection_status`
- `last_drive_audit`
- `current_focus`

### `memory_notes`
Use for structured notes worth storing outside flat files.
- scope = general/client/project/session/etc.
- title = short label
- body = actual note
- tags = searchable labels
- source = where it came from

### `task_log`
Use for operational tasks and execution log.
- kind = reminder/audit/maintenance/setup/etc.
- title = task title
- detail = extra text
- status = open/in_progress/done/failed/cancelled
- metadata = structured context

### `drive_moves`
Use for Google Drive file move audit trail.
- client_name = client
- file_name = moved file
- from_path / to_path = logical paths
- classification = sensitive/project/unclear/etc.
- metadata = extra context

### `client_audits`
Use for client-level audits.
- audit_type = drive_audit/folder_check/security/review/etc.
- summary = short text
- findings = jsonb details

Client Audit Tracker convention:
- one row per audit event/checkpoint
- use `findings.status` for: `clean`, `issues_found`, `fixed`, `needs_review`
- use `findings.issue_count` for quick count
- use `findings.issues` as an array of structured issue objects
- use `findings.actions` as an array of corrective steps/moves
- use `findings.scope` for audit scope such as `projects_folder`, `files_folder`, `whole_drive`

### `session_facts`
Use for reusable facts tied to a session.
- unique on `(session_key, fact_key)`
- store jsonb in `fact_value`

### `workflow_checkpoints`
Use for long-running workflow state.
- workflow_name = stable workflow id
- checkpoint_key = stage/key
- checkpoint_value = jsonb
- status = active/done/failed/archived

### `reminders`
Use for reminder/task scheduling records.
- title/detail
- due_at
- status
- metadata

## Operating rules
1. Prefer `persistent_settings` for durable global rules.
2. Prefer `state_store` for mutable latest-state snapshots.
3. Prefer `task_log` for action history.
4. Prefer `drive_moves` for file move traceability.
5. Prefer `workflow_checkpoints` for resumable workflows.
6. Use jsonb for structured data; keep keys stable.
7. Do not store raw secrets in normal rows unless explicitly required.
8. Use database records as operational memory, not as a replacement for all file-based memory.

## Status vocabulary
Preferred statuses:
- `pending`
- `open`
- `in_progress`
- `done`
- `failed`
- `cancelled`
- `archived`

## Suggested key naming
- lowercase snake_case for keys
- stable names, no timestamps in keys unless necessary

Examples:
- `postgres_connection_status`
- `codex_profile_switcher`
- `drive_sensitive_rules`
