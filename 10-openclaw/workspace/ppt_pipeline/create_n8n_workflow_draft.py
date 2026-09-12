import json, uuid
from pathlib import Path
ids={}
for line in Path('/root/.openclaw/workspace/ppt_pipeline/workflow_folder_ids.tsv').read_text().splitlines():
    name,id=line.split('\t'); ids[name]=id

def nid(): return str(uuid.uuid4())[:8]
webhook=nid(); validate=nid(); write_pdf=nid(); exec_pipeline=nid(); read_summary=nid(); upload_pptx=nid(); upload_log=nid(); respond=nid(); error=nid()
workflow={
  "name":"PDF to PPT Automation - Draft",
  "nodes":[
    {
      "parameters":{
        "httpMethod":"POST",
        "path":"pdf-to-ppt-generate",
        "responseMode":"responseNode",
        "options":{"binaryData": True}
      },
      "id":webhook,"name":"Webhook - PDF Upload","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[-900,0],
      "notes":"Next.js UI posts multipart/form-data here. Expected binary field: pdf_file. Optional fields: project_name, target_slide_count, tone, audience, user_notes."
    },
    {
      "parameters":{
        "jsCode": "const project = $json.project_name || 'PDF to PPT Project';\nconst target = Number($json.target_slide_count || 10);\nconst binaryKeys = Object.keys($binary || {});\nif (!binaryKeys.length) throw new Error('No PDF file uploaded');\nconst key = binaryKeys.includes('pdf_file') ? 'pdf_file' : binaryKeys[0];\nconst fileName = $binary[key].fileName || 'uploaded.pdf';\nif (!fileName.toLowerCase().endsWith('.pdf')) throw new Error('Uploaded file must be PDF');\nconst runId = 'pdf_to_ppt_' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);\nreturn [{ json: { run_id: runId, project_name: project, target_slide_count: target, binary_key: key, original_file_name: fileName }, binary: $binary }];"
      },
      "id":validate,"name":"Validate Upload Config","type":"n8n-nodes-base.code","typeVersion":2,"position":[-680,0],
      "notes":"Validates file/config and creates run_id. Allows large PDFs if n8n/server upload limit permits."
    },
    {
      "parameters":{
        "jsCode": "const fs = require('fs');\nconst path = require('path');\nconst runId = $json.run_id;\nconst key = $json.binary_key;\nconst dir = `/tmp/pdf_to_ppt/${runId}`;\nfs.mkdirSync(dir, { recursive: true });\nconst inputPath = path.join(dir, 'input.pdf');\nconst buf = await this.helpers.getBinaryDataBuffer(0, key);\nfs.writeFileSync(inputPath, buf);\nreturn [{ json: { ...$json, local_pdf_path: inputPath, local_run_dir: dir }, binary: $binary }];"
      },
      "id":write_pdf,"name":"Write PDF To Local Temp","type":"n8n-nodes-base.code","typeVersion":2,"position":[-460,0],
      "notes":"Stores uploaded PDF locally so the backend script can process it. Google Drive upload can be added here or after MVP verification."
    },
    {
      "parameters":{
        "command":"python3 /root/.openclaw/workspace/ppt_pipeline/scripts/run_ai_pipeline.py \"{{$json.local_pdf_path}}\"",
        "options":{}
      },
      "id":exec_pipeline,"name":"Run Backend Pipeline","type":"n8n-nodes-base.executeCommand","typeVersion":1,"position":[-220,0],
      "notes":"Runs extraction -> AI planner -> PPTX builder. Requires project files on same host as n8n. Uses OpenRouter key from .env."
    },
    {
      "parameters":{
        "jsCode":"const output = $json.stdout || $json.data || '';\nlet parsed;\ntry { parsed = JSON.parse(output); } catch (e) { throw new Error('Backend did not return valid JSON: ' + output.slice(0,500)); }\nif (!parsed.success) throw new Error('Backend pipeline failed');\nreturn [{ json: parsed }];"
      },
      "id":read_summary,"name":"Parse Pipeline Result","type":"n8n-nodes-base.code","typeVersion":2,"position":[20,0],
      "notes":"Parses backend JSON result. Contains final_pptx and run summary paths."
    },
    {
      "parameters":{
        "jsCode":"const fs = require('fs');\nconst pptxPath = $json.final_pptx;\nif (!fs.existsSync(pptxPath)) throw new Error('Final PPTX not found: ' + pptxPath);\nconst data = fs.readFileSync(pptxPath);\nreturn [{ json: $json, binary: { final_pptx: await this.helpers.prepareBinaryData(data, `${$json.run_id}_${($json.project_name || 'presentation').replace(/[^a-z0-9_-]+/gi,'_')}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation') } }];"
      },
      "id":upload_pptx,"name":"Prepare Final PPTX Binary","type":"n8n-nodes-base.code","typeVersion":2,"position":[260,0],
      "notes":"Prepares final PPTX for Google Drive upload. Next node should upload binary final_pptx to 10 Final PPT Outputs."
    },
    {
      "parameters":{
        "operation":"upload",
        "parents":[ids['10 Final PPT Outputs']],
        "binaryData":True,
        "binaryPropertyName":"final_pptx",
        "name":"={{$binary.final_pptx.fileName}}"
      },
      "id":upload_log,"name":"Upload Final PPTX To Drive","type":"n8n-nodes-base.googleDrive","typeVersion":3,"position":[500,0],
      "credentials":{"googleDriveOAuth2Api":{"id":"REPLACE_WITH_CREDENTIAL_ID","name":"Google Drive account"}},
      "notes":"Upload final PPTX to PDF to PPT / 10 Final PPT Outputs. Replace credential ID/name after import."
    },
    {
      "parameters":{
        "respondWith":"json",
        "responseBody":"={{ { success: true, run_id: $json.run_id, final_ppt_file: $json.name || $json.fileName, final_ppt_drive_id: $json.id, final_ppt_link: $json.webViewLink || $json.webContentLink } }}"
      },
      "id":respond,"name":"Respond With PPTX Link","type":"n8n-nodes-base.respondToWebhook","typeVersion":1,"position":[740,0],
      "notes":"Returns final PPTX link to Next.js UI."
    },
    {
      "parameters":{
        "respondWith":"json",
        "responseBody":"={{ { success: false, error: $json.error?.message || $json.message || 'Workflow failed' } }}",
        "options":{"responseCode":500}
      },
      "id":error,"name":"Error Response Placeholder","type":"n8n-nodes-base.respondToWebhook","typeVersion":1,"position":[20,260],
      "notes":"Connect this through n8n error workflow or explicit error branches during implementation."
    }
  ],
  "connections":{
    "Webhook - PDF Upload":{"main":[[{"node":"Validate Upload Config","type":"main","index":0}]]},
    "Validate Upload Config":{"main":[[{"node":"Write PDF To Local Temp","type":"main","index":0}]]},
    "Write PDF To Local Temp":{"main":[[{"node":"Run Backend Pipeline","type":"main","index":0}]]},
    "Run Backend Pipeline":{"main":[[{"node":"Parse Pipeline Result","type":"main","index":0}]]},
    "Parse Pipeline Result":{"main":[[{"node":"Prepare Final PPTX Binary","type":"main","index":0}]]},
    "Prepare Final PPTX Binary":{"main":[[{"node":"Upload Final PPTX To Drive","type":"main","index":0}]]},
    "Upload Final PPTX To Drive":{"main":[[{"node":"Respond With PPTX Link","type":"main","index":0}]]}
  },
  "settings":{"executionOrder":"v1","saveExecutionProgress":True,"saveManualExecutions":True},
  "staticData":{
    "driveFolderIds":ids,
    "notes":"Draft workflow. Replace Google Drive credentials after importing. For production, add Drive upload of source PDF, generated content, logs, and robust error workflow."
  },
  "pinData":{},
  "versionId":"draft-001",
  "active":False,
  "tags":[{"name":"pdf-to-ppt"},{"name":"draft"}]
}
out=Path('/root/.openclaw/workspace/ppt_pipeline/n8n_pdf_to_ppt_workflow_draft.json')
out.write_text(json.dumps(workflow, indent=2), encoding='utf-8')
print(out)
print('nodes', len(workflow['nodes']))
