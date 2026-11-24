---
name: avops-notes
description: Save and recall a note when an owner asks Hermes to remember something. Notes live under Chat/Notes. A note is not a Huly ticket.
version: 1.0.1
---

# Notes

## When to use
Use this when Mayur or Ahmad says remember, note this, save this, or don't forget, or asks what was noted. A direct message does not need the name Hermes. A company space uses this only when the message names Hermes.

## Save
1. Do not call the memory tool. A remember request is a file, not a memory approval. If the text is a password, token, key, or other credential, do not write it. Say you will not store that.
2. The only path is /opt/av_ops/docker/obsidian/obsidian/Chat/Notes/YYYY-MM-DD-short-slug.md. Write that file with write_file. Do not write under any other Chat folder. The file has the date, the sender name, DM or the space name, and the thing they asked to keep in their words.
3. Append one line to /opt/av_ops/docker/obsidian/obsidian/Chat/Notes/index.md with the date, the slug, and a one-line summary.
4. Reply with one sentence and no label. Name the file as Chat/Notes/YYYY-MM-DD-short-slug.md. Do not print the server path. Do not create a Huly ticket unless they also asked for a ticket.

## Recall
1. Search /opt/av_ops/docker/obsidian/obsidian/Chat/Notes for their words.
2. Reply in normal sentences and name the file. If nothing matches, say so.
3. A note is not current task status. If they ask whether work is done, use the avops MCP.

## Do not
Do not describe the tools you used. Do not call send_message or reply_message. Your final sentence is the reply.
