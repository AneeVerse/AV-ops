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

const accessToken = await getAccessToken();
const q = `'${HISTORY_FOLDER_ID}' in parents and trashed = false and name contains '.json'`;
const listQuery = [
  ['q', q],
  ['fields', 'files(id,name,webViewLink,createdTime,modifiedTime)'],
  ['orderBy', 'createdTime desc'],
  ['pageSize', '50'],
].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');

const listPayload = await helpers.httpRequest({
  method: 'GET',
  url: `https://www.googleapis.com/drive/v3/files?${listQuery}`,
  headers: { Authorization: `Bearer ${accessToken}` },
  json: true,
});

const history = [];
for (const file of listPayload.files || []) {
  try {
    const record = await helpers.httpRequest({
      method: 'GET',
      url: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      headers: { Authorization: `Bearer ${accessToken}` },
      json: true,
    });
    history.push({ ...record, history_file_id: file.id, history_file_url: file.webViewLink });
  } catch {}
}

history.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());

return [{ json: { ok: true, history } }];
