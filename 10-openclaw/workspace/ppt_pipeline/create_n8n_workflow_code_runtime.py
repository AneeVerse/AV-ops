import json, random, string
from pathlib import Path
wid='PDF2PPTCODE' + ''.join(random.choice(string.ascii_letters+string.digits) for _ in range(8))
code = r'''
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('\"') && val.endsWith('\"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}
const n8nEnv = parseEnvFile('/etc/n8n/n8n.env');

const FINAL_FOLDER_ID = '1yxxMEjUt6gNky3SWzGnTxYxoo64LehB_';
const body = $json.body || $json || {};
const binaryKeys = Object.keys($binary || {});
if (!binaryKeys.length) throw new Error('No PDF file uploaded');
const key = binaryKeys.includes('pdf_file') ? 'pdf_file' : (binaryKeys.includes('file') ? 'file' : binaryKeys[0]);
const meta = $binary[key];
const originalName = meta.fileName || body.fileName || 'uploaded.pdf';
if (!originalName.toLowerCase().endsWith('.pdf') && meta.mimeType !== 'application/pdf') throw new Error('Uploaded file must be PDF');

const runId = 'pdf_to_ppt_' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14) + '_' + Math.random().toString(36).slice(2,7);
const uploadDir = '/var/lib/n8n/pdf_to_ppt_backend/uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const localPdf = path.join(uploadDir, `${runId}.pdf`);
const pdfBuffer = await this.helpers.getBinaryDataBuffer(0, key);
fs.writeFileSync(localPdf, pdfBuffer);

const env = {
  PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
  HOME: '/var/lib/n8n',
  PPT_WORKSPACE: '/var/lib/n8n/pdf_to_ppt_backend/workspace',
  PPT_PIPELINE_BASE: '/var/lib/n8n/pdf_to_ppt_backend/workspace/ppt_pipeline',
  PPT_LIBRARY_BASE: '/var/lib/n8n/pdf_to_ppt_backend/workspace/ppt_library',
  PPT_ENV_FILE: '/var/lib/n8n/pdf_to_ppt_backend/workspace/.env',
  PPT_PLANNER_MODEL: 'openai/gpt-4o-mini',
};
const py = '/var/lib/n8n/pdf_to_ppt_backend/.venv-ppt/bin/python';
const script = '/var/lib/n8n/pdf_to_ppt_backend/workspace/ppt_pipeline/scripts/run_ai_pipeline.py';
const proc = spawnSync(py, [script, localPdf], { env, encoding: 'utf8', timeout: 900000, maxBuffer: 1024 * 1024 * 80 });
if (proc.error) throw proc.error;
if (proc.status !== 0) throw new Error(`Backend failed (${proc.status}): ${proc.stderr || proc.stdout}`);
let parsed;
try { parsed = JSON.parse(proc.stdout); } catch (e) { throw new Error('Backend did not return JSON: ' + proc.stdout.slice(0, 1000)); }
if (!parsed.success) throw new Error('Backend returned success=false');
if (!fs.existsSync(parsed.final_pptx)) throw new Error('Final PPTX missing: ' + parsed.final_pptx);

function requiredEnv(name) {
  const value = $env[name];
  if (!value) throw new Error(`${name} is missing in n8n environment`);
  return value;
}
async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token: requiredEnv('GOOGLE_OAUTH_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Google token failed: ${JSON.stringify(payload)}`);
  return payload.access_token;
}
function multipartBody(metadata, fileBuffer, mimeType) {
  const boundary = `pdf_to_ppt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const delimiter = `--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(delimiter),
    Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from('\r\n'),
    Buffer.from(delimiter),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer),
    Buffer.from(close),
  ]);
  return { boundary, body };
}
async function uploadToDrive({ accessToken, name, parentId, buffer, mimeType }) {
  const { boundary, body } = multipartBody({ name, parents: [parentId] }, buffer, mimeType);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Drive upload failed: ${JSON.stringify(payload)}`);
  return payload;
}
const accessToken = await getAccessToken();
const safeProject = (body.project_name || 'presentation').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
const finalBuffer = fs.readFileSync(parsed.final_pptx);
const pptxFile = await uploadToDrive({
  accessToken,
  name: `${runId}__${safeProject}.pptx`,
  parentId: FINAL_FOLDER_ID,
  buffer: finalBuffer,
  mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});
return [{ json: { success: true, run_id: runId, original_file_name: originalName, provider: parsed.planner?.provider, pdf_pages: parsed.extraction?.page_count, text_chars: parsed.extraction?.text_char_count, chunks: parsed.extraction?.chunk_count, slide_count: parsed.builder?.slide_count, validation_valid: parsed.validation?.valid, validation_issues: parsed.validation?.issues?.length || 0, final_ppt_drive_id: pptxFile.id, final_ppt_link: pptxFile.webViewLink, final_ppt_file: pptxFile.name } }];
'''.strip()
workflow={
 'id': wid,
 'name':'PDF to PPT - Code Runtime V3',
 'nodes':[
  {'parameters':{'httpMethod':'POST','path':'pdf-to-ppt-generate-code-v3','responseMode':'responseNode','options':{}},'id':'webhook','name':'Webhook','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[-500,0]},
  {'parameters':{'jsCode':code},'id':'runner','name':'Run Pipeline And Upload','type':'n8n-nodes-base.code','typeVersion':2,'position':[-220,0]},
  {'parameters':{'respondWith':'json','responseBody':'={{$json}}'},'id':'respond','name':'Respond With PPTX Link','type':'n8n-nodes-base.respondToWebhook','typeVersion':1,'position':[60,0]},
 ],
 'connections':{
  'Webhook':{'main':[[{'node':'Run Pipeline And Upload','type':'main','index':0}]]},
  'Run Pipeline And Upload':{'main':[[{'node':'Respond With PPTX Link','type':'main','index':0}]]},
 },
 'settings':{'executionOrder':'v1','saveExecutionProgress':True,'saveManualExecutions':True},
 'active':False,
 'pinData':{},
 'tags':[{'name':'pdf-to-ppt'},{'name':'runtime-code'}],
}
out=Path('/root/.openclaw/workspace/ppt_pipeline/n8n_pdf_to_ppt_code_runtime_v1.json')
out.write_text(json.dumps(workflow, indent=2), encoding='utf-8')
print(wid)
