# Aneerequest workflow

## Safe mode workflow

1. Parse the user's raw request.
2. Identify client.
3. Check whether an existing request fits.
4. If not, fall back to `00-Updates-Followups` or propose a new request.
5. Break work into tasks.
6. Produce a structured plan before any write.
7. Ask for approval.
8. Only after approval, perform Supabase writes.
9. Ensure `task_request_links` is inserted.

## Planning output format

Return a short structure with:
- Client
- Request
- Request status: existing / default / new needed
- Tasks
- Assignee suggestions
- Notes / ambiguities

## Safe-write principles

- Do not guess missing IDs if lookup is needed
- Do not write if client match is ambiguous
- Do not create a new request without approval if a relevant existing request is uncertain
- Do not omit `task_request_links`

## Recommended behavior

- Prefer accuracy over speed
- Prefer asking one clarification over writing wrong structure
- Keep the final plan concise and operational
