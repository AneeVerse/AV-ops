#!/usr/bin/env python3
import json
import os
import subprocess
import urllib.request
from pathlib import Path

from fastapi import FastAPI, HTTPException

ROOT = Path('/root/.openclaw/workspace')
AUDIT_SCRIPT = ROOT / 'scripts' / 'automation_01_task_hygiene_audit.py'
MIRROR_SCRIPT = ROOT / 'scripts' / 'supabase_mirror.py'
AUTOMATION10_CYCLE_SCRIPT = ROOT / 'scripts' / 'automation10_local_cycle.py'
OUTPUT_JSON = ROOT / 'tmp' / 'automation_01_api_last.json'
MIRROR_OUTPUT_JSON = ROOT / 'tmp' / 'supabase_mirror_last.json'
AUTOMATION10_OUTPUT_JSON = ROOT / 'tmp' / 'automation10_local_cycle_last.json'
HORECA1_SUMMARY_OUTPUT_JSON = ROOT / 'tmp' / 'horeca1_github_summary_last.json'
HORECA1_SUMMARY_SCRIPT = ROOT / 'scripts' / 'horeca1_github_summary.py'
WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAsMLRYPE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=KXXTq-JL8aWECEBVuy5n-rA9uUkb9K8DjChEoIOggvM'

app = FastAPI(title='Automation API')

try:
    from scripts.sales_api import app as sales_app
    app.mount('/internal', sales_app)
except Exception:
    sales_app = None


def build_summary(data):
    issue_ids = {i['task_id'] for i in data.get('issues', [])}
    warn_only_ids = {w['task_id'] for w in data.get('warnings', []) if w['task_id'] not in issue_ids}
    clean = max((data.get('total_tasks') or 0) - len(issue_ids) - len(warn_only_ids), 0)
    top = []
    for k, v in (data.get('issue_breakdown') or {}).items():
        top.append((k, v))
    for k, v in (data.get('warning_breakdown') or {}).items():
        top.append((k, v))
    top.sort(key=lambda x: (-x[1], x[0]))
    lines = [
        '🦀 Daily Task Hygiene Audit complete.',
        '',
        f"Tasks checked: {data.get('total_tasks', 0)}",
        f"Clean tasks: {clean}",
        f"Issues: {data.get('issue_count', 0)}",
        f"Warnings: {data.get('warning_count', 0)}",
        '',
        'Top findings:',
    ]
    if top:
        lines.extend([f"• {k}: {v}" for k, v in top[:6]])
    else:
        lines.append('• none')
    return '\n'.join(lines)


def post_google_chat(text):
    payload = json.dumps({'text': text}).encode()
    req = urllib.request.Request(WEBHOOK_URL, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def build_automation10_summary(data):
    dispatcher = data.get('dispatcher') or {}
    reply_parser = data.get('reply_parser') or {}
    followup = data.get('followup') or {}
    counts = data.get('dashboard_counts') or {}
    lines = [
        'Automation 10 Local Cycle',
        '',
        f"Status: {data.get('status', 'unknown')}",
        '',
        'Dispatch:',
        f"- Candidate tasks: {dispatcher.get('candidate_tasks', 0)}",
        f"- Sent: {dispatcher.get('sent_dispatches', 0)}",
        f"- Skipped: {dispatcher.get('skipped_dispatches', 0)}",
        f"- Failed: {dispatcher.get('failed_dispatches', 0)}",
        '',
        'Replies:',
        f"- Spaces checked: {reply_parser.get('spaces_checked', 0)}",
        f"- Messages considered: {reply_parser.get('messages_considered', 0)}",
        f"- Actions applied: {reply_parser.get('actions_applied', 0)}",
        '',
        'Follow-up:',
        f"- States checked: {followup.get('states_checked', 0)}",
        f"- Follow-ups created: {followup.get('followups_created', 0)}",
        f"- Escalations: {followup.get('escalations_created', 0)}",
        '',
        'Dashboard:',
        f"- Assigned: {counts.get('assigned', 0)}",
        f"- Acknowledged: {counts.get('acknowledged', 0)}",
        f"- In Progress: {counts.get('in_progress', 0)}",
        f"- Blocked: {counts.get('blocked', 0)}",
        f"- Overdue: {counts.get('overdue', 0)}",
        f"- Completed: {counts.get('completed', 0)}",
    ]
    return '\n'.join(lines)


@app.get('/health')
def health():
    return {'ok': True, 'service': 'automation-api'}


@app.post('/automation-1/run')
def run_automation_1():
    if not AUDIT_SCRIPT.exists():
        raise HTTPException(status_code=500, detail='audit script missing')
    proc = subprocess.run(
        ['python3', str(AUDIT_SCRIPT), '--record-db'],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=proc.stderr or proc.stdout or 'audit run failed')
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f'invalid audit output: {e}')

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(data, indent=2))
    summary = build_summary(data)
    chat_response = post_google_chat(summary)
    return {
        'ok': True,
        'summary': summary,
        'audit': data,
        'chat_response': chat_response,
    }


@app.post('/supabase-mirror/run')
def run_supabase_mirror():
    if not MIRROR_SCRIPT.exists():
        raise HTTPException(status_code=500, detail='mirror script missing')
    proc = subprocess.run(
        ['python3', str(MIRROR_SCRIPT)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=proc.stderr or proc.stdout or 'mirror run failed')
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f'invalid mirror output: {e}')

    MIRROR_OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    MIRROR_OUTPUT_JSON.write_text(json.dumps(data, indent=2))
    return {
        'ok': True,
        'mirror': data,
    }


@app.post('/automation10/run-local-cycle')
def run_automation10_local_cycle():
    if not AUTOMATION10_CYCLE_SCRIPT.exists():
        raise HTTPException(status_code=500, detail='automation10 local cycle script missing')
    proc = subprocess.run(
        ['python3', str(AUTOMATION10_CYCLE_SCRIPT)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=proc.stderr or proc.stdout or 'automation10 local cycle failed')
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f'invalid automation10 output: {e}')

    AUTOMATION10_OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    AUTOMATION10_OUTPUT_JSON.write_text(json.dumps(data, indent=2))
    return {
        'ok': True,
        'automation10': data,
    }


@app.post('/automation10/run-local-cycle-and-notify')
def run_automation10_local_cycle_and_notify():
    result = run_automation10_local_cycle()
    automation10 = result['automation10']
    summary = build_automation10_summary(automation10)
    chat_response = post_google_chat(summary)
    return {
        'ok': True,
        'summary': summary,
        'automation10': automation10,
        'chat_response': chat_response,
    }


@app.post('/horeca1/github-summary/run')
def run_horeca1_github_summary():
    if not HORECA1_SUMMARY_SCRIPT.exists():
        raise HTTPException(status_code=500, detail='horeca1 summary script missing')
    proc = subprocess.run(
        ['python3', str(HORECA1_SUMMARY_SCRIPT)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=proc.stderr or proc.stdout or 'horeca1 summary run failed')
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f'invalid horeca1 summary output: {e}')

    HORECA1_SUMMARY_OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    HORECA1_SUMMARY_OUTPUT_JSON.write_text(json.dumps(data, indent=2))
    return {
        'ok': True,
        'summary': data,
    }
