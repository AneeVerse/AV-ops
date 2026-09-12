#!/usr/bin/env python3
import json
import os
import subprocess
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path('/root/.openclaw/workspace')
ENV_PATH = Path('/root/.env')
ENV_KEYS = [
    'AV_BOT_PGHOST',
    'AV_BOT_PGPORT',
    'AV_BOT_PGDATABASE',
    'AV_BOT_PGUSER',
    'AV_BOT_PGPASSWORD',
]


app = FastAPI(title='Sales API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class LeadCreate(BaseModel):
    company_name: str
    website: Optional[str] = None
    niche: Optional[str] = None
    contact_person: Optional[str] = None
    contact_role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    source: Optional[str] = None
    source_details: Optional[str] = None
    pain_point: Optional[str] = None
    opportunity_note: Optional[str] = None
    offer_interest: Optional[str] = None
    status: Optional[str] = 'new'
    priority: Optional[str] = 'medium'
    owner: Optional[str] = None
    next_action: Optional[str] = None
    next_action_due_at: Optional[str] = None


class LeadStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None
    actor: Optional[str] = None
    next_action: Optional[str] = None
    next_action_due_at: Optional[str] = None


class FollowupCreate(BaseModel):
    lead_id: int
    title: str
    detail: Optional[str] = None
    channel: Optional[str] = None
    due_at: Optional[str] = None
    status: Optional[str] = 'pending'
    owner: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    type: str
    niche: Optional[str] = None
    subject: Optional[str] = None
    body: str
    call_script: Optional[str] = None
    status: Optional[str] = 'active'
    owner: Optional[str] = None


class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    niche: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    owner: Optional[str] = None
    next_action: Optional[str] = None
    status: Optional[str] = None


class FollowupUpdate(BaseModel):
    title: Optional[str] = None
    detail: Optional[str] = None
    channel: Optional[str] = None
    due_at: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    niche: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    call_script: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None


class BulkLeadUpdate(BaseModel):
    lead_ids: list[int]
    status: Optional[str] = None
    owner: Optional[str] = None
    next_action: Optional[str] = None


class BulkLeadImport(BaseModel):
    rows: list[dict]


class OutreachDraftCreate(BaseModel):
    lead_id: int
    template_id: Optional[int] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    channel: Optional[str] = 'email'
    owner: Optional[str] = None


class CallLogCreate(BaseModel):
    lead_id: int
    subject: Optional[str] = None
    content: Optional[str] = None
    outcome: Optional[str] = None
    owner: Optional[str] = None


class WhatsAppLogCreate(BaseModel):
    lead_id: int
    subject: Optional[str] = None
    content: Optional[str] = None
    outcome: Optional[str] = None
    owner: Optional[str] = None


class ReplyLogCreate(BaseModel):
    lead_id: int
    subject: Optional[str] = None
    content: Optional[str] = None
    outcome: Optional[str] = None
    owner: Optional[str] = None


class MeetingBookedCreate(BaseModel):
    lead_id: int
    subject: Optional[str] = None
    content: Optional[str] = None
    outcome: Optional[str] = None
    owner: Optional[str] = None


class DealOutcomeCreate(BaseModel):
    lead_id: int
    subject: Optional[str] = None
    content: Optional[str] = None
    outcome: Optional[str] = None
    owner: Optional[str] = None
    lost_reason: Optional[str] = None


class SourceNormalizeCreate(BaseModel):
    from_source: str
    to_source: str


class LeadCleanupUpdate(BaseModel):
    source: Optional[str] = None
    owner: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class DraftApprovalUpdate(BaseModel):
    outcome: str
    owner: Optional[str] = None


def load_env_file(path=ENV_PATH):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k, v)


def ensure_env():
    load_env_file()
    missing = [k for k in ENV_KEYS if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing env keys: {', '.join(missing)}")


def db_cmd(sql: str):
    ensure_env()
    env = os.environ.copy()
    env['PGPASSWORD'] = env['AV_BOT_PGPASSWORD']
    return [
        'psql',
        '-h', env['AV_BOT_PGHOST'],
        '-p', env['AV_BOT_PGPORT'],
        '-U', env['AV_BOT_PGUSER'],
        '-d', env['AV_BOT_PGDATABASE'],
        '-At',
        '-c', sql,
    ], env


def create_followup_if_missing(lead_id: int, title: str, detail: str, due_expr: str, owner: Optional[str] = None):
    sql = f"""
    INSERT INTO sales_followups (lead_id, title, detail, due_at, status, owner)
    SELECT {lead_id}, {q(title)}, {q(detail)}, {due_expr}, 'pending', {q(owner)}
    WHERE NOT EXISTS (
      SELECT 1 FROM sales_followups
      WHERE lead_id = {lead_id}
        AND status = 'pending'
        AND title = {q(title)}
    );
    """
    run_fetch(sql)


def complete_pending_followups(lead_id: int, note: str):
    sql = f"""
    UPDATE sales_followups
    SET status = 'completed',
        outcome = COALESCE(outcome, {q(note)}),
        completed_at = now()
    WHERE lead_id = {lead_id}
      AND status = 'pending';
    """
    run_fetch(sql)




def run_fetch(sql: str):
    cmd, env = db_cmd(sql)
    out = subprocess.check_output(cmd, env=env, text=True)
    return out.strip()


def q(value: Optional[str]):
    if value is None:
        return 'NULL'
    return "'" + value.replace("'", "''") + "'"


@app.get('/health')
def health():
    return {'ok': True, 'service': 'sales-api'}


@app.get('/sales/leads')
def list_leads(limit: int = 100, q_text: Optional[str] = None, status: Optional[str] = None):
    limit = max(1, min(limit, 500))
    conditions = []
    if q_text:
        conditions.append(f"(company_name ILIKE '%' || {q(q_text)} || '%' OR COALESCE(contact_person,'') ILIKE '%' || {q(q_text)} || '%' OR COALESCE(email,'') ILIKE '%' || {q(q_text)} || '%')")
    if status:
        conditions.append(f"status = {q(status)}")
    where_sql = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
    sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT id, company_name, website, niche, contact_person, contact_role, email, phone,
               city, country, source, status, priority, owner, next_action, next_action_due_at,
               last_contacted_at, last_replied_at, meeting_booked_at, closed_at, lost_reason,
               created_at, updated_at
        FROM sales_leads
        {where_sql}
        ORDER BY id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return {'ok': True, 'items': rows}


@app.get('/sales/leads/summary')
def leads_summary():
    sql = """
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT status, count(*) AS count
        FROM sales_leads
        GROUP BY status
        ORDER BY status
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return {'ok': True, 'items': rows}


@app.get('/sales/leads/{lead_id}')
def get_lead_detail(lead_id: int):
    lead_sql = f"""
    SELECT row_to_json(t)
    FROM (
      SELECT *
      FROM sales_leads
      WHERE id = {lead_id}
    ) t;
    """
    followups_sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT id, title, detail, due_at, status, owner, created_at
        FROM sales_followups
        WHERE lead_id = {lead_id}
        ORDER BY id DESC
        LIMIT 50
      ) t
    ) TO STDOUT;
    """
    activity_sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT id, activity_type, channel, subject, content, outcome, owner, created_at
        FROM sales_activity_logs
        WHERE lead_id = {lead_id}
        ORDER BY id DESC
        LIMIT 100
      ) t
    ) TO STDOUT;
    """
    summary_sql = f"""
    SELECT row_to_json(t)
    FROM (
      SELECT
        (SELECT count(*) FROM sales_followups WHERE lead_id = {lead_id}) AS total_followups,
        (SELECT count(*) FROM sales_followups WHERE lead_id = {lead_id} AND status = 'pending') AS pending_followups,
        (SELECT count(*) FROM sales_followups WHERE lead_id = {lead_id} AND detail ILIKE '%Auto-generated%') AS auto_generated_followups,
        (SELECT count(*) FROM sales_activity_logs WHERE lead_id = {lead_id}) AS total_activities,
        (SELECT count(*) FROM sales_activity_logs WHERE lead_id = {lead_id} AND activity_type = 'email_sent') AS sent_emails,
        (SELECT count(*) FROM sales_activity_logs WHERE lead_id = {lead_id} AND activity_type = 'call_logged') AS calls_logged,
        (SELECT count(*) FROM sales_activity_logs WHERE lead_id = {lead_id} AND activity_type = 'whatsapp_logged') AS whatsapp_logs,
        (SELECT count(*) FROM sales_activity_logs WHERE lead_id = {lead_id} AND activity_type = 'draft_created' AND COALESCE(outcome, 'draft_only') = 'approved_to_send') AS ready_to_send_drafts
    ) t;
    """
    try:
        lead_out = run_fetch(lead_sql)
        if not lead_out:
            raise HTTPException(status_code=404, detail='Lead not found')
        lead = json.loads(lead_out.splitlines()[0])
        followups_out = run_fetch(followups_sql)
        activity_out = run_fetch(activity_sql)
        summary_out = run_fetch(summary_sql)
        followups = [json.loads(line) for line in followups_out.splitlines() if line.strip()]
        activity = [json.loads(line) for line in activity_out.splitlines() if line.strip()]
        summary = json.loads(summary_out.splitlines()[0]) if summary_out else {}
        return {'ok': True, 'lead': lead, 'summary': summary, 'followups': followups, 'activity': activity}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/leads')
def create_lead(lead: LeadCreate):
    sql = f"""
    INSERT INTO sales_leads (
      company_name, website, niche, contact_person, contact_role, email, phone,
      city, country, source, source_details, pain_point, opportunity_note,
      offer_interest, status, priority, owner, next_action, next_action_due_at
    ) VALUES (
      {q(lead.company_name)}, {q(lead.website)}, {q(lead.niche)}, {q(lead.contact_person)},
      {q(lead.contact_role)}, {q(lead.email)}, {q(lead.phone)}, {q(lead.city)},
      {q(lead.country)}, {q(lead.source)}, {q(lead.source_details)}, {q(lead.pain_point)},
      {q(lead.opportunity_note)}, {q(lead.offer_interest)}, {q(lead.status or 'new')},
      {q(lead.priority or 'medium')}, {q(lead.owner)}, {q(lead.next_action)}, {q(lead.next_action_due_at)}
    )
    RETURNING id;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    lead_id = int(out.splitlines()[0].strip())
    return {'ok': True, 'id': lead_id}


@app.get('/sales/pipeline')
def list_pipeline(limit: int = 100):
    limit = max(1, min(limit, 500))
    sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT id, company_name, niche, contact_person, status, priority, owner,
               next_action, next_action_due_at, last_contacted_at, meeting_booked_at,
               created_at, updated_at
        FROM sales_leads
        ORDER BY id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return {'ok': True, 'items': rows}


@app.get('/sales/followups')
def list_followups(limit: int = 100, q_text: Optional[str] = None, status: Optional[str] = None):
    limit = max(1, min(limit, 500))
    conditions = []
    if q_text:
        conditions.append(f"(COALESCE(f.title,'') ILIKE '%' || {q(q_text)} || '%' OR COALESCE(l.company_name,'') ILIKE '%' || {q(q_text)} || '%')")
    if status:
        conditions.append(f"f.status = {q(status)}")
    where_sql = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
    sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT f.id, f.title, f.detail, f.channel, f.due_at, f.status, f.outcome, f.owner,
               f.completed_at, f.created_at, f.updated_at,
               l.id AS lead_id, l.company_name, l.status AS lead_status
        FROM sales_followups f
        LEFT JOIN sales_leads l ON l.id = f.lead_id
        {where_sql}
        ORDER BY f.due_at NULLS LAST, f.id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return {'ok': True, 'items': rows}


@app.get('/sales/followups/summary')
def followups_summary():
    sql = """
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT status, count(*) AS count
        FROM sales_followups
        GROUP BY status
        ORDER BY status
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return {'ok': True, 'items': rows}


@app.post('/sales/followups')
def create_followup(followup: FollowupCreate):
    sql = f"""
    INSERT INTO sales_followups (
      lead_id, title, detail, channel, due_at, status, owner
    ) VALUES (
      {followup.lead_id}, {q(followup.title)}, {q(followup.detail)}, {q(followup.channel)},
      {q(followup.due_at)}, {q(followup.status or 'pending')}, {q(followup.owner)}
    )
    RETURNING id;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    followup_id = int(out.splitlines()[0].strip())
    return {'ok': True, 'id': followup_id}


@app.post('/sales/leads/{lead_id}/status')
def update_lead_status(lead_id: int, payload: LeadStatusUpdate):
    get_sql = f"SELECT status FROM sales_leads WHERE id = {lead_id};"
    try:
        current_status = run_fetch(get_sql).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if not current_status:
        raise HTTPException(status_code=404, detail='Lead not found')

    update_sql = f"""
    UPDATE sales_leads
    SET status = {q(payload.status)},
        next_action = COALESCE({q(payload.next_action)}, next_action),
        next_action_due_at = COALESCE({q(payload.next_action_due_at)}, next_action_due_at)
    WHERE id = {lead_id};
    INSERT INTO sales_pipeline_events (
      lead_id, from_status, to_status, event_type, note, actor
    ) VALUES (
      {lead_id}, {q(current_status)}, {q(payload.status)}, 'stage_change', {q(payload.note)}, {q(payload.actor)}
    );
    """
    try:
        run_fetch(update_sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'lead_id': lead_id, 'from_status': current_status, 'to_status': payload.status}


@app.get('/sales/templates')
def list_templates(limit: int = 100, type: Optional[str] = None, niche: Optional[str] = None):
    limit = max(1, min(limit, 500))
    conditions = []
    if type:
        conditions.append(f"type = {q(type)}")
    if niche:
        conditions.append(f"(niche = {q(niche)} OR niche IS NULL OR niche = '')")
    where_sql = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
    sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT id, name, type, niche, subject, body, call_script, status, owner, created_at, updated_at
        FROM sales_templates
        {where_sql}
        ORDER BY id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return {'ok': True, 'items': rows}


@app.post('/sales/templates')
def create_template(template: TemplateCreate):
    sql = f"""
    INSERT INTO sales_templates (
      name, type, niche, subject, body, call_script, status, owner
    ) VALUES (
      {q(template.name)}, {q(template.type)}, {q(template.niche)}, {q(template.subject)},
      {q(template.body)}, {q(template.call_script)}, {q(template.status or 'active')}, {q(template.owner)}
    )
    RETURNING id;
    """
    try:
        out = run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    template_id = int(out.splitlines()[0].strip())
    return {'ok': True, 'id': template_id}


@app.get('/sales/reports/overview')
def reports_overview():
    queries = {
        'lead_status_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT status, count(*) AS count
                FROM sales_leads
                GROUP BY status
                ORDER BY status
              ) t
            ) TO STDOUT;
        """,
        'followup_status_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT status, count(*) AS count
                FROM sales_followups
                GROUP BY status
                ORDER BY status
              ) t
            ) TO STDOUT;
        """,
        'template_type_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT type, count(*) AS count
                FROM sales_templates
                GROUP BY type
                ORDER BY type
              ) t
            ) TO STDOUT;
        """,
        'activity_type_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT activity_type, count(*) AS count
                FROM sales_activity_logs
                GROUP BY activity_type
                ORDER BY count(*) DESC, activity_type ASC
              ) t
            ) TO STDOUT;
        """,
        'channel_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT channel, count(*) AS count
                FROM sales_activity_logs
                GROUP BY channel
                ORDER BY count(*) DESC, channel ASC
              ) t
            ) TO STDOUT;
        """,
        'source_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT COALESCE(source, 'unknown') AS source, count(*) AS count
                FROM sales_leads
                GROUP BY COALESCE(source, 'unknown')
                ORDER BY count(*) DESC, COALESCE(source, 'unknown') ASC
              ) t
            ) TO STDOUT;
        """,
        'source_outcomes': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT COALESCE(source, 'unknown') AS source,
                       count(*) AS total_leads,
                       count(*) FILTER (WHERE status = 'meeting booked') AS meetings,
                       count(*) FILTER (WHERE status = 'closed won') AS won,
                       count(*) FILTER (WHERE status = 'closed lost') AS lost
                FROM sales_leads
                GROUP BY COALESCE(source, 'unknown')
                ORDER BY count(*) DESC, COALESCE(source, 'unknown') ASC
              ) t
            ) TO STDOUT;
        """,
        'owner_counts': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT COALESCE(owner, 'unassigned') AS owner, count(*) AS count
                FROM sales_leads
                GROUP BY COALESCE(owner, 'unassigned')
                ORDER BY count(*) DESC, COALESCE(owner, 'unassigned') ASC
              ) t
            ) TO STDOUT;
        """,
        'lead_scores': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT id, company_name, COALESCE(owner, 'unassigned') AS owner, COALESCE(source, 'unknown') AS source, status,
                       (
                         CASE status
                           WHEN 'closed won' THEN 100
                           WHEN 'meeting booked' THEN 85
                           WHEN 'interested' THEN 70
                           WHEN 'follow-up' THEN 55
                           WHEN 'new' THEN 40
                           WHEN 'closed lost' THEN 5
                           ELSE 25
                         END
                         + CASE WHEN email IS NOT NULL AND TRIM(email) <> '' THEN 10 ELSE 0 END
                         + CASE WHEN phone IS NOT NULL AND TRIM(phone) <> '' THEN 10 ELSE 0 END
                         + CASE WHEN next_action IS NOT NULL AND TRIM(next_action) <> '' THEN 5 ELSE 0 END
                         + CASE WHEN owner IS NOT NULL AND TRIM(owner) <> '' THEN 5 ELSE 0 END
                         - CASE WHEN source IS NULL OR TRIM(source) = '' OR LOWER(TRIM(source)) = 'unknown' THEN 10 ELSE 0 END
                       ) AS score,
                       CONCAT_WS(', ',
                         CASE WHEN email IS NOT NULL AND TRIM(email) <> '' THEN 'has_email' END,
                         CASE WHEN phone IS NOT NULL AND TRIM(phone) <> '' THEN 'has_phone' END,
                         CASE WHEN next_action IS NOT NULL AND TRIM(next_action) <> '' THEN 'has_next_action' END,
                         CASE WHEN owner IS NOT NULL AND TRIM(owner) <> '' THEN 'owned' END,
                         CASE WHEN source IS NULL OR TRIM(source) = '' OR LOWER(TRIM(source)) = 'unknown' THEN 'weak_source' END
                       ) AS score_factors
                FROM sales_leads
                ORDER BY score DESC, id DESC
                LIMIT 20
              ) t
            ) TO STDOUT;
        """,
        'summary': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT
                  (SELECT count(*) FROM sales_leads) AS total_leads,
                  (SELECT count(*) FROM sales_followups) AS total_followups,
                  (SELECT count(*) FROM sales_templates) AS total_templates,
                  (SELECT count(*) FROM sales_leads WHERE status = 'interested') AS interested_leads,
                  (SELECT count(*) FROM sales_leads WHERE status = 'meeting booked') AS booked_meetings,
                  (SELECT count(*) FROM sales_leads WHERE status = 'closed won') AS closed_won,
                  (SELECT count(*) FROM sales_leads WHERE status = 'closed lost') AS closed_lost,
                  (SELECT count(*) FROM sales_followups WHERE status = 'pending') AS pending_followups,
                  (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'draft_created') AS total_drafts,
                  (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'email_sent') AS total_sent_emails,
                  (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'reply_logged') AS total_replies,
                  (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'meeting_booked') AS total_meetings_logged,
                  (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'call_logged') AS total_calls,
                  (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'whatsapp_logged') AS total_whatsapp_logs,
                  ROUND(CASE WHEN (SELECT count(*) FROM sales_leads) = 0 THEN 0 ELSE ((SELECT count(*) FROM sales_leads WHERE status = 'interested')::numeric / (SELECT count(*) FROM sales_leads)::numeric) * 100 END, 2) AS interested_rate,
                  ROUND(CASE WHEN (SELECT count(*) FROM sales_leads) = 0 THEN 0 ELSE ((SELECT count(*) FROM sales_leads WHERE status = 'meeting booked')::numeric / (SELECT count(*) FROM sales_leads)::numeric) * 100 END, 2) AS meeting_rate,
                  ROUND(CASE WHEN (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'draft_created') = 0 THEN 0 ELSE ((SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'email_sent')::numeric / (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'draft_created')::numeric) * 100 END, 2) AS draft_to_sent_rate,
                  ROUND(CASE WHEN (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'email_sent') = 0 THEN 0 ELSE ((SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'reply_logged')::numeric / (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'email_sent')::numeric) * 100 END, 2) AS sent_to_reply_rate,
                  ROUND(CASE WHEN (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'reply_logged') = 0 THEN 0 ELSE ((SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'meeting_booked')::numeric / (SELECT count(*) FROM sales_activity_logs WHERE activity_type = 'reply_logged')::numeric) * 100 END, 2) AS reply_to_meeting_rate
              ) t
            ) TO STDOUT;
        """
    }
    try:
        result = {}
        for key, sql in queries.items():
            out = run_fetch(sql)
            rows = [json.loads(line) for line in out.splitlines() if line.strip()]
            result[key] = rows[0] if key == 'summary' and rows else rows
        return {'ok': True, 'report': result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/reports/trends')
def reports_trends(days: int = 7):
    days = max(1, min(days, 90))
    sql = f"""
    COPY (
      WITH dates AS (
        SELECT generate_series(current_date - interval '{days - 1} day', current_date, interval '1 day')::date AS day
      )
      SELECT row_to_json(t)
      FROM (
        SELECT d.day,
               COALESCE((SELECT count(*) FROM sales_activity_logs a WHERE a.activity_type = 'email_sent' AND a.created_at::date = d.day), 0) AS sent_emails,
               COALESCE((SELECT count(*) FROM sales_activity_logs a WHERE a.activity_type = 'reply_logged' AND a.created_at::date = d.day), 0) AS replies,
               COALESCE((SELECT count(*) FROM sales_activity_logs a WHERE a.activity_type = 'meeting_booked' AND a.created_at::date = d.day), 0) AS meetings,
               COALESCE((SELECT count(*) FROM sales_activity_logs a WHERE a.activity_type = 'deal_won' AND a.created_at::date = d.day), 0) AS won,
               COALESCE((SELECT count(*) FROM sales_activity_logs a WHERE a.activity_type = 'deal_lost' AND a.created_at::date = d.day), 0) AS lost
        FROM dates d
        ORDER BY d.day ASC
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
        rows = [json.loads(line) for line in out.splitlines() if line.strip()]
        return {'ok': True, 'items': rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/data-quality')
def sales_data_quality():
    queries = {
        'summary': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT
                  (SELECT count(*) FROM sales_leads WHERE source IS NULL OR TRIM(source) = '' OR LOWER(TRIM(source)) = 'unknown') AS weak_source_count,
                  (SELECT count(*) FROM sales_leads WHERE owner IS NULL OR TRIM(owner) = '') AS unassigned_owner_count,
                  (SELECT count(*) FROM sales_leads WHERE phone IS NULL OR TRIM(phone) = '') AS missing_phone_count,
                  (SELECT count(*) FROM sales_leads WHERE email IS NULL OR TRIM(email) = '') AS missing_email_count
              ) t
            ) TO STDOUT;
        """,
        'weak_leads': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT id, company_name, COALESCE(source, 'unknown') AS source,
                       COALESCE(owner, 'unassigned') AS owner,
                       email, phone, status
                FROM sales_leads
                WHERE source IS NULL OR TRIM(source) = '' OR LOWER(TRIM(source)) = 'unknown'
                   OR owner IS NULL OR TRIM(owner) = ''
                   OR phone IS NULL OR TRIM(phone) = ''
                   OR email IS NULL OR TRIM(email) = ''
                ORDER BY id DESC
                LIMIT 100
              ) t
            ) TO STDOUT;
        """
    }
    try:
        result = {}
        for key, sql in queries.items():
            out = run_fetch(sql)
            rows = [json.loads(line) for line in out.splitlines() if line.strip()]
            result[key] = rows[0] if key == 'summary' and rows else rows
        return {'ok': True, 'report': result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/source-normalize')
def normalize_sources(payload: SourceNormalizeCreate):
    try:
        sql = f"""
        UPDATE sales_leads
        SET source = {q(payload.to_source)}
        WHERE COALESCE(source, 'unknown') = {q(payload.from_source)};
        """
        run_fetch(sql)
        return {'ok': True, 'from_source': payload.from_source, 'to_source': payload.to_source}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/leads/{lead_id}/cleanup')
def cleanup_lead(lead_id: int, payload: LeadCleanupUpdate):
    sets = []
    for field in ['source', 'owner', 'phone', 'email']:
        value = getattr(payload, field)
        if value is not None:
            sets.append(f"{field} = {q(value)}")
    if not sets:
        raise HTTPException(status_code=400, detail='No cleanup fields provided')
    sql = f"UPDATE sales_leads SET {', '.join(sets)} WHERE id = {lead_id};"
    try:
        run_fetch(sql)
        return {'ok': True, 'id': lead_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/reminders/overview')
def reminders_overview():
    queries = {
        'due_today': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT f.id, f.title, f.detail, f.due_at, f.status, f.owner, l.company_name,
                       CASE
                         WHEN f.due_at IS NULL THEN 'no_due_date'
                         WHEN f.due_at < now() THEN 'overdue'
                         WHEN f.due_at::date = now()::date THEN 'due_today'
                         WHEN f.due_at <= now() + interval '1 day' THEN 'due_soon'
                         ELSE 'scheduled'
                       END AS urgency
                FROM sales_followups f
                LEFT JOIN sales_leads l ON l.id = f.lead_id
                WHERE f.status = 'pending'
                  AND f.due_at IS NOT NULL
                  AND f.due_at::date = now()::date
                ORDER BY f.due_at ASC, f.id DESC
              ) t
            ) TO STDOUT;
        """,
        'overdue': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT f.id, f.title, f.detail, f.due_at, f.status, f.owner, l.company_name,
                       'overdue' AS urgency
                FROM sales_followups f
                LEFT JOIN sales_leads l ON l.id = f.lead_id
                WHERE f.status = 'pending'
                  AND f.due_at IS NOT NULL
                  AND f.due_at < now()
                ORDER BY f.due_at ASC, f.id DESC
              ) t
            ) TO STDOUT;
        """,
        'action_queue': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT f.id, f.title, f.detail, f.due_at, f.status, f.owner, l.company_name,
                       CASE
                         WHEN f.due_at IS NULL THEN 'no_due_date'
                         WHEN f.due_at < now() THEN 'overdue'
                         WHEN f.due_at::date = now()::date THEN 'due_today'
                         WHEN f.due_at <= now() + interval '1 day' THEN 'due_soon'
                         ELSE 'scheduled'
                       END AS urgency
                FROM sales_followups f
                LEFT JOIN sales_leads l ON l.id = f.lead_id
                WHERE f.status = 'pending'
                ORDER BY
                  CASE
                    WHEN f.due_at IS NULL THEN 4
                    WHEN f.due_at < now() THEN 1
                    WHEN f.due_at::date = now()::date THEN 2
                    WHEN f.due_at <= now() + interval '1 day' THEN 3
                    ELSE 5
                  END,
                  f.due_at NULLS LAST,
                  f.id DESC
              ) t
            ) TO STDOUT;
        """,
        'summary': """
            COPY (
              SELECT row_to_json(t)
              FROM (
                SELECT
                  (SELECT count(*) FROM sales_followups WHERE status = 'pending' AND due_at IS NOT NULL AND due_at::date = now()::date) AS due_today_count,
                  (SELECT count(*) FROM sales_followups WHERE status = 'pending' AND due_at IS NOT NULL AND due_at < now()) AS overdue_count,
                  (SELECT count(*) FROM sales_followups WHERE status = 'pending' AND due_at IS NULL) AS unscheduled_pending_count
              ) t
            ) TO STDOUT;
        """
    }
    try:
        result = {}
        for key, sql in queries.items():
            out = run_fetch(sql)
            rows = [json.loads(line) for line in out.splitlines() if line.strip()]
            result[key] = rows[0] if key == 'summary' and rows else rows
        return {'ok': True, 'reminders': result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/reminders/generate')
def generate_reminders():
    sql = """
    COPY (
      WITH candidates AS (
        SELECT l.id AS lead_id,
               l.company_name,
               COALESCE(l.next_action, 'Follow up') AS next_action,
               COALESCE(l.next_action_due_at, now() + interval '1 day') AS generated_due_at,
               l.owner
        FROM sales_leads l
        WHERE l.next_action IS NOT NULL
          AND TRIM(l.next_action) <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM sales_followups f
            WHERE f.lead_id = l.id
              AND f.status = 'pending'
              AND f.title = l.next_action
          )
      ), inserted AS (
        INSERT INTO sales_followups (lead_id, title, detail, due_at, status, owner)
        SELECT lead_id,
               next_action,
               'Auto-generated from lead next_action',
               generated_due_at,
               'pending',
               owner
        FROM candidates
        RETURNING id, lead_id, title, due_at, owner
      )
      SELECT row_to_json(inserted)
      FROM inserted
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
        rows = [json.loads(line) for line in out.splitlines() if line.strip()]
        return {'ok': True, 'created_count': len(rows), 'items': rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/reminders/backfill-due-dates')
def backfill_reminder_due_dates():
    sql = """
    COPY (
      WITH updated AS (
        UPDATE sales_followups f
        SET due_at = now() + interval '1 day'
        WHERE f.status = 'pending'
          AND f.due_at IS NULL
        RETURNING f.id, f.title, f.due_at, f.owner
      )
      SELECT row_to_json(updated)
      FROM updated
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
        rows = [json.loads(line) for line in out.splitlines() if line.strip()]
        return {'ok': True, 'updated_count': len(rows), 'items': rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/leads/{lead_id}/edit')
def edit_lead(lead_id: int, payload: LeadUpdate):
    sets = []
    for field in ['company_name','niche','contact_person','email','phone','owner','next_action','status']:
        value = getattr(payload, field)
        if value is not None:
            sets.append(f"{field} = {q(value)}")
    if not sets:
        raise HTTPException(status_code=400, detail='No fields to update')
    sql = f"UPDATE sales_leads SET {', '.join(sets)} WHERE id = {lead_id};"
    try:
        run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'id': lead_id}


@app.post('/sales/followups/{followup_id}/edit')
def edit_followup(followup_id: int, payload: FollowupUpdate):
    sets = []
    for field in ['title','detail','channel','due_at','status','owner']:
        value = getattr(payload, field)
        if value is not None:
            sets.append(f"{field} = {q(value)}")
    if not sets:
        raise HTTPException(status_code=400, detail='No fields to update')
    sql = f"UPDATE sales_followups SET {', '.join(sets)} WHERE id = {followup_id};"
    try:
        run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'id': followup_id}


@app.post('/sales/templates/{template_id}/edit')
def edit_template(template_id: int, payload: TemplateUpdate):
    sets = []
    for field in ['name','type','niche','subject','body','call_script','status','owner']:
        value = getattr(payload, field)
        if value is not None:
            sets.append(f"{field} = {q(value)}")
    if not sets:
        raise HTTPException(status_code=400, detail='No fields to update')
    sql = f"UPDATE sales_templates SET {', '.join(sets)} WHERE id = {template_id};"
    try:
        run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'id': template_id}


@app.post('/sales/leads/{lead_id}/delete')
def delete_lead(lead_id: int):
    try:
        run_fetch(f"DELETE FROM sales_leads WHERE id = {lead_id};")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'id': lead_id}


@app.post('/sales/followups/{followup_id}/delete')
def delete_followup(followup_id: int):
    try:
        run_fetch(f"DELETE FROM sales_followups WHERE id = {followup_id};")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'id': followup_id}


@app.post('/sales/templates/{template_id}/delete')
def delete_template(template_id: int):
    try:
        run_fetch(f"DELETE FROM sales_templates WHERE id = {template_id};")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'id': template_id}


@app.post('/sales/leads/bulk-update')
def bulk_update_leads(payload: BulkLeadUpdate):
    if not payload.lead_ids:
        raise HTTPException(status_code=400, detail='No lead ids provided')
    sets = []
    if payload.status is not None:
        sets.append(f"status = {q(payload.status)}")
    if payload.owner is not None:
        sets.append(f"owner = {q(payload.owner)}")
    if payload.next_action is not None:
        sets.append(f"next_action = {q(payload.next_action)}")
    if not sets:
        raise HTTPException(status_code=400, detail='No update fields provided')
    ids_sql = ','.join(str(int(x)) for x in payload.lead_ids)
    sql = f"UPDATE sales_leads SET {', '.join(sets)} WHERE id IN ({ids_sql});"
    try:
        run_fetch(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'updated_ids': payload.lead_ids}


@app.post('/sales/leads/bulk-import')
def bulk_import_leads(payload: BulkLeadImport):
    created = []
    try:
        for row in payload.rows:
            company_name = row.get('company_name') or row.get('Company Name') or row.get('company')
            if not company_name:
                continue
            sql = f"""
            INSERT INTO sales_leads (
              company_name, website, niche, contact_person, email, phone, source, owner, next_action, status
            ) VALUES (
              {q(company_name)},
              {q(row.get('website'))},
              {q(row.get('niche'))},
              {q(row.get('contact_person'))},
              {q(row.get('email'))},
              {q(row.get('phone'))},
              {q(row.get('source'))},
              {q(row.get('owner'))},
              {q(row.get('next_action'))},
              {q(row.get('status') or 'new')}
            ) RETURNING id;
            """
            out = run_fetch(sql)
            created.append(int(out.splitlines()[0].strip()))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {'ok': True, 'created_count': len(created), 'ids': created}


@app.post('/sales/outreach/draft')
def create_outreach_draft(payload: OutreachDraftCreate):
    try:
        lead_sql = f"SELECT row_to_json(t) FROM (SELECT id, company_name, contact_person, email, niche FROM sales_leads WHERE id = {payload.lead_id}) t;"
        lead_out = run_fetch(lead_sql)
        if not lead_out:
            raise HTTPException(status_code=404, detail='Lead not found')
        lead = json.loads(lead_out.splitlines()[0])

        template = None
        if payload.template_id:
            template_sql = f"SELECT row_to_json(t) FROM (SELECT id, name, subject, body, type FROM sales_templates WHERE id = {payload.template_id}) t;"
            template_out = run_fetch(template_sql)
            if template_out:
                template = json.loads(template_out.splitlines()[0])

        subject = payload.subject or (template.get('subject') if template else None) or f"Quick idea for {lead.get('company_name') or 'your business'}"
        body = payload.body or (template.get('body') if template else None) or f"Hi {lead.get('contact_person') or ''},\n\nI wanted to reach out regarding {lead.get('company_name') or 'your business'}.\n\nBest,\n{payload.owner or 'Ane'}"

        log_sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'draft_created', {q(payload.channel or 'email')}, {q(subject)}, {q(body)}, 'draft_only', {q(payload.owner)}
        ) RETURNING id;
        """
        log_out = run_fetch(log_sql)
        log_id = int(log_out.splitlines()[0].strip())
        return {
            'ok': True,
            'draft': {
                'lead_id': payload.lead_id,
                'company_name': lead.get('company_name'),
                'contact_person': lead.get('contact_person'),
                'email': lead.get('email'),
                'subject': subject,
                'body': body,
                'channel': payload.channel or 'email',
                'activity_log_id': log_id,
                'template_id': payload.template_id,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/calls/log')
def log_call(payload: CallLogCreate):
    try:
        sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'call_logged', 'call', {q(payload.subject)}, {q(payload.content)}, {q(payload.outcome)}, {q(payload.owner)}
        ) RETURNING id;
        """
        out = run_fetch(sql)
        log_id = int(out.splitlines()[0].strip())
        return {'ok': True, 'id': log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/whatsapp/log')
def log_whatsapp(payload: WhatsAppLogCreate):
    try:
        sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'whatsapp_logged', 'whatsapp', {q(payload.subject)}, {q(payload.content)}, {q(payload.outcome)}, {q(payload.owner)}
        ) RETURNING id;
        """
        out = run_fetch(sql)
        log_id = int(out.splitlines()[0].strip())
        return {'ok': True, 'id': log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/whatsapp/open/{lead_id}')
def open_whatsapp_for_lead(lead_id: int, text: Optional[str] = None):
    try:
        sql = f"SELECT row_to_json(t) FROM (SELECT id, company_name, contact_person, phone FROM sales_leads WHERE id = {lead_id}) t;"
        out = run_fetch(sql)
        if not out:
            raise HTTPException(status_code=404, detail='Lead not found')
        lead = json.loads(out.splitlines()[0])
        phone = ''.join(ch for ch in (lead.get('phone') or '') if ch.isdigit())
        if not phone:
            raise HTTPException(status_code=400, detail='Lead has no phone number')
        msg = text or f"Hi {lead.get('contact_person') or ''}, this is Aneeverse regarding {lead.get('company_name') or 'your business'}."
        wa_url = f"https://wa.me/{phone}?text={quote_plus(msg)}"
        return {'ok': True, 'lead_id': lead_id, 'phone': phone, 'url': wa_url, 'message': msg}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/replies/log')
def log_reply(payload: ReplyLogCreate):
    try:
        sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'reply_logged', 'email', {q(payload.subject)}, {q(payload.content)}, {q(payload.outcome)}, {q(payload.owner)}
        ) RETURNING id;
        UPDATE sales_leads SET last_replied_at = now() WHERE id = {payload.lead_id};
        """
        out = run_fetch(sql)
        log_id = int(out.splitlines()[0].strip())
        create_followup_if_missing(payload.lead_id, 'Reply follow-up', 'Respond to lead reply and move toward meeting.', "now() + interval '1 day'", payload.owner)
        return {'ok': True, 'id': log_id, 'automation': 'reply follow-up scheduled'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/meetings/booked')
def log_meeting_booked(payload: MeetingBookedCreate):
    try:
        sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'meeting_booked', 'meeting', {q(payload.subject)}, {q(payload.content)}, {q(payload.outcome or 'meeting booked')}, {q(payload.owner)}
        ) RETURNING id;
        UPDATE sales_leads
        SET meeting_booked_at = now(),
            status = 'meeting booked'
        WHERE id = {payload.lead_id};
        """
        out = run_fetch(sql)
        log_id = int(out.splitlines()[0].strip())
        complete_pending_followups(payload.lead_id, 'superseded_by_meeting')
        create_followup_if_missing(payload.lead_id, 'Meeting prep / follow-up', 'Prepare for the booked meeting and confirm next steps after the call.', "now() + interval '2 day'", payload.owner)
        return {'ok': True, 'id': log_id, 'automation': 'meeting prep follow-up scheduled and stale pending follow-ups completed'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/deals/won')
def mark_deal_won(payload: DealOutcomeCreate):
    try:
        sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'deal_won', 'deal', {q(payload.subject)}, {q(payload.content)}, {q(payload.outcome or 'closed won')}, {q(payload.owner)}
        ) RETURNING id;
        UPDATE sales_leads
        SET closed_at = now(),
            status = 'closed won'
        WHERE id = {payload.lead_id};
        """
        out = run_fetch(sql)
        log_id = int(out.splitlines()[0].strip())
        complete_pending_followups(payload.lead_id, 'superseded_by_closed_won')
        create_followup_if_missing(payload.lead_id, 'Client onboarding handoff', 'Won deal. Complete onboarding and delivery kickoff.', "now() + interval '1 day'", payload.owner)
        return {'ok': True, 'id': log_id, 'automation': 'onboarding follow-up scheduled and stale pending follow-ups completed'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/deals/lost')
def mark_deal_lost(payload: DealOutcomeCreate):
    try:
        sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {payload.lead_id}, 'deal_lost', 'deal', {q(payload.subject)}, {q(payload.content)}, {q(payload.outcome or 'closed lost')}, {q(payload.owner)}
        ) RETURNING id;
        UPDATE sales_leads
        SET closed_at = now(),
            status = 'closed lost',
            lost_reason = {q(payload.lost_reason)}
        WHERE id = {payload.lead_id};
        """
        out = run_fetch(sql)
        log_id = int(out.splitlines()[0].strip())
        complete_pending_followups(payload.lead_id, 'superseded_by_closed_lost')
        create_followup_if_missing(payload.lead_id, 'Reactivation check', 'Lost deal. Recheck later if timing or budget changes.', "now() + interval '30 day'", payload.owner)
        return {'ok': True, 'id': log_id, 'automation': 'reactivation follow-up scheduled and stale pending follow-ups completed'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/activity')
def list_activity(lead_id: Optional[int] = None, limit: int = 100):
    limit = max(1, min(limit, 500))
    where_sql = f"WHERE a.lead_id = {lead_id}" if lead_id else ''
    sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT a.id, a.lead_id, l.company_name, a.activity_type, a.channel, a.subject, a.content, a.outcome, a.owner, a.created_at
        FROM sales_activity_logs a
        LEFT JOIN sales_leads l ON l.id = a.lead_id
        {where_sql}
        ORDER BY a.id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
        rows = [json.loads(line) for line in out.splitlines() if line.strip()]
        return {'ok': True, 'items': rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/outreach/drafts')
def list_outreach_drafts(limit: int = 100, status: Optional[str] = None):
    limit = max(1, min(limit, 500))
    where_sql = "WHERE a.activity_type = 'draft_created'"
    if status:
        where_sql += f" AND COALESCE(a.outcome, 'draft_only') = {q(status)}"
    sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT a.id, a.lead_id, l.company_name, l.contact_person, l.email,
               a.channel, a.subject, a.content, a.outcome, a.owner, a.created_at
        FROM sales_activity_logs a
        LEFT JOIN sales_leads l ON l.id = a.lead_id
        {where_sql}
        ORDER BY a.id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        out = run_fetch(sql)
        rows = [json.loads(line) for line in out.splitlines() if line.strip()]
        return {'ok': True, 'items': rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/sales/outreach/queue')
def outreach_queue(limit: int = 200):
    limit = max(1, min(limit, 500))
    summary_sql = """
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT COALESCE(a.outcome, 'draft_only') AS status,
               count(*) AS count
        FROM sales_activity_logs a
        WHERE a.activity_type = 'draft_created'
        GROUP BY COALESCE(a.outcome, 'draft_only')
        ORDER BY COALESCE(a.outcome, 'draft_only')
      ) t
    ) TO STDOUT;
    """
    items_sql = f"""
    COPY (
      SELECT row_to_json(t)
      FROM (
        SELECT a.id, a.lead_id, l.company_name, l.contact_person, l.email,
               a.channel, a.subject, a.content, a.outcome, a.owner, a.created_at
        FROM sales_activity_logs a
        LEFT JOIN sales_leads l ON l.id = a.lead_id
        WHERE a.activity_type = 'draft_created'
        ORDER BY CASE COALESCE(a.outcome, 'draft_only')
            WHEN 'approved_to_send' THEN 1
            WHEN 'draft_only' THEN 2
            WHEN 'needs_edit' THEN 3
            WHEN 'sent' THEN 4
            WHEN 'rejected' THEN 5
            ELSE 6
          END,
          a.id DESC
        LIMIT {limit}
      ) t
    ) TO STDOUT;
    """
    try:
        summary_out = run_fetch(summary_sql)
        items_out = run_fetch(items_sql)
        summary = [json.loads(line) for line in summary_out.splitlines() if line.strip()]
        items = [json.loads(line) for line in items_out.splitlines() if line.strip()]
        return {'ok': True, 'summary': summary, 'items': items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/outreach/drafts/{activity_id}/approve')
def approve_outreach_draft(activity_id: int, payload: DraftApprovalUpdate):
    if payload.outcome not in ['approved_to_send', 'rejected', 'needs_edit']:
        raise HTTPException(status_code=400, detail='Invalid outcome')
    sql = f"""
    UPDATE sales_activity_logs
    SET outcome = {q(payload.outcome)},
        owner = COALESCE({q(payload.owner)}, owner)
    WHERE id = {activity_id}
      AND activity_type = 'draft_created';
    """
    try:
        run_fetch(sql)
        return {'ok': True, 'id': activity_id, 'outcome': payload.outcome}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/sales/outreach/drafts/{activity_id}/send')
def send_approved_outreach_draft(activity_id: int):
    try:
        sql = f"""
        SELECT row_to_json(t)
        FROM (
          SELECT a.id, a.lead_id, a.subject, a.content, a.outcome, a.owner,
                 l.company_name, l.contact_person, l.email
          FROM sales_activity_logs a
          LEFT JOIN sales_leads l ON l.id = a.lead_id
          WHERE a.id = {activity_id}
            AND a.activity_type = 'draft_created'
        ) t;
        """
        out = run_fetch(sql)
        if not out:
            raise HTTPException(status_code=404, detail='Draft not found')
        draft = json.loads(out.splitlines()[0])
        if draft.get('outcome') != 'approved_to_send':
            raise HTTPException(status_code=400, detail='Draft is not approved_to_send')
        if not draft.get('email'):
            raise HTTPException(status_code=400, detail='Lead has no email address')

        send_cmd = [
            'gog', 'gmail', 'send',
            '--to', draft['email'],
            '--subject', draft.get('subject') or 'Outreach',
            '--body', draft.get('content') or '',
        ]
        proc = subprocess.run(send_cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=proc.stderr or proc.stdout or 'gog send failed')

        log_sql = f"""
        INSERT INTO sales_activity_logs (
          lead_id, activity_type, channel, subject, content, outcome, owner
        ) VALUES (
          {draft['lead_id']}, 'email_sent', 'email', {q(draft.get('subject'))}, {q(draft.get('content'))}, 'sent', {q(draft.get('owner'))}
        );
        UPDATE sales_activity_logs SET outcome = 'sent' WHERE id = {activity_id};
        """
        run_fetch(log_sql)
        return {'ok': True, 'id': activity_id, 'sent_to': draft['email'], 'provider': 'gog'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
