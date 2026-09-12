/**
 * One-shot: rewrite n8n-workflows/*.json for ImageKit uploads + VPS Supabase REST.
 * Replaces Cloudinary / Supabase Storage; scrubs secrets to sync-script placeholders.
 *
 * Placeholders (substituted later by sync-n8n-workflows.js):
 *   __SUPABASE_URL__              e.g. https://supabase.aneeverse.com
 *   __SUPABASE_SERVICE_ROLE_KEY__
 *   __IMAGEKIT_BASIC_AUTH__       base64(privateKey + ':')  — used after "Basic "
 *   __IMAGEKIT_URL_ENDPOINT__     e.g. https://ik.imagekit.io/yjx5ozbrh
 *   __OPENAI_API_KEY__
 *
 * Run: node scripts/rewrite-n8n-workflows-imagekit.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'n8n-workflows')
const SB = '__SUPABASE_URL__'
const SB_KEY = '__SUPABASE_SERVICE_ROLE_KEY__'
const IK_AUTH = '__IMAGEKIT_BASIC_AUTH__'
const IK_EP = '__IMAGEKIT_URL_ENDPOINT__'
const OAI = '__OPENAI_API_KEY__'

const OLD_HOSTS = [
  'dhmjgwwqlttndjamrisv.supabase.co',
  'kjrpcysqaxkhnynfoiks.supabase.co',
  'dbafcxmnbjadnxgbqaka.supabase.co',
]

function walkJsonFiles(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) out.push(...walkJsonFiles(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

/** Code-node upload — n8n HTTP Request multipart is unreliable with binaryMode=separate. */
function imageKitUploadCode({ folder = '/generated-posts' } = {}) {
  return `const item = $input.first();
const meta = item.json;
const mime = (item.binary && item.binary.data && item.binary.data.mimeType) || 'image/png';
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const fileName = (meta.storagePath || meta.fileName || ('upload-' + Date.now() + '.png')).toString().split('/').pop();
const dataUrl = 'data:' + mime + ';base64,' + buffer.toString('base64');

const boundary = '----n8nIkBoundary' + Date.now().toString(36);
const parts = [];
function addField(name, value) {
  parts.push(
    '--' + boundary + '\\r\\n' +
    'Content-Disposition: form-data; name=\"' + name + '\"\\r\\n\\r\\n' +
    value + '\\r\\n'
  );
}
addField('file', dataUrl);
addField('fileName', fileName);
addField('folder', '${folder}');
addField('useUniqueFileName', 'true');
parts.push('--' + boundary + '--\\r\\n');
const body = parts.join('');

let uploaded;
try {
  uploaded = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://upload.imagekit.io/api/v1/files/upload',
    headers: {
      Authorization: 'Basic ${IK_AUTH}',
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    },
    body,
    timeout: 120000,
  });
} catch (err) {
  throw new Error('ImageKit httpRequest failed: ' + (err.message || String(err)));
}

if (typeof uploaded === 'string') {
  try { uploaded = JSON.parse(uploaded); } catch (_) {}
}
if (!uploaded || !uploaded.url) {
  throw new Error('ImageKit upload failed: ' + JSON.stringify(uploaded));
}

return [{ json: Object.assign({}, meta, uploaded) }];`
}

function imageKitUploadParams({ folder = '/generated-posts' } = {}) {
  return { jsCode: imageKitUploadCode({ folder }) }
}

function scrubString(s) {
  if (typeof s !== 'string') return s
  let out = s
  for (const host of OLD_HOSTS) {
    out = out.split(`https://${host}`).join(SB)
    out = out.split(host).join(SB.replace(/^https?:\/\//, ''))
  }
  // Any leftover supabase storage public URL pattern after host swap
  out = out.replace(
    new RegExp(
      `${SB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/storage/v1/object/public/generated-posts/`,
      'g'
    ),
    `${IK_EP}/`
  )
  out = out.replace(
    /https:\/\/[^"'`\s]+\/storage\/v1\/object\/public\/generated-posts\//g,
    `${IK_EP}/`
  )

  // JWTs (supabase service/anon style)
  out = out.replace(
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    (m) => {
      try {
        const payload = JSON.parse(Buffer.from(m.split('.')[1], 'base64url').toString())
        if (payload.role === 'service_role' || payload.role === 'anon' || payload.ref) {
          return SB_KEY
        }
      } catch (_) {}
      return m
    }
  )
  out = out.replace(/Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, `Bearer ${SB_KEY}`)

  // OpenAI
  out = out.replace(/Bearer\s+sk-[A-Za-z0-9_\-]+/g, `Bearer ${OAI}`)
  out = out.replace(/\bsk-proj-[A-Za-z0-9_\-]+/g, OAI)
  out = out.replace(/\bsk-[A-Za-z0-9]{20,}/g, OAI)

  // Cloudinary leftovers
  out = out.replace(/https:\/\/api\.cloudinary\.com\/v1_1\/[^/"'\s]+/g, 'https://upload.imagekit.io/api/v1/files/upload')
  out = out.replace(/https:\/\/res\.cloudinary\.com\/[^/"'\s]+/g, IK_EP)
  out = out.replace(/\bdfhqnoe6h\b/g, 'REMOVED_CLOUDINARY')
  out = out.replace(/\bdfhqnoc6h\b/g, 'REMOVED_CLOUDINARY')

  // Replicate / other long secrets left as-is unless clearly openai

  return out
}

function scrubDeep(value) {
  if (typeof value === 'string') return scrubString(value)
  if (Array.isArray(value)) return value.map(scrubDeep)
  if (value && typeof value === 'object') {
    const o = {}
    for (const [k, v] of Object.entries(value)) o[k] = scrubDeep(v)
    return o
  }
  return value
}

function renameInConnections(connections, renameMap) {
  if (!connections) return connections
  const next = {}
  for (const [from, ports] of Object.entries(connections)) {
    const newFrom = renameMap[from] || from
    const newPorts = (ports.main || ports).map
      ? undefined
      : undefined
    // n8n connections shape: { main: [ [ { node, type, index } ] ] }
    const cloned = JSON.parse(JSON.stringify(ports))
    if (cloned.main) {
      for (const branch of cloned.main) {
        if (!branch) continue
        for (const link of branch) {
          if (link && renameMap[link.node]) link.node = renameMap[link.node]
        }
      }
    }
    next[newFrom] = cloned
  }
  return next
}

function removeNodes(wf, names) {
  const drop = new Set(names)
  wf.nodes = (wf.nodes || []).filter((n) => !drop.has(n.name))
  if (wf.connections) {
    for (const name of drop) delete wf.connections[name]
    for (const ports of Object.values(wf.connections)) {
      if (!ports.main) continue
      for (const branch of ports.main) {
        if (!branch) continue
        for (let i = branch.length - 1; i >= 0; i--) {
          if (drop.has(branch[i].node)) branch.splice(i, 1)
        }
      }
    }
  }
}

function findNode(wf, name) {
  return (wf.nodes || []).find((n) => n.name === name)
}

function setConnection(wf, from, to) {
  if (!wf.connections) wf.connections = {}
  wf.connections[from] = { main: [[{ node: to, type: 'main', index: 0 }]] }
}

function convertStorageOrCloudinaryUploadNode(node, opts = {}) {
  const folder = opts.folder || '/generated-posts'
  const nameHint = node.name || ''

  // Detect storage binary upload or cloudinary multipart
  const url = String(node.parameters?.url || '')
  const isStorage = url.includes('/storage/v1/object/')
  const isCloudinary = url.includes('cloudinary.com') || /cloudinary/i.test(nameHint)

  if (!isStorage && !isCloudinary) return false

  const newName = opts.newName || nameHint
    .replace(/Supabase Storage/gi, 'ImageKit')
    .replace(/to Supabase$/i, 'to ImageKit')
    .replace(/Cloudinary/gi, 'ImageKit')
    .replace(/Upload BG to ImageKit/i, 'Upload BG to ImageKit')

  node.name = newName
  node.type = 'n8n-nodes-base.code'
  node.typeVersion = 2
  node.parameters = imageKitUploadParams({ folder })
  return true
}

function simplifyGenerateCloudinaryChain(wf, { afterUploadTarget }) {
  const drop = [
    'Upload Base To Cloudinary',
    'Upload Logo To Cloudinary',
    'Build Cloudinary Overlay URL',
    'Download Composited Image',
    'Upload to Supabase Storage',
  ]
  removeNodes(wf, drop)

  const extract = findNode(wf, 'Extract and Prepare Image')
  if (extract?.parameters?.jsCode) {
    extract.parameters.jsCode = extract.parameters.jsCode
      .replace(
        /imageUrl:\s*`[^`]+`/,
        "imageUrl: null /* set after ImageKit upload */"
      )
  }

  const uploadNode = {
    parameters: imageKitUploadParams({ folder: '/generated-posts' }),
    id: 'upload-imagekit-' + Math.random().toString(36).slice(2, 10),
    name: 'Upload to ImageKit',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: extract ? [extract.position[0] + 240, extract.position[1]] : [1440, 0],
  }

  const resolveCode = `const uploaded = $('Upload to ImageKit').first().json;
const meta = $('Extract and Prepare Image').first().json;
const endpoint = '${IK_EP}'.replace(/\\/$/, '');
let imageUrl = uploaded.url;
if (!imageUrl) throw new Error('ImageKit upload failed: ' + JSON.stringify(uploaded));

// Optional logo overlay when brand logo is already on ImageKit
const logoUrl = meta.logoUrl;
if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith(endpoint)) {
  let logoPath = logoUrl.slice(endpoint.length).replace(/^\\/tr:[^/]+/, '').split('?')[0];
  if (logoPath.startsWith('/')) logoPath = logoPath.slice(1);
  const overlayPath = logoPath.replace(/\\//g, '@@');
  const basePath = String(uploaded.filePath || '').replace(/^\\//, '');
  if (overlayPath && basePath) {
    imageUrl = endpoint + '/tr:l-image,i-' + overlayPath + ',w-220,lx-40,ly-40,l-end/' + basePath;
  }
}

return [{
  json: {
    ...meta,
    imageUrl,
    imageKitFileId: uploaded.fileId || null,
    imageKitFilePath: uploaded.filePath || null,
  }
}];`

  const resolveNode = {
    parameters: { jsCode: resolveCode },
    id: 'resolve-imagekit-' + Math.random().toString(36).slice(2, 10),
    name: 'Resolve ImageKit URL',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: uploadNode.position
      ? [uploadNode.position[0] + 240, uploadNode.position[1]]
      : [1680, 0],
  }

  wf.nodes.push(uploadNode, resolveNode)
  setConnection(wf, 'Extract and Prepare Image', 'Upload to ImageKit')
  setConnection(wf, 'Upload to ImageKit', 'Resolve ImageKit URL')
  setConnection(wf, 'Resolve ImageKit URL', afterUploadTarget)

  // Point Save / Parse QC / Respond at Resolve ImageKit URL imageUrl
  for (const node of wf.nodes) {
    const p = node.parameters || {}
    if (typeof p.body === 'string') {
      p.body = p.body
        .replace(
          /\$\('Extract and Prepare Image'\)\.first\(\)\.json\.imageUrl/g,
          "$('Resolve ImageKit URL').first().json.imageUrl"
        )
        .replace(
          /\$\('Parse QC Result'\)\.first\(\)\.json\.imageUrl/g,
          "$('Parse QC Result').first().json.imageUrl"
        )
    }
    if (typeof p.responseBody === 'string' && node.name === 'Respond to Webhook') {
      // v2 uses Extract imageUrl — switch to Resolve
      if (p.responseBody.includes("Extract and Prepare Image")) {
        p.responseBody = p.responseBody.replace(
          /\$\('Extract and Prepare Image'\)\.first\(\)\.json\.imageUrl/g,
          "$('Resolve ImageKit URL').first().json.imageUrl"
        )
      }
    }
    if (node.name === 'Parse QC Result' && p.jsCode) {
      p.jsCode = p.jsCode.replace(
        'const meta = $(\'Extract and Prepare Image\').first().json;',
        "const meta = $('Resolve ImageKit URL').first().json;"
      )
    }
    if (node.name === 'Save Generated Post' && typeof p.body === 'string') {
      // ensure brand fields still from extract/resolve
      p.body = p.body.replace(
        /\$\('Extract and Prepare Image'\)\.first\(\)\.json\.(brandId|referenceCategoryId|headline|cta|layoutId)/g,
        (_, field) => `$('Resolve ImageKit URL').first().json.${field}`
      )
      if (!p.body.includes('Resolve ImageKit URL') && p.body.includes('output_url')) {
        p.body = p.body.replace(
          /output_url:\s*[^,}]+/,
          "output_url: $('Resolve ImageKit URL').first().json.imageUrl"
        )
      }
    }
  }
}

function fixCarouselAggregate(wf) {
  const agg = findNode(wf, 'Aggregate Results')
  if (!agg?.parameters?.jsCode) return
  agg.parameters.jsCode = `const uploads = [
  $('Upload Slide 0').first().json,
  $('Upload Slide 1').first().json,
  $('Upload Slide 2').first().json,
  $('Upload Slide 3').first().json,
  $('Upload Slide 4').first().json,
  $('Upload Slide 5').first().json
];
const imageUrls = uploads.map((u, i) => {
  if (!u?.url) throw new Error('ImageKit upload failed for slide ' + i + ': ' + JSON.stringify(u));
  return u.url;
});
const meta = $('Parse Slides').first().json;
const jobId = $('Webhook').first().json.body.jobId;
const brandId = $('Webhook').first().json.body.brandId;
const enrichedSlides = meta.slides.map(s => ({ ...s.originalSlide, _colors: meta.colors }));
return [{ json: { imageUrls, jobId, brandId, logoUrl: meta.logoUrl, slides: enrichedSlides } }];`
}

function fixParseSlidesImageUrls(wf) {
  for (const node of wf.nodes || []) {
    if (!node.parameters?.jsCode) continue
    let code = node.parameters.jsCode
    // Drop precomputed supabase public URLs; ImageKit response supplies final URL
    code = code.replace(
      /const imageUrl = `[^`]*storage\/v1\/object\/public\/generated-posts\/\$\{storagePath\}`;/g,
      "const imageUrl = null; // set from ImageKit upload response"
    )
    code = code.replace(
      /imageUrl:\s*`[^`]*storage\/v1\/object\/public\/generated-posts\/[^`]+`/g,
      'imageUrl: null'
    )
    // After scrub, placeholders may appear
    code = code.replace(
      /const imageUrl = `\$\{?__IMAGEKIT_URL_ENDPOINT__\}?\/\$\{storagePath\}`;/g,
      'const imageUrl = null;'
    )
    code = code.replace(
      new RegExp(
        `const imageUrl = \\\`${IK_EP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\$\\{storagePath\\}\\\`;`,
        'g'
      ),
      'const imageUrl = null;'
    )
    node.parameters.jsCode = code
  }
}

function rewriteWorkflow(wf, filePath) {
  const base = path.basename(filePath)

  // Structural: generate social with Cloudinary chain
  if (
    findNode(wf, 'Upload Base To Cloudinary') &&
    findNode(wf, 'Upload to Supabase Storage')
  ) {
    const after = findNode(wf, 'QC Check') ? 'QC Check' : 'Save Generated Post'
    simplifyGenerateCloudinaryChain(wf, { afterUploadTarget: after })
  }

  // BG workflow: Cloudinary → ImageKit
  const bgUpload = findNode(wf, 'Upload BG to Cloudinary')
  if (bgUpload) {
    const oldName = bgUpload.name
    bgUpload.name = 'Upload BG to ImageKit'
    bgUpload.type = 'n8n-nodes-base.code'
    bgUpload.typeVersion = 2
    bgUpload.parameters = imageKitUploadParams({ folder: '/generated-posts' })
    wf.connections = renameInConnections(wf.connections, {
      [oldName]: 'Upload BG to ImageKit',
    })
    // also rename targets pointing to old name
    const build = findNode(wf, 'Build Response')
    if (build?.parameters?.jsCode) {
      build.parameters.jsCode = `const uploaded = $('Upload BG to ImageKit').first().json;
const meta = $('Extract BG Image').first().json;

const bgImageUrl = uploaded.url;
if (!bgImageUrl) throw new Error('ImageKit upload failed: ' + JSON.stringify(uploaded));

return [{
  json: {
    bgImageUrl,
    logoUrl: meta.logoUrl,
    puppeteerConfig: meta.puppeteerConfig
  }
}];`
    }
    if (wf.connections?.['Extract BG Image']) {
      setConnection(wf, 'Extract BG Image', 'Upload BG to ImageKit')
    }
    if (wf.connections?.['Upload BG to ImageKit'] || wf.connections?.[oldName]) {
      setConnection(wf, 'Upload BG to ImageKit', 'Build Response')
      delete wf.connections[oldName]
    }
  }

  // Banner: Cloudinary → ImageKit
  const bannerUpload = findNode(wf, 'Upload to Cloudinary')
  if (bannerUpload && base.includes('banner')) {
    const oldName = bannerUpload.name
    bannerUpload.name = 'Upload to ImageKit'
    bannerUpload.type = 'n8n-nodes-base.code'
    bannerUpload.typeVersion = 2
    bannerUpload.parameters = imageKitUploadParams({ folder: '/generated-posts' })
    wf.connections = renameInConnections(wf.connections, { [oldName]: 'Upload to ImageKit' })
    const assemble = findNode(wf, 'Assemble Response')
    if (assemble?.parameters?.jsCode) {
      assemble.parameters.jsCode = `const upload = $('Upload to ImageKit').first().json;
const meta = $('Extract Image').first().json;
if (!upload.url) throw new Error('ImageKit upload failed: ' + JSON.stringify(upload));
return [{ json: {
  colors: meta.colors,
  logoUrl: meta.logoUrl,
  bgImageUrl: upload.url
} }];`
    }
    if (wf.connections?.['Extract Image']) {
      setConnection(wf, 'Extract Image', 'Upload to ImageKit')
    }
    setConnection(wf, 'Upload to ImageKit', 'Assemble Response')
    delete wf.connections[oldName]
  }

  // Generic: convert remaining storage / cloudinary upload HTTP nodes
  const renameMap = {}
  for (const node of wf.nodes || []) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue
    const url = String(node.parameters?.url || '')
    const isStorage = url.includes('/storage/v1/object/')
    const isCloudinary =
      url.includes('cloudinary.com') || /Cloudinary/i.test(node.name)
    if (!isStorage && !isCloudinary) continue
    if (node.name === 'Upload to ImageKit' || node.name === 'Upload BG to ImageKit') continue

    const oldName = node.name
    let newName = oldName
      .replace(/Supabase Storage/gi, 'ImageKit')
      .replace(/to Supabase$/i, 'to ImageKit')
      .replace(/Cloudinary/gi, 'ImageKit')
    if (newName === oldName && /Upload Slide/i.test(oldName)) {
      // keep "Upload Slide N"
    } else if (newName === oldName) {
      newName = oldName.includes('Upload') ? oldName.replace(/Upload.*/, 'Upload to ImageKit') : 'Upload to ImageKit'
      if (/Upload Slide \d/i.test(oldName)) newName = oldName
    }

    const fileNameExpr = /Upload Slide/i.test(oldName)
      ? `={{ ($json.storagePath || 'slide.png').toString().split('/').pop() }}`
      : `={{ ($json.storagePath || $('Pick Prompt').first().json.storagePath || 'upload.png').toString().split('/').pop() }}`

    node.name = newName
    node.type = 'n8n-nodes-base.code'
    node.typeVersion = 2
    node.parameters = imageKitUploadParams({ folder: '/generated-posts' })
    if (newName !== oldName) renameMap[oldName] = newName
  }
  if (Object.keys(renameMap).length) {
    wf.connections = renameInConnections(wf.connections, renameMap)
  }

  // Broker: Save/Respond must use ImageKit URL from upload node
  const brokerUpload =
    findNode(wf, 'Upload to ImageKit') || findNode(wf, 'Upload to Supabase')
  if (base.includes('broker') && brokerUpload) {
    if (brokerUpload.name !== 'Upload to ImageKit') {
      const old = brokerUpload.name
      brokerUpload.name = 'Upload to ImageKit'
      wf.connections = renameInConnections(wf.connections, { [old]: 'Upload to ImageKit' })
    }
    const save = findNode(wf, 'Save to DB')
    if (save?.parameters) {
      save.parameters.body =
        "={{ JSON.stringify({ brand_id: $('Pick Prompt').first().json.brandId, output_url: $('Upload to ImageKit').first().json.url, is_broker: true, created_by_email: $('Webhook Broker').first().json.body?.createdByEmail || null }) }}"
    }
    const respond = findNode(wf, 'Respond Broker Webhook')
    if (respond?.parameters) {
      respond.parameters.responseBody =
        "={{ { success: true, imageUrl: $('Upload to ImageKit').first().json.url } }}"
    }
  }

  // Ad concept / illustrations: Assemble/Save/Respond use ImageKit url
  if (base.includes('ad_concept') || base.includes('illustrations')) {
    const upload =
      findNode(wf, 'Upload to ImageKit') ||
      findNode(wf, 'Upload to Supabase Storage')
    if (upload && upload.name !== 'Upload to ImageKit') {
      const old = upload.name
      upload.name = 'Upload to ImageKit'
      wf.connections = renameInConnections(wf.connections, { [old]: 'Upload to ImageKit' })
    }
    const assemble = findNode(wf, 'Assemble Response')
    if (assemble?.parameters?.jsCode) {
      assemble.parameters.jsCode = `const meta = $('Extract Image').first().json;
const uploaded = $('Upload to ImageKit').first().json;
if (!uploaded.url) throw new Error('ImageKit upload failed: ' + JSON.stringify(uploaded));
return [{
  json: {
    imageUrl: uploaded.url,
    visualReferenceUrl: meta.visualReferenceUrl,
    puppeteerConfig: meta.puppeteerConfig,
    logoUrl: meta.logoUrl,
    brandId: meta.brandId,
    adAngleId: meta.adAngleId
  }
}];`
    }
    const save = findNode(wf, 'Save Generated Post')
    if (save?.parameters?.body) {
      save.parameters.body =
        "={{ JSON.stringify({ brand_id: $('Extract and Prepare Image').first().json.brandId, output_url: $('Upload to ImageKit').first().json.url, is_illustration: true, headline: $('Extract and Prepare Image').first().json.context.slice(0, 255) }) }}"
    }
    const respond = findNode(wf, 'Respond to Webhook')
    if (respond?.parameters?.responseBody && base.includes('illustrations')) {
      respond.parameters.responseBody =
        "={{ { imageUrl: $('Upload to ImageKit').first().json.url } }}"
    }
    // extract nodes: clear precomputed storage URLs
    for (const n of wf.nodes || []) {
      if (n.parameters?.jsCode && n.parameters.jsCode.includes('imageUrl:')) {
        n.parameters.jsCode = n.parameters.jsCode.replace(
          /imageUrl:\s*`[^`]+`/g,
          'imageUrl: null'
        )
      }
    }
  }

  fixParseSlidesImageUrls(wf)
  if (findNode(wf, 'Aggregate Results') && findNode(wf, 'Upload Slide 0')) {
    fixCarouselAggregate(wf)
  }

  // Scrub secrets + hosts everywhere
  const scrubbed = scrubDeep(wf)

  // Ensure REST URLs use __SUPABASE_URL__ (full) not bare host leftovers
  for (const node of scrubbed.nodes || []) {
    const p = node.parameters || {}
    if (typeof p.url === 'string') {
      // Fix accidental https://__SUPABASE_URL__/ when SB already has https
      p.url = p.url.replace(/https:\/\/__SUPABASE_URL__/g, SB)
      p.url = p.url.replace(/=https:\/\/__SUPABASE_URL__/g, `=${SB}`)
      // Bare host form after scrub: =__SUPABASE_HOST__/rest → should be =__SUPABASE_URL__/rest
      p.url = p.url.replace(
        /=https?:\/\/__SUPABASE_URL__/g,
        `=${SB}`
      )
      // If url still has storage paths, convert leftovers (shouldn't after node rewrite)
      if (p.url.includes('/storage/v1/')) {
        console.warn('WARN leftover storage URL in', base, node.name, p.url.slice(0, 120))
      }
    }
    if (p.headerParameters?.parameters) {
      const url = String(p.url || '')
      const isSupabase =
        url.includes(SB) || url.includes('/rest/v1/') || url.includes('supabase')
      const isImageKit = url.includes('imagekit.io')
      const isOpenAI = url.includes('api.openai.com')
      const isOpenRouter = url.includes('openrouter.ai')
      const isReplicate =
        url.includes('replicate.com') ||
        /^Poll \d$/.test(node.name) ||
        node.name === 'Create Prediction'
      for (const h of p.headerParameters.parameters) {
        if (h.name === 'apikey' && isSupabase) h.value = SB_KEY
        if (h.name !== 'Authorization') continue
        if (isImageKit) h.value = `Basic ${IK_AUTH}`
        else if (isOpenAI) h.value = `Bearer ${OAI}`
        else if (isOpenRouter) h.value = 'Bearer __OPENROUTER_API_KEY__'
        else if (isReplicate) h.value = 'Bearer __REPLICATE_API_TOKEN__'
        else if (isSupabase) h.value = `Bearer ${SB_KEY}`
      }
    }
  }

  return scrubbed
}

function main() {
  const files = walkJsonFiles(ROOT)
  let ok = 0
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    let wf
    try {
      wf = JSON.parse(raw)
    } catch (e) {
      console.error('SKIP parse fail', file, e.message)
      continue
    }
    if (!wf.nodes) {
      console.log('SKIP no nodes', path.relative(ROOT, file))
      continue
    }
    const next = rewriteWorkflow(wf, file)
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
    ok++
    console.log('OK', path.relative(ROOT, file))
  }

  // Verification pass
  console.log('\n--- verify ---')
  let bad = 0
  for (const file of walkJsonFiles(ROOT)) {
    const text = fs.readFileSync(file, 'utf8')
    const checks = [
      [/cloudinary\.com/i, 'cloudinary'],
      [/dfhqnoe6h/, 'old cloudinary cloud'],
      [/\/storage\/v1\//, 'supabase storage'],
      [/dhmjgwwqlttndjamrisv/, 'old sb host'],
      [/kjrpcysqaxkhnynfoiks/, 'old sb host2'],
      [/sk-proj-/, 'openai key'],
      [/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobW/, 'old jwt'],
    ]
    for (const [re, label] of checks) {
      if (re.test(text)) {
        console.log('BAD', label, path.relative(ROOT, file))
        bad++
      }
    }
    if (/upload\.imagekit\.io/.test(text) || !/storage\/v1|cloudinary/i.test(text)) {
      // ok
    }
  }
  console.log(`Rewrote ${ok} files; ${bad} leftover issues`)
  if (bad) process.exitCode = 1
}

main()
