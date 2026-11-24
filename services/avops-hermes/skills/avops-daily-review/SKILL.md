---
name: avops-daily-review
description: Produce one manual AV OPS daily review from live MCP results and selective Obsidian context.
version: 1.3.0
---

# Daily review

## When to use
Use this when asked for a daily review, what needs attention today, or an operations summary.

## Procedure
1. Do not schedule this review. The scheduled report already posts once each weekday to AV-OPS, spaces/AAQAiYhvg_U. Do not post this manual review unless an owner asks, and do not post it to hermes test or ANEEVERSE.
2. Call get_overdue_issues, get_unassigned_issues, and get_blocked_issues with limit 20.
3. Call list_projects and list_organizations once each, with limit 50. Match project_id and organization_id from those two lists. Do not call get_project or get_organization once per issue.
4. For team workload, call get_person_work with limit 20 for at most two assignee ids that appear on the overdue issues.
5. Read returned_count before writing any section. That number is the section count.
6. When returned_count is 20 or less, list every returned record. When you show fewer, write "Showing X of Y returned records."
7. Use status_name for the status. If status_name is null, say the status name was not returned. Do not invent a status name.
8. Obsidian: pick at most three organization names that have an overdue issue. Search /var/lib/avops/obsidian-ro for the name and for its lowercase form, such as horeca1 for HORECA1. Open only a matching note. Do not search the whole vault. If a note exists under 01_clients or 08_business_knowledge, cite its path.
9. Call a client at risk only when a returned fact supports it, such as an overdue issue or a blocked issue. Say which fact.
10. End with recommended actions. Each action must name the issue identifier it comes from.

## Output
Use this structure and no extra essay:

AV OPS DAILY REVIEW

1. URGENT
2. OVERDUE
3. UNASSIGNED
4. BLOCKED
5. TEAM WORKLOAD
6. CLIENT ATTENTION
7. RECENT IMPORTANT ACTIVITY
8. OBSIDIAN CONTEXT
9. RECOMMENDED ACTIONS

Under each section, label lines as FACT, CONTEXT, INFERENCE, or RECOMMENDATION.
Start OVERDUE, UNASSIGNED, and BLOCKED with "returned_count: N" using the tool field.

Blocked means blockedBy is non-empty. Do not invent a Huly status named Blocked.
Urgent means an overdue issue whose due date is already past, or a blocked issue that is also overdue. Do not add items the tools did not return.

## Pitfalls
- If returned_count is 6, do not write that there are no unassigned issues.
- The number of overdue issues you attribute to one person must equal the overdue rows with that assignee_id.
- For get_person_work, list every identifier when returned_count is 20 or less.
- Do not send the review to anyone.
- Do not write an Obsidian note from the review.

## Verification
The number in each narrative section equals that tool's returned_count.
Empty tools stay empty and say returned_count: 0.
