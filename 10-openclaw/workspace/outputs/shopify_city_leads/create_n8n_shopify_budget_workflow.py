#!/usr/bin/env python3
import json, os, uuid, requests

def nid(): return str(uuid.uuid4())[:8]
name='Shopify NY Budget Batch - Two Tab'
ids={k:nid() for k in ['webhook','config','exec','parse','respond']}
workflow={
 'name': name,
 'nodes': [
  {'parameters': {'httpMethod':'POST','path':'shopify-ny-budget-batch','responseMode':'responseNode','options':{}}, 'id':ids['webhook'], 'name':'Webhook - Run Budget Batch', 'type':'n8n-nodes-base.webhook', 'typeVersion':2, 'position':[-760,0]},
  {'parameters': {'jsCode': """
const body = $json.body || {};
const batch = Number(body.batch ?? 45);
const maxCandidates = Math.max(1, Math.min(Number(body.maxCandidates ?? 8), 25));
const maxQueries = Math.max(1, Math.min(Number(body.maxQueries ?? 6), 12));
const resultsPerPage = Math.max(1, Math.min(Number(body.resultsPerPage ?? 5), 10));
const verifyTimeout = Math.max(3, Math.min(Number(body.verifyTimeout ?? 5), 10));
const workspace = '/root/.openclaw/workspace';
const runner = `${workspace}/outputs/shopify_city_leads/ny_to_1000_runner.py`;
const cmd = `cd ${workspace} && START_BATCH=${batch} MAX_APIFY_RUNS=${batch + 1} MAX_CANDIDATES_PER_RUN=${maxCandidates} MAX_QUERIES_PER_RUN=${maxQueries} APIFY_RESULTS_PER_PAGE=${resultsPerPage} VERIFY_TIMEOUT=${verifyTimeout} python3 ${runner}`;
return [{json:{batch,maxCandidates,maxQueries,resultsPerPage,verifyTimeout,command:cmd,startedAt:new Date().toISOString()}}];
"""}, 'id':ids['config'], 'name':'Build Budget Command', 'type':'n8n-nodes-base.code', 'typeVersion':2, 'position':[-520,0]},
  {'parameters': {'command':'={{$json.command}}','options':{}}, 'id':ids['exec'], 'name':'Run Local Verifier Batch', 'type':'n8n-nodes-base.executeCommand', 'typeVersion':1, 'position':[-260,0]},
  {'parameters': {'jsCode': """
const stdout = $json.stdout || '';
const stderr = $json.stderr || '';
let parsed = null;
const match = stdout.match(/\{[\s\S]*\}\s*$/);
if (match) { try { parsed = JSON.parse(match[0]); } catch (e) {} }
return [{json:{ok: !$json.exitCode, exitCode: $json.exitCode, parsed, stdoutTail: stdout.slice(-4000), stderrTail: stderr.slice(-2000), finishedAt:new Date().toISOString()}}];
"""}, 'id':ids['parse'], 'name':'Parse Batch Output', 'type':'n8n-nodes-base.code', 'typeVersion':2, 'position':[0,0]},
  {'parameters': {'respondWith':'json','responseBody':'={{$json}}'}, 'id':ids['respond'], 'name':'Respond JSON', 'type':'n8n-nodes-base.respondToWebhook', 'typeVersion':1, 'position':[240,0]},
 ],
 'connections': {
  'Webhook - Run Budget Batch': {'main': [[{'node':'Build Budget Command','type':'main','index':0}]]},
  'Build Budget Command': {'main': [[{'node':'Run Local Verifier Batch','type':'main','index':0}]]},
  'Run Local Verifier Batch': {'main': [[{'node':'Parse Batch Output','type':'main','index':0}]]},
  'Parse Batch Output': {'main': [[{'node':'Respond JSON','type':'main','index':0}]]},
 },
 'settings': {'executionOrder':'v1','saveExecutionProgress':True,'saveManualExecutions':True},
 'active': False,
 'pinData': {},
 'tags': []
}
out='/root/.openclaw/workspace/outputs/shopify_city_leads/n8n_shopify_budget_batch_workflow.json'
open(out,'w').write(json.dumps(workflow,indent=2))
headers={'X-N8N-API-KEY':os.environ['N8N_API_KEY'], 'Content-Type':'application/json'}
base='http://127.0.0.1:5678/api/v1'
# Archive existing workflow with same name? Prefer create new if none, update if found.
r=requests.get(base+'/workflows',headers=headers,timeout=20); r.raise_for_status()
existing=None
for w in r.json().get('data',[]):
    if w.get('name')==name and not w.get('isArchived'):
        existing=w; break
if existing:
    wid=existing['id']
    payload={k:workflow[k] for k in ['name','nodes','connections','settings','active','pinData']}
    ur=requests.put(base+f'/workflows/{wid}',headers=headers,json=payload,timeout=30)
    print('update_status', ur.status_code, ur.text[:200])
    if ur.status_code >= 400: ur.raise_for_status()
else:
    cr=requests.post(base+'/workflows',headers=headers,json=workflow,timeout=30)
    print('create_status', cr.status_code, cr.text[:200])
    cr.raise_for_status(); wid=cr.json()['id']
ar=requests.post(base+f'/workflows/{wid}/activate',headers=headers,timeout=20)
print('activate_status', ar.status_code, 'workflow_id', wid, 'json', out)
if ar.status_code >= 400: ar.raise_for_status()
