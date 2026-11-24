---
name: avops-memory-curation
description: Keep Hermes memory, Obsidian, and AV OPS separate. Never write notes or memory automatically.
version: 1.2.0
---

# Memory curation

## When to use
Use this only when an owner asks you to change how you speak or behave. A request to remember a fact, a marker, a decision, or anything they might ask for later uses avops-notes and write_file under Chat/Notes. Do not call the memory tool for that.

## What goes where
- Hermes native memory: how the assistant should behave or address the user. Writes require the approval prompt. Do not store clients, tasks, meetings, or company documents.
- Obsidian: durable company knowledge. When an owner asks to remember something, follow avops-notes and write under Chat/Notes. A note is not a Huly ticket.
- AV OPS: current clients, projects, issues, and messages. Do not copy them into memory or into a new note from this skill.
- The operations pipeline writes ticket notes in Chat/Tickets and the daily report in Chat/Reports. Those notes follow the live Huly result. Do not delete them.

## Procedure
1. Ignore okay, thanks, routine chatter, and one-off status noise.
2. When Mayur asks to save it, write the note and report the path.
3. Do not write a note for chatter he did not ask to keep.

## Pitfalls
- Do not store a whole conversation.
- Do not store credentials.
- Do not claim a note or a memory was saved.

## Verification
The reply names the file that was written, or says nothing was written because it was not asked for.
