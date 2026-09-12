#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from urllib import parse, request, error


def fail(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def load_env():
    url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        fail('Missing Supabase env. Need NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    return url.rstrip('/'), key


SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY = load_env()
HEADERS = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}
VALID_STATUSES = {'Todo', 'In Progress', 'Done', 'Cancelled'}
VALID_PRIORITIES = {'Low', 'Medium', 'High', 'Urgent'}


def api(path, method='GET', data=None, query=''):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if query:
        url += ('&' if '?' in url else '?') + query
    body = None if data is None else json.dumps(data).encode('utf-8')
    req = request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with request.urlopen(req) as r:
            raw = r.read().decode('utf-8')
            return json.loads(raw) if raw else None
    except error.HTTPError as e:
        msg = e.read().decode('utf-8', errors='ignore')
        fail(f'HTTP {e.code} for {method} {path}: {msg}')


def slugify(text):
    text = (text or '').strip().lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')


def load_plan(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate_plan(plan):
    tasks = plan.get('tasks')
    if not isinstance(tasks, list) or not tasks:
        fail('Plan must include non-empty tasks array')
    for i, task in enumerate(tasks, start=1):
        title = (task.get('title') or '').strip()
        if not title:
            fail(f'Task {i} missing title')
        status = task.get('status', 'Todo')
        if status not in VALID_STATUSES:
            fail(f'Task {i} has invalid status: {status}')
        priority = task.get('priority', 'Medium')
        if priority not in VALID_PRIORITIES:
            fail(f'Task {i} has invalid priority: {priority}')


def get_client_by_id(client_id):
    rows = api('clients', query=parse.urlencode({'select': '*', 'id': f'eq.{client_id}', 'limit': '1'}))
    return rows[0] if rows else None


def find_client(plan):
    if plan.get('client_id'):
        client = get_client_by_id(plan['client_id'])
        if not client:
            fail('client_id provided but client not found')
        return client
    org = (plan.get('client_organization') or '').strip()
    name = (plan.get('client_name') or '').strip()
    if org:
        rows = api('clients', query=parse.urlencode({'select': '*', 'organization': f'eq.{org}', 'limit': '2'}))
        if len(rows) == 1:
            return rows[0]
        if len(rows) > 1:
            fail(f'Ambiguous client organization match: {org}')
    if name:
        rows = api('clients', query=parse.urlencode({'select': '*', 'name': f'eq.{name}', 'limit': '2'}))
        if len(rows) == 1:
            return rows[0]
        if len(rows) > 1:
            fail(f'Ambiguous client name match: {name}')
    fail('Could not match client. Provide client_id or exact client_name/client_organization.')


def get_request_by_id(request_id):
    rows = api('requests', query=parse.urlencode({'select': '*', 'id': f'eq.{request_id}', 'limit': '1'}))
    return rows[0] if rows else None


def find_existing_request(client_id, title):
    rows = api('requests', query=parse.urlencode({'select': '*', 'client_id': f'eq.{client_id}', 'title': f'eq.{title}', 'limit': '2'}))
    if len(rows) == 1:
        return rows[0]
    if len(rows) > 1:
        fail(f'Ambiguous request title match for client: {title}')
    return None


def find_default_request(client_id):
    rows = api('requests', query=parse.urlencode({'select': '*', 'client_id': f'eq.{client_id}', 'title': 'eq.00-Updates-Followups', 'limit': '2'}))
    if len(rows) == 1:
        return rows[0]
    if len(rows) > 1:
        fail('Ambiguous default request match')
    return None


def create_request(client_id, title, description=''):
    payload = {
        'title': title,
        'description': description,
        'status': 'Todo',
        'priority': 'Low',
        'client_id': client_id,
        'slug': slugify(title)
    }
    rows = api('requests', method='POST', data=payload)
    return rows[0]


def existing_task_titles(request_id):
    rows = api('tasks', query=parse.urlencode({'select': 'title', 'request_id': f'eq.{request_id}', 'limit': '500'}))
    return {row['title'].strip().lower() for row in rows}


def create_task(request_id, task, client_slug=''):
    title = task['title'].strip()
    payload = {
        'title': title,
        'description': task.get('description', ''),
        'status': task.get('status', 'Todo'),
        'priority': task.get('priority', 'Medium'),
        'assigned_to': task.get('assigned_to'),
        'due_date': task.get('due_date'),
        'request_id': request_id,
        'slug': slugify(f"{client_slug}-{title}" if client_slug else title)
    }
    rows = api('tasks', method='POST', data=payload)
    return rows[0]


def create_task_request_link(task_id, request_id):
    rows = api('task_request_links', method='POST', data={'task_id': task_id, 'request_id': request_id})
    return rows[0]


def resolve_request(plan, client):
    if plan.get('request_id'):
        req = get_request_by_id(plan['request_id'])
        if not req:
            fail('request_id provided but request not found')
        return req, 'explicit'

    title = (plan.get('request_title') or '').strip()
    if title:
        existing = find_existing_request(client['id'], title)
        if existing:
            return existing, 'existing'
        if plan.get('allow_create_request'):
            return {
                'id': None,
                'title': title,
                'description': plan.get('request_description', '')
            }, 'create'

    default_req = find_default_request(client['id'])
    if default_req:
        return default_req, 'default'

    fail('No matching request found and no default request available. Approve request creation first.')


def summarize(plan, client, request_obj, request_mode, duplicates):
    return {
        'client': {'id': client['id'], 'name': client.get('name'), 'organization': client.get('organization')},
        'request': {'id': request_obj.get('id'), 'title': request_obj.get('title')},
        'request_mode': request_mode,
        'tasks_count': len(plan.get('tasks', [])),
        'duplicate_titles_found': duplicates,
        'tasks': plan.get('tasks', [])
    }


def main():
    ap = argparse.ArgumentParser(description='Aneerequest deterministic writer')
    ap.add_argument('--plan', required=True, help='Path to JSON plan file')
    ap.add_argument('--execute', action='store_true', help='Actually perform writes')
    ap.add_argument('--allow-duplicates', action='store_true', help='Allow inserting tasks even if same title exists in request')
    args = ap.parse_args()

    plan = load_plan(args.plan)
    validate_plan(plan)

    client = find_client(plan)
    request_obj, request_mode = resolve_request(plan, client)
    existing_titles = set() if request_mode == 'create' else existing_task_titles(request_obj['id'])
    incoming_titles = [(t['title'].strip(), t['title'].strip().lower()) for t in plan['tasks']]
    duplicates = [orig for orig, low in incoming_titles if low in existing_titles]
    summary = summarize(plan, client, request_obj, request_mode, duplicates)
    print(json.dumps({'mode': 'execute' if args.execute else 'dry-run', 'summary': summary}, indent=2))

    if duplicates and not args.allow_duplicates:
        fail('Duplicate task titles found in target request. Review dry-run or pass --allow-duplicates if intentional.')

    if not args.execute:
        return

    if request_mode == 'create':
        request_obj = create_request(client['id'], request_obj['title'], request_obj.get('description', ''))

    created = []
    client_slug = slugify(client.get('organization') or client.get('name') or 'client')
    for task in plan['tasks']:
        created_task = create_task(request_obj['id'], task, client_slug=client_slug)
        created_link = create_task_request_link(created_task['id'], request_obj['id'])
        created.append({'task': created_task, 'link': created_link})

    print(json.dumps({'written': True, 'request_id': request_obj['id'], 'created': created}, indent=2))


if __name__ == '__main__':
    main()
