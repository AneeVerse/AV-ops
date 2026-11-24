---
name: avops-ticket
description: Create or update a Huly ticket from an owner direct message or from a company-space message that names Hermes, then record it under Chat/Tickets.
version: 1.2.0
---

# Tickets

## When to use
Use this when an owner asks in a direct message, or when a message in an operate space names Hermes or @mentions Hermes and the message is a real work request. A company-space message that does not name Hermes is not a ticket.

## Procedure
1. If the space is AV-OPS, spaces/AAQAiYhvg_U, and the message does not name a project, call search_projects with query Anees and use the project whose identifier is ANEES. Do not ask which ANEEVERSE project. If they named a project, search for that name. If more than one project matches the name they typed, ask which one. Do not guess.
2. Call search_issues with the request title and open_only true. If an existing issue is the same work, update that issue instead of creating another.
3. Call mcp__avops_chat__resolve_chat_user before choosing an assignee. Use huly_person_id from that result. If it is null, stop and say that person has no Huly record. Do not guess. Mayur Karve is Huly person 6a83ff1cfcafa62b1a4854b7. Ahmad Anees is Huly person 6a82cb81a175e8c330976243, the record named Anees (Admin),Ahmad. Do not assign to the Huly person named (Anees),Aneeverse. Then call mcp__avops__create_issue with project_id, title, and source_key. Use status Todo unless the owner names a status.
4. source_key for a chat message is the message_id with slashes replaced by colons, prefixed with chat:. For an owner instruction that has no message, use a short key the owner can repeat, prefixed with owner:.
5. If created is false, the ticket already existed. Say that and give its identifier. Do not create a second one.
6. If ok is not true, or identifier is missing, say the ticket was not created and quote the tool error. Do not send a success message.
7. Write /opt/av_ops/docker/obsidian/obsidian/Chat/Tickets/<identifier>.md with the identifier, title, status_name, project, source_key, and whether it was created or reused.
8. Do not call send_message or reply_message to confirm the ticket. Your final sentence is the confirmation: the identifier, whether it was created or reused, and the assignee name. One sentence. No tool names.
8a. Do not call send_direct_message unless they asked you to message that person. If huly_person_id is null, do not create the ticket for that person.
8b. To create a private space, call mcp__avops_chat__create_space. requester is the authenticated sender email. members are the requested emails and must include the requester. If collision is true, stop and report the existing space id. Do not add people to it. Report humans, app_members, access_state, and link from the tool result. The Chat app membership is a system requirement, not an extra person.
9. A progress message that names an existing identifier uses update_issue or add_issue_comment with a new source_key ending in the message id. Change status only when the message clearly says the work moved, finished, or was canceled. Do not invent a percent complete.
10. Messages in a space whose operate flag is not true are context only. Do not create a ticket from them. Dated meeting rooms and the credentials space are not operate spaces. An owner direct message is an instruction even though it is not an operate space. The gateway posts your final sentence. Do not also send it yourself.

## Pitfalls
- A hello, a thanks, or a question that is not a request for work is not a ticket.
- Do not write the Huly database directly.
- Do not mark a ticket Done because someone said done unless update_issue returned status_name Done.

## Verification
The identifier, status_name, and created flag in the reply match the tool result from this turn. The note file exists and contains that identifier.
