import json, pathlib, uuid
BASE = pathlib.Path('/root/.openclaw/workspace/projects/pdf-to-ppt-tool-ui')
CRED = {"id": "DhbnuEMEaJjJewJ3", "name": "PDF to PPT Google Drive OAuth Full Scope"}
HISTORY = '1Af1vO4a-8sec1_ou1evm_Q1YofC4Zj2o'

def node(name, type_, params, pos, credentials=None, version=2):
    data={"parameters":params,"id":str(uuid.uuid4()),"name":name,"type":type_,"typeVersion":version,"position":pos}
    if type_=='n8n-nodes-base.webhook': data['webhookId']=str(uuid.uuid4())
    if credentials: data['credentials']=credentials
    return data

prepare_history = r"""
const helpers = this.helpers;
const body = $input.item.json.body || $input.item.json;
const job = {
  job_id: body.job_id,
  file_name: body.file_name,
  status: body.status || 'extracted',
  uploaded_at: body.uploaded_at,
  extracted_at: body.extracted_at || new Date().toISOString(),
  text_length: body.text_length || 0,
  page_count: body.page_count || null,
  source: 'nextjs-pdf-parse-to-n8n',
  step: 'step_2_text_extraction_metadata_only',
  storage_policy: 'source_pdf_and_extracted_text_not_saved',
};
if (!job.job_id || !job.file_name) throw new Error('job_id and file_name are required');
const historyName = `${job.job_id}.json`;
const boundary = `pdf_to_ppt_history_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const bodyBuffer = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
  Buffer.from(JSON.stringify({ name: historyName, parents: ['__HISTORY__'], mimeType: 'application/json' })),
  Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
  Buffer.from(JSON.stringify(job, null, 2), 'utf8'),
  Buffer.from(`\r\n--${boundary}--`),
]);
const binary = await helpers.prepareBinaryData(bodyBuffer, 'multipart-history-body.bin', 'application/octet-stream');
return [{ json: { job, history_name: historyName, content_type: `multipart/related; boundary=${boundary}` }, binary: { body: binary } }];
""".replace('__HISTORY__', HISTORY).strip()

final_response = r"""
const job = $('Prepare History Metadata').item.json.job;
const historyUpload = $input.item.json;
job.history_file_id = historyUpload.id;
job.history_file_url = historyUpload.webViewLink || historyUpload.webContentLink;
return [{ json: { ok: true, job } }];
""".strip()

http_upload = node('Upload History Metadata','n8n-nodes-base.httpRequest',{
    'method':'POST','url':'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime',
    'authentication':'predefinedCredentialType','nodeCredentialType':'googleDriveOAuth2Api',
    'sendHeaders':True,'specifyHeaders':'keypair','headerParameters':{'parameters':[{'name':'Content-Type','value':'={{ $json.content_type }}'}]},
    'sendBody':True,'contentType':'binaryData','inputDataFieldName':'body',
    'options': {'response': {'response': {'responseFormat': 'json'}}}
},[800,300], {'googleDriveOAuth2Api': CRED}, version=4.2)

wf={
 'name':'PDF to PPT - Step 2 Metadata Only HTTP',
 'nodes':[
  node('Webhook','n8n-nodes-base.webhook',{'httpMethod':'POST','path':'pdf-to-ppt-save-metadata-http','responseMode':'responseNode','options':{}},[260,300],version=2),
  node('Prepare History Metadata','n8n-nodes-base.code',{'jsCode':prepare_history},[520,300],version=2),
  http_upload,
  node('Build Response','n8n-nodes-base.code',{'jsCode':final_response},[1080,300],version=2),
  node('Respond to Webhook','n8n-nodes-base.respondToWebhook',{'respondWith':'firstIncomingItem','options':{}},[1360,300],version=1.4),
 ],
 'connections':{
  'Webhook':{'main':[[{'node':'Prepare History Metadata','type':'main','index':0}]]},
  'Prepare History Metadata':{'main':[[{'node':'Upload History Metadata','type':'main','index':0}]]},
  'Upload History Metadata':{'main':[[{'node':'Build Response','type':'main','index':0}]]},
  'Build Response':{'main':[[{'node':'Respond to Webhook','type':'main','index':0}]]},
 },
 'settings':{'executionOrder':'v1'},
 'staticData':None,
}
(BASE/'n8n-step2-metadata-only-http.json').write_text(json.dumps(wf, indent=2))
