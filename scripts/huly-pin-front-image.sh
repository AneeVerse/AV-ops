#!/usr/bin/env bash
set -euo pipefail
cd /opt/huly-selfhost
cp -a compose.override.yml compose.override.yml.bak-lead-wizard
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/huly-selfhost/compose.override.yml')
text = p.read_text()
old = '''  front:
    <<: *huly-hosts
'''
new = '''  front:
    <<: *huly-hosts
    image: huly-front-custom:lead-wizard
'''
if 'huly-front-custom:lead-wizard' in text:
    print('already pinned')
elif old not in text:
    raise SystemExit('front block not found')
else:
    p.write_text(text.replace(old, new, 1))
    print('pinned front image')
print(p.read_text())
PY
