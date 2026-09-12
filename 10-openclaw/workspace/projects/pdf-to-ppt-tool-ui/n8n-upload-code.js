const UPLOADS_FOLDER_ID = '1k58M7jIVPSTszWQpI-s9Ia3N9NxImX9m';
const HISTORY_FOLDER_ID = '1Af1vO4a-8sec1_ou1evm_Q1YofC4Zj2o';

const helpers = this.helpers;

function requiredEnv(name) {
  const value = $env[name];
  if (!value) throw new Error(`${name} is missing in n8n environment`);
  return value;
}

async function getAccessToken() {
  const payload = await helpers.httpRequest({
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: [
      ['client_id', requiredEnv('GOOGLE_OAUTH_CLIENT_ID')],
      ['client_secret', requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET')],
      ['refresh_token', requiredEnv('GOOGLE_OAUTH_REFRESH_TOKEN')],
      ['grant_type', 'refresh_token'],
    ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'),
    json: true,
  });
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
  return await helpers.httpRequest({
    method: 'POST',
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
    json: true,
  });
}

const item = $input.item;
const binaryKeys = Object.keys(item.binary || {});
if (binaryKeys.length === 0) {
  return [{ json: { ok: false, error: 'No PDF file received' } }];
}

const binaryProperty = binaryKeys.includes('file') ? 'file' : binaryKeys[0];
const binaryMeta = item.binary[binaryProperty];
const originalName = binaryMeta.fileName || item.json?.body?.fileName || `upload-${Date.now()}.pdf`;

if (!originalName.toLowerCase().endsWith('.pdf') && binaryMeta.mimeType !== 'application/pdf') {
  return [{ json: { ok: false, error: 'Only PDF files are supported' } }];
}

const uploadedAt = new Date().toISOString();
const jobId = `pdf-ppt-${uploadedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
const fileBuffer = await helpers.getBinaryDataBuffer(0, binaryProperty);
const accessToken = await getAccessToken();

const pdfFile = await uploadToDrive({
  accessToken,
  name: `${jobId}__${originalName}`,
  parentId: UPLOADS_FOLDER_ID,
  buffer: fileBuffer,
  mimeType: binaryMeta.mimeType || 'application/pdf',
});

const history = {
  job_id: jobId,
  file_name: originalName,
  status: 'uploaded',
  uploaded_at: uploadedAt,
  drive_file_id: pdfFile.id,
  drive_file_url: pdfFile.webViewLink,
  source: 'nextjs-ui-to-n8n',
  step: 'step_1_upload_pipeline',
};

const historyFile = await uploadToDrive({
  accessToken,
  name: `${jobId}.json`,
  parentId: HISTORY_FOLDER_ID,
  buffer: Buffer.from(JSON.stringify(history, null, 2), 'utf8'),
  mimeType: 'application/json',
});

history.history_file_id = historyFile.id;
history.history_file_url = historyFile.webViewLink;

return [{ json: { ok: true, job: history } }];
