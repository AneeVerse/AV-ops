#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone


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


def fetch_json(url):
    req = urllib.request.Request(url, headers={
        'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
        'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def fetch_table(table):
    base = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + f'/rest/v1/{table}'
    query = urllib.parse.urlencode({'select': '*'})
    return fetch_json(base + '?' + query)


def fetch_openapi_spec():
    url = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/'
    return fetch_json(url)


def psql(sql):
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    cmd = [
        'psql', '-h', env['AV_BOT_PGHOST'], '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'], '-d', env['AV_BOT_PGDATABASE'],
        '-v', 'ON_ERROR_STOP=1', '-c', sql
    ]
    subprocess.check_call(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def psql_capture(sql):
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    cmd = [
        'psql', '-h', env['AV_BOT_PGHOST'], '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'], '-d', env['AV_BOT_PGDATABASE'],
        '-v', 'ON_ERROR_STOP=1', '-At', '-F', '\t', '-c', sql
    ]
    return subprocess.check_output(cmd, env=env, text=True)


def q(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def json_sql(value):
    raw = json.dumps(value, ensure_ascii=False).replace("'", "''")
    return f"'{raw}'::jsonb"


def ensure_sync_log_table():
    sql = '''
    create table if not exists mirror_sync_runs (
      id bigserial primary key,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      status text not null,
      summary jsonb,
      details jsonb
    );
    create index if not exists idx_mirror_sync_runs_started_at on mirror_sync_runs(started_at desc);
    '''
    psql(sql)


def list_supabase_tables_from_spec(spec):
    tables = []
    for p in sorted(spec.get('paths', {}).keys()):
        if p == '/':
            continue
        name = p.strip('/').split('/')[0]
        if name and not name.startswith('rpc') and name not in tables:
            tables.append(name)
    return tables


def get_local_ids(table):
    key_col = 'key' if table == 'mirror_app_settings' else 'id'
    sql = f"select {key_col}::text from {table};"
    out = psql_capture(sql)
    return {line.strip() for line in out.splitlines() if line.strip()}


def upsert_rows(mirror_table, rows):
    inserted = 0
    updated = 0
    local_ids_before = get_local_ids(mirror_table)
    seen_ids = set()
    for row in rows:
        rid = row.get('id')
        if rid is None and mirror_table == 'mirror_app_settings':
            rid = row.get('key')
        if rid is None:
            continue
        seen_ids.add(str(rid))
        raw_json = json_sql(row)
        if mirror_table == 'mirror_app_settings':
            sql = f"""
            insert into {mirror_table}(key, value, updated_at)
            values ({q(row.get('key'))}, {q(row.get('value'))}, {q(row.get('updated_at'))}::timestamptz)
            on conflict (key) do update set
              value = excluded.value,
              updated_at = excluded.updated_at;
            """
        elif mirror_table == 'mirror_profiles':
            sql = f"""
            insert into {mirror_table}(id, email, role, full_name, updated_at, avatar_url)
            values ({q(row.get('id'))}::uuid, {q(row.get('email'))}, {q(row.get('role'))}, {q(row.get('full_name'))}, {q(row.get('updated_at'))}::timestamptz, {q(row.get('avatar_url'))})
            on conflict (id) do update set
              email = excluded.email,
              role = excluded.role,
              full_name = excluded.full_name,
              updated_at = excluded.updated_at,
              avatar_url = excluded.avatar_url;
            """
        elif mirror_table == 'mirror_request_assignments':
            sql = f"""
            insert into {mirror_table}(id, request_id, team_member_id, role, assigned_at, assigned_by)
            values ({q(row.get('id'))}::uuid, {q(row.get('request_id'))}::uuid, {q(row.get('team_member_id'))}::uuid, {q(row.get('role'))}, {q(row.get('assigned_at'))}::timestamptz, {q(row.get('assigned_by'))}::uuid)
            on conflict (id) do update set
              request_id = excluded.request_id,
              team_member_id = excluded.team_member_id,
              role = excluded.role,
              assigned_at = excluded.assigned_at,
              assigned_by = excluded.assigned_by;
            """
        elif mirror_table == 'mirror_request_messages':
            sql = f"""
            insert into {mirror_table}(id, request_id, sender_id, message, attachments, is_read, created_at)
            values ({q(row.get('id'))}::uuid, {q(row.get('request_id'))}::uuid, {q(row.get('sender_id'))}::uuid, {q(row.get('message'))}, {json_sql(row.get('attachments', []))}, {str(bool(row.get('is_read'))).lower()}, {q(row.get('created_at'))}::timestamptz)
            on conflict (id) do update set
              request_id = excluded.request_id,
              sender_id = excluded.sender_id,
              message = excluded.message,
              attachments = excluded.attachments,
              is_read = excluded.is_read,
              created_at = excluded.created_at;
            """
        elif mirror_table == 'mirror_task_messages':
            sql = f"""
            insert into {mirror_table}(id, task_id, sender_id, message, attachments, is_read, created_at)
            values ({q(row.get('id'))}::uuid, {q(row.get('task_id'))}::uuid, {q(row.get('sender_id'))}::uuid, {q(row.get('message'))}, {json_sql(row.get('attachments', []))}, {str(bool(row.get('is_read'))).lower()}, {q(row.get('created_at'))}::timestamptz)
            on conflict (id) do update set
              task_id = excluded.task_id,
              sender_id = excluded.sender_id,
              message = excluded.message,
              attachments = excluded.attachments,
              is_read = excluded.is_read,
              created_at = excluded.created_at;
            """
        elif mirror_table == 'mirror_team_members':
            sql = f"""
            insert into {mirror_table}(id, profile_id, name, email, department, position, status, created_at, last_login, accessible_sections)
            values ({q(row.get('id'))}::uuid, {q(row.get('profile_id'))}::uuid, {q(row.get('name'))}, {q(row.get('email'))}, {q(row.get('department'))}, {q(row.get('position'))}, {q(row.get('status'))}, {q(row.get('created_at'))}::timestamptz, {q(row.get('last_login'))}::timestamptz, {json_sql(row.get('accessible_sections', []))})
            on conflict (id) do update set
              profile_id = excluded.profile_id,
              name = excluded.name,
              email = excluded.email,
              department = excluded.department,
              position = excluded.position,
              status = excluded.status,
              created_at = excluded.created_at,
              last_login = excluded.last_login,
              accessible_sections = excluded.accessible_sections;
            """
        else:
            # legacy raw-json mirrors
            sql = f"insert into {mirror_table}(id, raw, synced_at) values ({q(rid)}::uuid, {raw_json}, now()) on conflict (id) do update set raw = excluded.raw, synced_at = now();"
        psql(sql)
        if str(rid) in local_ids_before:
            updated += 1
        else:
            inserted += 1

    deleted = 0
    local_ids_after_source = local_ids_before - seen_ids
    if local_ids_after_source:
        if mirror_table == 'mirror_app_settings':
            keys = ','.join(q(x) for x in local_ids_after_source)
            psql(f"delete from {mirror_table} where key in ({keys});")
        else:
            ids = ','.join(q(x) + '::uuid' for x in local_ids_after_source)
            psql(f"delete from {mirror_table} where id in ({ids});")
        deleted = len(local_ids_after_source)
    return {'rows': len(rows), 'inserted': inserted, 'updated': updated, 'deleted': deleted}


def main():
    load_env()
    required = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','AV_BOT_PGHOST','AV_BOT_PGPORT','AV_BOT_PGDATABASE','AV_BOT_PGUSER','AV_BOT_PGPASSWORD']
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise SystemExit('Missing env: ' + ', '.join(missing))

    ensure_sync_log_table()
    started_at = datetime.now(timezone.utc).isoformat()
    spec = fetch_openapi_spec()
    supabase_tables = list_supabase_tables_from_spec(spec)

    mapping = {
        'app_settings': 'mirror_app_settings',
        'clients': 'mirror_clients',
        'profiles': 'mirror_profiles',
        'request_assignments': 'mirror_request_assignments',
        'request_messages': 'mirror_request_messages',
        'requests': 'mirror_requests',
        'task_messages': 'mirror_task_messages',
        'task_request_links': 'mirror_task_request_links',
        'tasks': 'mirror_tasks',
        'team_members': 'mirror_team_members',
    }
    sync_order = [
        'app_settings', 'profiles', 'clients', 'team_members', 'requests',
        'tasks', 'task_request_links', 'request_assignments', 'request_messages', 'task_messages'
    ]

    summary = {}
    errors = {}
    status = 'success'
    for src in sync_order:
        if src not in supabase_tables:
            errors[src] = 'table not exposed in current Supabase OpenAPI spec'
            status = 'partial_failure'
            continue
        try:
            rows = fetch_table(src)
            summary[src] = upsert_rows(mapping[src], rows)
        except Exception as e:
            errors[src] = str(e)
            status = 'partial_failure'

    finished_at = datetime.now(timezone.utc).isoformat()
    details = {
        'started_at': started_at,
        'finished_at': finished_at,
        'sync_order': sync_order,
        'errors': errors,
    }
    summary_payload = {
        'status': status,
        'tables': summary,
        'table_count': len(summary),
        'error_count': len(errors),
    }
    psql(
        f"insert into mirror_sync_runs(started_at, finished_at, status, summary, details) values ({q(started_at)}::timestamptz, {q(finished_at)}::timestamptz, {q(status)}, {json_sql(summary_payload)}, {json_sql(details)});"
    )
    print(json.dumps(summary_payload, indent=2))


if __name__ == '__main__':
    main()
