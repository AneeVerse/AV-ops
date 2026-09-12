#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ENV_KEYS = [
    'AV_BOT_PGHOST',
    'AV_BOT_PGPORT',
    'AV_BOT_PGDATABASE',
    'AV_BOT_PGUSER',
    'AV_BOT_PGPASSWORD',
]


def load_env_file(path='/root/.env'):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k, v)


def ensure_env():
    load_env_file()
    missing = [k for k in ENV_KEYS if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Missing env keys: {', '.join(missing)}")


def run_sql(sql, fetch=False):
    ensure_env()
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    cmd = [
        'psql',
        '-h', env['AV_BOT_PGHOST'],
        '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'],
        '-d', env['AV_BOT_PGDATABASE'],
        '-At',
        '-c', sql,
    ]
    out = subprocess.check_output(cmd, env=env, text=True)
    return out.strip() if fetch else None


def q(s):
    return "'" + s.replace("'", "''") + "'"


def j(v):
    return q(json.dumps(v)) + '::jsonb'


def upsert_setting(key, value):
    sql = f"""
    INSERT INTO persistent_settings(key, value, updated_at)
    VALUES ({q(key)}, {j(value)}, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    """
    run_sql(sql)


def upsert_state(key, value):
    sql = f"""
    INSERT INTO state_store(key, value, updated_at)
    VALUES ({q(key)}, {j(value)}, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    """
    run_sql(sql)


def add_note(scope, title, body, tags=None, source=None):
    tags = tags or []
    tags_sql = 'ARRAY[' + ','.join(q(x) for x in tags) + ']::text[]' if tags else 'ARRAY[]::text[]'
    source_sql = q(source) if source else 'NULL'
    sql = f"""
    INSERT INTO memory_notes(scope, title, body, tags, source)
    VALUES ({q(scope)}, {q(title)}, {q(body)}, {tags_sql}, {source_sql});
    """
    run_sql(sql)


def add_task(kind, title, detail='', status='open', metadata=None):
    sql = f"""
    INSERT INTO task_log(kind, title, detail, status, metadata)
    VALUES ({q(kind)}, {q(title)}, {q(detail)}, {q(status)}, {j(metadata or {})});
    """
    run_sql(sql)


def add_reminder(title, detail='', due_at=None, status='pending', source=None, metadata=None):
    due_sql = q(due_at) if due_at else 'NULL'
    source_sql = q(source) if source else 'NULL'
    sql = f"""
    INSERT INTO reminders(title, detail, due_at, status, source, metadata)
    VALUES ({q(title)}, {q(detail)}, {due_sql}, {q(status)}, {source_sql}, {j(metadata or {})});
    """
    run_sql(sql)


def add_client_audit(client_name, audit_type, summary='', findings=None):
    sql = f"""
    INSERT INTO client_audits(client_name, audit_type, summary, findings)
    VALUES ({q(client_name)}, {q(audit_type)}, {q(summary)}, {j(findings or {})});
    """
    run_sql(sql)


def record_client_audit(client_name, scope, status, issue_count=0, issues=None, actions=None, summary=''):
    findings = {
        'scope': scope,
        'status': status,
        'issue_count': issue_count,
        'issues': issues or [],
        'actions': actions or []
    }
    add_client_audit(client_name, 'drive_audit', summary, findings)


def upsert_session_fact(session_key, fact_key, fact_value):
    sql = f"""
    INSERT INTO session_facts(session_key, fact_key, fact_value, updated_at)
    VALUES ({q(session_key)}, {q(fact_key)}, {j(fact_value)}, now())
    ON CONFLICT (session_key, fact_key)
    DO UPDATE SET fact_value = EXCLUDED.fact_value, updated_at = now();
    """
    run_sql(sql)


def upsert_workflow_checkpoint(workflow_name, checkpoint_key, checkpoint_value, status='active'):
    sql = f"""
    INSERT INTO workflow_checkpoints(workflow_name, checkpoint_key, checkpoint_value, status, updated_at)
    VALUES ({q(workflow_name)}, {q(checkpoint_key)}, {j(checkpoint_value)}, {q(status)}, now())
    ON CONFLICT (workflow_name, checkpoint_key)
    DO UPDATE SET checkpoint_value = EXCLUDED.checkpoint_value, status = EXCLUDED.status, updated_at = now();
    """
    run_sql(sql)


def ping():
    out = run_sql("SELECT current_database() || E'\\n' || current_user;", fetch=True).splitlines()
    print(json.dumps({'database': out[0], 'user': out[1]}))


def list_rows(table, limit=20):
    allowed = {
        'persistent_settings', 'state_store', 'memory_notes', 'task_log',
        'drive_moves', 'client_audits', 'session_facts', 'workflow_checkpoints', 'reminders'
    }
    if table not in allowed:
        raise SystemExit(f'Unsupported table: {table}')
    sql = f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM {table} ORDER BY 1 DESC LIMIT {int(limit)}) t) TO STDOUT;"
    out = run_sql(sql, fetch=True)
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    print(json.dumps(rows, indent=2))


def get_setting(key):
    out = run_sql(f"SELECT value::text FROM persistent_settings WHERE key = {q(key)};", fetch=True)
    print(out if out else 'null')


def get_state(key):
    out = run_sql(f"SELECT value::text FROM state_store WHERE key = {q(key)};", fetch=True)
    print(out if out else 'null')


def query_tasks(status=None, kind=None, limit=20):
    where = []
    if status:
        where.append(f"status = {q(status)}")
    if kind:
        where.append(f"kind = {q(kind)}")
    cond = ('WHERE ' + ' AND '.join(where)) if where else ''
    sql = f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM task_log {cond} ORDER BY id DESC LIMIT {int(limit)}) t) TO STDOUT;"
    out = run_sql(sql, fetch=True)
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    print(json.dumps(rows, indent=2))


def query_reminders(status=None, limit=20):
    cond = f"WHERE status = {q(status)}" if status else ''
    sql = f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM reminders {cond} ORDER BY due_at NULLS LAST, id DESC LIMIT {int(limit)}) t) TO STDOUT;"
    out = run_sql(sql, fetch=True)
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    print(json.dumps(rows, indent=2))


def log_drive_move(client_name, file_name, from_path='', to_path='', classification='', metadata=None):
    sql = f"""
    INSERT INTO drive_moves(client_name, file_name, from_path, to_path, classification, metadata)
    VALUES ({q(client_name)}, {q(file_name)}, {q(from_path)}, {q(to_path)}, {q(classification)}, {j(metadata or {})});
    """
    run_sql(sql)


def query_client_audits(client_name=None, limit=20):
    cond = f"WHERE client_name = {q(client_name)}" if client_name else ''
    sql = f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM client_audits {cond} ORDER BY id DESC LIMIT {int(limit)}) t) TO STDOUT;"
    out = run_sql(sql, fetch=True)
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    print(json.dumps(rows, indent=2))


def update_reminder_status(reminder_id, status):
    run_sql(f"UPDATE reminders SET status = {q(status)}, updated_at = now() WHERE id = {int(reminder_id)};")


def update_task_status(task_id, status):
    run_sql(f"UPDATE task_log SET status = {q(status)}, updated_at = now() WHERE id = {int(task_id)};")


def due_reminders(before=None, limit=20):
    cond = f"AND due_at <= {q(before)}" if before else ''
    sql = f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM reminders WHERE status = 'pending' {cond} ORDER BY due_at NULLS LAST, id ASC LIMIT {int(limit)}) t) TO STDOUT;"
    out = run_sql(sql, fetch=True)
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    print(json.dumps(rows, indent=2))


def daily_review(limit=10):
    sections = {}
    def fetch(sql):
        out = run_sql(sql, fetch=True)
        return [json.loads(line) for line in out.splitlines() if line.strip()]
    sections['pending_reminders'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_at NULLS LAST, id DESC LIMIT {int(limit)}) t) TO STDOUT;")
    sections['active_workflows'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM workflow_checkpoints WHERE status IN ('active','done') ORDER BY updated_at DESC, id DESC LIMIT {int(limit)}) t) TO STDOUT;")
    sections['recent_client_audits'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT * FROM client_audits ORDER BY id DESC LIMIT {int(limit)}) t) TO STDOUT;")
    print(json.dumps(sections, indent=2))


def dashboard(limit=10):
    sections = {}
    def fetch(sql):
        out = run_sql(sql, fetch=True)
        return [json.loads(line) for line in out.splitlines() if line.strip()]
    sections['runtime_state'] = fetch("COPY (SELECT row_to_json(t) FROM (SELECT key, value, updated_at FROM state_store WHERE key = 'runtime_status' ORDER BY updated_at DESC LIMIT 1) t) TO STDOUT;")
    sections['pending_reminders'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT id, title, due_at, status, source FROM reminders WHERE status = 'pending' ORDER BY due_at NULLS LAST, id DESC LIMIT {int(limit)}) t) TO STDOUT;")
    sections['active_workflows'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT workflow_name, checkpoint_key, status, checkpoint_value, updated_at FROM workflow_checkpoints WHERE status IN ('active','done') ORDER BY updated_at DESC LIMIT {int(limit)}) t) TO STDOUT;")
    sections['recent_client_audits'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT client_name, audit_type, summary, findings, created_at FROM client_audits ORDER BY id DESC LIMIT {int(limit)}) t) TO STDOUT;")
    sections['recent_tasks'] = fetch(f"COPY (SELECT row_to_json(t) FROM (SELECT id, kind, title, status, created_at FROM task_log ORDER BY id DESC LIMIT {int(limit)}) t) TO STDOUT;")
    print(json.dumps(sections, indent=2))


def usage():
    print(
        'Usage:\n'
        '  avbot_db.py ping\n'
        '  avbot_db.py set-setting <key> <json>\n'
        '  avbot_db.py set-state <key> <json>\n'
        '  avbot_db.py add-note <scope> <title> <body> [tags_json] [source]\n'
        '  avbot_db.py add-task <kind> <title> [detail] [status] [metadata_json]\n'
        '  avbot_db.py add-reminder <title> [detail] [due_at] [status] [source] [metadata_json]\n'
        '  avbot_db.py add-client-audit <client_name> <audit_type> [summary] [findings_json]\n'
        '  avbot_db.py record-client-audit <client_name> <scope> <status> [issue_count] [issues_json] [actions_json] [summary]\n'
        '  avbot_db.py upsert-session-fact <session_key> <fact_key> <fact_value_json>\n'
        '  avbot_db.py upsert-workflow-checkpoint <workflow_name> <checkpoint_key> <checkpoint_value_json> [status]\n'
        '  avbot_db.py list <table> [limit]\n'
        '  avbot_db.py get-setting <key>\n'
        '  avbot_db.py get-state <key>\n'
        '  avbot_db.py query-tasks [status] [kind] [limit]\n'
        '  avbot_db.py query-reminders [status] [limit]\n'
        '  avbot_db.py log-drive-move <client_name> <file_name> [from_path] [to_path] [classification] [metadata_json]\n'
        '  avbot_db.py query-client-audits [client_name] [limit]\n'
        '  avbot_db.py update-reminder-status <id> <status>\n'
        '  avbot_db.py update-task-status <id> <status>\n'
        '  avbot_db.py due-reminders [before_iso] [limit]\n'
        '  avbot_db.py daily-review [limit]\n'
        '  avbot_db.py dashboard [limit]'
    )


if __name__ == '__main__':
    if len(sys.argv) < 2:
        usage()
        raise SystemExit(1)
    cmd = sys.argv[1]
    if cmd == 'ping':
        ping()
    elif cmd == 'set-setting' and len(sys.argv) >= 4:
        upsert_setting(sys.argv[2], json.loads(sys.argv[3]))
    elif cmd == 'set-state' and len(sys.argv) >= 4:
        upsert_state(sys.argv[2], json.loads(sys.argv[3]))
    elif cmd == 'add-note' and len(sys.argv) >= 5:
        tags = json.loads(sys.argv[5]) if len(sys.argv) >= 6 else []
        source = sys.argv[6] if len(sys.argv) >= 7 else None
        add_note(sys.argv[2], sys.argv[3], sys.argv[4], tags, source)
    elif cmd == 'add-task' and len(sys.argv) >= 4:
        detail = sys.argv[4] if len(sys.argv) >= 5 else ''
        status = sys.argv[5] if len(sys.argv) >= 6 else 'open'
        metadata = json.loads(sys.argv[6]) if len(sys.argv) >= 7 else {}
        add_task(sys.argv[2], sys.argv[3], detail, status, metadata)
    elif cmd == 'add-reminder' and len(sys.argv) >= 3:
        detail = sys.argv[3] if len(sys.argv) >= 4 else ''
        due_at = sys.argv[4] if len(sys.argv) >= 5 else None
        status = sys.argv[5] if len(sys.argv) >= 6 else 'pending'
        source = sys.argv[6] if len(sys.argv) >= 7 else None
        metadata = json.loads(sys.argv[7]) if len(sys.argv) >= 8 else {}
        add_reminder(sys.argv[2], detail, due_at, status, source, metadata)
    elif cmd == 'add-client-audit' and len(sys.argv) >= 4:
        summary = sys.argv[4] if len(sys.argv) >= 5 else ''
        findings = json.loads(sys.argv[5]) if len(sys.argv) >= 6 else {}
        add_client_audit(sys.argv[2], sys.argv[3], summary, findings)
    elif cmd == 'record-client-audit' and len(sys.argv) >= 5:
        issue_count = int(sys.argv[5]) if len(sys.argv) >= 6 else 0
        issues = json.loads(sys.argv[6]) if len(sys.argv) >= 7 else []
        actions = json.loads(sys.argv[7]) if len(sys.argv) >= 8 else []
        summary = sys.argv[8] if len(sys.argv) >= 9 else ''
        record_client_audit(sys.argv[2], sys.argv[3], sys.argv[4], issue_count, issues, actions, summary)
    elif cmd == 'upsert-session-fact' and len(sys.argv) >= 5:
        upsert_session_fact(sys.argv[2], sys.argv[3], json.loads(sys.argv[4]))
    elif cmd == 'upsert-workflow-checkpoint' and len(sys.argv) >= 5:
        status = sys.argv[5] if len(sys.argv) >= 6 else 'active'
        upsert_workflow_checkpoint(sys.argv[2], sys.argv[3], json.loads(sys.argv[4]), status)
    elif cmd == 'list' and len(sys.argv) >= 3:
        limit = int(sys.argv[3]) if len(sys.argv) >= 4 else 20
        list_rows(sys.argv[2], limit)
    elif cmd == 'get-setting' and len(sys.argv) >= 3:
        get_setting(sys.argv[2])
    elif cmd == 'get-state' and len(sys.argv) >= 3:
        get_state(sys.argv[2])
    elif cmd == 'query-tasks':
        status = sys.argv[2] if len(sys.argv) >= 3 and sys.argv[2] != 'null' else None
        kind = sys.argv[3] if len(sys.argv) >= 4 and sys.argv[3] != 'null' else None
        limit = int(sys.argv[4]) if len(sys.argv) >= 5 else 20
        query_tasks(status, kind, limit)
    elif cmd == 'query-reminders':
        status = sys.argv[2] if len(sys.argv) >= 3 and sys.argv[2] != 'null' else None
        limit = int(sys.argv[3]) if len(sys.argv) >= 4 else 20
        query_reminders(status, limit)
    elif cmd == 'log-drive-move' and len(sys.argv) >= 4:
        from_path = sys.argv[4] if len(sys.argv) >= 5 else ''
        to_path = sys.argv[5] if len(sys.argv) >= 6 else ''
        classification = sys.argv[6] if len(sys.argv) >= 7 else ''
        metadata = json.loads(sys.argv[7]) if len(sys.argv) >= 8 else {}
        log_drive_move(sys.argv[2], sys.argv[3], from_path, to_path, classification, metadata)
    elif cmd == 'query-client-audits':
        client_name = sys.argv[2] if len(sys.argv) >= 3 and sys.argv[2] != 'null' else None
        limit = int(sys.argv[3]) if len(sys.argv) >= 4 else 20
        query_client_audits(client_name, limit)
    elif cmd == 'update-reminder-status' and len(sys.argv) >= 4:
        update_reminder_status(sys.argv[2], sys.argv[3])
    elif cmd == 'update-task-status' and len(sys.argv) >= 4:
        update_task_status(sys.argv[2], sys.argv[3])
    elif cmd == 'due-reminders':
        before = sys.argv[2] if len(sys.argv) >= 3 and sys.argv[2] != 'null' else None
        limit = int(sys.argv[3]) if len(sys.argv) >= 4 else 20
        due_reminders(before, limit)
    elif cmd == 'daily-review':
        limit = int(sys.argv[2]) if len(sys.argv) >= 3 else 10
        daily_review(limit)
    elif cmd == 'dashboard':
        limit = int(sys.argv[2]) if len(sys.argv) >= 3 else 10
        dashboard(limit)
    else:
        usage()
        raise SystemExit(1)
