#!/usr/bin/env python3
import json
import os
import re
import subprocess
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace')


def load_env(path='/root/.env'):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k, v)


def psql_capture(sql):
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    cmd = [
        'psql', '-h', env['AV_BOT_PGHOST'], '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'], '-d', env['AV_BOT_PGDATABASE'],
        '-v', 'ON_ERROR_STOP=1', '-At', '-F', '\t', '-c', sql
    ]
    return subprocess.check_output(cmd, env=env, text=True)


def psql(sql):
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    cmd = [
        'psql', '-h', env['AV_BOT_PGHOST'], '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'], '-d', env['AV_BOT_PGDATABASE'],
        '-v', 'ON_ERROR_STOP=1', '-c', sql
    ]
    subprocess.check_call(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def q(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"


def json_sql(value):
    raw = json.dumps(value, ensure_ascii=False).replace("'", "''")
    return f"'{raw}'::jsonb"


def fetch_candidate_tasks():
    sql = """
    select raw::text
    from mirror_tasks
    where raw->>'assigned_to' is not null
      and raw->>'assigned_to' <> ''
      and coalesce(raw->>'status','') <> 'Done'
    order by 
      case when raw->>'due_date' is null or raw->>'due_date' = '' then 1 else 0 end,
      (raw->>'due_date')::timestamptz asc nulls last,
      coalesce(raw->>'updated_at', raw->>'created_at') desc nulls last;
    """
    out = psql_capture(sql)
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def get_existing_state(task_id):
    sql = f"select primary_state, assigned_at is not null from task_control_state where task_id = {q(task_id)}::uuid;"
    out = psql_capture(sql).strip()
    if not out:
        return None
    parts = out.split('\t')
    return {'primary_state': parts[0], 'has_assigned_at': parts[1] == 't'}


def get_lookup_map(table, key='id'):
    structured_tables = {
        'mirror_profiles',
        'mirror_request_assignments',
        'mirror_request_messages',
        'mirror_task_messages',
        'mirror_team_members',
        'mirror_app_settings',
    }
    if table in structured_tables:
        sql = f"select row_to_json(t)::text from (select * from {table}) t;"
    else:
        sql = f"select raw::text from {table};"
    out = psql_capture(sql)
    data = {}
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        row_key = row.get(key)
        if row_key is not None:
            data[str(row_key)] = row
    return data


def post_google_chat(webhook_url, text):
    payload = json.dumps({'text': text}).encode()
    req = urllib.request.Request(webhook_url, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def build_assignment_context(task, requests_map, clients_map, team_members_map, routes_map):
    request = requests_map.get(str(task.get('request_id')))
    client = clients_map.get(str(request.get('client_id'))) if request else None
    assigned_to = str(task.get('assigned_to')) if task.get('assigned_to') is not None else None
    team_member = team_members_map.get(assigned_to)
    if team_member is None and assigned_to is not None:
        for member in team_members_map.values():
            if str(member.get('profile_id')) == assigned_to:
                team_member = member
                break
    route = None
    if team_member is not None:
        route = routes_map.get(str(team_member.get('id')))
    client_name = None
    if client:
        client_name = client.get('organization') or client.get('name')
    request_name = request.get('title') if request else None
    assignee_name = team_member.get('name') if team_member else None
    assignee_email = team_member.get('email') if team_member else None
    return {
        'request': request,
        'client': client,
        'team_member': team_member,
        'route': route,
        'client_name': client_name,
        'request_name': request_name,
        'assignee_name': assignee_name,
        'assignee_email': assignee_email,
    }


def build_task_url(task):
    slug = task.get('slug')
    if not slug:
        return None
    return f"https://app.aneeverse.com/tasks/{slug}"


def short_month_name(text):
    if not text:
        return text
    text = re.sub(r'\bjanuary\b', 'Jan', text, flags=re.IGNORECASE)
    text = re.sub(r'\bfebruary\b', 'Feb', text, flags=re.IGNORECASE)
    text = re.sub(r'\bmarch\b', 'Mar', text, flags=re.IGNORECASE)
    text = re.sub(r'\bapril\b', 'Apr', text, flags=re.IGNORECASE)
    text = re.sub(r'\bmay\b', 'May', text, flags=re.IGNORECASE)
    text = re.sub(r'\bjune\b', 'Jun', text, flags=re.IGNORECASE)
    text = re.sub(r'\bjuly\b', 'Jul', text, flags=re.IGNORECASE)
    text = re.sub(r'\baugust\b', 'Aug', text, flags=re.IGNORECASE)
    text = re.sub(r'\bseptember\b', 'Sep', text, flags=re.IGNORECASE)
    text = re.sub(r'\boctober\b', 'Oct', text, flags=re.IGNORECASE)
    text = re.sub(r'\bnovember\b', 'Nov', text, flags=re.IGNORECASE)
    text = re.sub(r'\bdecember\b', 'Dec', text, flags=re.IGNORECASE)
    return text


def normalize_spacing(text):
    if not text:
        return text
    text = ' '.join(str(text).split())
    text = re.sub(r'\s*[-–—]\s*', ' - ', text)
    return text.strip(' -')


def extract_display_date(title, due_date):
    title_text = normalize_spacing(short_month_name(title or ''))
    match = re.search(r'\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b', title_text, flags=re.IGNORECASE)
    if match:
        return f"{match.group(1)} {match.group(2).title()}"
    if due_date:
        try:
            due_dt = datetime.fromisoformat(str(due_date).replace('Z', '+00:00'))
            return due_dt.strftime('%d %b').lstrip('0')
        except Exception:
            return None
    return None


def clean_task_display_title(title, company_name=None):
    if not title:
        return 'Untitled Task'
    text = normalize_spacing(short_month_name(title))
    text = re.sub(r'\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\s*-?\s*', '', text, flags=re.IGNORECASE)
    if company_name:
        company_pattern = re.escape(normalize_spacing(short_month_name(company_name)))
        text = re.sub(rf'^{company_pattern}\s*-\s*', '', text, flags=re.IGNORECASE)
    return text.strip(' -') or 'Untitled Task'


def build_task_line(task, context):
    company_name = normalize_spacing(context.get('client_name') or 'Unknown')
    display_date = extract_display_date(task.get('title'), task.get('due_date'))
    task_title = clean_task_display_title(task.get('title'), company_name=company_name)
    task_url = build_task_url(task)
    parts = [company_name]
    if display_date:
        parts.append(display_date)
    parts.append(task_title)
    if task_url:
        parts.append(task_url)
    return ' - '.join(part for part in parts if part)


def build_group_message(assignee_name, grouped_items):
    item = grouped_items[0]
    task = item['task']
    context = item['context']
    task_line = build_task_line(task, context)
    lines = [
        f"Current Priority Task for {assignee_name or 'Team Member'}",
        '',
        'Please work on this task first.',
        'Reply in the same thread using one of these:',
        'started',
        'done',
        'blocked: <reason>',
        'note: <text>',
        '',
        f"Task: {task_line}",
        '',
        'If you are not working on this task, reply with what you are working on right now.'
    ]
    return '\n'.join(lines).strip()


def seed_state_and_event(task, context):
    task_id = task['id']
    current = get_existing_state(task_id)
    now = datetime.now(timezone.utc).isoformat()
    due = task.get('due_date')
    is_overdue = False
    if due:
        try:
            due_dt = datetime.fromisoformat(due.replace('Z', '+00:00'))
            is_overdue = due_dt < datetime.now(timezone.utc)
        except Exception:
            is_overdue = False

    if current is None:
        sql = f"""
        insert into task_control_state (
          task_id, primary_state, is_overdue, ack_required, ack_status,
          assigned_at, followup_count, escalation_level, created_at, updated_at
        ) values (
          {q(task_id)}::uuid,
          'ASSIGNED',
          {str(is_overdue).lower()},
          true,
          'PENDING',
          {q(now)}::timestamptz,
          0,
          0,
          {q(now)}::timestamptz,
          {q(now)}::timestamptz
        );
        """
        psql(sql)
        event_payload = {
            'task_id': task_id,
            'title': task.get('title'),
            'assigned_to': task.get('assigned_to'),
            'status': task.get('status'),
            'source': 'local_mirror_seed',
            'client_name': context.get('client_name'),
            'request_name': context.get('request_name'),
            'assignee_name': context.get('assignee_name'),
            'assignee_email': context.get('assignee_email'),
            'route_space_name': (context.get('route') or {}).get('space_name'),
        }
        psql(f"""
        insert into task_control_events (
          task_id, event_type, from_state, to_state, event_source,
          actor_type, actor_name, message_text, event_payload, created_at
        ) values (
          {q(task_id)}::uuid,
          'ASSIGNED_SEEDED',
          NULL,
          'ASSIGNED',
          'local_dispatcher_seed',
          'system',
          'AV_BOT',
          {q('Initial local Automation 10 assignment seed')},
          {json_sql(event_payload)},
          {q(now)}::timestamptz
        );
        """)
        return 'inserted'

    sql = f"""
    update task_control_state
       set is_overdue = {str(is_overdue).lower()},
           updated_at = {q(now)}::timestamptz,
           assigned_at = coalesce(assigned_at, {q(now)}::timestamptz),
           ack_status = coalesce(ack_status, 'PENDING')
     where task_id = {q(task_id)}::uuid;
    """
    psql(sql)
    return 'updated'


def log_skip_event(task_id, route, reason):
    now = datetime.now(timezone.utc).isoformat()
    event_payload = {
        'task_id': task_id,
        'route_status': (route or {}).get('route_status'),
        'route_space_name': (route or {}).get('space_name'),
        'reason': reason,
    }
    psql(f"""
    insert into task_control_events (
      task_id, event_type, from_state, to_state, event_source,
      actor_type, actor_name, message_text, event_payload, created_at
    ) values (
      {q(task_id)}::uuid,
      'ASSIGNMENT_DISPATCH_SKIPPED',
      'ASSIGNED',
      'ASSIGNED',
      'local_dispatcher',
      'system',
      'AV_BOT',
      {q('Assignment dispatch skipped because route is not active or webhook is missing')},
      {json_sql(event_payload)},
      {q(now)}::timestamptz
    );
    """)


def store_dispatch_mapping(task_ids, response, grouped_items):
    message_name = response.get('name')
    thread_name = (response.get('thread') or {}).get('name')
    task_map = []
    for index, item in enumerate(grouped_items, start=1):
        task = item['task']
        task_map.append({
            'line_number': index,
            'task_id': task.get('id'),
            'task_title': task.get('title'),
            'task_slug': task.get('slug'),
        })
    task_map_sql = json_sql(task_map)
    for task_id in task_ids:
        psql(f"""
        update task_control_state
           set latest_dispatch_message_name = {q(message_name)},
               latest_dispatch_thread_name = {q(thread_name)},
               latest_dispatch_task_map = {task_map_sql},
               updated_at = now()
         where task_id = {q(task_id)}::uuid;
        """)


def send_group_assignment_if_possible(assignee_key, grouped_items):
    context = grouped_items[0]['context']
    route = context.get('route') or {}
    route_status = route.get('route_status')
    webhook = route.get('space_uri')
    task_ids = [item['task']['id'] for item in grouped_items]

    if route_status != 'active' or not webhook or not str(webhook).startswith('https://chat.googleapis.com/'):
        for task_id in task_ids:
            log_skip_event(task_id, route, 'Route not active or webhook missing')
        return {'status': 'skipped', 'task_ids': task_ids, 'reason': 'route_not_active'}

    message_text = build_group_message(context.get('assignee_name'), grouped_items)
    now = datetime.now(timezone.utc).isoformat()
    try:
        response = post_google_chat(webhook, message_text)
        store_dispatch_mapping(task_ids, response, grouped_items)
        for task_id in task_ids:
            event_payload = {
                'task_id': task_id,
                'group_task_ids': task_ids,
                'route_space_name': route.get('space_name'),
                'chat_message_name': response.get('name'),
                'chat_thread_name': (response.get('thread') or {}).get('name'),
                'chat_space': (response.get('space') or {}).get('name'),
                'group_message': message_text,
            }
            psql(f"""
            insert into task_control_events (
              task_id, event_type, from_state, to_state, event_source,
              actor_type, actor_name, message_text, event_payload, created_at
            ) values (
              {q(task_id)}::uuid,
              'ASSIGNMENT_DISPATCHED',
              'ASSIGNED',
              'ASSIGNED',
              'local_dispatcher',
              'system',
              'AV_BOT',
              {q('Grouped assignment message sent to team chat route')},
              {json_sql(event_payload)},
              {q(now)}::timestamptz
            );
            """)
        return {'status': 'sent', 'task_ids': task_ids, 'message_name': response.get('name')}
    except Exception as e:
        for task_id in task_ids:
            event_payload = {
                'task_id': task_id,
                'group_task_ids': task_ids,
                'route_space_name': route.get('space_name'),
                'error': str(e),
            }
            psql(f"""
            insert into task_control_events (
              task_id, event_type, from_state, to_state, event_source,
              actor_type, actor_name, message_text, event_payload, created_at
            ) values (
              {q(task_id)}::uuid,
              'ASSIGNMENT_DISPATCH_FAILED',
              'ASSIGNED',
              'ASSIGNED',
              'local_dispatcher',
              'system',
              'AV_BOT',
              {q('Grouped assignment dispatch failed')},
              {json_sql(event_payload)},
              {q(now)}::timestamptz
            );
            """)
        return {'status': 'failed', 'task_ids': task_ids, 'reason': str(e)}


def main():
    load_env()
    tasks = fetch_candidate_tasks()
    requests_map = get_lookup_map('mirror_requests')
    clients_map = get_lookup_map('mirror_clients')
    team_members_map = get_lookup_map('mirror_team_members')

    route_rows_raw = psql_capture("select row_to_json(t)::text from (select * from team_member_chat_routes) t;")
    routes_map = {}
    for line in route_rows_raw.splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        routes_map[str(row.get('team_member_id'))] = row

    summary = {
        'status': 'success',
        'candidate_tasks': len(tasks),
        'inserted_states': 0,
        'updated_states': 0,
        'missing_request': 0,
        'missing_client': 0,
        'missing_team_member': 0,
        'missing_chat_route': 0,
        'sent_dispatches': 0,
        'skipped_dispatches': 0,
        'failed_dispatches': 0,
        'grouped_dispatch_messages': 0,
        'sample_task_ids': [],
        'sample_dispatch_preview': [],
    }

    grouped = defaultdict(list)
    first_task_per_assignee = {}
    for task in tasks:
        context = build_assignment_context(task, requests_map, clients_map, team_members_map, routes_map)
        if context['request'] is None:
            summary['missing_request'] += 1
        if context['client'] is None:
            summary['missing_client'] += 1
        if context['team_member'] is None:
            summary['missing_team_member'] += 1
        if context['route'] is None:
            summary['missing_chat_route'] += 1

        result = seed_state_and_event(task, context)
        if result == 'inserted':
            summary['inserted_states'] += 1
        else:
            summary['updated_states'] += 1

        assignee_key = (context.get('assignee_email') or 'unknown').lower()
        if assignee_key not in first_task_per_assignee:
            first_task_per_assignee[assignee_key] = {'task': task, 'context': context}

        if len(summary['sample_task_ids']) < 10:
            summary['sample_task_ids'].append(task['id'])

    for assignee_key, selected in first_task_per_assignee.items():
        grouped_items = [selected]
        dispatch_result = send_group_assignment_if_possible(assignee_key, grouped_items)
        summary['grouped_dispatch_messages'] += 1
        if dispatch_result['status'] == 'sent':
            summary['sent_dispatches'] += len(dispatch_result['task_ids'])
        elif dispatch_result['status'] == 'skipped':
            summary['skipped_dispatches'] += len(dispatch_result['task_ids'])
        else:
            summary['failed_dispatches'] += len(dispatch_result['task_ids'])
            summary['status'] = 'partial_failure'

        if len(summary['sample_dispatch_preview']) < 5:
            first = grouped_items[0]
            summary['sample_dispatch_preview'].append({
                'assignee_name': first['context'].get('assignee_name'),
                'assignee_email': first['context'].get('assignee_email'),
                'task_count': len(grouped_items),
                'route_status': (first['context'].get('route') or {}).get('route_status'),
                'dispatch_status': dispatch_result['status'],
                'first_tasks': [
                    {
                        'title': build_task_line(item['task'], item['context']),
                        'url': build_task_url(item['task'])
                    }
                    for item in grouped_items[:1]
                ],
            })

    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
