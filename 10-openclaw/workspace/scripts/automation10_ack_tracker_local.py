#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace')
VALID_ACTIONS = {
    'ACKNOWLEDGE_TASK',
    'START_TASK',
    'BLOCK_TASK',
    'FLAG_MISMATCH',
    'COMPLETE_TASK',
    'ADD_STATUS_NOTE',
    'REOPEN_TASK',
}


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


def get_state(task_id):
    sql = f"""
    select row_to_json(t)::text
    from (
      select * from task_control_state where task_id = {q(task_id)}::uuid
    ) t;
    """
    out = psql_capture(sql).strip()
    if not out:
        return None
    return json.loads(out)


def write_event(task_id, event_type, from_state, to_state, event_source, actor_type, actor_name, message_text, payload):
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
      {q(event_source)},
      {q(actor_type)},
      {q(actor_name)},
      {q(message_text)},
      {json_sql(payload)},
      {q(now)}::timestamptz
    );
    """)


def update_state(task_id, updates):
    if not updates:
        return
    assignments = []
    for key, value in updates.items():
        if value == '__NOW__':
            assignments.append(f"{key} = now()")
        elif value is None:
            assignments.append(f"{key} = NULL")
        elif isinstance(value, bool):
            assignments.append(f"{key} = {str(value).lower()}")
        elif isinstance(value, int):
            assignments.append(f"{key} = {value}")
        else:
            assignments.append(f"{key} = {q(value)}")
    assignments.append("updated_at = now()")
    sql = f"update task_control_state set {', '.join(assignments)} where task_id = {q(task_id)}::uuid;"
    psql(sql)


def handle_action(task_id, action, note=None, actor_name='AV_BOT'):
    state = get_state(task_id)
    if state is None:
        raise SystemExit(f'task_control_state missing for task_id {task_id}')

    current = state.get('primary_state')
    payload = {'task_id': task_id, 'action': action, 'note': note}
    updates = {}
    event_type = None
    message_text = None
    to_state = current

    if action == 'ACKNOWLEDGE_TASK':
        to_state = 'ACKNOWLEDGED'
        updates = {'primary_state': 'ACKNOWLEDGED', 'ack_status': 'ACKNOWLEDGED', 'acked_at': '__NOW__'}
        event_type = 'ACKNOWLEDGED'
        message_text = 'Task acknowledged'
    elif action == 'START_TASK':
        to_state = 'IN_PROGRESS'
        updates = {'primary_state': 'IN_PROGRESS', 'ack_status': 'ACKNOWLEDGED', 'acked_at': '__NOW__' if state.get('acked_at') is None else state.get('acked_at'), 'started_at': '__NOW__'}
        event_type = 'STARTED'
        message_text = 'Task started'
    elif action == 'BLOCK_TASK':
        if not note:
            raise SystemExit('BLOCK_TASK requires --note')
        to_state = 'BLOCKED'
        updates = {'primary_state': 'BLOCKED', 'blocked_reason': note, 'blocked_at': '__NOW__'}
        event_type = 'BLOCKED'
        message_text = 'Task blocked'
    elif action == 'FLAG_MISMATCH':
        if not note:
            raise SystemExit('FLAG_MISMATCH requires --note')
        to_state = 'MISMATCH_NEEDS_CLARIFICATION'
        updates = {'primary_state': 'MISMATCH_NEEDS_CLARIFICATION', 'clarification_reason': note, 'clarification_at': '__NOW__'}
        event_type = 'CLARIFICATION_REQUIRED'
        message_text = 'Task flagged for clarification'
    elif action == 'COMPLETE_TASK':
        to_state = 'COMPLETED'
        updates = {'primary_state': 'COMPLETED', 'ack_status': 'ACKNOWLEDGED', 'completed_at': '__NOW__'}
        event_type = 'COMPLETED'
        message_text = 'Task completed'
    elif action == 'ADD_STATUS_NOTE':
        if not note:
            raise SystemExit('ADD_STATUS_NOTE requires --note')
        updates = {'control_note': note}
        event_type = 'STATUS_NOTE_ADDED'
        message_text = 'Status note added'
    elif action == 'REOPEN_TASK':
        to_state = 'ASSIGNED'
        updates = {'primary_state': 'ASSIGNED', 'completed_at': None, 'blocked_reason': None, 'clarification_reason': None}
        event_type = 'REOPENED'
        message_text = 'Task reopened'
    else:
        raise SystemExit(f'unsupported action: {action}')

    update_state(task_id, updates)
    write_event(task_id, event_type, current, to_state, 'local_ack_tracker', 'system', actor_name, message_text, payload)
    return {
        'status': 'success',
        'task_id': task_id,
        'action': action,
        'from_state': current,
        'to_state': to_state,
        'note': note,
    }


def main():
    load_env()
    parser = argparse.ArgumentParser(description='Automation 10 local acknowledgement tracker')
    parser.add_argument('--task-id', required=True)
    parser.add_argument('--action', required=True, choices=sorted(VALID_ACTIONS))
    parser.add_argument('--note')
    parser.add_argument('--actor-name', default='AV_BOT')
    args = parser.parse_args()
    result = handle_action(args.task_id, args.action, note=args.note, actor_name=args.actor_name)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
