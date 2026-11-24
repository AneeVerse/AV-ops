---
name: avops-client-context
description: Build one client's current AV OPS status and separate historical Obsidian context.
version: 1.1.0
---

# Client context

## When to use
Use this when asked about one named client, including current status plus historical context.

## Procedure
1. Use the client name exactly as asked. Do not mix in another client.
2. Call get_client_context. If the name is not unique, stop and list the returned matches.
3. Search /var/lib/avops/obsidian-ro for that same name and open only the matching notes.
4. Reply in four blocks:
   - FACT: current organization, projects, open issues, overdue issues, and recent messages from the MCP result. Include open_issue_count and overdue_count.
   - CONTEXT: what the notes say, with the note path. If no note matches, say no historical note was found.
   - INFERENCE: only a conclusion that follows from those facts.
   - RECOMMENDATION: what to look at next. Do not claim it was done.
5. If a source fails, say that source is unavailable.

## Pitfalls
- A similar client name is not the same client.
- A historical note is not today's Huly status.
- Do not call the client at risk unless an overdue issue, a blocked issue, or the note states a concrete problem.

## Verification
The client name in the answer matches the question.
Counts match the MCP fields.
