#!/usr/bin/env python3
import json, os, uuid, requests

def nid(): return str(uuid.uuid4())
name='Shopify NY Budget Batch - Two Tab'
ids={k:nid() for k in ['webhook','build','http','respond']}
build_js = """
const body = $json.body || $json || {};
return [{json:{
  batch: Number(body.batch ?? 47),
  maxCandidates: Math.max(1, Math.min(Number(body.maxCandidates ?? 8), 25)),
  maxQueries: Math.max(1, Math.min(Number(body.maxQueries ?? 4), 12)),
  resultsPerPage: Math.max(1, Math.min(Number(body.resultsPerPage ?? 3), 10)),
  verifyTimeout: Math.max(3, Math.min(Number(body.verifyTimeout ?? 5), 10)),
}}];
""".strip()
workflow={
 'name': name,
 'nodes': [
  {'parameters': {'httpMethod':'POST','path':'shopify-ny-budget-batch','responseMode':'responseNode','options':{}}, 'id':ids['webhook'], 'name':'Webhook - Run Budget Batch', 'type':'n8n-nodes-base.webhook', 'typeVersion':2, 'position':[-720,0], 'webhookId':str(uuid.uuid4())},
  {'parameters': {'jsCode': build_js}, 'id':ids['build'], 'name':'Build Safe Payload', 'type':'n8n-nodes-base.code', 'typeVersion':2, 'position':[-480,0]},
  {'parameters': {'method':'POST','url':'http://127.0.0.1:8011/shopify-ny-budget-batch','sendBody':True,'specifyBody':'json','jsonBody':'={{ $json }}','contentType':'json','options': {'response': {'response': {'responseFormat': 'json'}}}}, 'id':ids['http'], 'name':'Call Local Budget API', 'type':'n8n-nodes-base.httpRequest', 'typeVersion':4.2, 'position':[-220,0]},
  {'parameters': {'respondWith':'json','responseBody':'={{$json}}'}, 'id':ids['respond'], 'name':'Respond JSON', 'type':'n8n-nodes-base.respondToWebhook', 'typeVersion':1, 'position':[40,0]},
 ],
 'connections': {
  'Webhook - Run Budget Batch': {'main': [[{'node':'Build Safe Payload','type':'main','index':0}]]},
  'Build Safe Payload': {'main': [[{'node':'Call Local Budget API','type':'main','index':0}]]},
  'Call Local Budget API': {'main': [[{'node':'Respond JSON','type':'main','index':0}]]},
 },
 'settings': {'executionOrder':'v1','saveExecutionProgress':True,'saveManualExecutions':True},
}
out='/root/.openclaw/workspace/outputs/shopify_city_leads/n8n_shopify_budget_batch_workflow_v3.json'
open(out,'w').write(json.dumps(workflow,indent=2))
headers={'X-N8N-API-KEY':os.environ['N8N_API_KEY'], 'Content-Type':'application/json'}
base='http://127.0.0.1:5678/api/v1'
r=requests.get(base+'/workflows',headers=headers,timeout=20); r.raise_for_status()
existing=next((x for x in r.json().get('data',[]) if x.get('name')==name and not x.get('isArchived')), None)
if not existing:
    resp=requests.post(base+'/workflows',headers=headers,json=workflow,timeout=30); print('create', resp.status_code, resp.text[:250]); resp.raise_for_status(); wid=resp.json()['id']
else:
    wid=existing['id']; requests.post(base+f'/workflows/{wid}/deactivate',headers=headers,timeout=20)
    resp=requests.put(base+f'/workflows/{wid}',headers=headers,json=workflow,timeout=30); print('update', resp.status_code, resp.text[:250]); resp.raise_for_status()
ar=requests.post(base+f'/workflows/{wid}/activate',headers=headers,timeout=20)
print('activate', ar.status_code, ar.text[:250], 'workflow_id', wid, 'json', out)
ar.raise_for_status()
