# chat.aneeverse.com — OpenClaw Chat Control MVP

Private custom chat UI for OpenClaw agents. The browser talks only to this Next.js app; the app talks server-side to the local OpenClaw Gateway WebSocket.

## Agents wired now

- `main` — AV_BOT / default
- `onefc`
- `novino`
- `surajscarpe11`

## Local setup

```bash
cd chat-control
cp .env.example .env.local
# Fill OPENCLAW_GATEWAY_TOKEN, CHAT_PASSWORD, SESSION_SECRET
npm install
npm run dev
```

Open: <http://127.0.0.1:3010>

## Production shape

```text
Browser -> https://chat.aneeverse.com -> Next.js app :3010 -> ws://127.0.0.1:18789 OpenClaw Gateway
```

Do not expose `127.0.0.1:18789` publicly. Keep the OpenClaw token only in server env.
