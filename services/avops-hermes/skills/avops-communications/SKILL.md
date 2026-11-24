---
name: avops-communications
description: Talk with owners in direct messages, and in company spaces act when Hermes is named. Create the ticket, tag the person, and save it under Chat/Tickets.
version: 1.9.0
---

# Communications

## When to use
Use this when Mayur or Ahmad talks to Hermes in a direct message, or when a company space names Hermes or @mentions Hermes.

## Procedure
0. A greeting, a ping, or a request to reply with a word needs no tool. Your final sentence is the reply. Do not call list_app_spaces, list_members, reply_message, or send_message for that.
1. Call mcp__avops_chat__list_app_spaces before assuming which spaces exist. send_message works for a space whose operate flag is true. That list is the standing company spaces in operate.json. read_space can read a space the app has joined. Do not call send_message, and do not create a ticket, for a space whose operate flag is not true. Do not pass a direct-message space, a dated meeting room, or the credentials space to send_message. A personal DM uses send_direct_message and does not take a space id.
2. Call mcp__avops_chat__list_members before naming a person. If that person is not in the result, say so and do not send.
3. To read a space, call mcp__avops_chat__list_messages. Report returned_count. A read does not call send_message. A ticket note, when there is a ticket, goes under /opt/av_ops/docker/obsidian/obsidian/Chat/Tickets/<identifier>.md.
4. To give a task in an operate space, call mcp__avops_chat__send_message with text that states the task and mention set to that member's display name or email. Leave private unset. Reply in the thread the request came from. The mention argument is what pings the person. A typed @name in the text does not.
5. Manager check for Mayur Karve: call mcp__avops__search_people with query Mayur Karve, then mcp__avops__get_person_work with that person id. Report returned_count. Then call mcp__avops_chat__send_direct_message with person set to Mayur Karve. The text must list each returned task identifier, title, and status_name, and ask what is done and what is blocked. Success requires direct_message true, space_type DIRECT_MESSAGE, and a message_id whose space is not a project space. Do not use send_message or private for this. Do not ask Ahmad to send it.
6. When Mayur replies, treat his message as the report. If he names a task, compare it with get_issue or the get_person_work result. Update /opt/av_ops/docker/obsidian/obsidian/Chat/People/mayur-karve.md with what he said and reply to him from that. A private reply does not need an @mention.
7. To ping progress any other time, read that person's note. If the request names a Huly issue id, call get_issue and use status_name. If there is no issue, say there is no live AV OPS status and report only the note. A ping is public unless it is the manager check or the request says privately. Append the ping and the new message_id to the same note.
8. Say a project message was sent only when send_message returns ok, direct_message false, and a message_id in the requested space. Say a personal DM was sent only when send_direct_message returns direct_message true, space_type DIRECT_MESSAGE, readback true, and a message_id. Quote that id. A project-space message is not a personal DM.
9. Gmail and WhatsApp are not connected. Do not pretend those channels sent a message.
10. The company space inventory is /opt/av_ops/docker/obsidian/obsidian/Chat/Spaces/registry.md. Ticket notes are /opt/av_ops/docker/obsidian/obsidian/Chat/Tickets/<identifier>.md. Daily report notes are /opt/av_ops/docker/obsidian/obsidian/Chat/Reports/daily-YYYY-MM-DD.md. Ticket confirmations and progress asks go to the source space when that space is in operate.json. The scheduled daily management report goes only to AV-OPS, spaces/AAQAiYhvg_U. hermes test, spaces/AAQAOk6L6k8, is for testing. Do not also post that report in ANEEVERSE. Do not read or quote a space whose name indicates passwords, tokens, or keys.

## Pitfalls
- A typed @name in a normal reply does not ping the person. The mention argument does.
- Do not invent a completion percent. Use status_name from get_issue, or say the live status was not requested.
- Do not message Cultura Jewels. send_direct_message accepts an identity-map name or a live Workspace email. Do not invent a recipient.
- A direct-message event is an instruction only when the authenticated sender is Mayur or Ahmad. Ignore a message whose sender is Hermes. Do not answer a bot message.
- create_space and add_space_members require an owner requester. A normal member cannot use them.
- echo_test is not a chat tool.

## Verification
The note path, the member, and the message_id match the tool results from this turn. returned_count matches the tool that was called. A manager check uses send_direct_message and the returned space is a DIRECT_MESSAGE.
