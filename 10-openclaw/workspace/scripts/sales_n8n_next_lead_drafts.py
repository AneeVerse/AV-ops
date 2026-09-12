#!/usr/bin/env python3
"""Create deterministic outreach drafts for the next N sales leads.

Designed to be called by n8n so routine draft creation does not consume AI credits.
"""
import argparse
import json
import os
import subprocess
from pathlib import Path

ENV_PATH = Path('/root/.env')
ENV_KEYS = ['AV_BOT_PGHOST', 'AV_BOT_PGPORT', 'AV_BOT_PGDATABASE', 'AV_BOT_PGUSER', 'AV_BOT_PGPASSWORD']


def load_env_file(path=ENV_PATH):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k, v)


def db_cmd(sql: str):
    load_env_file()
    missing = [k for k in ENV_KEYS if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing env keys: {', '.join(missing)}")
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    return [
        'psql', '-h', env['AV_BOT_PGHOST'], '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'], '-d', env['AV_BOT_PGDATABASE'], '-At', '-c', sql,
    ], env


def run_fetch(sql: str):
    cmd, env = db_cmd(sql)
    return subprocess.check_output(cmd, env=env, text=True).strip()


def q(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

SKIP_STATUSES = ("closed won", "closed lost", "lost", "won")


def fetch_json_rows(sql: str):
    out = run_fetch(sql)
    if not out:
        return []
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def first_template():
    rows = fetch_json_rows("""
      SELECT row_to_json(t) FROM (
        SELECT id, name, type, niche, subject, body
        FROM sales_templates
        WHERE COALESCE(status, 'active') = 'active'
        ORDER BY CASE WHEN type = 'cold_email' THEN 0 ELSE 1 END, id
        LIMIT 1
      ) t;
    """)
    return rows[0] if rows else None


def next_leads(limit: int):
    skip = ", ".join(q(s) for s in SKIP_STATUSES)
    return fetch_json_rows(f"""
      SELECT row_to_json(t) FROM (
        SELECT id, company_name, contact_person, email, niche, status, owner, source, next_action, created_at
        FROM sales_leads l
        WHERE COALESCE(NULLIF(TRIM(email), ''), '') <> ''
          AND lower(COALESCE(status, 'new')) NOT IN ({skip})
          AND NOT EXISTS (
            SELECT 1 FROM sales_activity_logs a
            WHERE a.lead_id = l.id
              AND a.activity_type = 'draft_created'
          )
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT {int(limit)}
      ) t;
    """)


def render_subject(template, lead):
    company = lead.get('company_name') or 'your business'
    subject = (template or {}).get('subject') or f"Quick idea for {company}"
    return subject.replace('your clinic', company).replace('your business', company)


def render_body(template, lead, owner):
    body = (template or {}).get('body')
    contact = lead.get('contact_person') or 'there'
    company = lead.get('company_name') or 'your business'
    niche = lead.get('niche') or 'business'
    owner = owner or lead.get('owner') or 'Ane'
    if body:
        body = body.replace('Hi,', f'Hi {contact},', 1)
        body = body.replace('your clinic', company).replace('your business', company)
        body = body.replace('{{company_name}}', company).replace('{{contact_person}}', contact).replace('{{niche}}', niche).replace('{{owner}}', owner)
        if owner not in body[-80:]:
            body = body.rstrip() + f"\n\nBest,\n{owner}"
        return body
    return (
        f"Hi {contact},\n\n"
        f"I noticed {company} and wanted to share a quick growth idea for your {niche.lower()} work. "
        "We help businesses improve lead flow and follow-up execution without adding operational noise.\n\n"
        "If useful, I can send a short breakdown.\n\n"
        f"Best,\n{owner}"
    )


def create_draft(lead, template, owner, dry_run=False):
    subject = render_subject(template, lead)
    body = render_body(template, lead, owner)
    if dry_run:
        return {
            'lead_id': lead['id'],
            'company_name': lead.get('company_name'),
            'contact_person': lead.get('contact_person'),
            'email': lead.get('email'),
            'subject': subject,
            'body_preview': body[:160],
            'dry_run': True,
        }
    out = run_fetch(f"""
      INSERT INTO sales_activity_logs (
        lead_id, activity_type, channel, subject, content, outcome, owner
      ) VALUES (
        {int(lead['id'])}, 'draft_created', 'email', {q(subject)}, {q(body)}, 'draft_only', {q(owner or lead.get('owner') or 'Ane')}
      ) RETURNING id;
    """)
    return {
        'activity_log_id': int(out.splitlines()[0].strip()),
        'lead_id': lead['id'],
        'company_name': lead.get('company_name'),
        'contact_person': lead.get('contact_person'),
        'email': lead.get('email'),
        'subject': subject,
        'outcome': 'draft_only',
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=2)
    parser.add_argument('--owner', default='Ane')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    limit = max(1, min(args.limit, 25))
    template = first_template()
    leads = next_leads(limit)
    drafts = [create_draft(lead, template, args.owner, dry_run=args.dry_run) for lead in leads]
    print(json.dumps({
        'ok': True,
        'mode': 'deterministic_n8n_no_ai',
        'ai_calls_used': 0,
        'requested_limit': limit,
        'created_count': len(drafts),
        'template_id': template.get('id') if template else None,
        'template_name': template.get('name') if template else None,
        'drafts': drafts,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
