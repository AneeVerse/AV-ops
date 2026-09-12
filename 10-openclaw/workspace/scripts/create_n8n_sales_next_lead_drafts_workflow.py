#!/usr/bin/env python3
import json
import os
import uuid
from pathlib import Path

import requests

ROOT = Path('/root/.openclaw/workspace')
ENV_PATH = ROOT / '.env'

for line in ENV_PATH.read_text().splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k, v = line.split('=', 1)
        os.environ.setdefault(k, v)


def nid():
    return str(uuid.uuid4())

name = 'Sales - Next 2 Lead Drafts No AI'
ids = {k: nid() for k in ['webhook', 'build', 'http', 'respond']}
webhook_id = str(uuid.uuid4())

build_js = r"""
const body = $json.body || $json || {};
return [{ json: {
  limit: Math.max(1, Math.min(Number(body.limit ?? 2), 25)),
  owner: String(body.owner || 'Ane'),
  dryRun: Boolean(body.dryRun || body.dry_run),
}}];
""".strip()

workflow = {
    'name': name,
    'nodes': [
        {
            'parameters': {'httpMethod': 'POST', 'path': 'sales-next-lead-drafts', 'responseMode': 'responseNode', 'options': {}},
            'id': ids['webhook'], 'name': 'Webhook - Next Lead Drafts', 'type': 'n8n-nodes-base.webhook', 'typeVersion': 2,
            'position': [-720, 0], 'webhookId': webhook_id,
        },
        {'parameters': {'jsCode': build_js}, 'id': ids['build'], 'name': 'Build Safe Payload', 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [-480, 0]},
        {'parameters': {'method': 'POST', 'url': 'http://127.0.0.1:8012/sales-next-lead-drafts', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ $json }}', 'contentType': 'json', 'options': {'response': {'response': {'responseFormat': 'json'}}}}, 'id': ids['http'], 'name': 'Call Local No-AI Draft Bridge', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [-220, 0]},
        {'parameters': {'respondWith': 'json', 'responseBody': '={{$json}}'}, 'id': ids['respond'], 'name': 'Respond JSON', 'type': 'n8n-nodes-base.respondToWebhook', 'typeVersion': 1, 'position': [40, 0]},
    ],
    'connections': {
        'Webhook - Next Lead Drafts': {'main': [[{'node': 'Build Safe Payload', 'type': 'main', 'index': 0}]]},
        'Build Safe Payload': {'main': [[{'node': 'Call Local No-AI Draft Bridge', 'type': 'main', 'index': 0}]]},
        'Call Local No-AI Draft Bridge': {'main': [[{'node': 'Respond JSON', 'type': 'main', 'index': 0}]]},
    },
    'settings': {'executionOrder': 'v1', 'saveExecutionProgress': True, 'saveManualExecutions': True},
}

out = ROOT / 'tmp/sales_next_lead_drafts_no_ai_workflow.json'
out.write_text(json.dumps(workflow, indent=2))

headers = {'X-N8N-API-KEY': os.environ['N8N_API_KEY'], 'Content-Type': 'application/json'}
base = 'http://127.0.0.1:5678/api/v1'
resp = requests.get(base + '/workflows', headers=headers, timeout=20)
resp.raise_for_status()
existing = next((x for x in resp.json().get('data', []) if x.get('name') == name and not x.get('isArchived')), None)
if not existing:
    r = requests.post(base + '/workflows', headers=headers, json=workflow, timeout=30)
    print('create', r.status_code, r.text[:500])
    r.raise_for_status()
    wid = r.json()['id']
else:
    wid = existing['id']
    requests.post(base + f'/workflows/{wid}/deactivate', headers=headers, timeout=20)
    r = requests.put(base + f'/workflows/{wid}', headers=headers, json=workflow, timeout=30)
    print('update', r.status_code, r.text[:500])
    r.raise_for_status()

ar = requests.post(base + f'/workflows/{wid}/activate', headers=headers, timeout=20)
print('activate', ar.status_code, ar.text[:500])
ar.raise_for_status()
print(json.dumps({'workflow_id': wid, 'webhook_path': '/webhook/sales-next-lead-drafts', 'json': str(out)}))
