#!/bin/bash
set -euo pipefail
echo "=== gcloud ==="
command -v gcloud || echo 'no gcloud'
if command -v gcloud >/dev/null; then
  gcloud auth list 2>/dev/null | head -20
  gcloud config get-value project 2>/dev/null || true
fi
echo
echo "=== hermes client types (no secrets) ==="
python3 - <<'PY'
import json, os, glob
paths = glob.glob('/root/.hermes/profiles/*/google_client_secret.json')
for p in sorted(paths):
    try:
        with open(p) as f:
            d = json.load(f)
        kind = 'web' if 'web' in d else 'installed' if 'installed' in d else list(d.keys())
        blob = d.get('web') or d.get('installed') or {}
        uris = blob.get('redirect_uris', [])
        cid = blob.get('client_id', '')
        prefix = cid.split('.')[0][:12] if cid else ''
        print(f"{p}: kind={kind} client_id_prefix={prefix} redirect_uris={uris}")
    except Exception as e:
        print(p, 'ERR', e)
PY
echo
echo "=== gogcli credentials keys ==="
python3 - <<'PY'
import json
p='/root/.config/gogcli/credentials.json'
try:
    d=json.load(open(p))
    print('keys', list(d.keys())[:20])
    if 'web' in d or 'installed' in d:
        blob=d.get('web') or d.get('installed')
        print('kind', 'web' if 'web' in d else 'installed')
        print('redirect_uris', blob.get('redirect_uris'))
        print('client_id_prefix', (blob.get('client_id') or '')[:20])
except Exception as e:
    print('err', e)
PY
echo
echo "=== hermes token scopes (no tokens) ==="
python3 - <<'PY'
import json, glob
for p in sorted(glob.glob('/root/.hermes/profiles/*/google_token.json'))[:8]:
    try:
        d=json.load(open(p))
        print(p, 'keys', list(d.keys()), 'scope=', d.get('scope') or d.get('scopes') or d.get('token', {}).get('scope'))
    except Exception as e:
        print(p, e)
PY
