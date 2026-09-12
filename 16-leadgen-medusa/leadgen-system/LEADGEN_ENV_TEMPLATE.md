# Leadgen profile env template

Put these in `/root/.hermes/profiles/leadgen/.env` before starting the worker gateway:

```bash
DISCORD_BOT_TOKEN=your-second-bot-token
# Choose one of the following access patterns:
DISCORD_ALLOW_ALL_USERS=true
# or:
# DISCORD_ALLOWED_USERS=123456789012345678

# If the worker should respond to bot mentions from the commander bot:
DISCORD_ALLOW_BOTS=mentions
```

Notes:
- Keep the token private.
- Use `DISCORD_ALLOWED_USERS` for a private bot.
- Use `DISCORD_ALLOW_ALL_USERS=true` only if you want anyone in the server to talk to the worker.
