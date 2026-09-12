import json, uuid
from pathlib import Path
FINAL_FOLDER='1yxxMEjUt6gNky3SWzGnTxYxoo64LehB_'
def nid(): return str(uuid.uuid4())[:8]
workflow_name='PDF to PPT - Runtime Test V1'
ids={k:nid() for k in ['webhook','validate','write','exec','parse','read','upload','respond']}
common_env='PPT_WORKSPACE=/var/lib/n8n/pdf_to_ppt_backend/workspace PPT_PIPELINE_BASE=/var/lib/n8n/pdf_to_ppt_backend/workspace/ppt_pipeline PPT_LIBRARY_BASE=/var/lib/n8n/pdf_to_ppt_backend/workspace/ppt_library PPT_ENV_FILE=/var/lib/n8n/pdf_to_ppt_backend/workspace/.env PPT_PLANNER_MODEL=openai/gpt-4o-mini'
upload_js=f"""
const FINAL_FOLDER_ID = '{FINAL_FOLDER}';
function requiredEnv(name) {{
  const value = process.env[name];
  if (!value) throw new Error(`${{name}} is missing in n8n environment`);
  return value;
}}
async function getAccessToken() {{
  const response = await fetch('https://oauth2.googleapis.com/token', {{
    method: 'POST',
    headers: {{ 'Content-Type': 'application/x-www-form-urlencoded' }},
    body: new URLSearchParams({{
      client_id: requiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token: requiredEnv('GOOGLE_OAUTH_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }}),
  }});
  const payload = await response.json();
  if (!response.ok) throw new Error(`Google token failed: ${{JSON.stringify(payload)}}`);
  return payload.access_token;
}}
function multipartBody(metadata, fileBuffer, mimeType) {{
  const boundary = `pdf_to_ppt_${{Date.now()}}_${{Math.random().toString(16).slice(2)}}`;
  const delimiter = `--${{boundary}}\\r\\n`;
  const close = `\\r\\n--${{boundary}}--`;
  const body = Buffer.concat([
    Buffer.from(delimiter),
    Buffer.from('Content-Type: application/json; charset=UTF-8\\r\\n\\r\\n'),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from('\\r\\n'),
    Buffer.from(delimiter),
    Buffer.from(`Content-Type: ${{mimeType}}\\r\\n\\r\\n`),
    Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer),
    Buffer.from(close),
  ]);
  return {{ boundary, body }};
}}
async function uploadToDrive({{ accessToken, name, parentId, buffer, mimeType }}) {{
  const {{ boundary, body }} = multipartBody({{ name, parents: [parentId] }}, buffer, mimeType);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime', {{
    method: 'POST',
    headers: {{ Authorization: `Bearer ${{accessToken}}`, 'Content-Type': `multipart/related; boundary=${{boundary}}` }},
    body,
  }});
  const payload = await response.json();
  if (!response.ok) throw new Error(`Drive upload failed: ${{JSON.stringify(payload)}}`);
  return payload;
}}
const item = $input.item;
const buffer = await this.helpers.getBinaryDataBuffer(0, 'final_pptx');
const accessToken = await getAccessToken();
const safeProject = (item.json.project_name || 'presentation').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
const fileName = `${{item.json.run_id}}__${{safeProject}}.pptx`;
const pptxFile = await uploadToDrive({{
  accessToken,
  name: fileName,
  parentId: FINAL_FOLDER_ID,
  buffer,
  mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}});
return [{{ json: {{ success: true, run_id: item.json.run_id, provider: item.json.planner?.provider, slide_count: item.json.builder?.slide_count, validation_valid: item.json.validation?.valid, final_ppt_drive_id: pptxFile.id, final_ppt_link: pptxFile.webViewLink, final_ppt_file: pptxFile.name }} }}];
""".strip()
workflow={
 'name': workflow_name,
 'nodes':[
  {'parameters':{'httpMethod':'POST','path':'pdf-to-ppt-generate-v2','responseMode':'responseNode','options':{}},'id':ids['webhook'],'name':'Webhook - PDF Upload','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[-900,0]},
  {'parameters':{'jsCode':"""const body = $json.body || $json || {};
const binaryKeys = Object.keys($binary || {});
if (!binaryKeys.length) throw new Error('No PDF file uploaded');
const key = binaryKeys.includes('pdf_file') ? 'pdf_file' : (binaryKeys.includes('file') ? 'file' : binaryKeys[0]);
const meta = $binary[key];
const fileName = meta.fileName || body.fileName || 'uploaded.pdf';
if (!fileName.toLowerCase().endsWith('.pdf') && meta.mimeType !== 'application/pdf') throw new Error('Uploaded file must be PDF');
const runId = 'pdf_to_ppt_' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14) + '_' + Math.random().toString(36).slice(2,7);
return [{ json: { run_id: runId, project_name: body.project_name || 'PDF to PPT Project', target_slide_count: Number(body.target_slide_count || 10), binary_key: key, original_file_name: fileName, local_pdf_path: `/tmp/${runId}.pdf` }, binary: $binary }];"""},'id':ids['validate'],'name':'Validate Upload Config','type':'n8n-nodes-base.code','typeVersion':2,'position':[-680,0]},
  {'parameters':{'fileName':'={{$json.local_pdf_path}}','dataPropertyName':'={{$json.binary_key}}','options':{}},'id':ids['write'],'name':'Write PDF To Temp','type':'n8n-nodes-base.writeBinaryFile','typeVersion':1,'position':[-460,0]},
  {'parameters':{'command':f'{common_env} /var/lib/n8n/pdf_to_ppt_backend/.venv-ppt/bin/python /var/lib/n8n/pdf_to_ppt_backend/workspace/ppt_pipeline/scripts/run_ai_pipeline.py "{{$json.local_pdf_path}}"','options':{}},'id':ids['exec'],'name':'Run Backend Pipeline','type':'n8n-nodes-base.executeCommand','typeVersion':1,'position':[-220,0]},
  {'parameters':{'jsCode':"""const output = $json.stdout || '';
let parsed;
try { parsed = JSON.parse(output); } catch (e) { throw new Error('Backend did not return valid JSON: ' + output.slice(0, 800)); }
if (!parsed.success) throw new Error('Backend pipeline failed');
return [{ json: parsed }];"""},'id':ids['parse'],'name':'Parse Pipeline Result','type':'n8n-nodes-base.code','typeVersion':2,'position':[20,0]},
  {'parameters':{'filePath':'={{$json.final_pptx}}','dataPropertyName':'final_pptx'},'id':ids['read'],'name':'Read Final PPTX','type':'n8n-nodes-base.readBinaryFile','typeVersion':1,'position':[260,0]},
  {'parameters':{'jsCode':upload_js},'id':ids['upload'],'name':'Upload Final PPTX To Drive','type':'n8n-nodes-base.code','typeVersion':2,'position':[500,0]},
  {'parameters':{'respondWith':'json','responseBody':'={{$json}}'},'id':ids['respond'],'name':'Respond With PPTX Link','type':'n8n-nodes-base.respondToWebhook','typeVersion':1,'position':[740,0]},
 ],
 'connections':{
   'Webhook - PDF Upload':{'main':[[{'node':'Validate Upload Config','type':'main','index':0}]]},
   'Validate Upload Config':{'main':[[{'node':'Write PDF To Temp','type':'main','index':0}]]},
   'Write PDF To Temp':{'main':[[{'node':'Run Backend Pipeline','type':'main','index':0}]]},
   'Run Backend Pipeline':{'main':[[{'node':'Parse Pipeline Result','type':'main','index':0}]]},
   'Parse Pipeline Result':{'main':[[{'node':'Read Final PPTX','type':'main','index':0}]]},
   'Read Final PPTX':{'main':[[{'node':'Upload Final PPTX To Drive','type':'main','index':0}]]},
   'Upload Final PPTX To Drive':{'main':[[{'node':'Respond With PPTX Link','type':'main','index':0}]]},
 },
 'settings':{'executionOrder':'v1','saveExecutionProgress':True,'saveManualExecutions':True},
 'active':False,
 'pinData':{},
 'tags':[{'name':'pdf-to-ppt'},{'name':'runtime-test'}],
}
out=Path('/root/.openclaw/workspace/ppt_pipeline/n8n_pdf_to_ppt_runtime_test_v1.json')
out.write_text(json.dumps(workflow, indent=2), encoding='utf-8')
print(out)
