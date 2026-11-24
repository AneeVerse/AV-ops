---
name: avops-task-review
description: Report overdue, blocked, and unassigned AV OPS issues using returned_count.
version: 1.1.0
---

# Task review

## When to use
Use this for overdue work, blocked work, unassigned work, or one person's tasks.

## Procedure
1. Use the avops MCP. Do not guess from memory or from Obsidian alone.
2. For overdue, call get_overdue_issues. For unassigned, call get_unassigned_issues. For blocked, call get_blocked_issues. For one person, call get_person_work.
3. Start the answer with returned_count from that tool.
4. When returned_count is 20 or less, list every record with identifier, title, project, assignee, and due date when the tool returned them. Use status_name for the status. If status_name is null, say the status name was not returned.
5. If you show a subset, write "Showing X of Y returned records."
6. Blocked means blockedBy is non-empty. Do not invent a status named Blocked.

## Pitfalls
- A note about a task is not the live task.
- Do not change status, owner, or deadline.
- Do not report zero when returned_count is greater than zero.

## Verification
The count in the answer equals returned_count, and the listed identifiers are the ones in items.
