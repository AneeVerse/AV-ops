# Discord permissions and intents for the two-bot setup

## Commander bot (`DEMASTER_BOT`)
Required Discord portal settings:
- Server Members Intent: ON
- Message Content Intent: ON
- Public Bot: optional, depending on whether you want it inviteable by URL

Recommended permissions:
- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files
- Send Messages in Threads
- Add Reactions

## Lead-gen worker bot (`leadgen` profile)
Required Discord portal settings:
- Server Members Intent: ON
- Message Content Intent: ON

Recommended permissions:
- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files
- Send Messages in Threads
- Add Reactions

## OAuth2 scopes for both bots
- `bot`
- `applications.commands` if you want slash commands

## Access control options for the worker
### Private
Use one of:
- `DISCORD_ALLOWED_USERS=<your Discord user id>`
- or a comma-separated allowlist of user IDs

### Open
- `DISCORD_ALLOW_ALL_USERS=true`

### Bot-to-bot reporting
If the commander bot needs to mention the worker, set:
- `DISCORD_ALLOW_BOTS=mentions`

## Current known state
- Commander bot access is currently open (`DISCORD_ALLOW_ALL_USERS=true`) in the default profile.
- Worker profile is created, but its `.env` is still empty.
