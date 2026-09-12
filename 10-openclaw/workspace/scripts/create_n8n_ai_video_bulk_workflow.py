#!/usr/bin/env python3
import json
import os
import uuid
from pathlib import Path

import requests

ROOT = Path('/root/.openclaw/workspace')
ENV_PATH = ROOT / '.env'
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

API_KEY = os.environ.get('N8N_API_KEY') or os.environ.get('CB_N8N_API_KEY')
if not API_KEY:
    raise SystemExit('N8N_API_KEY/CB_N8N_API_KEY missing from environment')


def nid():
    return str(uuid.uuid4())

name = 'AI Video Bulk Render - Template to Drive'
webhook_id = str(uuid.uuid4())
ids = {k: nid() for k in ['webhook', 'payload', 'http', 'respond']}

payload_js = r"""
const body = $json.body || $json || {};
let rows = body.rows;
if (!rows && body.Hook_Text) rows = [body];
if (!rows && body.hook_text) rows = [body];
if (!rows) {
  rows = [{
    label: 'n8n_test_video',
    Hook_Text: 'Most Software Developers qualify for more job titles than they apply to.',
    Insight_Text: "95% of U.S. publicly posted jobs stay invisible to candidates who don't know to search them",
    Implication_Text: "Your strongest matches may be roles you've never searched.",
    CTA_Text: 'Start with your TraitDNA™ Work-Style Report free, 15 minutes.',
    'CTA Sub Text': 'Free. 15 minutes. No credit card. Get your personal Work-Style Report.'
  }];
}
if (!Array.isArray(rows)) rows = [rows];
return [{ json: {
  rows,
  limit: Math.max(1, Math.min(Number(body.limit || rows.length || 1), 20)),
  continue_on_error: body.continue_on_error !== false,
  drive_folder_id: body.drive_folder_id || '1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP'
}}];
""".strip()

workflow = {
    'name': name,
    'nodes': [
        {
            'parameters': {'httpMethod': 'POST', 'path': 'ai-video-bulk-render', 'responseMode': 'responseNode', 'options': {}},
            'id': ids['webhook'],
            'name': 'Webhook - AI Video Bulk Render',
            'type': 'n8n-nodes-base.webhook',
            'typeVersion': 2,
            'position': [-720, 0],
            'webhookId': webhook_id,
        },
        {
            'parameters': {'jsCode': payload_js},
            'id': ids['payload'],
            'name': 'Build Bulk Render Payload',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [-480, 0],
        },
        {
            'parameters': {
                'method': 'POST',
                'url': 'http://127.0.0.1:8013/ai-video-render-bulk',
                'sendBody': True,
                'specifyBody': 'json',
                'jsonBody': '={{ $json }}',
                'contentType': 'json',
                'options': {'timeout': 900000, 'response': {'response': {'responseFormat': 'json'}}},
            },
            'id': ids['http'],
            'name': 'Call Local AI Video Renderer',
            'type': 'n8n-nodes-base.httpRequest',
            'typeVersion': 4.2,
            'position': [-220, 0],
        },
        {
            'parameters': {'respondWith': 'json', 'responseBody': '={{$json}}'},
            'id': ids['respond'],
            'name': 'Respond With Drive Links',
            'type': 'n8n-nodes-base.respondToWebhook',
            'typeVersion': 1,
            'position': [40, 0],
        },
    ],
    'connections': {
        'Webhook - AI Video Bulk Render': {'main': [[{'node': 'Build Bulk Render Payload', 'type': 'main', 'index': 0}]]},
        'Build Bulk Render Payload': {'main': [[{'node': 'Call Local AI Video Renderer', 'type': 'main', 'index': 0}]]},
        'Call Local AI Video Renderer': {'main': [[{'node': 'Respond With Drive Links', 'type': 'main', 'index': 0}]]},
    },
    'settings': {'executionOrder': 'v1', 'saveExecutionProgress': True, 'saveManualExecutions': True},
}

out = ROOT / 'projects' / 'V0001 Template System - 2026-05-12' / 'AI_Video_Workflow' / 'n8n_ai_video_bulk_render_active.json'
out.write_text(json.dumps(workflow, indent=2), encoding='utf-8')

headers = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}
base = os.environ.get('N8N_API_BASE', 'http://127.0.0.1:5678/api/v1').rstrip('/')
resp = requests.get(base + '/workflows', headers=headers, timeout=30)
resp.raise_for_status()
existing = next((x for x in resp.json().get('data', []) if x.get('name') == name and not x.get('isArchived')), None)
if not existing:
    r = requests.post(base + '/workflows', headers=headers, json=workflow, timeout=30)
    r.raise_for_status()
    wid = r.json()['id']
    action = 'created'
else:
    wid = existing['id']
    requests.post(base + f'/workflows/{wid}/deactivate', headers=headers, timeout=20)
    clean = json.loads(json.dumps(workflow))
    r = requests.put(base + f'/workflows/{wid}', headers=headers, json=clean, timeout=30)
    r.raise_for_status()
    action = 'updated'

ar = requests.post(base + f'/workflows/{wid}/activate', headers=headers, timeout=30)
ar.raise_for_status()
print(json.dumps({
    'ok': True,
    'action': action,
    'workflow_id': wid,
    'workflow_name': name,
    'webhook_path': '/webhook/ai-video-bulk-render',
    'local_test_url': 'http://127.0.0.1:5678/webhook/ai-video-bulk-render',
    'workflow_json': str(out),
}, indent=2))
