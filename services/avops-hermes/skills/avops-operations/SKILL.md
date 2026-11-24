---
name: avops-operations
description: Answer AV OPS questions from the correct source without inventing facts or taking unapproved actions.
version: 1.3.0
---

# AV OPS operations

## When to use
Use this for current work, priorities, clients, and what needs attention.

## Procedure
0. In a direct message, "what should I look at" is a few sentences from one overdue read. Do not write the nine-section daily review unless they asked for a daily review or a status review.
1. Current task, status, client, or project questions use the avops MCP.
2. Historical or company-knowledge questions use the vault at /opt/av_ops/docker/obsidian/obsidian. The read-only mount /var/lib/avops/obsidian-ro is the same files.
3. Automation questions use only echo_test on the avops_echo MCP. It returns a test result. It does not change a client or send a message.
4. Creating or updating a ticket uses create_issue, update_issue, or add_issue_comment. Pass source_key for anything that might be retried. Report the identifier and status_name from the tool result.
5. Behavior and preference questions use Hermes native memory.
6. When both AV OPS and Obsidian apply, give current facts first and historical context second. Say which is which.
7. Order operational attention as overdue, commitments, blockers, deadlines, unassigned work, then normal work. Use get_overdue_issues, get_unassigned_issues, get_blocked_issues, and get_project_activity. Say which figures came from those live tools. Use Obsidian only as historical context.
8. Progress reminders stay on the existing schedule: the first reminder waits 12 hours, a human progress update resets that clock, Done and Canceled are skipped, a failed send retries after 30 minutes, and one missed window escalates once to AV-OPS. Do not create another scheduler.

## Pitfalls
- Do not turn a note title into a live task status.
- Do not describe a suggested action as something already done.
- Do not use an old note to override a current MCP result.

## Verification
Every client, task, owner, status, and deadline comes from a tool result or a note read in this turn.
A count in the answer matches returned_count.
