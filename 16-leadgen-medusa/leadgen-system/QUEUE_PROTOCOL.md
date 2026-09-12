# Shared queue protocol

Use this folder if you want the commander bot and the lead-gen worker to exchange structured tasks outside of Discord message text.

## Suggested files
- `inbox.jsonl` — tasks awaiting the worker
- `outbox.jsonl` — worker results awaiting the commander
- `reports/` — archived JSON reports by task ID

## Suggested task schema
```json
{
  "task_id": "uuid-or-short-id",
  "type": "find_leads|qualify_leads|draft_outreach|enrich_data",
  "query": "short human description",
  "source_hint": "optional",
  "priority": "low|normal|high",
  "created_at": "ISO-8601",
  "requested_by": "commander"
}
```

## Suggested report schema
```json
{
  "task_id": "same-id",
  "status": "done|partial|blocked",
  "summary": "short summary",
  "results": [],
  "blocked_reason": null,
  "next_steps": [],
  "created_at": "ISO-8601"
}
```

## Intended routing
- Commander writes tasks.
- Worker reads tasks and writes results.
- Commander posts the result back into Discord.
