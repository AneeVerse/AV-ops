# avops-mcp

Private bridge from Hermes to live AV OPS data. Reads are unchanged. Issue create, update, and comment go through the Huly transactor, not the database.

Hermes talks to this process. This process talks to the Huly transactor over the same websocket the web app uses (`ws://127.0.0.1:8087/<api-token>`). It does not open Cockroach, does not accept SQL, and does not write.

## Layout

| What | Where |
|---|---|
| Source in this repo | `services/avops-mcp/` |
| Runtime on the VPS | `/opt/av_ops/docker/avops-mcp/` |
| Secrets | `/opt/av_ops/docker/avops-mcp/.env` mode 600 |
| HTTP bind | `127.0.0.1:8765` only |
| systemd | `avops-mcp.service` |
| Hermes | stdio MCP on the `avops` profile only |

## Credential

`HULY_READ_TOKEN` must be an API token created in Huly by a signed-in user:

1. Open AV OPS and sign in as the user who should own the read access.
2. Settings → API tokens.
3. Create a token named `hermes-avops-read` for the AV OPS workspace.
4. Put the token value only in the server `.env` as `HULY_READ_TOKEN`.
5. Restart `avops-mcp.service`.

Do not paste the token into Git, Hermes config, chat, or this README. A missing token makes every tool return an error. It does not fall back to the database.

List tools include `returned_count`, which is `items.length` for that response. Overdue, unassigned, and blocked reviews must report that number. Blocked still means `blockedBy` is non-empty, scanned from the newest 50 open issues.

Write tools are `create_issue`, `update_issue`, and `add_issue_comment`. A repeated `source_key` returns the original issue or comment instead of creating another one. A write result is success only after the saved issue is read back and the changed fields match. Status names are Backlog, Todo, In Progress, Done, and Canceled. Priority names are none, urgent, high, medium, and low.

## Run

```bash
cd /opt/av_ops/docker/avops-mcp
npm install --omit=dev
sudo systemctl enable --now avops-mcp.service
```

Hermes launches `server.mjs` over stdio. The HTTP listener is only for a localhost health check and authenticated JSON-RPC. It is not published in Nginx or UFW.
