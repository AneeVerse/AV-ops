#!/usr/bin/env python3
import json
import os
import subprocess
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


def write_event(task_id, event_type, from_state, to_state, message_text, payload):
    now = datetime.now(timezone.utc).isoformat()
    psql(f"""
    insert into task_control_events (
      task_id, event_type, from_state, to_state, event_source,
      actor_type, actor_name, message_text, event_payload, created_at
    ) values (
      {q(task_id)}::uuid,
      {q(event_type)},
      {q(from_state)},
      {q(to_state)},
      'local_followup_engine',
      'system',
      'AV_BOT',
      {q(message_text)},
      {json_sql(payload)},
      {q(now)}::timestamptz
    );
    """)


def update_followup_fields(task_id, escalate=False):
    sql = f"""
    update task_control_state
       set last_followup_at = now(),
           followup_count = coalesce(followup_count, 0) + 1,
           escalation_level = coalesce(escalation_level, 0) + {1 if escalate else 0},
           last_escalated_at = case when {str(escalate).lower()} then now() else last_escalated_at end,
           updated_at = now()
     where task_id = {q(task_id)}::uuid;
    """
    psql(sql)


def classify(state, task_row):
    primary = state.get('primary_state')
    is_overdue = bool(state.get('is_overdue'))
    ack_status = state.get('ack_status')
    task_title = task_row.get('title') if task_row else None

    if primary == 'COMPLETED':
        return None
    if primary == 'BLOCKED':
        return {
            'category': 'blocked_followup',
            'event_type': 'BLOCKER_REVIEW_SENT',
            'message': f"Blocked task still needs review: {task_title or state.get('task_id')}",
            'escalate': is_overdue,
        }
    if primary == 'MISMATCH_NEEDS_CLARIFICATION':
        return {
            'category': 'clarification_followup',
            'event_type': 'CLARIFICATION_ESCALATED',
            'message': f"Clarification needed for task: {task_title or state.get('task_id')}",
            'escalate': True,
        }
    if primary == 'ASSIGNED' and ack_status == 'PENDING':
        return {
            'category': 'awaiting_ack',
            'event_type': 'FOLLOWUP_SENT',
            'message': f"Awaiting acknowledgement for assigned task: {task_title or state.get('task_id')}",
            'escalate': is_overdue,
        }
    if primary == 'ACKNOWLEDGED':
        return {
            'category': 'acknowledged_not_started',
            'event_type': 'FOLLOWUP_SENT',
            'message': f"Follow up on acknowledged task not yet started: {task_title or state.get('task_id')}",
            'escalate': is_overdue,
        }
    if primary == 'IN_PROGRESS':
        return {
            'category': 'in_progress_check',
            'event_type': 'FOLLOWUP_SENT',
            'message': f"Progress check needed for task: {task_title or state.get('task_id')}",
            'escalate': is_overdue,
        }
    if primary == 'UNASSIGNED':
        return {
            'category': 'unassigned_attention',
            'event_type': 'FOLLOWUP_ESCALATED',
            'message': f"Unassigned task needs attention: {task_title or state.get('task_id')}",
            'escalate': True,
        }
    return None


def main():
    load_env()
    states = fetch_states()
    tasks_map = get_lookup_map('mirror_tasks')
    current_task_ids = current_task_ids_by_assignee(tasks_map)
    summary = {
        'status': 'success',
        'states_checked': len(states),
        'current_states_checked': 0,
        'skipped_non_current': 0,
        'followups_created': 0,
        'escalations_created': 0,
        'categories': {},
        'sample_actions': [],
    }
    for state in states:
        task_id = str(state.get('task_id'))
        task_row = tasks_map.get(task_id)
        if task_id not in current_task_ids:
            summary['skipped_non_current'] += 1
            continue
        summary['current_states_checked'] += 1
        action = classify(state, task_row)
        if action is None:
            continue
        write_event(task_id, action['event_type'], state.get('primary_state'), state.get('primary_state'), action['message'], {
            'task_id': task_id,
            'category': action['category'],
            'escalate': action['escalate'],
        })
        update_followup_fields(task_id, escalate=action['escalate'])
        summary['followups_created'] += 1
        if action['escalate']:
            summary['escalations_created'] += 1
        summary['categories'][action['category']] = summary['categories'].get(action['category'], 0) + 1
        if len(summary['sample_actions']) < 8:
            summary['sample_actions'].append({
                'task_id': task_id,
                'primary_state': state.get('primary_state'),
                'category': action['category'],
                'escalate': action['escalate'],
                'message': action['message'],
            })
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
