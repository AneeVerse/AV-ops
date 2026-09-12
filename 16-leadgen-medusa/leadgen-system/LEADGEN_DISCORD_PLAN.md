# Discord lead-generation multi-bot plan

## Current state
- Host: Hostinger VPS
- Hermes: installed and running
- Commander bot: `DEMASTER_BOT` (current Hermes Discord bot)
- New worker profile: `leadgen`
- Worker profile path: `/root/.hermes/profiles/leadgen`

## What the worker bot will do
- find leads
- qualify leads
- draft personalized DMs/emails
- enrich data from public/compliant sources
- report structured results to the commander

## Current worker profile setup
- model: `gpt-5.4-mini`
- provider: `openai-codex`
- worker instructions: `/root/.hermes/profiles/leadgen/SOUL.md`

## What still needs to happen
1. Create the second Discord application/bot in the Discord Developer Portal.
2. Copy its bot token.
3. Put that token into `/root/.hermes/profiles/leadgen/.env` as `DISCORD_BOT_TOKEN`.
4. Set the worker's Discord access variables, usually:
   - `DISCORD_ALLOWED_USERS=<your Discord user id>` or a private allowlist
   - `DISCORD_ALLOW_BOTS=mentions` if the commander bot will mention the worker
5. Enable privileged intents in the bot settings:
   - Server Members Intent
   - Message Content Intent
6. Start the worker gateway:
   - `leadgen gateway start`
7. Verify logs and token validity.

## Recommended routing pattern
- Keep the worker bot private.
- Have the commander bot receive your requests.
- The commander sends tasks to the worker in a dedicated private channel or via a shared file/queue.
- The worker returns a structured report.
- The commander summarizes the result back to you.

## Recommended safety boundary
- Use public and compliant lead sources.
- No credential scraping.
- No spam blasts.
- Prefer personalized outreach.
- Keep an audit trail of lead sources and messages.
