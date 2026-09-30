#!/usr/bin/env python3
import json
d = json.load(open("/opt/huly-selfhost/secrets/calendar-credentials.json"))
w = d.get("web") or {}
ok = bool(w.get("client_id") and w.get("client_secret"))
print("ok", int(ok))
print("project", w.get("project_id"))
print("redirects", w.get("redirect_uris"))
print("js", w.get("javascript_origins"))
cid = w.get("client_id") or ""
print("id_prefix", cid[:22])
want = "https://app.aneeverse.com/_calendar/signin/code"
if want not in (w.get("redirect_uris") or []):
    raise SystemExit("missing redirect URI")
