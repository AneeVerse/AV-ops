const fs = require('fs')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).trim()]
    })
)

const N8N_API = env.N8N_API_URL.replace(/\/$/, '')
const N8N_KEY = env.N8N_API_KEY
const WF_ID = 'mSlCsDvjkPivv4cz'
const CLOUD = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'aprhnzmk'

async function main() {
  const wf = await fetch(`${N8N_API}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY },
  }).then((r) => r.json())

  for (const node of wf.nodes) {
    if (node.name === 'Upload Logo To Cloudinary') {
      node.continueOnFail = true
      console.log('continueOnFail set on Upload Logo')
    }
    if (node.name === 'Build Cloudinary Overlay URL') {
      node.parameters.jsCode = `const meta = $('Extract and Prepare Image').first().json;
const base = $('Upload Base To Cloudinary').first().json;

// No brand logo uploaded yet — return the base image as-is
if (!meta.logoUrl) {
  const fallback = base.secure_url || base.url;
  if (!fallback) throw new Error('Cloudinary base upload failed and no logo_url on brand');
  return [{ json: { finalImageUrl: fallback } }];
}

const logo = $('Upload Logo To Cloudinary').first().json;
const basePublicId = base.public_id;
const logoPublicId = (logo.public_id || '').replace(/\\//g, ':');

if (!basePublicId) throw new Error('Missing Cloudinary base image public_id');
if (!logoPublicId) throw new Error('Missing Cloudinary logo public_id — upload a brand logo on the Brands page');

const overlay = \`l_\${logoPublicId},w_220/fl_layer_apply,g_north_west,x_40,y_40\`;
const finalUrl = \`https://res.cloudinary.com/${CLOUD}/image/upload/\${overlay}/\${basePublicId}.png\`;

return [{ json: { finalImageUrl: finalUrl } }];`
      console.log('Build overlay updated for optional logo')
    }
  }

  const put = await fetch(`${N8N_API}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: { executionOrder: wf.settings?.executionOrder || 'v1' },
      staticData: wf.staticData ?? null,
    }),
  })
  console.log('PUT', put.status, (await put.text()).slice(0, 200))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
