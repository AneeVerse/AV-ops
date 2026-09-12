#!/usr/bin/env python3
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace')
ACK_TRACKER = ROOT / 'scripts' / 'automation10_ack_tracker_local.py'
VERIFICATION_JSON = ROOT / 'scripts' / 'automation10_team_chat_verification.json'
APPROVED_BOT_SENDER = 'users/114022495153014004089'


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


def fetch_route_rows():
    out = psql_capture("select row_to_json(t)::text from (select * from team_member_chat_routes) t;")
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def fetch_open_task_rows():
    sql = """
    select row_to_json(t)::text
    from (
      select tcs.task_id,
             tcs.primary_state,
             tcs.ack_status,
             tcs.latest_dispatch_message_name,
             tcs.latest_dispatch_thread_name,
             tcs.latest_dispatch_task_map,
             mt.raw->>'title' as task_title,
             mt.raw->>'slug' as task_slug,
             mt.raw->>'assigned_to' as assigned_to,
             tmr.team_member_id,
             tmr.space_name,
             tmr.space_uri,
             tm.name as team_member_name,
             tm.email as team_member_email
      from task_control_state tcs
      join mirror_tasks mt on (mt.raw->>'id')::uuid = tcs.task_id
      left join mirror_team_members tm on tm.profile_id::text = mt.raw->>'assigned_to'
      left join team_member_chat_routes tmr on tmr.team_member_id = tm.id
      where tcs.primary_state in ('ASSIGNED','ACKNOWLEDGED','IN_PROGRESS','BLOCKED','MISMATCH_NEEDS_CLARIFICATION')
    ) t;
    """
    out = psql_capture(sql)
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def fetch_recent_messages(space, account_email):
    cmd = [
        'gog', 'chat', 'messages', 'list', space,
        '--account', account_email,
        '--max', '12', '--order', 'createTime desc', '--json'
    ]
    out = subprocess.check_output(cmd, text=True)
    data = json.loads(out)
    if isinstance(data, dict) and 'messages' in data:
        return data['messages']
    if isinstance(data, list):
        return data
    return []


def normalize_text(text):
    return ' '.join((text or '').strip().lower().split())


def choose_action(text):
    normalized = normalize_text(text)
    if not normalized:
        return None, None, 'empty', None

    numbered = re.match(r'^(\d+)\s+(started|done|blocked|note)\b[:\-\s]*(.*)$', normalized)
    if numbered:
        line_number = int(numbered.group(1))
        keyword = numbered.group(2)
        remainder = (numbered.group(3) or '').strip()
        original_note = text.strip()
        if keyword == 'started':
            return 'START_TASK', original_note, 'numbered_started', line_number
        if keyword == 'done':
            return 'COMPLETE_TASK', original_note, 'numbered_done', line_number
        if keyword == 'blocked':
            return 'BLOCK_TASK', remainder or original_note, 'numbered_blocked', line_number
        if keyword == 'note':
            return 'ADD_STATUS_NOTE', remainder or original_note, 'numbered_note', line_number

    ignore_patterns = [
        r'\bignore\b',
        r'\btesting\b',
        r'\btest\b',
        r'\bautomation\b',
        r'\bautomashion\b',
        r'^hi\b',
        r'^hello\b',
        r'^hey\b',
    ]
    if any(re.search(pattern, normalized) for pattern in ignore_patterns):
        return None, None, 'ignored_noise', None

    if re.fullmatch(r'(ok|okay|oky|noted|received|ack|acknowledged|thik hai|thik hain|theek hai|theek hain)', normalized):
        return 'ACKNOWLEDGE_TASK', text, 'ack', None
    if re.search(r'\b(done|completed|complete|finished)\b', normalized):
        return 'COMPLETE_TASK', text, 'done', None
    if re.search(r'\b(blocked|stuck|waiting|on hold|hold|need input|clarify)\b', normalized):
        return 'BLOCK_TASK', text, 'blocked', None
    if re.search(r'\b(started|starting|in progress|working|started task)\b', normalized):
        return 'START_TASK', text, 'started', None
    if len(normalized.split()) <= 3:
        return None, None, 'too_short_unclear', None
    return 'ADD_STATUS_NOTE', text, 'status_note', None


def pick_task_for_message(task_rows, space, message, line_number=None):
    candidates = [row for row in task_rows if row.get('space_name') == space]
    if not candidates:
        return None, 'no_space_candidate'

    thread_name = message.get('thread')
    if thread_name:
        thread_matches = [row for row in candidates if row.get('latest_dispatch_thread_name') == thread_name]
        if line_number and thread_matches:
            for row in thread_matches:
                task_map = row.get('latest_dispatch_task_map') or []
                for item in task_map:
                    if item.get('line_number') == line_number:
                        target_id = item.get('task_id')
                        exact = [candidate for candidate in thread_matches if str(candidate.get('task_id')) == str(target_id)]
                        if exact:
                            return exact[0], 'thread_line_exact'
        if len(thread_matches) == 1:
            return thread_matches[0], 'thread_exact'
        if thread_matches:
            state_order = {
                'ASSIGNED': 1,
                'ACKNOWLEDGED': 2,
                'IN_PROGRESS': 3,
                'BLOCKED': 4,
                'MISMATCH_NEEDS_CLARIFICATION': 5,
            }
            thread_matches.sort(key=lambda row: (state_order.get(row.get('primary_state'), 99), row.get('task_title') or ''))
            return thread_matches[0], 'thread_multi_fallback'

    state_order = {
        'ASSIGNED': 1,
        'ACKNOWLEDGED': 2,
        'IN_PROGRESS': 3,
        'BLOCKED': 4,
        'MISMATCH_NEEDS_CLARIFICATION': 5,
    }
    candidates.sort(key=lambda row: (state_order.get(row.get('primary_state'), 99), row.get('task_title') or ''))
    return candidates[0], 'heuristic_space_fallback'


def run_ack_tracker(task_id, action, note=None, actor_name='CHAT_REPLY_PARSER'):
    cmd = ['python3', str(ACK_TRACKER), '--task-id', task_id, '--action', action, '--actor-name', actor_name]
    if note and action in {'BLOCK_TASK', 'ADD_STATUS_NOTE'}:
        cmd.extend(['--note', note])
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out)


def main():
    load_env()
    if not VERIFICATION_JSON.exists():
        raise SystemExit('automation10_team_chat_verification.json missing')
    verification_rows = json.loads(VERIFICATION_JSON.read_text())
    task_rows = fetch_open_task_rows()
    reader_account = 'anees@aneeverse.com'
    summary = {
        'status': 'success',
        'spaces_checked': 0,
        'messages_considered': 0,
        'actions_applied': 0,
        'spaces_with_no_human_reply': 0,
        'samples': [],
    }

    for row in verification_rows:
        space = row.get('space')
        email = row.get('email')
        if not space or not email:
            continue
        summary['spaces_checked'] += 1
        try:
            messages = fetch_recent_messages(space, reader_account)
        except Exception as e:
            if len(summary['samples']) < 8:
                summary['samples'].append({'space': space, 'email': email, 'reader_account': reader_account, 'status': 'read_failed', 'error': str(e)})
            continue

        human_messages = []
        for msg in messages:
            sender = ((msg.get('sender') or {}).get('name') if isinstance(msg.get('sender'), dict) else msg.get('sender')) or ''
            text = msg.get('text') or msg.get('argumentText') or ''
            if sender == APPROVED_BOT_SENDER:
                continue
            if not text.strip():
                continue
            if msg.get('thread') and any(row.get('latest_dispatch_thread_name') == msg.get('thread') for row in task_rows if row.get('space_name') == space):
                human_messages.append(msg)
                continue
            human_messages.append(msg)

        if not human_messages:
            summary['spaces_with_no_human_reply'] += 1
            if len(summary['samples']) < 8:
                summary['samples'].append({'space': space, 'email': email, 'reader_account': reader_account, 'status': 'no_human_reply'})
            continue

        latest = None
        for candidate in human_messages:
            candidate_thread = candidate.get('thread')
            if candidate_thread and any(row.get('latest_dispatch_thread_name') == candidate_thread for row in task_rows if row.get('space_name') == space):
                latest = candidate
                break
        if latest is None:
            latest = human_messages[0]
        text = latest.get('text') or latest.get('argumentText') or ''
        summary['messages_considered'] += 1
        action, note, reason, line_number = choose_action(text)
        task_row, match_reason = pick_task_for_message(task_rows, space, latest, line_number=line_number)
        if task_row is None or action is None:
            if len(summary['samples']) < 8:
                summary['samples'].append({
                    'space': space,
                    'email': email,
                    'status': 'ignored_or_no_task_match',
                    'reason': reason,
                    'line_number': line_number,
                    'match_reason': match_reason,
                    'reader_account': reader_account,
                    'message_text': text,
                })
            continue

        try:
            applied = run_ack_tracker(task_row['task_id'], action, note=note)
            summary['actions_applied'] += 1
            if len(summary['samples']) < 8:
                summary['samples'].append({
                    'space': space,
                    'email': email,
                    'task_title': task_row.get('task_title'),
                    'reader_account': reader_account,
                    'message_text': text,
                    'action': action,
                    'reason': reason,
                    'line_number': line_number,
                    'match_reason': match_reason,
                    'result': applied,
                })
        except Exception as e:
            if len(summary['samples']) < 8:
                summary['samples'].append({
                    'space': space,
                    'email': email,
                    'task_title': task_row.get('task_title'),
                    'reader_account': reader_account,
                    'message_text': text,
                    'action': action,
                    'reason': reason,
                    'line_number': line_number,
                    'match_reason': match_reason,
                    'status': 'apply_failed',
                    'error': str(e),
                })

    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
