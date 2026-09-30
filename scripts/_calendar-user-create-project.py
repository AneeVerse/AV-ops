#!/usr/bin/env python3
"""Use the user cloud-platform token to identify the account and create a Web OAuth client."""
import json
import time
import urllib.error
import urllib.request
import base64

tokens = json.load(open("/tmp/gcp-user.token.json"))
access = tokens["access_token"]

def b64url(s):
    s += "=" * (-len(s) % 4)
    return json.loads(base64.urlsafe_b64decode(s))

email = None
try:
    payload = b64url(tokens["id_token"].split(".")[1])
    email = payload.get("email")
    print("user_email", email)
except Exception as e:
    print("id_token decode", type(e).__name__)

def req(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + access)
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:800]}
        return e.code, parsed
    except json.JSONDecodeError:
        return 200, {"raw": "non-json"}

st, body = req("GET", "https://www.googleapis.com/oauth2/v2/userinfo")
print("userinfo", st, {k: body.get(k) for k in ("email", "verified_email", "id") if isinstance(body, dict)})

st, body = req("GET", "https://cloudresourcemanager.googleapis.com/v1/projects")
print("projects", st)
if isinstance(body, dict):
    for p in body.get("projects", [])[:20]:
        print(" ", p.get("projectId"), p.get("name"), p.get("lifecycleState"), p.get("projectNumber"))

# Try creating a dedicated project
suffix = str(int(time.time()))[-6:]
project_id = f"aneeverse-cal-{suffix}"
st, body = req(
    "POST",
    "https://cloudresourcemanager.googleapis.com/v1/projects",
    {"projectId": project_id, "name": "Aneeverse Huly Calendar"},
)
print("create_project", project_id, st, body if st != 200 else "ok")
open("/tmp/gcp-cal-project.txt", "w").write(project_id)

# Wait for project
for _ in range(10):
    st, body = req("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{project_id}")
    print("project_get", st, body.get("lifecycleState") if isinstance(body, dict) else body)
    if st == 200:
        break
    time.sleep(3)

open("/tmp/gcp-user-probe.json", "w").write(json.dumps({"email": email, "project_id": project_id, "create": st}))
print("probe_done")
