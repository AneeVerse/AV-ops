#!/usr/bin/env python3
import json, time, urllib.error, urllib.request

tokens = json.load(open("/tmp/gcp-user.token.json"))
access = tokens["access_token"]
project_id = open("/tmp/gcp-cal-project.txt").read().strip()
print("project_id", project_id)

def req(method, url, body=None, quota=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + access)
    r.add_header("Content-Type", "application/json")
    if quota:
        r.add_header("x-goog-user-project", quota)
    try:
        with urllib.request.urlopen(r, timeout=45) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:700]}
        return e.code, parsed

st, proj = req("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{project_id}")
print("get_no_quota", st, proj)
number = proj.get("projectNumber") if isinstance(proj, dict) else None

st, body = req("GET", "https://cloudresourcemanager.googleapis.com/v1/projects")
print("list")
for p in body.get("projects", []):
    if "aneeverse" in p.get("projectId", "") or "cal" in p.get("projectId", ""):
        print(" ", p)
        project_id = p.get("projectId") or project_id
        number = p.get("projectNumber") or number

print("using", project_id, number)

for svc in [
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "calendar-json.googleapis.com",
    "people.googleapis.com",
    "iap.googleapis.com",
]:
    st, body = req(
        "POST",
        f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/{svc}:enable",
        {},
    )
    err = body.get("error", {}).get("message") if isinstance(body.get("error"), dict) else None
    print("enable", svc, st, err or (body.get("name") if isinstance(body, dict) else body))

time.sleep(5)
st, body = req(
    "GET",
    f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/calendar-json.googleapis.com",
)
print("calendar", st, body.get("state") if isinstance(body, dict) else body)

redirect = "https://app.aneeverse.com/_calendar/signin/code"
print("\n=== iap brand ===")
st, body = req(
    "POST",
    f"https://iap.googleapis.com/v1/projects/{project_id}/brands",
    {"applicationTitle": "Aneeverse", "supportEmail": "mayur@aneeverse.com"},
)
print("iap_brand", st, body)

print("\n=== clientauthconfig brand ===")
st, body = req(
    "POST",
    "https://clientauthconfig.googleapis.com/v1/brands",
    {
        "applicationTitle": "Aneeverse",
        "supportEmail": "mayur@aneeverse.com",
        "projectNumber": str(number) if number else None,
    },
)
print("cac_brand", st, body)

print("\n=== client create ===")
st, body = req(
    "POST",
    "https://clientauthconfig.googleapis.com/v1/clients",
    {
        "displayName": "Aneeverse Calendar",
        "redirectUris": [redirect],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "clientType": "WEB",
        "projectNumber": str(number) if number else None,
    },
)
print("client", st, body)
if st in (200, 201) and "error" not in body:
    open("/tmp/gcp-web-client.json", "w").write(json.dumps(body))
    print("SAVED")
