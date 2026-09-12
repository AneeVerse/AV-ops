#!/usr/bin/env python3
import json
import os
import subprocess
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


def fetch_states():
    sql = "select row_to_json(t)::text from (select * from task_control_state order by updated_at desc) t;"
    out = psql_capture(sql)
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def current_task_ids_by_assignee(tasks_map):
    ranked = {}
    for task_id, task in tasks_map.items():
        assigned_to = task.get('assigned_to')
        status = (task.get('status') or '').strip().lower()
        if not assigned_to or status == 'done':
            continue
        due_date = task.get('due_date') or '9999-12-31T23:59:59Z'
        updated_at = task.get('updated_at') or task.get('created_at') or ''
        key = str(assigned_to)
        candidate = (due_date, updated_at, str(task_id))
        if key not in ranked or candidate < ranked[key][0]:
            ranked[key] = (candidate, str(task_id))
    return {task_id for _, task_id in ranked.values()}


def resolve_team_member(task_row, team_members_map):
    assigned_to = str(task_row.get('assigned_to')) if task_row and task_row.get('assigned_to') is not None else None
    member = team_members_map.get(assigned_to)
    if member is None and assigned_to is not None:
        for item in team_members_map.values():
            if str(item.get('profile_id')) == assigned_to:
                return item
    return member


def build_task_view(state, tasks_map, requests_map, clients_map, team_members_map):
    task_id = str(state.get('task_id'))
    task = tasks_map.get(task_id)
    request = requests_map.get(str(task.get('request_id'))) if task else None
    client = clients_map.get(str(request.get('client_id'))) if request else None
    member = resolve_team_member(task, team_members_map) if task else None
    return {
        'task_id': task_id,
        'task_title': (task or {}).get('title'),
        'primary_state': state.get('primary_state'),
        'is_overdue': bool(state.get('is_overdue')),
        'client_name': (client or {}).get('organization') or (client or {}).get('name'),
        'request_name': (request or {}).get('title'),
        'assignee_name': (member or {}).get('name'),
        'assignee_email': (member or {}).get('email'),
        'priority': (task or {}).get('priority'),
        'due_date': (task or {}).get('due_date'),
        'blocked_reason': state.get('blocked_reason'),
        'clarification_reason': state.get('clarification_reason'),
        'followup_count': state.get('followup_count') or 0,
        'escalation_level': state.get('escalation_level') or 0,
    }


def main():
    load_env()
    states = fetch_states()
    tasks_map = get_lookup_map('mirror_tasks')
    requests_map = get_lookup_map('mirror_requests')
    clients_map = get_lookup_map('mirror_clients')
    team_members_map = get_lookup_map('mirror_team_members')

    current_task_ids = current_task_ids_by_assignee(tasks_map)
    views = [
        build_task_view(s, tasks_map, requests_map, clients_map, team_members_map)
        for s in states
        if str(s.get('task_id')) in current_task_ids
    ]

    counts = {
        'unassigned': 0,
        'assigned': 0,
        'acknowledged': 0,
        'in_progress': 0,
        'blocked': 0,
        'overdue': 0,
        'clarification_needed': 0,
        'completed': 0,
    }

    critical_items = []
    blocked_items = []
    overdue_items = []
    clarification_items = []
    awaiting_movement = []
    recent_completed = []

    for item in views:
        state = item['primary_state']
        if state == 'UNASSIGNED':
            counts['unassigned'] += 1
        elif state == 'ASSIGNED':
            counts['assigned'] += 1
            awaiting_movement.append(item)
        elif state == 'ACKNOWLEDGED':
            counts['acknowledged'] += 1
            awaiting_movement.append(item)
        elif state == 'IN_PROGRESS':
            counts['in_progress'] += 1
        elif state == 'BLOCKED':
            counts['blocked'] += 1
            blocked_items.append(item)
        elif state == 'MISMATCH_NEEDS_CLARIFICATION':
            counts['clarification_needed'] += 1
            clarification_items.append(item)
        elif state == 'COMPLETED':
            counts['completed'] += 1
            recent_completed.append(item)

        if item['is_overdue'] and state != 'COMPLETED':
            counts['overdue'] += 1
            overdue_items.append(item)

        if (item['is_overdue'] and state in ('BLOCKED', 'MISMATCH_NEEDS_CLARIFICATION', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS')) or state in ('BLOCKED', 'MISMATCH_NEEDS_CLARIFICATION'):
            critical_items.append(item)

    def sort_key(x):
        return (-int(x['is_overdue']), -(x['escalation_level'] or 0), x['client_name'] or '', x['task_title'] or '')

    critical_items.sort(key=sort_key)
    blocked_items.sort(key=sort_key)
    overdue_items.sort(key=sort_key)
    clarification_items.sort(key=sort_key)
    awaiting_movement.sort(key=sort_key)
    recent_completed.sort(key=sort_key)

    summary_text_lines = [
        'Daily Task Control Summary',
        '',
        f"⌛️ Unassigned: {counts['unassigned']}",
        f"⌛️ Assigned: {counts['assigned']}",
        f"✍️ Acknowledged: {counts['acknowledged']}",
        f"✍️ In Progress: {counts['in_progress']}",
        f"⌛️ Blocked: {counts['blocked']}",
        f"⌛️ Overdue: {counts['overdue']}",
        f"⌛️ Clarification Needed: {counts['clarification_needed']}",
        f"✅ Completed: {counts['completed']}",
        '',
        'Critical Items:'
    ]

    def add_items(lines, title, items, limit=5, formatter=None):
        lines.append(title)
        if not items:
            lines.append('- none')
            return
        for item in items[:limit]:
            if formatter:
                lines.append(formatter(item))
            else:
                lines.append(f"- {item['client_name'] or 'Unknown'} | {item['task_title'] or 'Untitled'} | {item['assignee_name'] or 'Unknown'}")

    add_items(summary_text_lines, '', critical_items[:5])
    add_items(summary_text_lines, 'Overdue:', overdue_items)
    add_items(summary_text_lines, 'Blocked:', blocked_items, formatter=lambda x: f"- {x['client_name'] or 'Unknown'} | {x['task_title'] or 'Untitled'} | {x['assignee_name'] or 'Unknown'} | {x['blocked_reason'] or 'No blocker reason'}")
    add_items(summary_text_lines, 'Clarification Needed:', clarification_items, formatter=lambda x: f"- {x['client_name'] or 'Unknown'} | {x['task_title'] or 'Untitled'} | {x['assignee_name'] or 'Unknown'} | {x['clarification_reason'] or 'Needs clarification'}")
    add_items(summary_text_lines, 'Awaiting Movement:', awaiting_movement, formatter=lambda x: f"- {x['client_name'] or 'Unknown'} | {x['task_title'] or 'Untitled'} | {x['assignee_name'] or 'Unknown'} | {x['primary_state']}")
    add_items(summary_text_lines, 'Recent Completed:', recent_completed)

    output = {
        'status': 'success',
        'tracked_current_tasks': len(views),
        'counts': counts,
        'critical_count': len(critical_items),
        'critical_items': critical_items[:10],
        'overdue_items': overdue_items[:10],
        'blocked_items': blocked_items[:10],
        'clarification_items': clarification_items[:10],
        'awaiting_movement': awaiting_movement[:10],
        'recent_completed': recent_completed[:10],
        'summary_text': '\n'.join(summary_text_lines),
    }
    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
