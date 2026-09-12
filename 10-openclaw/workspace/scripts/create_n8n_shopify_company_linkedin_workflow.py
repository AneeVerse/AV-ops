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

name = 'Shopify Sheet - Company LinkedIn No AI'
ids = {k: nid() for k in ['webhook', 'build', 'http', 'respond']}
webhook_id = str(uuid.uuid4())

build_js = r"""
const body = $json.body || $json || {};
return [{ json: {
  limit: Math.max(1, Math.min(Number(body.limit ?? 1), 25)),
  startRow: Math.max(2, Number(body.startRow ?? body.start_row ?? 2)),
  dryRun: Boolean(body.dryRun || body.dry_run),
  writeNA: Boolean(body.writeNA || body.write_na),
}}];
""".strip()

workflow = {
    'name': name,
    'nodes': [
        {
            'parameters': {'httpMethod': 'POST', 'path': 'shopify-company-linkedin-next', 'responseMode': 'responseNode', 'options': {}},
            'id': ids['webhook'], 'name': 'Webhook - Shopify LinkedIn Next', 'type': 'n8n-nodes-base.webhook', 'typeVersion': 2,
            'position': [-720, 0], 'webhookId': webhook_id,
        },
        {'parameters': {'jsCode': build_js}, 'id': ids['build'], 'name': 'Build Safe Payload', 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [-480, 0]},
        {'parameters': {'method': 'POST', 'url': 'http://127.0.0.1:8012/shopify-company-linkedin-next', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ $json }}', 'contentType': 'json', 'options': {'response': {'response': {'responseFormat': 'json'}}}}, 'id': ids['http'], 'name': 'Call Local LinkedIn Finder', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [-220, 0]},
        {'parameters': {'respondWith': 'json', 'responseBody': '={{$json}}'}, 'id': ids['respond'], 'name': 'Respond JSON', 'type': 'n8n-nodes-base.respondToWebhook', 'typeVersion': 1, 'position': [40, 0]},
    ],
    'connections': {
        'Webhook - Shopify LinkedIn Next': {'main': [[{'node': 'Build Safe Payload', 'type': 'main', 'index': 0}]]},
        'Build Safe Payload': {'main': [[{'node': 'Call Local LinkedIn Finder', 'type': 'main', 'index': 0}]]},
        'Call Local LinkedIn Finder': {'main': [[{'node': 'Respond JSON', 'type': 'main', 'index': 0}]]},
    },
    'settings': {'executionOrder': 'v1', 'saveExecutionProgress': True, 'saveManualExecutions': True},
}

out = ROOT / 'tmp/shopify_company_linkedin_no_ai_workflow.json'
out.write_text(json.dumps(workflow, indent=2))
headers = {'X-N8N-API-KEY': os.environ['N8N_API_KEY'], 'Content-Type': 'application/json'}
base = 'http://127.0.0.1:5678/api/v1'
r = requests.get(base + '/workflows', headers=headers, timeout=20)
r.raise_for_status()
existing = next((x for x in r.json().get('data', []) if x.get('name') == name and not x.get('isArchived')), None)
if not existing:
    resp = requests.post(base + '/workflows', headers=headers, json=workflow, timeout=30)
    print('create', resp.status_code, resp.text[:500])
    resp.raise_for_status()
    wid = resp.json()['id']
else:
    wid = existing['id']
    requests.post(base + f'/workflows/{wid}/deactivate', headers=headers, timeout=20)
    resp = requests.put(base + f'/workflows/{wid}', headers=headers, json=workflow, timeout=30)
    print('update', resp.status_code, resp.text[:500])
    resp.raise_for_status()

ar = requests.post(base + f'/workflows/{wid}/activate', headers=headers, timeout=20)
print('activate', ar.status_code, ar.text[:500])
ar.raise_for_status()
print(json.dumps({'workflow_id': wid, 'webhook_path': '/webhook/shopify-company-linkedin-next', 'json': str(out)}))
