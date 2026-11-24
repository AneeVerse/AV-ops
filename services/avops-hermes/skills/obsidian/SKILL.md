---
name: obsidian
description: Read, create, and update notes in the AV OPS Obsidian vault.
version: 1.2.0
platforms: [linux]
metadata:
  hermes:
    tags: [Obsidian, Notes, Markdown, Vault]
    related_skills: []
---

# Obsidian vault

The writable vault is /opt/av_ops/docker/obsidian/obsidian.
Use that path for read_file, search_files, write_file, and patch.
/var/lib/avops/obsidian-ro is a read-only view of the same files. Do not write there.
Do not use /opt/av_ops/memory/obsidian.

## Read and search
Search filenames and note contents under the writable vault.
When a note informs an answer, cite its path.
A note is historical context. Current task status still comes from the avops MCP.

## Write and update
When Mayur asks to remember, note, or save something, follow avops-notes and write under Chat/Notes. Other note edits use write_file or patch on the writable vault path.
Say which file you changed.
Do not delete a note unless Mayur explicitly names that note and says to delete it.
Do not use the terminal.

## Attachments
Read attachments from the same vault when the question needs them.
