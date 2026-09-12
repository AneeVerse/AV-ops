# Aneerequest schema and business rules

## Business structure

- Client = company, not individual
- Request = project / workstream under a client
- Task = actionable unit under a request

## Required hierarchy

Always map work as:
- Client -> Request -> Task

## Client fields

- Company Name
- User Name (contact person)
- Phone Number
- Email
- Password

## Request rule

- Each client has a default request: `00-Updates-Followups`
- Use an existing relevant request first
- Otherwise use `00-Updates-Followups`
- Otherwise propose/create a new request

## Critical UI rule

UI visibility depends on `task_request_links`, not only `tasks.request_id`.

When writing tasks, always ensure:
- `tasks.request_id` is set correctly
- matching row exists in `task_request_links`

## Team roles

- Anees = operations / task allocation / coordination
- Abhijeet = finance, blogs, client communication, lead generation
- Suraj = ecommerce + ads
- Mayur = senior developer
- Sanket = junior developer supporting Mayur
- Himanshi = graphic designer

## Assignment rule

- Anees is the primary decision-maker for task assignment
- If assignment is ambiguous, ask instead of guessing
