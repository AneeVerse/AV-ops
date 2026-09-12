# Raw text to plan template

When converting raw user instructions into a structured aneerequest plan, extract:

- client_name or client_organization
- request_title if obvious
- whether a new request is likely needed
- task list
- optional assignee suggestions
- ambiguity notes

## Output target

Convert into JSON shaped like `references/plan-example.json`.

## Rule reminders

- Prefer existing relevant request first
- Else use `00-Updates-Followups`
- Else propose/create new request
- Never skip `task_request_links`
- In safe mode, present the plan before writing

## Recommended output sections before JSON

- Client match
- Request placement
- Tasks
- Ambiguities

Then provide the final structured JSON plan.
