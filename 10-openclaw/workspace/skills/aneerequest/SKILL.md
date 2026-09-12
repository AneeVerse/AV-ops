---
name: aneerequest
description: Plan and safely write aneeverse.com request-management work in Supabase using the Client -> Request -> Task model. Use when creating, mapping, reviewing, or inserting clients, requests, and tasks for the Aneerequest system; when converting raw user instructions into structured request/task plans; or when writing approved task structures into Supabase with required task_request_links handling.
---

# Aneerequest

Use this skill for Aneerequest work that must follow the business structure exactly.

## Core model

Always use:
- Client -> Request -> Task

Never flatten this into ad-hoc project/task structures.

## Non-negotiable rules

- Client means company, not person.
- Prefer an existing relevant request first.
- If no relevant request exists, use the client's `00-Updates-Followups` request.
- If neither is appropriate, propose creating a new request.
- For UI visibility, do not rely only on `tasks.request_id`.
- Always ensure `task_request_links` is created for every task written.
- In safe mode, plan first and ask before writing.

## Required workflow

1. Identify the client.
2. Identify whether the request already exists.
3. Break work into clear tasks.
4. Decide task placement using the request-selection rule.
5. Show the structured plan.
6. In safe mode, ask for approval before any Supabase write.
7. If approved, write `tasks.request_id` and matching `task_request_links` rows.

## When planning

Include:
- client name
- target request
- whether request already exists or needs creation
- task list
- suggested assignee if clear
- any ambiguity or missing fields

## When writing

Write only after explicit user approval in safe mode.

Before writing, confirm:
- client matched correctly
- request target is correct
- new request creation is approved if needed
- task breakdown is final

## References

Read these when needed:
- `references/schema.md` for business rules and schema reminders
- `references/workflow.md` for planning and safe-write flow
- `references/raw-text-template.md` when converting messy user instructions into a structured write plan

## Raw text planning

If the user gives an unstructured request, first convert it into a structured plan.

Extract:
- client
- likely request target
- task list
- assignee suggestions if clear
- ambiguity notes

Then present the plan in safe mode before writing.

## Scripts

Use deterministic scripts in `scripts/` for repeatable Supabase writes instead of re-inventing insert logic each time.

Primary scripts:
- `scripts/aneerequest_plan_builder.py`
- `scripts/aneerequest_writer.py`

Capabilities:
- client lookup
- request lookup
- default request fallback handling
- optional request creation after approval
- task insertion
- `task_request_links` insertion
- dry-run output before write

Use `references/plan-example.json` as the plan shape example when preparing a write payload.
