# AGENTS.md - Novino Client Bot Workspace

This is a fresh client-specific OpenClaw workspace for the Novino Telegram bot.

## Startup

Before working:
1. Read `SOUL.md`
2. Read `USER.md`
3. Read today's and yesterday's files in `memory/` if they exist

## Memory Boundary

- Do **not** read or import memory from `/root/.openclaw/workspace`.
- This bot starts fresh for Novino.
- There is intentionally no `MEMORY.md` unless the client later asks to build long-term memory.
- Keep client context inside this workspace only.

## Style

Be practical, concise, and client-safe. Ask when an action would affect external systems or private data.
