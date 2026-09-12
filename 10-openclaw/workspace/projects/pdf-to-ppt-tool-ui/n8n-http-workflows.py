import json, pathlib, uuid
BASE = pathlib.Path('/root/.openclaw/workspace/projects/pdf-to-ppt-tool-ui')
CRED = {"id": "DhbnuEMEaJjJewJ3", "name": "PDF to PPT Google Drive OAuth Full Scope"}
UPLOADS = '1k58M7jIVPSTszWQpI-s9Ia3N9NxImX9m'
HISTORY = '1Af1vO4a-8sec1_ou1evm_Q1YofC4Zj2o'

def node(name, type_, params, pos, credentials=None, version=2):
    data={"parameters":params,"id":str(uuid.uuid4()),"name":name,"type":type_,"typeVersion":version,"position":pos}
    if type_=='n8n-nodes-base.webhook': data['webhookId']=str(uuid.uuid4())
    if credentials: data['credentials']=credentials
    return data

prepare_upload = r"""
const helpers = this.helpers;
const item = $input.item;
const binaryKeys = Object.keys(item.binary || {});
if (binaryKeys.length === 0) return [{ json: { ok: false, error: 'No PDF file received' } }];
const binaryProperty = binaryKeys.includes('file') ? 'file' : binaryKeys[0];
const binaryMeta = item.binary[binaryProperty];
const originalName = binaryMeta.fileName || `upload-${Date.now()}.pdf`;
if (!originalName.toLowerCase().endsWith('.pdf') && binaryMeta.mimeType !== 'application/pdf') return [{ json: { ok: false, error: 'Only PDF files are supported' } }];
const uploadedAt = new Date().toISOString();
const jobId = `pdf-ppt-${uploadedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
const uploadName = `${jobId}__${originalName}`;
const boundary = `pdf_to_ppt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const fileBuffer = await helpers.getBinaryDataBuffer(0, binaryProperty);
const body = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
  Buffer.from(JSON.stringify({ name: uploadName, parents: ['__UPLOADS__'] })),
  Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${binaryMeta.mimeType || 'application/pdf'}\r\n\r\n`),
  fileBuffer,
  Buffer.from(`\r\n--${boundary}--`),
]);
const binary = await helpers.prepareBinaryData(body, 'multipart-upload-body.bin', 'application/octet-stream');
return [{ json: { ok: true, job_id: jobId, file_name: originalName, uploaded_at: uploadedAt, upload_name: uploadName, content_type: `multipart/related; boundary=${boundary}` }, binary: { body: binary } }];
""".replace('__UPLOADS__', UPLOADS).strip()

prepare_history = r"""
const helpers = this.helpers;
const pdfUpload = $input.item.json;
const prepared = $('Prepare PDF Multipart').item.json;
const history = {
  job_id: prepared.job_id,
  file_name: prepared.file_name,
  status: 'uploaded',
  uploaded_at: prepared.uploaded_at,
  drive_file_id: pdfUpload.id,
  drive_file_url: pdfUpload.webViewLink || pdfUpload.webContentLink,
  source: 'nextjs-ui-to-n8n',
  step: 'step_1_upload_pipeline',
};
const historyName = `${history.job_id}.json`;
const boundary = `pdf_to_ppt_history_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const body = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
  Buffer.from(JSON.stringify({ name: historyName, parents: ['__HISTORY__'] })),
  Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
  Buffer.from(JSON.stringify(history, null, 2), 'utf8'),
  Buffer.from(`\r\n--${boundary}--`),
]);
const binary = await helpers.prepareBinaryData(body, 'multipart-history-body.bin', 'application/octet-stream');
return [{ json: { ok: true, job: history, history_name: historyName, content_type: `multipart/related; boundary=${boundary}` }, binary: { body: binary } }];
""".replace('__HISTORY__', HISTORY).strip()

final_response = r"""
const job = $('Prepare History Multipart').item.json.job;
const historyUpload = $input.item.json;
job.history_file_id = historyUpload.id;
job.history_file_url = historyUpload.webViewLink || historyUpload.webContentLink;
return [{ json: { ok: true, job } }];
""".strip()

history_items = r"""
const files = $input.item.json.files || [];
return files.map(file => ({ json: file }));
""".strip()

history_response = r"""
const items = $input.all();
const history = [];
for (const item of items) {
  if (item.json && item.json.job_id) history.push(item.json);
}
history.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
return [{ json: { ok: true, history } }];
""".strip()

def http_request(name, method, url, pos, content_type_expr=None, input_field=None, response_format='json', query=None):
    params={'method':method,'url':url,'authentication':'predefinedCredentialType','nodeCredentialType':'googleDriveOAuth2Api','sendQuery': bool(query),'sendHeaders': bool(content_type_expr),'options': {'response': {'response': {'responseFormat': response_format}}}}
    if query:
        params['specifyQuery']='keypair'; params['queryParameters']={'parameters': [{'name':k,'value':v} for k,v in query]}
    if content_type_expr:
        params['specifyHeaders']='keypair'; params['headerParameters']={'parameters':[{'name':'Content-Type','value':content_type_expr}]}
    if input_field:
        params['sendBody']=True; params['contentType']='binaryData'; params['inputDataFieldName']=input_field
    return node(name,'n8n-nodes-base.httpRequest',params,pos, {'googleDriveOAuth2Api': CRED}, version=4.2)

upload_wf={
 'name':'PDF to PPT - Step 1 Upload HTTP',
 'nodes':[
   node('Webhook','n8n-nodes-base.webhook',{'httpMethod':'POST','path':'pdf-to-ppt-upload-http','responseMode':'responseNode','options':{'binaryPropertyName':'file'}},[260,300],version=2),
   node('Prepare PDF Multipart','n8n-nodes-base.code',{'jsCode':prepare_upload},[500,300],version=2),
   http_request('Upload PDF to Drive','POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime',[760,300],'={{ $json.content_type }}','body'),
   node('Prepare History Multipart','n8n-nodes-base.code',{'jsCode':prepare_history},[1020,300],version=2),
   http_request('Upload History to Drive','POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime',[1280,300],'={{ $json.content_type }}','body'),
   node('Build Response','n8n-nodes-base.code',{'jsCode':final_response},[1540,300],version=2),
   node('Respond to Webhook','n8n-nodes-base.respondToWebhook',{'respondWith':'firstIncomingItem','options':{}},[1800,300],version=1.4),
 ],
 'connections':{
  'Webhook':{'main':[[{'node':'Prepare PDF Multipart','type':'main','index':0}]]},
  'Prepare PDF Multipart':{'main':[[{'node':'Upload PDF to Drive','type':'main','index':0}]]},
  'Upload PDF to Drive':{'main':[[{'node':'Prepare History Multipart','type':'main','index':0}]]},
  'Prepare History Multipart':{'main':[[{'node':'Upload History to Drive','type':'main','index':0}]]},
  'Upload History to Drive':{'main':[[{'node':'Build Response','type':'main','index':0}]]},
  'Build Response':{'main':[[{'node':'Respond to Webhook','type':'main','index':0}]]},
 }, 'settings':{'executionOrder':'v1'}, 'staticData':None}

history_wf={
 'name':'PDF to PPT - Step 1 History HTTP',
 'nodes':[
  node('Webhook','n8n-nodes-base.webhook',{'httpMethod':'GET','path':'pdf-to-ppt-history-http','responseMode':'responseNode','options':{}},[260,300],version=2),
  http_request('List History Files','GET','https://www.googleapis.com/drive/v3/files',[500,300],query=[('q',f"'{HISTORY}' in parents and trashed = false and name contains '.json'"),('fields','files(id,name,webViewLink,createdTime)'),('orderBy','createdTime desc'),('pageSize','50')]),
  node('Build File Items','n8n-nodes-base.code',{'jsCode':history_items},[760,300],version=2),
  http_request('Download History JSON','GET','=https://www.googleapis.com/drive/v3/files/{{ $json.id }}?alt=media',[1020,300],response_format='json'),
  node('Build History Response','n8n-nodes-base.code',{'jsCode':history_response},[1280,300],version=2),
  node('Respond to Webhook','n8n-nodes-base.respondToWebhook',{'respondWith':'firstIncomingItem','options':{}},[1540,300],version=1.4),
 ],
 'connections':{
  'Webhook':{'main':[[{'node':'List History Files','type':'main','index':0}]]},
  'List History Files':{'main':[[{'node':'Build File Items','type':'main','index':0}]]},
  'Build File Items':{'main':[[{'node':'Download History JSON','type':'main','index':0}]]},
  'Download History JSON':{'main':[[{'node':'Build History Response','type':'main','index':0}]]},
  'Build History Response':{'main':[[{'node':'Respond to Webhook','type':'main','index':0}]]},
 }, 'settings':{'executionOrder':'v1'}, 'staticData':None}

(BASE/'n8n-upload-http.json').write_text(json.dumps(upload_wf, indent=2))
(BASE/'n8n-history-http.json').write_text(json.dumps(history_wf, indent=2))
