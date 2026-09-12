import json, pathlib, uuid

BASE = pathlib.Path('/root/.openclaw/workspace/projects/pdf-to-ppt-tool-ui')
CRED = {"id": "DhbnuEMEaJjJewJ3", "name": "PDF to PPT Google Drive OAuth Full Scope"}
UPLOADS = '1k58M7jIVPSTszWQpI-s9Ia3N9NxImX9m'
HISTORY = '1Af1vO4a-8sec1_ou1evm_Q1YofC4Zj2o'


def node(name, type_, params, pos, credentials=None, version=2):
    data = {
        "parameters": params,
        "id": str(uuid.uuid4()),
        "name": name,
        "type": type_,
        "typeVersion": version,
        "position": pos,
    }
    if type_ == 'n8n-nodes-base.webhook':
        data['webhookId'] = str(uuid.uuid4())
    if credentials:
        data['credentials'] = credentials
    return data

prepare_code = r"""
const item = $input.item;
const binaryKeys = Object.keys(item.binary || {});
if (binaryKeys.length === 0) {
  return [{ json: { ok: false, error: 'No PDF file received' } }];
}
const binaryProperty = binaryKeys.includes('file') ? 'file' : binaryKeys[0];
const binaryMeta = item.binary[binaryProperty];
const originalName = binaryMeta.fileName || `upload-${Date.now()}.pdf`;
if (!originalName.toLowerCase().endsWith('.pdf') && binaryMeta.mimeType !== 'application/pdf') {
  return [{ json: { ok: false, error: 'Only PDF files are supported' } }];
}
const uploadedAt = new Date().toISOString();
const jobId = `pdf-ppt-${uploadedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
return [{
  json: {
    ok: true,
    job_id: jobId,
    file_name: originalName,
    uploaded_at: uploadedAt,
    upload_name: `${jobId}__${originalName}`,
  },
  binary: { file: item.binary[binaryProperty] },
}];
""".strip()

history_binary_code = r"""
const helpers = this.helpers;
const uploaded = $input.item.json;
const prepared = $('Prepare Job').item.json;
const history = {
  job_id: prepared.job_id,
  file_name: prepared.file_name,
  status: 'uploaded',
  uploaded_at: prepared.uploaded_at,
  drive_file_id: uploaded.id,
  drive_file_url: uploaded.webViewLink || uploaded.webContentLink,
  source: 'nextjs-ui-to-n8n',
  step: 'step_1_upload_pipeline',
};
const historyName = `${history.job_id}.json`;
const binary = await helpers.prepareBinaryData(Buffer.from(JSON.stringify(history, null, 2), 'utf8'), historyName, 'application/json');
return [{ json: { ok: true, job: history, history_name: historyName }, binary: { file: binary } }];
""".strip()

final_response_code = r"""
const job = $('Create History Binary').item.json.job;
const historyUpload = $input.item.json;
job.history_file_id = historyUpload.id;
job.history_file_url = historyUpload.webViewLink || historyUpload.webContentLink;
return [{ json: { ok: true, job } }];
""".strip()

history_response_code = r"""
const helpers = this.helpers;
const items = $input.all();
const history = [];
for (let i = 0; i < items.length; i++) {
  try {
    const buffer = await helpers.getBinaryDataBuffer(i, 'file');
    const record = JSON.parse(buffer.toString('utf8'));
    const fileJson = items[i].json || {};
    history.push({ ...record, history_file_id: fileJson.id, history_file_url: fileJson.webViewLink });
  } catch (error) {}
}
history.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
return [{ json: { ok: true, history } }];
""".strip()


def drive_upload_node(name, folder_id, file_name_expr):
    return node(name, 'n8n-nodes-base.googleDrive', {
        'authentication': 'oAuth2',
        'resource': 'file',
        'operation': 'upload',
        'inputDataFieldName': 'file',
        'name': file_name_expr,
        'driveId': {'mode': 'list', 'value': 'My Drive'},
        'folderId': {'mode': 'id', 'value': folder_id},
        'options': {'simplifyOutput': False},
    }, [0, 0], {'googleDriveOAuth2Api': CRED}, version=3)

# Upload workflow
upload_nodes = [
    node('Webhook', 'n8n-nodes-base.webhook', {'httpMethod': 'POST', 'path': 'pdf-to-ppt-upload-native2', 'responseMode': 'responseNode', 'options': {'binaryPropertyName': 'file'}}, [260, 300], version=2),
    node('Prepare Job', 'n8n-nodes-base.code', {'jsCode': prepare_code}, [500, 300], version=2),
    drive_upload_node('Upload PDF to Drive', UPLOADS, '={{ $json.upload_name }}'),
    node('Create History Binary', 'n8n-nodes-base.code', {'jsCode': history_binary_code}, [980, 300], version=2),
    drive_upload_node('Upload History to Drive', HISTORY, '={{ $json.history_name }}'),
    node('Build Response', 'n8n-nodes-base.code', {'jsCode': final_response_code}, [1460, 300], version=2),
    node('Respond to Webhook', 'n8n-nodes-base.respondToWebhook', {'respondWith': 'firstIncomingItem', 'options': {}}, [1700, 300], version=1.4),
]
upload_nodes[2]['position'] = [740, 300]
upload_nodes[4]['position'] = [1220, 300]
upload_wf = {
    'name': 'PDF to PPT - Step 1 Upload Native2',
    'nodes': upload_nodes,
    'connections': {
        'Webhook': {'main': [[{'node': 'Prepare Job', 'type': 'main', 'index': 0}]]},
        'Prepare Job': {'main': [[{'node': 'Upload PDF to Drive', 'type': 'main', 'index': 0}]]},
        'Upload PDF to Drive': {'main': [[{'node': 'Create History Binary', 'type': 'main', 'index': 0}]]},
        'Create History Binary': {'main': [[{'node': 'Upload History to Drive', 'type': 'main', 'index': 0}]]},
        'Upload History to Drive': {'main': [[{'node': 'Build Response', 'type': 'main', 'index': 0}]]},
        'Build Response': {'main': [[{'node': 'Respond to Webhook', 'type': 'main', 'index': 0}]]},
    },
    'settings': {'executionOrder': 'v1'},
    'staticData': None,
}

# History workflow
history_nodes = [
    node('Webhook', 'n8n-nodes-base.webhook', {'httpMethod': 'GET', 'path': 'pdf-to-ppt-history-native2', 'responseMode': 'responseNode', 'options': {}}, [260, 300], version=2),
    node('Search History Files', 'n8n-nodes-base.googleDrive', {
        'authentication': 'oAuth2',
        'resource': 'fileFolder',
        'operation': 'search',
        'searchMethod': 'query',
        'queryString': f"'{HISTORY}' in parents and trashed = false and name contains '.json'",
        'returnAll': False,
        'limit': 50,
        'filter': {},
        'options': {'fields': ['id', 'name', 'webViewLink', 'createdTime']},
    }, [500, 300], {'googleDriveOAuth2Api': CRED}, version=3),
    node('Download History JSON', 'n8n-nodes-base.googleDrive', {
        'authentication': 'oAuth2',
        'resource': 'file',
        'operation': 'download',
        'fileId': {'mode': 'id', 'value': '={{ $json.id }}'},
        'options': {'binaryPropertyName': 'file'},
    }, [740, 300], {'googleDriveOAuth2Api': CRED}, version=3),
    node('Build History Response', 'n8n-nodes-base.code', {'jsCode': history_response_code}, [980, 300], version=2),
    node('Respond to Webhook', 'n8n-nodes-base.respondToWebhook', {'respondWith': 'firstIncomingItem', 'options': {}}, [1220, 300], version=1.4),
]
history_wf = {
    'name': 'PDF to PPT - Step 1 History Native2',
    'nodes': history_nodes,
    'connections': {
        'Webhook': {'main': [[{'node': 'Search History Files', 'type': 'main', 'index': 0}]]},
        'Search History Files': {'main': [[{'node': 'Download History JSON', 'type': 'main', 'index': 0}]]},
        'Download History JSON': {'main': [[{'node': 'Build History Response', 'type': 'main', 'index': 0}]]},
        'Build History Response': {'main': [[{'node': 'Respond to Webhook', 'type': 'main', 'index': 0}]]},
    },
    'settings': {'executionOrder': 'v1'},
    'staticData': None,
}

(BASE / 'n8n-upload-native.json').write_text(json.dumps(upload_wf, indent=2))
(BASE / 'n8n-history-native.json').write_text(json.dumps(history_wf, indent=2))
