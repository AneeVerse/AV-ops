import re
from pathlib import Path
text = Path("/opt/av_ops/web/cultura/deploy/backend/medusa-config.ts").read_text()
text = re.sub(r"process\.env\.[A-Z0-9_]+", "process.env.KEY", text)
text = re.sub(r"'[^']{8,}'", "'***'", text)
text = re.sub(r'"[^"]{8,}"', '"***"', text)
print(text[:6000])
