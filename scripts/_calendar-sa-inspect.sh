#!/bin/bash
set -euo pipefail
python3 - <<'PY'
import json, os
files = [
  '/root/.hermes/profiles/leadgen/google_service_account.json',
  '/root/.hermes/profiles/leadgen2/google_service_account.json',
  '/root/.config/gogcli/credentials.json',
]
# openclaw desktop key
import glob
files += glob.glob('/root/.openclaw/media/inbound/anees_aneeverse_com_desktop_auth_key*.json')
for p in files:
    if not os.path.exists(p):
        print('MISSING', p)
        continue
    d = json.load(open(p))
    if isinstance(d, dict):
        print('FILE', p)
        print('  keys', sorted(d.keys())[:15])
        print('  type', d.get('type'))
        print('  client_email', d.get('client_email'))
        print('  project_id', d.get('project_id'))
        cid = d.get('client_id')
        if cid:
            print('  client_id_prefix', str(cid)[:16])
    else:
        print('FILE', p, 'not dict', type(d))
PY
