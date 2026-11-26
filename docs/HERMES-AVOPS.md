# Hermes on AV OPS

Hermes is the read, analyze, and suggest layer. It is not the database and it is not an admin shell.

```text
AV OPS / Huly     current operational truth
Obsidian          long-term company knowledge
Hermes            reasoning over both
n8n               one approved test workflow
```

Current status questions use the AV OPS MCP. Historical questions use the vault. An Obsidian note does not override a current Huly status. Automation questions use only `echo_test`. Assistant preferences stay in Hermes native memory. A fact an owner asks to remember is a file under Chat/Notes, written immediately.

## Where it runs

| Piece | Location |
|---|---|
| Hermes home | `/opt/av_ops/docker/hermes_agent` |
| Profile | `profiles/avops` |
| Gateway | user unit `hermes-gateway.service`, enabled, runs as root |
| Model | OpenAI Codex, `gpt-5.6-luna` |
| MCP source | `services/avops-mcp/` |
| MCP runtime | `/opt/av_ops/docker/avops-mcp/`, `avops-mcp.service`, `127.0.0.1:8765` |
| Vault | `/opt/av_ops/docker/obsidian/obsidian` |
| Hermes vault view | `/var/lib/avops/obsidian-ro` (read-only bind) |
| Echo MCP | `/opt/av_ops/docker/avops-n8n-echo/` |
| Chat MCP | `/opt/av_ops/docker/avops-chat/` |
| n8n | container `n8n-n8n-1`, `127.0.0.1:5678`, workflow `avops-hermes-echo` |

The gateway stays on the root user account because the Codex login lives there. Moving it is a separate hardening task. Do not create a second gateway.

`/opt/av_ops/memory/obsidian` is not the vault. Do not recreate it.

## What the avops profile can do

Read, search, reason, analyze, summarize, suggest, and draft.

Toolsets on the CLI platform: `web`, `search`, `file`, `skills`, `memory`, `todo`. The Google Chat platform also has `file`, so a test-space request can write a vault note. MCP servers on this profile: `avops`, `avops_echo`, and `avops_chat`.

Disabled toolsets: `terminal`, `cronjob`, `browser`, `image_gen`, `tts`, `skills_hub`.

The profile cannot run a shell, run SQL, run Docker, or delete production data. It can create and update a Huly issue through `create_issue`, `update_issue`, and `add_issue_comment`. Email and WhatsApp are not connected. Direct messages from Mayur and Ahmad are a normal conversation. In a company space Hermes answers when the message names Hermes or @mentions Hermes, then replies in that thread, tags the assignee, and writes the note under `Chat/Tickets/`. The Hermes test space `spaces/AAQAOk6L6k8` answers without a mention. If nothing has changed since the last status in that thread, Hermes says nothing has changed and does not post the list again. The credentials space `spaces/AAQACOxtNdo` is never read. Google Chat shows only the final sentence: `display.platforms.google_chat` sets `tool_progress` off and does not post interim tool lines. AV-OPS, `spaces/AAQAiYhvg_U`, uses the Anees project, identifier ANEES, when the message does not name a project. An owner can say remember, and the note goes under `Chat/Notes/`. A note is not a ticket. `read_space` can read the spaces the Chat app has joined. The file tool can write the vault. The process is root, so a model that ignores `SOUL.md` could write outside the vault. That is the remaining file-tool risk.

The default Hermes profile does not have these MCP servers.

## AV OPS MCP

Read tools plus `create_issue`, `update_issue`, `add_issue_comment`, and `get_issue_by_source`. No SQL, shell, or Docker. Limits are 1 to 50. Writes go through the Huly transactor and succeed only after the issue is read back. A repeated `source_key` does not create a second issue or comment. The token is `HULY_READ_TOKEN` in `/opt/av_ops/docker/avops-mcp/.env`, mode 600. It is not in git.

List results include `returned_count`, which is the number of `items` in that response. Issue results include `status_name` from `tracker:class:IssueStatus`. Blocked means `blockedBy` is non-empty, scanned from the newest 50 open issues. Message search requires a scope and stays inside 31 days.

## Obsidian

The writable vault is `/opt/av_ops/docker/obsidian/obsidian`. Hermes can read, create, and update notes there when asked. `/var/lib/avops/obsidian-ro` is the same vault mounted read-only, so writes there still fail. Do not delete a note unless Mayur names it.

## Memory

| Store | Holds |
|---|---|
| Hermes native memory | How the assistant should behave, and only when an owner asks for that change. |
| Obsidian | Durable company knowledge. A remember request goes under `Chat/Notes/` immediately. Ticket notes go under `Chat/Tickets/`. A person progress note goes under `Chat/People/`. |
| AV OPS | Current clients, projects, issues, and messages. |

Do not store clients, tasks, meetings, or documents in Hermes native memory. Do not store every conversation.

## n8n

Hermes can call one tool, `echo_test`. It POSTs to the localhost webhook for `avops-hermes-echo` with a header secret stored only in `/opt/av_ops/docker/avops-n8n-echo/.env`. The URL must be `http://127.0.0.1:5678/webhook/...`. A successful call returns `AV OPS TEST OK` and the input. A call without the header fails and does not return that result.

The weekday 09:30 IST report is `avops-daily.timer` on the host. n8n cannot reach `127.0.0.1:8765` from its container, so n8n does not poll Huly. The timer writes the vault report, posts one summary in AV-OPS (`spaces/AAQAiYhvg_U`), and journals the counts through the `avops-daily-report` webhook. Hermes is not given that webhook.

Hermes cannot list, create, edit, delete, or publish workflows, and it cannot read the n8n credential store. The three listing-image workflows were already active and were not changed except that n8n was restarted so the new webhook would load.

Gmail, Google Drive, Calendar, Docs, Sheets, and WhatsApp Business are not connected. Google Chat is connected for the Hermes app. Inbound messages arrive on the Hermes Pub/Sub pull subscription `projects/hermes-avops/subscriptions/hermes-chat-events-sub`. `GOOGLE_CHAT_ALLOWED_USERS` is Mayur and Ahmad. Company spaces still wake only when the message names Hermes or @mentions the bot.

## Hermes test space

`send_message` allows every space listed in `/opt/av_ops/docker/avops-chat/operate.json`. Those are the standing company spaces. `list_app_spaces` and `read_space` cover the spaces the Chat app has joined. Direct messages, dated meeting rooms, and the credentials space are not in that list. Message history and space discovery use the refresh token in `/opt/av_ops/docker/avops-chat/oauth.json` for anees@aneeverse.com. The sync writes `Chat/Spaces/registry.md` and `Chat/Spaces/checkpoints.json`. Ticket confirmations go back to the source space, in the thread that asked. The daily summary posts only in AV-OPS (`spaces/AAQAiYhvg_U`). hermes test stays for testing. The report is not also posted in ANEEVERSE. A new ticket does not send a progress reminder until 12 hours have passed, and a completed ticket is not reminded. App Workspace Event subscriptions cover the operate spaces and publish to the same Pub/Sub topic with `includeResource: false`. The gateway hydrates a message, then answers only a direct message, the test space, an active thread, or a message that names Hermes. `avops-chat-sync.timer` runs every 5 minutes as the reconciliation backfill. It records messages it has seen and still sends the existing progress reminders. It does not create a ticket or post its own reply. Hermes owns live Chat. It does not replace the live Pub/Sub pull. n8n reaches the MCP only through the private bridge on `172.20.0.1:8765`, limited to the n8n Docker network. The public bind stays `127.0.0.1:8765`.

## Daily review

The manual skill is `avops-daily-review`. The scheduled count report is `avops-daily.timer`, weekdays at 09:30 Asia/Kolkata. It does not ask every assignee for an update.

The review must echo `returned_count` for overdue, unassigned, and blocked. A count of 6 cannot be summarized as zero. Twenty or fewer records are listed. Status names come from `status_name`. Client names are resolved with `get_project` and `get_organization` before any Obsidian search. Sections are Urgent, Overdue, Unassigned, Blocked, Team workload, Client attention, Recent activity, Obsidian context, and Recommended actions. Lines are FACT, CONTEXT, INFERENCE, or RECOMMENDATION.

## Approval

Read, analyze, and suggest are on. `echo_test` remains the only n8n path. An owner direct message, and a company space that names Hermes, may create or update a Huly ticket, tag the assignee, and save the record under `Chat/Tickets/`. A company-space message that does not name Hermes is not an assignment.

## Health check

On the VPS:

```bash
sudo bash /opt/av_ops/docker/avops-hermes-health.sh
sudo bash /opt/av_ops/docker/avops-hermes-health.sh --with-model
```

The script in this repo is [scripts/avops-hermes-health.sh](../scripts/avops-hermes-health.sh). It checks the gateway, MCP health, the read-only vault, one unassigned read, and `echo_test`. `--with-model` also requires a `PONG` reply and spends a model call.

Expected: every line starts with `PASS`. The unassigned line includes `returned_count`.

Logs, without printing secrets:

```bash
journalctl --user -u hermes-gateway.service -n 80 --no-pager
journalctl -u avops-mcp.service -n 40 --no-pager
docker logs n8n-n8n-1 --tail 40
```

## Recovery

Config backup from this pass: `/var/backups/avops/hermes-layer-20261008T101434Z`. Nightly backups continue under `/var/backups/avops`. The latest nightly run recorded there was `OK 20261008T023506Z`.

If the MCP misbehaves, restore `mcp/server.mjs` from that directory onto `/opt/av_ops/docker/avops-mcp/server.mjs` and `systemctl restart avops-mcp.service`. If a skill is wrong, restore the matching file under `profiles/avops` and restart `hermes-gateway.service`. Do not restore by deleting the newer backup.

If `echo_test` fails, check that `n8n-n8n-1` is up and that `avops-hermes-echo` is still the only extra workflow. Do not unpublish the listing-image workflows.

## Note Taker

An owner says remember, note this, or don't forget. Hermes writes `/opt/av_ops/docker/obsidian/obsidian/Chat/Notes/YYYY-MM-DD-short-slug.md` and one line in `Chat/Notes/index.md`, then replies with the file name. Asking what was noted searches that folder. A note does not change a Huly status and does not create a ticket unless they also asked for one. Passwords and tokens are not stored. This does not need a new database.
