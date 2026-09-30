#!/usr/bin/env python3
import json, time, urllib.error, urllib.request

tokens = json.load(open("/tmp/gcp-user.token.json"))
access = tokens["access_token"]
project_id = open("/tmp/gcp-cal-project.txt").read().strip()

def req(method, url, body=None, extra_headers=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + access)
    r.add_header("Content-Type", "application/json")
    r.add_header("x-goog-user-project", project_id)
    if extra_headers:
        for k, v in extra_headers.items():
            r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=45) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:1000]}
        return e.code, parsed

st, proj = req("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{project_id}")
print("project", st, proj.get("projectId"), proj.get("projectNumber"))
number = proj.get("projectNumber")

print("enable calendar", req(
    "POST",
    f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/calendar-json.googleapis.com:enable",
    {},
)[0])
print("enable people", req(
    "POST",
    f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/people.googleapis.com:enable",
    {},
)[0])

# wait calendar enabled
for i in range(12):
    st, body = req(
        "GET",
        f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/calendar-json.googleapis.com",
    )
    state = body.get("state") if isinstance(body, dict) else None
    print("calendar_state", state)
    if state == "ENABLED":
        break
    time.sleep(3)

redirect = "https://app.aneeverse.com/_calendar/signin/code"
brand_bodies = [
    {"applicationTitle": "Aneeverse", "supportEmail": "mayur@aneeverse.com"},
    {
        "projectNumber": number,
        "applicationTitle": "Aneeverse",
        "supportEmail": "mayur@aneeverse.com",
        "orgInternalOnly": False,
    },
]
brand_urls = [
    f"https://clientauthconfig.googleapis.com/v1/projects/{number}/brands",
    f"https://clientauthconfig.googleapis.com/v1/brands?parent=projects/{number}",
    "https://clientauthconfig.googleapis.com/v1/brands",
    f"https://iap.googleapis.com/v1/projects/{project_id}/brands",
    f"https://iap.googleapis.com/v1/projects/{number}/brands",
]
print("\n=== brands ===")
for url in brand_urls:
    for i, b in enumerate(brand_bodies):
        st, body = req("POST", url, b)
        msg = body.get("error", {}).get("message") if isinstance(body.get("error"), dict) else str(body)[:200]
        print("BRAND", st, url.split(".com")[-1][:60], i, msg)

print("\n=== list brands ===")
for url in [
    f"https://iap.googleapis.com/v1/projects/{project_id}/brands",
    f"https://iap.googleapis.com/v1/projects/{number}/brands",
    f"https://clientauthconfig.googleapis.com/v1/brands?parent=projects/{number}",
]:
    st, body = req("GET", url)
    print("LIST", st, url.split(".com")[-1][:70], str(body)[:250])

print("\n=== create web client ===")
client_bodies = [
    {
        "displayName": "Aneeverse Calendar",
        "redirectUris": [redirect],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "clientType": "WEB",
        "projectNumber": number,
    },
    {
        "display_name": "Aneeverse Calendar",
        "redirect_uris": [redirect],
        "javascript_origins": ["https://app.aneeverse.com"],
        "client_type": 1,
        "project_number": int(number) if number and str(number).isdigit() else number,
    },
]
for url in [
    "https://clientauthconfig.googleapis.com/v1/clients",
    f"https://clientauthconfig.googleapis.com/v1/clients?parent=projects/{number}",
    f"https://clientauthconfig.googleapis.com/v1/projects/{number}/clients",
]:
    for i, b in enumerate(client_bodies):
        st, body = req("POST", url, b)
        err = body.get("error", {})
        print("CLIENT", st, url.split(".com")[-1][:70], i, err.get("message") if isinstance(err, dict) else str(body)[:180])
        if st in (200, 201) and "error" not in body:
            open("/tmp/gcp-web-client.json", "w").write(json.dumps(body))
            print("SAVED_CLIENT")
            break
