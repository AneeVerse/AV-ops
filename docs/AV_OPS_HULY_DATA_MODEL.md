# AV OPS to Huly data model

Verified from the Huly source in this repository. These names are the plugin class ids produced by `plugin()`, not guessed REST routes.

Live reads go through the transactor websocket. The browser path is `ws://127.0.0.1:8087/<api-token>?sessionId=`. Nginx on the Huly stack matches a JWT path (`location ~ ^/eyJ`) and proxies it to `transactor:3333`. The request is `findAll(class, query, { limit, sort })`.

There is no `get_clients` REST API. Cockroach is not a supported interface for Hermes.

## Mapping

| AV OPS | Huly | Class id | Source |
|---|---|---|---|
| Client | Organization | `contact:class:Organization` | `plugins/contact/src/index.ts` |
| Project | Project | `tracker:class:Project` | `plugins/tracker/src/index.ts` |
| Client on a project | `Project.company` | ref to Organization | same Project interface |
| Task | Issue, which extends Task | `tracker:class:Issue` | `plugins/tracker/src/index.ts`, `plugins/task/src/index.ts` |
| Team member | Person | `contact:class:Person` | `plugins/contact/src/index.ts` |
| Communication | Chat message | `chunter:class:ChatMessage` | `plugins/chunter/src/index.ts` |

## Fields the MCP is allowed to return

Organization: `_id`, `name`, `description`, `city`, `members` (count only), `modifiedOn`.

Project: `_id`, `name`, `identifier`, `company`, `description`, `archived`, `modifiedOn`.

Issue: `_id`, `identifier`, `number`, `title`, `space` (project), `status`, `assignee`, `dueDate`, `isDone`, `priority`, `blockedBy`, `modifiedOn`.

`assignee`, `dueDate`, `isDone`, `identifier`, and `number` come from Task. `blockedBy` is on Issue. Huly status categories are UnStarted, ToDo, Active, Won, and Lost. There is no status category named Blocked. Overdue means `dueDate` is set and earlier than now, and `isDone` is not true. Unassigned means `assignee` is null. Blocked means `blockedBy` is a non-empty list.

Person: `_id`, `name`, `city`, `modifiedOn`.

Chat message: `_id`, `attachedTo`, `space`, `message` (clipped), `createdOn` or `modifiedOn`, `createdBy` or `modifiedBy`. Message search always requires an organization, project, or attached object, plus a time window of at most 31 days.

## What this bridge does not do

It does not query Cockroach, run SQL, open a shell, create or edit documents, or send mail, WhatsApp, or Google Chat.
